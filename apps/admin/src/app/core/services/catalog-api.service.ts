import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from './movie-api.service';

export interface CategoryItem {
  id?: number;
  name: string;
  slug?: string;
  displayOrder?: number;
  active?: boolean;
}

export interface GenreItem {
  id?: number;
  name: string;
  slug?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CatalogApiService {
  private readonly http = inject(HttpClient);

  getCategories(): Observable<ApiResponse<CategoryItem[]>> {
    return this.http.get<ApiResponse<CategoryItem[]>>(`${environment.apiBaseUrl}/categories`);
  }

  createCategory(name: string): Observable<ApiResponse<CategoryItem>> {
    return this.http.post<ApiResponse<CategoryItem>>(`${environment.apiBaseUrl}/categories`, { name });
  }

  getGenres(): Observable<ApiResponse<GenreItem[]>> {
    return this.http.get<ApiResponse<GenreItem[]>>(`${environment.apiBaseUrl}/genres`);
  }

  createGenre(name: string): Observable<ApiResponse<GenreItem>> {
    return this.http.post<ApiResponse<GenreItem>>(`${environment.apiBaseUrl}/genres`, { name });
  }
}
