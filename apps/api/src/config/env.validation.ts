// Environment validation with Zod
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // HTTP
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  API_PREFIX: z.string().default('api'),
  CORS_ORIGINS: z.string().default('*'),

  // Database
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1),
  DB_SYNCHRONIZE: z.coerce.boolean().default(false),
  DB_LOGGING: z.coerce.boolean().default(false),
  DB_MIGRATIONS_RUN: z.coerce.boolean().default(true),

  // Auth
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_TTL: z.string().default('30d'),
  BOOTSTRAP_ADMIN_USERNAME: z.string().default('admin'),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(8),

  // Modem
  MODEM_PORT: z.string().optional(),
  MODEM_BAUD_RATE: z.coerce.number().int().positive().default(115200),
  MODEM_AUTO_DETECT: z.coerce.boolean().default(true),
  MODEM_USB_FILTERS: z.string().default('1e0e:9011,1e0e:9001'),
  MODEM_COMMAND_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  MODEM_RECONNECT_DELAY_MS: z.coerce.number().int().positive().default(3000),
  MODEM_SIM_PIN: z.string().optional(),
  MODEM_SMS_MODE: z.enum(['PDU', 'TEXT']).default('PDU'),
  MODEM_SMSC: z.string().optional(),
  MODEM_STATUS_POLL_MS: z.coerce.number().int().positive().default(10000),

  // Audio
  MODEM_AUDIO_MODE: z.enum(['usb', 'none']).default('usb'),
  AUDIO_INPUT_DEVICE: z.string().default('default'),
  AUDIO_OUTPUT_DEVICE: z.string().default('default'),
  AUDIO_SAMPLE_RATE: z.coerce.number().int().positive().default(8000),
  AUDIO_CHANNELS: z.coerce.number().int().positive().default(1),
  MEDIA_STORAGE_DIR: z.string().default('./storage/recordings'),
  MEDIA_RETENTION_DAYS: z.coerce.number().int().positive().default(90),

  // TTS
  TTS_PROVIDER: z.enum(['piper', 'edge', 'azure', 'openai', 'none']).default('piper'),
  TTS_VOICE: z.string().optional(),
  TTS_PIPER_BIN: z.string().default('piper'),
  TTS_PIPER_MODEL: z.string().optional(),
  TTS_API_KEY: z.string().optional(),
  TTS_API_REGION: z.string().optional(),
  TTS_CACHE_DIR: z.string().default('./storage/tts-cache'),

  // STT
  STT_PROVIDER: z.enum(['whisper-cpp', 'faster-whisper', 'azure', 'openai', 'none']).default('whisper-cpp'),
  STT_LANGUAGE: z.string().default('zh'),
  STT_WHISPER_BIN: z.string().default('whisper-cli'),
  STT_WHISPER_MODEL: z.string().optional(),
  STT_API_KEY: z.string().optional(),
  STT_API_REGION: z.string().optional(),

  // Webhooks
  WEBHOOK_SMS_URL: z.string().url().optional().or(z.literal('')),
  WEBHOOK_CALL_URL: z.string().url().optional().or(z.literal('')),
  WEBHOOK_SECRET: z.string().optional(),
  WEBHOOK_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  WEBHOOK_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
});

export type Environment = z.infer<typeof envSchema>;

export function validateEnvironment(config: Record<string, unknown>): Environment {
  return envSchema.parse(config);
}
