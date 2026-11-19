import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { environment } from '../../../../environments/environment';
import { NotificationService } from '../../../shared/services/notification.service';

@Component({
  selector: 'app-public-submission-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    MatProgressBarModule
  ],
  template: `
    <div class="public-submission-container">
      <div class="header-card">
        <div class="brand">
          <mat-icon class="brand-icon">movie_creation</mat-icon>
          <div>
            <h1>Submit Your Content to MaxxPixels OTT</h1>
            <p>Share your film with us. Fill in the details below and our team will review your submission.</p>
          </div>
        </div>
      </div>

      <div class="success-banner" *ngIf="submitted()">
        <mat-icon>check_circle</mat-icon>
        <div>
          <h3>Submission Received!</h3>
          <p>Your content has been submitted for review. Our team will review it within 7 days. If approved, we will share an agreement with you via email. If no further action is taken within 7 days, the submission will be automatically closed.</p>
          <p class="sub-id">Submission ID: {{ submissionId() }}</p>
        </div>
        <button mat-raised-button color="primary" (click)="resetForm()">Submit Another</button>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" *ngIf="!submitted()" class="submission-form">
        <!-- 1. Content Type -->
        <mat-card class="form-section">
          <div class="section-header">
            <mat-icon>category</mat-icon>
            <h2>1. Content Details</h2>
          </div>
          <div class="form-grid">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Content Type *</mat-label>
              <mat-select formControlName="contentType" required>
                <mat-option value="MOVIE">Movie</mat-option>
                <mat-option value="SHORT_FILM">Short Film</mat-option>
                <mat-option value="MICRO_DRAMA">Micro Drama</mat-option>
              </mat-select>
              <mat-error *ngIf="form.get('contentType')?.hasError('required')">Content type is required</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Title *</mat-label>
              <input matInput formControlName="title" placeholder="e.g. Plastic Baba 5G" required>
              <mat-error *ngIf="form.get('title')?.hasError('required')">Title is required</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Language *</mat-label>
              <mat-select formControlName="language" required>
                <mat-option value="Hindi">Hindi</mat-option>
                <mat-option value="Marathi">Marathi</mat-option>
                <mat-option value="Kannada">Kannada</mat-option>
                <mat-option value="Telugu">Telugu</mat-option>
                <mat-option value="Tamil">Tamil</mat-option>
                <mat-option value="Malayalam">Malayalam</mat-option>
                <mat-option value="Bengali">Bengali</mat-option>
                <mat-option value="English">English</mat-option>
                <mat-option value="Other">Other</mat-option>
              </mat-select>
              <mat-error *ngIf="form.get('language')?.hasError('required')">Language is required</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>One Line Briefing *</mat-label>
              <textarea matInput formControlName="oneLineBrief" rows="2" placeholder="e.g. World's first movie on plastic pollution." required></textarea>
              <mat-error *ngIf="form.get('oneLineBrief')?.hasError('required')">Brief is required</mat-error>
            </mat-form-field>
          </div>
        </mat-card>

        <!-- 2. Posters & Trailer -->
        <mat-card class="form-section">
          <div class="section-header">
            <mat-icon>image</mat-icon>
            <h2>2. Posters & Trailer</h2>
          </div>
          <div class="form-grid">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Poster 1 URL *</mat-label>
              <input matInput formControlName="poster1Url" placeholder="https://..." required>
              <mat-hint>Vertical poster (portrait orientation)</mat-hint>
              <mat-error *ngIf="form.get('poster1Url')?.hasError('required')">Poster 1 URL is required</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Poster 2 URL (Landscape/Banner)</mat-label>
              <input matInput formControlName="poster2Url" placeholder="https://...">
              <mat-hint>Horizontal banner (landscape orientation) - optional</mat-hint>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Trailer URL</mat-label>
              <input matInput formControlName="trailerUrl" placeholder="https://youtube.com/...">
              <mat-hint>YouTube or direct video link - optional</mat-hint>
            </mat-form-field>
          </div>
        </mat-card>

        <!-- 3. Production & Contact -->
        <mat-card class="form-section">
          <div class="section-header">
            <mat-icon>business</mat-icon>
            <h2>3. Production & Contact Details</h2>
          </div>
          <div class="form-grid">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Production Name *</mat-label>
              <input matInput formControlName="productionName" placeholder="e.g. Eduwealth Film Production" required>
              <mat-error *ngIf="form.get('productionName')?.hasError('required')">Production name is required</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Producer Contact Number *</mat-label>
              <input matInput formControlName="contactPhone" placeholder="+91 8055038565" required>
              <mat-error *ngIf="form.get('contactPhone')?.hasError('required')">Contact number is required</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Email ID(s) *</mat-label>
              <input matInput formControlName="producerEmail" placeholder="email1@example.com, email2@example.com" required>
              <mat-hint>Comma-separated if multiple emails</mat-hint>
              <mat-error *ngIf="form.get('producerEmail')?.hasError('required')">Email is required</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Full Movie Link (Google Drive) *</mat-label>
              <input matInput formControlName="googleDriveLink" placeholder="https://drive.google.com/..." required>
              <mat-hint>Ensure full access is shared with maxxpixelsoffical&#64;gmail.com</mat-hint>
              <mat-error *ngIf="form.get('googleDriveLink')?.hasError('required')">Google Drive link is required</mat-error>
            </mat-form-field>
          </div>
        </mat-card>

        <div class="submit-section">
          <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || submitting()" class="submit-btn">
            <mat-icon *ngIf="!submitting()">send</mat-icon>
            <mat-icon *ngIf="submitting()" class="spin">sync</mat-icon>
            {{ submitting() ? 'Submitting...' : 'Submit Content for Review' }}
          </button>
          <p class="submit-note">
            <mat-icon>info</mat-icon>
            By submitting, you agree that our team will review your content. If approved, you will receive an agreement via email. The submission will be saved for 7 days; if no further action is taken, it will be automatically closed.
          </p>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .public-submission-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 24px 16px;
      color: #ffffff;
      font-family: 'Roboto', sans-serif;
    }

    .header-card {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border: 1px solid #28283c;
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 24px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .brand-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #e50914;
    }

    .brand h1 {
      margin: 0 0 4px;
      font-size: 24px;
      font-weight: 800;
      color: #ffffff;
    }

    .brand p {
      margin: 0;
      color: #a0a0b0;
      font-size: 14px;
    }

    .success-banner {
      background: rgba(0, 230, 118, 0.1);
      border: 1px solid rgba(0, 230, 118, 0.3);
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 24px;
      display: flex;
      align-items: flex-start;
      gap: 16px;
    }

    .success-banner mat-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: #00e676;
      flex-shrink: 0;
    }

    .success-banner h3 {
      margin: 0 0 8px;
      font-size: 20px;
      font-weight: 800;
      color: #00e676;
    }

    .success-banner p {
      margin: 0 0 8px;
      color: #d0d4de;
      font-size: 14px;
      line-height: 1.5;
    }

    .sub-id {
      font-family: monospace;
      font-size: 12px;
      color: #00d2ff;
      font-weight: 700;
    }

    .submission-form {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .form-section {
      background: #161622;
      border: 1px solid #28283c;
      border-radius: 12px;
      padding: 20px;
    }

    .section-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 16px;
    }

    .section-header mat-icon {
      color: #00d2ff;
      font-size: 22px;
      width: 22px;
      height: 22px;
    }

    .section-header h2 {
      margin: 0;
      font-size: 16px;
      font-weight: 800;
      color: #ffffff;
    }

    .form-grid {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .full-width {
      width: 100%;
    }

    .submit-section {
      text-align: center;
      padding: 20px 0;
    }

    .submit-btn {
      height: 50px;
      padding: 0 40px;
      font-size: 16px;
      font-weight: 800;
      border-radius: 12px;
      background: linear-gradient(135deg, #e50914 0%, #f43f5e 100%) !important;
      color: #ffffff !important;
      box-shadow: 0 4px 16px rgba(229, 9, 20, 0.35);
    }

    .submit-note {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-top: 12px;
      color: #8e8ea0;
      font-size: 12px;
    }

    .submit-note mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .spin {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `]
})
export class PublicSubmissionPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(NotificationService);

  submitting = signal(false);
  submitted = signal(false);
  submissionId = signal<string | null>(null);

  form = this.fb.group({
    contentType: ['', Validators.required],
    title: ['', Validators.required],
    language: ['', Validators.required],
    oneLineBrief: ['', Validators.required],
    poster1Url: ['', Validators.required],
    poster2Url: [''],
    trailerUrl: [''],
    productionName: ['', Validators.required],
    contactPhone: ['', Validators.required],
    producerEmail: ['', Validators.required],
    googleDriveLink: ['', Validators.required]
  });

  ngOnInit(): void {}

  onSubmit(): void {
    if (this.form.invalid) return;
    this.submitting.set(true);
    const v = this.form.value;
    const payload = {
      contentType: v.contentType,
      title: v.title,
      language: v.language,
      oneLineBrief: v.oneLineBrief,
      posterUrl: v.poster1Url,
      poster1Url: v.poster1Url,
      poster2Url: v.poster2Url,
      trailerUrl: v.trailerUrl,
      productionName: v.productionName,
      producerContactPhone: v.contactPhone,
      producerEmail: v.producerEmail,
      googleDriveLink: v.googleDriveLink,
      description: v.oneLineBrief
    };

    this.http.post<any>(`${environment.apiBaseUrl}/producer/submit`, payload).subscribe({
      next: (res) => {
        this.submitting.set(false);
        const data = res?.data || res;
        this.submissionId.set(data?.id ? String(data.id) : null);
        this.submitted.set(true);
        this.toast.success('Content submitted successfully!');
      },
      error: (err) => {
        this.submitting.set(false);
        this.toast.error(err?.error?.message || 'Submission failed. Please try again.');
      }
    });
  }

  resetForm(): void {
    this.submitted.set(false);
    this.submissionId.set(null);
    this.form.reset();
  }
}