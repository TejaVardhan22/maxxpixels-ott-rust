import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'bigint', nullable: false })
  userId: any;

  @Column({ name: 'token', type: 'varchar', nullable: true })
  token: string;

  get tokenHash(): string {
    return this.token;
  }
  set tokenHash(val: string) {
    this.token = val;
  }

  @Column({ name: 'device_id', type: 'varchar', nullable: true })
  deviceId: string;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: false })
  expiresAt: Date;

  @Column({ name: 'revoked', type: 'boolean', default: false })
  revoked: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
