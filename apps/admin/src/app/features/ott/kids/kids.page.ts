import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BadgeComponent } from '../../../shared/components/ott-design-system/badge.component';
import { environment } from '../../../../environments/environment';

export interface KidsItem {
  id: string;
  title: string;
  genre: string;
  posterUrl: string;
}

@Component({
  selector: 'app-ott-kids-page',
  standalone: true,
  imports: [CommonModule, BadgeComponent],
  template: `
    <div class="kids-page-container">
      <div class="kids-banner">
        <div class="banner-content">
          <ott-badge type="FREE"></ott-badge>
          <h1 class="kids-title">Welcome to MaxxPixels Kids!</h1>
          <p class="kids-sub">Fun animated movies, cartoon shows, and family adventures safe for all ages.</p>
        </div>
      </div>

      <div *ngIf="kidsContent.length > 0" class="kids-grid">
        <div *ngFor="let item of kidsContent" class="kids-card" (click)="playKids(item.id)">
          <div class="card-media">
            <img [src]="item.posterUrl" [alt]="item.title" />
            <div class="badge-overlay"><ott-badge type="KIDS"></ott-badge></div>
          </div>
          <div class="card-info">
            <span class="card-title">{{ item.title }}</span>
            <span class="card-meta">{{ item.genre }}</span>
          </div>
        </div>
      </div>

      <div *ngIf="kidsContent.length === 0 && !loading" class="empty-state">
        <p>No kids content found in the catalog.</p>
      </div>
    </div>
  `,
  styles: [`
    .kids-page-container {
      padding: 90px 4vw 60px 4vw; min-height: 100vh; background: #06070A; color: #FFF;
    }
    .kids-banner {
      position: relative; border-radius: 20px; background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); padding: 40px 32px; margin-bottom: 40px; box-shadow: 0 10px 30px rgba(59, 130, 246, 0.3);
      .kids-title { font-size: clamp(28px, 4vw, 42px); font-weight: 900; margin: 12px 0 8px 0; }
      .kids-sub { font-size: 16px; color: rgba(255,255,255,0.9); margin: 0; max-width: 600px; }
    }
    .kids-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 24px;
    }
    .kids-card {
      border-radius: 12px; background: #171A21; overflow: hidden; cursor: pointer; transition: transform 200ms ease;
      &:hover { transform: scale(1.06); }
      .card-media { position: relative; aspect-ratio: 2/3; img { width: 100%; height: 100%; object-fit: cover; } .badge-overlay { position: absolute; top: 8px; left: 8px; } }
      .card-info { padding: 12px; .card-title { font-size: 14px; font-weight: 800; display: block; } .card-meta { font-size: 12px; color: #747B89; } }
    }
    .empty-state {
      padding: 60px 0;
      text-align: center;
      color: #747B89;
      font-size: 16px;
    }
  `]
})
export class KidsPage implements OnInit {
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);

  kidsContent: KidsItem[] = [];
  loading = false;

  ngOnInit(): void {
    this.fetchKidsContent();
  }

  fetchKidsContent(): void {
    this.loading = true;
    this.http.get<any>(`${environment.apiBaseUrl}/contents`).subscribe({
      next: (res) => {
        this.loading = false;
        const list = res?.data ?? [];
        if (Array.isArray(list) && list.length > 0) {
          const filtered = list.filter((c: any) =>
            (c.ageRating && (c.ageRating.includes('U') || c.ageRating.includes('Kids') || c.ageRating.includes('7+'))) ||
            (c.genres && c.genres.some((g: string) => ['Animation', 'Kids', 'Family', 'Cartoon'].includes(g)))
          );
          this.kidsContent = filtered.map((c: any) => ({
            id: String(c.id),
            title: c.title || 'Kids Title',
            genre: c.genres ? c.genres.join(', ') : 'Animation',
            posterUrl: c.posterUrl || c.landscapeImageUrl || ''
          }));
        } else {
          this.kidsContent = [];
        }
      },
      error: () => {
        this.loading = false;
        this.kidsContent = [];
      }
    });
  }

  playKids(id: string): void { this.router.navigate(['/watch', id]); }
}
