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

  // Buffer for the +CMT: header line (PDU mode direct delivery)
  private cmtHeader: string | null = null;

  private setupUrcHandlers(): void {
    this.client.on('urc', (line) => {
      // ── Direct delivery (mt=2): +CMT: [<alpha>],<length> followed by PDU/text ──
      if (line.startsWith('+CMT:')) {
        this.cmtHeader = line;
        return;
      }

      // Second line after a +CMT: header — this is the actual PDU or text body
      if (this.cmtHeader !== null) {
        const header = this.cmtHeader;
        this.cmtHeader = null;
        this.handleCmt(header, line).catch((err) => {
          console.error('Failed to handle +CMT delivery:', err);
        });
        return;
      }

      // ── Stored delivery (mt=1): +CMTI: "SM",<index> ──
      if (line.startsWith('+CMTI:')) {
        const match = line.match(/\+CMTI:\s*"([^"]+)",(\d+)/);
        if (match) {
          const index = parseInt(match[2]!, 10);
          this.readSms(index).catch((err) => {
            console.error('Failed to read SMS:', err);
          });
        }
        return;
      }

      // ── SIM storage full: clear all stored SMS so new ones can arrive ──
      if (line === '+SMS FULL' || line.startsWith('+SMMEMFULL:')) {
        console.warn('[SmsManager] SIM SMS storage full — deleting all stored messages');
        this.deleteAllSms().catch((err) => {
          console.error('Failed to clear SMS storage:', err);
        });
      }
    });
  }

  private async handleCmt(header: string, body: string): Promise<void> {
    if (this.mode === 'PDU') {
      // PDU body line
      const sms = decodeSmsDeliverPdu(body);
      this.client.emit('urc', `SMS_RECEIVED:${JSON.stringify(sms)}`);
    } else {
      // TEXT mode: +CMT: "<number>",,"<timestamp>"
      const match = header.match(/\+CMT:\s*"([^"]*)"[^,]*,(?:[^,]*),/);
      const phoneNumber = match?.[1] ?? 'unknown';
      const sms: SmsDeliver = {
        phoneNumber,
        text: body,
        timestamp: new Date(),
        encoding: 'gsm7',
      };
      this.client.emit('urc', `SMS_RECEIVED:${JSON.stringify(sms)}`);
    }
  }

  async initialize(mode: 'PDU' | 'TEXT' = 'PDU'): Promise<void> {
    this.mode = mode;

    // Set SMS format
    const modeValue = mode === 'PDU' ? 0 : 1;
    await this.client.sendCommand(`AT+CMGF=${modeValue}`);

    // mt=2: deliver new SMS directly to TE via +CMT: URC (bypasses SIM storage,
    // avoids +SMS FULL issues). Falls back to +CMTI: index notification if the
    // modem doesn't support direct delivery (handled by setupUrcHandlers).
    await this.client.sendCommand('AT+CNMI=2,2,0,0,0');
  }

  async sendSms(options: SendSmsOptions): Promise<string> {
    if (this.mode === 'PDU') {
      const { pdu, length } = encodeSmsSubmitPdu(options);

      // Send AT+CMGS=<length> and wait for '>' prompt
      await this.client.sendCommand(`AT+CMGS=${length}`, 5000, true);

      // Wait briefly for '>' prompt (handled in AtClient)
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Send PDU + Ctrl+Z through the queue and wait for +CMGS: <mr> or error
      const response = await this.client.sendDataAndWait(pdu, 30000);

      if (!response.success) {
        throw new Error(`SMS send failed: ${response.result}`);
      }

      // Extract message reference number from +CMGS: <mr>
      const match = response.result.match(/\+CMGS:\s*(\d+)/);
      return match?.[1] ?? 'unknown';
    } else {
      // TEXT mode
      await this.client.sendCommand(`AT+CMGS="${options.phoneNumber}"`, 5000, true);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const response = await this.client.sendDataAndWait(options.text, 30000);

      if (!response.success) {
        throw new Error(`SMS send failed: ${response.result}`);
      }

      return 'sent';
    }
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
