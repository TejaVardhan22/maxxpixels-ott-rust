import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule } from '@angular/material/dialog';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { NotificationService } from '../../shared/services/notification.service';
import { ProducerApiService, ProducerSubmission, ProducerOnboardingProfile } from '../../core/services/producer-api.service';

@Component({
  selector: 'app-producer-reviews-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatDialogModule,
    StatusBadgeComponent,
    RouterModule
  ],
  template: `
    <div class="page-container">
      <!-- 1. EXECUTIVE TITLE -->
      <div class="header-row">
        <div>
          <span class="category-tag"><mat-icon>fact_check</mat-icon> PRODUCER ONBOARDING & CONTENT SCREENING</span>
          <h1>Producer Reviews & Approvals Center</h1>
          <p>Review producer KYC identity verifications (PAN, Aadhaar, GST, Bank) and approve/reject content submissions</p>
        </div>
        <div class="header-actions">
          <button mat-stroked-button class="refresh-btn" (click)="refreshAll()">
            <mat-icon>refresh</mat-icon> Refresh Queue
          </button>
        </div>
      </div>

      <!-- 2. TOP QUEUE SELECTION TABS -->
      <div class="queue-tab-bar">
        <button class="queue-tab" [class.active]="activeQueue === 'KYC'" (click)="setQueue('KYC')">
          <mat-icon>shield</mat-icon>
          <span>Producer KYC Onboarding Requests</span>
          <span class="badge red-badge" *ngIf="pendingKycCount > 0">{{ pendingKycCount }}</span>
        </button>

        <button class="queue-tab" [class.active]="activeQueue === 'CONTENT'" (click)="setQueue('CONTENT')">
          <mat-icon>video_library</mat-icon>
          <span>Content Submissions Queue</span>
          <span class="badge blue-badge" *ngIf="pendingContentCount > 0">{{ pendingContentCount }}</span>
        </button>
      </div>

      <!-- 3. KPI METRICS CARDS FOR KYC QUEUE -->
      <div class="kpi-grid" *ngIf="activeQueue === 'KYC'">
        <div class="kpi-card purple">
          <div class="kpi-icon"><mat-icon>business</mat-icon></div>
          <div>
            <span class="kpi-label">Total KYC Applications</span>
            <div class="kpi-val">{{ kycOnboardings.length }} Studios</div>
          </div>
        </div>

        <div class="kpi-card gold">
          <div class="kpi-icon"><mat-icon>pending_actions</mat-icon></div>
          <div>
            <span class="kpi-label">Pending Verification</span>
            <div class="kpi-val">{{ pendingKycCount }} In Review</div>
          </div>
        </div>

        <div class="kpi-card green">
          <div class="kpi-icon"><mat-icon>verified_user</mat-icon></div>
          <div>
            <span class="kpi-label">Approved Producer Partners</span>
            <div class="kpi-val text-green">{{ getKycCountByStatus('APPROVED') }} Verified</div>
          </div>
        </div>

        <div class="kpi-card red">
          <div class="kpi-icon"><mat-icon>gavel</mat-icon></div>
          <div>
            <span class="kpi-label">Rejected Applications</span>
            <div class="kpi-val text-red">{{ getKycCountByStatus('REJECTED') }} Rejected</div>
          </div>
        </div>
      </div>

      <!-- KPI METRICS CARDS FOR CONTENT QUEUE -->
      <div class="kpi-grid" *ngIf="activeQueue === 'CONTENT'">
        <div class="kpi-card purple">
          <div class="kpi-icon"><mat-icon>video_library</mat-icon></div>
          <div>
            <span class="kpi-label">Total Submissions</span>
            <div class="kpi-val">{{ allSubmissions.length }} Titles</div>
          </div>
        </div>

        <div class="kpi-card gold">
          <div class="kpi-icon"><mat-icon>pending_actions</mat-icon></div>
          <div>
            <span class="kpi-label">Pending Approval</span>
            <div class="kpi-val">{{ getCountByStatus('SUBMITTED') }} In Review</div>
          </div>
        </div>

        <div class="kpi-card green">
          <div class="kpi-icon"><mat-icon>task_alt</mat-icon></div>
          <div>
            <span class="kpi-label">Approved & Published</span>
            <div class="kpi-val text-green">{{ getCountByStatus('APPROVED') + getCountByStatus('PUBLISHED') }} Live/Queued</div>
          </div>
        </div>

        <div class="kpi-card red">
          <div class="kpi-icon"><mat-icon>cancel</mat-icon></div>
          <div>
            <span class="kpi-label">Rejected Assets</span>
            <div class="kpi-val text-red">{{ getCountByStatus('REJECTED') }} Purged</div>
          </div>
        </div>
      </div>

      <!-- FILTER BAR -->
      <div class="filter-bar">
        <div class="search-box">
          <mat-icon class="search-icon">search</mat-icon>
          <input type="text" [(ngModel)]="searchQuery" (input)="applyFilters()" placeholder="Search studio, PAN, Aadhaar, title, email...">
        </div>
      </div>

      <!-- QUEUE 1: PRODUCER KYC ONBOARDING REQUESTS TABLE -->
      <div class="table-card" *ngIf="activeQueue === 'KYC'">
        <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

        <div class="table-responsive">
          <table mat-table [dataSource]="filteredKycOnboardings" class="submissions-table">
          <!-- Studio Name & Registration -->
          <ng-container matColumnDef="studio">
            <th mat-header-cell *matHeaderCellDef>Studio & Registration</th>
            <td mat-cell *matCellDef="let row">
              <div class="studio-cell">
                <span class="studio-name">{{ row.studioName || row.companyName }}</span>
                <span class="studio-reg font-mono">{{ row.studioRegistrationNumber || row.businessType || 'CIN-PROD-2026' }}</span>
                <span class="contact-text">{{ row.contactEmail }} | {{ row.contactPhone }}</span>
              </div>
            </td>
          </ng-container>

          <!-- PAN Verification -->
          <ng-container matColumnDef="pan">
            <th mat-header-cell *matHeaderCellDef>PAN Verification</th>
            <td mat-cell *matCellDef="let row">
              <div class="kyc-col">
                <span class="kyc-num font-mono" *ngIf="row.panNumber">{{ row.panNumber }}</span>
                <span class="kyc-num not-provided" *ngIf="!row.panNumber">Not provided</span>
                <span class="ver-badge" [class.ver-ok]="row.panStatus === 'VERIFIED' || row.panStatus === 'APPROVED'">{{ row.panStatus || 'PENDING' }}</span>
                <button *ngIf="row.panDocUrl" mat-stroked-button class="doc-btn-compact" (click)="openDocPreview(row.panDocUrl, 'PAN Card - ' + (row.studioName || row.companyName))">
                  <mat-icon>file_present</mat-icon> Inspect PAN
                </button>
                <span *ngIf="!row.panDocUrl" class="missing-pill">No PAN Doc</span>
              </div>
            </td>
          </ng-container>

          <!-- Aadhar Verification -->
          <ng-container matColumnDef="aadhar">
            <th mat-header-cell *matHeaderCellDef>Aadhaar Verification</th>
            <td mat-cell *matCellDef="let row">
              <div class="kyc-col">
                <span class="kyc-num font-mono" *ngIf="row.aadharNumber">{{ row.aadharNumber }}</span>
                <span class="kyc-num not-provided" *ngIf="!row.aadharNumber">Not provided</span>
                <span class="ver-badge" [class.ver-ok]="row.aadharStatus === 'VERIFIED' || row.aadharStatus === 'APPROVED'">{{ row.aadharStatus || 'PENDING' }}</span>
                <div class="doc-links-stack" style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 2px;">
                  <button *ngIf="row.aadharDocUrl" mat-stroked-button class="doc-btn-compact" (click)="openDocPreview(row.aadharDocUrl, 'Aadhaar (Front Side) - ' + (row.studioName || row.companyName))">
                    <mat-icon>credit_card</mat-icon> Front
                  </button>
                  <span *ngIf="!row.aadharDocUrl" class="missing-pill">Front Missing</span>

                  <button *ngIf="row.aadharBackDocUrl" mat-stroked-button class="doc-btn-compact" (click)="openDocPreview(row.aadharBackDocUrl, 'Aadhaar (Back Side) - ' + (row.studioName || row.companyName))">
                    <mat-icon>flip_to_back</mat-icon> Back
                  </button>
                  <span *ngIf="!row.aadharBackDocUrl" class="missing-pill">Back Missing</span>
                </div>
              </div>
            </td>
          </ng-container>

          <!-- Bank & IFSC Details -->
          <ng-container matColumnDef="bank">
            <th mat-header-cell *matHeaderCellDef>Settlement Bank &amp; Cheque</th>
            <td mat-cell *matCellDef="let row">
              <div class="kyc-col">
                <span class="bank-name">{{ row.bankName || 'Payout Bank' }}</span>
                <span class="kyc-num font-mono" *ngIf="row.bankAccountNumber">Acc: {{ row.bankAccountNumber }}</span>
                <span class="ifsc font-mono" *ngIf="row.ifscCode">IFSC: {{ row.ifscCode }}</span>
                <button *ngIf="row.bankDocUrl" mat-stroked-button class="doc-btn-compact" (click)="openDocPreview(row.bankDocUrl, 'Cancelled Cheque / Passbook - ' + (row.studioName || row.companyName))">
                  <mat-icon>receipt_long</mat-icon> Cheque / Passbook
                </button>
                <span *ngIf="!row.bankDocUrl" class="missing-pill">Cheque Missing</span>
              </div>
            </td>
          </ng-container>

          <!-- Status Column -->
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>KYC Status</th>
            <td mat-cell *matCellDef="let row">
              <app-status-badge [status]="row.onboardingStatus || 'PENDING'"></app-status-badge>
              <div class="review-notes" *ngIf="row.rejectionReason">
                <small class="text-red">Reason: {{ row.rejectionReason }}</small>
              </div>
            </td>
          </ng-container>

          <!-- Actions Column -->
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>Admin KYC Actions</th>
            <td mat-cell *matCellDef="let row">
              <div class="actions-cell">
                <button
                  mat-stroked-button
                  color="accent"
                  class="action-btn view-btn"
                  (click)="openProducerDetailsModal(row)"
                  matTooltip="View Complete Producer Profile & KYC Verification Details">
                  <mat-icon>visibility</mat-icon> Details
                </button>

                <button
                  mat-raised-button
                  color="primary"
                  class="action-btn approve-btn"
                  *ngIf="row.onboardingStatus !== 'APPROVED'"
                  (click)="approveKyc(row)"
                  matTooltip="Approve producer KYC documents & grant publishing clearance">
                  <mat-icon>verified</mat-icon> Approve
                </button>

                <button
                  mat-stroked-button
                  color="warn"
                  class="action-btn reject-btn"
                  *ngIf="row.onboardingStatus !== 'REJECTED'"
                  (click)="rejectKyc(row)"
                  matTooltip="Reject producer onboarding KYC">
                  <mat-icon>close</mat-icon> Reject
                </button>

                <span *ngIf="row.onboardingStatus === 'APPROVED'" class="approved-label">
                  <mat-icon>verified_user</mat-icon> Verified
                </span>
              </div>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="kycDisplayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: kycDisplayedColumns;"></tr>

          <tr class="mat-row" *matNoDataRow>
            <td class="mat-cell empty-cell" [attr.colspan]="kycDisplayedColumns.length">
              <div class="empty-state">
                <mat-icon>shield</mat-icon>
                <p>No producer KYC onboarding requests found matching your query.</p>
              </div>
            </td>
          </tr>
          </table>
        </div>
      </div>

      <!-- QUEUE 2: CONTENT SUBMISSIONS TABLE -->
      <div class="table-card" *ngIf="activeQueue === 'CONTENT'">
        <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

        <div class="table-responsive">
          <table mat-table [dataSource]="filteredSubmissions" class="submissions-table">
          <!-- Poster / Icon Column -->
          <ng-container matColumnDef="media">
            <th mat-header-cell *matHeaderCellDef>Media</th>
            <td mat-cell *matCellDef="let row">
              <div class="media-cell">
                <img *ngIf="row.posterUrl; else placeholderIcon" [src]="row.posterUrl" [alt]="row.title" class="poster-thumb">
                <ng-template #placeholderIcon>
                  <div class="poster-placeholder">
                    <mat-icon>movie</mat-icon>
                  </div>
                </ng-template>
              </div>
            </td>
          </ng-container>

          <!-- Title & Metadata -->
          <ng-container matColumnDef="title">
            <th mat-header-cell *matHeaderCellDef>Title & Description</th>
            <td mat-cell *matCellDef="let row">
              <div class="title-cell">
                <div class="title-text">{{ row.title }}</div>
                <div class="desc-text">{{ row.oneLineBrief || row.description || 'No description provided.' }}</div>
                <div class="meta-chips">
                  <span class="type-tag">{{ row.contentType }}</span>
                  <span class="lang-tag" *ngIf="row.language">{{ row.language }}</span>
                  <span class="source-tag" *ngIf="row.submissionSource === 'public_producer'">Public Submission</span>
                  <span class="rev-tag" *ngIf="row.revenueSharePercentage">{{ row.revenueSharePercentage }}% Revenue Share</span>
                </div>
                <div class="extra-details" *ngIf="row.submissionSource === 'public_producer'">
                  <div class="detail-row" *ngIf="row.productionName"><mat-icon>business</mat-icon> {{ row.productionName }}</div>
                  <div class="detail-row" *ngIf="row.producerContactPhone"><mat-icon>phone</mat-icon> {{ row.producerContactPhone }}</div>
                  <div class="detail-row" *ngIf="row.producerEmail"><mat-icon>email</mat-icon> {{ row.producerEmail }}</div>
                  <div class="detail-row" *ngIf="row.googleDriveLink"><mat-icon>cloud</mat-icon> <a [href]="row.googleDriveLink" target="_blank">Google Drive Link</a></div>
                  <div class="detail-row" *ngIf="row.poster2Url"><mat-icon>image</mat-icon> <a [href]="row.poster2Url" target="_blank">Poster 2</a></div>
                  <div class="detail-row" *ngIf="row.trailerUrl"><mat-icon>play_circle</mat-icon> <a [href]="row.trailerUrl" target="_blank">Trailer</a></div>
                  <div class="detail-row" *ngIf="row.expiresAt"><mat-icon>schedule</mat-icon> Expires: {{ row.expiresAt | date:'medium' }}</div>
                  <div class="detail-row" *ngIf="row.agreementStatus"><mat-icon>description</mat-icon> Agreement: {{ row.agreementStatus }}</div>
                </div>
              </div>
            </td>
          </ng-container>

          <!-- Producer / Studio Info -->
          <ng-container matColumnDef="producer">
            <th mat-header-cell *matHeaderCellDef>Producer / Studio</th>
            <td mat-cell *matCellDef="let row">
              <div class="producer-cell">
                <span class="studio-name">{{ row.producerName || 'Producer #' + (row.producerId || 'N/A') }}</span>
                <span class="producer-email">{{ row.producerEmail || 'Studio Account' }}</span>
              </div>
            </td>
          </ng-container>

          <!-- Master Video Asset S3 URL -->
          <ng-container matColumnDef="rawVideo">
            <th mat-header-cell *matHeaderCellDef>Raw Master Video</th>
            <td mat-cell *matCellDef="let row">
              <div class="video-link-box" *ngIf="row.rawVideoUrl">
                <button mat-stroked-button class="preview-video-btn" (click)="openVideoPreview(row)" matTooltip="Play & preview submission video">
                  <mat-icon>play_circle</mat-icon> Preview
                </button>
                <button mat-icon-button class="copy-btn" (click)="copyUrl(row.rawVideoUrl)" matTooltip="Copy Raw Video URL">
                  <mat-icon>content_copy</mat-icon>
                </button>
              </div>
              <span *ngIf="!row.rawVideoUrl" class="text-muted">No raw video URL</span>
            </td>
          </ng-container>

          <!-- Status Column -->
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let row">
              <app-status-badge [status]="row.status"></app-status-badge>
              <div class="review-notes" *ngIf="row.reviewNotes">
                <small>{{ row.reviewNotes }}</small>
              </div>
            </td>
          </ng-container>

          <!-- Actions Column -->
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>Admin Actions</th>
            <td mat-cell *matCellDef="let row">
              <div class="actions-cell">
                <button
                  mat-raised-button
                  color="primary"
                  class="action-btn approve-btn"
                  *ngIf="isPendingContent(row)"
                  (click)="approveContent(row)"
                  matTooltip="Approve and publish this title">
                  <mat-icon>check</mat-icon> Approve & Publish
                </button>

                <button
                  mat-stroked-button
                  color="accent"
                  class="action-btn"
                  *ngIf="isPendingContent(row) && row.submissionSource === 'public_producer'"
                  (click)="shareAgreement(row)"
                  matTooltip="Share agreement with producer for signature">
                  <mat-icon>description</mat-icon> Share Agreement
                </button>

                <button
                  mat-stroked-button
                  color="warn"
                  class="action-btn reject-btn"
                  *ngIf="isPendingContent(row)"
                  (click)="rejectContent(row)"
                  matTooltip="Reject submission">
                  <mat-icon>close</mat-icon> Reject
                </button>

                <span *ngIf="row.status === 'AGREEMENT_SHARED'" class="agreement-label">
                  <mat-icon>pending</mat-icon> Awaiting Signed Agreement
                </span>

                <button
                  mat-raised-button
                  color="primary"
                  class="action-btn approve-btn"
                  *ngIf="row.status === 'AGREEMENT_SHARED'"
                  (click)="publishAfterAgreement(row)"
                  matTooltip="Publish content after signed agreement is uploaded">
                  <mat-icon>publish</mat-icon> Publish After Agreement
                </button>

                <span *ngIf="row.status === 'APPROVED' || row.status === 'PUBLISHED'" class="approved-label">
                  <mat-icon>verified</mat-icon> Approved
                </span>

                <span *ngIf="row.status === 'REJECTED'" class="rejected-label">
                  <mat-icon>block</mat-icon> Rejected
                </span>
              </div>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="contentDisplayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: contentDisplayedColumns;"></tr>

          <tr class="mat-row" *matNoDataRow>
            <td class="mat-cell empty-cell" [attr.colspan]="contentDisplayedColumns.length">
              <div class="empty-state">
                <mat-icon>inbox</mat-icon>
                <p>No content submissions found for the selected filter.</p>
              </div>
            </td>
          </tr>
          </table>
        </div>
      </div>

      <!-- PRODUCER KYC DETAILS MODAL -->
      <div class="modal-backdrop" *ngIf="selectedProducer" (click)="closeProducerDetailsModal()">
        <div class="modal-card detail-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div class="header-icon-box"><mat-icon>business</mat-icon></div>
            <div>
              <h2>{{ selectedProducer.studioName || selectedProducer.companyName }}</h2>
              <p>Studio Reg: <span class="font-mono">{{ selectedProducer.studioRegistrationNumber || selectedProducer.businessType || 'CIN-PROD-2026' }}</span></p>
            </div>
            <div class="header-status-box">
              <app-status-badge [status]="selectedProducer.onboardingStatus || 'PENDING'"></app-status-badge>
              <button mat-icon-button (click)="closeProducerDetailsModal()" class="close-btn"><mat-icon>close</mat-icon></button>
            </div>
          </div>

          <div class="modal-body detail-body">
            <!-- Contact & Account Section -->
            <div class="detail-section">
              <h3><mat-icon>person</mat-icon> Account & Contact Info</h3>
              <div class="detail-grid">
                <div class="info-item"><label>Contact Email:</label><span>{{ selectedProducer.contactEmail }}</span></div>
                <div class="info-item"><label>Contact Phone:</label><span>{{ selectedProducer.contactPhone || 'N/A' }}</span></div>
                <div class="info-item"><label>GST / Tax ID:</label><span class="font-mono">{{ selectedProducer.gstNumber || selectedProducer.taxId || 'N/A' }}</span></div>
                <div class="info-item"><label>Revenue Share:</label><span>{{ selectedProducer.defaultRevenueSharePercentage || 70 }}%</span></div>
              </div>
            </div>

            <!-- Identity KYC Documents -->
            <div class="detail-section">
              <h3><mat-icon>badge</mat-icon> Statutory &amp; Identity Verification (KYC Proofs)</h3>
              <div class="kyc-cards-grid">
                <!-- PAN -->
                <div class="kyc-card-box">
                  <div class="box-title">
                    <div class="title-with-icon">
                      <mat-icon>badge</mat-icon>
                      <span>PAN Card Proof</span>
                    </div>
                    <span class="ver-badge" [class.ver-ok]="selectedProducer.panStatus === 'VERIFIED' || selectedProducer.panStatus === 'APPROVED'">
                      {{ selectedProducer.panStatus || 'PENDING' }}
                    </span>
                  </div>
                  <div class="box-val font-mono">{{ selectedProducer.panNumber || 'Not provided' }}</div>
                  <div class="doc-box-actions">
                    <button *ngIf="selectedProducer.panDocUrl" mat-stroked-button color="primary" class="doc-btn" (click)="openDocPreview(selectedProducer.panDocUrl, 'PAN Card - ' + (selectedProducer.studioName || selectedProducer.companyName))">
                      <mat-icon>visibility</mat-icon> Inspect PAN Card
                    </button>
                    <a *ngIf="selectedProducer.panDocUrl" [href]="selectedProducer.panDocUrl" target="_blank" class="ext-icon-btn" matTooltip="Open in new window">
                      <mat-icon>open_in_new</mat-icon>
                    </a>
                    <span *ngIf="!selectedProducer.panDocUrl" class="missing-warning">
                      <mat-icon>warning_amber</mat-icon> Proof Not Uploaded
                    </span>
                    <button *ngIf="selectedProducer.panStatus !== 'VERIFIED'" mat-stroked-button class="verify-chip-btn" (click)="verifySingleDoc(selectedProducer, 'PAN')">
                      <mat-icon>check_circle</mat-icon> Verify PAN
                    </button>
                  </div>
                </div>

                <!-- Aadhaar -->
                <div class="kyc-card-box">
                  <div class="box-title">
                    <div class="title-with-icon">
                      <mat-icon>credit_card</mat-icon>
                      <span>Aadhaar Identity Proof</span>
                    </div>
                    <span class="ver-badge" [class.ver-ok]="selectedProducer.aadharStatus === 'VERIFIED' || selectedProducer.aadharStatus === 'APPROVED'">
                      {{ selectedProducer.aadharStatus || 'PENDING' }}
                    </span>
                  </div>
                  <div class="box-val font-mono">{{ selectedProducer.aadharNumber || 'Not provided' }}</div>
                  <div class="doc-box-actions-stack">
                    <div class="doc-row-item">
                      <span class="side-lbl">Front Side:</span>
                      <button *ngIf="selectedProducer.aadharDocUrl" mat-stroked-button class="doc-btn" (click)="openDocPreview(selectedProducer.aadharDocUrl, 'Aadhaar (Front Side) - ' + (selectedProducer.studioName || selectedProducer.companyName))">
                        <mat-icon>visibility</mat-icon> Inspect Front
                      </button>
                      <a *ngIf="selectedProducer.aadharDocUrl" [href]="selectedProducer.aadharDocUrl" target="_blank" class="ext-icon-btn"><mat-icon>open_in_new</mat-icon></a>
                      <span *ngIf="!selectedProducer.aadharDocUrl" class="missing-warning">Front Missing</span>
                    </div>
                    <div class="doc-row-item">
                      <span class="side-lbl">Back Side:</span>
                      <button *ngIf="selectedProducer.aadharBackDocUrl" mat-stroked-button class="doc-btn" (click)="openDocPreview(selectedProducer.aadharBackDocUrl, 'Aadhaar (Back Side) - ' + (selectedProducer.studioName || selectedProducer.companyName))">
                        <mat-icon>visibility</mat-icon> Inspect Back
                      </button>
                      <a *ngIf="selectedProducer.aadharBackDocUrl" [href]="selectedProducer.aadharBackDocUrl" target="_blank" class="ext-icon-btn"><mat-icon>open_in_new</mat-icon></a>
                      <span *ngIf="!selectedProducer.aadharBackDocUrl" class="missing-warning">Back Missing</span>
                    </div>
                    <button *ngIf="selectedProducer.aadharStatus !== 'VERIFIED'" mat-stroked-button class="verify-chip-btn" (click)="verifySingleDoc(selectedProducer, 'AADHAAR')">
                      <mat-icon>check_circle</mat-icon> Verify Aadhaar
                    </button>
                  </div>
                </div>

                <!-- GST -->
                <div class="kyc-card-box">
                  <div class="box-title">
                    <div class="title-with-icon">
                      <mat-icon>verified_user</mat-icon>
                      <span>GST Registration</span>
                    </div>
                    <span class="ver-badge" [class.ver-ok]="selectedProducer.gstStatus === 'VERIFIED' || selectedProducer.gstStatus === 'APPROVED'">
                      {{ selectedProducer.gstStatus || 'VERIFIED' }}
                    </span>
                  </div>
                  <div class="box-val font-mono">{{ selectedProducer.gstNumber || 'Not provided' }}</div>
                  <div class="doc-box-actions">
                    <button *ngIf="selectedProducer.gstDocUrl" mat-stroked-button class="doc-btn" (click)="openDocPreview(selectedProducer.gstDocUrl, 'GST Certificate - ' + (selectedProducer.studioName || selectedProducer.companyName))">
                      <mat-icon>visibility</mat-icon> Inspect GST
                    </button>
                    <a *ngIf="selectedProducer.gstDocUrl" [href]="selectedProducer.gstDocUrl" target="_blank" class="ext-icon-btn"><mat-icon>open_in_new</mat-icon></a>
                    <span *ngIf="!selectedProducer.gstDocUrl" class="missing-warning">Certificate Not Uploaded</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Bank & Payout -->
            <div class="detail-section">
              <h3><mat-icon>account_balance</mat-icon> Bank Payout Account &amp; Cancelled Cheque</h3>
              <div class="detail-grid">
                <div class="info-item"><label>Bank Name:</label><span>{{ selectedProducer.bankName || 'N/A' }}</span></div>
                <div class="info-item"><label>Account Number:</label><span class="font-mono">{{ selectedProducer.bankAccountNumber || 'N/A' }}</span></div>
                <div class="info-item"><label>IFSC Code:</label><span class="font-mono">{{ selectedProducer.ifscCode || 'N/A' }}</span></div>
                <div class="info-item"><label>Bank Status:</label>
                  <span class="ver-badge" [class.ver-ok]="selectedProducer.bankStatus === 'VERIFIED' || selectedProducer.bankStatus === 'APPROVED'">{{ selectedProducer.bankStatus || 'PENDING' }}</span>
                </div>
              </div>
              <div class="doc-box-actions" style="margin-top: 12px;">
                <button *ngIf="selectedProducer.bankDocUrl" mat-stroked-button color="primary" class="doc-btn" (click)="openDocPreview(selectedProducer.bankDocUrl, 'Cancelled Cheque - ' + (selectedProducer.studioName || selectedProducer.companyName))">
                  <mat-icon>visibility</mat-icon> Inspect Cancelled Cheque / Passbook
                </button>
                <a *ngIf="selectedProducer.bankDocUrl" [href]="selectedProducer.bankDocUrl" target="_blank" class="ext-icon-btn"><mat-icon>open_in_new</mat-icon></a>
                <span *ngIf="!selectedProducer.bankDocUrl" class="missing-warning"><mat-icon>warning_amber</mat-icon> Cancelled Cheque Not Uploaded</span>
                <button *ngIf="selectedProducer.bankStatus !== 'VERIFIED'" mat-stroked-button class="verify-chip-btn" (click)="verifySingleDoc(selectedProducer, 'BANK')">
                  <mat-icon>check_circle</mat-icon> Verify Bank
                </button>
              </div>
            </div>

            <!-- Agreement Details -->
            <div class="detail-section" *ngIf="selectedProducer.signedAgreementUrl || selectedProducer.agreementStatus">
              <h3><mat-icon>description</mat-icon> Master Distribution &amp; Licensing Agreement</h3>
              <div class="detail-grid">
                <div class="info-item"><label>Agreement Status:</label><span class="font-mono text-cyan">{{ selectedProducer.agreementStatus || 'APPROVED' }}</span></div>
                <div class="info-item" *ngIf="selectedProducer.signedAgreementUrl"><label>Signed Agreement:</label>
                  <button mat-stroked-button class="doc-btn" (click)="openDocPreview(selectedProducer.signedAgreementUrl, 'Master Agreement - ' + (selectedProducer.studioName || selectedProducer.companyName))">
                    <mat-icon>visibility</mat-icon> Inspect Agreement
                  </button>
                </div>
              </div>
            </div>

            <!-- Rejection Note -->
            <div class="detail-section rejection-section" *ngIf="selectedProducer.rejectionReason">
              <h3><mat-icon color="warn">warning</mat-icon> Rejection Reason</h3>
              <p class="rejection-text">{{ selectedProducer.rejectionReason }}</p>
            </div>
          </div>

          <div class="modal-footer">
            <button mat-button (click)="closeProducerDetailsModal()">Close</button>
            <button mat-raised-button color="primary" *ngIf="selectedProducer.onboardingStatus !== 'APPROVED'" (click)="approveKyc(selectedProducer); closeProducerDetailsModal();">
              <mat-icon>verified</mat-icon> Approve All KYC &amp; Authorize Studio
            </button>
            <button mat-stroked-button color="warn" *ngIf="selectedProducer.onboardingStatus !== 'REJECTED'" (click)="rejectKyc(selectedProducer); closeProducerDetailsModal();">
              <mat-icon>close</mat-icon> Reject Application
            </button>
            <button mat-stroked-button color="accent" *ngIf="selectedProducer.onboardingStatus === 'APPROVED'" (click)="generateProducerCredentials(selectedProducer)">
              <mat-icon>vpn_key</mat-icon> Generate Login Credentials
            </button>
          </div>
        </div>
      </div>

      <!-- DOCUMENT LIGHTBOX PREVIEW MODAL -->
      <div class="modal-backdrop" *ngIf="previewDocUrl" (click)="closeDocPreview()">
        <div class="modal-card doc-preview-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div class="header-icon-box"><mat-icon>visibility</mat-icon></div>
            <div>
              <h2>{{ previewDocTitle || 'Verification Document Preview' }}</h2>
              <p>Studio Partner: <strong>{{ selectedProducer?.studioName || selectedProducer?.companyName }}</strong></p>
            </div>
            <div class="header-status-box">
              <a [href]="previewDocUrl" target="_blank" class="ext-link-btn" mat-stroked-button>
                <mat-icon>open_in_new</mat-icon> Full Screen / Download
              </a>
              <button mat-icon-button (click)="closeDocPreview()" class="close-btn"><mat-icon>close</mat-icon></button>
            </div>
          </div>
          <div class="modal-body doc-preview-body">
            <ng-container *ngIf="isPdf(previewDocUrl)">
              <iframe [src]="getSafeUrl(previewDocUrl)" class="pdf-frame"></iframe>
            </ng-container>
            <ng-container *ngIf="!isPdf(previewDocUrl)">
              <div class="img-container">
                <img [src]="previewDocUrl" alt="KYC Document Preview" class="doc-img-preview">
              </div>
            </ng-container>
          </div>
        </div>
      </div>

      <!-- VIDEO PREVIEW MODAL -->
      <div class="modal-backdrop" *ngIf="previewVideoItem" (click)="closeVideoPreview()">
        <div class="modal-card video-preview-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div class="header-icon-box"><mat-icon>play_circle</mat-icon></div>
            <div>
              <h2>{{ previewVideoItem.title }}</h2>
              <p>Raw Submission Video Asset Preview</p>
            </div>
            <button mat-icon-button (click)="closeVideoPreview()" class="close-btn"><mat-icon>close</mat-icon></button>
          </div>
          <div class="modal-body video-body">
            <video [src]="previewVideoItem.rawVideoUrl" controls autoplay class="preview-player"></video>
            <div class="video-info-row">
              <div>
                <strong>Format:</strong> {{ previewVideoItem.contentType }} | 
                <strong>Producer:</strong> {{ previewVideoItem.producerName }}
              </div>
              <button mat-stroked-button color="primary" (click)="copyUrl(previewVideoItem.rawVideoUrl || '')">
                <mat-icon>content_copy</mat-icon> Copy Video URL
              </button>
            </div>
          </div>
          <div class="modal-footer">
            <button mat-button (click)="closeVideoPreview()">Close Preview</button>
            <button mat-raised-button color="primary" *ngIf="isPendingContent(previewVideoItem)" (click)="approveContent(previewVideoItem); closeVideoPreview();">
              <mat-icon>check</mat-icon> Approve & Publish
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-container {
      color: #ffffff;
      padding: 8px 0 32px;
    }

    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
      flex-wrap: wrap;
      gap: 16px;

      .category-tag {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 1px;
        color: #00d2ff;
        background: rgba(0, 210, 255, 0.12);
        padding: 4px 10px;
        border-radius: 6px;
        margin-bottom: 8px;
        mat-icon { font-size: 14px; width: 14px; height: 14px; }
      }

      h1 { font-size: 24px; font-weight: 800; margin: 0 0 6px; }
      p { font-size: 13px; color: #a0a0b5; margin: 0; }

      .refresh-btn {
        border-color: #2c2c3e;
        color: #ffffff;
        mat-icon { margin-right: 6px; }
      }
    }

    /* QUEUE TAB BAR */
    .queue-tab-bar {
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
      border-bottom: 1px solid #28283a;
      padding-bottom: 12px;

      .queue-tab {
        background: #161624;
        border: 1px solid #28283c;
        color: #a0a0b0;
        padding: 12px 20px;
        border-radius: 12px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 10px;
        transition: all 0.2s ease;

        mat-icon { font-size: 18px; width: 18px; height: 18px; }
        .badge {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 10px;
          color: #ffffff;
          font-weight: 800;
        }
        .red-badge { background: #e74c3c; }
        .blue-badge { background: #1a4cd8; }

        &:hover { border-color: #3e3e56; color: #ffffff; }
        &.active {
          background: linear-gradient(135deg, #1a4cd8 0%, #c725a3 100%);
          border-color: #1a4cd8;
          color: #ffffff;
          box-shadow: 0 4px 16px rgba(26, 76, 216, 0.35);
        }
      }
    }

    /* KPI GRID */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 24px;

      .kpi-card {
        background: #161622;
        border: 1px solid #28283a;
        border-radius: 12px;
        padding: 16px;
        display: flex;
        align-items: center;
        gap: 14px;

        .kpi-icon {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          mat-icon { font-size: 24px; width: 24px; height: 24px; }
        }

        .kpi-label { font-size: 11px; color: #8e8ea0; display: block; margin-bottom: 2px; }
        .kpi-val { font-size: 18px; font-weight: 800; color: #ffffff; }

        &.purple .kpi-icon { background: rgba(155, 89, 182, 0.15); color: #9b59b6; }
        &.gold .kpi-icon { background: rgba(241, 196, 15, 0.15); color: #f1c40f; }
        &.green .kpi-icon { background: rgba(46, 204, 113, 0.15); color: #2ecc71; }
        &.red .kpi-icon { background: rgba(231, 76, 60, 0.15); color: #e74c3c; }
        .text-green { color: #2ecc71; }
        .text-red { color: #e74c3c; }
      }
    }

    /* FILTER BAR */
    .filter-bar {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      margin-bottom: 20px;

      .search-box {
        position: relative;
        width: 360px;

        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #8e8ea0;
          font-size: 18px;
          width: 18px;
          height: 18px;
        }

        input {
          width: 100%;
          background: #161622;
          border: 1px solid #28283a;
          border-radius: 8px;
          padding: 8px 12px 8px 38px;
          color: #ffffff;
          font-size: 13px;
          outline: none;

          &:focus { border-color: #00d2ff; }
          &::placeholder { color: #6e6e80; }
        }
      }
    }

    /* TABLE CARD */
    .table-card {
      background: #161622;
      border: 1px solid #28283a;
      border-radius: 12px;
      overflow: hidden;

      .submissions-table {
        width: 100%;
        min-width: 1050px;
        background: transparent;
        border-collapse: collapse;

        th {
          background: #12121c;
          color: #8e8ea0;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 14px 16px;
          border-bottom: 1px solid #242436;
          white-space: nowrap;
        }

        td {
          padding: 14px 16px;
          border-bottom: 1px solid #202030;
          color: #ffffff;
          font-size: 13px;
          vertical-align: middle;
          white-space: nowrap;
        }

        tr:hover td {
          background: rgba(255, 255, 255, 0.02);
        }
      }

      .studio-cell {
        display: flex;
        flex-direction: column;
        gap: 3px;
        .studio-name { font-weight: 700; color: #ffffff; font-size: 14px; }
        .studio-reg { font-size: 11px; color: #00d2ff; }
        .contact-text { font-size: 11px; color: #a0a0b0; }
      }

      .kyc-col {
        display: flex;
        flex-direction: column;
        gap: 3px;
        .kyc-num { font-size: 12px; font-weight: 700; color: #ffffff; }
        .ver-badge { font-size: 10px; font-weight: 800; color: #ffab00; }
        .ver-ok { color: #00e676; }
        .doc-link {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: #00d2ff;
          text-decoration: none;
          mat-icon { font-size: 14px; width: 14px; height: 14px; }
          &:hover { text-decoration: underline; }
        }
        .bank-name { font-weight: 700; color: #ffffff; font-size: 12px; }
        .ifsc { font-size: 11px; color: #a0a0b0; }
      }

      .media-cell {
        width: 50px;
        .poster-thumb {
          width: 48px;
          height: 68px;
          object-fit: cover;
          border-radius: 6px;
          border: 1px solid #2c2c3e;
        }
        .poster-placeholder {
          width: 48px;
          height: 68px;
          background: #1c1c2b;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #6e6e80;
        }
      }

      .title-cell {
        max-width: 280px;
        .title-text { font-size: 14px; font-weight: 700; margin-bottom: 4px; }
        .desc-text {
          font-size: 11px;
          color: #8e8ea0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 260px;
          margin-bottom: 6px;
        }
        .meta-chips {
          display: flex;
          gap: 6px;
          .type-tag {
            font-size: 10px;
            background: #242436;
            color: #00d2ff;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 700;
          }
          .rev-tag {
            font-size: 10px;
            background: rgba(46, 204, 113, 0.12);
            color: #2ecc71;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 700;
          }
        }
      }

      .producer-cell {
        display: flex;
        flex-direction: column;
        gap: 2px;
        .studio-name { font-weight: 600; font-size: 13px; }
        .producer-email { font-size: 11px; color: #8e8ea0; }
      }

      .video-link-box {
        display: flex;
        align-items: center;
        gap: 6px;

        .preview-video-btn {
          border-color: rgba(0, 210, 255, 0.4);
          color: #00d2ff;
          font-size: 11px;
          height: 30px;
          padding: 0 10px;
          mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
          &:hover { background: rgba(0, 210, 255, 0.1); }
        }

        .copy-btn {
          width: 28px;
          height: 28px;
          color: #8e8ea0;
          mat-icon { font-size: 16px; width: 16px; height: 16px; }
          &:hover { color: #ffffff; }
        }
      }

      .review-notes {
        margin-top: 4px;
        color: #8e8ea0;
      }

      .actions-cell {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;

        .action-btn {
          height: 32px;
          font-size: 11px;
          font-weight: 700;
          border-radius: 6px;
          mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
        }
        .view-btn {
          border-color: #3e3e56;
          color: #00d2ff;
        }
        .approve-btn {
          background: #1a4cd8 !important;
          color: #ffffff;
        }
        .reject-btn {
          border-color: rgba(231, 76, 60, 0.4);
        }

        .approved-label {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 700;
          color: #2ecc71;
          mat-icon { font-size: 14px; width: 14px; height: 14px; }
        }

        .rejected-label {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 700;
          color: #e74c3c;
          mat-icon { font-size: 14px; width: 14px; height: 14px; }
        }
      }

      .empty-cell {
        text-align: center;
        padding: 48px 16px !important;

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          color: #6e6e80;
          mat-icon { font-size: 40px; width: 40px; height: 40px; }
          p { margin: 0; font-size: 14px; }
        }
      }
    }

    /* GLOBAL MODAL BACKDROP & DIALOGS */
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.82);
      backdrop-filter: blur(8px);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }

    .detail-modal {
      background: #181824;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 16px;
      width: 100%;
      max-width: 800px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 24px 48px rgba(0, 0, 0, 0.7);
      overflow: hidden;

      .modal-header {
        padding: 20px 24px;
        background: #202030;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        align-items: center;
        gap: 16px;

        .header-icon-box {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: rgba(0, 210, 255, 0.12);
          color: #00d2ff;
          display: flex;
          align-items: center;
          justify-content: center;
          mat-icon { font-size: 24px; width: 24px; height: 24px; }
        }

        h2 { font-size: 18px; font-weight: 800; margin: 0 0 2px; }
        p { font-size: 12px; color: #8e8ea0; margin: 0; }

        .header-status-box {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .close-btn { color: #8e8ea0; &:hover { color: #ffffff; } }
      }

      .detail-body {
        padding: 24px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 20px;

        .detail-section {
          background: #14141e;
          border: 1px solid #242436;
          border-radius: 12px;
          padding: 16px;

          h3 {
            font-size: 13px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #00d2ff;
            margin: 0 0 14px;
            display: flex;
            align-items: center;
            gap: 8px;
            mat-icon { font-size: 18px; width: 18px; height: 18px; }
          }
        }

        .detail-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;

          .info-item {
            label { font-size: 11px; color: #8e8ea0; display: block; margin-bottom: 2px; }
            span { font-size: 13px; font-weight: 600; color: #ffffff; }
          }
        }

        .kyc-cards-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }

        .kyc-card-box {
          background: #1c1c2b;
          border: 1px solid #2c2c3e;
          border-radius: 10px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;

          .box-title {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 11px;
            font-weight: 700;
            color: #a0a0b8;

            .ver-badge {
              font-size: 10px;
              padding: 2px 6px;
              border-radius: 4px;
              background: rgba(255, 255, 255, 0.08);
              color: #a0a0b8;
              &.ver-ok { background: rgba(46, 204, 113, 0.2); color: #2ecc71; }
            }
          }

          .box-val { font-size: 14px; font-weight: 700; color: #ffffff; }
        }

        .doc-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          color: #00d2ff;
          text-decoration: none;
          background: rgba(0, 210, 255, 0.1);
          padding: 6px 12px;
          border-radius: 6px;
          margin-top: 4px;
          transition: background 0.2s;
          mat-icon { font-size: 16px; width: 16px; height: 16px; }
          &:hover { background: rgba(0, 210, 255, 0.2); text-decoration: none; }
        }

        .inline-doc {
          margin-top: 0;
          display: inline-flex;
          width: fit-content;
        }

        .rejection-section {
          border-color: rgba(231, 76, 60, 0.3);
          background: rgba(231, 76, 60, 0.05);
          .rejection-text { margin: 0; color: #ff6b6b; font-size: 13px; font-weight: 500; }
        }
      }

      .modal-footer {
        padding: 16px 24px;
        background: #202030;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        justify-content: flex-end;
        gap: 12px;
      }
    }

    .video-preview-modal {
      max-width: 840px;
      background: #141420;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 16px;
      overflow: hidden;

      .video-body {
        padding: 16px 24px;
        display: flex;
        flex-direction: column;
        gap: 12px;

        .preview-player {
          width: 100%;
          max-height: 460px;
          border-radius: 10px;
          background: #000000;
          outline: none;
        }

        .video-info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 13px;
          color: #a0a0b8;
          padding: 8px 0;
        }
      }
    }

    /* KYC Compact Buttons & Missing Pills */
    .doc-btn-compact {
      height: 26px !important;
      line-height: 24px !important;
      padding: 0 8px !important;
      font-size: 11px !important;
      font-weight: 600 !important;
      color: #00d2ff !important;
      border-color: rgba(0, 210, 255, 0.3) !important;
      border-radius: 6px !important;
      mat-icon { font-size: 14px; width: 14px; height: 14px; margin-right: 4px; }
      &:hover { background: rgba(0, 210, 255, 0.15) !important; }
    }

    .missing-pill {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 10px;
      font-weight: 700;
      color: #ff5252;
      background: rgba(255, 82, 82, 0.1);
      border: 1px solid rgba(255, 82, 82, 0.25);
      border-radius: 4px;
      padding: 2px 6px;
      width: fit-content;
    }

    .not-provided {
      color: #6e6e80;
      font-style: italic;
    }

    /* Document Modal Inside Review */
    .title-with-icon {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #ffffff;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: #00d2ff; }
    }

    .doc-box-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 6px;

      .doc-btn {
        height: 32px;
        line-height: 30px;
        font-size: 11px;
        font-weight: 700;
        color: #00d2ff;
        border-color: rgba(0, 210, 255, 0.3);
        border-radius: 6px;
        mat-icon { font-size: 15px; width: 15px; height: 15px; margin-right: 4px; }
      }

      .ext-icon-btn {
        color: #a0a0b8;
        mat-icon { font-size: 18px; width: 18px; height: 18px; }
        &:hover { color: #00d2ff; }
      }

      .missing-warning {
        font-size: 11px;
        font-weight: 600;
        color: #ff5252;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        mat-icon { font-size: 15px; width: 15px; height: 15px; }
      }

      .verify-chip-btn {
        margin-left: auto;
        height: 30px;
        line-height: 28px;
        font-size: 11px;
        font-weight: 700;
        color: #00e676;
        border-color: rgba(0, 230, 118, 0.3);
        border-radius: 6px;
        mat-icon { font-size: 15px; width: 15px; height: 15px; margin-right: 2px; }
        &:hover { background: rgba(0, 230, 118, 0.15); }
      }
    }

    .doc-box-actions-stack {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 6px;

      .doc-row-item {
        display: flex;
        align-items: center;
        gap: 8px;
        .side-lbl { font-size: 11px; font-weight: 600; color: #8e8ea0; width: 68px; }
        .doc-btn {
          height: 28px;
          line-height: 26px;
          font-size: 11px;
          font-weight: 700;
          color: #00d2ff;
          border-color: rgba(0, 210, 255, 0.3);
          border-radius: 6px;
          mat-icon { font-size: 14px; width: 14px; height: 14px; margin-right: 4px; }
        }
        .ext-icon-btn {
          color: #a0a0b8;
          mat-icon { font-size: 16px; width: 16px; height: 16px; }
          &:hover { color: #00d2ff; }
        }
        .missing-warning {
          font-size: 11px;
          color: #ff5252;
        }
      }

      .verify-chip-btn {
        margin-top: 4px;
        align-self: flex-start;
        height: 30px;
        line-height: 28px;
        font-size: 11px;
        font-weight: 700;
        color: #00e676;
        border-color: rgba(0, 230, 118, 0.3);
        border-radius: 6px;
        mat-icon { font-size: 15px; width: 15px; height: 15px; margin-right: 2px; }
        &:hover { background: rgba(0, 230, 118, 0.15); }
      }
    }

    /* DOCUMENT LIGHTBOX MODAL */
    .doc-preview-modal {
      max-width: 900px;
      width: 90vw;
      background: #141420;
      border: 1px solid rgba(0, 210, 255, 0.25);
      border-radius: 16px;
      overflow: hidden;

      .doc-preview-body {
        padding: 16px 24px 24px;
        min-height: 480px;
        max-height: 80vh;
        overflow-y: auto;
        display: flex;
        align-items: center;
        justify-content: center;

        .pdf-frame {
          width: 100%;
          height: 600px;
          border: none;
          border-radius: 8px;
          background: #202028;
        }

        .img-container {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #08080c;
          border-radius: 8px;
          padding: 16px;

          .doc-img-preview {
            max-width: 100%;
            max-height: 560px;
            object-fit: contain;
            border-radius: 6px;
            box-shadow: 0 8px 30px rgba(0,0,0,0.6);
          }
        }
      }
    }

    .font-mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
  `]
})
export class ProducerReviewsPage implements OnInit {
  private readonly producerApiService = inject(ProducerApiService);
  private readonly notificationService = inject(NotificationService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly route = inject(ActivatedRoute);

  activeQueue: 'KYC' | 'CONTENT' = 'KYC';

  // Producer KYC Onboardings Data
  kycOnboardings: ProducerOnboardingProfile[] = [];
  filteredKycOnboardings: ProducerOnboardingProfile[] = [];
  pendingKycCount = 0;
  kycDisplayedColumns: string[] = ['studio', 'pan', 'aadhar', 'bank', 'status', 'actions'];

  // Content Submissions Data
  allSubmissions: ProducerSubmission[] = [];
  filteredSubmissions: ProducerSubmission[] = [];
  pendingContentCount = 0;
  contentDisplayedColumns: string[] = ['media', 'title', 'producer', 'rawVideo', 'status', 'actions'];

  searchQuery = '';
  loading = false;
  selectedProducer: ProducerOnboardingProfile | null = null;
  previewVideoItem: ProducerSubmission | null = null;

  previewDocUrl: string | null = null;
  previewDocTitle: string | null = null;

  openProducerDetailsModal(producer: ProducerOnboardingProfile): void {
    this.selectedProducer = producer;
  }

  closeProducerDetailsModal(): void {
    this.selectedProducer = null;
  }

  openDocPreview(url: string, title: string): void {
    this.previewDocUrl = url;
    this.previewDocTitle = title;
  }

  closeDocPreview(): void {
    this.previewDocUrl = null;
    this.previewDocTitle = null;
  }

  isPdf(url: string | null): boolean {
    if (!url) return false;
    return url.toLowerCase().includes('.pdf');
  }

  getSafeUrl(url: string | null): SafeResourceUrl {
    if (!url) return this.sanitizer.bypassSecurityTrustResourceUrl('about:blank');
    const trimmed = url.trim();
    if (/^https?:\/\//i.test(trimmed) && (trimmed.includes('b-cdn.net') || trimmed.includes('maxxpixels.com') || trimmed.includes('localhost') || trimmed.includes('127.0.0.1'))) {
      return this.sanitizer.bypassSecurityTrustResourceUrl(trimmed);
    }
    if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
      return this.sanitizer.bypassSecurityTrustResourceUrl(trimmed);
    }
    return this.sanitizer.bypassSecurityTrustResourceUrl('about:blank');
  }

  openVideoPreview(sub: ProducerSubmission): void {
    this.previewVideoItem = sub;
  }

  closeVideoPreview(): void {
    this.previewVideoItem = null;
  }

  ngOnInit(): void {
    this.refreshAll();

    // Check query params to auto-open specific producer verification modal
    this.route.queryParams.subscribe(params => {
      const pId = params['producerId'];
      if (pId) {
        this.activeQueue = 'KYC';
        // When onboardings load, find and open
        const match = this.kycOnboardings.find(k => String(k.id) === String(pId));
        if (match) {
          this.openProducerDetailsModal(match);
        }
      }
    });
  }

  setQueue(queue: 'KYC' | 'CONTENT'): void {
    this.activeQueue = queue;
    this.applyFilters();
  }

  refreshAll(): void {
    this.loadKycOnboardings();
    this.loadSubmissions();
  }

  loadKycOnboardings(): void {
    this.loading = true;
    this.producerApiService.getPendingOnboardings().subscribe({
      next: (res) => {
        this.loading = false;
        const rawList = Array.isArray(res.data) ? res.data : [];
        this.kycOnboardings = rawList.map((k: any) => ({
          id: k.id || k.producer_id || k.producerId || k.user_id,
          producerUserId: k.producerUserId || k.user_id || k.userId,
          studioName: k.studioName || k.companyName || k.company_name || k.studio_name || 'Independent Studio',
          companyName: k.companyName || k.company_name || k.studioName || 'Independent Studio',
          studioRegistrationNumber: k.studioRegistrationNumber || k.studio_registration_number || k.businessType || k.business_type || 'CIN-PROD-2026',
          contactEmail: k.contactEmail || k.contact_email || k.email || 'producer@maxxpixels.com',
          contactPhone: k.contactPhone || k.contact_phone || k.phone || k.phoneNumber || k.phone_number || '',
          taxId: k.taxId || k.tax_id || k.gstNumber || k.gst_number || '',
          defaultRevenueSharePercentage: k.defaultRevenueSharePercentage || k.default_revenue_share_percentage || 70,
          panNumber: k.panNumber || k.pan_number || '',
          panStatus: (k.panStatus || k.pan_status || 'PENDING').toUpperCase(),
          panDocUrl: k.panDocUrl || k.pan_doc_url || null,
          aadharNumber: k.aadharNumber || k.aadhar_number || '',
          aadharStatus: (k.aadharStatus || k.aadhar_status || 'PENDING').toUpperCase(),
          aadharDocUrl: k.aadharDocUrl || k.aadhar_doc_url || k.aadharFrontDocUrl || null,
          aadharBackDocUrl: k.aadharBackDocUrl || k.aadhar_back_doc_url || null,
          gstNumber: k.gstNumber || k.gst_number || '',
          gstStatus: (k.gstStatus || k.gst_status || 'PENDING').toUpperCase(),
          gstDocUrl: k.gstDocUrl || k.gst_doc_url || null,
          bankName: k.bankName || k.bank_name || '',
          bankAccountNumber: k.bankAccountNumber || k.bank_account_number || '',
          ifscCode: k.ifscCode || k.ifsc_code || '',
          bankStatus: (k.bankStatus || k.bank_status || 'PENDING').toUpperCase(),
          bankDocUrl: k.bankDocUrl || k.bank_doc_url || null,
          onboardingStatus: (k.onboardingStatus || k.status || 'PENDING').toUpperCase(),
          status: (k.status || 'ACTIVE').toUpperCase(),
          signedAgreementUrl: k.signedAgreementUrl || k.signed_agreement_url || null,
          agreementStatus: k.agreementStatus || k.agreement_status || 'PENDING',
          rejectionReason: k.rejectionReason || k.rejection_reason || ''
        }));

        this.pendingKycCount = this.kycOnboardings.filter(k =>
          !k.onboardingStatus || ['PENDING', 'SUBMITTED', 'UNDER_REVIEW'].includes(k.onboardingStatus.toUpperCase())
        ).length;
        this.applyFilters();

        // Check if queryParam has producerId to open
        const queryPId = this.route.snapshot.queryParams['producerId'];
        if (queryPId) {
          const match = this.kycOnboardings.find(k => String(k.id) === String(queryPId));
          if (match) this.openProducerDetailsModal(match);
        }
      },
      error: () => {
        this.loading = false;
        this.kycOnboardings = [];
        this.applyFilters();
      }
    });
  }

  verifySingleDoc(producer: ProducerOnboardingProfile, docType: string): void {
    if (!producer.id) return;
    this.producerApiService.verifyProducerDoc(producer.id, docType, 'VERIFIED').subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.notificationService.success(`${docType} verified successfully!`);
          if (docType === 'PAN') producer.panStatus = 'VERIFIED';
          if (docType === 'AADHAAR') producer.aadharStatus = 'VERIFIED';
          if (docType === 'BANK') producer.bankStatus = 'VERIFIED';
          if (docType === 'GST') producer.gstStatus = 'VERIFIED';
        } else {
          this.notificationService.success(`${docType} marked verified.`);
        }
      },
      error: (err) => {
        this.notificationService.error(err?.error?.message || `Failed to verify ${docType}`);
      }
    });
  }

  loadSubmissions(): void {
    this.loading = true;
    this.producerApiService.getAdminSubmissions('ALL').subscribe({
      next: (res) => {
        this.loading = false;
        const rawSubs = Array.isArray(res.data) ? res.data : [];
        this.allSubmissions = rawSubs.map((s: any) => ({
          id: s.id,
          producerId: s.producerId || s.producer_id,
          producerEmail: s.producerEmail || s.producer_email || 'studio@maxxpixels.com',
          producerName: s.producerName || s.producer_name || s.company_name || 'Partner Studio',
          title: s.title || 'Untitled Feature',
          contentType: s.contentType || s.content_type || 'MOVIE',
          description: s.description || '',
          oneLineBrief: s.oneLineBrief || s.one_line_brief || s.description || '',
          language: s.language || s.original_language_code || '',
          posterUrl: s.posterUrl || s.poster_url || '',
          poster2Url: s.poster2Url || s.poster_2_url || '',
          bannerUrl: s.bannerUrl || s.banner_url || '',
          trailerUrl: s.trailerUrl || s.trailer_url || '',
          productionName: s.productionName || s.production_name || '',
          producerContactPhone: s.producerContactPhone || s.producer_contact_phone || '',
          googleDriveLink: s.googleDriveLink || s.google_drive_link || '',
          submissionSource: s.submissionSource || s.submission_source || 'admin',
          agreementUrl: s.agreementUrl || s.agreement_url || '',
          agreementStatus: s.agreementStatus || s.agreement_status || 'PENDING',
          expiresAt: s.expiresAt || s.expires_at || '',
          rawVideoUrl: s.rawVideoUrl || s.raw_video_url || s.videoUrl || s.video_url || s.hlsManifestUrl || '',
          revenueSharePercentage: s.revenueSharePercentage || s.revenue_share_percentage || 70,
          status: (s.status || 'SUBMITTED').toUpperCase(),
          reviewNotes: s.reviewNotes || s.review_notes || s.adminReviewComment || s.rejectionReason || '',
          createdAt: s.createdAt || s.created_at || new Date().toISOString()
        }));

        this.pendingContentCount = this.allSubmissions.filter(s => this.isPendingContent(s)).length;
        this.applyFilters();
      },
      error: () => {
        this.loading = false;
        this.allSubmissions = [];
        this.applyFilters();
      }
    });
  }

  getKycCountByStatus(status: string): number {
    return this.kycOnboardings.filter(k => (k.onboardingStatus || '').toUpperCase() === status.toUpperCase()).length;
  }

  isPendingContent(sub: ProducerSubmission): boolean {
    return ['SUBMITTED', 'DRAFT', 'PENDING', 'PENDING_APPROVAL', 'UNDER_REVIEW'].includes(sub.status);
  }

  getCountByStatus(status: string): number {
    return this.allSubmissions.filter(s => (s.status || '').toUpperCase() === status.toUpperCase()).length;
  }

  applyFilters(): void {
    const q = (this.searchQuery || '').toLowerCase().trim();

    if (this.activeQueue === 'KYC') {
      if (!q) {
        this.filteredKycOnboardings = [...this.kycOnboardings];
      } else {
        this.filteredKycOnboardings = this.kycOnboardings.filter(k =>
          (k.studioName || k.companyName || '').toLowerCase().includes(q) ||
          (k.contactEmail || '').toLowerCase().includes(q) ||
          (k.panNumber || '').toLowerCase().includes(q) ||
          (k.aadharNumber || '').toLowerCase().includes(q) ||
          (k.ifscCode || '').toLowerCase().includes(q) ||
          (k.onboardingStatus || '').toLowerCase().includes(q)
        );
      }
    } else {
      if (!q) {
        this.filteredSubmissions = [...this.allSubmissions];
      } else {
        this.filteredSubmissions = this.allSubmissions.filter(s =>
          (s.title || '').toLowerCase().includes(q) ||
          (s.contentType || '').toLowerCase().includes(q) ||
          (s.producerName || '').toLowerCase().includes(q) ||
          (s.producerEmail || '').toLowerCase().includes(q) ||
          (s.status || '').toLowerCase().includes(q)
        );
      }
    }
  }

  approveKyc(row: ProducerOnboardingProfile): void {
    if (!row.id) return;
    this.loading = true;
    this.producerApiService.reviewProducerOnboarding(row.id, 'APPROVED', 'Verified by Admin').subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success) {
          this.notificationService.success(`Producer "${row.studioName || row.companyName}" KYC APPROVED!`);
          this.refreshAll();
        } else {
          this.notificationService.error(res.message || 'Failed to approve KYC');
        }
      },
      error: (err) => {
        this.loading = false;
        this.notificationService.error(err?.error?.message || 'Error approving KYC');
      }
    });
  }

  rejectKyc(row: ProducerOnboardingProfile): void {
    if (!row.id) return;
    const reason = prompt(`Enter rejection reason for "${row.studioName || row.companyName}":`, 'Invalid or illegible KYC document proofs');
    if (reason === null) return;

    this.loading = true;
    this.producerApiService.reviewProducerOnboarding(row.id, 'REJECTED', reason).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success) {
          this.notificationService.success(`Producer "${row.studioName || row.companyName}" KYC REJECTED.`);
          this.refreshAll();
        } else {
          this.notificationService.error(res.message || 'Failed to reject KYC');
        }
      },
      error: (err) => {
        this.loading = false;
        this.notificationService.error(err?.error?.message || 'Error rejecting KYC');
      }
    });
  }

  generateProducerCredentials(producer: ProducerOnboardingProfile): void {
    if (!producer.id) return;
    this.loading = true;
    this.producerApiService.generateProducerCredentials(producer.id).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success) {
          const d = res.data;
          this.notificationService.success(`Login credentials generated for ${d.studioName || producer.studioName}`);
          // Show credentials in a prompt for the admin to copy
          const creds = `Producer Studio Login Credentials\n\nStudio: ${d.studioName || producer.studioName}\nEmail: ${d.email}\nPassword: ${d.password}\nLogin URL: ${d.loginUrl || '/producer/login'}\n\nPlease share these securely with the producer.`;
          prompt('Copy the credentials below and share with the producer:', creds);
          this.refreshAll();
        } else {
          this.notificationService.error(res.message || 'Failed to generate credentials');
        }
      },
      error: (err) => {
        this.loading = false;
        this.notificationService.error(err?.error?.message || 'Error generating credentials');
      }
    });
  }

  approveContent(sub: ProducerSubmission): void {
    if (!sub.id) return;
    this.loading = true;
    this.producerApiService.reviewSubmission(sub.id, 'APPROVED', 'Approved by Platform Administrator').subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success) {
          this.notificationService.success(`"${sub.title}" approved and published.`);
          this.refreshAll();
        } else {
          this.notificationService.error(res.message || 'Failed to approve submission');
        }
      },
      error: (err) => {
        this.loading = false;
        this.notificationService.error(err?.error?.message || 'Error approving submission');
      }
    });
  }

  rejectContent(sub: ProducerSubmission): void {
    if (!sub.id) return;
    const reason = prompt(`Enter rejection reason for "${sub.title}":`, 'Asset did not meet resolution or compliance guidelines');
    if (reason === null) return;

    this.loading = true;
    this.producerApiService.reviewSubmission(sub.id, 'REJECTED', reason).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success) {
          this.notificationService.success(`Submission "${sub.title}" rejected and removed from publication.`);
          this.refreshAll();
        } else {
          this.notificationService.error(res.message || 'Failed to reject submission');
        }
      },
      error: (err) => {
        this.loading = false;
        this.notificationService.error(err?.error?.message || 'Error rejecting submission');
      }
    });
  }

  shareAgreement(sub: ProducerSubmission): void {
    if (!sub.id) return;
    const agreementUrl = prompt(`Enter agreement document URL to share with producer for "${sub.title}":`, '');
    if (agreementUrl === null) return;
    if (!agreementUrl.trim()) {
      this.notificationService.error('Agreement URL is required.');
      return;
    }

    this.loading = true;
    this.producerApiService.reviewSubmission(sub.id, 'SHARE_AGREEMENT', `Agreement shared: ${agreementUrl}`).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success) {
          this.notificationService.success(`Agreement shared with producer for "${sub.title}". Awaiting signed upload.`);
          this.refreshAll();
        } else {
          this.notificationService.error(res.message || 'Failed to share agreement');
        }
      },
      error: (err) => {
        this.loading = false;
        this.notificationService.error(err?.error?.message || 'Error sharing agreement');
      }
    });
  }

  publishAfterAgreement(sub: ProducerSubmission): void {
    if (!sub.id) return;
    this.loading = true;
    this.producerApiService.reviewSubmission(sub.id, 'APPROVED', 'Agreement confirmed - publishing content').subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success) {
          this.notificationService.success(`"${sub.title}" published after agreement confirmation.`);
          this.refreshAll();
        } else {
          this.notificationService.error(res.message || 'Failed to publish');
        }
      },
      error: (err) => {
        this.loading = false;
        this.notificationService.error(err?.error?.message || 'Error publishing content');
      }
    });
  }

  copyUrl(url: string): void {
    if (!url) return;
    navigator.clipboard.writeText(url);
    this.notificationService.info('Raw video URL copied to clipboard!');
  }
}
