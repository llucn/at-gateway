import { Module } from '@nestjs/common';
import { ModemModule } from '../modem/modem.module';
import { StatusService } from './status.service';
import { StatusController } from './status.controller';

@Module({
  imports: [ModemModule],
  providers: [StatusService],
  controllers: [StatusController],
})
export class StatusModule {}
