import { Module } from '@nestjs/common';
import { TwilioController } from './twilio.controller';
import { SmsModule } from '../sms/sms.module';
import { CredentialsModule } from '../credentials/credentials.module';

@Module({
  imports: [SmsModule, CredentialsModule],
  controllers: [TwilioController],
})
export class TwilioModule {}
