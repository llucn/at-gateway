import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('webhook_deliveries')
@Index(['status'])
@Index(['nextRetryAt'])
export class WebhookDelivery {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 50 })
  eventType!: string;

  @Column({ length: 500 })
  url!: string;

  @Column({ type: 'text' })
  payload!: string; // JSON string

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @Column({ type: 'datetime', nullable: true })
  lastAttemptAt?: Date;

  @Column({ type: 'datetime', nullable: true })
  nextRetryAt?: Date;

  @Column({ type: 'datetime', nullable: true })
  deliveredAt?: Date;

  @Column({ type: 'text', nullable: true })
  failureReason?: string;

  @Column({ type: 'enum', enum: ['pending', 'delivered', 'failed'], default: 'pending' })
  status!: 'pending' | 'delivered' | 'failed';

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
