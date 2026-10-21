import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SmsMessage } from '../../entities/sms-message.entity';
import { ModemModule } from '../modem/modem.module';
import { SmsService } from './sms.service';
import { SmsController } from './sms.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SmsMessage]), ModemModule],
  providers: [SmsService],
  controllers: [SmsController],
  exports: [SmsService],
})
export class SmsModule {}
