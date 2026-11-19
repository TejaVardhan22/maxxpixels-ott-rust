import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'title', type: 'varchar', nullable: false })
  title: string;

  @Column({ name: 'message', type: 'text', nullable: false })
  message: string;

  imageUrl?: string;

  deepLinkUrl?: string;

  @Column({ name: 'channel', type: 'varchar', default: 'PUSH', nullable: false })
  channel: string;

  targetAudience?: string;

  targetUserId?: string;

  @Column({ name: 'target_type', type: 'varchar', default: 'ALL', nullable: true })
  targetType: string;

  @Column({ name: 'target_value', type: 'varchar', nullable: true })
  targetValue: string;

  @Column({ name: 'recipient_target', type: 'varchar', nullable: true })
  recipientTarget: string;

  @Column({ name: 'action_url', type: 'varchar', nullable: true })
  actionUrl: string;

  sentCount?: number;

  @Column({ name: 'status', type: 'varchar', default: 'PENDING', nullable: true })
  status: string;

  createdBy?: string;

  @Column({ name: 'error_details', type: 'text', nullable: true })
  errorDetails: string;

  @Column({ name: 'scheduled_at', type: 'timestamptz', nullable: true })
  scheduledAt: Date;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
