import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { OttButtonComponent } from '../../../shared/components/ott-design-system/ott-button.component';
import { BadgeComponent } from '../../../shared/components/ott-design-system/badge.component';
import { environment } from '../../../../environments/environment';

export interface CastMember {
  name: string;
  role: string;
  avatarUrl: string;
}

@Component({
  selector: 'app-ott-movie-detail-page',
  standalone: true,
  imports: [CommonModule, MatIconModule, OttButtonComponent, BadgeComponent],
  template: `
    <div class="movie-detail-container" *ngIf="movie">
      <!-- BACKDROP HERO -->
      <div class="detail-hero">
        <div class="hero-bg" [style.background-image]="'url(' + (movie.backdropUrl || movie.posterUrl) + ')'"></div>
        <div class="hero-vignette"></div>

        <button class="back-btn" (click)="goBack()"><mat-icon>arrow_back</mat-icon></button>

        <div class="hero-content">
          <div class="badges-row">
            <ott-badge [type]="movie.premium ? 'PREMIUM' : '4K'"></ott-badge>
            <span class="spec-pill" *ngIf="movie.audioCodec">{{ movie.audioCodec }}</span>
          </div>

          <h1 class="movie-title">{{ movie.title }}</h1>

          <div class="meta-row">
            <span class="match-score">98% Match</span>
            <span>{{ movie.releaseYear || 2026 }}</span>
            <span>{{ movie.ageRating || 'U/A 13+' }}</span>
            <span>{{ movie.durationMinutes ? movie.durationMinutes + ' min' : '2h 00m' }}</span>
            <span *ngIf="movie.genres">{{ movie.genres.join(' • ') }}</span>
          </div>

          <p class="synopsis">{{ movie.description }}</p>

          <div class="audio-langs" *ngIf="movie.language">
            <span class="label">Audio:</span>
            <span>{{ movie.language }}</span>
          </div>

          <div class="actions-row">
            <ott-button variant="primary" icon="play_arrow" (onClick)="playMovie()">Play Movie</ott-button>
            <ott-button variant="ghost" [icon]="inList ? 'check' : 'add'" (onClick)="inList = !inList">
              {{ inList ? 'In My List' : 'Add to List' }}
            </ott-button>
          </div>
        </div>
      </div>

      <!-- MAIN CONTENT BODY -->
      <div class="detail-body">
        <!-- CAST & CREW (if present) -->
        <section class="cast-section" *ngIf="castList.length > 0">
          <h2>Starring Cast & Crew</h2>
          <div class="cast-rail">
            <div *ngFor="let member of castList" class="cast-card">
              <img [src]="member.avatarUrl" [alt]="member.name" class="cast-avatar" />
              <span class="cast-name">{{ member.name }}</span>
              <span class="cast-role">{{ member.role }}</span>
            </div>
          </div>
        </section>

        <!-- MORE LIKE THIS -->
        <section class="more-section" *ngIf="recommendations.length > 0">
          <h2>More Like This</h2>
          <div class="recommend-grid">
            <div *ngFor="let rec of recommendations" class="rec-card" (click)="viewMovie(rec.id)">
              <div class="card-media">
                <img [src]="rec.posterUrl" [alt]="rec.title" />
                <div class="badge-overlay"><ott-badge type="4K"></ott-badge></div>
              </div>
              <div class="card-info">
                <span class="rec-title">{{ rec.title }}</span>
                <span class="rec-meta">{{ rec.year }} &bull; {{ rec.genre }}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>

    <div *ngIf="!movie && !loading" class="not-found-container">
      <button class="back-btn" (click)="goBack()"><mat-icon>arrow_back</mat-icon> Go Back</button>
      <p>Movie details not found.</p>
    </div>
  `,
  styles: [`
    .movie-detail-container { min-height: 100vh; background: #06070A; color: #FFF; }
    .not-found-container { min-height: 100vh; background: #06070A; color: #FFF; padding: 100px 4vw; text-align: center; }

    .detail-hero {
      position: relative; width: 100%; height: 75vh; min-height: 520px; display: flex; align-items: flex-end; padding: 0 4vw 40px 4vw;
      .hero-bg { position: absolute; inset: 0; background-size: cover; background-position: center 20%; filter: brightness(0.85); }
      .hero-vignette { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(6,7,10,0.95) 0%, rgba(6,7,10,0.5) 50%, rgba(6,7,10,0) 100%), linear-gradient(180deg, rgba(6,7,10,0) 40%, rgba(6,7,10,1) 100%); }
      .back-btn { position: absolute; top: 90px; left: 4vw; z-index: 20; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); color: #FFF; width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; &:hover { background: #E50914; } }
      .hero-content {
        position: relative; z-index: 10; max-width: 700px;
        .badges-row { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; .spec-pill { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 4px; color: #AAB0BC; } }
        .movie-title { font-size: clamp(36px, 5vw, 56px); font-weight: 900; margin: 0 0 14px 0; }
        .meta-row { display: flex; align-items: center; gap: 12px; font-size: 14px; font-weight: 600; color: #AAB0BC; margin-bottom: 16px; .match-score { color: #22C55E; font-weight: 800; } }
        .synopsis { font-size: 15px; color: #D1D5DB; line-height: 1.6; margin: 0 0 16px 0; }
        .audio-langs { font-size: 13px; color: #AAB0BC; margin-bottom: 24px; .label { font-weight: 800; color: #FFF; margin-right: 6px; } }
        .actions-row { display: flex; gap: 14px; flex-wrap: wrap; }
      }
    }

    .detail-body { padding: 40px 4vw 60px 4vw; display: flex; flex-direction: column; gap: 48px; }

    .cast-section {
      h2 { font-size: 22px; font-weight: 800; margin-bottom: 20px; }
      .cast-rail { display: flex; gap: 24px; overflow-x: auto; padding-bottom: 10px; }
      .cast-card {
        display: flex; flex-direction: column; align-items: center; text-align: center; min-width: 110px;
        .cast-avatar { width: 90px; height: 90px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(255,255,255,0.15); margin-bottom: 10px; transition: border-color 200ms ease; }
        &:hover .cast-avatar { border-color: #E50914; }
        .cast-name { font-size: 14px; font-weight: 700; display: block; }
        .cast-role { font-size: 12px; color: #747B89; }
      }
    }

    .more-section {
      h2 { font-size: 22px; font-weight: 800; margin-bottom: 20px; }
      .recommend-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 24px; }
      .rec-card {
        border-radius: 10px; background: #171A21; overflow: hidden; cursor: pointer; transition: transform 200ms ease;
        &:hover { transform: scale(1.05); }
        .card-media { position: relative; aspect-ratio: 2/3; img { width: 100%; height: 100%; object-fit: cover; } .badge-overlay { position: absolute; top: 8px; left: 8px; } }
        .card-info { padding: 10px; .rec-title { font-size: 14px; font-weight: 700; display: block; } .rec-meta { font-size: 12px; color: #747B89; } }
      }
    }
  `]
})
export class MovieDetailPage implements OnInit {
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);

  movie: any = null;
  loading = false;
  inList = false;
  castList: CastMember[] = [];
  recommendations: any[] = [];

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.fetchMovieDetails(id);
      }
    });
  }

  fetchMovieDetails(id: string): void {
    this.loading = true;
    this.http.get<any>(`${environment.apiBaseUrl}/movies/${id}`).subscribe({
      next: (res) => {
        this.loading = false;
        if (res?.data) {
          const m = res.data;
          this.movie = {
            id: String(m.id),
            title: m.title || 'Untitled Movie',
            description: m.description || '',
            releaseYear: m.releaseYear,
            ageRating: m.maturityRating || m.ageRating,
            durationMinutes: m.durationMinutes,
            language: m.originalLanguage || m.language,
            genres: m.genres || [],
            premium: m.premium,
            posterUrl: m.posterUrl || m.landscapeImageUrl || '',
            backdropUrl: m.landscapeImageUrl || m.posterUrl || ''
          };
        }
      },
      error: () => {
        this.loading = false;
        this.movie = null;
      }
    });
  }

  goBack(): void { this.location.back(); }
  playMovie(): void {
    if (this.movie) {
      this.router.navigate(['/watch', this.movie.id]);
    }
  }
  viewMovie(id: string): void { this.router.navigate(['/movie', id]); }
}
