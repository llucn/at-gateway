import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { CallManager, AtClient } from '@at-gateway/at-modem';
import { CallRecord } from '../../entities/call-record.entity';
import { ModemService } from '../modem/modem.service';
import { SettingsService } from '../settings/settings.service';
import { IncomingNotifier, newSid, NotifyError } from './incoming-notifier';
import { MediaStreamSession, type BridgeAudioDevice } from './media-stream-session';

/** Adapts CallManager + AtClient.files to what a MediaStreamSession needs. */
export function createAudioDevice(manager: CallManager, client: AtClient): BridgeAudioDevice {
  return {
    upload: (p, d) => client.files.upload(p, d),
    download: (p) => client.files.download(p),
    remove: (p) => client.files.delete(p),
    play: (p) => manager.playToRemote(p),
    stopPlay: () => manager.stopPlayback(),
    startRecord: (p) => manager.startRecording(p),
    stopRecord: () => manager.stopRecording(),
    waitPlaybackEnd: (ms) => manager.waitForPlaybackEnd(ms),
    isCallActive: async () => (await manager.getCallStatus()).some((c) => c.state === 'active'),
  };
}

@Injectable()
export class VoiceBridgeService {
  private readonly logger = new Logger(VoiceBridgeService.name);
  /** True from the first RING until the call is finished (RING/+CLIP repeat every few seconds). */
  private busy = false;

  constructor(
    @InjectRepository(CallRecord) private callRepo: Repository<CallRecord>,
    private modem: ModemService,
    private settings: SettingsService,
    private notifier: IncomingNotifier,
    private events: EventEmitter2,
  ) {}

  /** Claim the single call slot. Returns false when a call is already being handled. */
  tryAcquire(): boolean {
    if (this.busy) return false;
    this.busy = true;
    return true;
  }

  /** Whether incoming calls are handled by the application (a notification URL is configured). */
  async isEnabled(): Promise<boolean> {
    return (await this.notifier.getUrl()) !== null;
  }

  /**
   * Handle one incoming call end to end: notify the application, then answer + stream, hang up or reject
   * according to the TwiML it returns. `call` is the already-saved 'ringing' record.
   */
  async handleIncoming(call: CallRecord): Promise<void> {
    // The caller must have claimed the slot with tryAcquire().
    try {
      await this.process(call);
    } catch (e: any) {
      this.logger.error(`Incoming call handling failed: ${e.message}`);
      await this.fail(call, e.message);
    } finally {
      // The session (if any) keeps the call busy until it closes; see process().
      if (!this.sessionActive) this.busy = false;
    }
  }

  private sessionActive = false;

  private async process(call: CallRecord): Promise<void> {
    const url = await this.notifier.getUrl();
    const manager = this.modem.getCallManager();
    const client = this.modem.getClient();
    if (!url || !manager || !client) throw new Error('Voice bridge is not available');

    const callSid = newSid('CA');
    call.metadata = { ...(call.metadata ?? {}), callSid };
    await this.callRepo.save(call);

    let action;
    try {
      action = await this.notifier.notify(url, { callSid, from: call.phoneNumber, to: '' });
    } catch (e: any) {
      await this.hangup(manager);
      await this.fail(call, e instanceof NotifyError ? e.message : `Notification failed: ${e.message}`);
      return;
    }

    switch (action.type) {
      case 'reject':
      case 'none':
        if (action.type === 'none') this.logger.warn('TwiML has no executable verb; hanging up');
        await this.hangup(manager);
        await this.finish(call);
        return;
      case 'invalid':
        await this.hangup(manager);
        await this.fail(call, action.reason);
        return;
      case 'hangup':
        await this.answer(manager, call);
        await this.hangup(manager);
        await this.finish(call);
        return;
      case 'stream':
        break;
    }

    const session = new MediaStreamSession({
      url: action.url,
      callSid,
      device: createAudioDevice(manager, client),
      connectTimeoutMs: Number(await this.settings.get('voice.streamTimeoutMs')) || 10000,
      log: (m) => this.logger.debug(m),
    });
    try {
      await session.connect();
    } catch (e: any) {
      await this.hangup(manager);
      await session.close('error').catch(() => undefined);
      await this.fail(call, e.message);
      return;
    }

    try {
      await this.answer(manager, call);
    } catch (e: any) {
      await session.close('error').catch(() => undefined);
      await this.fail(call, e.message);
      return;
    }
    call.metadata = { ...(call.metadata ?? {}), callSid, streamSid: session.streamSid };
    await this.callRepo.save(call);
    this.events.emit('call.started', call);

    this.sessionActive = true;
    session.once('closed', (reason: string, error?: Error) => {
      void (async () => {
        this.logger.log(`Media stream closed (${reason})${error ? `: ${error.message}` : ''}`);
        await this.hangup(manager);
        if (reason === 'error' && error) await this.fail(call, error.message);
        else await this.finish(call);
        this.sessionActive = false;
        this.busy = false;
      })();
    });
    session.run();
  }

  private async answer(manager: CallManager, call: CallRecord): Promise<void> {
    await manager.answer();
    await manager.waitForAnswer(10000);
    call.status = 'active';
    call.answeredAt = new Date();
    await this.callRepo.save(call);
  }

  private async hangup(manager: CallManager): Promise<void> {
    await manager.hangup().catch((e) => this.logger.warn(`Hangup failed: ${e.message}`));
  }

  private async finish(call: CallRecord): Promise<void> {
    call.status = 'ended';
    call.endedAt = new Date();
    if (call.answeredAt) {
      call.duration = Math.floor((call.endedAt.getTime() - call.answeredAt.getTime()) / 1000);
    }
    await this.callRepo.save(call);
    this.events.emit('webhook.call.ended', call);
  }

  private async fail(call: CallRecord, reason: string): Promise<void> {
    call.status = 'failed';
    call.failureReason = reason;
    call.endedAt = new Date();
    await this.callRepo.save(call);
  }
}
