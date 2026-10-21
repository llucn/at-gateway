import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('settings')
export class Setting {
  @PrimaryColumn({ length: 100 })
  key!: string;

  @Column({ type: 'text' })
  value!: string;
}
