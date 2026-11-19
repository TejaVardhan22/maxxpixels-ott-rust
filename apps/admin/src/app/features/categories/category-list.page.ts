import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { environment } from '../../../environments/environment';
import { NotificationService } from '../../shared/services/notification.service';

export interface AdminCategory {
  id?: number;
  name: string;
  slug: string;
  title?: string;
}

@Component({
  selector: 'app-category-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatTableModule,
    MatCardModule,
  ],
  template: `
    <div class="page-container">
      <div class="header-row">
        <div>
          <span class="category-tag"><mat-icon>category</mat-icon> CATALOG TAXONOMY</span>
          <h1>Categories &amp; Genres</h1>
          <p>Manage content categories and genres displayed in user apps &amp; navigation bar.</p>
        </div>
        <button mat-raised-button color="primary" class="add-btn" (click)="startCreate()">
          <mat-icon>add</mat-icon> Add New Category
        </button>
      </div>

      <div class="content-grid">
        <!-- CATEGORIES LIST TABLE -->
        <mat-card class="list-card">
          <mat-card-header>
            <mat-card-title>All Categories ({{ categories.length }})</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="table-responsive">
              <table mat-table [dataSource]="categories" class="full-width-table">
              <ng-container matColumnDef="id">
                <th mat-header-cell *matHeaderCellDef>ID</th>
                <td mat-cell *matCellDef="let element">#{{ element.id }}</td>
              </ng-container>

              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Category Name</th>
                <td mat-cell *matCellDef="let element">
                  <strong>{{ element.name }}</strong>
                </td>
              </ng-container>

              <ng-container matColumnDef="slug">
                <th mat-header-cell *matHeaderCellDef>URL Slug</th>
                <td mat-cell *matCellDef="let element">
                  <span class="slug-badge">/bycategory/{{ element.slug }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>Actions</th>
                <td mat-cell *matCellDef="let element">
                  <button mat-icon-button color="accent" (click)="editCategory(element)" title="Edit">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button mat-icon-button color="warn" (click)="deleteCategory(element)" title="Delete">
                    <mat-icon>delete</mat-icon>
                  </button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
              </table>
            </div>

            <div *ngIf="categories.length === 0" class="empty-state">
              <mat-icon>category</mat-icon>
              <p>No custom categories created yet.</p>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- ADD / EDIT FORM -->
        <mat-card class="form-card" *ngIf="showForm">
          <mat-card-header>
            <mat-card-title>{{ editingId ? 'Edit Category' : 'Add Category' }}</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <form [formGroup]="form" (ngSubmit)="saveCategory()" class="cat-form">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Category Name</mat-label>
                <input matInput formControlName="name" placeholder="e.g. Action, Drama, Sci-Fi" required (input)="onNameInput()" />
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>URL Slug</mat-label>
                <input matInput formControlName="slug" placeholder="e.g. action" required />
                <mat-hint>Lowercase letters &amp; hyphens only</mat-hint>
              </mat-form-field>

              <div class="form-actions">
                <button mat-button type="button" (click)="cancelForm()">Cancel</button>
                <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || saving">
                  <mat-icon>{{ saving ? 'sync' : 'save' }}</mat-icon>
                  {{ saving ? 'Saving...' : (editingId ? 'Update Category' : 'Save Category') }}
                </button>
              </div>
            </form>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .page-container { color: #ffffff; padding: 12px; }
    .header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
    .category-tag { font-size: 11px; font-weight: 800; color: #ff5a60; text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; gap: 4px; }
    .header-row h1 { margin: 4px 0 2px; font-size: 26px; font-weight: 900; }
    .header-row p { margin: 0; color: #94a3b8; font-size: 14px; }
    .add-btn { border-radius: 9999px; font-weight: 700; }

    .content-grid { display: grid; grid-template-columns: 1fr 380px; gap: 24px; }
    @media (max-width: 960px) { .content-grid { grid-template-columns: 1fr; } }

    .list-card, .form-card { background-color: #1a1a24; border: 1px solid #2a2a38; border-radius: 16px; color: #ffffff; }
    mat-card-title { color: #ffffff; font-size: 18px; font-weight: 800; margin-bottom: 12px; }

    .full-width-table {
      width: 100%;
      min-width: 600px;
      background: transparent;
      border-collapse: collapse;
      th.mat-header-cell { color: #94a3b8; font-weight: 700; border-bottom: 1px solid #2a2a38; white-space: nowrap; }
      td.mat-cell { color: #ffffff; border-bottom: 1px solid #1a1a28; white-space: nowrap; }
    }

    .slug-badge { font-family: monospace; background: rgba(229, 9, 20, 0.15); border: 1px solid rgba(229, 9, 20, 0.3); color: #ff5a60; padding: 2px 8px; border-radius: 6px; font-size: 12px; }
    .empty-state { text-align: center; padding: 40px; color: #64748b; }
    .empty-state mat-icon { font-size: 48px; height: 48px; width: 48px; margin-bottom: 8px; }

    .cat-form { display: flex; flex-direction: column; gap: 16px; }
    .full-width { width: 100%; }
    .form-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 12px; }
  `]
})
export class CategoryListPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  private readonly notification = inject(NotificationService);

  categories: AdminCategory[] = [];
  displayedColumns = ['id', 'name', 'slug', 'actions'];

  showForm = false;
  editingId: number | null = null;
  saving = false;

  form = this.fb.group({
    name: ['', [Validators.required]],
    slug: ['', [Validators.required]],
  });

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.http.get<any>(`${environment.apiBaseUrl}/admin/categories`).subscribe({
      next: (res) => {
        const raw = res?.data ?? res?.result ?? res ?? [];
        this.categories = Array.isArray(raw) ? raw : [];
      },
      error: () => {
        // Fallback to public categories route if admin endpoint is guarded
        this.http.get<any>(`${environment.apiBaseUrl}/categories`).subscribe({
          next: (res) => {
            const raw = res?.data ?? res?.result ?? res ?? [];
            this.categories = Array.isArray(raw) ? raw : [];
          }
        });
      }
    });
  }

  startCreate(): void {
    this.editingId = null;
    this.form.reset();
    this.showForm = true;
  }

  editCategory(cat: AdminCategory): void {
    this.editingId = cat.id ?? null;
    this.form.patchValue({
      name: cat.name,
      slug: cat.slug,
    });
    this.showForm = true;
  }

  cancelForm(): void {
    this.showForm = false;
    this.editingId = null;
    this.form.reset();
  }

  onNameInput(): void {
    if (!this.editingId) {
      const nameVal = this.form.value.name || '';
      const generatedSlug = nameVal.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      this.form.patchValue({ slug: generatedSlug }, { emitEvent: false });
    }
  }

  saveCategory(): void {
    if (this.form.invalid) return;
    this.saving = true;

    const payload = {
      name: this.form.value.name?.trim(),
      slug: this.form.value.slug?.trim().toLowerCase(),
    };

    if (this.editingId) {
      this.http.put<any>(`${environment.apiBaseUrl}/admin/categories/${this.editingId}`, payload).subscribe({
        next: () => {
          this.saving = false;
          this.notification.success('Category updated successfully');
          this.cancelForm();
          this.loadCategories();
        },
        error: (err) => {
          this.saving = false;
          this.notification.error(err?.error?.message || 'Failed to update category');
        }
      });
    } else {
      this.http.post<any>(`${environment.apiBaseUrl}/admin/categories`, payload).subscribe({
        next: () => {
          this.saving = false;
          this.notification.success('Category created successfully');
          this.cancelForm();
          this.loadCategories();
        },
        error: (err) => {
          this.saving = false;
          this.notification.error(err?.error?.message || 'Failed to create category');
        }
      });
    }
  }

  async deleteCategory(cat: AdminCategory): Promise<void> {
    if (!cat.id) return;
    const ok = await this.notification.confirm(
      'Delete Category?',
      `Are you sure you want to delete category "${cat.name}"?`,
      'Yes, Delete'
    );
    if (!ok) return;

    this.http.delete<any>(`${environment.apiBaseUrl}/admin/categories/${cat.id}`).subscribe({
      next: () => {
        this.notification.success('Category deleted');
        this.loadCategories();
      },
      error: (err) => {
        this.notification.error(err?.error?.message || 'Failed to delete category');
      }
    });
  }
}
