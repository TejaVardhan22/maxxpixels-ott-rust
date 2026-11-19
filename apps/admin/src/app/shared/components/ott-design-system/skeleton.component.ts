import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'ott-skeleton',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      [class]="'ott-skeleton skeleton-' + variant"
      [style.width]="width"
      [style.height]="height"
      [style.border-radius]="radius">
    </div>
  `,
  styles: [`
    .ott-skeleton {
      background: linear-gradient(90deg, #12151C 25%, #1D222E 37%, #12151C 63%);
      background-size: 400% 100%;
      animation: skeleton-shimmer 1.4s ease infinite;
      border-radius: 8px;
    }

    .skeleton-hero {
      width: 100%;
      height: 70vh;
      border-radius: 0;
    }

    .skeleton-poster {
      width: 100%;
      aspect-ratio: 2/3;
      border-radius: 8px;
    }

    .skeleton-landscape {
      width: 100%;
      aspect-ratio: 16/9;
      border-radius: 8px;
    }

    .skeleton-text {
      width: 100%;
      height: 16px;
      border-radius: 4px;
    }

    @keyframes skeleton-shimmer {
      0% { background-position: 100% 50%; }
      100% { background-position: 0 50%; }
    }
  `]
})
export class SkeletonComponent {
  @Input() variant: 'hero' | 'poster' | 'landscape' | 'text' | 'custom' = 'poster';
  @Input() width?: string;
  @Input() height?: string;
  @Input() radius?: string;
}
