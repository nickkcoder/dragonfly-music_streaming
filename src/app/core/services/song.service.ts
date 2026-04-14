import { Injectable } from '@angular/core';
import { Observable, throwError, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiService } from '../../services/api.service';

@Injectable({ providedIn: 'root' })
export class SongService {
  constructor(private api: ApiService) {}

  getAllSongs(): Observable<any[]> {
    return this.tryGet<any[]>([
      'api/songs',
      'songs',
      'api/admin/songs'
    ]);
  }

  getSongsByArtist(artistId: number | string): Observable<any[]> {
    return this.tryGet<any[]>([
      `api/songs/artist/${artistId}`,
      `songs/artist/${artistId}`
    ]);
  }

  getLikedSongs(): Observable<any[]> {
    return this.tryGet<any>(['api/songs/liked']).pipe(
      map((payload: any) => Array.isArray(payload) ? payload : (payload?.songs ?? []))
    );
  }

  getTrending(limit = 10): Observable<any[]> {
    return this.api.get<any>(`api/songs/trending?limit=${limit}`).pipe(
      map((payload: any) => Array.isArray(payload) ? payload : (payload?.songs ?? [])),
      catchError(() => this.getAllSongs().pipe(
        map((songs: any[]) => songs.slice(0, limit))
      ))
    );
  }

  /** Fire-and-forget: records a play event so trending stays fresh. Never throws. */
  recordPlay(songId: string | number): void {
    this.api.post(`api/songs/${songId}/play`, {}).pipe(
      catchError(() => of(null))
    ).subscribe();
  }

  likeSong(songId: number | string): Observable<any> {
    return this.api.post(`api/songs/${songId}/like`, {});
  }

  unlikeSong(songId: number | string): Observable<any> {
    return this.api.delete(`api/songs/${songId}/like`);
  }

  deleteSong(songId: number | string): Observable<any> {
    return this.api.delete(`api/songs/${songId}`);
  }

  private tryGet<T>(endpoints: string[]): Observable<T> {
    const [current, ...next] = endpoints;
    if (!current) {
      console.warn('[SongService] No GET endpoint available.');
      return throwError(() => new Error('No GET endpoint available.'));
    }

    return this.api.get<T>(current).pipe(
      catchError((err) => {
        if (!next.length) {
          return throwError(() => err);
        }
        return this.tryGet<T>(next);
      })
    );
  }
}
