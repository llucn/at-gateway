// Call manager - handles voice calls via AT commands
import { AtClient } from '../core/at-client.js';

export enum CallState {
  IDLE = 'idle',
  DIALING = 'dialing',
  RINGING = 'ringing',
  ACTIVE = 'active',
}

export interface CallInfo {
  id: string;
  phoneNumber: string;
  state: CallState;
  direction: 'inbound' | 'outbound';
  startTime?: Date;
  answerTime?: Date;
}

export interface CallManagerEvents {
  incoming: (phoneNumber: string) => void;
  answered: () => void;
  ended: () => void;
  error: (error: Error) => void;
}

export class CallManager {
  private client: AtClient;
  private currentCall: CallInfo | null = null;

  constructor(client: AtClient) {
    this.client = client;
    this.setupUrcHandlers();
  }

  private setupUrcHandlers(): void {
    this.client.on('urc', (line) => {
      // Incoming call: RING or +CLIP: "<number>",<type>
      if (line === 'RING') {
        if (!this.currentCall) {
          this.currentCall = {
            id: Date.now().toString(),
            phoneNumber: 'unknown',
            state: CallState.RINGING,
            direction: 'inbound',
            startTime: new Date(),
          };
        }
        this.client.emit('urc', 'CALL_INCOMING');
      } else if (line.startsWith('+CLIP:')) {
        const match = line.match(/\+CLIP:\s*"([^"]+)"/);
        if (match && this.currentCall) {
          this.currentCall.phoneNumber = match[1]!;
          this.client.emit('urc', `CALL_INCOMING:${match[1]}`);
        }
      } else if (line === 'NO CARRIER' || line === 'BUSY' || line === 'NO ANSWER') {
        // Call ended
        this.currentCall = null;
        this.client.emit('urc', 'CALL_ENDED');
      }
    });
  }

  async initialize(): Promise<void> {
    // Enable caller ID
    await this.client.sendCommand('AT+CLIP=1');

    // Set voice call mode (if needed for A7670C)
    // await this.client.sendCommand('AT+CPCMREG=1'); // Enable PCM over USB
  }

  async dial(phoneNumber: string): Promise<void> {
    if (this.currentCall) {
      throw new Error('Call already in progress');
    }

    this.currentCall = {
      id: Date.now().toString(),
      phoneNumber,
      state: CallState.DIALING,
      direction: 'outbound',
      startTime: new Date(),
    };

    // Dial voice call
    const response = await this.client.sendCommand(`ATD${phoneNumber};`, 60000);

    if (!response.success) {
      this.currentCall = null;
      throw new Error(`Dial failed: ${response.result}`);
    }

    // ATD returns OK as soon as the call is placed, long before the callee picks up:
    // the call stays DIALING until waitForAnswer() sees it ACTIVE in AT+CLCC.
  }

  /** Poll AT+CLCC until the call is active. Rejects on timeout or when the call disappears. */
  async waitForAnswer(timeoutMs = 60000, pollMs = 500): Promise<void> {
    const end = Date.now() + timeoutMs;
    let seen = false;
    while (Date.now() < end) {
      const calls = await this.getCallStatus();
      if (calls.some((c) => c.state === CallState.ACTIVE)) {
        if (this.currentCall) {
          this.currentCall.state = CallState.ACTIVE;
          this.currentCall.answerTime = new Date();
        }
        return;
      }
      if (calls.length > 0) seen = true;
      else if (seen || Date.now() - (this.currentCall?.startTime?.getTime() ?? 0) > 5000) {
        this.currentCall = null;
        throw new Error('Call ended before it was answered');
      }
      await new Promise((r) => setTimeout(r, pollMs));
    }
    throw new Error('Timeout waiting for the call to be answered');
  }

  async answer(): Promise<void> {
    if (!this.currentCall || this.currentCall.state !== CallState.RINGING) {
      throw new Error('No incoming call to answer');
    }

    const response = await this.client.sendCommand('ATA');
    if (!response.success) {
      throw new Error(`Answer failed: ${response.result}`);
    }
    this.currentCall.state = CallState.ACTIVE;
    this.currentCall.answerTime = new Date();
  }

  async hangup(): Promise<void> {
    if (!this.currentCall) {
      return;
    }

    await this.client.sendCommand('ATH');
    // ATH is ignored when AT+CVHU=1 (the default here); AT+CHUP always hangs up.
    if ((await this.getCallStatus()).length > 0) {
      await this.client.sendCommand('AT+CHUP', 5000);
    }
    this.currentCall = null;
  }

  async rejectCall(): Promise<void> {
    await this.hangup();
  }

  getCurrentCall(): CallInfo | null {
    return this.currentCall;
  }

  async getCallStatus(): Promise<CallInfo[]> {
    // AT+CLCC - List current calls
    const response = await this.client.sendCommand('AT+CLCC');

    if (!response.success) {
      return [];
    }

    // Parse +CLCC responses (simplified)
    // Format: +CLCC: <id>,<dir>,<stat>,<mode>,<mpty>[,<number>,<type>]
    const calls: CallInfo[] = [];

    for (const line of response.lines) {
      if (line.startsWith('+CLCC:')) {
        const match = line.match(/\+CLCC:\s*(\d+),(\d+),(\d+),(\d+),(\d+)(?:,"([^"]+)",(\d+))?/);
        if (match) {
          const dir = match[2] === '0' ? 'outbound' : 'inbound';
          const stat = parseInt(match[3]!, 10);
          const number = match[6] ?? 'unknown';

          let state = CallState.IDLE;
          if (stat === 0 || stat === 1) state = CallState.ACTIVE;
          else if (stat === 2 || stat === 3) state = CallState.DIALING;
          else if (stat === 4) state = CallState.RINGING;

          calls.push({
            id: match[1]!,
            phoneNumber: number,
            state,
            direction: dir,
          });
        }
      }
    }

    return calls;
  }

  // Voice audio via the module file system (A7670G has no USB audio / AT+CPCMREG).
  // Play and record cannot run at the same time on this firmware.

  /** Play a WAV file stored on the module to the remote party. Resolves when playback has started. */
  async playToRemote(modulePath: string): Promise<void> {
    const r = await this.client.sendCommand(`AT+CCMXPLAY="${modulePath}",1,0`, 15000);
    if (!r.success) throw new Error(`AT+CCMXPLAY failed: ${r.result}`);
  }

  async stopPlayback(): Promise<void> {
    await this.client.sendCommand('AT+CCMXSTOP', 5000).catch(() => undefined);
  }

  /** Record the remote party's voice (8kHz 16-bit mono WAV) into a file on the module. */
  async startRecording(modulePath: string): Promise<void> {
    const r = await this.client.sendCommand(`AT+CREC=2,"${modulePath}"`);
    if (!r.success) throw new Error(`AT+CREC failed: ${r.result}`);
  }

  async stopRecording(): Promise<void> {
    await this.client.sendCommand('AT+CREC=0', 5000).catch(() => undefined);
  }

  /** Resolve when a playback-finished URC arrives (`+AUDIOSTATE: audio play stop`). */
  waitForPlaybackEnd(timeoutMs: number): { promise: Promise<void>; cancel: () => void } {
    let cancel = () => {};
    const promise = new Promise<void>((resolve, reject) => {
      const onUrc = (line: string) => {
        if (line.includes('audio play stop')) {
          cleanup();
          resolve();
        }
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('Timeout waiting for the end of playback'));
      }, timeoutMs);
      const cleanup = () => {
        clearTimeout(timer);
        this.client.off('urc', onUrc);
      };
      cancel = () => {
        cleanup();
        resolve();
      };
      this.client.on('urc', onUrc);
    });
    return { promise, cancel };
  }

  // Audio control methods for A7670C

  async enableAudio(): Promise<void> {
    // Enable PCM audio interface
    await this.client.sendCommand('AT+CPCMREG=1');
  }

  async disableAudio(): Promise<void> {
    await this.client.sendCommand('AT+CPCMREG=0');
  }

  async setVolume(level: number): Promise<void> {
    // level: 0-100
    const atLevel = Math.floor((level / 100) * 15); // Map to 0-15
    await this.client.sendCommand(`AT+CLVL=${atLevel}`);
  }
}
