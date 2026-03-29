import { Injectable } from '@angular/core';
import { forkJoin, Observable, of, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { ApiService } from '../../services/api.service';
import { MediaService } from './media.service';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  constructor(
    private api: ApiService,
    private mediaService: MediaService
  ) {}

  getUsers(): Observable<any[]> {
    return this.tryGet<any[]>([
      'api/admin/users'
    ]);
  }

  getAdmins(): Observable<any[]> {
    return this.tryGet<any[]>([
      'api/admin/admins',
      'api/admin/users?role=admin',
      'api/admin/users/admins'
    ]);
  }

  getArtists(): Observable<any[]> {
    return this.tryGet<any[]>([
      'api/admin/artists',
      'api/artist'
    ]);
  }

  getSongs(): Observable<any[]> {
    return this.tryGet<any[]>([
      'api/admin/songs',
      'api/songs'
    ]);
  }

  getRecentDeletions(): Observable<any[]> {
    return this.tryGet<any[]>([
      'api/admin/deletions'
    ]);
  }

  undoDeletion(deletionId: number | string): Observable<any> {
    return this.api.post(`api/admin/deletions/${deletionId}/undo`, {});
  }

  updateUserRole(userId: number | string, role: string): Observable<any> {
    const normalizedRole = String(role).toLowerCase();
    const roleCode =
      normalizedRole === 'admin' ? 'a' :
      normalizedRole === 'artist' ? 'ar' :
      normalizedRole === 'user' ? 'u' :
      normalizedRole;
    const roleId =
      normalizedRole === 'admin' ? 1 :
      normalizedRole === 'artist' ? 2 :
      normalizedRole === 'user' ? 3 :
      undefined;

    const payloads: any[] = [
      { role: normalizedRole },
      { user_role: normalizedRole },
      { role_name: normalizedRole },
      { role: roleCode },
      { user_role: roleCode }
    ];

    if (roleId !== undefined) {
      payloads.push({ role_id: roleId });
    }

    const attempts = [
      { method: 'put' as const, endpoint: `api/admin/users/${userId}/role`, body: payloads[0] },
      { method: 'put' as const, endpoint: `api/admin/users/${userId}/role`, body: payloads[1] },
      { method: 'put' as const, endpoint: `api/admin/users/${userId}/role`, body: payloads[2] },
      { method: 'put' as const, endpoint: `api/admin/users/${userId}/role`, body: payloads[3] },
      { method: 'put' as const, endpoint: `api/admin/users/${userId}/role`, body: payloads[4] },
      { method: 'put' as const, endpoint: `api/admin/users/${userId}`, body: payloads[0] },
      { method: 'put' as const, endpoint: `api/admin/users/${userId}`, body: payloads[1] },
      { method: 'put' as const, endpoint: `api/users/${userId}/role`, body: payloads[0] },
      { method: 'put' as const, endpoint: `api/users/${userId}`, body: payloads[0] },
      { method: 'post' as const, endpoint: `api/admin/users/${userId}/role`, body: payloads[0] },
      { method: 'post' as const, endpoint: `api/admin/users/${userId}/role`, body: payloads[1] }
    ];

    if (roleId !== undefined) {
      attempts.push(
        { method: 'put' as const, endpoint: `api/admin/users/${userId}/role`, body: { role_id: roleId } },
        { method: 'put' as const, endpoint: `api/admin/users/${userId}`, body: { role_id: roleId } }
      );
    }

    return this.tryMutationAttempts(attempts);
  }

  createArtist(payload: { artist_name: string; bio?: string; genre?: string }): Observable<any> {
    const bodyA = {
      artist_name: payload.artist_name,
      bio: payload.bio,
      genre: payload.genre
    };
    const bodyB = {
      name: payload.artist_name,
      bio: payload.bio,
      genre: payload.genre
    };

    return this.tryMutationAttempts([
      { method: 'post', endpoint: 'api/admin/artists', body: bodyA },
      { method: 'post', endpoint: 'api/admin/artist', body: bodyA },
      { method: 'post', endpoint: 'api/artist/become', body: bodyA },
      { method: 'post', endpoint: 'api/artist/create', body: bodyA },
      { method: 'post', endpoint: 'api/artist', body: bodyA },
      { method: 'post', endpoint: 'api/admin/artists', body: bodyB },
      { method: 'post', endpoint: 'api/artist/become', body: bodyB }
    ]);
  }

  deleteUser(userId: number | string): Observable<any> {
    return this.tryDelete([
      `api/admin/users/${userId}`,
      `api/users/${userId}`,
      `api/admin/delete-user/${userId}`
    ]);
  }

  deleteSong(songId: number | string): Observable<any> {
    return this.tryDelete([
      `api/admin/songs/${songId}`,
      `api/songs/${songId}`
    ]);
  }

  deleteArtist(artistId: number | string): Observable<any> {
    return this.tryDelete([
      `api/admin/artists/${artistId}`,
      `api/artist/${artistId}`
    ]);
  }

  createSong(
    payload: {
      title: string;
      genre?: string;
      artist_id?: number | string;
      audio_url?: string;
      cover_image_url?: string;
    },
    songFile?: File | null,
    coverImageFile?: File | null
  ): Observable<any> {
    const title = payload.title.trim();
    if (!title) {
      return throwError(() => new Error('Song title is required.'));
    }

    const artistId = payload.artist_id;
    const artistIdValid = artistId !== undefined && artistId !== null && /^\d+$/.test(String(artistId).trim());
    if (!artistIdValid) {
      return throwError(() => new Error('Valid artist_id is required.'));
    }

    const coverImage$ = this.resolveCoverImage(payload, coverImageFile);

    if (songFile) {
      return coverImage$.pipe(
        switchMap((coverImage) =>
          this.mediaService.uploadSongFile(songFile, artistId).pipe(
            switchMap((fileUrl) => this.createSongRecord(payload, fileUrl, coverImage))
          )
        )
      );
    }

    const directUrl = payload.audio_url?.trim();
    if (!directUrl) {
      return throwError(() => new Error('Select an audio file or provide an audio URL.'));
    }

    return coverImage$.pipe(
      switchMap((coverImage) => this.createSongRecord(payload, directUrl, coverImage))
    );
  }

  createAlbum(
    payload: {
      artist_id: number | string;
      title: string;
      release_date?: string;
      tracks: Array<{
        order_number: number;
        song_id?: number | string;
        title?: string;
        genre?: string;
        audio_url?: string;
        audio_file?: File | null;
      }>;
    },
    coverImageFile?: File | null
  ): Observable<any> {
    const artistId = payload.artist_id;
    const artistIdValid = artistId !== undefined && artistId !== null && /^\d+$/.test(String(artistId).trim());
    if (!artistIdValid) {
      return throwError(() => new Error('Valid artist_id is required.'));
    }

    const title = String(payload.title || '').trim();
    if (!title) {
      return throwError(() => new Error('Album title is required.'));
    }

    const tracksInput = payload.tracks || [];
    if (!tracksInput.length) {
      return throwError(() => new Error('Add at least one queued track.'));
    }

    const submit = (coverImage: string | undefined, tracks: any[]) => this.api.post('api/admin/albums', {
      artist_id: artistId,
      title,
      release_date: payload.release_date || null,
      cover_image: coverImage || null,
      tracks
    });

    const tracks$ = forkJoin(
      tracksInput.map((track) => this.resolveAlbumTrack(track, artistId))
    );

    if (coverImageFile) {
      return this.mediaService.uploadImageFile(coverImageFile, artistId).pipe(
        switchMap((coverImage) => tracks$.pipe(
          switchMap((tracks) => submit(coverImage, tracks))
        ))
      );
    }

    return tracks$.pipe(
      switchMap((tracks) => submit(undefined, tracks))
    );
  }

  private createSongRecord(
    payload: { title: string; genre?: string; artist_id?: number | string },
    fileUrl: string,
    coverImage?: string
  ): Observable<any> {
    const body: any = {
      title: payload.title.trim(),
      file_url: fileUrl
    };

    if (payload.artist_id !== undefined && payload.artist_id !== null) {
      body.artist_id = payload.artist_id;
    }

    if (payload.genre) {
      body.genre = payload.genre;
      const asNumber = Number(payload.genre);
      if (!Number.isNaN(asNumber)) {
        body.genre_id = asNumber;
      }
    }

    if (coverImage) {
      body.cover_image = coverImage;
    }

    return this.tryPost([
      'api/admin/songs',
      'api/songs'
    ], body);
  }

  private resolveCoverImage(
    payload: { artist_id?: number | string; cover_image_url?: string },
    coverImageFile?: File | null
  ): Observable<string | undefined> {
    if (coverImageFile) {
      return this.mediaService.uploadImageFile(coverImageFile, payload.artist_id).pipe(
        switchMap((url) => of(url))
      );
    }

    const directUrl = payload.cover_image_url?.trim();
    return of(directUrl || undefined);
  }

  private resolveAlbumTrack(
    track: {
      order_number: number;
      song_id?: number | string;
      title?: string;
      genre?: string;
      audio_url?: string;
      audio_file?: File | null;
    },
    artistId: number | string
  ): Observable<any> {
    const orderNumber = Number(track.order_number);
    if (!Number.isInteger(orderNumber) || orderNumber <= 0) {
      return throwError(() => new Error('Each track needs a valid order number.'));
    }

    const existingSongId = Number(track.song_id);
    if (Number.isInteger(existingSongId) && existingSongId > 0) {
      return of({ song_id: existingSongId, order_number: orderNumber });
    }

    const title = String(track.title || '').trim();
    if (!title) {
      return throwError(() => new Error('Each queued track needs a title.'));
    }

    const audioUrl = String(track.audio_url || '').trim();
    const audio$ = track.audio_file
      ? this.mediaService.uploadSongFile(track.audio_file, artistId)
      : (audioUrl ? of(audioUrl) : throwError(() => new Error(`Track "${title}" needs an audio file or URL.`)));

    return audio$.pipe(
      map((fileUrl) => {
        const payload: any = {
          order_number: orderNumber,
          title,
          file_url: fileUrl
        };

        const genreId = Number(track.genre);
        if (Number.isInteger(genreId) && genreId > 0) {
          payload.genre_id = genreId;
        }

        return payload;
      })
    );
  }

  private tryGet<T>(endpoints: string[]): Observable<T> {
    const [current, ...next] = endpoints;
    if (!current) {
      return throwError(() => new Error('No GET endpoint available.'));
    }

    return this.api.get<T>(current).pipe(
      catchError((err) => {
        if (!next.length || !this.shouldTryNextEndpoint(err)) {
          return throwError(() => err);
        }
        return this.tryGet<T>(next);
      })
    );
  }

  private tryPost<T>(endpoints: string[], body: any): Observable<T> {
    const [current, ...next] = endpoints;
    if (!current) {
      return throwError(() => new Error('No POST endpoint available.'));
    }

    return this.api.post<T>(current, body).pipe(
      catchError((err) => {
        if (!next.length || !this.shouldTryNextEndpoint(err)) {
          return throwError(() => err);
        }
        return this.tryPost<T>(next, body);
      })
    );
  }

  private tryPut<T>(endpoints: string[], body: any): Observable<T> {
    const [current, ...next] = endpoints;
    if (!current) {
      return throwError(() => new Error('No PUT endpoint available.'));
    }

    return this.api.put<T>(current, body).pipe(
      catchError((err) => {
        if (!next.length || !this.shouldTryNextEndpoint(err)) {
          return throwError(() => err);
        }
        return this.tryPut<T>(next, body);
      })
    );
  }

  private tryDelete<T>(endpoints: string[]): Observable<T> {
    const [current, ...next] = endpoints;
    if (!current) {
      return throwError(() => new Error('No DELETE endpoint available.'));
    }

    return this.api.delete<T>(current).pipe(
      catchError((err) => {
        if (!next.length || !this.shouldTryNextEndpoint(err)) {
          return throwError(() => err);
        }
        return this.tryDelete<T>(next);
      })
    );
  }

  private shouldTryNextEndpoint(err: any): boolean {
    return err?.status === 404;
  }

  private tryMutationAttempts(
    attempts: Array<{ method: 'put' | 'post'; endpoint: string; body: any }>,
    index = 0
  ): Observable<any> {
    const current = attempts[index];
    if (!current) {
      return throwError(() => new Error('No mutation endpoint available.'));
    }

    const request$ = current.method === 'put'
      ? this.api.put(current.endpoint, current.body)
      : this.api.post(current.endpoint, current.body);

    return request$.pipe(
      catchError((err) => {
        const shouldTryNext = this.shouldTryNextMutationAttempt(err);
        if (!shouldTryNext || index >= attempts.length - 1) {
          return throwError(() => err);
        }
        return this.tryMutationAttempts(attempts, index + 1);
      })
    );
  }

  private shouldTryNextMutationAttempt(err: any): boolean {
    const status = err?.status;
    return status === 400 || status === 403 || status === 404 || status === 405 || status === 409 || status === 422;
  }
}
