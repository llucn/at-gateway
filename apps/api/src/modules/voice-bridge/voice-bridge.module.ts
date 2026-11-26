import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CallRecord } from '../../entities/call-record.entity';
import { ModemModule } from '../modem/modem.module';
import { SettingsModule } from '../settings/settings.module';
import { IncomingNotifier } from './incoming-notifier';
import { VoiceBridgeService } from './voice-bridge.service';

@Module({
  imports: [TypeOrmModule.forFeature([CallRecord]), ModemModule, SettingsModule],
  providers: [IncomingNotifier, VoiceBridgeService],
  exports: [VoiceBridgeService, IncomingNotifier],
})
export class VoiceBridgeModule {}
