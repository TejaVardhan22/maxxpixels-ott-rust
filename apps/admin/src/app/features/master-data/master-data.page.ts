import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { environment } from '../../../environments/environment';
import { NotificationService } from '../../shared/services/notification.service';

export interface MasterField {
  key: string;
  label: string;
  required?: boolean;
  hint?: string;
}

export interface MasterTab {
  key: string;
  label: string;
  icon: string;
  listUrl: string;
  createUrl: string;
  updateUrl: (row: any) => string;
  deleteUrl: (row: any) => string;
  fields: MasterField[];
}

@Component({
  selector: 'app-master-data',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatTableModule,
    MatCardModule,
    MatTabsModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="page-container">
      <div class="header-row">
        <div>
          <span class="category-tag"><mat-icon>dataset</mat-icon> CONTENT BASIC DETAILS</span>
          <h1>Basic Details</h1>
          <p>Manage Main Types, Categories, Genres, Languages, Cast People &amp; Producers used across content forms.</p>
        </div>
      </div>

      <mat-tab-group [(selectedIndex)]="activeTab" (selectedTabChange)="onTabChange()" class="md-tabs">
        <mat-tab *ngFor="let tab of tabs" [label]="tab.label">
          <div class="content-grid" [class.has-form]="showForm">
            <!-- LIST -->
            <mat-card class="list-card">
              <div class="card-top-bar">
                <div class="card-title-group">
                  <mat-icon class="card-title-icon">{{ tab.icon }}</mat-icon>
                  <span class="card-title-text">All {{ tab.label }}</span>
                  <span class="count-pill">{{ rows.length }}</span>
                </div>
                <span class="title-actions">
                  <button
                    *ngIf="activeTabConfig.key === 'languages'"
                    mat-stroked-button
                    class="secondary-btn"
                    (click)="consolidateLanguages()"
                    [disabled]="consolidating"
                  >
                    <mat-icon>{{ consolidating ? 'sync' : 'merge_type' }}</mat-icon>
                    {{ consolidating ? 'Consolidating...' : 'Consolidate Duplicates' }}
                  </button>
                  <button mat-flat-button class="theme-primary-btn" (click)="startCreate()">
                    <mat-icon>add</mat-icon> Add {{ singular(tab.label) }}
                  </button>
                </span>
              </div>
              <mat-card-content>
                <div *ngIf="loading" class="loading-state"><mat-spinner diameter="36"></mat-spinner></div>

                <div *ngIf="!loading" class="table-responsive">
                  <table mat-table [dataSource]="rows" class="full-width-table">
                    <ng-container matColumnDef="id">
                      <th mat-header-cell *matHeaderCellDef>ID</th>
                      <td mat-cell *matCellDef="let element" class="id-cell">#{{ element.id ?? element.code }}</td>
                    </ng-container>

                    <ng-container *ngFor="let f of activeTabConfig.fields" [matColumnDef]="f.key">
                      <th mat-header-cell *matHeaderCellDef>{{ f.label }}</th>
                      <td mat-cell *matCellDef="let element">
                        <ng-container *ngIf="f.key === 'imageUrl'; else textCell">
                          <img *ngIf="getCellValue(element, f.key) !== '—'" [src]="getCellValue(element, f.key)" class="avatar-thumb" alt="Profile">
                          <span *ngIf="getCellValue(element, f.key) === '—'" class="muted-cell">—</span>
                        </ng-container>
                        <ng-template #textCell>
                          <span [class.primary-cell]="f.key === 'name' || f.key === 'studioName'" [class.muted-cell]="getCellValue(element, f.key) === '—'">
                            {{ getCellValue(element, f.key) }}
                          </span>
                        </ng-template>
                      </td>
                    </ng-container>

                    <ng-container matColumnDef="actions">
                      <th mat-header-cell *matHeaderCellDef class="actions-header">Actions</th>
                      <td mat-cell *matCellDef="let element" class="actions-cell">
                        <button mat-icon-button class="edit-icon-btn" (click)="editRow(element)" title="Edit">
                          <mat-icon>edit</mat-icon>
                        </button>
                        <button mat-icon-button class="delete-icon-btn" (click)="deleteRow(element)" title="Soft Delete">
                          <mat-icon>delete</mat-icon>
                        </button>
                      </td>
                    </ng-container>

                    <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                    <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="data-row"></tr>
                  </table>
                </div>

                <div *ngIf="!loading && rows.length === 0" class="empty-state">
                  <mat-icon>{{ activeTabConfig.icon }}</mat-icon>
                  <p>No {{ tab.label.toLowerCase() }} found yet. Click Add to create one.</p>
                </div>
              </mat-card-content>
            </mat-card>

            <!-- ADD / EDIT FORM -->
            <mat-card class="form-card" *ngIf="showForm">
              <div class="card-top-bar">
                <div class="card-title-group">
                  <mat-icon class="card-title-icon">{{ editingKey ? 'edit' : 'add_circle' }}</mat-icon>
                  <span class="card-title-text">{{ editingKey ? 'Edit' : 'Add' }} {{ singular(activeTabConfig.label) }}</span>
                </div>
                <button mat-icon-button type="button" (click)="cancelForm()" title="Close">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
              <mat-card-content>
                <form [formGroup]="form" (ngSubmit)="saveRow()" class="cat-form">
                  <mat-form-field *ngFor="let f of activeTabConfig.fields" appearance="outline" class="full-width field-spaced">
                    <mat-label>{{ f.label }}</mat-label>
                    <input
                      matInput
                      [formControlName]="f.key"
                      [placeholder]="f.hint || ''"
                      [required]="!!f.required"
                      (input)="f.key === 'name' ? onNameInput() : null"
                    />
                    <mat-hint *ngIf="f.hint">{{ f.hint }}</mat-hint>
                  </mat-form-field>

                  <div class="form-actions">
                    <button mat-stroked-button type="button" class="cancel-btn" (click)="cancelForm()">Cancel</button>
                    <button mat-flat-button class="theme-primary-btn" type="submit" [disabled]="form.invalid || saving">
                      <mat-icon>{{ saving ? 'sync' : 'save' }}</mat-icon>
                      {{ saving ? 'Saving...' : (editingKey ? 'Update' : 'Save') }}
                    </button>
                  </div>
                </form>
              </mat-card-content>
            </mat-card>
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [`
    .page-container { color: #f8fafc; padding: 16px 20px; }
    .header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
    .category-tag { font-size: 11px; font-weight: 800; color: #ff4757; text-transform: uppercase; letter-spacing: 1.2px; display: flex; align-items: center; gap: 6px; }
    .category-tag mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .header-row h1 { margin: 6px 0 4px; font-size: 28px; font-weight: 800; letter-spacing: -0.02em; }
    .header-row p { margin: 0; color: #94a3b8; font-size: 14px; }

    ::ng-deep .md-tabs .mdc-tab-indicator__content--underline { border-color: #e50914 !important; border-top-width: 3px !important; }
    ::ng-deep .md-tabs .mdc-tab--active .mdc-tab__text-label { color: #ffffff !important; font-weight: 700 !important; }
    ::ng-deep .md-tabs .mdc-tab__text-label { color: #94a3b8 !important; font-weight: 500; }

    .content-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 20px; padding-top: 18px; align-items: start; }
    .content-grid.has-form { grid-template-columns: minmax(0, 1fr) 340px; }
    @media (max-width: 1200px) { .content-grid.has-form { grid-template-columns: minmax(0, 1fr); } }

    .list-card, .form-card {
      background: #12141e;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      color: #f8fafc;
      padding: 20px;
      box-sizing: border-box;
      min-width: 0;
      max-width: 100%;
      overflow: hidden;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.35);
    }
    .list-card mat-card-content, .form-card mat-card-content {
      padding: 0 !important;
      margin: 0 !important;
    }
    .card-top-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      padding-bottom: 16px;
      margin-bottom: 14px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    }
    .card-title-group { display: flex; align-items: center; gap: 10px; }
    .card-title-icon { color: #ff4757; font-size: 20px; width: 20px; height: 20px; }
    .card-title-text { font-size: 17px; font-weight: 700; color: #ffffff; }
    .count-pill {
      font-size: 12px;
      font-weight: 700;
      padding: 2px 10px;
      border-radius: 999px;
      background: rgba(229, 9, 20, 0.16);
      color: #ff6b81;
    }
    .title-actions { display: flex; align-items: center; gap: 10px; }

    .theme-primary-btn {
      background: linear-gradient(135deg, #e50914, #f43f5e) !important;
      color: #ffffff !important;
      border-radius: 10px !important;
      font-weight: 700 !important;
      padding: 0 18px !important;
      height: 38px !important;
    }
    .theme-primary-btn:disabled {
      opacity: 0.45 !important;
    }
    .secondary-btn {
      border-color: rgba(255, 255, 255, 0.18) !important;
      color: #e2e8f0 !important;
      border-radius: 10px !important;
      height: 38px !important;
    }
    .cancel-btn {
      border-color: rgba(255, 255, 255, 0.16) !important;
      color: #cbd5e1 !important;
      border-radius: 10px !important;
      height: 38px !important;
    }

    .table-responsive { overflow-x: auto; max-width: 100%; }
    .full-width-table {
      width: 100%;
      background: transparent;
      border-collapse: collapse;
    }
    .full-width-table th.mat-mdc-header-cell {
      color: #94a3b8;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding: 12px 14px;
    }
    .full-width-table td.mat-mdc-cell {
      color: #e2e8f0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      padding: 12px 14px;
      font-size: 13.5px;
    }
    .data-row:hover { background: rgba(255, 255, 255, 0.03); }
    .id-cell { color: #64748b !important; font-family: monospace; }
    .primary-cell { color: #ffffff; font-weight: 600; }
    .muted-cell { color: #64748b; }
    .avatar-thumb { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(255,255,255,0.15); }
    .actions-header, .actions-cell { text-align: right; white-space: nowrap; }
    .edit-icon-btn { color: #38bdf8 !important; }
    .delete-icon-btn { color: #f43f5e !important; }

    .empty-state { text-align: center; padding: 48px 20px; color: #64748b; }
    .empty-state mat-icon { font-size: 40px; width: 40px; height: 40px; opacity: 0.5; margin-bottom: 8px; }
    .loading-state { display: flex; justify-content: center; padding: 36px; }
    .full-width { width: 100%; }
    .cat-form { display: flex; flex-direction: column; gap: 18px; padding-top: 6px; }
    .field-spaced { margin-bottom: 4px; }
    .form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; }
  `]
})
export class MasterDataPage implements OnInit {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private notify = inject(NotificationService);

  readonly tabs: MasterTab[] = [
    {
      key: 'content-types',
      label: 'Main Types',
      icon: 'movie_filter',
      listUrl: `${environment.apiBaseUrl}/content-types`,
      createUrl: `${environment.apiBaseUrl}/admin/content-types`,
      updateUrl: (row) => `${environment.apiBaseUrl}/admin/content-types/${row.id}`,
      deleteUrl: (row) => `${environment.apiBaseUrl}/admin/content-types/${row.id}`,
      fields: [
        { key: 'name', label: 'Main Type Name', required: true, hint: 'e.g. Movie, Web Series, Song, Short Film, Podcast' },
        { key: 'slug', label: 'URL Slug', hint: 'auto-generated if left blank' },
        { key: 'description', label: 'Description (optional)' },
      ],
    },
    {
      key: 'categories',
      label: 'Categories',
      icon: 'category',
      listUrl: `${environment.apiBaseUrl}/categories`,
      createUrl: `${environment.apiBaseUrl}/admin/categories`,
      updateUrl: (row) => `${environment.apiBaseUrl}/admin/categories/${row.id}`,
      deleteUrl: (row) => `${environment.apiBaseUrl}/admin/categories/${row.id}`,
      fields: [
        { key: 'name', label: 'Category Name', required: true, hint: 'e.g. Trending Now, New Releases' },
        { key: 'slug', label: 'URL Slug', required: true, hint: 'lowercase letters & hyphens' },
        { key: 'description', label: 'Description (optional)' },
      ],
    },
    {
      key: 'genres',
      label: 'Genres',
      icon: 'theater_comedy',
      listUrl: `${environment.apiBaseUrl}/genres`,
      createUrl: `${environment.apiBaseUrl}/admin/genres`,
      updateUrl: (row) => `${environment.apiBaseUrl}/admin/genres/${row.id}`,
      deleteUrl: (row) => `${environment.apiBaseUrl}/admin/genres/${row.id}`,
      fields: [
        { key: 'name', label: 'Genre Name', required: true, hint: 'e.g. Action, Drama, Thriller' },
        { key: 'slug', label: 'URL Slug', hint: 'auto-generated if left blank (lowercase & hyphens)' },
      ],
    },
    {
      key: 'languages',
      label: 'Languages',
      icon: 'translate',
      listUrl: `${environment.apiBaseUrl}/languages`,
      createUrl: `${environment.apiBaseUrl}/admin/languages`,
      updateUrl: (row) => `${environment.apiBaseUrl}/admin/languages/${row.code}`,
      deleteUrl: (row) => `${environment.apiBaseUrl}/admin/languages/${row.code}`,
      fields: [
        { key: 'name', label: 'Language Name', required: true, hint: 'e.g. Kannada' },
        { key: 'code', label: 'Language Code', required: true, hint: 'e.g. kn (lowercase)' },
      ],
    },
    {
      key: 'cast',
      label: 'Cast People',
      icon: 'recent_actors',
      listUrl: `${environment.apiBaseUrl}/admin/cast`,
      createUrl: `${environment.apiBaseUrl}/admin/cast`,
      updateUrl: (row) => `${environment.apiBaseUrl}/admin/cast/${row.id}`,
      deleteUrl: (row) => `${environment.apiBaseUrl}/admin/cast/${row.id}`,
      fields: [
        { key: 'name', label: 'Person Name', required: true, hint: 'e.g. Prabhas, Deepika Padukone' },
        { key: 'role', label: 'Role', hint: 'Actor, Actress, Director, Music Director' },
        { key: 'imageUrl', label: 'Profile Photo URL', hint: 'Full image URL or upload inside Movie Form' },
        { key: 'bio', label: 'Short Bio (optional)' },
      ],
    },
    {
      key: 'producers',
      label: 'Producers',
      icon: 'business',
      listUrl: `${environment.apiBaseUrl}/admin/producers`,
      createUrl: `${environment.apiBaseUrl}/admin/producers/onboard`,
      updateUrl: (row) => `${environment.apiBaseUrl}/admin/producers/${row.id}`,
      deleteUrl: (row) => `${environment.apiBaseUrl}/admin/producers/${row.id}`,
      fields: [
        { key: 'studioName', label: 'Studio / Producer Name', required: true, hint: 'e.g. Maxx Studios' },
        { key: 'email', label: 'Email', required: true, hint: 'producer@studio.com' },
        { key: 'phone', label: 'Phone (optional)' },
        { key: 'contactPerson', label: 'Contact Person (optional)' },
      ],
    },
  ];

  activeTab = 0;
  loading = false;
  saving = false;
  consolidating = false;
  showForm = false;
  editingKey: string | null = null; // row identity value (id or code) when editing
  rows: any[] = [];
  form: FormGroup = this.fb.group({});
  displayedColumns: string[] = [];

  get activeTabConfig(): MasterTab {
    return this.tabs[this.activeTab];
  }

  singular(label: string): string {
    return label.endsWith('s') ? label.slice(0, -1) : label;
  }

  ngOnInit(): void {
    this.buildForm();
    this.loadRows();
  }

  onTabChange(): void {
    this.cancelForm();
    this.buildForm();
    this.loadRows();
  }

  private buildForm(): void {
    const group: any = {};
    for (const f of this.activeTabConfig.fields) {
      group[f.key] = [ '', f.required ? Validators.required : [] ];
    }
    this.form = this.fb.group(group);
    this.displayedColumns = ['id', ...this.activeTabConfig.fields.map(f => f.key), 'actions'];
  }

  loadRows(): void {
    this.loading = true;
    this.http.get<any>(this.activeTabConfig.listUrl).subscribe({
      next: (res) => {
        this.rows = res?.data ?? res?.result ?? res ?? [];
        if (!Array.isArray(this.rows)) this.rows = [];
        this.loading = false;
      },
      error: () => {
        this.rows = [];
        this.loading = false;
      }
    });
  }

  consolidateLanguages(): void {
    if (this.consolidating) return;
    this.consolidating = true;
    this.http
      .post<any>(`${environment.apiBaseUrl}/admin/master-data/languages/consolidate-duplicates`, {})
      .subscribe({
        next: (res) => {
          const data = res?.data ?? res?.result ?? res ?? {};
          const merged: any[] = Array.isArray(data.merged) ? data.merged : [];
          const count = data.mergedCount ?? merged.length;
          if (count > 0) {
            const detail = merged.map((m) => `${m.removedCode} → ${m.canonicalCode}`).join(', ');
            this.notify.success(`Merged ${count} duplicate language(s): ${detail}`);
          } else {
            this.notify.info('No duplicate languages found — already clean');
          }
          this.consolidating = false;
          this.loadRows();
        },
        error: (err) => {
          this.consolidating = false;
          this.notify.error(err?.error?.message || 'Consolidation failed');
        }
      });
  }

  startCreate(): void {
    this.editingKey = null;
    this.form.reset();
    this.showForm = true;
  }

  getCellValue(row: any, key: string): string {
    if (!row) return '—';
    if (key === 'name') {
      const v = row.name || row.title || row.slug || '';
      return String(v).trim() || '—';
    }
    if (key === 'studioName') {
      const v = row.studioName || row.companyName || row.name || '';
      return String(v).trim() || '—';
    }
    if (key === 'imageUrl') {
      const v = row.imageUrl || row.image || row.photoUrl || '';
      return String(v).trim() || '—';
    }
    const v = row[key];
    return v !== undefined && v !== null && String(v).trim() !== '' ? String(v) : '—';
  }

  editRow(row: any): void {
    // Identity is the numeric id for genres/content-types/categories, and the code for languages
    this.editingKey = this.activeTabConfig.key === 'languages' ? String(row.code) : String(row.id);
    for (const f of this.activeTabConfig.fields) {
      let val = row[f.key];
      if (f.key === 'name' && (!val || !String(val).trim())) {
        val = row.title || row.slug || '';
      } else if (f.key === 'studioName' && (!val || !String(val).trim())) {
        val = row.companyName || row.name || '';
      } else if (f.key === 'imageUrl' && (!val || !String(val).trim())) {
        val = row.image || row.photoUrl || '';
      }
      this.form.get(f.key)?.setValue(val ?? '');
    }
    this.showForm = true;
  }

  onNameInput(): void {
    // Auto-fill slug from name when slug is empty (genres / content types / categories)
    const slugCtrl = this.form.get('slug');
    const nameCtrl = this.form.get('name');
    if (slugCtrl && nameCtrl && !slugCtrl.value) {
      slugCtrl.setValue(String(nameCtrl.value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, ''), { emitEvent: false });
    }
  }

  saveRow(): void {
    if (this.form.invalid || this.saving) return;
    this.saving = true;

    const cfg = this.activeTabConfig;
    const body: any = { ...this.form.value };
    // Content-type API reads title/name
    if (cfg.key === 'content-types') body.title = body.name;

    const isEdit = !!this.editingKey;
    const req$ = isEdit
      ? this.http.put<any>(cfg.updateUrl(this.rowForUpdate()), body)
      : this.http.post<any>(cfg.createUrl, body);

    req$.subscribe({
      next: () => {
        this.notify.success(`${this.singular(cfg.label)} ${isEdit ? 'updated' : 'created'} successfully`);
        this.saving = false;
        this.cancelForm();
        this.loadRows();
      },
      error: (err) => {
        this.saving = false;
        const msg = err?.error?.message || `Failed to save ${cfg.label.toLowerCase()}`;
        this.notify.error(msg);
      }
    });
  }

  private rowForUpdate(): any {
    // Reconstruct a minimal identity object for the update/delete URL builders
    if (this.activeTabConfig.key === 'languages') return { code: this.editingKey };
    return { id: Number(this.editingKey) };
  }

  async deleteRow(row: any): Promise<void> {
    const label = this.singular(this.activeTabConfig.label);
    const name = row.name || row.title || row.studioName || row.code;
    const ok = await this.notify.confirm(
      `Delete ${label}?`,
      `Are you sure you want to delete "${name}"? It will be safely soft-deleted.`,
      'Yes, Delete'
    );
    if (!ok) return;

    this.http.delete<any>(this.activeTabConfig.deleteUrl(row)).subscribe({
      next: () => {
        this.notify.success(`${label} deleted`);
        this.loadRows();
      },
      error: (err) => {
        const msg = err?.error?.message || `Failed to delete ${label.toLowerCase()}`;
        this.notify.error(msg);
      }
    });
  }

  cancelForm(): void {
    this.showForm = false;
    this.editingKey = null;
    this.form.reset();
  }
}
