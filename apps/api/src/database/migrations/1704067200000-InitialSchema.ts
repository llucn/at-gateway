import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1704067200000 implements MigrationInterface {
  name = 'InitialSchema1704067200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Users table
    await queryRunner.query(`
      CREATE TABLE \`users\` (
        \`id\` varchar(36) NOT NULL,
        \`username\` varchar(50) NOT NULL,
        \`passwordHash\` varchar(255) NOT NULL,
        \`displayName\` varchar(100) NULL,
        \`role\` enum('admin', 'user') NOT NULL DEFAULT 'user',
        \`isActive\` tinyint NOT NULL DEFAULT 1,
        \`lastLoginAt\` datetime NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_username\` (\`username\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Settings table
    await queryRunner.query(`
      CREATE TABLE \`settings\` (
        \`key\` varchar(100) NOT NULL,
        \`value\` text NOT NULL,
        PRIMARY KEY (\`key\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // SMS messages table
    await queryRunner.query(`
      CREATE TABLE \`sms_messages\` (
        \`id\` varchar(36) NOT NULL,
        \`direction\` enum('inbound', 'outbound') NOT NULL,
        \`phoneNumber\` varchar(20) NOT NULL,
        \`content\` text NOT NULL,
        \`status\` enum('pending', 'sent', 'failed', 'received') NOT NULL,
        \`encoding\` enum('gsm7', 'ucs2', 'binary') NOT NULL DEFAULT 'gsm7',
        \`deliveredAt\` datetime NULL,
        \`failureReason\` text NULL,
        \`webhookDelivered\` tinyint NOT NULL DEFAULT 0,
        \`metadata\` json NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX \`IDX_direction_status\` (\`direction\`, \`status\`),
        INDEX \`IDX_phoneNumber\` (\`phoneNumber\`),
        INDEX \`IDX_createdAt\` (\`createdAt\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Call records table
    await queryRunner.query(`
      CREATE TABLE \`call_records\` (
        \`id\` varchar(36) NOT NULL,
        \`direction\` enum('inbound', 'outbound') NOT NULL,
        \`phoneNumber\` varchar(20) NOT NULL,
        \`status\` enum('initiating', 'ringing', 'active', 'ended', 'failed', 'missed') NOT NULL,
        \`startedAt\` datetime NOT NULL,
        \`answeredAt\` datetime NULL,
        \`endedAt\` datetime NULL,
        \`duration\` int NULL,
        \`failureReason\` text NULL,
        \`recordingId\` varchar(36) NULL,
        \`transcription\` text NULL,
        \`webhookDelivered\` tinyint NOT NULL DEFAULT 0,
        \`metadata\` json NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX \`IDX_call_direction_status\` (\`direction\`, \`status\`),
        INDEX \`IDX_call_phoneNumber\` (\`phoneNumber\`),
        INDEX \`IDX_call_startedAt\` (\`startedAt\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Recordings table
    await queryRunner.query(`
      CREATE TABLE \`recordings\` (
        \`id\` varchar(36) NOT NULL,
        \`callId\` varchar(36) NULL,
        \`filePath\` varchar(500) NOT NULL,
        \`format\` enum('wav', 'pcm', 'amr') NOT NULL DEFAULT 'wav',
        \`duration\` int NULL,
        \`transcription\` text NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX \`IDX_callId\` (\`callId\`),
        INDEX \`IDX_recording_createdAt\` (\`createdAt\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Webhook deliveries table
    await queryRunner.query(`
      CREATE TABLE \`webhook_deliveries\` (
        \`id\` varchar(36) NOT NULL,
        \`eventType\` varchar(50) NOT NULL,
        \`url\` varchar(500) NOT NULL,
        \`payload\` text NOT NULL,
        \`attempts\` int NOT NULL DEFAULT 0,
        \`lastAttemptAt\` datetime NULL,
        \`nextRetryAt\` datetime NULL,
        \`deliveredAt\` datetime NULL,
        \`failureReason\` text NULL,
        \`status\` enum('pending', 'delivered', 'failed') NOT NULL DEFAULT 'pending',
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX \`IDX_webhook_status\` (\`status\`),
        INDEX \`IDX_webhook_nextRetryAt\` (\`nextRetryAt\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Modem events table
    await queryRunner.query(`
      CREATE TABLE \`modem_events\` (
        \`id\` varchar(36) NOT NULL,
        \`eventType\` varchar(50) NOT NULL,
        \`data\` text NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX \`IDX_modem_eventType\` (\`eventType\`),
        INDEX \`IDX_modem_createdAt\` (\`createdAt\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`modem_events\``);
    await queryRunner.query(`DROP TABLE \`webhook_deliveries\``);
    await queryRunner.query(`DROP TABLE \`recordings\``);
    await queryRunner.query(`DROP TABLE \`call_records\``);
    await queryRunner.query(`DROP TABLE \`sms_messages\``);
    await queryRunner.query(`DROP TABLE \`settings\``);
    await queryRunner.query(`DROP TABLE \`users\``);
  }
}
