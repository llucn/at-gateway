import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiCredential } from '../../entities/api-credential.entity';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class CredentialsService {
  constructor(
    @InjectRepository(ApiCredential)
    private credentialRepo: Repository<ApiCredential>,
  ) {}

  private generateApiKey(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = '';
    for (let i = 0; i < 20; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
  }

  private generateApiSecret(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let secret = '';
    for (let i = 0; i < 40; i++) {
      secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return secret;
  }

  async create(expiryDays: number | null, name?: string): Promise<{ credential: ApiCredential; apiSecret: string }> {
    const apiKey = this.generateApiKey();
    const apiSecret = this.generateApiSecret();
    const apiSecretHash = await bcrypt.hash(apiSecret, 10);

    let expiresAt: Date | undefined;
    if (expiryDays !== null) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiryDays);
    }

    const credential = this.credentialRepo.create({
      name,
      apiKey,
      apiSecretHash,
      expiresAt,
      isActive: true,
    });

    await this.credentialRepo.save(credential);

    return { credential, apiSecret };
  }

  async findAll(): Promise<ApiCredential[]> {
    return this.credentialRepo.find({
      order: { createdAt: 'DESC' },
    });
  }

  async revoke(id: string): Promise<void> {
    await this.credentialRepo.update(id, {
      isActive: false,
      revokedAt: new Date(),
    });
  }

  async validateCredential(apiKey: string, apiSecret: string): Promise<ApiCredential | null> {
    const credential = await this.credentialRepo.findOne({
      where: { apiKey, isActive: true },
    });

    if (!credential) {
      return null;
    }

    // Check expiry
    if (credential.expiresAt && credential.expiresAt < new Date()) {
      return null;
    }

    // Verify secret
    const isValid = await bcrypt.compare(apiSecret, credential.apiSecretHash);
    if (!isValid) {
      return null;
    }

    return credential;
  }

  async updateLastUsed(id: string): Promise<void> {
    await this.credentialRepo.update(id, {
      lastUsedAt: new Date(),
    });
  }
}
