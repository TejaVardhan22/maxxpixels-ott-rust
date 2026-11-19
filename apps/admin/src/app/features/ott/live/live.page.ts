import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterModule, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { BadgeComponent } from '../../../shared/components/ott-design-system/badge.component';
import { environment } from '../../../../environments/environment';

export interface LiveChannel {
  id: string;
  channelName: string;
  currentShow: string;
  nextShow: string;
  progressPercent: number;
  timeRemaining: string;
  category: string;
  backdropUrl: string;
}

@Component({
  selector: 'app-ott-live-page',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, BadgeComponent],
  template: `
    <div class="page-container">
      <div class="header-section">
        <h1 class="page-heading">Live TV & Electronic Program Guide (EPG)</h1>
        <p class="page-sub">Watch live sports, breaking news, and active TV broadcasts with real-time EPG guides.</p>
      </div>

      <div *ngIf="liveList.length > 0" class="epg-grid">
        <div *ngFor="let item of liveList" class="live-card" (click)="playLive(item.id)">
          <div class="card-media">
            <img [src]="item.backdropUrl" [alt]="item.channelName" loading="lazy" />
            <div class="badge-overlay"><ott-badge type="LIVE"></ott-badge></div>
            <div class="play-overlay"><mat-icon>play_circle_filled</mat-icon></div>

            <!-- EPG Live Progress Bar -->
            <div class="epg-progress-bar">
              <div class="epg-fill" [style.width]="item.progressPercent + '%'"></div>
            </div>
          </div>

          <div class="card-info">
            <div class="channel-name-row">
              <span class="channel-name">{{ item.channelName }}</span>
              <span class="category-tag">{{ item.category }}</span>
            </div>

            <h3 class="current-show">🔴 {{ item.currentShow }}</h3>

            <div class="epg-next-row" *ngIf="item.nextShow">
              <span class="next-label">UP NEXT:</span>
              <span class="next-show">{{ item.nextShow }}</span>
              <span class="time-rem" *ngIf="item.timeRemaining">({{ item.timeRemaining }} left)</span>
            </div>
          </div>
        </div>
      </div>

      <div *ngIf="liveList.length === 0 && !loading" class="empty-state">
        <p>No live channels currently broadcasting.</p>
      </div>
    </div>
  `,
  styles: [`
    .page-container { padding: 100px 4vw 60px 4vw; min-height: 100vh; color: #FFF; }
    .header-section { margin-bottom: 36px; .page-heading { font-size: 36px; font-weight: 900; margin: 0 0 8px 0; } .page-sub { color: #AAB0BC; font-size: 15px; } }
    .epg-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 28px; }
    .live-card {
      border-radius: 14px; background: #171A21; border: 1px solid rgba(255,255,255,0.08); overflow: hidden; cursor: pointer; transition: transform 250ms ease, box-shadow 250ms ease;
      &:hover { transform: translateY(-6px); box-shadow: 0 16px 40px rgba(0,0,0,0.7); border-color: #E50914; }
      .card-media {
        position: relative; aspect-ratio: 16/9;
        img { width: 100%; height: 100%; object-fit: cover; }
        .badge-overlay { position: absolute; top: 10px; left: 10px; }
        .play-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 200ms ease; mat-icon { font-size: 52px; width: 52px; height: 52px; color: #E50914; } }
        &:hover .play-overlay { opacity: 1; }
        .epg-progress-bar { position: absolute; bottom: 0; left: 0; right: 0; height: 4px; background: rgba(255,255,255,0.3); .epg-fill { height: 100%; background: #EF4444; } }
      }
      .card-info {
        padding: 16px;
        .channel-name-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; .channel-name { font-size: 13px; font-weight: 800; color: #E50914; letter-spacing: 0.5px; } .category-tag { font-size: 11px; color: #747B89; font-weight: 700; background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 4px; } }
        .current-show { font-size: 16px; font-weight: 800; margin: 0 0 10px 0; line-height: 1.3; }
        .epg-next-row { font-size: 12px; color: #AAB0BC; display: flex; gap: 6px; align-items: center; .next-label { font-weight: 800; color: #747B89; } .next-show { font-weight: 600; } .time-rem { color: #F59E0B; } }
      }
    }
    .empty-state {
      padding: 60px 0;
      text-align: center;
      color: #747B89;
      font-size: 16px;
    }
  `]
})
export class LivePage implements OnInit {
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);

  liveList: LiveChannel[] = [];
  loading = false;

  ngOnInit(): void {
    this.fetchLiveChannels();
  }

  fetchLiveChannels(): void {
    this.loading = true;
    this.http.get<any>(`${environment.apiBaseUrl}/live-channels`).subscribe({
      next: (res) => {
        this.loading = false;
        const list = res?.data ?? [];
        if (Array.isArray(list) && list.length > 0) {
          this.liveList = list.map((ch: any) => ({
            id: String(ch.id),
            channelName: ch.name || 'Live Channel',
            currentShow: ch.currentProgram || ch.name || 'Live Broadcast',
            nextShow: ch.nextProgram || '',
            progressPercent: 50,
            timeRemaining: '',
            category: ch.category || 'Live',
            backdropUrl: ch.thumbnailUrl || ch.streamUrl || ''
          }));
        } else {
          this.liveList = [];
        }
      },
      error: () => {
        this.loading = false;
        this.liveList = [];
      }
    });
  }

  playLive(id: string): void { this.router.navigate(['/watch', id]); }
}
