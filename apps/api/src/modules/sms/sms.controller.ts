import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SmsService } from './sms.service';

class SendSmsDto {
  phoneNumber!: string;
  content!: string;
}

@ApiTags('sms')
@Controller('sms')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SmsController {
  constructor(private smsService: SmsService) {}

  @Post()
  @ApiOperation({ summary: 'Send SMS' })
  async send(@Body() dto: SendSmsDto) {
    return this.smsService.sendSms(dto.phoneNumber, dto.content);
  }

  @Get()
  @ApiOperation({ summary: 'List SMS messages' })
  async findAll(@Query() query: any) {
    return this.smsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get SMS by ID' })
  async findOne(@Param('id') id: string) {
    return this.smsService.findOne(id);
  }
}
