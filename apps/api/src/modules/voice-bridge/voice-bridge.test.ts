import { describe, expect, it } from 'vitest';
import { WebSocketServer, type WebSocket } from 'ws';
import { buildWav, mulawToPcm16, parseWavPcm, pcm16ToMulaw, toFrames } from './g711';
import { parseTwiml } from './twiml';
import { MediaStreamSession, type BridgeAudioDevice } from './media-stream-session';

describe('g711', () => {
  it('round-trips PCM through mu-law within quantisation error', () => {
    const pcm = Buffer.alloc(2 * 800);
    for (let i = 0; i < 800; i++) pcm.writeInt16LE(Math.round(Math.sin(i / 8) * 12000), i * 2);
    const back = mulawToPcm16(pcm16ToMulaw(pcm));
    expect(back.length).toBe(pcm.length);
    for (let i = 0; i < 800; i++) {
      const a = pcm.readInt16LE(i * 2);
      const b = back.readInt16LE(i * 2);
      expect(Math.abs(a - b)).toBeLessThanOrEqual(Math.max(64, Math.abs(a) * 0.04));
    }
  });

  it('encodes silence as 0xFF and clips the maximum positive sample', () => {
    expect(pcm16ToMulaw(Buffer.from([0, 0]))[0]).toBe(0xff);
    expect(pcm16ToMulaw(Buffer.from([0xff, 0x7f]))[0]).toBe(0x80);
  });

  it('builds and parses WAV, tolerating a bogus data size', () => {
    const pcm = Buffer.from([1, 0, 2, 0, 3, 0]);
    const wav = buildWav(pcm);
    expect(parseWavPcm(wav)?.pcm.equals(pcm)).toBe(true);
    wav.writeUInt32LE(0xffffffff, 40);
    expect(parseWavPcm(wav)?.pcm.length).toBe(6);
    expect(parseWavPcm(Buffer.from('nope'))).toBeNull();
  });

  it('splits into 160 byte frames, padding the tail', () => {
    const frames = toFrames(Buffer.alloc(400, 1));
    expect(frames.map((f) => f.length)).toEqual([160, 160, 160]);
    expect(frames[2]![80]).toBe(0xff);
  });
});

describe('parseTwiml', () => {
  it('parses Connect/Stream', () => {
    expect(
      parseTwiml(
        '<?xml version="1.0"?><Response><Connect><Stream url="wss://x.example/connection?a=1&amp;b=2"/></Connect></Response>',
      ),
    ).toEqual({ type: 'stream', url: 'wss://x.example/connection?a=1&b=2' });
  });
  it('parses Hangup and Reject', () => {
    expect(parseTwiml('<Response><Hangup/></Response>')).toEqual({ type: 'hangup' });
    expect(parseTwiml('<Response><Reject/></Response>')).toEqual({ type: 'reject' });
  });
  it('reports unsupported verbs', () => {
    expect(parseTwiml('<Response><Say>hi</Say></Response>')).toEqual({ type: 'none', ignored: ['Say'] });
    expect(parseTwiml('<Response/>')).toEqual({ type: 'none', ignored: [] });
  });
  it('rejects missing or non-websocket urls', () => {
    expect(parseTwiml('<Response><Connect><Stream/></Connect></Response>').type).toBe('invalid');
    expect(parseTwiml('<Response><Connect><Stream url="http://x"/></Connect></Response>').type).toBe('invalid');
  });
});

// ---------------------------------------------------------------- session protocol

function fakeDevice() {
  const calls: string[] = [];
  let playEnd: (() => void) | null = null;
  const files = new Map<string, Buffer>();
  let active = true;
  const rec = buildWav(Buffer.alloc(1600)); // 100ms of silence per segment
  const device: BridgeAudioDevice = {
    upload: async (p, d) => void files.set(p, d),
    download: async () => rec,
    remove: async (p) => void files.delete(p),
    play: async (p) => void calls.push(`play:${files.get(p)?.length}`),
    stopPlay: async () => {
      calls.push('stopPlay');
      playEnd?.();
    },
    startRecord: async () => void calls.push('startRecord'),
    stopRecord: async () => void calls.push('stopRecord'),
    waitPlaybackEnd: () => {
      let resolve!: () => void;
      const promise = new Promise<void>((r) => (resolve = r));
      playEnd = resolve;
      setTimeout(resolve, 30); // playback "finishes" quickly
      return { promise, cancel: resolve };
    },
    isCallActive: async () => active,
  };
  return { device, calls, hangup: () => (active = false) };
}

async function startServer() {
  const received: any[] = [];
  let socket!: WebSocket;
  const wss = new WebSocketServer({ port: 0 });
  const connected = new Promise<void>((r) =>
    wss.on('connection', (ws) => {
      socket = ws;
      ws.on('message', (d) => received.push(JSON.parse(d.toString())));
      r();
    }),
  );
  await new Promise((r) => wss.once('listening', r));
  const port = (wss.address() as any).port as number;
  return { wss, received, port, connected, send: (o: object) => socket.send(JSON.stringify(o)), socket: () => socket };
}

const until = async (pred: () => boolean, ms = 3000) => {
  const end = Date.now() + ms;
  while (!pred()) {
    if (Date.now() > end) throw new Error('timeout');
    await new Promise((r) => setTimeout(r, 10));
  }
};

describe('MediaStreamSession', () => {
  it('sends connected/start, streams media upstream, plays downstream and echoes marks', async () => {
    const srv = await startServer();
    const { device, calls } = fakeDevice();
    const session = new MediaStreamSession({
      url: `ws://127.0.0.1:${srv.port}/connection`,
      callSid: 'CA' + 'a'.repeat(32),
      device,
      segmentMs: 50,
    });
    await session.connect();
    await srv.connected;
    session.run();

    await until(() => srv.received.some((m) => m.event === 'media'));
    expect(srv.received[0]).toEqual({ event: 'connected', protocol: 'Call', version: '1.0.0' });
    const start = srv.received[1];
    expect(start.event).toBe('start');
    expect(start.streamSid).toBe(session.streamSid);
    expect(start.start.callSid).toBe('CA' + 'a'.repeat(32));
    expect(start.start.mediaFormat).toEqual({ encoding: 'audio/x-mulaw', sampleRate: 8000, channels: 1 });
    const media = srv.received.filter((m) => m.event === 'media');
    expect(Buffer.from(media[0].media.payload, 'base64').length).toBe(160);
    const seqs = srv.received.slice(1).map((m) => Number(m.sequenceNumber));
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));

    srv.send({
      event: 'media',
      streamSid: session.streamSid,
      media: { payload: Buffer.alloc(800, 0x7f).toString('base64') },
    });
    srv.send({ event: 'mark', streamSid: session.streamSid, mark: { name: 'abc' } });
    await until(() => srv.received.some((m) => m.event === 'mark'));
    expect(srv.received.find((m) => m.event === 'mark').mark.name).toBe('abc');
    expect(calls.some((c) => c.startsWith('play:'))).toBe(true);

    await session.close('local');
    await until(() => srv.received.at(-1)?.event === 'stop');
    srv.wss.close();
  });

  it('clear stops playback and flushes pending marks', async () => {
    const srv = await startServer();
    const { device, calls } = fakeDevice();
    // make playback long so clear arrives mid-playback
    device.waitPlaybackEnd = () => {
      let resolve!: () => void;
      const promise = new Promise<void>((r) => (resolve = r));
      return { promise, cancel: resolve };
    };
    const session = new MediaStreamSession({
      url: `ws://127.0.0.1:${srv.port}`,
      callSid: 'CA' + 'b'.repeat(32),
      device,
      segmentMs: 20,
    });
    await session.connect();
    await srv.connected;
    session.run();
    srv.send({ event: 'media', media: { payload: Buffer.alloc(800).toString('base64') } });
    srv.send({ event: 'mark', mark: { name: 'm1' } });
    await until(() => calls.some((c) => c.startsWith('play:')));
    srv.send({ event: 'clear', streamSid: session.streamSid });
    await until(() => srv.received.some((m) => m.event === 'mark'));
    expect(calls).toContain('stopPlay');
    expect(srv.received.filter((m) => m.event === 'mark').map((m) => m.mark.name)).toEqual(['m1']);
    await session.close('local');
    srv.wss.close();
  });

  it('closes with reason app when the application closes the socket, and remote when the call ends', async () => {
    const a = await startServer();
    const dev1 = fakeDevice();
    const s1 = new MediaStreamSession({
      url: `ws://127.0.0.1:${a.port}`,
      callSid: 'CA1',
      device: dev1.device,
      segmentMs: 20,
    });
    const closed1 = new Promise<string>((r) => s1.once('closed', (reason) => r(reason)));
    await s1.connect();
    await a.connected;
    s1.run();
    a.socket().close();
    expect(await closed1).toBe('app');
    a.wss.close();

    const b = await startServer();
    const dev2 = fakeDevice();
    const s2 = new MediaStreamSession({
      url: `ws://127.0.0.1:${b.port}`,
      callSid: 'CA2',
      device: dev2.device,
      segmentMs: 20,
    });
    const closed2 = new Promise<string>((r) => s2.once('closed', (reason) => r(reason)));
    await s2.connect();
    await b.connected;
    s2.run();
    dev2.hangup();
    expect(await closed2).toBe('remote');
    await until(() => b.received.some((m) => m.event === 'stop'));
    b.wss.close();
  });

  it('rejects connect when the application is unreachable', async () => {
    const session = new MediaStreamSession({
      url: 'ws://127.0.0.1:1',
      callSid: 'CA3',
      device: fakeDevice().device,
      connectTimeoutMs: 1000,
    });
    await expect(session.connect()).rejects.toThrow(/Stream connection/);
  });
});
