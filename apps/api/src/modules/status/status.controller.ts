import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StatusService } from './status.service';

@ApiTags('status')
@Controller('status')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StatusController {
  constructor(private statusService: StatusService) {}

  @Get()
  @ApiOperation({ summary: 'Get modem status' })
  async getStatus() {
    return this.statusService.getStatus();
  }
}
