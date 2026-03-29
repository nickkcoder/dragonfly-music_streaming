import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

interface MediaUploadResponse {
  file_url?: string;
}

@Injectable({
  providedIn: 'root'
})
export class MediaService {
  private mediaBaseUrl = environment.mediaBaseUrl.replace(/\/+$/, '');

  constructor(private http: HttpClient) {}

  uploadSongFile(file: File, artistId?: number | string): Observable<string> {
    const formData = new FormData();

    if (artistId !== undefined && artistId !== null) {
      formData.append('artist_id', String(artistId));
    }
    formData.append('file', file);

    return this.http.post<MediaUploadResponse>(`${this.mediaBaseUrl}/upload/song`, formData).pipe(
      map((response) => this.toAbsoluteUrl(response?.file_url || ''))
    );
  }

  uploadImageFile(file: File, artistId?: number | string): Observable<string> {
    const formData = new FormData();

    if (artistId !== undefined && artistId !== null) {
      formData.append('artist_id', String(artistId));
    }
    formData.append('file', file);

    return this.http.post<MediaUploadResponse>(`${this.mediaBaseUrl}/upload/image`, formData).pipe(
      map((response) => this.toAbsoluteUrl(response?.file_url || ''))
    );
  }

  toAbsoluteUrl(fileUrl?: string | null): string {
    if (!fileUrl) {
      return '';
    }

    if (/^https?:\/\//i.test(fileUrl)) {
      return fileUrl;
    }

    const cleanPath = fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`;
    return `${this.mediaBaseUrl}${cleanPath}`;
  }
}
