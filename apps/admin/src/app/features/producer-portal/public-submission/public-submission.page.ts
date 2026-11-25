import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { environment } from '../../../../environments/environment';
import { NotificationService } from '../../../shared/services/notification.service';
import { MediaUploadComponent } from '../../../shared/components/media-upload/media-upload.component';
import { resolveAdminImageUrl } from '../../../core/services/movie-api.service';

@Component({
  selector: 'app-public-submission-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    MatProgressBarModule,
    MediaUploadComponent
  ],
  template: `
    <div class="public-submission-shell">
      <div class="public-submission-container">
        <!-- Top Navigation Bar -->
        <div class="top-nav-bar">
          <div class="nav-brand">
            <img *ngIf="brandLogo()" [src]="brandLogo()" [alt]="brandName()" class="nav-logo" (error)="brandLogo.set('')" />
            <mat-icon *ngIf="!brandLogo()" class="nav-logo-icon">movie_creation</mat-icon>
            <span class="nav-brand-name">{{ brandName() }}</span>
            <span class="nav-pill">Producer Studio</span>
          </div>
          <a routerLink="/producer/login" class="partner-login-link">
            <mat-icon>login</mat-icon>
            <span>Already a partner? Sign in</span>
          </a>
        </div>

        <!-- Hero Header -->
        <div class="header-card">
          <div class="brand">
            <mat-icon class="brand-icon">movie_creation</mat-icon>
            <div>
              <h1>Submit Your Content to {{ brandName() }}</h1>
              <p>Showcase your film, series, short film, or micro-drama to audiences across Web, Mobile &amp; Smart TV.</p>
            </div>
          </div>

          <div class="how-it-works">
            <div class="step-pill">
              <span class="step-num">1</span>
              <span>Submit Details &amp; Posters</span>
            </div>
            <mat-icon class="step-arrow">chevron_right</mat-icon>
            <div class="step-pill">
              <span class="step-num">2</span>
              <span>Editorial Review (7 Days)</span>
            </div>
            <mat-icon class="step-arrow">chevron_right</mat-icon>
            <div class="step-pill">
              <span class="step-num">3</span>
              <span>Agreement &amp; Go Live</span>
            </div>
          </div>
        </div>

        <!-- Success Confirmation -->
        <div class="success-banner" *ngIf="submitted()">
          <mat-icon class="success-icon">check_circle</mat-icon>
          <div class="success-body">
            <h3>Submission Received!</h3>
            <p>
              Thank you for submitting to {{ brandName() }}. Our content team will review your submission within
              <strong>7 days</strong>. If approved, we will send the licensing agreement to your email.
            </p>
            <div class="sub-id-row" *ngIf="submissionId()">
              <span class="sub-id">Submission ID: #{{ submissionId() }}</span>
              <button type="button" mat-stroked-button class="copy-id-btn" (click)="copySubmissionId()">
                <mat-icon>content_copy</mat-icon> Copy ID
              </button>
            </div>
            <div class="success-actions">
              <button mat-raised-button color="primary" (click)="resetForm()">
                <mat-icon>add</mat-icon> Submit Another Title
              </button>
              <a mat-stroked-button routerLink="/producer/login" class="portal-btn">
                <mat-icon>dashboard</mat-icon> Open Producer Portal
              </a>
            </div>
          </div>
        </div>

        <!-- Main Submission Form -->
        <form [formGroup]="form" (ngSubmit)="onSubmit()" *ngIf="!submitted()" class="submission-form" novalidate>
          <!-- 1. Content Details -->
          <mat-card class="form-section">
            <div class="section-header">
              <mat-icon>category</mat-icon>
              <h2>1. Content Details</h2>
            </div>
            <div class="form-grid">
              <div class="two-col">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Content Type *</mat-label>
                  <mat-select formControlName="contentType" required>
                    <mat-option *ngFor="let t of contentTypes()" [value]="t.value">{{ t.label }}</mat-option>
                  </mat-select>
                  <mat-error *ngIf="form.get('contentType')?.hasError('required')">Content type is required</mat-error>
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Primary Language *</mat-label>
                  <mat-select formControlName="language" required>
                    <mat-option *ngFor="let lang of languages()" [value]="lang">{{ lang }}</mat-option>
                  </mat-select>
                  <mat-error *ngIf="form.get('language')?.hasError('required')">Language is required</mat-error>
                </mat-form-field>
              </div>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Title *</mat-label>
                <input matInput formControlName="title" placeholder="Enter your movie, series, or show title" required>
                <mat-error *ngIf="form.get('title')?.hasError('required')">Title is required</mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>One-Line Synopsis / Briefing *</mat-label>
                <textarea matInput formControlName="oneLineBrief" rows="3" placeholder="Briefly describe the storyline, theme, and genre..." required></textarea>
                <mat-error *ngIf="form.get('oneLineBrief')?.hasError('required')">Brief is required</mat-error>
              </mat-form-field>
            </div>
          </mat-card>

          <!-- 2. Posters & Trailer -->
          <mat-card class="form-section">
            <div class="section-header">
              <mat-icon>image</mat-icon>
              <h2>2. Posters &amp; Trailer</h2>
            </div>
            <div class="form-grid">
              <div class="two-col artwork-grid">
                <div class="upload-field-block">
                  <label class="field-label">Vertical Poster (3:4 Portrait) *</label>
                  <app-media-upload
                    folder="posters"
                    label="Portrait Poster"
                    accept="image/*"
                    [initialUrl]="form.value.poster1Url || ''"
                    (uploadComplete)="onPosterUploaded('poster1Url', $event)"
                  ></app-media-upload>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Poster 1 URL *</mat-label>
                    <input matInput formControlName="poster1Url" placeholder="Upload above or paste https://..." required>
                    <mat-error *ngIf="form.get('poster1Url')?.hasError('required')">Portrait poster is required</mat-error>
                  </mat-form-field>
                </div>

                <div class="upload-field-block">
                  <label class="field-label">Landscape Banner (16:9 — Optional)</label>
                  <app-media-upload
                    folder="banners"
                    label="Landscape Banner"
                    accept="image/*"
                    [initialUrl]="form.value.poster2Url || ''"
                    (uploadComplete)="onPosterUploaded('poster2Url', $event)"
                  ></app-media-upload>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Poster 2 / Banner URL (Optional)</mat-label>
                    <input matInput formControlName="poster2Url" placeholder="Upload above or paste https://...">
                  </mat-form-field>
                </div>
              </div>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Trailer URL (Optional)</mat-label>
                <input matInput formControlName="trailerUrl" placeholder="https://youtube.com/watch?v=... or direct link">
                <mat-hint>YouTube, Vimeo, or direct MP4/HLS trailer link</mat-hint>
              </mat-form-field>
            </div>
          </mat-card>

          <!-- 3. Production & Contact -->
          <mat-card class="form-section">
            <div class="section-header">
              <mat-icon>business</mat-icon>
              <h2>3. Production &amp; Contact Details</h2>
            </div>
            <div class="form-grid">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Production House / Banner Name *</mat-label>
                <input matInput formControlName="productionName" placeholder="e.g. Studio / Production Banner Name" required>
                <mat-error *ngIf="form.get('productionName')?.hasError('required')">Production name is required</mat-error>
              </mat-form-field>

              <div class="two-col">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Producer Contact Number *</mat-label>
                  <input matInput type="tel" formControlName="contactPhone" placeholder="+91 9876543210" required>
                  <mat-error *ngIf="form.get('contactPhone')?.hasError('required')">Contact number is required</mat-error>
                  <mat-error *ngIf="form.get('contactPhone')?.hasError('pattern')">Enter a valid phone number (at least 10 digits)</mat-error>
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Email ID(s) *</mat-label>
                  <input matInput formControlName="producerEmail" placeholder="producer@example.com" required>
                  <mat-hint>Comma-separated if multiple emails</mat-hint>
                  <mat-error *ngIf="form.get('producerEmail')?.hasError('required')">Email is required</mat-error>
                  <mat-error *ngIf="form.get('producerEmail')?.hasError('pattern')">Enter a valid email address</mat-error>
                </mat-form-field>
              </div>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Full Content Link (Google Drive / Cloud) *</mat-label>
                <input matInput type="url" formControlName="googleDriveLink" placeholder="https://drive.google.com/file/d/..." required>
                <mat-hint>Ensure viewer access is shared with {{ driveShareEmail() }}</mat-hint>
                <mat-error *ngIf="form.get('googleDriveLink')?.hasError('required')">Google Drive / video link is required</mat-error>
                <mat-error *ngIf="form.get('googleDriveLink')?.hasError('pattern')">Enter a valid https:// URL</mat-error>
              </mat-form-field>
            </div>
          </mat-card>

          <div class="submit-section">
            <button mat-raised-button color="primary" type="submit" [disabled]="submitting()" class="submit-btn">
              <mat-icon *ngIf="!submitting()">send</mat-icon>
              <mat-icon *ngIf="submitting()" class="spin">sync</mat-icon>
              {{ submitting() ? 'Submitting...' : 'Submit Content for Review' }}
            </button>
            <p class="submit-note">
              <mat-icon>info</mat-icon>
              <span>
                By submitting, you confirm you hold distribution rights for this content. Our team reviews submissions within 7 days and sends licensing agreements via email.
              </span>
            </p>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .public-submission-shell {
      min-height: 100vh;
      background: radial-gradient(circle at top center, #15182b 0%, #0b0c14 55%, #07080d 100%);
      padding: 16px 12px 48px;
    }

    .public-submission-container {
      max-width: 860px;
      margin: 0 auto;
      color: #ffffff;
      font-family: 'Roboto', sans-serif;
    }

    .top-nav-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 18px;
      flex-wrap: wrap;
    }

    .nav-brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .nav-logo {
      height: 34px;
      width: auto;
      object-fit: contain;
    }

    .nav-logo-icon {
      color: #e50914;
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .nav-brand-name {
      font-size: 16px;
      font-weight: 800;
      letter-spacing: 0.2px;
    }

    .nav-pill {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 9px;
      border-radius: 999px;
      background: rgba(229, 9, 20, 0.16);
      color: #ff6b72;
      border: 1px solid rgba(229, 9, 20, 0.35);
    }

    .partner-login-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: #00d2ff;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      padding: 6px 12px;
      border-radius: 8px;
      border: 1px solid rgba(0, 210, 255, 0.25);
      background: rgba(0, 210, 255, 0.06);
      transition: background 0.2s ease;
    }

    .partner-login-link:hover {
      background: rgba(0, 210, 255, 0.14);
    }

    .partner-login-link mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
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
      font-size: 46px;
      width: 46px;
      height: 46px;
      color: #e50914;
      flex-shrink: 0;
    }

    .brand h1 {
      margin: 0 0 6px;
      font-size: 24px;
      font-weight: 800;
      color: #ffffff;
      line-height: 1.25;
    }

    .brand p {
      margin: 0;
      color: #b4b7c8;
      font-size: 14px;
      line-height: 1.5;
    }

    .how-it-works {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 18px;
      padding-top: 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      flex-wrap: wrap;
    }

    .step-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      font-weight: 600;
      color: #d6daea;
      background: rgba(255, 255, 255, 0.05);
      padding: 6px 12px;
      border-radius: 999px;
    }

    .step-num {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #e50914;
      color: #ffffff;
      font-size: 11px;
      font-weight: 800;
    }

    .step-arrow {
      color: #6b7280;
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .success-banner {
      background: rgba(0, 230, 118, 0.09);
      border: 1px solid rgba(0, 230, 118, 0.32);
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 24px;
      display: flex;
      align-items: flex-start;
      gap: 16px;
    }

    .success-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: #00e676;
      flex-shrink: 0;
    }

    .success-body {
      flex: 1;
    }

    .success-banner h3 {
      margin: 0 0 8px;
      font-size: 20px;
      font-weight: 800;
      color: #00e676;
    }

    .success-banner p {
      margin: 0 0 12px;
      color: #d0d4de;
      font-size: 14px;
      line-height: 1.55;
    }

    .sub-id-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    .sub-id {
      font-family: monospace;
      font-size: 13px;
      color: #00d2ff;
      font-weight: 700;
      background: rgba(0, 210, 255, 0.08);
      padding: 5px 10px;
      border-radius: 6px;
      border: 1px solid rgba(0, 210, 255, 0.25);
    }

    .copy-id-btn {
      height: 32px;
      font-size: 12px;
      color: #00d2ff;
      border-color: rgba(0, 210, 255, 0.35);
    }

    .success-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }

    .portal-btn {
      border-color: rgba(255, 255, 255, 0.25);
      color: #ffffff;
    }

    .submission-form {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .form-section {
      background: #141521;
      border: 1px solid #26283d;
      border-radius: 14px;
      padding: 22px;
    }

    .section-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 18px;
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

    .two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    .upload-field-block {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .field-label {
      font-size: 12px;
      font-weight: 700;
      color: #c6cad8;
      margin-bottom: 2px;
    }

    .full-width {
      width: 100%;
    }

    .submit-section {
      text-align: center;
      padding: 12px 0 8px;
    }

    .submit-btn {
      height: 52px;
      padding: 0 42px;
      font-size: 16px;
      font-weight: 800;
      border-radius: 12px;
      background: linear-gradient(135deg, #e50914 0%, #f43f5e 100%) !important;
      color: #ffffff !important;
      box-shadow: 0 6px 20px rgba(229, 9, 20, 0.35);
    }

    .submit-note {
      display: flex;
      align-items: flex-start;
      justify-content: center;
      gap: 8px;
      margin: 14px auto 0;
      max-width: 640px;
      color: #8e8ea0;
      font-size: 12px;
      line-height: 1.5;
      text-align: left;
    }

    .submit-note mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .spin {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    @media (max-width: 640px) {
      .header-card { padding: 18px; }
      .brand { flex-direction: column; align-items: flex-start; gap: 10px; }
      .brand h1 { font-size: 20px; }
      .two-col { grid-template-columns: 1fr; }
      .step-arrow { display: none; }
      .success-banner { flex-direction: column; }
      .submit-btn { width: 100%; padding: 0 20px; }
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
  brandName = signal('MaxxPixels OTT');
  brandLogo = signal('');
  driveShareEmail = signal('maxxpixelsofficial@gmail.com');

  contentTypes = signal<{ label: string; value: string }[]>([
    { label: 'Movie', value: 'MOVIE' },
    { label: 'Short Film', value: 'SHORT_FILM' },
    { label: 'Micro-Drama', value: 'MICRODRAMA' },
    { label: 'Web Series', value: 'SERIES' },
    { label: 'Music & Album', value: 'ALBUM' },
    { label: 'Documentary', value: 'DOCUMENTARY' },
    { label: 'Stage Drama', value: 'STAGE_DRAMA' },
    { label: 'Podcast', value: 'PODCAST' }
  ]);

  languages = signal<string[]>([
    'Kannada', 'Tamil', 'Telugu', 'Hindi', 'Malayalam', 'Marathi', 'Bengali', 'Punjabi', 'Gujarati', 'English', 'Other'
  ]);

  form = this.fb.group({
    contentType: ['MOVIE', Validators.required],
    title: ['', Validators.required],
    language: ['Kannada', Validators.required],
    oneLineBrief: ['', Validators.required],
    poster1Url: ['', Validators.required],
    poster2Url: [''],
    trailerUrl: [''],
    productionName: ['', Validators.required],
    contactPhone: ['', [Validators.required, Validators.pattern(/^[+\d][\d\s\-()]{8,18}$/)]],
    producerEmail: ['', [Validators.required, Validators.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+(\s*,\s*[^\s@]+@[^\s@]+\.[^\s@]+)*$/)]],
    googleDriveLink: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/i)]]
  });

  ngOnInit(): void {
    this.loadPublicMetadata();
  }

  private normalizeTypeCode(raw: string): string {
    const clean = (raw || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');
    switch (clean) {
      case 'MOVIES':
      case 'FILM':
        return 'MOVIE';
      case 'SHORT_FILMS':
      case 'SHORTS':
        return 'SHORT_FILM';
      case 'MICRO_DRAMA':
      case 'MICRODRAMAS':
        return 'MICRODRAMA';
      case 'WEB_SERIES':
      case 'SHOWS':
        return 'SERIES';
      case 'ALBUMS':
      case 'SONGS':
      case 'MUSIC':
        return 'ALBUM';
      case 'PODCASTS':
        return 'PODCAST';
      case 'STAGE_DRAMAS':
        return 'STAGE_DRAMA';
      case 'DOCUMENTARIES':
        return 'DOCUMENTARY';
      default:
        return clean || 'MOVIE';
    }
  }

  private loadPublicMetadata(): void {
    this.http.get<any>(`${environment.apiBaseUrl}/settings`).subscribe({
      next: (res) => {
        const d = res?.data ?? res?.result ?? res;
        if (d && typeof d === 'object') {
          const name = d.appName || d.APP_NAME;
          if (name) this.brandName.set(String(name));
          const logo = d.logoUrl || d.APP_LOGO_URL || d.darkLogoUrl;
          if (logo && !String(logo).startsWith('assets/')) {
            this.brandLogo.set(resolveAdminImageUrl(String(logo)));
          }
        }
      },
      error: () => {}
    });

    this.http.get<any>(`${environment.apiBaseUrl}/content-types`).subscribe({
      next: (res) => {
        const rows = res?.data ?? res?.result ?? res;
        if (Array.isArray(rows) && rows.length > 0) {
          const seen = new Set<string>();
          const mapped: { label: string; value: string }[] = [];
          for (const t of rows) {
            const val = this.normalizeTypeCode(t.slug || t.title || t.name || '');
            if (!val || seen.has(val)) continue;
            seen.add(val);
            mapped.push({ label: t.title || t.name || val, value: val });
          }
          if (mapped.length > 0) {
            this.contentTypes.set(mapped);
          }
        }
      },
      error: () => {}
    });

    this.http.get<any>(`${environment.apiBaseUrl}/languages`).subscribe({
      next: (res) => {
        const rows = res?.data ?? res?.result ?? res;
        if (Array.isArray(rows) && rows.length > 0) {
          const fromApi = rows.map((l: any) => (l.name || l.code || '').trim()).filter(Boolean);
          const merged = [...new Set([...fromApi, ...this.languages()])];
          this.languages.set(merged);
        }
      },
      error: () => {}
    });
  }

  onPosterUploaded(controlName: 'poster1Url' | 'poster2Url', url: string): void {
    this.form.get(controlName)?.setValue(url);
    this.form.get(controlName)?.markAsDirty();
    this.form.get(controlName)?.markAsTouched();
  }

  copySubmissionId(): void {
    const id = this.submissionId();
    if (!id || typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard.writeText(id).then(() => {
      this.toast.success(`Copied Submission ID #${id}`);
    }).catch(() => {});
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning('Please fill in all required fields with valid details before submitting.');
      return;
    }

    this.submitting.set(true);
    const v = this.form.value;
    const payload = {
      contentType: v.contentType,
      title: (v.title || '').trim(),
      language: v.language,
      oneLineBrief: (v.oneLineBrief || '').trim(),
      posterUrl: (v.poster1Url || '').trim(),
      poster1Url: (v.poster1Url || '').trim(),
      poster2Url: (v.poster2Url || '').trim(),
      trailerUrl: (v.trailerUrl || '').trim(),
      productionName: (v.productionName || '').trim(),
      producerContactPhone: (v.contactPhone || '').trim(),
      producerEmail: (v.producerEmail || '').trim(),
      googleDriveLink: (v.googleDriveLink || '').trim(),
      description: (v.oneLineBrief || '').trim()
    };

    this.http.post<any>(`${environment.apiBaseUrl}/producer/submit`, payload).subscribe({
      next: (res) => {
        this.submitting.set(false);
        const data = res?.data || res;
        this.submissionId.set(data?.id ? String(data.id) : null);
        this.submitted.set(true);
        this.toast.success('Content submitted successfully!');
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
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
    this.form.reset({
      contentType: 'MOVIE',
      language: 'Kannada'
    });
  }
}
