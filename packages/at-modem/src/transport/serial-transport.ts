// Serial port transport layer
import { SerialPort, ReadlineParser } from 'serialport';
import { EventEmitter } from 'node:events';

export interface SerialTransportOptions {
  path: string;
  baudRate: number;
  autoOpen?: boolean;
}

export interface SerialTransportEvents {
  data: (line: string) => void;
  error: (error: Error) => void;
  open: () => void;
  close: () => void;
}

export declare interface SerialTransport {
  on<K extends keyof SerialTransportEvents>(
    event: K,
    listener: SerialTransportEvents[K],
  ): this;
  emit<K extends keyof SerialTransportEvents>(
    event: K,
    ...args: Parameters<SerialTransportEvents[K]>
  ): boolean;
}

export class SerialTransport extends EventEmitter {
  private port: SerialPort | null = null;
  private parser: ReadlineParser | null = null;
  public isOpen = false;

  constructor(private options: SerialTransportOptions) {
    super();
  }

  async open(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.port = new SerialPort(
        {
          path: this.options.path,
          baudRate: this.options.baudRate,
          dataBits: 8,
          stopBits: 1,
          parity: 'none',
          autoOpen: false,
        },
        (err) => {
          if (err) reject(err);
        },
      );

      this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

      this.parser.on('data', (line: string) => {
        const trimmed = line.trim();
        if (trimmed) {
          this.emit('data', trimmed);
        }
      });

      this.port.on('error', (err) => this.emit('error', err));
      this.port.on('close', () => {
        this.isOpen = false;
        this.emit('close');
      });

      this.port.open((err) => {
        if (err) {
          reject(err);
        } else {
          this.isOpen = true;
          this.emit('open');
          resolve();
        }
      });
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.port || !this.isOpen) {
        resolve();
        return;
      }

      this.port.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async write(data: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.port || !this.isOpen) {
        reject(new Error('Port is not open'));
        return;
      }

      this.port.write(data + '\r', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async drain(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.port || !this.isOpen) {
        resolve();
        return;
      }

      this.port.drain((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}
