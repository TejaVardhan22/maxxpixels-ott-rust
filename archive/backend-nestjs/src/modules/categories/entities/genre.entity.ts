import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('genres')
export class Genre {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'name', type: 'varchar', unique: true, nullable: false })
  name: string;

  @Column({ name: 'slug', type: 'varchar', unique: true, nullable: false })
  slug: string;

  description?: string;

  iconUrl?: string;

  imageUrl?: string;

  isActive?: boolean;
}

