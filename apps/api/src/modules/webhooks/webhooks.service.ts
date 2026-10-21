import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OnEvent } from '@nestjs/event-emitter';
import { WebhookDelivery } from '../../entities/webhook-delivery.entity';
import { SettingsService } from '../settings/settings.service';
import * as crypto from 'node:crypto';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectRepository(WebhookDelivery)
    private webhookRepo: Repository<WebhookDelivery>,
    private settingsService: SettingsService,
  ) {}

  @OnEvent('webhook.**')
  async handleWebhookEvent(payload: any, eventType?: string) {
    const event = eventType || 'unknown';
    
    let url: string | null = null;
    if (event.includes('sms')) {
      url = await this.settingsService.get('webhook.smsUrl');
    } else if (event.includes('call')) {
      url = await this.settingsService.get('webhook.callUrl');
    }

    if (!url) return;

    const delivery = this.webhookRepo.create({
      eventType: event,
      url,
      payload: JSON.stringify(payload),
      status: 'pending',
      nextRetryAt: new Date(),
    });

    await this.webhookRepo.save(delivery);
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  async processWebhooks() {
    const pending = await this.webhookRepo.find({
      where: {
        status: 'pending',
        nextRetryAt: LessThan(new Date()),
      },
      take: 10,
    });

    for (const delivery of pending) {
      await this.deliver(delivery);
    }
  }

  private async deliver(delivery: WebhookDelivery) {
    try {
      const secret = await this.settingsService.get('webhook.secret');
      const timestamp = Date.now().toString();
      const signature = this.generateSignature(delivery.payload, secret || '', timestamp);

      const response = await fetch(delivery.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gateway-Signature': signature,
          'X-Gateway-Timestamp': timestamp,
          'X-Gateway-Event': delivery.eventType,
        },
        body: delivery.payload,
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        delivery.status = 'delivered';
        delivery.deliveredAt = new Date();
        this.logger.log(`Webhook delivered: ${delivery.id}`);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error: any) {
      delivery.attempts++;
      delivery.lastAttemptAt = new Date();
      delivery.failureReason = error.message;

      if (delivery.attempts >= 5) {
        delivery.status = 'failed';
      } else {
        const backoff = Math.pow(2, delivery.attempts) * 60 * 1000;
        delivery.nextRetryAt = new Date(Date.now() + backoff);
      }

      this.logger.warn(`Webhook delivery failed: ${delivery.id}, attempt ${delivery.attempts}`);
    }

    await this.webhookRepo.save(delivery);
  }

  private generateSignature(payload: string, secret: string, timestamp: string): string {
    const data = `${timestamp}.${payload}`;
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }
}
