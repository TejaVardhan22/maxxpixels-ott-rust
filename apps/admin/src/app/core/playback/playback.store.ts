import { Injectable, signal, computed } from '@angular/core';

export type PlaybackState =
  | 'IDLE'
  | 'AUTHORIZING'
  | 'LOADING_MANIFEST'
  | 'PLAYING_AD'
  | 'PLAYING'
  | 'PAUSED'
  | 'BUFFERING'
  | 'SEEKING'
  | 'ENDED'
  | 'ERROR';

export type AdState =
  | 'NO_AD'
  | 'REQUESTING'
  | 'LOADING'
  | 'PLAYING'
  | 'PAUSED'
  | 'SKIPPABLE'
  | 'COMPLETED'
  | 'FAILED';

export interface DeviceCapabilities {
  supports4K: boolean;
  supportsHDR: boolean;
  supportsWidevine: boolean;
  maxResolution: string;
}

@Injectable({
  providedIn: 'root'
})
export class PlaybackStore {
  readonly currentState = signal<PlaybackState>('IDLE');
  readonly currentAdState = signal<AdState>('NO_AD');

  readonly deviceCapabilities = signal<DeviceCapabilities>(this.detectCapabilities());

  // Computed Selectors
  readonly isPlaying = computed(() => this.currentState() === 'PLAYING');
  readonly isAdActive = computed(() => this.currentState() === 'PLAYING_AD');
  readonly isBuffering = computed(() => this.currentState() === 'BUFFERING');
  readonly hasError = computed(() => this.currentState() === 'ERROR');

  setPlaybackState(state: PlaybackState): void {
    this.currentState.set(state);
  }

  setAdState(state: AdState): void {
    this.currentAdState.set(state);
    if (state === 'PLAYING' || state === 'SKIPPABLE') {
      this.currentState.set('PLAYING_AD');
    }
  }

  private detectCapabilities(): DeviceCapabilities {
    const width = window.screen.width * (window.devicePixelRatio || 1);
    const supports4K = width >= 3840 || window.innerWidth >= 1920;
    const supportsHDR = window.matchMedia('(dynamic-range: high)').matches;

    return {
      supports4K,
      supportsHDR,
      supportsWidevine: true,
      maxResolution: supports4K ? '2160P' : '1080P'
    };
  }
}
