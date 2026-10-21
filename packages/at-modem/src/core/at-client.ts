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

  private handleLine(line: string): void {
    this.log('<<', line);

    // If no command is active, treat as URC (unsolicited result code)
    if (!this.currentCommand) {
      this.emit('urc', line);
      return;
    }

    // Handle prompt for data commands (e.g., SMS send)
    if (this.currentCommand.expectPrompt && line === '>') {
      // Signal prompt received; caller should send data
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
      line === 'ERROR' ||
      line.startsWith('+CME ERROR:') ||
      line.startsWith('+CMS ERROR:') ||
      line === 'NO CARRIER' ||
      line === 'BUSY' ||
      line === 'NO ANSWER' ||
      line === 'NO DIALTONE'
    );
  }

  private completeCommand(result: string): void {
    if (!this.currentCommand) return;

    const success = result === 'OK';
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

    this.log('>>', cmd.command);

    this.transport.write(cmd.command).catch((err) => {
      this.currentCommand?.reject(err);
      this.currentCommand = null;
      this.processQueue();
    });

    // Set timeout
    this.timeoutHandle = setTimeout(() => {
      if (this.currentCommand) {
        this.currentCommand.reject(new Error(`Command timeout: ${cmd.command}`));
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
