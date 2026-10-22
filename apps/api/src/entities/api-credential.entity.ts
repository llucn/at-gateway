import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('api_credentials')
@Index(['isActive'])
@Index(['expiresAt'])
export class ApiCredential {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100, nullable: true })
  name?: string;

  @Column({ length: 20, unique: true })
  apiKey!: string;

  @Column({ length: 60 })
  apiSecretHash!: string;

  @Column({ type: 'datetime', nullable: true })
  expiresAt?: Date;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'datetime', nullable: true })
  lastUsedAt?: Date;

  @Column({ type: 'datetime', nullable: true })
  revokedAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
