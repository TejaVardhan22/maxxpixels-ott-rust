import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { numericTransformer } from '../../../common/utils/column-numeric.transformer';

@Entity('producer_profiles')
export class ProducerProfile {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @OneToOne(() => User, { eager: true, onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'bigint', unique: true, nullable: true })
  userId: any;

  @Column({ name: 'company_name', type: 'varchar', nullable: false })
  companyName: string;

  contactPerson?: string;

  email?: string;

  phone?: string;

  @Column({ name: 'studio_registration_number', type: 'varchar', nullable: true })
  studioRegistrationNumber: string;

  @Column({ name: 'bank_account_payout_id', type: 'varchar', nullable: true })
  bankAccountPayoutId: string;

  @Column({ name: 'tax_id', type: 'varchar', nullable: true })
  taxId: string;

  @Column({
    name: 'revenue_share',
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 70.0,
    transformer: numericTransformer,
  })
  revenueShare: number;

  get revenueSharePercent(): number {
    return this.revenueShare;
  }
  set revenueSharePercent(val: number) {
    this.revenueShare = val;
  }

  @Column({ name: 'status', type: 'varchar', default: 'PENDING', nullable: true })
  status: string;

  kycStatus?: string;

  @Column({ name: 'onboarding_status', type: 'varchar', default: 'PENDING', nullable: true })
  onboardingStatus: string;

  @Column({ name: 'pan_number', type: 'varchar', nullable: true })
  panNumber: string;

  @Column({ name: 'pan_doc_url', type: 'varchar', nullable: true })
  panDocUrl: string;

  @Column({ name: 'pan_status', type: 'varchar', default: 'PENDING', nullable: true })
  panStatus: string;

  @Column({ name: 'aadhar_number', type: 'varchar', nullable: true })
  aadharNumber: string;

  @Column({ name: 'aadhar_doc_url', type: 'varchar', nullable: true })
  aadharDocUrl: string;

  @Column({ name: 'aadhar_back_doc_url', type: 'varchar', nullable: true })
  aadharBackDocUrl: string;

  @Column({ name: 'aadhar_status', type: 'varchar', default: 'PENDING', nullable: true })
  aadharStatus: string;

  @Column({ name: 'gst_number', type: 'varchar', nullable: true })
  gstNumber: string;

  @Column({ name: 'gst_doc_url', type: 'varchar', nullable: true })
  gstDocUrl: string;

  @Column({ name: 'gst_status', type: 'varchar', default: 'PENDING', nullable: true })
  gstStatus: string;

  @Column({ name: 'bank_name', type: 'varchar', nullable: true })
  bankName: string;

  @Column({ name: 'bank_account_number', type: 'varchar', nullable: true })
  bankAccountNumber: string;

  @Column({ name: 'ifsc_code', type: 'varchar', nullable: true })
  ifscCode: string;

  get bankIfsc(): string {
    return this.ifscCode;
  }
  set bankIfsc(val: string) {
    this.ifscCode = val;
  }

  @Column({ name: 'bank_doc_url', type: 'varchar', nullable: true })
  bankDocUrl: string;

  @Column({ name: 'bank_status', type: 'varchar', default: 'PENDING', nullable: true })
  bankStatus: string;

  @Column({ name: 'signed_agreement_url', type: 'varchar', nullable: true })
  signedAgreementUrl: string;

  get agreementUrl(): string {
    return this.signedAgreementUrl;
  }
  set agreementUrl(val: string) {
    this.signedAgreementUrl = val;
  }

  @Column({ name: 'agreement_status', type: 'varchar', default: 'PENDING', nullable: true })
  agreementStatus: string;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string;

  isActive?: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  updatedAt?: Date;
}
