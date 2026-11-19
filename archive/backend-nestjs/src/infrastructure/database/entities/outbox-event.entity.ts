import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('outbox_events')
@Index('idx_outbox_status_created', ['status', 'createdAt'])
export class OutboxEvent {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'aggregate_type', type: 'varchar', length: 100, default: 'DOMAIN' })
  aggregateType: string;

  @Column({ name: 'aggregate_id', type: 'varchar', length: 100, nullable: true })
  aggregateId: string;

  @Column({ name: 'event_type', type: 'varchar', length: 150, nullable: true })
  eventType: string;

  @Column({ name: 'topic', type: 'varchar', length: 120, nullable: false })
  topic: string;

  @Column({ name: 'event_key', type: 'varchar', length: 120, nullable: true })
  eventKey: string;

  @Column({ name: 'payload', type: 'jsonb', nullable: false })
  payload: Record<string, any>;

  @Column({ name: 'status', type: 'varchar', length: 30, default: 'PENDING' })
  status: string;

  @Column({ name: 'retry_count', type: 'int', default: 0 })
  retryCount: number;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string;

  @Column({ name: 'next_attempt_at', type: 'timestamptz', nullable: true })
  nextAttemptAt: Date;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
