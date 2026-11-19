import { Component, OnInit, OnDestroy, ElementRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterModule, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { OttButtonComponent } from '../../../shared/components/ott-design-system/ott-button.component';
import { BadgeComponent } from '../../../shared/components/ott-design-system/badge.component';
import { SectionHeaderComponent } from '../../../shared/components/ott-design-system/section-header.component';
import { SkeletonComponent } from '../../../shared/components/ott-design-system/skeleton.component';
import { ProfileStore } from '../../../core/profiles/profile.store';
import { environment } from '../../../../environments/environment';

export interface ContentItem {
  id: string;
  title: string;
  type: 'movie' | 'series' | 'live';
  backdropUrl: string;
  posterUrl: string;
  description: string;
  year: number;
  maturity: string;
  duration?: string;
  seasons?: number;
  genres: string[];
  badges: string[];
  progress?: number;
  remaining?: string;
  rank?: number;
}

@Component({
  selector: 'app-ott-home-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
    MatMenuModule,
    OttButtonComponent,
    BadgeComponent,
    SectionHeaderComponent,
    SkeletonComponent
  ],
  template: `
    <div class="home-container">
      <!-- HERO CAROUSEL SECTION -->
      <section class="hero-carousel" (mouseenter)="pauseCarousel()" (mouseleave)="resumeCarousel()">
        <div class="carousel-track" [style.transform]="'translateX(-' + activeHeroIndex * 100 + '%)'">
          <div *ngFor="let hero of heroItems; let i = index" class="hero-slide">
            <div class="hero-bg" [style.background-image]="'url(' + hero.backdropUrl + ')'"></div>
            <div class="hero-vignette"></div>

            <div class="hero-content">
              <div class="hero-badges">
                <ott-badge *ngFor="let badge of hero.badges" [type]="badge"></ott-badge>
              </div>

              <h1 class="hero-title">{{ hero.title }}</h1>

              <div class="hero-metadata">
                <span class="meta-item">{{ hero.year }}</span>
                <span class="meta-dot">&bull;</span>
                <span class="meta-item">{{ hero.maturity }}</span>
                <span class="meta-dot">&bull;</span>
                <span class="meta-item">{{ hero.duration || (hero.seasons + ' Seasons') }}</span>
                <span class="meta-dot">&bull;</span>
                <span class="meta-item genres">{{ hero.genres.join(', ') }}</span>
              </div>

              <p class="hero-description">{{ hero.description }}</p>

              <div class="hero-actions">
                <ott-button variant="primary" icon="play_arrow" (onClick)="playContent(hero.id)">
                  Play
                </ott-button>
                <ott-button variant="secondary" icon="info_outline" (onClick)="viewDetails(hero)">
                  More Info
                </ott-button>
                <ott-button variant="ghost" [icon]="isInMyList(hero.id) ? 'check' : 'add'" (onClick)="toggleMyList(hero.id)">
                  {{ isInMyList(hero.id) ? 'In My List' : 'My List' }}
                </ott-button>

                <!-- Audio Mute Preview Toggle -->
                <button class="hero-audio-btn" (click)="isAudioMuted = !isAudioMuted" [title]="isAudioMuted ? 'Unmute Preview' : 'Mute Preview'">
                  <mat-icon>{{ isAudioMuted ? 'volume_off' : 'volume_up' }}</mat-icon>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Carousel Navigation Controls -->
        <button class="carousel-arrow prev" (click)="prevHero()">
          <mat-icon>chevron_left</mat-icon>
        </button>
        <button class="carousel-arrow next" (click)="nextHero()">
          <mat-icon>chevron_right</mat-icon>
        </button>

        <div class="carousel-dots">
          <button
            *ngFor="let hero of heroItems; let i = index"
            class="dot"
            [class.active]="i === activeHeroIndex"
            (click)="selectHero(i)">
          </button>
        </div>
      </section>

      <!-- STICKY CATEGORY FILTER BAR -->
      <div class="category-filter-bar">
        <button
          *ngFor="let cat of categoryTabs"
          class="cat-tab"
          [class.active]="activeCategoryTab === cat"
          (click)="activeCategoryTab = cat">
          {{ cat }}
        </button>
      </div>

      <!-- CONTENT RAILS -->
      <div class="rails-container">

        <!-- 1. CONTINUE WATCHING RAIL -->
        <section class="rail-section" *ngIf="continueWatchingItems.length > 0">
          <ott-section-header [title]="'Continue Watching for ' + (profileStore.activeProfile()?.name || 'User')" [showViewAll]="false"></ott-section-header>
          <div class="rail-scroll-wrapper">
            <button class="rail-nav prev" (click)="scrollRail(cwRail, -400)"><mat-icon>chevron_left</mat-icon></button>
            <div #cwRail class="rail-track landscape-rail">
              <div *ngFor="let item of continueWatchingItems" class="card-item landscape-card">
                <div class="card-media" (click)="playContent(item.id)">
                  <img [src]="item.backdropUrl" [alt]="item.title" loading="lazy" class="card-img" />
                  <div class="play-overlay"><mat-icon>play_circle_filled</mat-icon></div>
                  <div class="card-progress-bar">
                    <div class="progress-fill" [style.width]="item.progress + '%'"></div>
                  </div>
                </div>

                <div class="card-info">
                  <div class="info-top">
                    <span class="card-title">{{ item.title }}</span>
                    <button class="context-btn" [matMenuTriggerFor]="cwMenu"><mat-icon>more_vert</mat-icon></button>
                    <mat-menu #cwMenu="matMenu">
                      <button mat-menu-item (click)="playContent(item.id)">
                        <mat-icon>replay</mat-icon>
                        <span>Start Over</span>
                      </button>
                      <button mat-menu-item (click)="removeFromContinueWatching(item.id)">
                        <mat-icon>remove_circle_outline</mat-icon>
                        <span>Remove from List</span>
                      </button>
                    </mat-menu>
                  </div>
                  <span class="text-metadata">{{ item.remaining }} remaining</span>
                </div>
              </div>
            </div>
            <button class="rail-nav next" (click)="scrollRail(cwRail, 400)"><mat-icon>chevron_right</mat-icon></button>
          </div>
        </section>

        <!-- 2. TOP 10 IN INDIA RAIL -->
        <section class="rail-section">
          <ott-section-header title="Top 10 Shows & Movies Today" [showViewAll]="false"></ott-section-header>
          <div class="rail-scroll-wrapper">
            <button class="rail-nav prev" (click)="scrollRail(top10Rail, -400)"><mat-icon>chevron_left</mat-icon></button>
            <div #top10Rail class="rail-track top10-rail">
              <div *ngFor="let item of top10Items; let idx = index" class="top10-card" (click)="viewDetails(item)">
                <div class="rank-number">{{ idx + 1 }}</div>
                <div class="top10-poster">
                  <img [src]="item.posterUrl" [alt]="item.title" loading="lazy" />
                  <div class="badge-overlay"><ott-badge [type]="item.badges[0] || 'TOP 10'"></ott-badge></div>
                </div>
              </div>
            </div>
            <button class="rail-nav next" (click)="scrollRail(top10Rail, 400)"><mat-icon>chevron_right</mat-icon></button>
          </div>
        </section>

        <!-- 3. TRENDING NOW RAIL -->
        <section class="rail-section">
          <ott-section-header title="Trending Now" (onViewAll)="navigateCategory('trending')"></ott-section-header>
          <div class="rail-scroll-wrapper">
            <button class="rail-nav prev" (click)="scrollRail(trendingRail, -400)"><mat-icon>chevron_left</mat-icon></button>
            <div #trendingRail class="rail-track poster-rail">
              <div
                *ngFor="let item of trendingItems"
                class="card-item poster-card"
                (mouseenter)="setHoverItem(item, $event)"
                (mouseleave)="clearHoverItem()">
                <div class="card-media" (click)="viewDetails(item)">
                  <img [src]="item.posterUrl" [alt]="item.title" loading="lazy" class="card-img" />
                  <div class="badge-overlay"><ott-badge *ngIf="item.badges[0]" [type]="item.badges[0]"></ott-badge></div>
                </div>
                <div class="card-info">
                  <span class="card-title">{{ item.title }}</span>
                  <div class="card-meta">
                    <span>{{ item.year }}</span>
                    <span>&bull;</span>
                    <span>{{ item.maturity }}</span>
                  </div>
                </div>
              </div>
            </div>
            <button class="rail-nav next" (click)="scrollRail(trendingRail, 400)"><mat-icon>chevron_right</mat-icon></button>
          </div>
        </section>

        <!-- 4. LIVE CHANNELS & SPORTS RAIL -->
        <section class="rail-section">
          <ott-section-header title="Live Sports & Events" (onViewAll)="navigateCategory('live')"></ott-section-header>
          <div class="rail-scroll-wrapper">
            <button class="rail-nav prev" (click)="scrollRail(liveRail, -400)"><mat-icon>chevron_left</mat-icon></button>
            <div #liveRail class="rail-track landscape-rail">
              <div *ngFor="let item of liveItems" class="card-item landscape-card" (click)="playContent(item.id)">
                <div class="card-media">
                  <img [src]="item.backdropUrl" [alt]="item.title" loading="lazy" class="card-img" />
                  <div class="badge-overlay"><ott-badge type="LIVE"></ott-badge></div>
                  <div class="play-overlay"><mat-icon>play_circle_filled</mat-icon></div>
                </div>
                <div class="card-info">
                  <span class="card-title">{{ item.title }}</span>
                  <span class="text-metadata">{{ item.description }}</span>
                </div>
              </div>
            </div>
            <button class="rail-nav next" (click)="scrollRail(liveRail, 400)"><mat-icon>chevron_right</mat-icon></button>
          </div>
        </section>

      </div>

      <!-- DESKTOP EXPANDED HOVER CARD PREVIEW -->
      <div
        *ngIf="hoveredItem"
        class="expanded-hover-card"
        [style.top.px]="hoverPos.top"
        [style.left.px]="hoverPos.left"
        (mouseenter)="keepHoverItem()"
        (mouseleave)="clearHoverItem()">
        <div class="hover-media">
          <img [src]="hoveredItem.backdropUrl" [alt]="hoveredItem.title" />
          <div class="hover-vignette"></div>
          <span class="hover-title">{{ hoveredItem.title }}</span>
        </div>
        <div class="hover-body">
          <div class="hover-actions">
            <button class="action-btn play" (click)="playContent(hoveredItem.id)" title="Play"><mat-icon>play_arrow</mat-icon></button>
            <button class="action-btn" (click)="toggleMyList(hoveredItem.id)" title="Add to My List"><mat-icon>add</mat-icon></button>
            <button class="action-btn" title="Like"><mat-icon>thumb_up_off_alt</mat-icon></button>
            <button class="action-btn details" (click)="viewDetails(hoveredItem)" title="Details"><mat-icon>keyboard_arrow_down</mat-icon></button>
          </div>
          <div class="hover-meta">
            <span class="match-score">98% Match</span>
            <span class="badge-tag">{{ hoveredItem.maturity }}</span>
            <span>{{ hoveredItem.duration || (hoveredItem.seasons + ' Seasons') }}</span>
            <ott-badge type="4K"></ott-badge>
          </div>
          <div class="hover-genres">
            <span *ngFor="let g of hoveredItem.genres; let isLast = last">{{ g }}<ng-container *ngIf="!isLast"> &bull; </ng-container></span>
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .home-container {
      min-height: 100vh;
      background: var(--bg-main, #06070A);
      overflow-x: hidden;
      position: relative;
    }

    /* HERO CAROUSEL */
    .hero-carousel {
      position: relative;
      width: 100%;
      height: 82vh;
      min-height: 540px;
      max-height: 850px;
      overflow: hidden;
    }

    .carousel-track {
      display: flex;
      width: 100%;
      height: 100%;
      transition: transform 450ms cubic-bezier(0.2, 0, 0, 1);
    }

    .hero-slide {
      flex: 0 0 100%;
      height: 100%;
      position: relative;
      display: flex;
      align-items: center;
    }

    .hero-bg {
      position: absolute;
      inset: 0;
      background-size: cover;
      background-position: center 20%;
      filter: brightness(0.9);
    }

    .hero-vignette {
      position: absolute;
      inset: 0;
      background:
        linear-gradient(90deg, rgba(6, 7, 10, 0.95) 0%, rgba(6, 7, 10, 0.6) 45%, rgba(6, 7, 10, 0) 100%),
        linear-gradient(180deg, rgba(6, 7, 10, 0.4) 0%, rgba(6, 7, 10, 0) 40%, rgba(6, 7, 10, 1) 100%);
    }

    .hero-content {
      position: relative;
      z-index: 10;
      max-width: 680px;
      padding: 0 0 0 5vw;
      margin-top: 60px;
    }

    .hero-badges {
      display: flex;
      gap: 8px;
      margin-bottom: 14px;
    }

    .hero-title {
      font-size: clamp(34px, 5vw, 60px);
      font-weight: 900;
      line-height: 1.05;
      margin: 0 0 16px 0;
      letter-spacing: -1px;
      text-shadow: 0 4px 20px rgba(0, 0, 0, 0.8);
    }

    .hero-metadata {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 14px;
      font-weight: 600;
      color: #AAB0BC;
      margin-bottom: 16px;
    }

    .hero-description {
      font-size: 15px;
      color: #D1D5DB;
      line-height: 1.55;
      margin: 0 0 28px 0;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
      max-width: 580px;
    }

    .hero-actions {
      display: flex;
      align-items: center;
      gap: 14px;

      .hero-audio-btn {
        width: 44px; height: 44px; border-radius: 50%; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25); color: #FFF; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 150ms ease;
        &:hover { background: rgba(255,255,255,0.3); transform: scale(1.08); }
      }
    }

    .category-filter-bar {
      display: flex; gap: 12px; padding: 12px 5vw; background: rgba(6,7,10,0.85); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(255,255,255,0.06); position: sticky; top: 72px; z-index: 100; overflow-x: auto;
      .cat-tab {
        padding: 6px 16px; border-radius: 20px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #AAB0BC; font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap; transition: all 150ms ease;
        &:hover { color: #FFF; border-color: rgba(255,255,255,0.3); }
        &.active { background: #E50914; border-color: #E50914; color: #FFF; }
      }
    }

    .carousel-arrow {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      z-index: 20;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      backdrop-filter: blur(8px);
      transition: all 200ms ease;

      &:hover {
        background: rgba(229, 9, 20, 0.8);
        border-color: #E50914;
        transform: translateY(-50%) scale(1.1);
      }

      &.prev { left: 20px; }
      &.next { right: 20px; }
    }

    .carousel-dots {
      position: absolute;
      bottom: 24px;
      right: 5vw;
      z-index: 20;
      display: flex;
      gap: 8px;

      .dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
        border: none;
        cursor: pointer;
        transition: all 250ms ease;

        &.active {
          width: 28px;
          border-radius: 6px;
          background: #E50914;
        }
      }
    }

    /* RAILS CONTAINER */
    .rails-container {
      position: relative;
      z-index: 30;
      margin-top: 20px;
      padding: 0 4vw 60px 4vw;
      display: flex;
      flex-direction: column;
      gap: 38px;
    }

    .rail-section {
      position: relative;
    }

    .rail-scroll-wrapper {
      position: relative;
      margin: 0 -10px;

      .rail-nav {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        z-index: 50;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: rgba(18, 21, 28, 0.88);
        border: 1px solid rgba(255, 255, 255, 0.25);
        color: #FFFFFF;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        backdrop-filter: blur(12px);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.7);
        opacity: 0.85;
        transition: all 200ms cubic-bezier(0.2, 0, 0, 1);

        mat-icon { font-size: 32px; width: 32px; height: 32px; }

        &:hover {
          opacity: 1;
          background: #E50914;
          border-color: #E50914;
          box-shadow: 0 0 20px rgba(229, 9, 20, 0.6);
          transform: translateY(-50%) scale(1.15);
        }

        &.prev { left: 6px; }
        &.next { right: 6px; }
      }

      &:hover .rail-nav { opacity: 1; }
    }

    .rail-track {
      display: flex;
      gap: 16px;
      overflow-x: auto;
      scroll-behavior: smooth;
      padding: 10px;

      &::-webkit-scrollbar { display: none; }
    }

    /* CARDS */
    .card-item {
      flex: 0 0 auto;
      border-radius: 10px;
      background: var(--surface-card, #171A21);
      overflow: hidden;
      cursor: pointer;
      transition: transform 250ms cubic-bezier(0.2, 0, 0, 1), box-shadow 250ms ease;

      &:hover {
        transform: scale(1.05);
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.6);
        z-index: 35;
      }
    }

    .poster-card {
      width: 180px;

      .card-media {
        position: relative;
        width: 100%;
        aspect-ratio: 2/3;

        .card-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .badge-overlay {
          position: absolute;
          top: 8px;
          left: 8px;
        }
      }

      .card-info {
        padding: 10px 12px;

        .card-title {
          display: block;
          font-size: 14px;
          font-weight: 700;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .card-meta {
          display: flex;
          gap: 6px;
          font-size: 12px;
          color: #747B89;
          margin-top: 4px;
        }
      }
    }

    .landscape-card {
      width: 280px;

      .card-media {
        position: relative;
        width: 100%;
        aspect-ratio: 16/9;

        .card-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .badge-overlay {
          position: absolute;
          top: 8px;
          left: 8px;
        }

        .play-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 200ms ease;

          mat-icon { font-size: 48px; width: 48px; height: 48px; color: #E50914; }
        }

        &:hover .play-overlay { opacity: 1; }

        .card-progress-bar {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: rgba(255, 255, 255, 0.3);

          .progress-fill {
            height: 100%;
            background: #E50914;
          }
        }
      }

      .card-info {
        padding: 10px 12px;

        .info-top {
          display: flex;
          align-items: center;
          justify-content: space-between;

          .card-title {
            font-size: 14px;
            font-weight: 700;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .context-btn {
            background: transparent;
            border: none;
            color: #747B89;
            cursor: pointer;
            padding: 0;

            &:hover { color: #FFFFFF; }
          }
        }
      }
    }

    /* TOP 10 RAIL */
    .top10-card {
      display: flex;
      align-items: flex-end;
      width: 220px;
      cursor: pointer;

      .rank-number {
        font-size: 140px;
        font-weight: 900;
        line-height: 0.8;
        color: #06070A;
        -webkit-text-stroke: 4px rgba(255, 255, 255, 0.85);
        margin-right: -30px;
        z-index: 2;
        user-select: none;
      }

      .top10-poster {
        position: relative;
        width: 140px;
        aspect-ratio: 2/3;
        border-radius: 8px;
        overflow: hidden;
        z-index: 1;
        transition: transform 250ms ease;

        img { width: 100%; height: 100%; object-fit: cover; }

        .badge-overlay { position: absolute; top: 6px; left: 6px; }
      }

      &:hover .top10-poster {
        transform: scale(1.06);
      }
    }

    /* DESKTOP EXPANDED HOVER CARD PREVIEW */
    .expanded-hover-card {
      position: fixed;
      z-index: 2000;
      width: 320px;
      background: #181C24;
      border-radius: 12px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8);
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.12);
      animation: popHover 200ms cubic-bezier(0.2, 0, 0, 1);

      .hover-media {
        position: relative;
        width: 100%;
        height: 180px;

        img { width: 100%; height: 100%; object-fit: cover; }

        .hover-vignette {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(0, 0, 0, 0) 50%, rgba(24, 28, 36, 1) 100%);
        }

        .hover-title {
          position: absolute;
          bottom: 10px;
          left: 14px;
          font-size: 18px;
          font-weight: 800;
          color: #FFFFFF;
        }
      }

      .hover-body {
        padding: 14px;

        .hover-actions {
          display: flex;
          gap: 10px;
          margin-bottom: 12px;

          .action-btn {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: #FFFFFF;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;

            &.play {
              background: #FFFFFF;
              color: #000;
              border: none;
            }
            &.details { margin-left: auto; }
            &:hover { transform: scale(1.1); }
          }
        }

        .hover-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #AAB0BC;
          margin-bottom: 8px;

          .match-score { color: #22C55E; font-weight: 700; }
          .badge-tag { border: 1px solid rgba(255, 255, 255, 0.3); padding: 1px 4px; border-radius: 3px; }
        }

        .hover-genres {
          font-size: 12px;
          color: #747B89;
        }
      }
    }

    @keyframes popHover {
      0% { opacity: 0; transform: scale(0.92); }
      100% { opacity: 1; transform: scale(1); }
    }

    @media (max-width: 768px) {
      .hero-carousel { height: 60vh; }
      .hero-title { font-size: 28px; }
      .hero-content { padding-left: 16px; margin-top: 40px; }
      .poster-card { width: 130px; }
      .landscape-card { width: 220px; }
      .top10-card { width: 170px; .rank-number { font-size: 90px; } }
      .carousel-arrow { display: none; }
    }
  `]
})
export class HomePage implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  readonly profileStore = inject(ProfileStore);

  activeHeroIndex = 0;
  carouselTimer: any;
  myListIds: string[] = [];
  isAudioMuted = true;

  activeCategoryTab = 'All';
  categoryTabs = ['All', 'Movies', 'Series', 'Live Sports', 'Kids', 'Trending'];

  hoveredItem: ContentItem | null = null;
  hoverPos = { top: 0, left: 0 };
  hoverTimer: any;

  heroItems: ContentItem[] = [];
  continueWatchingItems: ContentItem[] = [];
  top10Items: ContentItem[] = [];
  trendingItems: ContentItem[] = [];
  liveItems: ContentItem[] = [];

  private readonly http = inject(HttpClient);

  ngOnInit(): void {
    this.startCarouselTimer();
    this.fetchCatalogData();
  }

  fetchCatalogData(): void {
    this.http.get<any>(`${environment.apiBaseUrl}/contents`).subscribe({
      next: (res) => {
        const list = res?.data ?? [];
        if (Array.isArray(list) && list.length > 0) {
          const mapped: ContentItem[] = list.map((c: any) => ({
            id: String(c.id),
            title: c.title || 'Untitled Content',
            type: (c.contentType || 'MOVIE').toLowerCase() === 'movie' ? 'movie' : 'series',
            backdropUrl: c.landscapeImageUrl || c.posterUrl || '',
            posterUrl: c.posterUrl || c.landscapeImageUrl || '',
            description: c.description || '',
            year: c.releaseYear || 2026,
            maturity: c.ageRating || 'U/A 13+',
            duration: c.durationSeconds ? Math.floor(c.durationSeconds / 60) + 'm' : '2h 00m',
            genres: c.genres || ['Drama'],
            badges: c.premium ? ['PREMIUM'] : ['FREE']
          }));

          this.heroItems = mapped.slice(0, 5);
          this.trendingItems = mapped;
          this.top10Items = mapped.slice(0, 10);
        } else {
          this.heroItems = [];
          this.trendingItems = [];
          this.top10Items = [];
        }
      },
      error: () => {
        this.heroItems = [];
        this.trendingItems = [];
        this.top10Items = [];
      }
    });
  }

  ngOnDestroy(): void {
    this.pauseCarousel();
  }

  startCarouselTimer(): void {
    this.carouselTimer = setInterval(() => {
      this.nextHero();
    }, 6000);
  }

  pauseCarousel(): void {
    if (this.carouselTimer) clearInterval(this.carouselTimer);
  }

  resumeCarousel(): void {
    this.startCarouselTimer();
  }

  nextHero(): void {
    if (!this.heroItems || this.heroItems.length === 0) return;
    this.activeHeroIndex = (this.activeHeroIndex + 1) % this.heroItems.length;
  }

  prevHero(): void {
    if (!this.heroItems || this.heroItems.length === 0) return;
    this.activeHeroIndex = (this.activeHeroIndex - 1 + this.heroItems.length) % this.heroItems.length;
  }

  selectHero(index: number): void {
    this.activeHeroIndex = index;
  }

  scrollRail(element: HTMLDivElement, amount: number): void {
    element.scrollBy({ left: amount, behavior: 'smooth' });
  }

  playContent(id: string): void {
    this.router.navigate(['/watch', id]);
  }

  viewDetails(item: ContentItem): void {
    if (item.type === 'series') {
      this.router.navigate(['/series', item.id]);
    } else {
      this.router.navigate(['/movie', item.id]);
    }
  }

  toggleMyList(id: string): void {
    if (this.isInMyList(id)) {
      this.myListIds = this.myListIds.filter(i => i !== id);
    } else {
      this.myListIds.push(id);
    }
  }

  isInMyList(id: string): boolean {
    return this.myListIds.includes(id);
  }

  removeFromContinueWatching(id: string): void {
    this.continueWatchingItems = this.continueWatchingItems.filter(item => item.id !== id);
  }

  navigateCategory(cat: string): void {
    this.router.navigate(['/' + cat]);
  }

  setHoverItem(item: ContentItem, event: MouseEvent): void {
    this.hoverTimer = setTimeout(() => {
      const target = event.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      this.hoverPos = {
        top: Math.max(10, rect.top - 40),
        left: Math.min(window.innerWidth - 340, rect.left - 20)
      };
      this.hoveredItem = item;
    }, 300);
  }

  clearHoverItem(): void {
    if (this.hoverTimer) clearTimeout(this.hoverTimer);
    this.hoveredItem = null;
  }

  keepHoverItem(): void {
    if (this.hoverTimer) clearTimeout(this.hoverTimer);
  }
}
