import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { validateEnvironment } from './config/env.validation';

// Entities
import { User } from './entities/user.entity';
import { Setting } from './entities/setting.entity';
import { SmsMessage } from './entities/sms-message.entity';
import { CallRecord } from './entities/call-record.entity';
import { Recording } from './entities/recording.entity';
import { WebhookDelivery } from './entities/webhook-delivery.entity';
import { ModemEvent } from './entities/modem-event.entity';

// Modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ModemModule } from './modules/modem/modem.module';
import { StatusModule } from './modules/status/status.module';
import { SmsModule } from './modules/sms/sms.module';
import { CallsModule } from './modules/calls/calls.module';
import { RecordingsModule } from './modules/recordings/recordings.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { SettingsModule } from './modules/settings/settings.module';
import { MediaModule } from './modules/media/media.module';
import { EventsModule } from './modules/events/events.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get('DB_HOST'),
        port: config.get('DB_PORT'),
        username: config.get('DB_USER'),
        password: config.get('DB_PASSWORD'),
        database: config.get('DB_NAME'),
        entities: [User, Setting, SmsMessage, CallRecord, Recording, WebhookDelivery, ModemEvent],
        synchronize: config.get('DB_SYNCHRONIZE'),
        logging: config.get('DB_LOGGING'),
        migrationsRun: config.get('DB_MIGRATIONS_RUN'),
      }),
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    ModemModule,
    StatusModule,
    SmsModule,
    CallsModule,
    RecordingsModule,
    WebhooksModule,
    SettingsModule,
    MediaModule,
    EventsModule,
    HealthModule,
  ],
})
export class AppModule {}
