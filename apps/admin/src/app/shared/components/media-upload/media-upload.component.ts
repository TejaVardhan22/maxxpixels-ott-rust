import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '../../../../environments/environment';
import { NotificationService } from '../../services/notification.service';
import { resolveAdminImageUrl } from '../../../core/services/movie-api.service';

@Component({
  selector: 'app-media-upload',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatProgressBarModule, MatIconModule, MatInputModule, MatTooltipModule],
  template: `
    <div class="upload-box" [class.has-file]="!!uploadedUrl || !!localPreviewUrl">
      <!-- 1. FILE SELECTION & PASTE TOGGLE -->
      <div class="upload-controls" *ngIf="!uploading && !uploadedUrl && !localPreviewUrl && !showManualInput">
        <input type="file" #fileInput (change)="onFileSelected($event)" style="display: none" [accept]="accept">
        <div class="btn-group">
          <button type="button" mat-raised-button color="primary" class="upload-btn" (click)="fileInput.click()">
            <mat-icon>cloud_upload</mat-icon> Upload File
          </button>
          <button type="button" mat-stroked-button color="accent" class="paste-btn" (click)="showManualInput = true">
            <mat-icon>link</mat-icon> Paste URL
          </button>
        </div>
      </div>

      <!-- 2. MANUAL URL PASTE FIELD -->
      <div class="manual-url-box" *ngIf="showManualInput && !uploadedUrl && !localPreviewUrl">
        <div class="manual-input-row">
          <input type="text" class="manual-input" [(ngModel)]="manualUrlText" [placeholder]="'Paste ' + label + ' URL (https://...)'">
          <button type="button" mat-flat-button color="primary" (click)="saveManualUrl()">Apply</button>
          <button type="button" mat-icon-button (click)="showManualInput = false"><mat-icon>close</mat-icon></button>
        </div>
      </div>

      <!-- 3. UPLOAD PROGRESS -->
      <div class="upload-progress" *ngIf="uploading">
        <div class="progress-info">
          <span><mat-icon class="spin">sync</mat-icon> Uploading {{ label }}...</span>
          <span>{{ progress }}%</span>
        </div>
        <mat-progress-bar mode="determinate" [value]="progress" class="bar"></mat-progress-bar>
      </div>

      <!-- 4. UPLOADED ASSET PREVIEW -->
      <div class="uploaded-preview" *ngIf="uploadedUrl || localPreviewUrl">
        <div class="thumb-box" *ngIf="isImage">
          <img [src]="previewSrc" (error)="onThumbError($event)" alt="Thumb" class="mini-thumb">
        </div>
        <div class="preview-info">
          <mat-icon class="check-icon">check_circle</mat-icon>
          <span class="url-text" [title]="uploadedUrl || localPreviewUrl">{{ uploadedUrl || localPreviewUrl }}</span>
        </div>
        <input type="file" #replaceFileInput (change)="onFileSelected($event)" style="display: none" [accept]="accept">
        <button type="button" mat-stroked-button class="replace-btn" (click)="replaceFileInput.click()" [disabled]="uploading">
          <mat-icon>upload</mat-icon> Replace File
        </button>
        <button type="button" mat-icon-button color="warn" (click)="clearUpload()" matTooltip="Remove Asset">
          <mat-icon>delete</mat-icon>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .upload-box {
      border: 1px dashed #28283a;
      background: #101018;
      border-radius: 10px;
      padding: 12px 14px;
      margin-bottom: 8px;
      transition: all 0.2s ease;
      &.has-file { border-color: #00e676; background: rgba(0, 230, 118, 0.05); }
    }

    .upload-controls {
      display: flex;
      align-items: center;
      justify-content: space-between;

      .btn-group {
        display: flex;
        gap: 10px;
        align-items: center;
        width: 100%;

        .upload-btn {
          flex: 1;
          height: 38px;
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
          background-color: #1a4cd8 !important;
          mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
        }

        .paste-btn {
          height: 38px;
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
          border-color: #00d2ff;
          color: #00d2ff;
          mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
        }
      }
    }

    .manual-url-box {
      .manual-input-row {
        display: flex;
        gap: 8px;
        align-items: center;

        .manual-input {
          flex: 1;
          background: #161622;
          border: 1px solid #28283a;
          border-radius: 6px;
          color: #ffffff;
          padding: 0 10px;
          height: 36px;
          font-size: 12px;
          &:focus { outline: none; border-color: #00d2ff; }
        }
        button { height: 36px; font-size: 12px; font-weight: 700; }
      }
    }

    .upload-progress {
      .progress-info {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        color: #00d2ff;
        margin-bottom: 6px;
        span { display: flex; align-items: center; gap: 4px; }
        .spin { animation: spin 1s linear infinite; font-size: 14px; width: 14px; height: 14px; }
      }
      .bar { height: 6px; border-radius: 3px; }
    }

    .uploaded-preview {
      display: flex;
      align-items: center;
      gap: 10px;

      .thumb-box {
        width: 34px;
        height: 34px;
        border-radius: 6px;
        overflow: hidden;
        background: #181824;
        border: 1px solid rgba(0, 230, 118, 0.4);
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;

        .mini-thumb {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
      }

      .preview-info {
        display: flex;
        align-items: center;
        gap: 6px;
        overflow: hidden;
        flex: 1;
        min-width: 0;

        .check-icon { color: #00e676; font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }
        .url-text {
          font-size: 11px;
          color: #ffffff;
          font-family: monospace;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      }

      .replace-btn {
        flex: 0 0 auto;
        height: 32px;
        margin-left: auto;
        border-color: #00b8d9;
        color: #72e9ff;
        font-size: 11px;
        font-weight: 700;
        mat-icon { font-size: 14px; width: 14px; height: 14px; margin-right: 3px; }
      }
    }

    @keyframes spin { 100% { transform: rotate(360deg); } }
  `]
})
export class MediaUploadComponent {
  private readonly http = inject(HttpClient);
  private readonly notificationService = inject(NotificationService);

  @Input() folder = 'posters';
  @Input() label = 'Asset File';
  @Input() accept = 'image/*,video/*';
  @Input() set initialUrl(val: string | null | undefined) {
    const clean = val ? val.trim() : '';
    this.uploadedUrl = clean;
    if (!this.localPreviewUrl || !this.localPreviewUrl.startsWith('data:')) {
      this.localPreviewUrl = clean;
    }
  }

  @Output() uploadComplete = new EventEmitter<string>();
  @Output() previewChange = new EventEmitter<string>();

  uploading = false;
  progress = 0;
  uploadedUrl = '';
  localPreviewUrl = '';
  showManualInput = false;
  manualUrlText = '';

  get isImage(): boolean {
    return this.accept.includes('image') ||
      (!!this.uploadedUrl && /\.(jpg|jpeg|png|webp|gif|svg|ico)(\?.*)?$/i.test(this.uploadedUrl)) ||
      (this.localPreviewUrl.startsWith('data:image') || this.localPreviewUrl.startsWith('blob:'));
  }

  /** Thumbnail URL: local previews stay as-is, stored URLs go through the media resolver. */
  get previewSrc(): string {
    const raw = this.localPreviewUrl || this.uploadedUrl;
    if (!raw) return '';
    if (raw.startsWith('data:') || raw.startsWith('blob:')) return raw;
    return resolveAdminImageUrl(raw);
  }

  onThumbError(event: any): void {
    if (event?.target && !event.target.dataset.errored) {
      event.target.dataset.errored = 'true';
      event.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34"><rect width="34" height="34" rx="4" fill="%231a1a2e"/><circle cx="17" cy="14" r="5" fill="%2300d2ff" fill-opacity="0.3"/><path d="M9 26l5-6 4 5 5-7 6 8H5z" fill="%2300d2ff"/></svg>';
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];

    // Immediate local image preview
    if (file.type.startsWith('image/') || this.accept.includes('image')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.localPreviewUrl = (e.target?.result as string) || '';
        this.previewChange.emit(this.localPreviewUrl);
      };
      reader.readAsDataURL(file);
    }

    this.uploadFile(file);
  }

  uploadFile(file: File): void {
    this.uploading = true;
    this.progress = 5;
    this.uploadMultipart(file);
  }

  private uploadMultipart(file: File): void {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', this.folder);

    this.http.post<any>(`${environment.apiBaseUrl}/storage/upload`, formData, {
      reportProgress: true,
      observe: 'events'
    }).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.progress = Math.round((100 * event.loaded) / event.total);
        } else if (event.type === HttpEventType.Response) {
          this.uploading = false;
          this.progress = 100;
          const res = event.body;
          if (res?.success && res?.data?.url) {
            this.uploadedUrl = res.data.url;
            this.notificationService.success(`${this.label} uploaded successfully!`);
            this.uploadComplete.emit(this.uploadedUrl);
          } else {
            this.notificationService.error(`Upload failed: unexpected server response.`);
            this.uploading = false;
          }
        }
      },
      error: (err) => {
        this.uploading = false;
        this.progress = 0;
        const msg = err?.error?.message || err?.message || 'Upload failed. Check storage credentials in Admin → Settings → Cloud Storage.';
        this.notificationService.error(msg);
      }
    });
  }

  saveManualUrl(): void {
    if (!this.manualUrlText || !this.manualUrlText.trim()) return;
    this.uploadedUrl = this.manualUrlText.trim();
    this.localPreviewUrl = this.uploadedUrl;
    this.showManualInput = false;
    this.notificationService.success(`${this.label} URL assigned!`);
    this.uploadComplete.emit(this.uploadedUrl);
    this.previewChange.emit(this.localPreviewUrl);
  }

  clearUpload(): void {
    this.uploadedUrl = '';
    this.localPreviewUrl = '';
    this.manualUrlText = '';
    this.showManualInput = false;
    this.uploadComplete.emit('');
    this.previewChange.emit('');
  }
}
