import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('call_records')
@Index(['direction', 'status'])
@Index(['phoneNumber'])
@Index(['startedAt'])
export class CallRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: ['inbound', 'outbound'] })
  direction!: 'inbound' | 'outbound';

  @Column({ length: 20 })
  phoneNumber!: string;

  @Column({
    type: 'enum',
    enum: ['initiating', 'ringing', 'active', 'ended', 'failed', 'missed'],
  })
  status!: 'initiating' | 'ringing' | 'active' | 'ended' | 'failed' | 'missed';

  @Column({ type: 'datetime' })
  startedAt!: Date;

  @Column({ type: 'datetime', nullable: true })
  answeredAt?: Date;

  @Column({ type: 'datetime', nullable: true })
  endedAt?: Date;

  @Column({ type: 'int', nullable: true })
  duration?: number; // seconds

  @Column({ type: 'text', nullable: true })
  failureReason?: string;

  @Column({ type: 'uuid', nullable: true })
  recordingId?: string;

  @Column({ type: 'text', nullable: true })
  transcription?: string;

  @Column({ default: false })
  webhookDelivered!: boolean;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;
}
