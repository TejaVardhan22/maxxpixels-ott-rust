import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'ott-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span [class]="'ott-badge badge-' + type.toLowerCase().replace('/', '-')">
      {{ label || type }}
    </span>
  `,
  styles: [`
    .ott-badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 7px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      line-height: 1.3;
      border: 1px solid transparent;
      user-select: none;
    }

    .badge-4k, .badge-hdr, .badge-uhd {
      background: rgba(255, 255, 255, 0.12);
      color: #FFFFFF;
      border-color: rgba(255, 255, 255, 0.3);
    }

    .badge-new {
      background: #E50914;
      color: #FFFFFF;
    }

    .badge-live {
      background: #EF4444;
      color: #FFFFFF;
      animation: pulse-live 1.8s infinite;
    }

    .badge-premium {
      background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
      color: #000000;
      font-weight: 900;
    }

    .badge-free {
      background: #22C55E;
      color: #FFFFFF;
    }

    .badge-ad {
      background: rgba(245, 158, 11, 0.2);
      color: #F59E0B;
      border-color: rgba(245, 158, 11, 0.4);
    }

    .badge-u-a-13, .badge-u-a-16, .badge-a {
      background: rgba(255, 255, 255, 0.08);
      color: #AAB0BC;
      border-color: rgba(255, 255, 255, 0.15);
    }

    @keyframes pulse-live {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }
  `]
})
export class BadgeComponent {
  @Input() type: '4K' | 'HDR' | 'UHD' | 'NEW' | 'LIVE' | 'PREMIUM' | 'FREE' | 'AD' | 'U/A 13+' | string = '4K';
  @Input() label?: string;
}
