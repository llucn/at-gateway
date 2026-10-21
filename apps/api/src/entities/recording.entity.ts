import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('recordings')
@Index(['callId'])
@Index(['createdAt'])
export class Recording {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  callId?: string;

  @Column({ length: 500 })
  filePath!: string;

  @Column({ type: 'enum', enum: ['wav', 'pcm', 'amr'], default: 'wav' })
  format!: 'wav' | 'pcm' | 'amr';

  @Column({ type: 'int', nullable: true })
  duration?: number; // seconds

  @Column({ type: 'text', nullable: true })
  transcription?: string;

  @CreateDateColumn()
  createdAt!: Date;
}
