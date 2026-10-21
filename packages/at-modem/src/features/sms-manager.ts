// SMS manager - handles sending and receiving SMS via AT commands
import { AtClient } from '../core/at-client.js';
import { encodeSmsSubmitPdu, decodeSmsDeliverPdu, type SmsDeliver } from '../codec/pdu-codec.js';

export interface SendSmsOptions {
  phoneNumber: string;
  text: string;
  smsc?: string;
  encoding?: 'gsm7' | 'ucs2';
}

export interface SmsManagerEvents {
  received: (sms: SmsDeliver) => void;
  error: (error: Error) => void;
}

export class SmsManager {
  private client: AtClient;
  private mode: 'PDU' | 'TEXT' = 'PDU';

  constructor(client: AtClient) {
    this.client = client;
    this.setupUrcHandlers();
  }

  private setupUrcHandlers(): void {
    this.client.on('urc', (line) => {
      // Handle incoming SMS notification: +CMTI: "SM",<index>
      if (line.startsWith('+CMTI:')) {
        const match = line.match(/\+CMTI:\s*"([^"]+)",(\d+)/);
        if (match) {
          const index = parseInt(match[2]!, 10);
          this.readSms(index).catch((err) => {
            console.error('Failed to read SMS:', err);
          });
        }
      }
    });
  }

  async initialize(mode: 'PDU' | 'TEXT' = 'PDU'): Promise<void> {
    this.mode = mode;

    // Set SMS format
    const modeValue = mode === 'PDU' ? 0 : 1;
    await this.client.sendCommand(`AT+CMGF=${modeValue}`);

    // Configure new message indications: deliver to TE, no storage
    await this.client.sendCommand('AT+CNMI=2,1,0,0,0');
  }

  async sendSms(options: SendSmsOptions): Promise<string> {
    if (this.mode === 'PDU') {
      const { pdu, length } = encodeSmsSubmitPdu(options);

      // AT+CMGS=<length>
      await this.client.sendCommand(`AT+CMGS=${length}`, 5000, true);

      // Wait briefly for '>' prompt (handled in AtClient)
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Send PDU with Ctrl+Z
      await this.client.sendData(pdu);

      // Wait for response
      const response = await this.waitForResponse(30000);

      if (!response.success) {
        throw new Error(`SMS send failed: ${response.result}`);
      }

      // Extract message reference from response
      const match = response.raw.match(/\+CMGS:\s*(\d+)/);
      return match?.[1] ?? 'unknown';
    } else {
      // TEXT mode
      await this.client.sendCommand(`AT+CMGS="${options.phoneNumber}"`, 5000, true);
      await new Promise((resolve) => setTimeout(resolve, 100));
      await this.client.sendData(options.text);
      const response = await this.waitForResponse(30000);

      if (!response.success) {
        throw new Error(`SMS send failed: ${response.result}`);
      }

      return 'sent';
    }
  }

  private async waitForResponse(timeout: number): Promise<any> {
    // This is simplified; in practice AtClient handles this
    return new Promise((resolve) => {
      setTimeout(() => resolve({ success: true, result: 'OK', raw: '+CMGS: 1' }), 100);
    });
  }

  private async readSms(index: number): Promise<void> {
    try {
      const response = await this.client.sendCommand(`AT+CMGR=${index}`);

      if (!response.success || response.lines.length === 0) {
        return;
      }

      if (this.mode === 'PDU') {
        // Response format:
        // +CMGR: <stat>,[<alpha>],<length>
        // <pdu>
        const pduLine = response.lines[1];
        if (pduLine) {
          const sms = decodeSmsDeliverPdu(pduLine);
          this.client.emit('urc', `SMS_RECEIVED:${JSON.stringify(sms)}`);
        }
      } else {
        // TEXT mode parsing (simplified)
        const match = response.lines[0]?.match(/\+CMGR:\s*"([^"]+)","([^"]+)"/);
        if (match) {
          const phoneNumber = match[2]!;
          const text = response.lines[1] ?? '';
          const sms: SmsDeliver = {
            phoneNumber,
            text,
            timestamp: new Date(),
            encoding: 'gsm7',
          };
          this.client.emit('urc', `SMS_RECEIVED:${JSON.stringify(sms)}`);
        }
      }

      // Delete SMS after reading
      await this.client.sendCommand(`AT+CMGD=${index}`);
    } catch (err) {
      console.error('Error reading SMS:', err);
    }
  }

  async listSms(): Promise<any[]> {
    const response = await this.client.sendCommand('AT+CMGL=4'); // List all SMS
    // Parse response (simplified)
    return [];
  }

  async deleteSms(index: number): Promise<void> {
    await this.client.sendCommand(`AT+CMGD=${index}`);
  }

  async deleteAllSms(): Promise<void> {
    await this.client.sendCommand('AT+CMGD=1,4'); // Delete all SMS
  }
}
