import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { OttButtonComponent } from '../../../shared/components/ott-design-system/ott-button.component';
import { BadgeComponent } from '../../../shared/components/ott-design-system/badge.component';
import { environment } from '../../../../environments/environment';

export interface EpisodeItem {
  id: string;
  num: number;
  title: string;
  duration: string;
  synopsis: string;
  progress?: number;
  thumbnailUrl: string;
}

@Component({
  selector: 'app-ott-series-detail-page',
  standalone: true,
  imports: [CommonModule, MatIconModule, OttButtonComponent, BadgeComponent],
  template: `
    <div class="series-detail-container" *ngIf="series">
      <!-- HERO -->
      <div class="detail-hero">
        <div class="hero-bg" [style.background-image]="'url(' + (series.backdropUrl || series.posterUrl) + ')'"></div>
        <div class="hero-vignette"></div>

        <button class="back-btn" (click)="goBack()"><mat-icon>arrow_back</mat-icon></button>

        <div class="hero-content">
          <div class="badges-row">
            <ott-badge [type]="series.premium ? 'PREMIUM' : '4K'"></ott-badge>
            <ott-badge type="SERIES"></ott-badge>
          </div>

          <h1 class="series-title">{{ series.title }}</h1>
          <div class="meta-row">
            <span class="match-score">99% Match</span>
            <span>{{ series.releaseYear || 2026 }}</span>
            <span>{{ series.maturityRating || 'U/A 16+' }}</span>
            <span>{{ series.totalSeasons || 1 }} Season{{ (series.totalSeasons || 1) > 1 ? 's' : '' }}</span>
            <span *ngIf="series.originalLanguage">{{ series.originalLanguage }}</span>
          </div>

          <p class="synopsis">{{ series.description }}</p>

          <div class="actions-row">
            <ott-button variant="primary" icon="play_arrow" (onClick)="playEpisode(currentEpisodes.length > 0 ? currentEpisodes[0].id : series.id)">
              Play {{ currentEpisodes.length > 0 ? 'Episode 1' : 'Series' }}
            </ott-button>
          </div>
        </div>
      </div>

      <!-- SEASON TAB SELECTOR & EPISODES LIST -->
      <div class="episodes-section" *ngIf="currentEpisodes.length > 0">
        <div class="season-tabs-header">
          <h2>Episodes</h2>
          <div class="season-pills" *ngIf="seasons.length > 1">
            <button
              *ngFor="let s of seasons"
              class="season-pill"
              [class.active]="selectedSeason === s"
              (click)="selectedSeason = s">
              Season {{ s }}
            </button>
          </div>
        </div>

        <div class="episodes-list">
          <div *ngFor="let ep of currentEpisodes" class="episode-card" (click)="playEpisode(ep.id)">
            <div class="ep-num">{{ ep.num }}</div>

            <div class="ep-thumbnail">
              <img [src]="ep.thumbnailUrl || series.backdropUrl" [alt]="ep.title" />
              <div class="play-overlay"><mat-icon>play_circle_filled</mat-icon></div>
            </div>

            <div class="ep-info">
              <div class="ep-header">
                <h3 class="ep-title">{{ ep.title }}</h3>
                <span class="ep-dur" *ngIf="ep.duration">{{ ep.duration }}</span>
              </div>
              <p class="ep-desc">{{ ep.synopsis }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div *ngIf="!series && !loading" class="not-found-container">
      <button class="back-btn" (click)="goBack()"><mat-icon>arrow_back</mat-icon> Go Back</button>
      <p>Series details not found.</p>
    </div>
  `,
  styles: [`
    .series-detail-container { min-height: 100vh; background: #06070A; color: #FFF; }
    .not-found-container { min-height: 100vh; background: #06070A; color: #FFF; padding: 100px 4vw; text-align: center; }

    .detail-hero {
      position: relative; width: 100%; height: 70vh; min-height: 480px; display: flex; align-items: flex-end; padding: 0 4vw 40px 4vw;
      .hero-bg { position: absolute; inset: 0; background-size: cover; background-position: center 20%; filter: brightness(0.85); }
      .hero-vignette { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(6,7,10,0.95) 0%, rgba(6,7,10,0.5) 50%, rgba(6,7,10,0) 100%), linear-gradient(180deg, rgba(6,7,10,0) 40%, rgba(6,7,10,1) 100%); }
      .back-btn { position: absolute; top: 90px; left: 4vw; z-index: 20; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); color: #FFF; width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; }
      .hero-content {
        position: relative; z-index: 10; max-width: 680px;
        .badges-row { display: flex; gap: 8px; margin-bottom: 12px; }
        .series-title { font-size: clamp(34px, 5vw, 54px); font-weight: 900; margin: 0 0 12px 0; }
        .meta-row { display: flex; align-items: center; gap: 12px; font-size: 14px; font-weight: 600; color: #AAB0BC; margin-bottom: 14px; .match-score { color: #22C55E; font-weight: 800; } }
        .synopsis { font-size: 15px; color: #D1D5DB; line-height: 1.5; margin: 0 0 24px 0; }
        .actions-row { display: flex; gap: 14px; }
      }
    }

    .episodes-section {
      padding: 40px 4vw 60px 4vw;
      .season-tabs-header {
        display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; flex-wrap: wrap; gap: 16px;
        h2 { font-size: 24px; font-weight: 800; margin: 0; }
        .season-pills {
          display: flex; gap: 10px;
          .season-pill {
            padding: 8px 20px; border-radius: 20px; background: #171A21; border: 1px solid rgba(255,255,255,0.12); color: #AAB0BC; font-size: 14px; font-weight: 700; cursor: pointer;
            &.active { background: #E50914; border-color: #E50914; color: #FFF; box-shadow: 0 0 14px rgba(229,9,20,0.4); }
          }
        }
      }

      .episodes-list { display: flex; flex-direction: column; gap: 20px; }
      .episode-card {
        display: flex; align-items: center; gap: 20px; padding: 16px; border-radius: 14px; background: #171A21; border: 1px solid rgba(255,255,255,0.08); cursor: pointer; transition: all 200ms ease;
        &:hover { border-color: #E50914; transform: translateX(4px); .play-overlay { opacity: 1; } }
        .ep-num { font-size: 24px; font-weight: 900; color: #747B89; min-width: 30px; text-align: center; }
        .ep-thumbnail {
          position: relative; width: 180px; aspect-ratio: 16/9; border-radius: 8px; overflow: hidden; flex: 0 0 180px;
          img { width: 100%; height: 100%; object-fit: cover; }
          .play-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 200ms ease; mat-icon { font-size: 40px; width: 40px; height: 40px; color: #E50914; } }
        }
        .ep-info {
          flex: 1;
          .ep-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; .ep-title { font-size: 16px; font-weight: 800; margin: 0; } .ep-dur { font-size: 13px; color: #747B89; font-weight: 600; } }
          .ep-desc { font-size: 13px; color: #AAB0BC; margin: 0; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        }
      }
    }
  `]
})
export class SeriesDetailPage implements OnInit {
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);

  series: any = null;
  loading = false;
  selectedSeason = 1;
  seasons: number[] = [1];
  currentEpisodes: EpisodeItem[] = [];

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.fetchSeriesDetails(id);
      }
    });
  }

  fetchSeriesDetails(id: string): void {
    this.loading = true;
    this.http.get<any>(`${environment.apiBaseUrl}/series/${id}`).subscribe({
      next: (res) => {
        this.loading = false;
        if (res?.data) {
          const s = res.data;
          this.series = {
            id: String(s.id),
            title: s.title || 'Untitled Series',
            description: s.description || '',
            releaseYear: s.releaseYear,
            maturityRating: s.maturityRating,
            totalSeasons: s.totalSeasons || 1,
            originalLanguage: s.originalLanguage,
            premium: s.premium,
            posterUrl: s.posterUrl || s.landscapeImageUrl || '',
            backdropUrl: s.landscapeImageUrl || s.posterUrl || ''
          };
          const totalS = s.totalSeasons || 1;
          this.seasons = Array.from({ length: totalS }, (_, i) => i + 1);
          if (s.seasons && Array.isArray(s.seasons)) {
            const season = s.seasons[0];
            if (season && season.episodes) {
              this.currentEpisodes = season.episodes.map((ep: any, idx: number) => ({
                id: String(ep.id),
                num: ep.episodeNumber || idx + 1,
                title: ep.title || `Episode ${idx + 1}`,
                duration: ep.durationSeconds ? Math.floor(ep.durationSeconds / 60) + 'm' : '',
                synopsis: ep.description || '',
                thumbnailUrl: ep.thumbnailUrl || s.backdropUrl || ''
              }));
            }
          }
        }
      },
      error: () => {
        this.loading = false;
        this.series = null;
      }
    });
  }

  goBack(): void { this.location.back(); }
  playEpisode(id: string): void { this.router.navigate(['/watch', id]); }
}
