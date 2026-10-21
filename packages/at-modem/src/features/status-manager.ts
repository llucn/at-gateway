// Status manager - polls modem status (signal, registration, SIM)
import { AtClient } from '../core/at-client.js';

export interface ModemStatus {
  manufacturer?: string;
  model?: string;
  revision?: string;
  imei?: string;
  imsi?: string;
  iccid?: string;
  simStatus: 'READY' | 'PIN_REQUIRED' | 'PUK_REQUIRED' | 'NOT_INSERTED' | 'ERROR' | 'UNKNOWN';
  networkStatus: 'NOT_REGISTERED' | 'REGISTERED_HOME' | 'SEARCHING' | 'DENIED' | 'REGISTERED_ROAMING' | 'UNKNOWN';
  operator?: string;
  operatorCode?: string;
  signalQuality: {
    rssi: number;
    ber: number;
    rsrp?: number;
    rsrq?: number;
    sinr?: number;
  };
}

export class StatusManager {
  private client: AtClient;
  private cachedStatus: Partial<ModemStatus> = {
    simStatus: 'UNKNOWN',
    networkStatus: 'UNKNOWN',
    signalQuality: { rssi: -113, ber: 99 },
  };

  constructor(client: AtClient) {
    this.client = client;
  }

  async initialize(): Promise<void> {
    // Disable echo
    await this.client.sendCommand('ATE0');

    // Enable verbose errors
    await this.client.sendCommand('AT+CMEE=2');

    // Get modem info
    await this.updateModemInfo();
  }

  private async updateModemInfo(): Promise<void> {
    try {
      // Manufacturer
      const mfr = await this.client.sendCommand('AT+CGMI');
      if (mfr.success && mfr.lines.length > 0) {
        this.cachedStatus.manufacturer = mfr.lines[0];
      }

      // Model
      const model = await this.client.sendCommand('AT+CGMM');
      if (model.success && model.lines.length > 0) {
        this.cachedStatus.model = model.lines[0];
      }

      // Revision
      const rev = await this.client.sendCommand('AT+CGMR');
      if (rev.success && rev.lines.length > 0) {
        this.cachedStatus.revision = rev.lines[0];
      }

      // IMEI
      const imei = await this.client.sendCommand('AT+CGSN');
      if (imei.success && imei.lines.length > 0) {
        this.cachedStatus.imei = imei.lines[0];
      }

      // ICCID
      const iccid = await this.client.sendCommand('AT+CCID');
      if (iccid.success && iccid.lines.length > 0) {
        const match = iccid.lines[0]?.match(/\+CCID:\s*(\S+)/);
        if (match) {
          this.cachedStatus.iccid = match[1];
        }
      }

      // IMSI
      const imsi = await this.client.sendCommand('AT+CIMI');
      if (imsi.success && imsi.lines.length > 0) {
        this.cachedStatus.imsi = imsi.lines[0];
      }
    } catch (err) {
      console.error('Error updating modem info:', err);
    }
  }

  async getStatus(): Promise<ModemStatus> {
    await this.updateStatus();
    return this.cachedStatus as ModemStatus;
  }

  private async updateStatus(): Promise<void> {
    // Check SIM status
    try {
      const cpin = await this.client.sendCommand('AT+CPIN?');
      if (cpin.success && cpin.lines.length > 0) {
        const match = cpin.lines[0]?.match(/\+CPIN:\s*(\S+)/);
        if (match) {
          const status = match[1];
          if (status === 'READY') this.cachedStatus.simStatus = 'READY';
          else if (status === 'SIM PIN') this.cachedStatus.simStatus = 'PIN_REQUIRED';
          else if (status === 'SIM PUK') this.cachedStatus.simStatus = 'PUK_REQUIRED';
          else this.cachedStatus.simStatus = 'ERROR';
        }
      } else {
        this.cachedStatus.simStatus = 'NOT_INSERTED';
      }
    } catch {
      this.cachedStatus.simStatus = 'NOT_INSERTED';
    }

    // Check network registration
    try {
      const creg = await this.client.sendCommand('AT+CREG?');
      if (creg.success && creg.lines.length > 0) {
        const match = creg.lines[0]?.match(/\+CREG:\s*\d+,(\d+)/);
        if (match) {
          const stat = parseInt(match[1]!, 10);
          if (stat === 1) this.cachedStatus.networkStatus = 'REGISTERED_HOME';
          else if (stat === 5) this.cachedStatus.networkStatus = 'REGISTERED_ROAMING';
          else if (stat === 2) this.cachedStatus.networkStatus = 'SEARCHING';
          else if (stat === 3) this.cachedStatus.networkStatus = 'DENIED';
          else this.cachedStatus.networkStatus = 'NOT_REGISTERED';
        }
      }
    } catch {
      this.cachedStatus.networkStatus = 'UNKNOWN';
    }

    // Get operator
    try {
      const cops = await this.client.sendCommand('AT+COPS?');
      if (cops.success && cops.lines.length > 0) {
        const match = cops.lines[0]?.match(/\+COPS:\s*\d+,\d+,"([^"]+)",(\d+)/);
        if (match) {
          this.cachedStatus.operator = match[1];
          // Operator code (not always returned)
        }
      }
    } catch {
      // Ignore
    }

    // Get signal quality
    try {
      const csq = await this.client.sendCommand('AT+CSQ');
      if (csq.success && csq.lines.length > 0) {
        const match = csq.lines[0]?.match(/\+CSQ:\s*(\d+),(\d+)/);
        if (match) {
          const rssi = parseInt(match[1]!, 10);
          const ber = parseInt(match[2]!, 10);
          this.cachedStatus.signalQuality = {
            rssi: rssi === 99 ? -113 : -113 + rssi * 2,
            ber,
          };
        }
      }

      // Try extended signal quality (LTE)
      const cesq = await this.client.sendCommand('AT+CESQ');
      if (cesq.success && cesq.lines.length > 0) {
        const match = cesq.lines[0]?.match(/\+CESQ:\s*\d+,\d+,\d+,\d+,(\d+),(\d+)/);
        if (match && match[1] && match[2]) {
          const rsrq = parseInt(match[1], 10);
          const rsrp = parseInt(match[2], 10);
          if (rsrp !== 255 && this.cachedStatus.signalQuality) {
            this.cachedStatus.signalQuality.rsrp = -140 + rsrp;
          }
          if (rsrq !== 255 && this.cachedStatus.signalQuality) {
            this.cachedStatus.signalQuality.rsrq = -19.5 + rsrq * 0.5;
          }
        }
      }
    } catch {
      // Ignore
    }
  }

  async unlockSim(pin: string): Promise<void> {
    await this.client.sendCommand(`AT+CPIN=${pin}`);
  }

  async setOperatorAuto(): Promise<void> {
    await this.client.sendCommand('AT+COPS=0');
  }
}
