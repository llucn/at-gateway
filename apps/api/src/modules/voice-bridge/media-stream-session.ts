import { EventEmitter } from 'node:events';
import WebSocket from 'ws';
import { ACCOUNT_SID, newSid } from './incoming-notifier';
import { buildWav, mulawToPcm16, parseWavPcm, pcm16ToMulaw, toFrames } from './g711';

/** What the session needs from the modem (implemented on top of CallManager + AtClient.files). */
export interface BridgeAudioDevice {
  upload(modulePath: string, data: Buffer): Promise<void>;
  download(modulePath: string): Promise<Buffer>;
  remove(modulePath: string): Promise<void>;
  play(modulePath: string): Promise<void>;
  stopPlay(): Promise<void>;
  startRecord(modulePath: string): Promise<void>;
  stopRecord(): Promise<void>;
  waitPlaybackEnd(timeoutMs: number): { promise: Promise<void>; cancel: () => void };
  /** True while the voice call is still up (AT+CLCC). */
  isCallActive(): Promise<boolean>;
}

export interface MediaStreamSessionOptions {
  url: string;
  callSid: string;
  device: BridgeAudioDevice;
  /** Timeout for establishing the WebSocket. */
  connectTimeoutMs?: number;
  /** Length of one recording segment (upstream latency). */
  segmentMs?: number;
  /** Module file names (module FS root is `C:/`). */
  recPath?: string;
  playPath?: string;
  log?: (msg: string) => void;
}

export type CloseReason = 'remote' | 'app' | 'error' | 'local';

type QueueItem = { kind: 'media'; audio: Buffer } | { kind: 'mark'; name: string };

const FRAME_BYTES = 160; // 20ms of 8kHz μ-law

/**
 * Twilio Media Streams client for one call. Half-duplex: the module cannot record while it plays,
 * so the loop alternates recording segments (sent upstream as `media`) and playback of whatever
 * the application queued (`media`, `mark`, `clear`).
 *
 * Emits `closed` (reason, error?) exactly once.
 */
export class MediaStreamSession extends EventEmitter {
  readonly streamSid = newSid('MZ');
  private ws: WebSocket | null = null;
  private seq = 0;
  private chunk = 0;
  private startedAt = 0;
  private closed = false;
  private loopPromise: Promise<void> | null = null;
  private queue: QueueItem[] = [];
  /** Marks whose audio has been handed to the module but not yet confirmed as played. */
  private inFlightMarks: string[] = [];
  private playback: { cancel: () => void } | null = null;
  private wake: (() => void) | null = null;
  private readonly segmentMs: number;
  private readonly recPath: string;
  private readonly playPath: string;

  constructor(private opts: MediaStreamSessionOptions) {
    super();
    this.segmentMs = opts.segmentMs ?? 1000;
    this.recPath = opts.recPath ?? 'C:/vb_rec.wav';
    this.playPath = opts.playPath ?? 'C:/vb_play.wav';
  }

  private log(msg: string) {
    this.opts.log?.(msg);
  }

  /** Connect and send `connected` + `start`. Rejects if the application cannot be reached. */
  async connect(): Promise<void> {
    const ws = new WebSocket(this.opts.url);
    this.ws = ws;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        ws.terminate();
        reject(new Error(`Stream connection timed out after ${this.opts.connectTimeoutMs ?? 10000}ms`));
      }, this.opts.connectTimeoutMs ?? 10000);
      ws.once('open', () => {
        clearTimeout(timer);
        resolve();
      });
      ws.once('error', (e) => {
        clearTimeout(timer);
        reject(new Error(`Stream connection failed: ${e.message}`));
      });
    });

    ws.on('message', (data) => this.onMessage(data.toString()));
    ws.on('close', () => void this.close('app'));
    ws.on('error', (e) => {
      this.log(`WebSocket error: ${e.message}`);
      void this.close('error', e);
    });

    this.startedAt = Date.now();
    this.send({ event: 'connected', protocol: 'Call', version: '1.0.0' });
    this.sendSequenced({
      event: 'start',
      streamSid: this.streamSid,
      start: {
        streamSid: this.streamSid,
        accountSid: ACCOUNT_SID,
        callSid: this.opts.callSid,
        tracks: ['inbound'],
        mediaFormat: { encoding: 'audio/x-mulaw', sampleRate: 8000, channels: 1 },
        customParameters: {},
      },
    });
  }

  /** Start exchanging audio (the call must already be active). */
  run(): void {
    if (this.loopPromise || this.closed) return;
    this.loopPromise = this.loop()
      .catch((e) => this.close('error', e))
      .finally(() => this.cleanupModule());
  }

  private async cleanupModule(): Promise<void> {
    const { device } = this.opts;
    await device.stopRecord().catch(() => undefined);
    await device.remove(this.recPath).catch(() => undefined);
    await device.remove(this.playPath).catch(() => undefined);
  }

  private send(obj: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }

  private sendSequenced(obj: Record<string, unknown>): void {
    this.seq += 1;
    this.send({ ...obj, sequenceNumber: String(this.seq), ...(obj.streamSid ? {} : { streamSid: this.streamSid }) });
  }

  private onMessage(text: string): void {
    let msg: any;
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }
    switch (msg.event) {
      case 'media': {
        const payload = msg.media?.payload;
        if (typeof payload === 'string' && payload.length > 0) {
          this.queue.push({ kind: 'media', audio: Buffer.from(payload, 'base64') });
          this.wake?.();
        }
        break;
      }
      case 'mark': {
        const name = msg.mark?.name;
        if (typeof name === 'string') {
          this.queue.push({ kind: 'mark', name });
          this.wake?.();
        }
        break;
      }
      case 'clear':
        void this.handleClear();
        break;
      default:
        break; // other events are ignored
    }
  }

  private sendMark(name: string): void {
    this.sendSequenced({ event: 'mark', mark: { name } });
  }

  private async handleClear(): Promise<void> {
    const dropped = this.queue.filter((i): i is { kind: 'mark'; name: string } => i.kind === 'mark');
    this.queue = [];
    const inflight = this.inFlightMarks;
    this.inFlightMarks = [];
    if (this.playback) {
      this.playback.cancel();
      await this.opts.device.stopPlay().catch(() => undefined);
    }
    for (const name of [...inflight, ...dropped.map((d) => d.name)]) this.sendMark(name);
  }

  private async loop(): Promise<void> {
    const { device } = this.opts;
    while (!this.closed) {
      if (this.queue.length > 0) {
        await this.playQueued();
        continue;
      }
      if (!(await device.isCallActive())) {
        await this.close('remote');
        return;
      }
      await this.recordSegment();
    }
  }

  /** Play everything queued so far as one file, then confirm its marks. */
  private async playQueued(): Promise<void> {
    const items = this.queue;
    this.queue = [];
    const audio = Buffer.concat(items.filter((i) => i.kind === 'media').map((i) => (i as { audio: Buffer }).audio));
    const marks = items.filter((i) => i.kind === 'mark').map((i) => (i as { name: string }).name);

    if (audio.length === 0) {
      for (const name of marks) this.sendMark(name);
      return;
    }

    const { device } = this.opts;
    const wav = buildWav(mulawToPcm16(audio));
    const waitMs = Math.ceil((audio.length / 8000) * 1000) + 5000;
    this.inFlightMarks = marks;
    try {
      await device.upload(this.playPath, wav);
      const end = device.waitPlaybackEnd(waitMs);
      end.promise.catch(() => undefined);
      this.playback = end;
      try {
        await device.play(this.playPath);
        await end.promise;
      } finally {
        this.playback = null;
        end.cancel();
      }
    } catch (e: any) {
      if (!this.closed && !(await device.isCallActive().catch(() => false))) {
        await this.close('remote');
        return;
      }
      this.log(`Playback failed: ${e.message}`);
    } finally {
      await device.remove(this.playPath).catch(() => undefined);
    }
    // Marks still in flight (i.e. not already flushed by `clear`) are now confirmed.
    const confirmed = this.inFlightMarks;
    this.inFlightMarks = [];
    for (const name of confirmed) this.sendMark(name);
  }

  private async recordSegment(): Promise<void> {
    const { device } = this.opts;
    await device.remove(this.recPath).catch(() => undefined);
    await device.startRecord(this.recPath);
    // Wake early when the application queued audio so the reply is not held up for a full segment.
    await new Promise<void>((resolve) => {
      const timer = setTimeout(done, this.segmentMs);
      const wake = () => done();
      function done() {
        clearTimeout(timer);
        resolve();
      }
      this.wake = wake;
    });
    this.wake = null;
    await device.stopRecord();
    const wav = await device.download(this.recPath);
    await device.remove(this.recPath).catch(() => undefined);

    const parsed = parseWavPcm(wav);
    if (!parsed || parsed.pcm.length === 0) return;
    if (parsed.sampleRate !== 8000 || parsed.channels !== 1 || parsed.bits !== 16) {
      this.log(`Unexpected recording format ${parsed.sampleRate}Hz/${parsed.channels}ch/${parsed.bits}bit`);
      return;
    }
    for (const frame of toFrames(pcm16ToMulaw(parsed.pcm), FRAME_BYTES)) {
      this.chunk += 1;
      this.sendSequenced({
        event: 'media',
        media: {
          track: 'inbound',
          chunk: String(this.chunk),
          timestamp: String(Date.now() - this.startedAt),
          payload: frame.toString('base64'),
        },
      });
    }
  }

  /** End the session: stop audio, send `stop`, close the socket, remove module files. Idempotent. */
  async close(reason: CloseReason, error?: Error): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.wake?.();
    this.playback?.cancel();
    this.queue = [];

    const ws = this.ws;
    if (ws?.readyState === WebSocket.OPEN) {
      this.sendSequenced({
        event: 'stop',
        stop: { accountSid: ACCOUNT_SID, callSid: this.opts.callSid },
      });
      ws.close();
    } else if (ws && ws.readyState === WebSocket.CONNECTING) {
      ws.terminate();
    }

    const { device } = this.opts;
    await device.stopRecord().catch(() => undefined);
    await device.stopPlay().catch(() => undefined);
    await device.remove(this.recPath).catch(() => undefined);
    await device.remove(this.playPath).catch(() => undefined);
    this.emit('closed', reason, error);
  }
}
