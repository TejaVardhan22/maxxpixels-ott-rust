import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-content-hub-page',
  standalone: true,
  imports: [CommonModule, RouterModule, MatCardModule, MatButtonModule, MatIconModule],
  template: `
    <div class="content-hub">
      <div class="hub-header">
        <div>
          <h1>Add Content</h1>
          <p>Choose whether you are uploading a single-file title (Movie, Song, Short Film, Podcast) or a multi-episode Series.</p>
        </div>
        <button mat-stroked-button color="accent" routerLink="/admin/basic-details">
          <mat-icon>tune</mat-icon> Manage Basic Details (Types, Genres, Cast, Producers)
        </button>
      </div>

      <div class="hub-grid">
        <!-- Option 1: Single File Content -->
        <mat-card class="hub-card single-card">
          <div class="card-badge">SINGLE FILE UPLOAD</div>
          <div class="card-icon"><mat-icon>movie</mat-icon></div>
          <h2>Single File Content</h2>
          <p class="card-desc">
            Movies, Songs / Music Videos, Short Films, Documentaries, Stage Drama, Podcasts, and AI Movies.
            Supports direct TUS resumable Bunny Stream upload, Google Drive streaming, trailers, subtitles, multi-language tracks &amp; cast.
          </p>

          <div class="type-chips">
            <button
              type="button"
              *ngFor="let t of singleTypes"
              class="type-chip"
              [class.active]="selectedSingleType === t.value"
              (click)="selectedSingleType = t.value"
            >
              <mat-icon>{{ t.icon }}</mat-icon>
              <span>{{ t.label }}</span>
            </button>
          </div>

          <div class="card-actions">
            <button mat-raised-button color="primary" (click)="openSingleForm()">
              <mat-icon>add_circle</mat-icon> Open Single File Form
            </button>
            <button mat-button routerLink="/admin/movies">
              View All Single Titles
            </button>
          </div>
        </mat-card>

        <!-- Option 2: Series & Episodes -->
        <mat-card class="hub-card series-card">
          <div class="card-badge series">SEASONS &amp; EPISODES</div>
          <div class="card-icon"><mat-icon>tv</mat-icon></div>
          <h2>Series &amp; Episodes</h2>
          <p class="card-desc">
            Web Series, Microdramas, Music Albums (multi-track), and AI Series.
            Create the parent series, organize multiple seasons, and upload episodes with individual thumbnails &amp; HLS streams.
          </p>

          <div class="type-chips">
            <button
              type="button"
              *ngFor="let t of seriesTypes"
              class="type-chip"
              [class.active]="selectedSeriesType === t.value"
              (click)="selectedSeriesType = t.value"
            >
              <mat-icon>{{ t.icon }}</mat-icon>
              <span>{{ t.label }}</span>
            </button>
          </div>

          <div class="card-actions">
            <button mat-raised-button color="accent" (click)="openSeriesForm()">
              <mat-icon>playlist_add</mat-icon> Open Series &amp; Episodes Form
            </button>
            <button mat-button routerLink="/admin/series">
              View All Series
            </button>
          </div>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .content-hub {
      padding: 24px;
      max-width: 1180px;
      margin: 0 auto;
    }
    .hub-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 28px;
    }
    .hub-header h1 {
      margin: 0 0 6px;
      font-size: 26px;
      font-weight: 700;
    }
    .hub-header p {
      margin: 0;
      opacity: 0.72;
      font-size: 14px;
    }
    .hub-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
      gap: 24px;
    }
    .hub-card {
      padding: 26px;
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .card-badge {
      align-self: flex-start;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      padding: 4px 10px;
      border-radius: 999px;
      background: rgba(59, 130, 246, 0.16);
      color: #60a5fa;
    }
    .card-badge.series {
      background: rgba(244, 63, 94, 0.16);
      color: #fb7185;
    }
    .card-icon mat-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      opacity: 0.9;
    }
    .hub-card h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
    }
    .card-desc {
      margin: 0;
      font-size: 13.5px;
      line-height: 1.55;
      opacity: 0.78;
    }
    .type-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 6px 0 8px;
    }
    .type-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      background: rgba(255, 255, 255, 0.04);
      color: inherit;
      font-size: 12.5px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .type-chip mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
    .type-chip.active {
      border-color: #60a5fa;
      background: rgba(59, 130, 246, 0.22);
      font-weight: 600;
    }
    .card-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: auto;
      padding-top: 8px;
      flex-wrap: wrap;
    }
  `]
})
export class ContentHubPage implements OnInit {
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);

  selectedSingleType = 'MOVIE';
  selectedSeriesType = 'SERIES';

  singleTypes = [
    { label: 'Movie', value: 'MOVIE', icon: 'movie' },
    { label: 'Song / Music Video', value: 'ALBUM', icon: 'music_note' },
    { label: 'Short Film', value: 'SHORT_FILM', icon: 'slideshow' },
    { label: 'Documentary', value: 'DOCUMENTARY', icon: 'menu_book' },
    { label: 'Podcast', value: 'PODCAST', icon: 'podcasts' },
    { label: 'Stage Drama', value: 'STAGE_DRAMA', icon: 'theater_comedy' },
    { label: 'AI Movie', value: 'AI_MOVIE', icon: 'auto_awesome' }
  ];

  seriesTypes = [
    { label: 'Web Series', value: 'SERIES', icon: 'tv' },
    { label: 'Microdrama', value: 'MICRODRAMA', icon: 'video_collection' },
    { label: 'Music Album (Tracks)', value: 'ALBUM', icon: 'album' },
    { label: 'AI Series', value: 'AI_SERIES', icon: 'auto_awesome' }
  ];

  ngOnInit(): void {
    // Also merge any dynamic Main Types configured in Basic Details
    this.http.get<any>(`${environment.apiBaseUrl}/content-types`).subscribe({
      next: (res) => {
        const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        for (const ct of list) {
          const code = String(ct.slug || ct.name || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
          const label = ct.name || ct.title;
          if (!code || !label) continue;
          const isSeriesLike = code.includes('SERIES') || code.includes('DRAMA') || code.includes('SHOW');
          if (isSeriesLike) {
            if (!this.seriesTypes.some(t => t.value === code)) {
              this.seriesTypes.push({ label, value: code, icon: 'tv' });
            }
          } else if (!this.singleTypes.some(t => t.value === code)) {
            this.singleTypes.push({ label, value: code, icon: 'movie_filter' });
          }
        }
      },
      error: () => {}
    });
  }

  openSingleForm(): void {
    this.router.navigate(['/admin/movies/new'], { queryParams: { type: this.selectedSingleType } });
  }

  openSeriesForm(): void {
    this.router.navigate(['/admin/series/new'], { queryParams: { type: this.selectedSeriesType } });
  }
}
