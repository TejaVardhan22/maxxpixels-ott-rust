import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
  OneToMany,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { randomUUID } from 'crypto';
import { Role } from './role.entity';
import { Profile } from './profile.entity';
import { Device } from './device.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: any;

  @Column({ name: 'uuid', type: 'varchar', unique: true, nullable: true })
  uuid: string;

  @Column({ name: 'email', type: 'varchar', unique: true, nullable: true })
  email: string;

  @Column({ name: 'phone_number', type: 'varchar', unique: true, nullable: true })
  phoneNumber: string;

  get phone(): string {
    return this.phoneNumber;
  }
  set phone(val: string) {
    this.phoneNumber = val;
  }

  @BeforeInsert()
  @BeforeUpdate()
  syncFields() {
    if (!this.uuid) {
      this.uuid = randomUUID();
    }
  }

  @Column({ name: 'country_code', type: 'varchar', default: '+91', nullable: true })
  countryCode: string;

  @Column({ name: 'password_hash', type: 'varchar', nullable: true })
  passwordHash: string;

  @Column({ name: 'full_name', type: 'varchar', nullable: true })
  fullName: string;

  avatarUrl?: string;

  @Column({ name: 'date_of_birth', type: 'varchar', nullable: true })
  dateOfBirth: string;

  @Column({ name: 'profession', type: 'varchar', nullable: true })
  profession: string;

  @Column({ name: 'pincode', type: 'varchar', nullable: true })
  pincode: string;

  preferredLanguages?: string;

  @Column({ name: 'status', type: 'varchar', default: 'ACTIVE', nullable: false })
  status: string;

  emailVerified?: boolean;

  @Column({ name: 'phone_verified', type: 'boolean', default: false })
  phoneVerified: boolean;

  @Column({ name: 'auth_method', type: 'varchar', default: 'SMS_OTP', nullable: true })
  authMethod: string;

  @Column({ name: 'last_active_at', type: 'timestamptz', nullable: true })
  lastActiveAt: Date;

  get lastLoginAt(): Date {
    return this.lastActiveAt;
  }
  set lastLoginAt(val: Date) {
    this.lastActiveAt = val;
  }

  @ManyToMany(() => Role, { eager: true })
  @JoinTable({
    name: 'user_roles',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'role_id', referencedColumnName: 'id' },
  })
  roles: Role[];

  @OneToMany(() => Profile, (profile) => profile.user)
  profiles: Profile[];

  @OneToMany(() => Device, (device) => device.user)
  devices: Device[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
