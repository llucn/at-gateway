import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('modem_events')
@Index(['eventType'])
@Index(['createdAt'])
export class ModemEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 50 })
  eventType!: string;

  @Column({ type: 'text', nullable: true })
  data?: string; // JSON string

  @CreateDateColumn()
  createdAt!: Date;
}
