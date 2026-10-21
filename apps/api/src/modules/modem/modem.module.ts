import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModemEvent } from '../../entities/modem-event.entity';
import { ModemService } from './modem.service';

@Module({
  imports: [TypeOrmModule.forFeature([ModemEvent])],
  providers: [ModemService],
  exports: [ModemService],
})
export class ModemModule {}
