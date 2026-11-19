import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('profiles')
export class Profile {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: any;

  @ManyToOne(() => User, (user) => user.profiles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'bigint', nullable: false })
  userId: any;

  @Column({ name: 'name', type: 'varchar', nullable: false })
  name: string;

  @Column({ name: 'avatar_url', type: 'varchar', nullable: true })
  avatarUrl: string;

  @Column({ name: 'kids_profile', type: 'boolean', default: false })
  kidsProfile: boolean;

  get isKids(): boolean {
    return this.kidsProfile;
  }
  set isKids(val: boolean) {
    this.kidsProfile = val;
  }

  @Column({ name: 'pin_code_hash', type: 'varchar', nullable: true })
  pinCodeHash: string;

  get pinHash(): string {
    return this.pinCodeHash;
  }
  set pinHash(val: string) {
    this.pinCodeHash = val;
  }

  pinCode?: string;

  @Column({ name: 'preferred_language', type: 'varchar', nullable: true })
  preferredLanguage: string;

  get preferredLanguages(): string {
    return this.preferredLanguage;
  }
  set preferredLanguages(val: string) {
    this.preferredLanguage = val;
  }

  @Column({ name: 'maturity_level', type: 'varchar', default: '18+', nullable: true })
  maturityLevel: string;

  get maturityRatingLimit(): string {
    return this.maturityLevel;
  }
  set maturityRatingLimit(val: string) {
    this.maturityLevel = val;
  }

  isDefault?: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
