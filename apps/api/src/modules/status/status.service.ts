import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ModemService } from '../modem/modem.service';

@Injectable()
export class StatusService {
  private cachedStatus: any = null;

  constructor(
    private modemService: ModemService,
    private eventEmitter: EventEmitter2,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async refreshStatus() {
    if (!this.modemService.isModemConnected()) {
      return;
    }

    const manager = this.modemService.getStatusManager();
    if (!manager) return;

    try {
      const status = await manager.getStatus();
      this.cachedStatus = {
        state: this.modemService.isModemConnected() ? 'connected' : 'disconnected',
        ...status,
        lastUpdated: new Date().toISOString(),
      };

      this.eventEmitter.emit('modem.status_update', this.cachedStatus);
    } catch (error) {
      console.error('Failed to refresh modem status:', error);
    }
  }

  async getStatus() {
    if (!this.cachedStatus) {
      await this.refreshStatus();
    }
    return this.cachedStatus || {
      state: 'disconnected',
      simStatus: 'UNKNOWN',
      networkStatus: 'UNKNOWN',
      signalQuality: { rssi: -113, ber: 99 },
    };
  }
}
