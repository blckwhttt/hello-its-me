import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { LinkPreview } from '../models/link-preview.model';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

@Injectable({
  providedIn: 'root',
})
export class LinkPreviewService {
  private readonly API_URL = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getLinkPreview(url: string): Observable<LinkPreview | null> {
    return this.http
      .get<ApiResponse<LinkPreview | null>>(`${this.API_URL}/link-preview`, {
        params: { url },
        withCredentials: true,
      })
      .pipe(map((response) => response.data));
  }
}
