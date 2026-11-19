import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { EmptyStateComponent } from '../../../shared/components/ott-design-system/empty-state.component';
import { BadgeComponent } from '../../../shared/components/ott-design-system/badge.component';

@Component({
  selector: 'app-ott-mylist-page',
  standalone: true,
  imports: [CommonModule, MatIconModule, EmptyStateComponent, BadgeComponent],
  template: `
    <div class="page-container">
      <h1 class="page-heading">My Watchlist</h1>

      <div *ngIf="myList.length > 0" class="list-grid">
        <div *ngFor="let item of myList" class="list-card" (click)="viewMovie(item.id)">
          <div class="card-media">
            <img [src]="item.posterUrl" [alt]="item.title" />
            <div class="badge-overlay"><ott-badge [type]="item.quality"></ott-badge></div>
            <button class="remove-btn" (click)="removeItem(item.id, $event)" title="Remove"><mat-icon>close</mat-icon></button>
          </div>
          <div class="card-info">
            <span class="card-title">{{ item.title }}</span>
            <span class="text-metadata">{{ item.year }} &bull; {{ item.genre }}</span>
          </div>
        </div>
      </div>

      <div *ngIf="myList.length === 0">
        <ott-empty-state
          icon="bookmark_border"
          title="Your list is empty"
          description="Add movies and shows you want to watch later."
          actionLabel="Explore Movies"
          (onAction)="goToBrowse()">
        </ott-empty-state>
      </div>
    </div>
  `,
  styles: [`
    .page-container { padding: 100px 4vw 60px 4vw; min-height: 100vh; }
    .page-heading { font-size: 36px; font-weight: 900; margin-bottom: 32px; }
    .list-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 24px; }
    .list-card {
      border-radius: 10px; background: #171A21; overflow: hidden; cursor: pointer; transition: transform 200ms ease;
      &:hover { transform: scale(1.05); }
      .card-media {
        position: relative; aspect-ratio: 2/3;
        img { width: 100%; height: 100%; object-fit: cover; }
        .badge-overlay { position: absolute; top: 8px; left: 8px; }
        .remove-btn {
          position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.6); border: none; color: #FFF; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer;
          &:hover { background: #E50914; }
        }
      }
      .card-info { padding: 10px; .card-title { display: block; font-size: 14px; font-weight: 700; } .text-metadata { font-size: 12px; color: #747B89; } }
    }
  `]
})
export class MyListPage {
  myList: any[] = [];

  constructor(private router: Router) {}

  viewMovie(id: string): void { this.router.navigate(['/movie', id]); }
  removeItem(id: string, e: MouseEvent): void {
    e.stopPropagation();
    this.myList = this.myList.filter(item => item.id !== id);
  }
  goToBrowse(): void { this.router.navigate(['/movies']); }
}
