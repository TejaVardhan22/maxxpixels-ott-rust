import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterModule, Router } from '@angular/router';
import { BadgeComponent } from '../../../shared/components/ott-design-system/badge.component';
import { environment } from '../../../../environments/environment';

export interface SeriesItem {
  id: string;
  title: string;
  seasons: number;
  genre: string;
  badge: string;
  posterUrl: string;
}

@Component({
  selector: 'app-ott-series-page',
  standalone: true,
  imports: [CommonModule, RouterModule, BadgeComponent],
  template: `
    <div class="page-container">
      <h1 class="page-heading">TV & Web Series</h1>

      <div *ngIf="seriesList.length > 0" class="series-grid">
        <div *ngFor="let item of seriesList" class="series-card" (click)="viewSeries(item.id)">
          <div class="card-media">
            <img [src]="item.posterUrl" [alt]="item.title" loading="lazy" />
            <div class="badge-overlay"><ott-badge [type]="item.badge"></ott-badge></div>
          </div>
          <div class="card-info">
            <span class="card-title">{{ item.title }}</span>
            <div class="card-meta">
              <span>{{ item.seasons }} Seasons</span>
              <span>&bull;</span>
              <span>{{ item.genre }}</span>
            </div>
          </div>
        </div>
      </div>

      <div *ngIf="seriesList.length === 0 && !loading" class="empty-state">
        <p>No series available at the moment.</p>
      </div>
    </div>
  `,
  styles: [`
    .page-container {
      padding: 100px 4vw 60px 4vw;
      min-height: 100vh;
      color: #FFF;
    }
    .page-heading { font-size: 36px; font-weight: 900; margin-bottom: 32px; }
    .series-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
      gap: 24px;
    }
    .series-card {
      border-radius: 10px;
      background: #171A21;
      overflow: hidden;
      cursor: pointer;
      transition: transform 250ms ease;
      &:hover { transform: translateY(-6px); }
      .card-media { position: relative; aspect-ratio: 2/3; img { width: 100%; height: 100%; object-fit: cover; } .badge-overlay { position: absolute; top: 8px; left: 8px; } }
      .card-info { padding: 12px; .card-title { font-size: 14px; font-weight: 700; } .card-meta { font-size: 12px; color: #747B89; margin-top: 4px; } }
    }
    .empty-state {
      padding: 60px 0;
      text-align: center;
      color: #747B89;
      font-size: 16px;
    }
  `]
})
export class SeriesPage implements OnInit {
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);

  seriesList: SeriesItem[] = [];
  loading = false;

  ngOnInit(): void {
    this.fetchSeries();
  }

  fetchSeries(): void {
    this.loading = true;
    this.http.get<any>(`${environment.apiBaseUrl}/series`).subscribe({
      next: (res) => {
        this.loading = false;
        const list = res?.data ?? [];
        if (Array.isArray(list) && list.length > 0) {
          this.seriesList = list.map((s: any) => ({
            id: String(s.id),
            title: s.title || 'Untitled Series',
            seasons: s.totalSeasons || 1,
            genre: s.genres ? s.genres.join(' / ') : (s.contentType || 'Series'),
            badge: s.premium ? 'PREMIUM' : '4K',
            posterUrl: s.posterUrl || s.landscapeImageUrl || ''
          }));
        } else {
          this.seriesList = [];
        }
      },
      error: () => {
        this.loading = false;
        this.seriesList = [];
      }
    });
  }

  viewSeries(id: string): void { this.router.navigate(['/series', id]); }
}
