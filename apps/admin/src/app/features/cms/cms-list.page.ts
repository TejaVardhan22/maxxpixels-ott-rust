import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { NotificationService } from '../../shared/services/notification.service';
import { environment } from '../../../environments/environment';

export interface CmsItem {
  id: number;
  contentId: number;
  title: string;
  contentType: string;
  posterUrl: string;
  backdropUrl?: string;
  displayOrder: number;
}

export interface CmsSection {
  id: number;
  title: string;
  sectionType: string;
  layout: string;
  displayOrder: number;
  active: boolean;
  itemCount: number;
  targetAudience: string;
  items?: CmsItem[];
}

@Component({
  selector: 'app-cms-list-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTooltipModule,
    DragDropModule
  ],
  template: `
    <div class="page-container">
      <!-- 1. HEADER -->
      <div class="header-row">
        <div>
          <span class="category-tag"><mat-icon>view_quilt</mat-icon> HOME SCREEN CMS</span>
          <h1>Home Layout Manager</h1>
          <p>Drag rows to reorder what viewers see on Web &amp; Mobile — order saves automatically.</p>
        </div>
        <div class="header-actions">
          <button type="button" class="preview-toggle-btn" [class.active]="showLivePreview" (click)="showLivePreview = !showLivePreview">
            <mat-icon>smartphone</mat-icon> {{ showLivePreview ? 'Hide App Preview' : 'App Layout Preview' }}
          </button>
          <button mat-raised-button class="add-btn" (click)="openCreateModal()">
            <mat-icon>add</mat-icon> New Home Row
          </button>
        </div>
      </div>

      <!-- 2. DYNAMIC KPI STRIP -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-icon crimson"><mat-icon>view_list</mat-icon></div>
          <div>
            <span class="kpi-label">Total Home Rows</span>
            <div class="kpi-val">{{ sections.length }}</div>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-icon green"><mat-icon>check_circle</mat-icon></div>
          <div>
            <span class="kpi-label">Live on Web &amp; App</span>
            <div class="kpi-val">{{ getActiveCount() }}</div>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-icon gold"><mat-icon>view_carousel</mat-icon></div>
          <div>
            <span class="kpi-label">Hero Banners</span>
            <div class="kpi-val">{{ getHeroCount() }}</div>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-icon blue"><mat-icon>movie</mat-icon></div>
          <div>
            <span class="kpi-label">Attached Titles</span>
            <div class="kpi-val">{{ getTotalItemsCount() }}</div>
          </div>
        </div>
      </div>

      <!-- 3. QUICK-ADD PRESET BAR -->
      <div class="preset-bar">
        <span class="preset-label"><mat-icon>bolt</mat-icon> Quick Add Row:</span>
        <button type="button" class="preset-chip" (click)="openPreset('Hero Spotlight', 'HERO_BANNER', 'BANNER')">+ Hero Banner</button>
        <button type="button" class="preset-chip" (click)="openPreset('Trending Now', 'TRENDING_RAIL', 'PORTRAIT')">+ Trending Row</button>
        <button type="button" class="preset-chip" (click)="openPreset('Top 10 in India', 'TOP_10', 'PORTRAIT')">+ Top 10 Ranked</button>
        <button type="button" class="preset-chip" (click)="openPreset('Featured Genre', 'GENRE_TRAY', 'LANDSCAPE')">+ Genre Row</button>
        <button type="button" class="preset-chip" (click)="openPreset('Continue Watching', 'CONTINUE_WATCHING', 'LANDSCAPE')">+ Continue Watching</button>
      </div>

      <!-- 3b. INLINE CREATE / EDIT HOME ROW CARD (No blocking popup modal) -->
      <div class="inline-editor-card" *ngIf="showModal">
        <div class="inline-editor-header">
          <div>
            <h3>{{ editingSection ? 'Edit Home Row' : 'Create New Home Row' }}</h3>
            <p>Set a viewer-friendly title, card aspect ratio, and target audience</p>
          </div>
          <button mat-icon-button type="button" (click)="closeModal()"><mat-icon>close</mat-icon></button>
        </div>

        <form [formGroup]="sectionForm" (ngSubmit)="onSaveSection()" class="inline-form">
          <div class="inline-grid">
            <mat-form-field appearance="outline">
              <mat-label>Row Title (shown to viewers) *</mat-label>
              <input matInput formControlName="title" placeholder="e.g. Trending Movies in India" required>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Row Type *</mat-label>
              <mat-select formControlName="sectionType" required>
                <mat-option value="HERO_BANNER">Hero Banner</mat-option>
                <mat-option value="TRENDING_RAIL">Trending Row</mat-option>
                <mat-option value="TOP_10">Top 10 Ranked</mat-option>
                <mat-option value="GENRE_TRAY">Genre / Category Row</mat-option>
                <mat-option value="CONTINUE_WATCHING">Continue Watching</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Card Aspect Ratio *</mat-label>
              <mat-select formControlName="layout" required>
                <mat-option value="PORTRAIT">Portrait Poster (3:4)</mat-option>
                <mat-option value="LANDSCAPE">Landscape Card (16:9)</mat-option>
                <mat-option value="BANNER">Full-Width Hero Banner</mat-option>
                <mat-option value="SQUARE">Square Tile (1:1)</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Who Sees This Row?</mat-label>
              <mat-select formControlName="targetAudience" required>
                <mat-option value="ALL">All Viewers</mat-option>
                <mat-option value="SUBSCRIBERS_ONLY">Paid Subscribers Only</mat-option>
                <mat-option value="FREE_TIER">Free / Guest Users Only</mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <div class="inline-actions">
            <button type="button" mat-stroked-button (click)="closeModal()">Cancel</button>
            <button type="submit" mat-raised-button class="add-btn" [disabled]="sectionForm.invalid">
              <mat-icon>save</mat-icon> {{ editingSection ? 'Save Changes' : 'Create Row' }}
            </button>
          </div>
        </form>
      </div>

      <!-- 4. MAIN LAYOUT: DRAG LIST + OPTIONAL LIVE APP PREVIEW -->
      <div class="cms-grid" [class.with-preview]="showLivePreview">
        <div class="table-card">
          <div class="table-title-row">
            <div>
              <h3>Home Screen Rows</h3>
              <p>Drag any row by the handle on the left to reorder. Toggle switches to show or hide rows instantly.</p>
            </div>
            <span class="autosave-pill" *ngIf="savingOrder"><mat-icon>sync</mat-icon> Saving order...</span>
          </div>

          <div cdkDropList class="section-list" (cdkDropListDropped)="drop($event)">
            <div class="section-card" *ngFor="let sec of sections; let i = index" cdkDrag [class.disabled-sec]="!sec.active">
              <div class="drag-handle" cdkDragHandle matTooltip="Drag to reorder">
                <mat-icon>drag_indicator</mat-icon>
              </div>

              <div class="order-badge">#{{ i + 1 }}</div>

              <div class="section-info">
                <div class="title-row">
                  <span class="sec-title">{{ sec.title }}</span>
                  <span class="type-pill" [ngClass]="(sec.sectionType || '').toLowerCase()">{{ formatType(sec.sectionType) }}</span>
                  <span class="layout-pill">{{ formatLayout(sec.layout) }}</span>
                  <span class="audience-pill" *ngIf="sec.targetAudience === 'SUBSCRIBERS_ONLY'">
                    <mat-icon>lock</mat-icon> Premium Only
                  </span>
                </div>

                <!-- Mini Visual Poster Strip -->
                <div class="thumb-strip" *ngIf="sec.items && sec.items.length > 0">
                  <img
                    *ngFor="let item of sec.items.slice(0, 6)"
                    [src]="item.posterUrl || item.backdropUrl || 'assets/placeholder-poster.png'"
                    [alt]="item.title"
                    [matTooltip]="item.title"
                    class="mini-poster">
                  <span class="more-chip" *ngIf="sec.items.length > 6">+{{ sec.items.length - 6 }}</span>
                </div>
                <div class="empty-strip" *ngIf="!sec.items || sec.items.length === 0">
                  {{ sec.sectionType === 'CONTINUE_WATCHING' ? 'Auto-populated per viewer' : 'No titles attached yet — click Pick Titles' }}
                </div>
              </div>

              <div class="section-controls">
                <div class="toggle-box">
                  <span class="toggle-label" [class.live]="sec.active">{{ sec.active ? 'LIVE' : 'HIDDEN' }}</span>
                  <mat-slide-toggle [checked]="sec.active" (change)="toggleActive(sec)" color="warn"></mat-slide-toggle>
                </div>

                <div class="action-buttons">
                  <button type="button" class="btn-pick" (click)="openItemsModal(sec)" matTooltip="Attach or remove movies & series">
                    <mat-icon>video_library</mat-icon> Pick Titles ({{ sec.items?.length || sec.itemCount || 0 }})
                  </button>
                  <button mat-icon-button class="edit-icon-btn" (click)="openEditModal(sec)" matTooltip="Edit Row Settings">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button mat-icon-button class="delete-icon-btn" (click)="deleteSection(sec)" matTooltip="Remove Row">
                    <mat-icon>delete_outline</mat-icon>
                  </button>
                </div>
              </div>
            </div>

            <div class="empty-rows" *ngIf="sections.length === 0">
              <mat-icon>view_quilt</mat-icon>
              <p>No home screen rows yet. Click any Quick Add button above to get started.</p>
            </div>
          </div>
        </div>

        <!-- LIVE MOBILE / WEB PREVIEW -->
        <aside class="phone-preview-card" *ngIf="showLivePreview">
          <div class="phone-header">
            <mat-icon>smartphone</mat-icon>
            <span>Live Viewer Order</span>
          </div>
          <div class="phone-screen">
            <div *ngFor="let sec of activeSections" class="preview-rail">
              <div class="preview-rail-title">
                <span>{{ sec.title }}</span>
                <small>{{ formatLayout(sec.layout) }}</small>
              </div>
              <div class="preview-boxes" [class.banner]="sec.layout === 'BANNER'" [class.landscape]="sec.layout === 'LANDSCAPE'">
                <ng-container *ngIf="sec.items && sec.items.length > 0; else placeholderBoxes">
                  <img
                    *ngFor="let it of sec.items.slice(0, sec.layout === 'BANNER' ? 1 : 4)"
                    [src]="it.posterUrl || it.backdropUrl || 'assets/placeholder-poster.png'"
                    class="preview-img">
                </ng-container>
                <ng-template #placeholderBoxes>
                  <div class="skel-box" *ngFor="let n of (sec.layout === 'BANNER' ? [1] : [1, 2, 3])"></div>
                </ng-template>
              </div>
            </div>
            <p class="preview-empty" *ngIf="activeSections.length === 0">Toggle at least one row LIVE to preview.</p>
          </div>
        </aside>
      </div>

      <!-- 6. VISUAL CONTENT PICKER MODAL -->
      <div class="modal-backdrop" *ngIf="managingSection" (click)="closeItemsModal()">
        <div class="modal-card picker-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h2>Pick Titles — {{ managingSection.title }}</h2>
              <p>Click any title below to attach it to this row, or remove attached titles on the right</p>
            </div>
            <button mat-icon-button (click)="closeItemsModal()"><mat-icon>close</mat-icon></button>
          </div>

          <div class="picker-body">
            <!-- Left: Searchable Catalog Grid -->
            <div class="picker-left">
              <div class="picker-search">
                <mat-icon>search</mat-icon>
                <input type="text" [(ngModel)]="contentSearch" placeholder="Search movies, series, microdramas...">
              </div>

              <div class="catalog-grid">
                <button
                  type="button"
                  class="catalog-tile"
                  *ngFor="let item of filteredCatalog"
                  [class.attached]="isAttached(item.id)"
                  (click)="attachById(item.id)">
                  <img [src]="item.posterUrl || item.bannerUrl || 'assets/placeholder-poster.png'" [alt]="item.title">
                  <div class="tile-info">
                    <span class="tile-title">{{ item.title }}</span>
                    <span class="tile-meta">{{ item.contentType || 'MOVIE' }}</span>
                  </div>
                  <span class="tile-badge">{{ isAttached(item.id) ? 'Added' : '+ Add' }}</span>
                </button>
              </div>
            </div>

            <!-- Right: Attached Titles -->
            <div class="picker-right">
              <h4>Attached Titles ({{ managingSection.items?.length || 0 }})</h4>
              <div *ngIf="!managingSection.items || managingSection.items.length === 0" class="empty-attached">
                Click any title on the left to add it to this row.
              </div>
              <div class="attached-item" *ngFor="let item of managingSection.items; let idx = index">
                <span class="idx-num">{{ idx + 1 }}</span>
                <img [src]="item.posterUrl || 'assets/placeholder-poster.png'" class="item-thumb">
                <div class="item-info">
                  <span class="item-title">{{ item.title }}</span>
                  <span class="item-type">{{ item.contentType }}</span>
                </div>
                <button mat-icon-button class="delete-icon-btn" (click)="removeItem(item)" matTooltip="Remove">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-container { color: #f1f5f9; padding: 4px; max-width: 1380px; margin: 0 auto; }

    .header-row {
      display: flex; justify-content: space-between; align-items: flex-end; gap: 16px;
      margin-bottom: 20px; flex-wrap: wrap;
      .category-tag {
        display: inline-flex; align-items: center; gap: 6px; background: rgba(229, 9, 20, 0.14);
        color: #f43f5e; font-size: 11px; font-weight: 800; padding: 5px 10px; border-radius: 6px; letter-spacing: 0.6px;
        mat-icon { font-size: 14px; width: 14px; height: 14px; }
      }
      h1 { font-size: 26px; font-weight: 800; margin: 8px 0 4px; color: #fff; }
      p { margin: 0; font-size: 13px; color: #94a3b8; }
      .header-actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    }
    .add-btn {
      background: linear-gradient(135deg, #e50914, #f43f5e) !important;
      color: #fff !important; font-weight: 800 !important; border-radius: 10px !important; height: 42px;
    }
    .preview-toggle-btn {
      display: inline-flex; align-items: center; gap: 6px; height: 42px; padding: 0 14px;
      background: #161928; border: 1px solid #2a2f45; color: #cbd5e1; border-radius: 10px;
      font-size: 12px; font-weight: 700; cursor: pointer;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
      &:hover, &.active { border-color: #38bdf8; color: #7dd3fc; background: rgba(56, 189, 248, 0.12); }
    }

    .kpi-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-bottom: 18px; }
    .kpi-card {
      background: #12141e; border: 1px solid #222638; border-radius: 14px; padding: 16px 18px;
      display: flex; align-items: center; gap: 14px;
      .kpi-icon {
        width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center;
        &.crimson { background: rgba(229, 9, 20, 0.14); color: #f43f5e; }
        &.green { background: rgba(16, 185, 129, 0.14); color: #34d399; }
        &.gold { background: rgba(245, 158, 11, 0.14); color: #fbbf24; }
        &.blue { background: rgba(56, 189, 248, 0.14); color: #38bdf8; }
      }
      .kpi-label { font-size: 12px; color: #94a3b8; display: block; }
      .kpi-val { font-size: 22px; font-weight: 800; color: #fff; }
    }

    .preset-bar {
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
      background: #12141e; border: 1px solid #222638; border-radius: 12px; padding: 10px 14px; margin-bottom: 18px;
      .preset-label {
        display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 800; color: #94a3b8; margin-right: 4px;
        mat-icon { font-size: 16px; width: 16px; height: 16px; color: #fbbf24; }
      }
      .preset-chip {
        background: #1a1e2e; border: 1px solid #2c3148; color: #e2e8f0; border-radius: 999px;
        padding: 6px 12px; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.15s;
        &:hover { border-color: #e50914; background: rgba(229, 9, 20, 0.15); color: #fff; }
      }
    }

    .inline-editor-card {
      background: #141724; border: 1px solid rgba(229, 9, 20, 0.45); border-radius: 16px;
      padding: 20px 22px; margin-bottom: 18px; box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
      .inline-editor-header {
        display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;
        h3 { margin: 0 0 3px; font-size: 16px; font-weight: 800; color: #fff; }
        p { margin: 0; font-size: 12px; color: #94a3b8; }
      }
      .inline-grid {
        display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px;
      }
      .inline-actions {
        display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px;
      }
      @media (max-width: 1024px) {
        .inline-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media (max-width: 600px) {
        .inline-grid { grid-template-columns: 1fr; }
      }
    }

    .cms-grid {
      display: grid; grid-template-columns: minmax(0, 1fr); gap: 18px;
      &.with-preview { grid-template-columns: minmax(0, 1fr) 310px; }
    }

    .table-card { background: #12141e; border: 1px solid #222638; border-radius: 16px; overflow: hidden; }
    .table-title-row {
      display: flex; justify-content: space-between; align-items: center; gap: 12px;
      padding: 18px 22px; border-bottom: 1px solid #222638;
      h3 { margin: 0 0 3px; font-size: 16px; font-weight: 800; color: #fff; }
      p { margin: 0; font-size: 12px; color: #94a3b8; }
      .autosave-pill {
        display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 700;
        color: #38bdf8; background: rgba(56, 189, 248, 0.12); padding: 4px 10px; border-radius: 999px;
        mat-icon { font-size: 14px; width: 14px; height: 14px; }
      }
    }

    .section-list { padding: 14px; display: flex; flex-direction: column; gap: 10px; }
    .section-card {
      display: flex; align-items: center; gap: 14px; background: #171a28; border: 1px solid #252a40;
      border-radius: 12px; padding: 14px 16px; transition: border-color 0.15s;
      &:hover { border-color: #3a4160; }
      &.disabled-sec { opacity: 0.58; }
    }
    .drag-handle { color: #64748b; cursor: grab; display: flex; align-items: center; &:hover { color: #fff; } }
    .order-badge {
      width: 30px; height: 30px; border-radius: 8px; background: #0d0f17; border: 1px solid #282d44;
      display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; color: #94a3b8; flex-shrink: 0;
    }

    .section-info { flex: 1; min-width: 0; }
    .title-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
    .sec-title { font-size: 15px; font-weight: 800; color: #fff; }
    .type-pill {
      font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 999px;
      background: rgba(56, 189, 248, 0.14); color: #7dd3fc;
      &.hero_banner { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
      &.top_10 { background: rgba(229, 9, 20, 0.16); color: #fda4af; }
    }
    .layout-pill {
      font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 999px;
      background: #222638; color: #cbd5e1;
    }
    .audience-pill {
      display: inline-flex; align-items: center; gap: 3px; font-size: 10px; font-weight: 700;
      padding: 3px 8px; border-radius: 999px; background: rgba(168, 85, 247, 0.15); color: #d8b4fe;
      mat-icon { font-size: 12px; width: 12px; height: 12px; }
    }

    .thumb-strip { display: flex; align-items: center; gap: 6px; margin-top: 4px; }
    .mini-poster { width: 30px; height: 42px; object-fit: cover; border-radius: 4px; border: 1px solid #2b314a; }
    .more-chip { font-size: 11px; font-weight: 700; color: #94a3b8; padding-left: 4px; }
    .empty-strip { font-size: 12px; color: #64748b; }

    .section-controls { display: flex; align-items: center; gap: 14px; flex-shrink: 0; }
    .toggle-box {
      display: flex; align-items: center; gap: 8px;
      .toggle-label { font-size: 10px; font-weight: 800; color: #64748b; &.live { color: #34d399; } }
    }
    .action-buttons { display: flex; align-items: center; gap: 4px; }
    .btn-pick {
      display: inline-flex; align-items: center; gap: 5px; background: rgba(229, 9, 20, 0.12);
      border: 1px solid rgba(229, 9, 20, 0.35); color: #fda4af; border-radius: 8px;
      padding: 6px 11px; font-size: 12px; font-weight: 700; cursor: pointer;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &:hover { background: #e50914; color: #fff; }
    }
    .edit-icon-btn { color: #94a3b8; &:hover { color: #fff; } }
    .delete-icon-btn { color: #ef4444; }
    .empty-rows { text-align: center; padding: 48px 20px; color: #64748b; mat-icon { font-size: 40px; width: 40px; height: 40px; } }

    /* PHONE PREVIEW */
    .phone-preview-card {
      background: #12141e; border: 1px solid #222638; border-radius: 18px; padding: 14px; height: max-content;
      position: sticky; top: 80px;
      .phone-header {
        display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 800; color: #7dd3fc;
        margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #222638;
        mat-icon { font-size: 16px; width: 16px; height: 16px; }
      }
      .phone-screen {
        background: #090b12; border: 1px solid #23283d; border-radius: 14px; padding: 12px;
        max-height: 560px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px;
      }
      .preview-rail-title {
        display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;
        span { font-size: 11px; font-weight: 800; color: #fff; }
        small { font-size: 9px; color: #64748b; }
      }
      .preview-boxes {
        display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;
        &.banner { grid-template-columns: 1fr; .preview-img, .skel-box { aspect-ratio: 16 / 9; } }
        &.landscape { grid-template-columns: repeat(2, 1fr); .preview-img, .skel-box { aspect-ratio: 16 / 9; } }
      }
      .preview-img { width: 100%; aspect-ratio: 3 / 4; object-fit: cover; border-radius: 6px; }
      .skel-box { width: 100%; aspect-ratio: 3 / 4; border-radius: 6px; background: #191d2e; border: 1px dashed #2b314a; }
      .preview-empty { font-size: 12px; color: #64748b; text-align: center; }
    }

    /* MODALS */
    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(0, 0, 0, 0.74); backdrop-filter: blur(6px);
      display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px;
    }
    .modal-card {
      background: #141724; border: 1px solid #262b40; border-radius: 18px; width: 100%; max-width: 560px;
      max-height: 90vh; overflow-y: auto; padding: 22px 24px;
      &.picker-modal { max-width: 920px; }
    }
    .modal-header {
      display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;
      margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px solid #222638;
      h2 { margin: 0 0 3px; font-size: 18px; font-weight: 800; color: #fff; }
      p { margin: 0; font-size: 12px; color: #94a3b8; }
    }
    .full-width { width: 100%; margin-bottom: 10px; }
    .form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 12px; }

    /* VISUAL PICKER */
    .picker-body { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 0.9fr); gap: 18px; }
    .picker-search {
      display: flex; align-items: center; gap: 8px; background: #0d0f17; border: 1px solid #2a2f45;
      border-radius: 10px; padding: 0 12px; height: 40px; margin-bottom: 12px;
      mat-icon { color: #64748b; font-size: 18px; width: 18px; height: 18px; }
      input { background: transparent; border: none; outline: none; color: #fff; font-size: 13px; width: 100%; }
    }
    .catalog-grid {
      display: flex; flex-direction: column; gap: 8px; max-height: 440px; overflow-y: auto; padding-right: 4px;
    }
    .catalog-tile {
      display: flex; align-items: center; gap: 10px; text-align: left; background: #191d2d;
      border: 1px solid #262b40; border-radius: 10px; padding: 8px 10px; cursor: pointer; color: #fff;
      img { width: 34px; height: 48px; object-fit: cover; border-radius: 5px; flex-shrink: 0; }
      .tile-info { flex: 1; min-width: 0; }
      .tile-title { display: block; font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .tile-meta { display: block; font-size: 10px; color: #94a3b8; margin-top: 2px; }
      .tile-badge { font-size: 11px; font-weight: 800; color: #fda4af; background: rgba(229, 9, 20, 0.14); padding: 4px 9px; border-radius: 999px; }
      &:hover { border-color: #e50914; }
      &.attached { border-color: rgba(16, 185, 129, 0.4); .tile-badge { color: #34d399; background: rgba(16, 185, 129, 0.14); } }
    }
    .picker-right {
      background: #0d0f17; border: 1px solid #222638; border-radius: 12px; padding: 14px;
      max-height: 492px; overflow-y: auto;
      h4 { margin: 0 0 12px; font-size: 13px; font-weight: 800; color: #e2e8f0; }
      .empty-attached { font-size: 12px; color: #64748b; }
    }
    .attached-item {
      display: flex; align-items: center; gap: 10px; background: #161928; border: 1px solid #23283d;
      border-radius: 9px; padding: 7px 10px; margin-bottom: 8px;
      .idx-num { font-size: 11px; font-weight: 800; color: #64748b; width: 16px; }
      .item-thumb { width: 28px; height: 40px; object-fit: cover; border-radius: 4px; }
      .item-info { flex: 1; min-width: 0; }
      .item-title { display: block; font-size: 12px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .item-type { display: block; font-size: 10px; color: #38bdf8; }
    }

    @media (max-width: 960px) {
      .kpi-grid { grid-template-columns: repeat(2, 1fr); }
      .cms-grid.with-preview { grid-template-columns: 1fr; }
      .picker-body { grid-template-columns: 1fr; }
    }
  `]
})
export class CmsListPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  private readonly notificationService = inject(NotificationService);

  sections: CmsSection[] = [];
  availableContent: any[] = [];
  contentSearch = '';
  showLivePreview = false;
  savingOrder = false;

  showModal = false;
  editingSection: CmsSection | null = null;
  managingSection: CmsSection | null = null;

  sectionForm = this.fb.group({
    title: ['', [Validators.required]],
    sectionType: ['TRENDING_RAIL', [Validators.required]],
    layout: ['PORTRAIT', [Validators.required]],
    targetAudience: ['ALL', [Validators.required]],
    displayOrder: [1, [Validators.required]]
  });

  get activeSections(): CmsSection[] {
    return this.sections.filter((s) => s.active);
  }

  get filteredCatalog(): any[] {
    const q = this.contentSearch.trim().toLowerCase();
    if (!q) return this.availableContent;
    return this.availableContent.filter((c) =>
      `${c.title || ''} ${c.contentType || ''}`.toLowerCase().includes(q)
    );
  }

  ngOnInit(): void {
    this.loadSections();
    this.loadAvailableContent();
  }

  loadAvailableContent(): void {
    this.http.get<any>(`${environment.apiBaseUrl}/admin/movies?page=0&size=100`).subscribe({
      next: (res) => {
        if (res?.success && res.data?.content) {
          this.availableContent = res.data.content;
        }
      }
    });
  }

  loadSections(): void {
    this.http.get<any>(`${environment.apiBaseUrl}/admin/cms/sections`).subscribe({
      next: (res) => {
        this.sections = res?.success && Array.isArray(res.data) ? res.data : [];
      },
      error: () => {
        this.sections = [];
      }
    });
  }

  getActiveCount(): number {
    return this.sections.filter((s) => s.active).length;
  }

  getHeroCount(): number {
    return this.sections.filter((s) => (s.sectionType || '').toUpperCase() === 'HERO_BANNER').length;
  }

  getTotalItemsCount(): number {
    return this.sections.reduce((acc, s) => acc + (s.items?.length || s.itemCount || 0), 0);
  }

  formatType(t?: string): string {
    const map: Record<string, string> = {
      HERO_BANNER: 'Hero Banner',
      TRENDING_RAIL: 'Trending Row',
      TOP_10: 'Top 10',
      GENRE_TRAY: 'Genre Row',
      CONTINUE_WATCHING: 'Continue Watching'
    };
    return map[(t || '').toUpperCase()] || t || 'Custom Row';
  }

  formatLayout(l?: string): string {
    const map: Record<string, string> = {
      PORTRAIT: '3:4 Portrait',
      LANDSCAPE: '16:9 Landscape',
      BANNER: 'Hero Banner',
      SQUARE: '1:1 Square'
    };
    return map[(l || '').toUpperCase()] || l || 'Portrait';
  }

  drop(event: CdkDragDrop<CmsSection[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    moveItemInArray(this.sections, event.previousIndex, event.currentIndex);
    this.sections.forEach((sec, idx) => (sec.displayOrder = idx + 1));
    this.autoSaveOrder();
  }

  private autoSaveOrder(): void {
    this.savingOrder = true;
    const sectionIds = this.sections.map((s) => s.id);
    this.http.patch<any>(`${environment.apiBaseUrl}/admin/cms/sections/order`, { sectionIds }).subscribe({
      next: () => {
        this.savingOrder = false;
        this.notificationService.success('Home row order saved!');
      },
      error: () => {
        this.savingOrder = false;
      }
    });
  }

  toggleActive(sec: CmsSection): void {
    sec.active = !sec.active;
    this.http.put<any>(`${environment.apiBaseUrl}/admin/cms/sections/${sec.id}`, sec).subscribe({
      next: () => {
        this.notificationService.success(`"${sec.title}" is now ${sec.active ? 'LIVE' : 'HIDDEN'}.`);
      },
      error: () => {
        sec.active = !sec.active;
        this.notificationService.error('Failed to update section visibility.');
      }
    });
  }

  openPreset(title: string, sectionType: string, layout: string): void {
    this.editingSection = null;
    this.sectionForm.reset({
      title,
      sectionType,
      layout,
      targetAudience: 'ALL',
      displayOrder: this.sections.length + 1
    });
    this.showModal = true;
  }

  openCreateModal(): void {
    this.openPreset('', 'TRENDING_RAIL', 'PORTRAIT');
  }

  openEditModal(sec: CmsSection): void {
    this.editingSection = sec;
    this.sectionForm.patchValue({
      title: sec.title,
      sectionType: sec.sectionType,
      layout: sec.layout,
      targetAudience: sec.targetAudience || 'ALL',
      displayOrder: sec.displayOrder
    });
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingSection = null;
  }

  onSaveSection(): void {
    if (this.sectionForm.invalid) return;
    const dto = this.sectionForm.value as any;

    if (this.editingSection) {
      Object.assign(this.editingSection, dto);
      this.http.put<any>(`${environment.apiBaseUrl}/admin/cms/sections/${this.editingSection.id}`, dto).subscribe({
        next: () => {
          this.notificationService.success(`Updated "${dto.title}".`);
          this.closeModal();
        },
        error: () => this.notificationService.error('Failed to update row.')
      });
    } else {
      this.http.post<any>(`${environment.apiBaseUrl}/admin/cms/sections`, dto).subscribe({
        next: () => {
          this.notificationService.success(`Created "${dto.title}"!`);
          this.closeModal();
          this.loadSections();
        },
        error: () => this.notificationService.error('Failed to create row.')
      });
    }
  }

  async deleteSection(sec: CmsSection): Promise<void> {
    const ok = await this.notificationService.confirm(
      'Remove Home Row?',
      `Remove "${sec.title}" from the Home Screen layout?`,
      'Yes, Remove'
    );
    if (!ok) return;

    this.sections = this.sections.filter((s) => s.id !== sec.id);
    this.http.delete<any>(`${environment.apiBaseUrl}/admin/cms/sections/${sec.id}`).subscribe({
      next: () => this.notificationService.success(`Removed "${sec.title}".`),
      error: () => this.loadSections()
    });
  }

  openItemsModal(sec: CmsSection): void {
    this.managingSection = sec;
    this.contentSearch = '';
    if (!this.managingSection.items) {
      this.managingSection.items = [];
    }
  }

  closeItemsModal(): void {
    this.managingSection = null;
  }

  isAttached(contentId: number): boolean {
    return Boolean(this.managingSection?.items?.some((i) => i.contentId === contentId));
  }

  attachById(contentId: number): void {
    if (!this.managingSection || this.isAttached(contentId)) return;
    const match = this.availableContent.find((c) => c.id === contentId);

    this.http.post<any>(`${environment.apiBaseUrl}/admin/cms/sections/${this.managingSection.id}/items`, { contentId }).subscribe({
      next: (res) => {
        const item: CmsItem = res?.data || {
          id: Date.now(),
          contentId,
          title: match?.title || `Content #${contentId}`,
          contentType: match?.contentType || 'MOVIE',
          posterUrl: match?.posterUrl || '',
          displayOrder: (this.managingSection?.items?.length || 0) + 1
        };
        if (!this.managingSection!.items) this.managingSection!.items = [];
        this.managingSection!.items.push(item);
        this.managingSection!.itemCount = this.managingSection!.items.length;
        this.notificationService.success(`Added "${item.title}" to ${this.managingSection?.title}.`);
      },
      error: () => this.notificationService.error('Failed to attach title.')
    });
  }

  removeItem(item: CmsItem): void {
    if (!this.managingSection || !this.managingSection.items) return;
    this.managingSection.items = this.managingSection.items.filter((i) => i.id !== item.id);
    this.managingSection.itemCount = this.managingSection.items.length;

    this.http.delete<any>(`${environment.apiBaseUrl}/admin/cms/sections/${this.managingSection.id}/items/${item.id}`).subscribe({
      next: () => this.notificationService.success(`Removed "${item.title}".`),
      error: () => this.loadSections()
    });
  }
}
