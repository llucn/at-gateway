import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RecordingsService } from './recordings.service';

@ApiTags('recordings')
@Controller('recordings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RecordingsController {
  constructor(private recordingsService: RecordingsService) {}

  @Get()
  @ApiOperation({ summary: 'List recordings' })
  async findAll(@Query() query: any) {
    return this.recordingsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get recording by ID' })
  async findOne(@Param('id') id: string) {
    return this.recordingsService.findOne(id);
  }
}
