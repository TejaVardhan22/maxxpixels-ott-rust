import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '../../../environments/environment';
import { StorageApiService } from '../../core/services/storage-api.service';
import { NotificationService } from '../../shared/services/notification.service';

interface HeroBannerItem {
  id: number;
  title: string;
  subtitle?: string;
  contentId?: number | null;
  contentTitle?: string | null;
  contentType?: string | null;
  slug?: string | null;
  imageUrl?: string;
  mobileImageUrl?: string;
  actionUrl?: string;
  platform?: 'ALL' | 'WEB' | 'MOBILE' | 'TV' | string;
  placement?: string;
  pageSlug?: string;
  displayOrder: number;
  isActive: boolean;
}

interface CatalogContentOption {
  id: number;
  title: string;
  slug?: string;
  contentType?: string;
  language?: string;
  originalLanguageCode?: string;
  bannerUrl?: string;
  landscapeImageUrl?: string;
  posterUrl?: string;
}

interface MainContentTypeOption {
  id: number;
  slug: string;
  label: string;
}

@Component({
  selector: 'app-hero-banners-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
  ],
  template: `
    <div class="page">
      <div class="header-row">
        <div>
          <span class="eyebrow"><mat-icon>panorama</mat-icon> HERO CAROUSEL</span>
          <h1>Hero Banners</h1>
          <p>Choose which content appears in the hero banner carousel by Main Type, Language (Kannada / All Indian), and Platform (Web / Mobile / TV).</p>
        </div>
        <button mat-raised-button class="primary-btn" (click)="toggleForm()">
          <mat-icon>{{ showForm ? 'close' : 'add' }}</mat-icon>
          {{ showForm ? 'Close Form' : (editingId ? 'Edit Hero Banner' : 'Add Hero Banner') }}
        </button>
      </div>

      <!-- Platform, Main Type & Language Filter Bar -->
      <div class="filter-bar">
        <button
          type="button"
          class="filter-chip"
          [class.active]="platformFilter === 'ALL_VIEW'"
          (click)="setPlatformFilter('ALL_VIEW')"
        >
          All Banners ({{ items.length }})
        </button>
        <button
          type="button"
          class="filter-chip"
          [class.active]="platformFilter === 'WEB'"
          (click)="setPlatformFilter('WEB')"
        >
          <mat-icon>laptop</mat-icon> Web
        </button>
        <button
          type="button"
          class="filter-chip"
          [class.active]="platformFilter === 'MOBILE'"
          (click)="setPlatformFilter('MOBILE')"
        >
          <mat-icon>smartphone</mat-icon> Mobile App
        </button>
        <button
          type="button"
          class="filter-chip"
          [class.active]="platformFilter === 'TV'"
          (click)="setPlatformFilter('TV')"
        >
          <mat-icon>tv</mat-icon> Smart TV
        </button>

        <div class="filter-selects">
          <select
            class="filter-select"
            [(ngModel)]="mainTypeFilter"
            [ngModelOptions]="{ standalone: true }"
            aria-label="Filter banners by main type"
          >
            <option value="ALL_TYPES">All Main Types</option>
            <option value="all">Home (All Types)</option>
            <option *ngFor="let mt of mainTypes" [value]="mt.slug">
              {{ mt.label }}
            </option>
          </select>

          <select
            class="filter-select"
            [(ngModel)]="languageFilter"
            [ngModelOptions]="{ standalone: true }"
            aria-label="Filter banners by language"
          >
            <option value="ALL_LANGS">All Languages</option>
            <option value="kannada">Kannada</option>
            <option value="all-indian">All Indian (Excl. Kannada)</option>
          </select>
        </div>
      </div>

      <!-- Create / Edit Form -->
      <form class="card editor" *ngIf="showForm" [formGroup]="form" (ngSubmit)="submit()">
        <h2>
          <mat-icon>panorama</mat-icon>
          {{ editingId ? 'Edit Hero Banner' : 'Create Hero Banner' }}
        </h2>

        <div class="form-grid">
          <!-- Step 1 -> Step 2 -> Step 3 Cascading Selector -->
          <div class="span-2 content-picker-box">
            <label class="field-label">Step 1: Main Type &rarr; Step 2: Language &rarr; Step 3: Select Content</label>
            <div class="picker-row-4">
              <div>
                <span class="step-tag">1. Main Type</span>
                <select
                  class="native-select"
                  formControlName="targetMainType"
                  (change)="onScopeChanged()"
                >
                  <option value="all">Home (All Main Types)</option>
                  <option *ngFor="let mt of mainTypes" [value]="mt.slug">
                    {{ mt.label }}
                  </option>
                </select>
              </div>

              <div>
                <span class="step-tag">2. Language</span>
                <select
                  class="native-select"
                  formControlName="targetLanguage"
                  (change)="onScopeChanged()"
                >
                  <option value="kannada">Kannada</option>
                  <option value="all-indian">All Indian (Excl. Kannada)</option>
                  <option value="all">All Languages (Both)</option>
                </select>
              </div>

              <div>
                <span class="step-tag">Filter Title</span>
                <input
                  type="text"
                  class="search-input"
                  [(ngModel)]="contentSearch"
                  [ngModelOptions]="{ standalone: true }"
                  placeholder="Type to filter..."
                />
              </div>

              <div>
                <span class="step-tag">3. Select Content ({{ loadingContents ? '...' : filteredContents.length }})</span>
                <select
                  class="native-select"
                  [value]="form.get('contentId')?.value || ''"
                  [disabled]="loadingContents"
                  (change)="onContentSelected($event)"
                >
                  <option value="">
                    {{ loadingContents ? 'Loading matching content...' : '-- Select Content (' + filteredContents.length + ' available) --' }}
                  </option>
                  <option *ngFor="let c of filteredContents" [value]="c.id">
                    #{{ c.id }} · {{ c.title }} ({{ c.contentType || 'MOVIE' }}{{ c.language ? ' · ' + c.language : '' }})
                  </option>
                </select>
              </div>
            </div>
            <small class="hint">
              Showing {{ filteredContents.length }} title(s) for
              <strong>{{ getMainTypeLabel(form.get('targetMainType')?.value) }}</strong> &middot;
              <strong>{{ getLanguageLabel(form.get('targetLanguage')?.value) }}</strong>.
              Target route key: <code>{{ computePageSlug() }}</code>
            </small>
          </div>

          <mat-form-field appearance="outline">
            <mat-label>Banner Title *</mat-label>
            <input matInput formControlName="title" placeholder="Title shown on hero banner" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Target Platform *</mat-label>
            <mat-select formControlName="platform">
              <mat-option value="ALL">All Platforms (Web + Mobile + TV)</mat-option>
              <mat-option value="WEB">Web Only (16:9 Desktop &amp; Mobile Web)</mat-option>
              <mat-option value="MOBILE">Mobile App Only (Android &amp; iOS)</mat-option>
              <mat-option value="TV">Smart TV Only (Android TV)</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Display Order</mat-label>
            <input matInput type="number" formControlName="displayOrder" />
          </mat-form-field>

          <label class="active-toggle">
            <input type="checkbox" formControlName="isActive" />
            Active &amp; Visible in Hero Carousel
          </label>

          <mat-form-field appearance="outline" class="span-2">
            <mat-label>Subtitle / Tagline</mat-label>
            <textarea matInput rows="2" formControlName="subtitle" placeholder="Optional short tagline shown on hero banner"></textarea>
          </mat-form-field>

          <mat-form-field appearance="outline" class="span-2">
            <mat-label>16:9 Web Banner Image URL *</mat-label>
            <input matInput formControlName="imageUrl" placeholder="https://... (16:9 landscape banner for Web &amp; TV)" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="span-2">
            <mat-label>Mobile Banner Image URL (Optional)</mat-label>
            <input matInput formControlName="mobileImageUrl" placeholder="https://... (Optimized banner for Mobile App)" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="span-2">
            <mat-label>Target / Action URL</mat-label>
            <input matInput formControlName="actionUrl" placeholder="/movies/title-slug or custom URL" />
          </mat-form-field>
        </div>

        <!-- Upload Helpers + Previews -->
        <div class="uploads-grid">
          <div class="upload-box">
            <input #webInput type="file" accept="image/*" hidden (change)="upload($event, 'imageUrl')" />
            <button type="button" mat-stroked-button (click)="webInput.click()" [disabled]="uploading === 'imageUrl'">
              <mat-icon>upload</mat-icon>
              {{ uploading === 'imageUrl' ? 'Uploading 16:9 Web Banner...' : 'Upload 16:9 Web Banner' }}
            </button>
            <img *ngIf="form.get('imageUrl')?.value" [src]="form.get('imageUrl')?.value" alt="Web Preview" class="preview-wide" />
          </div>

          <div class="upload-box">
            <input #mobInput type="file" accept="image/*" hidden (change)="upload($event, 'mobileImageUrl')" />
            <button type="button" mat-stroked-button (click)="mobInput.click()" [disabled]="uploading === 'mobileImageUrl'">
              <mat-icon>smartphone</mat-icon>
              {{ uploading === 'mobileImageUrl' ? 'Uploading Mobile Banner...' : 'Upload Mobile Banner' }}
            </button>
            <img *ngIf="form.get('mobileImageUrl')?.value" [src]="form.get('mobileImageUrl')?.value" alt="Mobile Preview" class="preview-mobile" />
          </div>
        </div>

        <div class="actions">
          <button mat-button type="button" (click)="resetForm()">Cancel</button>
          <button mat-raised-button class="primary-btn" type="submit" [disabled]="form.invalid || saving">
            {{ saving ? 'Saving...' : (editingId ? 'Update Hero Banner' : 'Save Hero Banner') }}
          </button>
        </div>
      </form>

      <!-- Banner Directory Table -->
      <div class="card">
        <h2><mat-icon>view_carousel</mat-icon> Hero Banner Directory ({{ filteredItems.length }})</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>16:9 Web</th>
                <th>Mobile</th>
                <th>Title &amp; Linked Content</th>
                <th>Platform</th>
                <th>Main Type &amp; Language</th>
                <th>Order</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of filteredItems">
                <td>
                  <img *ngIf="item.imageUrl" [src]="item.imageUrl" alt="" class="thumb-wide" />
                  <span *ngIf="!item.imageUrl" class="muted">—</span>
                </td>
                <td>
                  <img *ngIf="item.mobileImageUrl" [src]="item.mobileImageUrl" alt="" class="thumb-mobile" />
                  <span *ngIf="!item.mobileImageUrl" class="muted">—</span>
                </td>
                <td>
                  <strong>{{ item.title }}</strong>
                  <small *ngIf="item.contentId">Linked Content #{{ item.contentId }} {{ item.contentTitle ? '(' + item.contentTitle + ')' : '' }}</small>
                  <small *ngIf="!item.contentId">{{ item.subtitle || item.actionUrl || 'Promo Banner' }}</small>
                </td>
                <td>
                  <span class="platform-chip" [ngClass]="'plat-' + (item.platform || 'ALL').toLowerCase()">
                    {{ item.platform || 'ALL' }}
                  </span>
                </td>
                <td>
                  <div class="scope-badges">
                    <span class="page-chip">{{ getMainTypeLabel(parsePageSlug(item.pageSlug).mainType) }}</span>
                    <span class="lang-chip">{{ getLanguageLabel(parsePageSlug(item.pageSlug).lang) }}</span>
                  </div>
                </td>
                <td>{{ item.displayOrder }}</td>
                <td>
                  <span class="badge" [class.inactive]="!item.isActive">
                    {{ item.isActive ? 'ACTIVE' : 'HIDDEN' }}
                  </span>
                </td>
                <td class="row-actions">
                  <button mat-button (click)="edit(item)"><mat-icon>edit</mat-icon> Edit</button>
                  <button mat-button (click)="toggleActive(item)">
                    <mat-icon>{{ item.isActive ? 'visibility_off' : 'visibility' }}</mat-icon>
                    {{ item.isActive ? 'Hide' : 'Show' }}
                  </button>
                  <button mat-button color="warn" (click)="remove(item)"><mat-icon>delete</mat-icon> Delete</button>
                </td>
              </tr>
              <tr *ngIf="!filteredItems.length">
                <td colspan="8" class="empty">
                  No hero banners match the selected filters. Click "Add Hero Banner" to feature content on Web or Mobile.
                </td>
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
    .eyebrow { display: inline-flex; align-items: center; gap: 6px; color: #ff6d2e; font-size: 11px; font-weight: 800; letter-spacing: .12em; }
    .eyebrow mat-icon { font-size: 16px; width: 16px; height: 16px; }
    h1 { margin: 6px 0 4px; font-size: 28px; font-weight: 800; }
    h2 { display: flex; align-items: center; gap: 8px; margin: 0 0 16px; font-size: 17px; }
    p { margin: 0; color: #9a9aae; font-size: 13px; }
    .primary-btn { background: #e50914 !important; color: #fff !important; }
    .filter-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 18px; }
    .filter-chip {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 14px; border-radius: 999px; border: 1px solid #2a2a38;
      background: #1a1a24; color: #b8b8cc; font-size: 12px; font-weight: 700; cursor: pointer;
    }
    .filter-chip mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .filter-chip.active { background: #e50914; border-color: #e50914; color: #fff; }
    .filter-selects { display: flex; flex-wrap: wrap; gap: 8px; margin-left: auto; }
    .filter-select {
      padding: 8px 14px; border-radius: 999px; border: 1px solid #343448;
      background: #1a1a24; color: #fff; font-size: 12px; font-weight: 600; outline: none; cursor: pointer;
    }
    .card { padding: 20px; background: #1a1a24; border: 1px solid #2a2a38; border-radius: 14px; margin-bottom: 18px; }
    .form-grid { display: grid; grid-template-columns: repeat(2, minmax(220px, 1fr)); gap: 10px 16px; }
    .span-2 { grid-column: 1 / -1; }
    .content-picker-box {
      padding: 14px; border-radius: 12px; background: #12121a; border: 1px solid #2a2a38; margin-bottom: 8px;
    }
    .field-label { display: block; font-size: 12px; font-weight: 700; color: #f1f1f7; margin-bottom: 10px; }
    .step-tag { display: block; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; color: #ff8a54; margin-bottom: 5px; }
    .picker-row-4 { display: grid; grid-template-columns: 1fr 1fr 0.85fr 1.6fr; gap: 10px; align-items: end; }
    .search-input, .native-select {
      width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid #343448;
      background: #1a1a24; color: #fff; font-size: 13px; outline: none;
    }
    .hint { display: block; margin-top: 8px; color: #8c8ca6; font-size: 11px; }
    .hint code { padding: 1px 6px; border-radius: 4px; background: #262636; color: #ff8a54; }
    .active-toggle { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
    .uploads-grid { display: grid; grid-template-columns: repeat(2, minmax(220px, 1fr)); gap: 16px; margin-top: 14px; }
    .upload-box { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; padding: 12px; border-radius: 10px; background: #12121a; border: 1px dashed #343448; }
    .preview-wide { width: 220px; aspect-ratio: 16 / 9; object-fit: cover; border-radius: 8px; border: 1px solid #343448; }
    .preview-mobile { width: 120px; aspect-ratio: 16 / 9; object-fit: cover; border-radius: 8px; border: 1px solid #343448; }
    .actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { text-align: left; padding: 12px 10px; border-bottom: 1px solid #262634; vertical-align: middle; }
    th { color: #8c8ca6; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }
    td strong { display: block; color: #fff; }
    td small { display: block; color: #8c8ca6; font-size: 11px; margin-top: 2px; }
    .thumb-wide { width: 112px; aspect-ratio: 16 / 9; object-fit: cover; border-radius: 6px; border: 1px solid #343448; }
    .thumb-mobile { width: 64px; aspect-ratio: 16 / 9; object-fit: cover; border-radius: 6px; border: 1px solid #343448; }
    .platform-chip { padding: 3px 9px; border-radius: 999px; font-size: 11px; font-weight: 800; letter-spacing: .05em; }
    .plat-all { background: rgba(255, 109, 46, 0.16); color: #ff8a54; }
    .plat-web { background: rgba(59, 130, 246, 0.18); color: #60a5fa; }
    .plat-mobile { background: rgba(16, 185, 129, 0.18); color: #34d399; }
    .plat-tv { background: rgba(168, 85, 247, 0.18); color: #c084fc; }
    .scope-badges { display: flex; flex-wrap: wrap; gap: 4px; }
    .page-chip { padding: 3px 8px; border-radius: 6px; background: #262636; color: #d0d0e4; font-size: 11px; font-weight: 600; }
    .lang-chip { padding: 3px 8px; border-radius: 6px; background: rgba(255, 109, 46, 0.14); color: #ff9c6e; font-size: 11px; font-weight: 700; }
    .badge { padding: 3px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; background: rgba(16, 185, 129, 0.18); color: #34d399; }
    .badge.inactive { background: rgba(239, 68, 68, 0.18); color: #f87171; }
    .row-actions { white-space: nowrap; }
    .empty { text-align: center; color: #8c8ca6; padding: 28px; }
    .muted { color: #66667c; }
    @media (max-width: 900px) {
      .form-grid, .picker-row-4, .uploads-grid { grid-template-columns: 1fr; }
      .filter-selects { margin-left: 0; }
    }
  `],
})
export class HeroBannersPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  private readonly storage = inject(StorageApiService);
  private readonly notify = inject(NotificationService);

  items: HeroBannerItem[] = [];
  contents: CatalogContentOption[] = [];
  mainTypes: MainContentTypeOption[] = [];
  contentSearch = '';
  platformFilter: 'ALL_VIEW' | 'WEB' | 'MOBILE' | 'TV' = 'ALL_VIEW';
  mainTypeFilter = 'ALL_TYPES';
  languageFilter = 'ALL_LANGS';

  showForm = false;
  saving = false;
  loadingContents = false;
  uploading: 'imageUrl' | 'mobileImageUrl' | null = null;
  editingId: number | null = null;

  form = this.fb.group({
    contentId: [null as number | null],
    targetMainType: ['all', [Validators.required]],
    targetLanguage: ['kannada', [Validators.required]],
    title: ['', [Validators.required]],
    subtitle: [''],
    platform: ['ALL', [Validators.required]],
    imageUrl: ['', [Validators.required]],
    mobileImageUrl: [''],
    actionUrl: [''],
    displayOrder: [0],
    isActive: [true],
  });

  ngOnInit(): void {
    this.loadMainTypes();
    this.loadBanners();
    this.loadCatalogContents();
  }

  private normalizeTypeKey(raw?: string | null): string {
    const v = String(raw || '').toLowerCase().trim().replace(/[\s-]+/g, '_');
    if (v === 'movies' || v === 'film') return 'movie';
    if (v === 'albums' || v === 'songs' || v === 'song' || v === 'music') return 'album';
    if (v === 'short_films' || v === 'shorts' || v === 'short') return 'short_film';
    if (v === 'micro_drama' || v === 'microdramas') return 'microdrama';
    if (v === 'podcasts') return 'podcast';
    if (v === 'web_series' || v === 'shows' || v === 'show' || v === 'tv_show') return 'series';
    return v;
  }

  private isKannadaContent(c: CatalogContentOption): boolean {
    const code = String(c.originalLanguageCode || c.language || '').toLowerCase().trim();
    if (!code) return true;
    return code === 'kn' || code === 'kan' || code.includes('kannada');
  }

  parsePageSlug(raw?: string | null): { lang: string; mainType: string } {
    const clean = String(raw || 'all').toLowerCase().trim();
    if (!clean || clean === 'all') return { lang: 'all', mainType: 'all' };
    if (clean.includes(':')) {
      const [langPart, typePart] = clean.split(':');
      return {
        lang: langPart || 'all',
        mainType: typePart ? this.normalizeTypeKey(typePart) : 'all',
      };
    }
    if (clean === 'kannada' || clean === 'all-indian' || clean === 'all_indian') {
      return { lang: clean === 'all_indian' ? 'all-indian' : clean, mainType: 'all' };
    }
    return { lang: 'all', mainType: this.normalizeTypeKey(clean) };
  }

  computePageSlug(): string {
    const lang = String(this.form.get('targetLanguage')?.value || 'all').toLowerCase().trim();
    const mt = String(this.form.get('targetMainType')?.value || 'all').toLowerCase().trim();
    if (lang === 'all' && mt === 'all') return 'all';
    if (mt === 'all') return lang;
    return `${lang}:${mt}`;
  }

  getMainTypeLabel(slug?: string | null): string {
    const clean = String(slug || 'all').toLowerCase().trim();
    if (!clean || clean === 'all') return 'Home (All Types)';
    const found = this.mainTypes.find((m) => m.slug === clean);
    return found ? found.label : clean.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  getLanguageLabel(lang?: string | null): string {
    const clean = String(lang || 'all').toLowerCase().trim();
    if (clean === 'kannada') return 'Kannada';
    if (clean === 'all-indian' || clean === 'all_indian') return 'All Indian';
    return 'All Languages';
  }

  loadMainTypes(): void {
    this.http.get<any>(`${environment.apiBaseUrl}/content-types`).subscribe({
      next: (res) => {
        const list = res?.data ?? res?.result ?? res ?? [];
        if (Array.isArray(list) && list.length > 0) {
          this.mainTypes = list
            .filter((t: any) => t && (t.slug || t.name || t.title))
            .map((t: any) => ({
              id: Number(t.id || 0),
              slug: this.normalizeTypeKey(t.slug || t.name || t.title),
              label: String(t.title || t.name || t.slug),
            }));
        }
      },
      error: () => {},
    });
  }

  onScopeChanged(): void {
    this.form.patchValue({ contentId: null });
    this.loadCatalogContents();
  }

  get filteredContents(): CatalogContentOption[] {
    const q = this.contentSearch.trim().toLowerCase();
    if (!q) return this.contents;
    return this.contents.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        String(c.id).includes(q) ||
        (c.contentType || '').toLowerCase().includes(q) ||
        (c.language || '').toLowerCase().includes(q),
    );
  }

  get filteredItems(): HeroBannerItem[] {
    return this.items.filter((it) => {
      if (this.platformFilter !== 'ALL_VIEW') {
        const p = (it.platform || it.placement || 'ALL').toUpperCase();
        if (p !== 'ALL' && p !== this.platformFilter) return false;
      }
      const parsed = this.parsePageSlug(it.pageSlug);
      if (this.mainTypeFilter !== 'ALL_TYPES' && parsed.mainType !== this.mainTypeFilter) {
        return false;
      }
      if (this.languageFilter !== 'ALL_LANGS' && parsed.lang !== this.languageFilter && parsed.lang !== 'all') {
        return false;
      }
      return true;
    });
  }

  setPlatformFilter(plat: 'ALL_VIEW' | 'WEB' | 'MOBILE' | 'TV'): void {
    this.platformFilter = plat;
  }

  loadBanners(): void {
    this.http.get<any>(`${environment.apiBaseUrl}/admin/banners`).subscribe({
      next: (res) => {
        const list = res?.data ?? res?.result ?? res ?? [];
        this.items = Array.isArray(list) ? list : [];
      },
      error: () => this.notify.error('Failed to load hero banners'),
    });
  }

  loadCatalogContents(): void {
    const targetType = String(this.form.get('targetMainType')?.value || 'all').toLowerCase().trim();
    const targetLang = String(this.form.get('targetLanguage')?.value || 'all').toLowerCase().trim();

    const params = new URLSearchParams({ size: '200' });
    if (targetType && targetType !== 'all') {
      params.set('type', targetType.toUpperCase());
    }
    if (targetLang === 'kannada') {
      params.set('language', 'kannada');
    } else if (targetLang === 'all-indian' || targetLang === 'all_indian') {
      params.set('language', 'non-kannada');
    }

    this.loadingContents = true;
    this.http.get<any>(`${environment.apiBaseUrl}/search?${params.toString()}`).subscribe({
      next: (res) => {
        this.loadingContents = false;
        const data = res?.data ?? res?.result ?? res;
        const list = Array.isArray(data?.content) ? data.content : Array.isArray(data) ? data : [];
        this.contents = list.map((c: any) => ({
          id: Number(c.id ?? c.videoId ?? 0),
          title: String(c.title ?? c.name ?? 'Untitled'),
          slug: c.slug,
          contentType: c.contentType ?? c.content_type ?? c.type,
          language: c.language ?? c.originalLanguageCode,
          originalLanguageCode: c.originalLanguageCode ?? c.original_language_code ?? c.language,
          bannerUrl: c.bannerUrl ?? c.bannerImageUrl ?? c.landscapeImageUrl ?? c.backdropUrl,
          landscapeImageUrl: c.landscapeImageUrl ?? c.backdropUrl,
          posterUrl: c.posterUrl ?? c.thumbnail,
        }));
      },
      error: () => {
        this.loadingContents = false;
      },
    });
  }

  onContentSelected(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    const cid = val ? Number(val) : null;
    this.form.patchValue({ contentId: cid });
    if (!cid) return;

    const selected = this.contents.find((c) => c.id === cid);
    if (!selected) return;

    const isSeries = String(selected.contentType || '').toUpperCase() === 'SERIES';
    const targetPath = isSeries
      ? `/shows/${selected.slug || selected.id}`
      : `/movies/${selected.slug || selected.id}`;

    this.form.patchValue({
      title: selected.title,
      imageUrl: selected.bannerUrl || selected.landscapeImageUrl || selected.posterUrl || '',
      mobileImageUrl: selected.posterUrl || selected.bannerUrl || '',
      actionUrl: targetPath,
    });
  }

  toggleForm(): void {
    if (this.showForm) {
      this.resetForm();
    } else {
      this.showForm = true;
    }
  }

  edit(item: HeroBannerItem): void {
    this.editingId = item.id;
    this.showForm = true;
    const parsed = this.parsePageSlug(item.pageSlug);
    this.form.patchValue({
      contentId: item.contentId ?? null,
      targetMainType: parsed.mainType,
      targetLanguage: parsed.lang,
      title: item.title || '',
      subtitle: item.subtitle || '',
      platform: (item.platform || item.placement || 'ALL').toUpperCase(),
      imageUrl: item.imageUrl || '',
      mobileImageUrl: item.mobileImageUrl || '',
      actionUrl: item.actionUrl || '',
      displayOrder: item.displayOrder ?? 0,
      isActive: item.isActive ?? true,
    });
    this.loadCatalogContents();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  resetForm(): void {
    this.showForm = false;
    this.editingId = null;
    this.contentSearch = '';
    this.form.reset({
      contentId: null,
      targetMainType: 'all',
      targetLanguage: 'kannada',
      title: '',
      subtitle: '',
      platform: 'ALL',
      imageUrl: '',
      mobileImageUrl: '',
      actionUrl: '',
      displayOrder: 0,
      isActive: true,
    });
  }

  submit(): void {
    if (this.form.invalid) return;
    this.saving = true;
    const raw = this.form.getRawValue();
    const pageSlug = this.computePageSlug();
    const payload = {
      contentId: raw.contentId,
      title: raw.title,
      subtitle: raw.subtitle,
      platform: raw.platform,
      placement: raw.platform,
      pageSlug,
      imageUrl: raw.imageUrl,
      mobileImageUrl: raw.mobileImageUrl,
      actionUrl: raw.actionUrl,
      targetUrl: raw.actionUrl,
      displayOrder: raw.displayOrder,
      isActive: raw.isActive,
    };

    const req = this.editingId
      ? this.http.put(`${environment.apiBaseUrl}/admin/banners/${this.editingId}`, payload)
      : this.http.post(`${environment.apiBaseUrl}/admin/banners`, payload);

    req.subscribe({
      next: () => {
        this.saving = false;
        this.notify.success(this.editingId ? 'Hero banner updated' : 'Hero banner created');
        this.resetForm();
        this.loadBanners();
      },
      error: (err) => {
        this.saving = false;
        this.notify.error(err?.error?.message || 'Unable to save hero banner');
      },
    });
  }

  toggleActive(item: HeroBannerItem): void {
    this.http
      .put(`${environment.apiBaseUrl}/admin/banners/${item.id}`, {
        isActive: !item.isActive,
      })
      .subscribe({
        next: () => {
          this.notify.success(item.isActive ? 'Hero banner hidden' : 'Hero banner activated');
          this.loadBanners();
        },
        error: () => this.notify.error('Failed to update banner visibility'),
      });
  }

  remove(item: HeroBannerItem): void {
    if (!window.confirm(`Hide / remove hero banner "${item.title}"?`)) return;
    this.http.delete(`${environment.apiBaseUrl}/admin/banners/${item.id}`).subscribe({
      next: () => {
        this.notify.success('Hero banner deactivated');
        this.loadBanners();
      },
      error: () => this.notify.error('Failed to remove hero banner'),
    });
  }

  upload(event: Event, field: 'imageUrl' | 'mobileImageUrl'): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploading = field;
    this.storage.uploadFile(file, 'banners').subscribe({
      next: (result) => {
        if (result.url) {
          this.form.patchValue({ [field]: result.url });
        }
        if (result.progress === 100) this.uploading = null;
      },
      error: () => {
        this.uploading = null;
        this.notify.error('Image upload failed');
      },
    });
  }
}
