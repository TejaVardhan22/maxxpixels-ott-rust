import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'user_id', type: 'bigint', nullable: true })
  userId: any;

  @Column({ name: 'user_email', type: 'varchar', nullable: true })
  userEmail: string;

  get actorEmail(): string {
    return this.userEmail;
  }
  set actorEmail(val: string) {
    this.userEmail = val;
  }

  @Column({ name: 'user_role', type: 'varchar', nullable: true })
  userRole: string;

  @Column({ name: 'action', type: 'varchar', nullable: false })
  action: string;

  @Column({ name: 'entity_name', type: 'varchar', nullable: true })
  entityName: string;

  get targetEntity(): string {
    return this.entityName;
  }
  set targetEntity(val: string) {
    this.entityName = val;
  }

  @Column({ name: 'entity_id', type: 'varchar', nullable: true })
  entityId: string;

  get targetId(): string {
    return this.entityId;
  }
  set targetId(val: string) {
    this.entityId = val;
  }

  @Column({ name: 'details', type: 'text', nullable: true })
  details: string;

  @Column({ name: 'ip_address', type: 'varchar', nullable: true })
  ipAddress: string;

  get timestamp(): Date {
    return this.createdAt;
  }
  set timestamp(val: Date) {
    this.createdAt = val;
  }

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
