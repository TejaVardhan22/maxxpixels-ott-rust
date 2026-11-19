import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'name', type: 'varchar', unique: true, nullable: false })
  name: string;

  @Column({ name: 'module', type: 'varchar', nullable: true })
  module: string;

  @Column({ name: 'description', type: 'varchar', nullable: true })
  description: string;
}
