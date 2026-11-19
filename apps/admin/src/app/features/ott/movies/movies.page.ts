import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { BadgeComponent } from '../../../shared/components/ott-design-system/badge.component';
import { OttButtonComponent } from '../../../shared/components/ott-design-system/ott-button.component';
import { environment } from '../../../../environments/environment';

export interface MovieItem {
  id: string;
  title: string;
  year: number;
  maturity: string;
  duration: string;
  rating: number;
  language: string;
  genres: string[];
  badges: string[];
  posterUrl: string;
  backdropUrl: string;
}

@Component({
  selector: 'app-ott-movies-page',
  standalone: true,
  imports: [CommonModule, MatIconModule, BadgeComponent, OttButtonComponent],
  template: `
    <div class="movies-page-container">
      <!-- FEATURED SPOTLIGHT HERO BANNER (Dynamic from catalog) -->
      <section class="spotlight-banner" *ngIf="moviesList.length > 0 && moviesList[0] as spotlight">
        <div class="banner-bg" [style.background-image]="'url(' + (spotlight.backdropUrl || spotlight.posterUrl) + ')'"></div>
        <div class="banner-vignette"></div>

        <div class="banner-content">
          <div class="badge-row">
            <ott-badge *ngFor="let b of spotlight.badges" [type]="b"></ott-badge>
            <span class="lang-tag">{{ spotlight.language | uppercase }}</span>
          </div>

          <h1 class="spotlight-title">{{ spotlight.title }}</h1>
          <p class="spotlight-desc">{{ spotlight.maturity }} &bull; {{ spotlight.duration }} &bull; {{ spotlight.genres.join(', ') }}</p>

          <div class="banner-actions">
            <ott-button variant="primary" icon="play_arrow" (onClick)="playMovie(spotlight.id)">Watch Movie</ott-button>
            <ott-button variant="secondary" icon="info" (onClick)="viewMovie(spotlight.id)">Details</ott-button>
          </div>
        </div>
      </section>

      <!-- REGIONAL LANGUAGE FILTER PILLS (Aha / Hotstar signature feature) -->
      <div class="section-title">Browse Movies by Language</div>
      <div class="lang-filter-pills">
        <button
          *ngFor="let lang of languages"
          class="lang-pill"
          [class.active]="selectedLanguage === lang"
          (click)="selectLanguage(lang)">
          {{ lang }}
        </button>
      </div>

      <!-- GENRE FILTERS & SORT ROW -->
      <div class="filter-sort-row">
        <div class="genre-chips">
          <button
            *ngFor="let genre of genres"
            class="genre-chip"
            [class.active]="selectedGenre === genre"
            (click)="selectGenre(genre)">
            {{ genre }}
          </button>
        </div>

        <div class="sort-dropdown">
          <label>Sort By:</label>
          <select (change)="onSortChange($event)">
            <option value="trending">Trending Now</option>
            <option value="newest">Recently Added</option>
            <option value="rating">IMDb Rating</option>
          </select>
        </div>
      </div>

      <!-- MOVIES CATALOG GRID -->
      <div class="movies-grid">
        <div *ngFor="let movie of filteredMovies" class="movie-card" (click)="viewMovie(movie.id)">
          <div class="card-media">
            <img [src]="movie.posterUrl" [alt]="movie.title" loading="lazy" />
            <div class="badge-overlay"><ott-badge [type]="movie.badges[0] || '4K'"></ott-badge></div>
            <div class="imdb-score"><mat-icon>star</mat-icon> {{ movie.rating }}</div>
            <div class="play-hover"><mat-icon>play_circle_filled</mat-icon></div>
          </div>

          <div class="card-info">
            <h3 class="card-title">{{ movie.title }}</h3>
            <div class="card-meta">
              <span>{{ movie.year }}</span>
              <span>&bull;</span>
              <span>{{ movie.language }}</span>
              <span>&bull;</span>
              <span>{{ movie.duration }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .movies-page-container {
      padding: 72px 4vw 60px 4vw; min-height: 100vh; background: #06070A; color: #FFF;
    }

    /* SPOTLIGHT BANNER */
    .spotlight-banner {
      position: relative; width: 100%; height: 50vh; min-height: 380px; border-radius: 20px; overflow: hidden; margin-bottom: 36px; display: flex; align-items: center;
      .banner-bg { position: absolute; inset: 0; background-size: cover; background-position: center 25%; filter: brightness(0.85); }
      .banner-vignette { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(6,7,10,0.95) 0%, rgba(6,7,10,0.4) 50%, rgba(6,7,10,0) 100%), linear-gradient(180deg, rgba(6,7,10,0) 50%, rgba(6,7,10,1) 100%); }
      .banner-content { position: relative; z-index: 10; padding: 0 40px; max-width: 600px;
        .badge-row { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; .lang-tag { font-size: 11px; font-weight: 800; color: #F59E0B; background: rgba(245,158,11,0.15); padding: 2px 8px; border-radius: 4px; } }
        .spotlight-title { font-size: clamp(32px, 4vw, 48px); font-weight: 900; margin: 0 0 12px 0; }
        .spotlight-desc { font-size: 14px; color: #D1D5DB; line-height: 1.5; margin: 0 0 20px 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .banner-actions { display: flex; gap: 12px; }
      }
    }

    .section-title { font-size: 18px; font-weight: 800; margin-bottom: 14px; color: #AAB0BC; }

    /* LANGUAGE PILLS */
    .lang-filter-pills {
      display: flex; gap: 12px; overflow-x: auto; margin-bottom: 32px; padding-bottom: 4px;
      .lang-pill {
        padding: 8px 24px; border-radius: 30px; background: #171A21; border: 1px solid rgba(255,255,255,0.12); color: #FFF; font-size: 14px; font-weight: 700; cursor: pointer; white-space: nowrap; transition: all 150ms ease;
        &:hover { border-color: #E50914; background: rgba(229,9,20,0.12); }
        &.active { background: #E50914; border-color: #E50914; color: #FFF; box-shadow: 0 0 16px rgba(229,9,20,0.4); }
      }
    }

    .filter-sort-row {
      display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 28px; flex-wrap: wrap;
      .genre-chips {
        display: flex; gap: 8px; flex-wrap: wrap;
        .genre-chip {
          padding: 6px 14px; border-radius: 8px; background: rgba(255,255,255,0.06); border: none; color: #AAB0BC; font-size: 13px; font-weight: 600; cursor: pointer;
          &:hover { color: #FFF; background: rgba(255,255,255,0.12); }
          &.active { background: rgba(255,255,255,0.2); color: #FFF; font-weight: 800; }
        }
      }
      .sort-dropdown {
        display: flex; align-items: center; gap: 8px; font-size: 13px; color: #747B89;
        select { background: #171A21; border: 1px solid rgba(255,255,255,0.15); color: #FFF; padding: 6px 12px; border-radius: 8px; font-size: 13px; outline: none; }
      }
    }

    /* GRID */
    .movies-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 24px; }
    .movie-card {
      border-radius: 12px; background: #171A21; overflow: hidden; cursor: pointer; transition: transform 250ms ease, box-shadow 250ms ease;
      &:hover { transform: scale(1.05); box-shadow: 0 14px 35px rgba(0,0,0,0.7); .play-hover { opacity: 1; } }
      .card-media {
        position: relative; aspect-ratio: 2/3;
        img { width: 100%; height: 100%; object-fit: cover; }
        .badge-overlay { position: absolute; top: 8px; left: 8px; }
        .imdb-score { position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.75); backdrop-filter: blur(8px); color: #F59E0B; font-size: 11px; font-weight: 800; padding: 2px 6px; border-radius: 4px; display: flex; align-items: center; gap: 3px; mat-icon { font-size: 13px; width: 13px; height: 13px; } }
        .play-hover { position: absolute; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 200ms ease; mat-icon { font-size: 48px; width: 48px; height: 48px; color: #E50914; } }
      }
      .card-info {
        padding: 12px;
        .card-title { font-size: 14px; font-weight: 800; margin: 0 0 4px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .card-meta { font-size: 12px; color: #747B89; display: flex; gap: 4px; }
      }
    }
  `]
})
export class MoviesPage implements OnInit {
  selectedLanguage = 'All Languages';
  selectedGenre = 'All';

  languages = ['All Languages'];
  genres = ['All', 'Action', 'Sci-Fi', 'Drama', 'Thriller', 'Comedy', 'Romance'];

  moviesList: MovieItem[] = [];
  filteredMovies: MovieItem[] = [];

  constructor(private router: Router, private http: HttpClient) {}

  ngOnInit(): void {
    this.fetchLanguages();
    this.fetchMovies();
  }

  fetchLanguages(): void {
    this.http.get<any>(`${environment.apiBaseUrl}/languages`).subscribe({
      next: (res) => {
        const list = res?.data ?? res?.result ?? res ?? [];
        if (Array.isArray(list)) {
          list.forEach((l: any) => {
            const name = l.name || l.code;
            if (name && !this.languages.includes(name)) {
              this.languages.push(name);
            }
          });
        }
      }
    });
  }

  fetchMovies(): void {
    this.http.get<any>(`${environment.apiBaseUrl}/movies`).subscribe({
      next: (res) => {
        const list = res?.data ?? [];
        if (Array.isArray(list) && list.length > 0) {
          this.moviesList = list.map((m: any) => ({
            id: String(m.id),
            title: m.title || 'Untitled Movie',
            year: m.releaseYear || 2026,
            maturity: m.ageRating || 'U/A 13+',
            duration: m.durationSeconds ? Math.floor(m.durationSeconds / 60) + 'm' : '2h 00m',
            rating: 8.5,
            language: m.language || m.originalLanguage || '',
            genres: m.genres || ['Action'],
            badges: m.premium ? ['PREMIUM'] : ['4K'],
            posterUrl: m.posterUrl || m.landscapeImageUrl || '',
            backdropUrl: m.landscapeImageUrl || m.posterUrl || ''
          }));
          this.filteredMovies = [...this.moviesList];
        } else {
          this.moviesList = [];
          this.filteredMovies = [];
        }
      },
      error: () => {
        this.moviesList = [];
        this.filteredMovies = [];
      }
    });
  }

  selectLanguage(lang: string): void {
    this.selectedLanguage = lang;
    this.filterGrid();
  }

  selectGenre(g: string): void {
    this.selectedGenre = g;
    this.filterGrid();
  }

  filterGrid(): void {
    this.filteredMovies = this.moviesList.filter(m => {
      const matchLang = this.selectedLanguage === 'All Languages' ||
        (m.language && m.language.trim().toLowerCase() === this.selectedLanguage.trim().toLowerCase());
      const matchGenre = this.selectedGenre === 'All' || m.genres.includes(this.selectedGenre);
      return matchLang && matchGenre;
    });
  }

  onSortChange(e: any): void {
    const val = e.target.value;
    if (val === 'rating') {
      this.filteredMovies.sort((a, b) => b.rating - a.rating);
    } else if (val === 'newest') {
      this.filteredMovies.sort((a, b) => b.year - a.year);
    }
  }

  playMovie(id: string): void { this.router.navigate(['/watch', id]); }
  playTrailer(): void { this.router.navigate(['/watch', 'm1']); }
  viewMovie(id: string): void { this.router.navigate(['/movie', id]); }
}

