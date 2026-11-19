import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  HomeContentApiService,
  PortalBanner,
} from '../../core/services/home-content-api.service';
import { StorageApiService } from '../../core/services/storage-api.service';
import { NotificationService } from '../../shared/services/notification.service';

@Component({
  selector: 'app-portal-banners-page',
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
          <span class="eyebrow"><mat-icon>view_carousel</mat-icon> HOME EXPERIENCE</span>
          <h1>Portal Banners</h1>
          <p>Manage the landscape banners shown on the portal selection screen in web and mobile apps.</p>
        </div>
        <button mat-raised-button class="primary-btn" (click)="toggleForm()">
          <mat-icon>{{ showForm ? 'close' : 'add' }}</mat-icon>
          {{ showForm ? 'Close Form' : (editingId ? 'Edit Banner' : 'New Portal Banner') }}
        </button>
      </div>

      <form class="card editor" *ngIf="showForm" [formGroup]="form" (ngSubmit)="submit()">
        <h2><mat-icon>banner</mat-icon> {{ editingId ? 'Edit Portal Banner' : 'Add Portal Banner' }}</h2>
        <div class="form-grid">
          <mat-form-field appearance="outline">
            <mat-label>Title</mat-label>
            <input matInput formControlName="title" placeholder="MAXX MOVIES & ENTERTAINMENT" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Portal Key</mat-label>
            <input matInput formControlName="portalKey" list="portal-keys" placeholder="all" />
            <datalist id="portal-keys">
              <option value="all"></option>
              <option value="movies"></option>
              <option value="kannada"></option>
              <option value="all-indian"></option>
              <option value="games"></option>
            </datalist>
          </mat-form-field>
          <mat-form-field appearance="outline" class="span-2">
            <mat-label>Subtitle</mat-label>
            <textarea matInput rows="2" formControlName="subtitle" placeholder="Short supporting text"></textarea>
          </mat-form-field>
          <mat-form-field appearance="outline" class="span-2">
            <mat-label>Landscape Image URL *</mat-label>
            <input matInput formControlName="imageUrl" placeholder="https://... or uploaded image URL" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="span-2">
            <mat-label>Mobile Image URL</mat-label>
            <input matInput formControlName="mobileImageUrl" placeholder="Optional mobile-specific image" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="span-2">
            <mat-label>Target URL</mat-label>
            <input matInput formControlName="targetUrl" placeholder="/?lang=kannada" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Button Label</mat-label>
            <input matInput formControlName="buttonLabel" placeholder="Explore Portal" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Display Order</mat-label>
            <input matInput type="number" formControlName="displayOrder" />
          </mat-form-field>
          <label class="active-toggle">
            <input type="checkbox" formControlName="isActive" />
            Visible to users
          </label>
        </div>

        <div class="upload-row">
          <input #imageInput type="file" accept="image/*" hidden (change)="upload($event, 'image')" />
          <button type="button" mat-stroked-button (click)="imageInput.click()" [disabled]="uploading === 'image'">
            <mat-icon>upload</mat-icon>
            {{ uploading === 'image' ? 'Uploading image...' : 'Upload Landscape Image' }}
          </button>
          <img *ngIf="form.get('imageUrl')?.value" [src]="form.get('imageUrl')?.value" alt="Preview" class="preview" />
        </div>

        <div class="actions">
          <button mat-button type="button" (click)="resetForm()">Cancel</button>
          <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || saving">
            {{ saving ? 'Saving...' : 'Save Portal Banner' }}
          </button>
        </div>
      </form>

      <div class="card">
        <h2><mat-icon>list</mat-icon> Banner Directory</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Banner</th>
                <th>Title</th>
                <th>Portal</th>
                <th>Target</th>
                <th>Order</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of items">
                <td><img *ngIf="item.imageUrl" [src]="item.imageUrl" alt="" /></td>
                <td>
                  <strong>{{ item.title }}</strong>
                  <small>{{ item.subtitle || 'No subtitle' }}</small>
                </td>
                <td><span class="portal-chip">{{ item.portalKey || 'all' }}</span></td>
                <td><a [href]="item.targetUrl" target="_blank">{{ item.targetUrl }}</a></td>
                <td>{{ item.displayOrder }}</td>
                <td>
                  <span class="badge" [class.inactive]="!item.isActive">{{ item.isActive ? 'ACTIVE' : 'INACTIVE' }}</span>
                </td>
                <td class="row-actions">
                  <button mat-button (click)="edit(item)"><mat-icon>edit</mat-icon> Edit</button>
                  <button mat-button (click)="toggle(item)"><mat-icon>toggle_on</mat-icon> {{ item.isActive ? 'Hide' : 'Show' }}</button>
                  <button mat-button color="warn" (click)="remove(item)"><mat-icon>delete</mat-icon> Delete</button>
                </td>
              </tr>
              <tr *ngIf="!items.length">
                <td colspan="7" class="empty">No portal banners yet. Add one to replace the hardcoded banners.</td>
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
    .preview { width: 160px; height: 80px; object-fit: cover; border-radius: 8px; border: 1px solid #3a3a4c; }
    .actions { display: flex; justify-content: flex-end; gap: 8px; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; color: #8f8fa3; font-size: 11px; text-transform: uppercase; padding: 10px 12px; border-bottom: 1px solid #2f2f3e; }
    td { padding: 10px 12px; border-bottom: 1px solid #262633; vertical-align: middle; }
    td small { display: block; color: #8f8fa3; margin-top: 3px; }
    td img { width: 96px; height: 54px; object-fit: cover; border-radius: 6px; }
    td a { color: #f5b301; word-break: break-all; }
    .portal-chip { padding: 4px 10px; border-radius: 999px; background: #2a2a3a; color: #d8d8e8; font-size: 11px; font-weight: 800; }
    .badge { padding: 4px 10px; border-radius: 999px; background: rgba(89,214,125,.14); color: #59d67d; font-size: 11px; font-weight: 800; }
    .badge.inactive { background: rgba(229,9,20,.14); color: #ff6b6b; }
    .row-actions { white-space: nowrap; }
    .empty { text-align: center; color: #8f8fa3; padding: 28px; }
    @media (max-width: 800px) { .form-grid { grid-template-columns: 1fr; } .span-2 { grid-column: auto; } }
  `],
})
export class PortalBannersPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(HomeContentApiService);
  private readonly storage = inject(StorageApiService);
  private readonly notify = inject(NotificationService);

  items: PortalBanner[] = [];
  showForm = false;
  saving = false;
  editingId: number | string | null = null;
  uploading: 'image' | null = null;

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required]],
    subtitle: [''],
    imageUrl: ['', [Validators.required]],
    mobileImageUrl: [''],
    targetUrl: ['/'],
    portalKey: ['all'],
    buttonLabel: ['Explore Portal'],
    displayOrder: [0],
    isActive: [true],
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.listPortalBanners().subscribe({
      next: (response) => { this.items = response.data || []; },
      error: (err) => this.notify.error(err?.error?.message || 'Unable to load portal banners'),
    });
  }

  toggleForm(): void {
    if (this.showForm) {
      this.resetForm();
      return;
    }
    this.showForm = true;
  }

  edit(item: PortalBanner): void {
    this.editingId = item.id ?? null;
    this.form.patchValue({
      title: item.title,
      subtitle: item.subtitle || '',
      imageUrl: item.imageUrl,
      mobileImageUrl: item.mobileImageUrl || '',
      targetUrl: item.targetUrl || '/',
      portalKey: item.portalKey || 'all',
      buttonLabel: item.buttonLabel || 'Explore Portal',
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
      subtitle: '',
      imageUrl: '',
      mobileImageUrl: '',
      targetUrl: '/',
      portalKey: 'all',
      buttonLabel: 'Explore Portal',
      displayOrder: 0,
      isActive: true,
    });
  }

  submit(): void {
    if (this.form.invalid) return;
    this.saving = true;
    const payload = this.form.getRawValue();
    const request = this.editingId
      ? this.api.updatePortalBanner(this.editingId, payload)
      : this.api.createPortalBanner(payload);
    request.subscribe({
      next: () => {
        this.saving = false;
        this.notify.success('Portal banner saved');
        this.resetForm();
        this.load();
      },
      error: (err) => {
        this.saving = false;
        this.notify.error(err?.error?.message || 'Unable to save portal banner');
      },
    });
  }

  toggle(item: PortalBanner): void {
    if (!item.id) return;
    this.api.togglePortalBanner(item.id).subscribe({
      next: () => { this.notify.success('Portal banner updated'); this.load(); },
      error: (err) => this.notify.error(err?.error?.message || 'Unable to update portal banner'),
    });
  }

  remove(item: PortalBanner): void {
    if (!item.id || !window.confirm(`Delete portal banner "${item.title}"?`)) return;
    this.api.deletePortalBanner(item.id).subscribe({
      next: () => { this.notify.success('Portal banner deleted'); this.load(); },
      error: (err) => this.notify.error(err?.error?.message || 'Unable to delete portal banner'),
    });
  }

  upload(event: Event, field: 'image'): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploading = field;
    this.storage.uploadFile(file, 'banners').subscribe({
      next: (result) => {
        if (result.url) this.form.patchValue({ imageUrl: result.url });
        if (result.progress === 100) this.uploading = null;
      },
      error: () => {
        this.uploading = null;
        this.notify.error('Upload failed');
      },
    });
  }
}
