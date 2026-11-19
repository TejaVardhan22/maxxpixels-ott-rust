import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'name', type: 'varchar', unique: true, nullable: false })
  name: string;

  @Column({ name: 'description', type: 'varchar', nullable: true })
  description: string;

  isSystemRole?: boolean;

  permissions?: any[];
}

