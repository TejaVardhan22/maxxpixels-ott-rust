import { GoogleIMAService } from '../services/GoogleIMAService';
import type { VideoAdProvider } from './VideoAdProvider';
import type { AdEventType, AdEventPayload, AdRequestConfig } from '../types/ad.types';

export class GoogleIMAProvider implements VideoAdProvider {
  private service: GoogleIMAService;

  constructor() {
    this.service = new GoogleIMAService();
  }

  public async initialize(adContainer: HTMLElement, videoElement: HTMLVideoElement): Promise<void> {
    return this.service.initialize(adContainer, videoElement);
  }

  public requestAds(config: AdRequestConfig): void {
    this.service.requestAds(config);
  }

  public playAd(): void {
    this.service.playAd();
  }

  public pauseAd(): void {
    this.service.pauseAd();
  }

  public resumeAd(): void {
    this.service.resumeAd();
  }

  public skipAd(): void {
    this.service.skipAd();
  }

  public destroy(): void {
    this.service.destroy();
  }

  public isAdsEnabled(): boolean {
    return this.service.isAdsEnabled();
  }

  public on(event: AdEventType, callback: (payload: AdEventPayload) => void): void {
    this.service.on(event, callback);
  }

  public off(event: AdEventType, callback: (payload: AdEventPayload) => void): void {
    this.service.off(event, callback);
  }
}
