// AT command client with queue and URC handling
import { EventEmitter } from 'node:events';
import { SerialTransport } from '../transport/serial-transport.js';

export interface AtClientOptions {
  transport: SerialTransport;
  commandTimeout?: number;
  debug?: boolean;
}

export interface AtCommand {
  command: string;
  timeout: number;
  expectPrompt?: boolean; // For commands like AT+CMGS that wait for '>'
  rawData?: string;       // If set, write rawData+Ctrl+Z instead of command string
  resolve: (response: AtResponse) => void;
  reject: (error: Error) => void;
}

export interface AtResponse {
  success: boolean;
  lines: string[];
  result: string; // 'OK', 'ERROR', '+CME ERROR: xxx', etc.
  raw: string;
}

export interface AtClientEvents {
  urc: (line: string) => void;
  error: (error: Error) => void;
  reconnecting: () => void;
  connected: () => void;
  disconnected: () => void;
}

export declare interface AtClient {
  on<K extends keyof AtClientEvents>(event: K, listener: AtClientEvents[K]): this;
  emit<K extends keyof AtClientEvents>(event: K, ...args: Parameters<AtClientEvents[K]>): boolean;
}

export class AtClient extends EventEmitter {
  private transport: SerialTransport;
  private commandQueue: AtCommand[] = [];
  private currentCommand: AtCommand | null = null;
  private responseBuffer: string[] = [];
  private commandTimeout: number;
  private timeoutHandle: NodeJS.Timeout | null = null;
  private debug: boolean;
  /** True when the next line is the PDU/text body of a +CMT: URC. */
  private pendingUrcBody = false;

  constructor(options: AtClientOptions) {
    super();
    this.transport = options.transport;
    this.commandTimeout = options.commandTimeout ?? 10000;
    this.debug = options.debug ?? false;

    this.transport.on('data', (line) => this.handleLine(line));
    this.transport.on('error', (err) => this.emit('error', err));
    this.transport.on('close', () => this.emit('disconnected'));
    this.transport.on('open', () => this.emit('connected'));
  }

  private log(...args: unknown[]): void {
    if (this.debug) {
      console.log('[AtClient]', ...args);
    }
  }

  /**
   * Returns true for lines that are always URCs regardless of whether a command
   * is active. These must never be absorbed into responseBuffer.
   */
  private isUnsolicitedLine(line: string): boolean {
    return (
      line.startsWith('+CMT:') ||
      line.startsWith('+CMTI:') ||
      line === '+SMS FULL' ||
      line.startsWith('+SMMEMFULL:') ||
      line.startsWith('+CRING:') ||
      line.startsWith('+CLIP:') ||
      line.startsWith('+CREG:') ||
      line.startsWith('+CGREG:') ||
      line.startsWith('+CEREG:') ||
      line.startsWith('+CUSD:') ||
      line.startsWith('+CSSI:') ||
      line.startsWith('+CSSU:')
    );
  }

  private handleLine(line: string): void {
    this.log('<<', line);

    // +CMT: is a two-line URC: the header line followed by a raw PDU/text body.
    // Both lines must reach URC listeners even when a command is active.
    if (this.pendingUrcBody) {
      this.pendingUrcBody = false;
      this.emit('urc', line);
      return;
    }

    // Any recognised unsolicited prefix always bypasses the command buffer.
    if (this.isUnsolicitedLine(line)) {
      if (line.startsWith('+CMT:')) {
        // Next line is the PDU/text body — flag it so it also bypasses the buffer.
        this.pendingUrcBody = true;
      }
      this.emit('urc', line);
      return;
    }

    // If no command is active, treat as URC (unsolicited result code)
    if (!this.currentCommand) {
      this.emit('urc', line);
      return;
    }

    // Handle prompt for data commands (e.g., SMS send)
    if (this.currentCommand.expectPrompt && line === '>') {
      // Treat '>' as a success response for prompt-expecting commands
      this.completeCommand('>');
      return;
    }

    // Collect response lines
    this.responseBuffer.push(line);

    // Check for final result codes
    if (this.isFinalResult(line)) {
      this.completeCommand(line);
    }
  }

  private isFinalResult(line: string): boolean {
    return (
      line === 'OK' ||
      line === '>' ||
      line === 'ERROR' ||
      line.startsWith('+CME ERROR:') ||
      line.startsWith('+CMS ERROR:') ||
      line === 'NO CARRIER' ||
      line === 'BUSY' ||
      line === 'NO ANSWER' ||
      line === 'NO DIALTONE' ||
      line.startsWith('+CMGS:')
    );
  }

  private completeCommand(result: string): void {
    if (!this.currentCommand) return;

    // +CMGS: <mr> is a success response for SMS submit
    // '>' is a success response for prompt-expecting commands (AT+CMGS=<len>)
    const success = result === 'OK' || result === '>' || result.startsWith('+CMGS:');
    const response: AtResponse = {
      success,
      lines: this.responseBuffer.slice(0, -1), // Exclude final result
      result,
      raw: this.responseBuffer.join('\n'),
    };

    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }

    this.currentCommand.resolve(response);
    this.currentCommand = null;
    this.responseBuffer = [];

    // Process next command
    this.processQueue();
  }

  private processQueue(): void {
    if (this.currentCommand || this.commandQueue.length === 0) {
      return;
    }

    const cmd = this.commandQueue.shift();
    if (!cmd) return;

    this.currentCommand = cmd;
    this.responseBuffer = [];

    // Raw-data entries (PDU submit): write the raw bytes + Ctrl+Z,
    // do NOT write the '<PDU>' label string to the serial port.
    const writePromise = cmd.rawData !== undefined
      ? this.transport.write(cmd.rawData + '\x1A')
      : (this.log('>>', cmd.command), this.transport.write(cmd.command));

    writePromise.catch((err) => {
      this.currentCommand?.reject(err);
      this.currentCommand = null;
      this.processQueue();
    });

    // Set timeout
    this.timeoutHandle = setTimeout(() => {
      if (this.currentCommand === cmd) {
        cmd.reject(new Error(`Command timeout: ${cmd.command}`));
        this.currentCommand = null;
        this.responseBuffer = [];
        this.processQueue();
      }
    }, cmd.timeout);
  }

  async sendCommand(command: string, timeout?: number, expectPrompt = false): Promise<AtResponse> {
    return new Promise((resolve, reject) => {
      this.commandQueue.push({
        command,
        timeout: timeout ?? this.commandTimeout,
        expectPrompt,
        resolve,
        reject,
      });

      // Kick off queue processing
      if (!this.currentCommand) {
        this.processQueue();
      }
    });
  }

  async sendData(data: string): Promise<void> {
    // Send raw data (for PDU, terminated with Ctrl+Z)
    await this.transport.write(data + '\x1A');
  }
  
  /**
   * Send raw data (PDU + Ctrl+Z) through the command queue and wait for the
   * modem's final response (+CMGS: <mr> or ERROR/+CMS ERROR:).
   * Must be called after AT+CMGS=<length> has returned the '>' prompt.
   */
  async sendDataAndWait(data: string, timeout = 30000): Promise<AtResponse> {
    return new Promise((resolve, reject) => {
      this.commandQueue.push({
        command: '<PDU>',  // label only, never written to serial
        rawData: data,     // actual bytes to write (Ctrl+Z appended by processQueue)
        timeout,
        expectPrompt: false,
        resolve,
        reject,
      });

      if (!this.currentCommand) {
        this.processQueue();
      }
    });
  }

  async open(): Promise<void> {
    await this.transport.open();
  }

  async close(): Promise<void> {
    await this.transport.close();
  }

  get isConnected(): boolean {
    return this.transport.isOpen;
  }
}
