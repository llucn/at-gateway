import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CallsService } from './calls.service';

class MakeCallDto {
  phoneNumber!: string;
  ttsMessage?: string;
}

@ApiTags('calls')
@Controller('calls')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CallsController {
  constructor(private callsService: CallsService) {}

  @Post()
  @ApiOperation({ summary: 'Make outbound call' })
  async makeCall(@Body() dto: MakeCallDto) {
    return this.callsService.makeCall(dto.phoneNumber, dto.ttsMessage);
  }

  @Post(':id/hangup')
  @ApiOperation({ summary: 'Hang up call' })
  async hangup(@Param('id') id: string) {
    return this.callsService.hangup(id);
  }

  @Get()
  @ApiOperation({ summary: 'List call records' })
  async findAll(@Query() query: any) {
    return this.callsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get call by ID' })
  async findOne(@Param('id') id: string) {
    return this.callsService.findOne(id);
  }
}
