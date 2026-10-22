import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CredentialsService } from './credentials.service';

@Controller('credentials')
@UseGuards(JwtAuthGuard)
export class CredentialsController {
  constructor(private credentialsService: CredentialsService) {}

  @Post()
  async create(@Body() body: { expiryDays: number | null; name?: string }) {
    const { credential, apiSecret } = await this.credentialsService.create(body.expiryDays, body.name);

    return {
      id: credential.id,
      name: credential.name,
      apiKey: credential.apiKey,
      apiSecret, // Full secret - only shown once
      expiresAt: credential.expiresAt,
      isActive: credential.isActive,
      createdAt: credential.createdAt,
    };
  }

  @Get()
  async findAll() {
    const credentials = await this.credentialsService.findAll();

    return credentials.map((credential) => ({
      id: credential.id,
      name: credential.name,
      apiKey: credential.apiKey,
      apiSecret: '••••••••••••••••••••', // Fully masked
      expiresAt: credential.expiresAt,
      isActive: credential.isActive,
      lastUsedAt: credential.lastUsedAt,
      revokedAt: credential.revokedAt,
      createdAt: credential.createdAt,
    }));
  }

  @Delete(':id')
  async revoke(@Param('id') id: string) {
    await this.credentialsService.revoke(id);
    return { message: 'Credential revoked successfully' };
  }
}
