import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('people')
export class Person {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'name', type: 'varchar', nullable: false })
  name: string;

  @Column({ name: 'bio', type: 'text', nullable: true })
  bio: string;

  @Column({ name: 'profile_image', type: 'varchar', nullable: true })
  profileImage: string;

  get avatarUrl(): string {
    return this.profileImage || '';
  }
  set avatarUrl(val: string) {
    this.profileImage = val;
  }

  knownForDepartment?: string;

  birthDate?: string;

  createdAt?: Date;
}

