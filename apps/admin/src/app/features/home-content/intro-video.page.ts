import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  HomeContentApiService,
  IntroVideo,
} from '../../core/services/home-content-api.service';
import { StorageApiService } from '../../core/services/storage-api.service';
import { NotificationService } from '../../shared/services/notification.service';

@Component({
  selector: 'app-intro-video-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
  ],
  template: `
    <div class="page">
      <div class="header-row">
        <div>
          <span class="eyebrow"><mat-icon>play_circle_filled</mat-icon> HOME EXPERIENCE</span>
          <h1>Intro Video</h1>
          <p>Upload and activate the video shown when users first open the app or website.</p>
        </div>
        <button mat-raised-button class="primary-btn" (click)="toggleForm()">
          <mat-icon>{{ showForm ? 'close' : 'add' }}</mat-icon>
          {{ showForm ? 'Close Form' : (editingId ? 'Edit Intro' : 'New Intro Video') }}
        </button>
      </div>

      <form class="card editor" *ngIf="showForm" [formGroup]="form" (ngSubmit)="submit()">
        <h2><mat-icon>video_settings</mat-icon> {{ editingId ? 'Edit Intro Video' : 'Add Intro Video' }}</h2>
        <div class="form-grid">
          <mat-form-field appearance="outline">
            <mat-label>Title</mat-label>
            <input matInput formControlName="title" placeholder="Welcome to MaxxPixels" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Button Label</mat-label>
            <input matInput formControlName="ctaLabel" placeholder="Watch Intro" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="span-2">
            <mat-label>Description</mat-label>
            <textarea matInput rows="2" formControlName="description" placeholder="Short intro description"></textarea>
          </mat-form-field>
          <mat-form-field appearance="outline" class="span-2">
            <mat-label>Video URL</mat-label>
            <input matInput formControlName="videoUrl" placeholder="https://... or uploaded file URL" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="span-2">
            <mat-label>Poster Image URL</mat-label>
            <input matInput formControlName="posterUrl" placeholder="https://... or uploaded image URL" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Display Order</mat-label>
            <input matInput type="number" formControlName="displayOrder" />
          </mat-form-field>
          <label class="active-toggle">
            <input type="checkbox" formControlName="isActive" />
            Active (shown to users)
          </label>
        </div>

        <div class="upload-row">
          <input #videoInput type="file" accept="video/*" hidden (change)="upload($event, 'video')" />
          <button type="button" mat-stroked-button (click)="videoInput.click()" [disabled]="uploading === 'video'">
            <mat-icon>upload</mat-icon>
            {{ uploading === 'video' ? 'Uploading video...' : 'Upload Video' }}
          </button>
          <input #posterInput type="file" accept="image/*" hidden (change)="upload($event, 'poster')" />
          <button type="button" mat-stroked-button (click)="posterInput.click()" [disabled]="uploading === 'poster'">
            <mat-icon>image</mat-icon>
            {{ uploading === 'poster' ? 'Uploading poster...' : 'Upload Poster' }}
          </button>
          <a *ngIf="form.get('videoUrl')?.value" [href]="form.get('videoUrl')?.value" target="_blank">Preview video</a>
        </div>

        <div class="actions">
          <button mat-button type="button" (click)="resetForm()">Cancel</button>
          <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || saving">
            {{ saving ? 'Saving...' : 'Save Intro Video' }}
          </button>
        </div>
      </form>

      <div class="card">
        <h2><mat-icon>list</mat-icon> Intro Videos</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Poster</th>
                <th>Title</th>
                <th>Video</th>
                <th>Order</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of items">
                <td><img *ngIf="item.posterUrl" [src]="item.posterUrl" alt="" /></td>
                <td>
                  <strong>{{ item.title }}</strong>
                  <small>{{ item.description || 'No description' }}</small>
                </td>
                <td><a [href]="item.videoUrl" target="_blank">Open video</a></td>
                <td>{{ item.displayOrder }}</td>
                <td>
                  <span class="badge" [class.inactive]="!item.isActive">{{ item.isActive ? 'ACTIVE' : 'INACTIVE' }}</span>
                </td>
                <td class="row-actions">
                  <button mat-button (click)="edit(item)"><mat-icon>edit</mat-icon> Edit</button>
                  <button mat-button *ngIf="!item.isActive" (click)="activate(item)"><mat-icon>check_circle</mat-icon> Activate</button>
                  <button mat-button color="warn" (click)="remove(item)"><mat-icon>delete</mat-icon> Delete</button>
                </td>
              </tr>
              <tr *ngIf="!items.length">
                <td colspan="6" class="empty">No intro video configured yet.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page { padding: 24px; color: #e9e9f2; }
    .header-row { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 18px; }
    .eyebrow { display: inline-flex; align-items: center; gap: 6px; color: #f5b301; font-size: 11px; font-weight: 800; letter-spacing: .12em; }
    .eyebrow mat-icon { font-size: 16px; width: 16px; height: 16px; }
    h1 { margin: 6px 0 4px; font-size: 28px; font-weight: 800; }
    h2 { display: flex; align-items: center; gap: 8px; margin: 0 0 16px; font-size: 17px; }
    p { margin: 0; color: #9a9aae; font-size: 13px; }
    .primary-btn { background: #e50914 !important; color: #fff !important; }
    .card { padding: 20px; background: #1a1a24; border: 1px solid #2a2a38; border-radius: 14px; margin-bottom: 18px; }
    .editor { margin-top: 12px; }
    .form-grid { display: grid; grid-template-columns: repeat(2, minmax(220px, 1fr)); gap: 8px 16px; }
    .span-2 { grid-column: 1 / -1; }
    .active-toggle { display: flex; align-items: center; gap: 8px; align-self: center; color: #c8c8d6; font-size: 13px; }
    .upload-row { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin: 12px 0 18px; }
    .upload-row a { color: #f5b301; font-size: 12px; }
    .actions { display: flex; justify-content: flex-end; gap: 8px; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; color: #8f8fa3; font-size: 11px; text-transform: uppercase; padding: 10px 12px; border-bottom: 1px solid #2f2f3e; }
    td { padding: 10px 12px; border-bottom: 1px solid #262633; vertical-align: middle; }
    td small { display: block; color: #8f8fa3; margin-top: 3px; }
    td img { width: 84px; height: 48px; object-fit: cover; border-radius: 6px; }
    td a { color: #f5b301; }
    .badge { padding: 4px 10px; border-radius: 999px; background: rgba(89,214,125,.14); color: #59d67d; font-size: 11px; font-weight: 800; }
    .badge.inactive { background: rgba(229,9,20,.14); color: #ff6b6b; }
    .row-actions { white-space: nowrap; }
    .empty { text-align: center; color: #8f8fa3; padding: 28px; }
    @media (max-width: 800px) { .form-grid { grid-template-columns: 1fr; } .span-2 { grid-column: auto; } }
  `],
})
export class IntroVideoPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(HomeContentApiService);
  private readonly storage = inject(StorageApiService);
  private readonly notify = inject(NotificationService);

  items: IntroVideo[] = [];
  showForm = false;
  saving = false;
  editingId: number | string | null = null;
  uploading: 'video' | 'poster' | null = null;

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required]],
    description: [''],
    videoUrl: ['', [Validators.required]],
    posterUrl: [''],
    ctaLabel: ['Watch Intro'],
    displayOrder: [0],
    isActive: [false],
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.listIntroVideos().subscribe({
      next: (response) => { this.items = response.data || []; },
      error: (err) => this.notify.error(err?.error?.message || 'Unable to load intro videos'),
    });
  }

  toggleForm(): void {
    if (this.showForm) {
      this.resetForm();
      return;
    }
    this.showForm = true;
  }

  edit(item: IntroVideo): void {
    this.editingId = item.id ?? null;
    this.form.patchValue({
      title: item.title,
      description: item.description || '',
      videoUrl: item.videoUrl,
      posterUrl: item.posterUrl || '',
      ctaLabel: item.ctaLabel || 'Watch Intro',
      displayOrder: item.displayOrder || 0,
      isActive: item.isActive,
    });
    this.showForm = true;
  }

  resetForm(): void {
    this.editingId = null;
    this.showForm = false;
    this.form.reset({
      title: '',
      description: '',
      videoUrl: '',
      posterUrl: '',
      ctaLabel: 'Watch Intro',
      displayOrder: 0,
      isActive: false,
    });
  }

  submit(): void {
    if (this.form.invalid) return;
    this.saving = true;
    const payload = this.form.getRawValue();
    const request = this.editingId
      ? this.api.updateIntroVideo(this.editingId, payload)
      : this.api.createIntroVideo(payload);
    request.subscribe({
      next: () => {
        this.saving = false;
        this.notify.success('Intro video saved');
        this.resetForm();
        this.load();
      },
      error: (err) => {
        this.saving = false;
        this.notify.error(err?.error?.message || 'Unable to save intro video');
      },
    });
  }

  activate(item: IntroVideo): void {
    if (!item.id) return;
    this.api.activateIntroVideo(item.id).subscribe({
      next: () => { this.notify.success('Intro video activated'); this.load(); },
      error: (err) => this.notify.error(err?.error?.message || 'Unable to activate intro video'),
    });
  }

  remove(item: IntroVideo): void {
    if (!item.id || !window.confirm(`Delete intro video "${item.title}"?`)) return;
    this.api.deleteIntroVideo(item.id).subscribe({
      next: () => { this.notify.success('Intro video deleted'); this.load(); },
      error: (err) => this.notify.error(err?.error?.message || 'Unable to delete intro video'),
    });
  }

  upload(event: Event, field: 'video' | 'poster'): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploading = field;
    this.storage.uploadFile(file, field === 'video' ? 'videos' : 'posters').subscribe({
      next: (result) => {
        if (result.url) {
          this.form.patchValue(field === 'video' ? { videoUrl: result.url } : { posterUrl: result.url });
        }
        if (result.progress === 100) this.uploading = null;
      },
      error: () => {
        this.uploading = null;
        this.notify.error('Upload failed');
      },
    });
  }
}
