import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CallRecord } from '../../entities/call-record.entity';
import { ModemModule } from '../modem/modem.module';
import { MediaModule } from '../media/media.module';
import { CallsService } from './calls.service';
import { CallsController } from './calls.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CallRecord]), ModemModule, MediaModule],
  providers: [CallsService],
  controllers: [CallsController],
  exports: [CallsService],
})
export class CallsModule {}
