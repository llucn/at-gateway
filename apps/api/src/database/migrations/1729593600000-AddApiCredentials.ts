import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddApiCredentials1729593600000 implements MigrationInterface {
  name = 'AddApiCredentials1729593600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`api_credentials\` (
        \`id\` varchar(36) NOT NULL,
        \`name\` varchar(100) NULL,
        \`apiKey\` varchar(20) NOT NULL,
        \`apiSecretHash\` varchar(60) NOT NULL,
        \`expiresAt\` datetime NULL,
        \`isActive\` tinyint NOT NULL DEFAULT 1,
        \`lastUsedAt\` datetime NULL,
        \`revokedAt\` datetime NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_apiKey\` (\`apiKey\`),
        INDEX \`IDX_isActive\` (\`isActive\`),
        INDEX \`IDX_expiresAt\` (\`expiresAt\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`api_credentials\``);
  }
}
