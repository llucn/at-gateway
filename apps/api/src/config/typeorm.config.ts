// TypeORM DataSource configuration for migrations
import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USER || 'atgw',
  password: process.env.DB_PASSWORD || 'atgw',
  database: process.env.DB_NAME || 'at_gateway',
  entities: ['src/entities/**/*.entity.ts'],
  migrations: ['src/database/migrations/**/*.ts'],
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
});
