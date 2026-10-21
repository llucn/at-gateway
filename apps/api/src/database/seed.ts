import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { config } from 'dotenv';
import { User } from '../entities/user.entity';
import { Setting } from '../entities/setting.entity';

config();

async function seed() {
  const dataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    username: process.env.DB_USER || 'atgw',
    password: process.env.DB_PASSWORD || 'atgw',
    database: process.env.DB_NAME || 'at_gateway',
    entities: [User, Setting],
    synchronize: false,
  });

  await dataSource.initialize();

  const userRepo = dataSource.getRepository(User);
  const settingRepo = dataSource.getRepository(Setting);

  // Create bootstrap admin user if none exists
  const userCount = await userRepo.count();
  if (userCount === 0) {
    const username = process.env.BOOTSTRAP_ADMIN_USERNAME || 'admin';
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || 'ChangeMe123!';
    const passwordHash = await bcrypt.hash(password, 10);

    const admin = userRepo.create({
      username,
      passwordHash,
      displayName: 'Administrator',
      role: 'admin',
      isActive: true,
    });

    await userRepo.save(admin);
    console.log(`✅ Created admin user: ${username}`);
  } else {
    console.log('ℹ️  Users already exist, skipping bootstrap admin creation');
  }

  // Create default settings if none exist
  const settingCount = await settingRepo.count();
  if (settingCount === 0) {
    const defaultSettings = [
      {
        key: 'webhook.smsUrl',
        value: process.env.WEBHOOK_SMS_URL || '',
      },
      {
        key: 'webhook.callUrl',
        value: process.env.WEBHOOK_CALL_URL || '',
      },
      {
        key: 'webhook.secret',
        value: process.env.WEBHOOK_SECRET || '',
      },
      {
        key: 'webhook.enabled',
        value: 'true',
      },
    ];

    for (const setting of defaultSettings) {
      await settingRepo.save(settingRepo.create(setting));
    }

    console.log('✅ Created default settings');
  } else {
    console.log('ℹ️  Settings already exist, skipping defaults');
  }

  await dataSource.destroy();
  console.log('✅ Seed completed');
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
