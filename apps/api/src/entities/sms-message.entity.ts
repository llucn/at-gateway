import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('sms_messages')
@Index(['direction', 'status'])
@Index(['phoneNumber'])
@Index(['createdAt'])
export class SmsMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: ['inbound', 'outbound'] })
  direction!: 'inbound' | 'outbound';

  @Column({ length: 20 })
  phoneNumber!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'sent', 'failed', 'received'],
  })
  status!: 'pending' | 'sent' | 'failed' | 'received';

  @Column({ type: 'enum', enum: ['gsm7', 'ucs2', 'binary'], default: 'gsm7' })
  encoding!: 'gsm7' | 'ucs2' | 'binary';

  @Column({ type: 'datetime', nullable: true })
  deliveredAt?: Date;

  @Column({ type: 'text', nullable: true })
  failureReason?: string;

  @Column({ default: false })
  webhookDelivered!: boolean;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;
}
