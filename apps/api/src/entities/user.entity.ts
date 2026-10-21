import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true, length: 50 })
  username!: string;

  @Column({ length: 255 })
  passwordHash!: string;

  @Column({ nullable: true, length: 100 })
  displayName?: string;

  @Column({ type: 'enum', enum: ['admin', 'user'], default: 'user' })
  role!: 'admin' | 'user';

  @Column({ default: true })
  isActive!: boolean;

  @Column({ type: 'datetime', nullable: true })
  lastLoginAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
