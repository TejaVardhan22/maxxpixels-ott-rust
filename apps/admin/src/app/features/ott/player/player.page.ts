import { Component, OnInit, OnDestroy, ElementRef, ViewChild, HostListener, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { OttButtonComponent } from '../../../shared/components/ott-design-system/ott-button.component';
import { BadgeComponent } from '../../../shared/components/ott-design-system/badge.component';
import { PlaybackStore, PlaybackState, AdState } from '../../../core/playback/playback.store';
import { PlaybackApiService, AdApiService, WatchHistoryApiService } from '../../../core/services/api-services';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { AuthStore } from '../../../core/auth/auth.store';
import { ProfileStore } from '../../../core/profiles/profile.store';

@Component({
  selector: 'app-ott-player-page',
  standalone: true,
  imports: [CommonModule, MatIconModule, OttButtonComponent, BadgeComponent],
  template: `
    <div class="player-container" (mousemove)="onUserInteraction()" (click)="onUserInteraction()">
      <!-- AUTHORIZING / LOADING SPINNER -->
      <div *ngIf="playbackStore.currentState() === 'AUTHORIZING' || playbackStore.currentState() === 'LOADING_MANIFEST'" class="loading-overlay">
        <div class="spinner"></div>
        <p>Authorizing Playback Session & Verifying Entitlement...</p>
      </div>

      <!-- VIDEO ELEMENT -->
      <video
        #videoPlayer
        class="video-element"
        poster="https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1600&q=80"
        (timeupdate)="onTimeUpdate()"
        (ended)="onVideoEnded()"
        (waiting)="onBuffering(true)"
        (playing)="onBuffering(false)">
        <source src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" type="video/mp4" />
      </video>

      <!-- AD OVERLAY (When Ad is playing) -->
      <div *ngIf="playbackStore.currentState() === 'PLAYING_AD'" class="ad-overlay">
        <div class="ad-badge-top">
          <ott-badge type="AD"></ott-badge>
          <span class="ad-info">Advertisement &bull; Ad {{ currentAdNumber }} of {{ totalAds }}</span>
          <span class="ad-timer">{{ formatTime(adTimeRemaining) }}</span>
        </div>

        <div class="ad-bottom-bar">
          <button *ngIf="canSkipAd" class="skip-ad-btn" (click)="skipAd()">
            Skip Ad <mat-icon>skip_next</mat-icon>
          </button>
          <div *ngIf="!canSkipAd" class="skip-countdown">
            Skip in {{ skipCountdown }}s
          </div>
        </div>
      </div>

      <!-- CUSTOM PLAYER OVERLAYS & CONTROLS -->
      <div class="player-controls-overlay" [class.hidden]="!showControls && playbackStore.isPlaying() && !playbackStore.isAdActive()">
        <!-- TOP CONTROLS BAR -->
        <div class="top-bar">
          <button class="icon-btn back-btn" (click)="goBack()" title="Back">
            <mat-icon>arrow_back</mat-icon>
          </button>
          <div class="title-info">
            <h2 class="video-title">{{ videoTitle }}</h2>
            <span class="video-sub">{{ subtitle }} &bull; Max: {{ playbackStore.deviceCapabilities().maxResolution }}</span>
          </div>
        </div>

        <!-- CENTER PLAY/SEEK CONTROLS -->
        <div class="center-controls" *ngIf="!playbackStore.isAdActive()">
          <button class="icon-btn circle-btn" (click)="rewind10()" title="Rewind 10s">
            <mat-icon>replay_10</mat-icon>
          </button>

          <button class="icon-btn circle-btn play-main" (click)="togglePlay()" title="Play/Pause">
            <mat-icon>{{ playbackStore.isPlaying() ? 'pause' : 'play_arrow' }}</mat-icon>
          </button>

          <button class="icon-btn circle-btn" (click)="forward10()" title="Forward 10s">
            <mat-icon>forward_10</mat-icon>
          </button>
        </div>

        <!-- SKIP INTRO BUTTON -->
        <button *ngIf="showSkipIntro && !playbackStore.isAdActive()" class="skip-intro-btn" (click)="skipIntro()">
          Skip Intro <mat-icon>fast_forward</mat-icon>
        </button>

        <!-- BOTTOM CONTROLS BAR -->
        <div class="bottom-bar" *ngIf="!playbackStore.isAdActive()">
          <!-- TIMELINE -->
          <div class="timeline-container" (click)="onTimelineClick($event)">
            <div class="timeline-bg">
              <div class="timeline-buffered" [style.width]="bufferedPercent + '%'"></div>
              <div class="timeline-played" [style.width]="playedPercent + '%'"></div>

              <!-- Markers -->
              <div class="marker intro-marker" style="left: 15%" title="Intro"></div>
              <div class="marker ad-marker" style="left: 45%" title="Ad Break"></div>
            </div>
          </div>

          <div class="bottom-controls">
            <div class="controls-left">
              <button class="icon-btn" (click)="togglePlay()">
                <mat-icon>{{ playbackStore.isPlaying() ? 'pause' : 'play_arrow' }}</mat-icon>
              </button>

              <button class="icon-btn" (click)="toggleMute()">
                <mat-icon>{{ isMuted ? 'volume_off' : 'volume_up' }}</mat-icon>
              </button>
              <input type="range" min="0" max="1" step="0.05" [value]="volume" (input)="onVolumeChange($event)" class="volume-slider" />

              <span class="time-display">{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span>
            </div>

            <div class="controls-right">
              <!-- Playback Speed button -->
              <button class="icon-btn speed-btn" (click)="toggleSpeedModal()" title="Playback Speed">
                <span class="speed-label">{{ currentSpeed }}x</span>
              </button>

              <!-- Audio & Subtitles button -->
              <button class="icon-btn" (click)="toggleAudioSubtitleModal()" title="Audio & Subtitles (C)">
                <mat-icon>subtitles</mat-icon>
              </button>

              <!-- Quality button -->
              <button class="icon-btn quality-btn" (click)="toggleQualityModal()" title="Quality">
                <span class="quality-label">{{ currentQuality }}</span>
              </button>

              <!-- Episodes Drawer button -->
              <button class="icon-btn" (click)="showEpisodesDrawer = !showEpisodesDrawer" title="Episodes Drawer">
                <mat-icon>playlist_play</mat-icon>
              </button>

              <!-- Picture-in-Picture -->
              <button class="icon-btn" (click)="togglePip()" title="Picture in Picture">
                <mat-icon>picture_in_picture_alt</mat-icon>
              </button>

              <!-- Fullscreen -->
              <button class="icon-btn" (click)="toggleFullscreen()" title="Fullscreen (F)">
                <mat-icon>{{ isFullscreen ? 'fullscreen_exit' : 'fullscreen' }}</mat-icon>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- PLAYBACK SPEED MODAL -->
      <div *ngIf="showSpeedModal" class="player-modal speed-modal">
        <div class="modal-header">
          <h3>Playback Speed</h3>
          <button (click)="showSpeedModal = false"><mat-icon>close</mat-icon></button>
        </div>
        <div class="modal-list">
          <button
            *ngFor="let s of speedOptions"
            class="modal-option"
            [class.active]="currentSpeed === s"
            (click)="selectSpeed(s)">
            <span>{{ s === 1 ? '1.0x (Normal)' : s + 'x' }}</span>
          </button>
        </div>
      </div>

      <!-- QUALITY MODAL -->
      <div *ngIf="showQualityModal" class="player-modal quality-modal">
        <div class="modal-header">
          <h3>Video Quality</h3>
          <button (click)="showQualityModal = false"><mat-icon>close</mat-icon></button>
        </div>
        <div class="modal-list">
          <button
            *ngFor="let q of qualityOptions"
            class="modal-option"
            [class.active]="currentQuality === q.label"
            (click)="selectQuality(q.label)">
            <span>{{ q.label }}</span>
            <span *ngIf="q.badge" class="badge-tag">{{ q.badge }}</span>
          </button>
        </div>
      </div>

      <!-- AUDIO & SUBTITLES MODAL -->
      <div *ngIf="showAudioSubtitleModal" class="player-modal audio-modal">
        <div class="modal-header">
          <h3>Audio & Subtitles</h3>
          <button (click)="showAudioSubtitleModal = false"><mat-icon>close</mat-icon></button>
        </div>
        <div class="modal-grid">
          <div class="modal-col">
            <h4>Audio</h4>
            <button
              *ngFor="let a of audioOptions"
              class="modal-option"
              [class.active]="selectedAudio === a"
              (click)="selectedAudio = a">
              {{ a }}
            </button>
          </div>

          <div class="modal-col">
            <h4>Subtitles</h4>
            <button
              *ngFor="let s of subtitleOptions"
              class="modal-option"
              [class.active]="selectedSubtitle === s"
              (click)="selectedSubtitle = s">
              {{ s }}
            </button>
          </div>
        </div>
      </div>

      <!-- EPISODES SIDE DRAWER OVERLAY -->
      <div *ngIf="showEpisodesDrawer" class="episodes-drawer">
        <div class="drawer-header">
          <h3>{{ videoTitle }} Episodes</h3>
          <button (click)="showEpisodesDrawer = false"><mat-icon>close</mat-icon></button>
        </div>
        <div class="drawer-list">
          <div *ngIf="drawerEpisodes.length === 0" style="padding: 24px; color: #747B89; text-align: center;">
            No other episodes available.
          </div>
          <div *ngFor="let ep of drawerEpisodes" class="drawer-item" (click)="switchEpisode(ep)">
            <img [src]="ep.thumb" [alt]="ep.title" />
            <div class="drawer-item-info">
              <span class="ep-title">{{ ep.num ? ep.num + '. ' : '' }}{{ ep.title }}</span>
              <span class="ep-dur">{{ ep.duration }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- AUTO-PLAY NEXT EPISODE TOAST -->
      <div *ngIf="showNextToast && nextEpisodeTitle" class="next-episode-toast">
        <div class="toast-content">
          <h4>Next Up in {{ nextCountdown }}s</h4>
          <p>{{ nextEpisodeTitle }}</p>
        </div>
        <div class="toast-actions">
          <button class="toast-btn cancel" (click)="showNextToast = false">Cancel</button>
          <button class="toast-btn play" (click)="playNextNow()">Play Now</button>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .player-container {
      position: fixed; inset: 0; z-index: 5000; background: #000; color: #FFF; overflow: hidden; user-select: none;
    }

    .loading-overlay {
      position: absolute; inset: 0; z-index: 5200; background: rgba(6,7,10,0.9); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px;
      p { font-size: 15px; font-weight: 700; color: #AAB0BC; }
      .spinner { width: 48px; height: 48px; border: 4px solid rgba(255,255,255,0.1); border-top-color: #E50914; border-radius: 50%; animation: spin 1s linear infinite; }
    }

    .video-element {
      width: 100%; height: 100%; object-fit: contain;
    }

    .player-controls-overlay {
      position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 25%, rgba(0,0,0,0) 75%, rgba(0,0,0,0.9) 100%);
      display: flex; flex-direction: column; justify-content: space-between; padding: 24px 36px; transition: opacity 300ms ease;
      &.hidden { opacity: 0; pointer-events: none; }
    }

    .top-bar {
      display: flex; align-items: center; gap: 20px;
      .video-title { font-size: 22px; font-weight: 800; margin: 0; }
      .video-sub { font-size: 13px; color: #AAB0BC; }
    }

    .center-controls {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 36px;
      .circle-btn {
        width: 56px; height: 56px; border-radius: 50%; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); color: #FFF; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 150ms ease;
        mat-icon { font-size: 28px; width: 28px; height: 28px; }
        &.play-main { width: 72px; height: 72px; background: #E50914; border: none; mat-icon { font-size: 40px; width: 40px; height: 40px; } }
        &:hover { transform: scale(1.1); }
      }
    }

    .skip-intro-btn {
      position: absolute; right: 40px; bottom: 100px; padding: 10px 20px; border-radius: 8px; background: rgba(0,0,0,0.7); border: 1px solid rgba(255,255,255,0.3); color: #FFF; font-size: 14px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px;
      &:hover { background: #E50914; border-color: #E50914; }
    }

    .bottom-bar {
      display: flex; flex-direction: column; gap: 14px;
    }

    .timeline-container {
      width: 100%; height: 16px; display: flex; align-items: center; cursor: pointer;
      .timeline-bg {
        position: relative; width: 100%; height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px; transition: height 150ms ease;
        .timeline-buffered { position: absolute; top: 0; bottom: 0; left: 0; background: rgba(255,255,255,0.4); border-radius: 2px; }
        .timeline-played { position: absolute; top: 0; bottom: 0; left: 0; background: #E50914; border-radius: 2px; }
        .marker { position: absolute; top: -2px; width: 4px; height: 8px; border-radius: 2px; }
        .intro-marker { background: #3B82F6; }
        .ad-marker { background: #F59E0B; }
      }
      &:hover .timeline-bg { height: 8px; }
    }

    .bottom-controls {
      display: flex; align-items: center; justify-content: space-between;
      .controls-left, .controls-right { display: flex; align-items: center; gap: 18px; }
      .volume-slider { width: 80px; accent-color: #E50914; }
      .time-display { font-size: 13px; font-weight: 600; color: #AAB0BC; }
      .quality-btn, .speed-btn { font-size: 13px; font-weight: 800; border: 1px solid rgba(255,255,255,0.3); padding: 4px 8px; border-radius: 4px; }
    }

    .icon-btn {
      background: transparent; border: none; color: #FFF; cursor: pointer; display: flex; align-items: center; justify-content: center;
      &:hover { color: #E50914; }
    }

    /* AD OVERLAY */
    .ad-overlay {
      position: absolute; inset: 0; pointer-events: auto; z-index: 5500; display: flex; flex-direction: column; justify-content: space-between; padding: 24px 36px; background: rgba(0,0,0,0.2);
      .ad-badge-top { display: flex; align-items: center; gap: 14px; background: rgba(0,0,0,0.7); padding: 8px 16px; border-radius: 8px; width: fit-content; .ad-info { font-weight: 700; font-size: 14px; } .ad-timer { color: #F59E0B; font-weight: 800; } }
      .ad-bottom-bar { display: flex; justify-content: flex-end; }
      .skip-ad-btn { background: #E50914; color: #FFF; border: none; padding: 12px 24px; border-radius: 8px; font-size: 15px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px; }
      .skip-countdown { background: rgba(0,0,0,0.8); color: #AAB0BC; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 700; }
    }

    /* MODALS */
    .player-modal {
      position: absolute; bottom: 80px; right: 40px; z-index: 6000; width: 280px; background: rgba(18, 21, 28, 0.95); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; padding: 16px;
      .modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px; h3 { font-size: 15px; font-weight: 800; margin: 0; } button { background: transparent; border: none; color: #AAB0BC; cursor: pointer; } }
      .modal-option { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 10px 12px; border-radius: 6px; background: transparent; border: none; color: #AAB0BC; font-size: 13px; font-weight: 600; cursor: pointer; text-align: left; &:hover { background: rgba(255,255,255,0.1); color: #FFF; } &.active { background: rgba(229,9,20,0.2); color: #E50914; font-weight: 800; } }
    }

    /* EPISODES SIDE DRAWER */
    .episodes-drawer {
      position: absolute; top: 0; bottom: 0; right: 0; z-index: 6500; width: 340px; background: rgba(18, 21, 28, 0.95); backdrop-filter: blur(24px); border-left: 1px solid rgba(255,255,255,0.15); padding: 24px 20px; display: flex; flex-direction: column;
      .drawer-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; h3 { font-size: 16px; font-weight: 800; margin: 0; } button { background: transparent; border: none; color: #AAB0BC; cursor: pointer; } }
      .drawer-list { display: flex; flex-direction: column; gap: 14px; overflow-y: auto; flex: 1; }
      .drawer-item { display: flex; gap: 12px; cursor: pointer; padding: 8px; border-radius: 8px; &:hover { background: rgba(255,255,255,0.1); } img { width: 100px; aspect-ratio: 16/9; border-radius: 6px; object-fit: cover; } .ep-title { font-size: 13px; font-weight: 700; display: block; } .ep-dur { font-size: 11px; color: #747B89; } }
    }

    /* AUTO PLAY TOAST */
    .next-episode-toast {
      position: absolute; bottom: 90px; right: 40px; z-index: 6500; background: rgba(23, 26, 33, 0.95); border: 1px solid #E50914; border-radius: 12px; padding: 16px 20px; display: flex; align-items: center; gap: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.8);
      .toast-content { h4 { font-size: 15px; font-weight: 800; margin: 0 0 4px 0; color: #E50914; } p { font-size: 13px; color: #AAB0BC; margin: 0; } }
      .toast-actions { display: flex; gap: 10px; .toast-btn { padding: 6px 14px; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer; border: none; &.cancel { background: transparent; color: #AAB0BC; border: 1px solid rgba(255,255,255,0.2); } &.play { background: #E50914; color: #FFF; } } }
    }

    @keyframes spin { 100% { transform: rotate(360deg); } }
  `]
})
export class PlayerPage implements OnInit, OnDestroy {
  @ViewChild('videoPlayer') videoPlayerRef!: ElementRef<HTMLVideoElement>;

  readonly playbackStore = inject(PlaybackStore);
  private readonly playbackApi = inject(PlaybackApiService);
  private readonly adApi = inject(AdApiService);
  private readonly watchHistoryApi = inject(WatchHistoryApiService);
  private readonly authStore = inject(AuthStore);
  private readonly profileStore = inject(ProfileStore);

  videoTitle = 'Streaming Content';
  subtitle = '';
  isMuted = false;
  volume = 1;
  currentTime = 0;
  duration = 0;
  bufferedPercent = 0;
  playedPercent = 0;

  showControls = true;
  inactivityTimer: any;

  showSkipIntro = false;
  isFullscreen = false;

  // Modals & Drawers
  showQualityModal = false;
  showAudioSubtitleModal = false;
  showSpeedModal = false;
  showEpisodesDrawer = false;
  showNextToast = false;
  nextCountdown = 10;
  nextToastTimer: any;

  currentQuality = 'Auto';
  currentSpeed = 1.0;
  selectedAudio = 'Original';
  selectedSubtitle = 'Off';

  speedOptions = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  qualityOptions = [
    { label: 'Auto (Recommended)', badge: '' },
    { label: '4K UHD', badge: 'UHD' },
    { label: '1440p', badge: 'QHD' },
    { label: '1080p', badge: 'FHD' },
    { label: '720p', badge: 'HD' },
    { label: '480p (Data Saver)', badge: 'SD' }
  ];

  private readonly http = inject(HttpClient);

  audioOptions: string[] = ['Original'];
  subtitleOptions: string[] = ['Off'];

  drawerEpisodes: any[] = [];
  nextEpisodeTitle = '';

  // AD STATES
  currentAdNumber = 1;
  totalAds = 0;
  adTimeRemaining = 0;
  skipCountdown = 0;
  canSkipAd = false;
  adTimer: any;
  sessionId = 'ps_' + Math.random().toString(36).substring(2, 9);

  constructor(private location: Location, private route: ActivatedRoute) {}

  @HostListener('window:keydown', ['$event'])
  handleKeyboardShortcuts(event: KeyboardEvent): void {
    if (['Space', 'KeyF', 'KeyM', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyC'].includes(event.code)) {
      event.preventDefault();
    }
    switch (event.code) {
      case 'Space': this.togglePlay(); break;
      case 'KeyF': this.toggleFullscreen(); break;
      case 'KeyM': this.toggleMute(); break;
      case 'ArrowLeft': this.rewind10(); break;
      case 'ArrowRight': this.forward10(); break;
      case 'ArrowUp': this.changeVolume(0.1); break;
      case 'ArrowDown': this.changeVolume(-0.1); break;
      case 'KeyC': this.toggleAudioSubtitleModal(); break;
    }
  }

  ngOnInit(): void {
    this.route.params.subscribe(p => {
      const id = p['id'];
      if (id) {
        this.videoTitle = 'Loading Content...';
        this.playbackApi.getPlaybackInfo(id).subscribe({
          next: (res: any) => {
            if (res?.data) {
              this.videoTitle = res.data.title || `Content #${id}`;
              this.subtitle = res.data.contentType || '';
            }
          },
          error: () => {}
        });
      }
    });

    this.playbackStore.setPlaybackState('AUTHORIZING');

    setTimeout(() => {
      this.playbackStore.setPlaybackState('LOADING_MANIFEST');
    }, 600);

    this.http.get<any>(`${environment.apiBaseUrl}/languages`).subscribe({
      next: (res: any) => {
        const langs = res?.data ?? res?.result ?? res ?? [];
        if (Array.isArray(langs)) {
          langs.forEach((l: any) => {
            const name = l.name || l.code;
            if (name) {
              if (!this.audioOptions.includes(name)) this.audioOptions.push(name);
              if (!this.subtitleOptions.includes(name)) this.subtitleOptions.push(name);
            }
          });
        }
      }
    });

    this.resetInactivityTimer();
  }

  ngOnDestroy(): void {
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    if (this.adTimer) clearInterval(this.adTimer);
    if (this.nextToastTimer) clearInterval(this.nextToastTimer);
  }

  startAdBreak(): void {
    this.playbackStore.setAdState('PLAYING');
    this.adTimeRemaining = 15;
    this.skipCountdown = 5;
    this.canSkipAd = false;

    this.adTimer = setInterval(() => {
      this.adTimeRemaining--;
      if (this.skipCountdown > 0) this.skipCountdown--;
      if (this.skipCountdown === 0) this.canSkipAd = true;

      if (this.adTimeRemaining <= 0) {
        this.finishAd();
      }
    }, 1000);
  }

  skipAd(): void {
    this.finishAd();
  }

  finishAd(): void {
    if (this.adTimer) clearInterval(this.adTimer);
    this.playbackStore.setAdState('COMPLETED');
    this.playbackStore.setPlaybackState('PLAYING');
    this.togglePlay();
  }

  onUserInteraction(): void {
    this.showControls = true;
    this.resetInactivityTimer();
  }

  resetInactivityTimer(): void {
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    this.inactivityTimer = setTimeout(() => {
      if (this.playbackStore.isPlaying() && !this.showQualityModal && !this.showAudioSubtitleModal && !this.showSpeedModal && !this.showEpisodesDrawer) {
        this.showControls = false;
      }
    }, 3500);
  }

  togglePlay(): void {
    const video = this.videoPlayerRef?.nativeElement;
    if (!video) return;
    if (this.playbackStore.isPlaying()) {
      video.pause();
      this.playbackStore.setPlaybackState('PAUSED');
    } else {
      video.play().catch(() => {});
      this.playbackStore.setPlaybackState('PLAYING');
    }
  }

  rewind10(): void {
    if (this.videoPlayerRef?.nativeElement) this.videoPlayerRef.nativeElement.currentTime -= 10;
  }

  forward10(): void {
    if (this.videoPlayerRef?.nativeElement) this.videoPlayerRef.nativeElement.currentTime += 10;
  }

  skipIntro(): void {
    if (this.videoPlayerRef?.nativeElement) this.videoPlayerRef.nativeElement.currentTime += 85;
    this.showSkipIntro = false;
  }

  onTimeUpdate(): void {
    const video = this.videoPlayerRef?.nativeElement;
    if (!video) return;
    this.currentTime = video.currentTime;
    this.duration = video.duration || 181;
    this.playedPercent = (this.currentTime / this.duration) * 100;
  }

  onBuffering(buffering: boolean): void {
    if (buffering && this.playbackStore.isPlaying()) {
      this.playbackStore.setPlaybackState('BUFFERING');
    } else if (!buffering && this.playbackStore.isBuffering()) {
      this.playbackStore.setPlaybackState('PLAYING');
    }
  }

  onTimelineClick(e: MouseEvent): void {
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percent = clickX / rect.width;
    if (this.videoPlayerRef?.nativeElement) {
      this.videoPlayerRef.nativeElement.currentTime = percent * this.duration;
    }
  }

  toggleMute(): void {
    this.isMuted = !this.isMuted;
    if (this.videoPlayerRef?.nativeElement) this.videoPlayerRef.nativeElement.muted = this.isMuted;
  }

  changeVolume(delta: number): void {
    this.volume = Math.max(0, Math.min(1, this.volume + delta));
    if (this.videoPlayerRef?.nativeElement) this.videoPlayerRef.nativeElement.volume = this.volume;
  }

  onVolumeChange(e: Event): void {
    const val = parseFloat((e.target as HTMLInputElement).value);
    this.volume = val;
    if (this.videoPlayerRef?.nativeElement) this.videoPlayerRef.nativeElement.volume = val;
  }

  toggleSpeedModal(): void {
    this.showSpeedModal = !this.showSpeedModal;
    this.showQualityModal = false;
    this.showAudioSubtitleModal = false;
  }

  selectSpeed(speed: number): void {
    this.currentSpeed = speed;
    if (this.videoPlayerRef?.nativeElement) this.videoPlayerRef.nativeElement.playbackRate = speed;
    this.showSpeedModal = false;
  }

  toggleQualityModal(): void {
    this.showQualityModal = !this.showQualityModal;
    this.showAudioSubtitleModal = false;
    this.showSpeedModal = false;
  }

  selectQuality(q: string): void {
    this.currentQuality = q;
    this.showQualityModal = false;
  }

  toggleAudioSubtitleModal(): void {
    this.showAudioSubtitleModal = !this.showAudioSubtitleModal;
    this.showQualityModal = false;
    this.showSpeedModal = false;
  }

  switchEpisode(ep: any): void {
    if (ep?.title) {
      this.videoTitle = ep.title;
    }
    this.showEpisodesDrawer = false;
    if (this.videoPlayerRef?.nativeElement) this.videoPlayerRef.nativeElement.currentTime = 0;
  }

  togglePip(): void {
    const video = this.videoPlayerRef?.nativeElement;
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture();
    } else if (video) {
      video.requestPictureInPicture();
    }
  }

  toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      this.isFullscreen = true;
    } else {
      document.exitFullscreen();
      this.isFullscreen = false;
    }
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  onVideoEnded(): void {
    this.playbackStore.setPlaybackState('ENDED');
    if (this.nextEpisodeTitle) {
      this.showNextToast = true;
      this.nextCountdown = 10;
      this.nextToastTimer = setInterval(() => {
        this.nextCountdown--;
        if (this.nextCountdown <= 0) {
          this.playNextNow();
        }
      }, 1000);
    }
  }

  playNextNow(): void {
    if (this.nextToastTimer) clearInterval(this.nextToastTimer);
    this.showNextToast = false;
    if (this.nextEpisodeTitle) {
      this.videoTitle = this.nextEpisodeTitle;
    }
    if (this.videoPlayerRef?.nativeElement) {
      this.videoPlayerRef.nativeElement.currentTime = 0;
      this.togglePlay();
    }
  }

  goBack(): void {
    this.location.back();
  }
}
