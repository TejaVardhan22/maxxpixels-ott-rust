import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterModule, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDividerModule } from '@angular/material/divider';
import { NotificationService } from '../../shared/services/notification.service';
import { ProducerApiService } from '../../core/services/producer-api.service';
import { environment } from '../../../environments/environment';

export interface ProvisionedStudioReceipt {
  id: number;
  studioName: string;
  contactEmail: string;
  loginPassword: string;
  revenueShare: number;
  status: string;
  payoutId: string;
}

@Component({
  selector: 'app-producer-onboarding-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    MatProgressBarModule,
    MatDividerModule
  ],
  template: `
    <div class="onboard-page-container">
      <!-- 1. EXECUTIVE HEADER -->
      <div class="header-card">
        <div class="header-left">
          <div class="header-badge">
            <mat-icon>business_center</mat-icon>
            <span>STUDIO PARTNER PROVISIONING</span>
          </div>
          <h1>Dedicated Producer Onboarding Hub</h1>
          <p>Register production companies, provision ROLE_PRODUCER credentials, set up bank settlements, and configure revenue sharing contracts</p>
        </div>
        <div class="header-actions">
          <button mat-stroked-button class="outline-action-btn" routerLink="/admin/producers">
            <mat-icon>arrow_back</mat-icon>
            <span>Back to Producers Directory</span>
          </button>
          <button mat-stroked-button class="quick-fill-btn" (click)="populateSampleData()">
            <mat-icon>auto_fix_high</mat-icon>
            <span>Quick Auto-Fill Sample Studio</span>
          </button>
        </div>
      </div>

      <!-- 2. PROVISIONED CREDENTIALS SUCCESS RECEIPT BANNER -->
      <div class="receipt-banner" *ngIf="lastProvisionedStudio">
        <div class="receipt-icon">
          <mat-icon>verified</mat-icon>
        </div>
        <div class="receipt-details">
          <div class="receipt-title-row">
            <h3>Studio Successfully Onboarded &amp; Provisioned!</h3>
            <span class="active-badge">ROLE_PRODUCER Active</span>
          </div>
          <p class="receipt-sub">The partner account has been created in the database and is ready for portal access.</p>
          <div class="credential-chips">
            <div class="chip">
              <span class="chip-label">Studio Name:</span>
              <span class="chip-val">{{ lastProvisionedStudio.studioName }}</span>
            </div>
            <div class="chip highlight">
              <span class="chip-label">Login Email ID:</span>
              <span class="chip-val font-mono">{{ lastProvisionedStudio.contactEmail }}</span>
              <button mat-icon-button (click)="copyToClipboard(lastProvisionedStudio.contactEmail, 'Email')" matTooltip="Copy Email">
                <mat-icon>content_copy</mat-icon>
              </button>
            </div>
            <div class="chip highlight gold">
              <span class="chip-label">Provisioned Password:</span>
              <span class="chip-val font-mono">{{ showReceiptPassword ? lastProvisionedStudio.loginPassword : '••••••••••••' }}</span>
              <button mat-icon-button (click)="showReceiptPassword = !showReceiptPassword" matTooltip="Show/Hide Password">
                <mat-icon>{{ showReceiptPassword ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              <button mat-icon-button (click)="copyToClipboard(lastProvisionedStudio.loginPassword, 'Password')" matTooltip="Copy Password">
                <mat-icon>content_copy</mat-icon>
              </button>
            </div>
            <div class="chip">
              <span class="chip-label">Revenue Share:</span>
              <span class="chip-val text-green">{{ lastProvisionedStudio.revenueShare }}% Net Payout</span>
            </div>
          </div>
        </div>
        <div class="receipt-actions">
          <button mat-raised-button color="primary" class="go-dash-btn" (click)="openStudioDashboard(lastProvisionedStudio.id)">
            <mat-icon>dashboard</mat-icon>
            <span>Open Studio Dashboard</span>
          </button>
          <button mat-stroked-button class="new-studio-btn" (click)="resetForm()">
            <mat-icon>add</mat-icon>
            <span>Onboard Another Studio</span>
          </button>
        </div>
      </div>

      <!-- 3. MAIN MULTI-SECTION ONBOARDING FORM -->
      <form [formGroup]="onboardForm" (ngSubmit)="onSubmit()" class="form-container">
        <!-- SECTION A: STUDIO LEGAL IDENTITY -->
        <mat-card class="form-section-card">
          <div class="section-header">
            <div class="section-icon-box blue">
              <mat-icon>business</mat-icon>
            </div>
            <div>
              <h2>1. Studio Legal Identity &amp; Corporate Entity</h2>
              <p>Registered production house or independent film maker legal details</p>
            </div>
          </div>

          <div class="form-grid">
            <div class="grid-col-6">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Studio / Company Legal Name *</mat-label>
                <input matInput formControlName="studioName" placeholder="e.g. Apex Digital Entertainment Pvt Ltd" required>
                <mat-icon matSuffix>business</mat-icon>
                <mat-error *ngIf="onboardForm.get('studioName')?.hasError('required')">Studio name is mandatory</mat-error>
              </mat-form-field>
            </div>

            <div class="grid-col-6">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Studio Registration / CIN / Incorporation Number *</mat-label>
                <input matInput formControlName="studioRegistrationNumber" placeholder="e.g. U74999TG2026PTC109283" required>
                <mat-icon matSuffix>badge</mat-icon>
                <mat-error *ngIf="onboardForm.get('studioRegistrationNumber')?.hasError('required')">Registration number is mandatory</mat-error>
              </mat-form-field>
            </div>

            <div class="grid-col-4">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Corporate Entity Type</mat-label>
                <mat-select formControlName="businessType">
                  <mat-option value="PRIVATE_LIMITED">Private Limited Company (Pvt Ltd)</mat-option>
                  <mat-option value="LLP">Limited Liability Partnership (LLP)</mat-option>
                  <mat-option value="PROPRIETORSHIP">Sole Proprietorship / Partnership</mat-option>
                  <mat-option value="STUDIO_PRODUCTION">Independent Film Production Studio</mat-option>
                  <mat-option value="GLOBAL_DISTRIBUTOR">International Content Distributor</mat-option>
                </mat-select>
                <mat-icon matSuffix>account_tree</mat-icon>
              </mat-form-field>
            </div>

            <div class="grid-col-4">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Official Contact Email (Primary Portal Login) *</mat-label>
                <input matInput type="email" formControlName="contactEmail" placeholder="e.g. partner@apexdigital.com" required>
                <mat-icon matSuffix>email</mat-icon>
                <mat-error *ngIf="onboardForm.get('contactEmail')?.hasError('required')">Valid email is required</mat-error>
              </mat-form-field>
            </div>

            <div class="grid-col-4">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Official Authorized Phone Number *</mat-label>
                <input matInput formControlName="contactPhone" placeholder="e.g. 9876543210" required>
                <mat-icon matSuffix>phone</mat-icon>
                <mat-error *ngIf="onboardForm.get('contactPhone')?.hasError('required')">Phone number is required</mat-error>
              </mat-form-field>
            </div>
          </div>
        </mat-card>

        <!-- SECTION B: PORTAL LOGIN ACCOUNT PROVISIONING -->
        <mat-card class="form-section-card">
          <div class="section-header">
            <div class="section-icon-box purple">
              <mat-icon>vpn_key</mat-icon>
            </div>
            <div>
              <h2>2. Producer Portal Login &amp; Role Provisioning</h2>
              <p>System automatically creates an authenticated user with ROLE_PRODUCER authority</p>
            </div>
          </div>

          <div class="form-grid">
            <div class="grid-col-6">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Initial Studio Login Password *</mat-label>
                <input matInput [type]="showPassword ? 'text' : 'password'" formControlName="loginPassword" required>
                <button type="button" mat-icon-button matSuffix (click)="showPassword = !showPassword">
                  <mat-icon>{{ showPassword ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
                <mat-error *ngIf="onboardForm.get('loginPassword')?.hasError('required')">Password is required</mat-error>
              </mat-form-field>
            </div>

            <div class="grid-col-6">
              <div class="password-helper-box">
                <button type="button" mat-stroked-button class="gen-pass-btn" (click)="generateRandomPassword()">
                  <mat-icon>sync</mat-icon>
                  <span>Generate Secure Random Password</span>
                </button>
                <span class="helper-text">Producer can reset this password at any time from their studio dashboard.</span>
              </div>
            </div>
          </div>
        </mat-card>

        <!-- SECTION C: TAX COMPLIANCE & LEGAL IDS -->
        <mat-card class="form-section-card">
          <div class="section-header">
            <div class="section-icon-box gold">
              <mat-icon>receipt_long</mat-icon>
            </div>
            <div>
              <h2>3. Tax Compliance &amp; KYC Verification</h2>
              <p>Government tax identification for automated TDS deduction and GST invoicing</p>
            </div>
          </div>

          <div class="form-grid">
            <div class="grid-col-4">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Permanent Account Number (PAN) *</mat-label>
                <input matInput formControlName="panNumber" placeholder="e.g. ABCDE1234F" style="text-transform: uppercase;" required>
                <mat-icon matSuffix>fingerprint</mat-icon>
                <mat-error *ngIf="onboardForm.get('panNumber')?.hasError('required')">PAN is required for tax deduction</mat-error>
              </mat-form-field>
            </div>

            <div class="grid-col-4">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>GST Identification Number (GSTIN) *</mat-label>
                <input matInput formControlName="gstNumber" placeholder="e.g. 36ABCDE1234F1Z5" style="text-transform: uppercase;" required>
                <mat-icon matSuffix>verified_user</mat-icon>
                <mat-error *ngIf="onboardForm.get('gstNumber')?.hasError('required')">GSTIN is required</mat-error>
              </mat-form-field>
            </div>

            <div class="grid-col-4">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Authorized Signatory Aadhaar Number</mat-label>
                <input matInput formControlName="aadharNumber" placeholder="e.g. 123456789012" maxlength="12">
                <mat-icon matSuffix>credit_card</mat-icon>
              </mat-form-field>
            </div>

            <!-- KYC DOCUMENT UPLOADS: PAN, AADHAAR FRONT & BACK -->
            <div class="grid-col-12">
              <div class="kyc-uploads-title">
                <mat-icon>upload_file</mat-icon>
                <span>Upload KYC Documents (Aadhaar Front &amp; Back, PAN Card)</span>
              </div>

              <div class="kyc-upload-row">
                <!-- 1. PAN Card Document -->
                <div class="kyc-upload-card" [class.has-file]="!!onboardForm.get('panDocUrl')?.value">
                  <div class="doc-header">
                    <mat-icon>badge</mat-icon>
                    <span class="doc-title">PAN Card Copy</span>
                    <span class="doc-status" *ngIf="onboardForm.get('panDocUrl')?.value">ATTACHED</span>
                  </div>
                  <p class="doc-desc">Company or authorized signatory PAN card (PDF, JPG, PNG)</p>
                  <div class="doc-actions">
                    <input type="file" #panInput style="display:none" accept="image/*,application/pdf" (change)="onFileUpload($event, 'panDocUrl')">
                    <button type="button" mat-stroked-button color="primary" (click)="panInput.click()" [disabled]="uploadingDoc['panDocUrl']">
                      <mat-icon *ngIf="!uploadingDoc['panDocUrl']">cloud_upload</mat-icon>
                      <mat-icon *ngIf="uploadingDoc['panDocUrl']" class="spin-anim">sync</mat-icon>
                      <span>{{ onboardForm.get('panDocUrl')?.value ? 'Change PAN Doc' : 'Upload PAN' }}</span>
                    </button>
                    <a *ngIf="onboardForm.get('panDocUrl')?.value" [href]="onboardForm.get('panDocUrl')?.value" target="_blank" class="preview-btn">
                      <mat-icon>visibility</mat-icon> Preview
                    </a>
                  </div>
                </div>

                <!-- 2. Aadhaar Front Side -->
                <div class="kyc-upload-card" [class.has-file]="!!onboardForm.get('aadharDocUrl')?.value">
                  <div class="doc-header">
                    <mat-icon>credit_card</mat-icon>
                    <span class="doc-title">Aadhaar (Front Side)</span>
                    <span class="doc-status" *ngIf="onboardForm.get('aadharDocUrl')?.value">ATTACHED</span>
                  </div>
                  <p class="doc-desc">Front side with photo and 12-digit UID clearly visible</p>
                  <div class="doc-actions">
                    <input type="file" #aadharFrontInput style="display:none" accept="image/*,application/pdf" (change)="onFileUpload($event, 'aadharDocUrl')">
                    <button type="button" mat-stroked-button color="primary" (click)="aadharFrontInput.click()" [disabled]="uploadingDoc['aadharDocUrl']">
                      <mat-icon *ngIf="!uploadingDoc['aadharDocUrl']">cloud_upload</mat-icon>
                      <mat-icon *ngIf="uploadingDoc['aadharDocUrl']" class="spin-anim">sync</mat-icon>
                      <span>{{ onboardForm.get('aadharDocUrl')?.value ? 'Change Front' : 'Upload Front' }}</span>
                    </button>
                    <a *ngIf="onboardForm.get('aadharDocUrl')?.value" [href]="onboardForm.get('aadharDocUrl')?.value" target="_blank" class="preview-btn">
                      <mat-icon>visibility</mat-icon> Preview
                    </a>
                  </div>
                </div>

                <!-- 3. Aadhaar Back Side -->
                <div class="kyc-upload-card" [class.has-file]="!!onboardForm.get('aadharBackDocUrl')?.value">
                  <div class="doc-header">
                    <mat-icon>flip_to_back</mat-icon>
                    <span class="doc-title">Aadhaar (Back Side)</span>
                    <span class="doc-status" *ngIf="onboardForm.get('aadharBackDocUrl')?.value">ATTACHED</span>
                  </div>
                  <p class="doc-desc">Back side showing registered address &amp; barcode</p>
                  <div class="doc-actions">
                    <input type="file" #aadharBackInput style="display:none" accept="image/*,application/pdf" (change)="onFileUpload($event, 'aadharBackDocUrl')">
                    <button type="button" mat-stroked-button color="primary" (click)="aadharBackInput.click()" [disabled]="uploadingDoc['aadharBackDocUrl']">
                      <mat-icon *ngIf="!uploadingDoc['aadharBackDocUrl']">cloud_upload</mat-icon>
                      <mat-icon *ngIf="uploadingDoc['aadharBackDocUrl']" class="spin-anim">sync</mat-icon>
                      <span>{{ onboardForm.get('aadharBackDocUrl')?.value ? 'Change Back' : 'Upload Back' }}</span>
                    </button>
                    <a *ngIf="onboardForm.get('aadharBackDocUrl')?.value" [href]="onboardForm.get('aadharBackDocUrl')?.value" target="_blank" class="preview-btn">
                      <mat-icon>visibility</mat-icon> Preview
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </mat-card>

        <!-- SECTION D: PAYOUT BANKING & SETTLEMENT -->
        <mat-card class="form-section-card">
          <div class="section-header">
            <div class="section-icon-box green">
              <mat-icon>account_balance</mat-icon>
            </div>
            <div>
              <h2>4. Direct Bank Settlement &amp; Payout Account</h2>
              <p>Direct automated monthly disbursement for streaming and ad revenue settlements</p>
            </div>
          </div>

          <div class="form-grid">
            <div class="grid-col-3">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Bank Name *</mat-label>
                <input matInput formControlName="bankName" placeholder="e.g. HDFC Bank Ltd" required>
                <mat-icon matSuffix>account_balance</mat-icon>
                <mat-error *ngIf="onboardForm.get('bankName')?.hasError('required')">Bank name is required</mat-error>
              </mat-form-field>
            </div>

            <div class="grid-col-3">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Bank Account Number *</mat-label>
                <input matInput formControlName="bankAccountNumber" placeholder="e.g. 50200012345678" required>
                <mat-icon matSuffix>pin</mat-icon>
                <mat-error *ngIf="onboardForm.get('bankAccountNumber')?.hasError('required')">Account number is required</mat-error>
              </mat-form-field>
            </div>

            <div class="grid-col-3">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Bank IFSC Code *</mat-label>
                <input matInput formControlName="ifscCode" placeholder="e.g. HDFC0000240" style="text-transform: uppercase;" required>
                <mat-icon matSuffix>tag</mat-icon>
                <mat-error *ngIf="onboardForm.get('ifscCode')?.hasError('required')">IFSC code is required</mat-error>
              </mat-form-field>
            </div>

            <div class="grid-col-3">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Settlement Payout Account ID *</mat-label>
                <input matInput formControlName="bankAccountPayoutId" placeholder="e.g. PAYOUT-APEX-01" required>
                <mat-icon matSuffix>account_box</mat-icon>
              </mat-form-field>
            </div>

            <!-- CANCELLED CHEQUE / PASSBOOK UPLOAD -->
            <div class="grid-col-12">
              <div class="kyc-uploads-title">
                <mat-icon>receipt_long</mat-icon>
                <span>Upload Settlement Account Verification Document (Cancelled Cheque / Passbook)</span>
              </div>

              <div class="kyc-upload-row single">
                <div class="kyc-upload-card" [class.has-file]="!!onboardForm.get('bankDocUrl')?.value">
                  <div class="doc-header">
                    <mat-icon>receipt_long</mat-icon>
                    <span class="doc-title">Cancelled Cheque or Bank Passbook</span>
                    <span class="doc-status" *ngIf="onboardForm.get('bankDocUrl')?.value">ATTACHED</span>
                  </div>
                  <p class="doc-desc">Upload a signed cancelled cheque or bank statement/passbook displaying the account number &amp; IFSC code for payout verification.</p>
                  <div class="doc-actions">
                    <input type="file" #chequeInput style="display:none" accept="image/*,application/pdf" (change)="onFileUpload($event, 'bankDocUrl')">
                    <button type="button" mat-stroked-button color="primary" (click)="chequeInput.click()" [disabled]="uploadingDoc['bankDocUrl']">
                      <mat-icon *ngIf="!uploadingDoc['bankDocUrl']">cloud_upload</mat-icon>
                      <mat-icon *ngIf="uploadingDoc['bankDocUrl']" class="spin-anim">sync</mat-icon>
                      <span>{{ onboardForm.get('bankDocUrl')?.value ? 'Change Cancelled Cheque' : 'Upload Cancelled Cheque' }}</span>
                    </button>
                    <a *ngIf="onboardForm.get('bankDocUrl')?.value" [href]="onboardForm.get('bankDocUrl')?.value" target="_blank" class="preview-btn">
                      <mat-icon>visibility</mat-icon> Preview
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </mat-card>

        <!-- SECTION E: REVENUE SHARE & CONTRACT TERMS -->
        <mat-card class="form-section-card">
          <div class="section-header">
            <div class="section-icon-box cyan">
              <mat-icon>pie_chart</mat-icon>
            </div>
            <div>
              <h2>5. Revenue Share Split &amp; Master Agreement Terms</h2>
              <p>Configure producer's percentage share of gross OTT streaming and ad impressions revenue</p>
            </div>
          </div>

          <div class="form-grid">
            <div class="grid-col-6">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Studio Net Revenue Share Percentage (%) *</mat-label>
                <input matInput type="number" formControlName="defaultRevenueSharePercentage" min="1" max="95" required>
                <span matSuffix class="suffix-text">% Share</span>
                <mat-icon matSuffix>percent</mat-icon>
                <mat-hint>Platform default is 60.00% net studio payout.</mat-hint>
              </mat-form-field>
            </div>

            <div class="grid-col-6">
              <div class="terms-preview-box">
                <div class="terms-title"><mat-icon>description</mat-icon> Master Distribution &amp; Licensing Terms</div>
                <p>Upon submission, system creates Master Digital Licensing Agreement (30-day payout cycle, ABR transcoding, automated DRM tokenization).</p>
              </div>
            </div>
          </div>
        </mat-card>

        <!-- FORM SUBMIT BUTTONS -->
        <div class="submit-action-bar">
          <button type="button" mat-stroked-button class="cancel-btn" routerLink="/admin/producers">
            <mat-icon>close</mat-icon>
            <span>Cancel</span>
          </button>

          <button type="submit" mat-raised-button color="primary" class="provision-btn" [disabled]="onboardForm.invalid || submitting">
            <mat-icon *ngIf="!submitting">verified_user</mat-icon>
            <mat-icon *ngIf="submitting" class="spin-anim">sync</mat-icon>
            <span>{{ submitting ? 'Provisioning Partner Account...' : 'Complete Onboarding & Provision Studio Partner' }}</span>
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .onboard-page-container {
      max-width: 1240px;
      margin: 0 auto;
      padding-bottom: 48px;
    }

    /* 1. Header Card */
    .header-card {
      background: linear-gradient(135deg, #181826 0%, #11111c 100%);
      border: 1px solid #28283c;
      border-radius: 16px;
      padding: 24px 32px;
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      flex-wrap: wrap;

      .header-left {
        .header-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: 20px;
          background: rgba(0, 210, 255, 0.12);
          color: #00d2ff;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.5px;
          margin-bottom: 8px;

          mat-icon { font-size: 14px; width: 14px; height: 14px; }
        }

        h1 {
          font-size: 26px;
          font-weight: 800;
          margin: 0 0 6px 0;
          color: #ffffff;
          letter-spacing: -0.5px;
        }

        p {
          margin: 0;
          color: #9b9bb2;
          font-size: 13px;
          max-width: 720px;
        }
      }

      .header-actions {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;

        .outline-action-btn {
          color: #ffffff !important;
          border-color: #383852 !important;
          border-radius: 10px;
          font-weight: 600;
        }

        .quick-fill-btn {
          background: rgba(155, 89, 182, 0.15) !important;
          color: #c788ff !important;
          border-color: rgba(155, 89, 182, 0.4) !important;
          border-radius: 10px;
          font-weight: 600;
        }
      }
    }

    /* 2. Receipt Banner */
    .receipt-banner {
      background: linear-gradient(135deg, #0d261a 0%, #102018 100%);
      border: 1px solid #00e676;
      border-radius: 16px;
      padding: 24px 32px;
      margin-bottom: 24px;
      display: flex;
      align-items: flex-start;
      gap: 24px;
      flex-wrap: wrap;
      box-shadow: 0 8px 32px rgba(0, 230, 118, 0.15);

      .receipt-icon {
        width: 52px;
        height: 52px;
        border-radius: 14px;
        background: #00e676;
        color: #000000;
        display: flex;
        align-items: center;
        justify-content: center;
        mat-icon { font-size: 32px; width: 32px; height: 32px; }
      }

      .receipt-details {
        flex: 1;
        min-width: 300px;

        .receipt-title-row {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 4px;

          h3 { font-size: 18px; font-weight: 800; margin: 0; color: #ffffff; }

          .active-badge {
            background: rgba(0, 230, 118, 0.2);
            color: #00e676;
            font-size: 11px;
            font-weight: 700;
            padding: 2px 10px;
            border-radius: 12px;
          }
        }

        .receipt-sub { margin: 0 0 16px 0; color: #a0c0b0; font-size: 13px; }

        .credential-chips {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;

          .chip {
            background: #142820;
            border: 1px solid #204030;
            border-radius: 10px;
            padding: 6px 14px;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;

            .chip-label { color: #80a090; font-weight: 600; font-size: 12px; }
            .chip-val { color: #ffffff; font-weight: 700; }

            &.highlight {
              border-color: #00d2ff;
              background: rgba(0, 210, 255, 0.08);
              .chip-val { color: #00d2ff; }
            }

            &.gold {
              border-color: #ffab00;
              background: rgba(255, 171, 0, 0.08);
              .chip-val { color: #ffab00; }
            }

            button { width: 28px; height: 28px; line-height: 28px; mat-icon { font-size: 16px; width: 16px; height: 16px; color: #80a090; } }
          }
        }
      }

      .receipt-actions {
        display: flex;
        flex-direction: column;
        gap: 10px;
        align-self: center;

        .go-dash-btn {
          background: #00e676 !important;
          color: #000000 !important;
          font-weight: 800;
          border-radius: 10px;
          height: 42px;
        }

        .new-studio-btn {
          color: #ffffff !important;
          border-color: #305040 !important;
          border-radius: 10px;
          height: 42px;
          font-weight: 600;
        }
      }
    }

    /* 3. Section Cards */
    .form-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .form-section-card {
      background: #161624 !important;
      border: 1px solid #28283c;
      border-radius: 16px;
      padding: 24px 28px;
      color: #ffffff;

      .section-header {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 24px;

        .section-icon-box {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          mat-icon { font-size: 24px; width: 24px; height: 24px; }

          &.blue   { background: rgba(0, 210, 255, 0.12); color: #00d2ff; }
          &.purple { background: rgba(155, 89, 182, 0.15); color: #9b59b6; }
          &.gold   { background: rgba(241, 196, 15, 0.12); color: #f1c40f; }
          &.green  { background: rgba(46, 204, 113, 0.12); color: #2ecc71; }
          &.cyan   { background: rgba(0, 230, 118, 0.12); color: #00e676; }
        }

        h2 { font-size: 17px; font-weight: 700; margin: 0 0 2px 0; color: #ffffff; }
        p { font-size: 12px; margin: 0; color: #8e8ea0; }
      }
    }

    /* Grid System */
    .form-grid {
      display: grid;
      grid-template-columns: repeat(12, 1fr);
      gap: 16px;
    }

    .grid-col-12 { grid-column: span 12; }
    .grid-col-6  { grid-column: span 6; }
    .grid-col-4  { grid-column: span 4; }
    .grid-col-3  { grid-column: span 3; }

    @media (max-width: 900px) {
      .grid-col-6, .grid-col-4, .grid-col-3 {
        grid-column: span 12;
      }
    }

    .full-width {
      width: 100%;
    }

    .suffix-text {
      font-weight: 700;
      color: #00e676;
      margin-right: 8px;
    }

    .password-helper-box {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 8px;
      height: 100%;
      padding-bottom: 22px;

      .gen-pass-btn {
        color: #00d2ff !important;
        border-color: rgba(0, 210, 255, 0.3) !important;
        border-radius: 8px;
        font-weight: 600;
        height: 48px;
      }

      .helper-text {
        font-size: 11px;
        color: #7e7e90;
      }
    }

    .terms-preview-box {
      background: #10101a;
      border: 1px dashed #303048;
      border-radius: 12px;
      padding: 14px 18px;

      .terms-title {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 700;
        color: #00d2ff;
        margin-bottom: 4px;
        mat-icon { font-size: 16px; width: 16px; height: 16px; }
      }

      p {
        margin: 0;
        font-size: 12px;
        color: #a0a0b8;
        line-height: 1.4;
      }
    }

    /* KYC Upload Components */
    .kyc-uploads-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 700;
      color: #00d2ff;
      margin: 8px 0 12px 0;
      padding-top: 10px;
      border-top: 1px dashed rgba(255, 255, 255, 0.08);

      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }

    .kyc-upload-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;

      &.single {
        grid-template-columns: 1fr;
      }

      @media (max-width: 900px) {
        grid-template-columns: 1fr;
      }
    }

    .kyc-upload-card {
      background: rgba(0, 0, 0, 0.25);
      border: 1px dashed #34344e;
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      transition: all 0.2s ease;

      &.has-file {
        border-style: solid;
        border-color: rgba(0, 230, 118, 0.4);
        background: rgba(0, 230, 118, 0.04);
      }

      .doc-header {
        display: flex;
        align-items: center;
        gap: 8px;

        mat-icon { font-size: 20px; width: 20px; height: 20px; color: #00d2ff; }
        .doc-title { font-size: 13px; font-weight: 700; color: #ffffff; flex: 1; }
        .doc-status {
          font-size: 10px;
          font-weight: 800;
          padding: 2px 8px;
          border-radius: 4px;
          background: rgba(0, 230, 118, 0.15);
          color: #00e676;
        }
      }

      .doc-desc {
        font-size: 11px;
        color: #8e8ea0;
        margin: 0;
        min-height: 28px;
        line-height: 1.3;
      }

      .doc-actions {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 4px;

        button {
          height: 36px;
          font-size: 12px;
          font-weight: 600;
          border-radius: 8px;
          mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
        }

        .preview-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: #00d2ff;
          text-decoration: none;
          font-weight: 600;
          mat-icon { font-size: 14px; width: 14px; height: 14px; }
          &:hover { text-decoration: underline; }
        }
      }
    }

    /* Submit Action Bar */
    .submit-action-bar {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 16px;
      padding-top: 12px;

      .cancel-btn {
        color: #a0a0b0 !important;
        border-color: #303048 !important;
        height: 48px;
        padding: 0 24px;
        border-radius: 10px;
        font-weight: 600;
      }

      .provision-btn {
        background: linear-gradient(135deg, #1a4cd8 0%, #c725a3 100%) !important;
        color: #ffffff !important;
        height: 48px;
        padding: 0 32px;
        border-radius: 10px;
        font-weight: 800;
        font-size: 14px;
        box-shadow: 0 8px 24px rgba(26, 76, 216, 0.4);

        &:disabled {
          opacity: 0.5;
        }
      }
    }

    .font-mono { font-family: monospace; }
    .text-green { color: #00e676; }

    .spin-anim {
      animation: spin 1s linear infinite;
    }
    @keyframes spin { 100% { transform: rotate(360deg); } }
  `]
})
export class ProducerOnboardingPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  private readonly notificationService = inject(NotificationService);
  private readonly producerApiService = inject(ProducerApiService);
  private readonly router = inject(Router);

  submitting = false;
  showPassword = false;
  showReceiptPassword = false;
  lastProvisionedStudio: ProvisionedStudioReceipt | null = null;
  uploadingDoc: { [key: string]: boolean } = {};

  onboardForm = this.fb.group({
    studioName: ['', [Validators.required]],
    studioRegistrationNumber: ['', [Validators.required]],
    businessType: ['PRIVATE_LIMITED', [Validators.required]],
    contactEmail: ['', [Validators.required, Validators.email]],
    contactPhone: ['', [Validators.required]],
    loginPassword: ['ProducerPass#2026', [Validators.required]],
    panNumber: ['', [Validators.required]],
    panDocUrl: [''],
    gstNumber: ['', [Validators.required]],
    gstDocUrl: [''],
    aadharNumber: [''],
    aadharDocUrl: [''],
    aadharBackDocUrl: [''],
    bankName: ['', [Validators.required]],
    bankAccountNumber: ['', [Validators.required]],
    ifscCode: ['', [Validators.required]],
    bankDocUrl: [''],
    bankAccountPayoutId: ['', [Validators.required]],
    defaultRevenueSharePercentage: [60.0, [Validators.required, Validators.min(1), Validators.max(95)]]
  });

  ngOnInit(): void {
    this.generateRegistrationAndPayoutIds();
  }

  generateRegistrationAndPayoutIds(): void {
    const rand = Math.floor(1000 + Math.random() * 9000);
    this.onboardForm.patchValue({
      studioRegistrationNumber: 'REG-STUDIO-' + rand,
      bankAccountPayoutId: 'PAYOUT-STUDIO-' + rand
    });
  }

  generateRandomPassword(): void {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let pass = 'Pass#';
    for (let i = 0; i < 7; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.onboardForm.patchValue({ loginPassword: pass });
    this.showPassword = true;
    this.notificationService.info('Generated new secure password: ' + pass);
  }

  populateSampleData(): void {
    const randomId = Math.floor(100 + Math.random() * 900);
    this.onboardForm.patchValue({
      studioName: `Cinematic Horizons Studio ${randomId}`,
      studioRegistrationNumber: `U74999TG2026PTC${randomId}`,
      businessType: 'PRIVATE_LIMITED',
      contactEmail: `partner${randomId}@cinematichorizons.tv`,
      contactPhone: '9876543210',
      loginPassword: `ProducerPass#${randomId}`,
      panNumber: `ABCDE${randomId}F`,
      panDocUrl: `https://cdn.maxxpixels.com/kyc/sample-pan-${randomId}.pdf`,
      gstNumber: `36ABCDE${randomId}F1Z5`,
      gstDocUrl: `https://cdn.maxxpixels.com/kyc/sample-gst-${randomId}.pdf`,
      aadharNumber: `8899112233${randomId % 100}`,
      aadharDocUrl: `https://cdn.maxxpixels.com/kyc/sample-aadhar-front-${randomId}.jpg`,
      aadharBackDocUrl: `https://cdn.maxxpixels.com/kyc/sample-aadhar-back-${randomId}.jpg`,
      bankName: 'HDFC Bank Ltd',
      bankAccountNumber: `502000${randomId}8910`,
      ifscCode: 'HDFC0000240',
      bankDocUrl: `https://cdn.maxxpixels.com/kyc/sample-cancelled-cheque-${randomId}.pdf`,
      bankAccountPayoutId: `BANK-PAYOUT-${randomId}`,
      defaultRevenueSharePercentage: 60.0
    });
    this.notificationService.success('Populated form with realistic studio legal, banking details & sample KYC docs!');
  }

  onFileUpload(event: Event, field: string): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    this.uploadingDoc[field] = true;

    this.producerApiService.uploadKycFile(file).subscribe({
      next: (res) => {
        this.uploadingDoc[field] = false;
        const url = res.data?.url || res.data?.fileUrl;
        if (url) {
          this.onboardForm.patchValue({ [field]: url });
          this.notificationService.success(`Document uploaded successfully!`);
        } else {
          this.notificationService.error('Upload completed but URL not received.');
        }
      },
      error: (err) => {
        this.uploadingDoc[field] = false;
        this.notificationService.error(err?.error?.message || 'Failed to upload document.');
      }
    });
  }

  resetForm(): void {
    this.lastProvisionedStudio = null;
    this.onboardForm.reset({
      studioName: '',
      studioRegistrationNumber: '',
      businessType: 'PRIVATE_LIMITED',
      contactEmail: '',
      contactPhone: '',
      loginPassword: 'Producer@2026',
      panNumber: '',
      panDocUrl: '',
      gstNumber: '',
      gstDocUrl: '',
      aadharNumber: '',
      aadharDocUrl: '',
      aadharBackDocUrl: '',
      bankName: '',
      bankAccountNumber: '',
      ifscCode: '',
      bankDocUrl: '',
      bankAccountPayoutId: '',
      defaultRevenueSharePercentage: 60.0
    });
    this.generateRegistrationAndPayoutIds();
  }

  onSubmit(): void {
    if (this.onboardForm.invalid) {
      this.notificationService.warning('Please complete all mandatory required fields.');
      this.onboardForm.markAllAsTouched();
      return;
    }

    this.submitting = true;
    const formVals = this.onboardForm.value as any;

    const payload = {
      ...formVals,
      companyName: formVals.studioName,
      company_name: formVals.studioName,
      fullName: formVals.studioName,
      name: formVals.studioName,
      email: formVals.contactEmail,
      phoneNumber: formVals.contactPhone,
      phone_number: formVals.contactPhone
    };

    this.http.post<any>(`${environment.apiBaseUrl}/admin/producers/onboard`, payload).subscribe({
      next: (res) => {
        this.submitting = false;
        if (res.success && res.data) {
          const data = res.data;
          this.lastProvisionedStudio = {
            id: data.id,
            studioName: formVals.studioName,
            contactEmail: formVals.contactEmail,
            loginPassword: formVals.loginPassword,
            revenueShare: formVals.defaultRevenueSharePercentage,
            status: data.status || 'APPROVED',
            payoutId: formVals.bankAccountPayoutId
          };
          this.notificationService.success(`Studio "${formVals.studioName}" onboarded! Account provisioned.`);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          this.notificationService.error(res.message || 'Failed to onboard producer studio.');
        }
      },
      error: (err) => {
        this.submitting = false;
        this.notificationService.error(err?.error?.message || 'Error occurred while onboarding producer studio.');
      }
    });
  }

  openStudioDashboard(producerId: number): void {
    this.router.navigate(['/producer/dashboard'], { queryParams: { producerId } });
  }

  copyToClipboard(text: string, label: string): void {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        this.notificationService.success(`${label} copied to clipboard!`);
      });
    }
  }
}
