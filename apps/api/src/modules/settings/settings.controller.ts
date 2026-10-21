import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@Controller('settings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all settings' })
  async getAll() {
    return this.settingsService.getAll();
  }

  @Put()
  @ApiOperation({ summary: 'Update settings' })
  async update(@Body() updates: Record<string, string>) {
    await this.settingsService.updateBulk(updates);
    return { success: true };
  }
}
