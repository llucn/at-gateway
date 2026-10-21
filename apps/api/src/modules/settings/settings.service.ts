import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from '../../entities/setting.entity';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Setting)
    private settingRepo: Repository<Setting>,
  ) {}

  async get(key: string): Promise<string | null> {
    const setting = await this.settingRepo.findOne({ where: { key } });
    return setting?.value || null;
  }

  async set(key: string, value: string): Promise<void> {
    const setting = await this.settingRepo.findOne({ where: { key } });
    if (setting) {
      setting.value = value;
      await this.settingRepo.save(setting);
    } else {
      await this.settingRepo.save({ key, value });
    }
  }

  async getAll(): Promise<Record<string, string>> {
    const settings = await this.settingRepo.find();
    return settings.reduce((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {} as Record<string, string>);
  }

  async updateBulk(updates: Record<string, string>): Promise<void> {
    for (const [key, value] of Object.entries(updates)) {
      await this.set(key, value);
    }
  }
}
