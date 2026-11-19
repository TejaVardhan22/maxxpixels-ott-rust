import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { MatIconModule } from '@angular/material/icon';
import { SkeletonComponent } from '../../../shared/components/ott-design-system/skeleton.component';
import { EmptyStateComponent } from '../../../shared/components/ott-design-system/empty-state.component';
import { BadgeComponent } from '../../../shared/components/ott-design-system/badge.component';

@Component({
  selector: 'app-ott-search-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, SkeletonComponent, EmptyStateComponent, BadgeComponent],
  template: `
    <div class="search-page-container">
      <div class="search-bar-wrapper">
        <mat-icon class="search-icon">search</mat-icon>
        <input
          type="text"
          class="search-input"
          placeholder="Search movies, shows, actors, channels..."
          [(ngModel)]="searchQuery"
          (ngModelChange)="onSearchChange($event)"
          autofocus />

        <button *ngIf="searchQuery" class="clear-btn" (click)="clearSearch()"><mat-icon>close</mat-icon></button>

        <button class="voice-search-btn" (click)="simulateVoiceSearch()" [class.listening]="isListening" title="Voice Search">
          <mat-icon>{{ isListening ? 'mic' : 'mic_none' }}</mat-icon>
          <span *ngIf="isListening" class="pulse-ring"></span>
        </button>
      </div>

      <!-- SEARCH RESULT CATEGORY TABS -->
      <div *ngIf="searchQuery" class="search-tabs-row">
        <button
          *ngFor="let tab of searchFilterTabs"
          class="filter-tab-btn"
          [class.active]="selectedTab === tab"
          (click)="selectedTab = tab">
          {{ tab }}
        </button>
      </div>

      <!-- RECENT & TRENDING SEARCHES (When query is empty) -->
      <div *ngIf="!searchQuery" class="search-suggestions">
        <div *ngIf="recentSearches.length > 0" class="suggestion-group">
          <h3>Recent Searches</h3>
          <div class="tags-row">
            <button *ngFor="let tag of recentSearches" class="search-tag" (click)="applyTag(tag)">
              <mat-icon>history</mat-icon>
              <span>{{ tag }}</span>
            </button>
          </div>
        </div>

        <div class="suggestion-group">
          <h3>Trending Searches</h3>
          <div class="tags-row">
            <button *ngFor="let tag of trendingSearches" class="search-tag trending" (click)="applyTag(tag)">
              <mat-icon>trending_up</mat-icon>
              <span>{{ tag }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- SKELETON LOADING STATE -->
      <div *ngIf="isSearching" class="results-grid">
        <ott-skeleton *ngFor="let i of [1,2,3,4,5,6]" variant="poster"></ott-skeleton>
      </div>

      <!-- SEARCH RESULTS GRID -->
      <div *ngIf="!isSearching && searchQuery && filteredResults.length > 0" class="results-grid">
        <div *ngFor="let item of filteredResults" class="result-card" (click)="viewItem(item.id)">
          <div class="card-media">
            <img [src]="item.posterUrl" [alt]="item.title" />
            <div class="badge-overlay"><ott-badge [type]="item.quality"></ott-badge></div>
          </div>
          <div class="card-info">
            <span class="card-title">{{ item.title }}</span>
            <span class="text-metadata">{{ item.year }} &bull; {{ item.genre }}</span>
          </div>
        </div>
      </div>

      <!-- EMPTY STATE -->
      <div *ngIf="!isSearching && searchQuery && filteredResults.length === 0">
        <ott-empty-state
          title="No results found"
          description="Try searching for another title, actor, or genre."
          actionLabel="Clear Search"
          (onAction)="clearSearch()">
        </ott-empty-state>
      </div>
    </div>
  `,
  styles: [`
    .search-page-container {
      padding: 100px 4vw 60px 4vw;
      min-height: 100vh;
      max-width: 1400px;
      margin: 0 auto;
    }

    .search-bar-wrapper {
      position: relative;
      width: 100%;
      margin-bottom: 24px;

      .search-icon {
        position: absolute;
        left: 20px;
        top: 50%;
        transform: translateY(-50%);
        font-size: 28px;
        width: 28px;
        height: 28px;
        color: #747B89;
      }

      .search-input {
        width: 100%;
        height: 64px;
        padding: 0 110px 0 64px;
        border-radius: 16px;
        background: #171A21;
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: #FFFFFF;
        font-size: 18px;
        font-weight: 600;
        outline: none;
        transition: border-color 200ms ease, box-shadow 200ms ease;

        &:focus {
          border-color: #E50914;
          box-shadow: 0 0 20px rgba(229, 9, 20, 0.25);
        }
      }

      .clear-btn {
        position: absolute;
        right: 64px;
        top: 50%;
        transform: translateY(-50%);
        background: transparent;
        border: none;
        color: #AAB0BC;
        cursor: pointer;
        &:hover { color: #FFFFFF; }
      }

      .voice-search-btn {
        position: absolute;
        right: 16px;
        top: 50%;
        transform: translateY(-50%);
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.1);
        border: none;
        color: #FFF;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 150ms ease;

        &.listening {
          background: #E50914;
          animation: pulseMic 1.2s infinite;
        }
      }
    }

    .search-tabs-row {
      display: flex; gap: 10px; margin-bottom: 32px;
      .filter-tab-btn {
        padding: 6px 18px; border-radius: 20px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #AAB0BC; font-size: 13px; font-weight: 700; cursor: pointer;
        &.active { background: #E50914; border-color: #E50914; color: #FFF; }
      }
    }

    .search-suggestions {
      display: flex;
      flex-direction: column;
      gap: 32px;

      h3 { font-size: 16px; font-weight: 700; color: #747B89; margin-bottom: 14px; }

      .tags-row {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;

        .search-tag {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          border-radius: 30px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #AAB0BC;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 150ms ease;

          &:hover {
            color: #FFFFFF;
            border-color: #E50914;
            background: rgba(229, 9, 20, 0.12);
          }

          mat-icon { font-size: 18px; width: 18px; height: 18px; color: #747B89; }
        }
      }
    }

    .results-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
      gap: 24px;
    }

    .result-card {
      border-radius: 10px;
      background: #171A21;
      overflow: hidden;
      cursor: pointer;
      transition: transform 200ms ease;
      &:hover { transform: scale(1.05); }

      .card-media {
        position: relative;
        aspect-ratio: 2/3;
        img { width: 100%; height: 100%; object-fit: cover; }
        .badge-overlay { position: absolute; top: 8px; left: 8px; }
      }

      .card-info {
        padding: 10px;
        .card-title { display: block; font-size: 14px; font-weight: 700; }
        .text-metadata { font-size: 12px; color: #747B89; }
      }
    }

    @keyframes pulseMic {
      0%, 100% { transform: translateY(-50%) scale(1); }
      50% { transform: translateY(-50%) scale(1.15); box-shadow: 0 0 16px rgba(229,9,20,0.8); }
    }
  `]
})
export class SearchPage implements OnInit {
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);

  searchQuery = '';
  isSearching = false;
  isListening = false;
  debounceTimer: any;

  selectedTab = 'All';
  searchFilterTabs = ['All', 'Movies', 'TV Shows', 'Channels'];

  recentSearches: string[] = [];
  trendingSearches: string[] = ['Action', 'Drama', 'Thriller', 'Comedy', 'Sci-Fi'];

  allResults: any[] = [];
  filteredResults: any[] = [];

  ngOnInit(): void {}

  onSearchChange(query: string): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      this.isSearching = false;
      this.filteredResults = [];
      return;
    }

    this.isSearching = true;
    this.debounceTimer = setTimeout(() => {
      this.http.get<any>(`${environment.apiBaseUrl}/contents`).subscribe({
        next: (res) => {
          this.isSearching = false;
          const list = res?.data ?? [];
          if (Array.isArray(list)) {
            const q = cleanQuery.toLowerCase();
            this.filteredResults = list.filter((c: any) =>
              (c.title && c.title.toLowerCase().includes(q)) ||
              (c.genres && c.genres.some((g: string) => g.toLowerCase().includes(q)))
            ).map((c: any) => ({
              id: String(c.id),
              title: c.title || 'Untitled',
              year: c.releaseYear || 2026,
              genre: c.genres ? c.genres.join(', ') : (c.contentType || 'Content'),
              quality: c.premium ? 'PREMIUM' : '4K',
              posterUrl: c.posterUrl || c.landscapeImageUrl || ''
            }));
          } else {
            this.filteredResults = [];
          }
        },
        error: () => {
          this.isSearching = false;
          this.filteredResults = [];
        }
      });
    }, 350);
  }

  simulateVoiceSearch(): void {
    this.isListening = true;
    setTimeout(() => {
      this.isListening = false;
      this.searchQuery = 'Action';
      this.onSearchChange('Action');
    }, 1500);
  }

  applyTag(tag: string): void {
    this.searchQuery = tag;
    this.onSearchChange(tag);
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.isSearching = false;
    this.filteredResults = [];
  }

  viewItem(id: string): void {
    this.router.navigate(['/movie', id]);
  }
}
