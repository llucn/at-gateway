import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookDelivery } from '../../entities/webhook-delivery.entity';
import { SettingsModule } from '../settings/settings.module';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [TypeOrmModule.forFeature([WebhookDelivery]), SettingsModule],
  providers: [WebhooksService],
  exports: [WebhooksService],
})
export class WebhooksModule {}
