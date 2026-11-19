import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonModule } from '@angular/material/button';

export interface TableColumn<T> {
  key: string;
  header: string;
  sortable?: boolean;
  cell?: (row: T) => string;
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatInputModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressBarModule,
    MatButtonModule
  ],
  template: `
    <div class="table-container">
      <!-- Search Header -->
      <div class="table-header" *ngIf="showSearch">
        <mat-form-field appearance="outline" class="search-field">
          <mat-label>Search</mat-label>
          <input matInput (keyup)="onSearchChange($event)" placeholder="Search records...">
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>
      </div>

      <!-- Loading Bar -->
      <mat-progress-bar mode="query" *ngIf="loading"></mat-progress-bar>

      <!-- Table Body -->
      <div class="table-responsive">
        <table mat-table [dataSource]="data" matSort (matSortChange)="onSort($event)" class="mat-elevation-z1">
        <ng-container *ngFor="let col of columns" [matColumnDef]="col.key">
          <th mat-header-cell *matHeaderCellDef mat-sort-header [disabled]="!col.sortable">
            {{ col.header }}
          </th>
          <td mat-cell *matCellDef="let row">
            <ng-container *ngIf="col.cell; else defaultCell">
              {{ col.cell(row) }}
            </ng-container>
            <ng-template #defaultCell>
              {{ row[col.key] }}
            </ng-template>
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="displayedColumnKeys"></tr>
        <tr mat-row *matRowDef="let row; columns: displayedColumnKeys;"></tr>

        <!-- Empty State -->
        <tr class="mat-row" *matNoDataRow>
          <td class="mat-cell empty-cell" [attr.colspan]="displayedColumnKeys.length">
            <div class="empty-state">
              <mat-icon>inbox</mat-icon>
              <p>No records found</p>
            </div>
          </td>
        </tr>
        </table>
      </div>

      <!-- Paginator -->
      <mat-paginator
        [length]="totalElements"
        [pageSize]="pageSize"
        [pageSizeOptions]="[10, 20, 50, 100]"
        (page)="onPage($event)">
      </mat-paginator>
    </div>
  `,
  styles: [`
    .table-container {
      width: 100%;
      background: #1e1e24;
      border-radius: 8px;
      overflow: hidden;
    }
    .table-responsive {
      width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      display: block;
    }
    .table-header {
      padding: 16px;
    }
    .search-field {
      width: 100%;
      max-width: 320px;
    }
    table {
      width: 100%;
      min-width: 700px;
      background: transparent;
      border-collapse: collapse;
      th { white-space: nowrap; }
      td { white-space: nowrap; }
    }
    .empty-cell {
      padding: 32px;
      text-align: center;
    }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      color: #95a5a6;
      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        margin-bottom: 8px;
      }
    }
  `]
})
export class DataTableComponent<T> {
  @Input() columns: TableColumn<T>[] = [];
  @Input() data: T[] = [];
  @Input() totalElements = 0;
  @Input() pageSize = 20;
  @Input() loading = false;
  @Input() showSearch = true;

  @Output() pageChange = new EventEmitter<PageEvent>();
  @Output() sortChange = new EventEmitter<Sort>();
  @Output() searchChange = new EventEmitter<string>();

  get displayedColumnKeys(): string[] {
    return this.columns.map(c => c.key);
  }

  onPage(event: PageEvent): void {
    this.pageChange.emit(event);
  }

  onSort(sort: Sort): void {
    this.sortChange.emit(sort);
  }

  onSearchChange(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.searchChange.emit(val);
  }
}
