import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('languages')
export class Language {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'code', type: 'varchar', unique: true, nullable: false })
  code: string;

  @Column({ name: 'name', type: 'varchar', nullable: false })
  name: string;

  nativeName?: string;

  iconUrl?: string;

  isDefault?: boolean;

  isActive?: boolean;

  displayOrder?: number;
}

