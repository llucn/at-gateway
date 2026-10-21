import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SerialTransport,
  AtClient,
  SmsManager,
  CallManager,
  StatusManager,
  autoDetectModem,
} from '@at-gateway/at-modem';
import { ModemEvent } from '../../entities/modem-event.entity';

@Injectable()
export class ModemService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ModemService.name);
  private client: AtClient | null = null;
  private smsManager: SmsManager | null = null;
  private callManager: CallManager | null = null;
  private statusManager: StatusManager | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnected = false;

  constructor(
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
    @InjectRepository(ModemEvent)
    private modemEventRepo: Repository<ModemEvent>,
  ) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect() {
    try {
      let port = this.configService.get<string>('MODEM_PORT');

      // Auto-detect if not specified
      if (!port && this.configService.get('MODEM_AUTO_DETECT')) {
        this.logger.log('Auto-detecting modem port...');
        const detectedPort = await autoDetectModem(this.configService.get('MODEM_BAUD_RATE')!);
        if (detectedPort) {
          port = detectedPort;
          this.logger.log(`Detected modem on port: ${port}`);
        } else {
          throw new Error('No modem detected');
        }
      }

      if (!port) {
        throw new Error('No modem port specified and auto-detect is disabled');
      }

      const transport = new SerialTransport({
        path: port,
        baudRate: this.configService.get('MODEM_BAUD_RATE')!,
      });

      this.client = new AtClient({
        transport,
        commandTimeout: this.configService.get('MODEM_COMMAND_TIMEOUT_MS'),
        debug: this.configService.get('NODE_ENV') === 'development',
      });

      // Setup managers
      this.smsManager = new SmsManager(this.client);
      this.callManager = new CallManager(this.client);
      this.statusManager = new StatusManager(this.client);

      // Setup URC handlers
      this.setupUrcHandlers();

      // Connect
      await this.client.open();
      this.isConnected = true;

      // Initialize managers
      await this.statusManager.initialize();
      await this.smsManager.initialize(this.configService.get('MODEM_SMS_MODE')!);
      await this.callManager.initialize();

      // Unlock SIM if PIN provided
      const pin = this.configService.get<string>('MODEM_SIM_PIN');
      if (pin) {
        await this.statusManager.unlockSim(pin);
      }

      this.logger.log('Modem connected successfully');
      this.eventEmitter.emit('modem.connected', { port });
      this.logEvent('modem.connected', { port });
    } catch (error) {
      this.logger.error('Failed to connect to modem:', error);
      this.scheduleReconnect();
    }
  }

  private setupUrcHandlers() {
    if (!this.client) return;

    this.client.on('urc', (line) => {
      this.logger.debug(`URC: ${line}`);

      // Handle SMS received
      if (line.startsWith('SMS_RECEIVED:')) {
        const sms = JSON.parse(line.replace('SMS_RECEIVED:', ''));
        this.eventEmitter.emit('sms.received', sms);
      }

      // Handle call events
      if (line.startsWith('CALL_INCOMING')) {
        const phoneNumber = line.includes(':') ? line.split(':')[1] : 'unknown';
        this.eventEmitter.emit('call.incoming', { phoneNumber });
      }

      if (line === 'CALL_ENDED') {
        this.eventEmitter.emit('call.ended');
      }
    });

    this.client.on('disconnected', () => {
      this.isConnected = false;
      this.logger.warn('Modem disconnected');
      this.eventEmitter.emit('modem.disconnected');
      this.scheduleReconnect();
    });

    this.client.on('error', (error) => {
      this.logger.error('Modem error:', error);
      this.eventEmitter.emit('modem.error', { error: error.message });
    });
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;

    const delay = this.configService.get('MODEM_RECONNECT_DELAY_MS')!;
    this.logger.log(`Reconnecting in ${delay}ms...`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private async disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.client) {
      await this.client.close();
      this.client = null;
    }

    this.isConnected = false;
  }

  private async logEvent(eventType: string, data?: any) {
    try {
      await this.modemEventRepo.save({
        eventType,
        data: data ? JSON.stringify(data) : undefined,
      });
    } catch (error) {
      this.logger.error('Failed to log modem event:', error);
    }
  }

  // Public API
  getClient(): AtClient | null {
    return this.client;
  }

  getSmsManager(): SmsManager | null {
    return this.smsManager;
  }

  getCallManager(): CallManager | null {
    return this.callManager;
  }

  getStatusManager(): StatusManager | null {
    return this.statusManager;
  }

  isModemConnected(): boolean {
    return this.isConnected && this.client !== null;
  }
}
