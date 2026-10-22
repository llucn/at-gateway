import { Controller, Post, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiKeyAuthGuard } from '../credentials/guards/api-key-auth.guard';
import { SmsService } from '../sms/sms.service';

@Controller('twilio')
export class TwilioController {
  constructor(private smsService: SmsService) {}

  @Post('Messages.json')
  @UseGuards(ApiKeyAuthGuard)
  async sendMessage(@Body() body: any) {
    const to = body.To;
    const from = body.From || '';
    const messageBody = body.Body;

    if (!to || !messageBody) {
      throw new BadRequestException('To and Body are required');
    }

    // Send via existing SmsService
    const message = await this.smsService.sendSms(to, messageBody);

    // Return Twilio-compatible response
    return {
      sid: message.id,
      date_created: message.createdAt.toISOString(),
      date_updated: message.createdAt.toISOString(),
      date_sent: message.deliveredAt?.toISOString() || null,
      to: message.phoneNumber,
      from: from,
      body: message.content,
      status: this.mapStatus(message.status),
      direction: 'outbound-api',
      api_version: '2010-04-01',
      uri: `/api/twilio/Messages/${message.id}.json`,
    };
  }

  private mapStatus(status: string): string {
    const map: Record<string, string> = {
      pending: 'queued',
      sent: 'sent',
      failed: 'failed',
      received: 'received',
    };
    return map[status] || 'queued';
  }
}
