import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'name', type: 'varchar', unique: true, nullable: false })
  name: string;

  @Column({ name: 'slug', type: 'varchar', unique: true, nullable: false })
  slug: string;

  @Column({ name: 'description', type: 'varchar', nullable: true })
  description: string;

  @Column({ name: 'image_url', type: 'varchar', nullable: true })
  imageUrl: string;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
