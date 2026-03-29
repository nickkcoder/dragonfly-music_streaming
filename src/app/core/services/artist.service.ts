import { Injectable } from '@angular/core';
import { forkJoin, Observable, of, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { ApiService } from '../../services/api.service';
import { MediaService } from './media.service';

@Injectable({
  providedIn: 'root'
})
export class ArtistService {
  constructor(
    private api: ApiService,
    private mediaService: MediaService
  ) {}

  getArtists(): Observable<any[]> {
    return this.tryGet<any[]>([
      'api/artist',
      'api/artists',
      'api/admin/artists'
    ]);
  }

  getArtistById(artistId: number | string): Observable<any> {
    return this.api.get(`api/artist/${artistId}`);
  }

  getArtistCatalog(artistId: number | string): Observable<any> {
    return this.api.get(`api/artist/${artistId}/catalog`);
  }

  getMyArtistId(): Observable<{ artist_id: number }> {
    return this.api.get<{ artist_id: number }>('api/artist/me');
  }

  updateArtistImage(artistId: number | string, imgUrl: string): Observable<any> {
    return this.api.put(`api/admin/artists/${artistId}/image`, { img_url: imgUrl });
  }

  becomeArtist(payload: { artist_name: string; bio?: string; genre?: string }): Observable<any> {
    return this.api.post('api/artist/become', payload);
  }

  uploadSong(
    payload: { title: string; genre?: string; cover_image?: string; duration_seconds?: number },
    songFile: File,
    artistId?: number | string
  ): Observable<any> {
    return this.mediaService.uploadSongFile(songFile, artistId).pipe(
      switchMap((fileUrl) => {
        const body: any = {
          title: payload.title,
          file_url: fileUrl
        };

        if (payload.genre) {
          body.genre = payload.genre;
          const asNumber = Number(payload.genre);
          if (!Number.isNaN(asNumber)) {
            body.genre_id = asNumber;
          }
        }

        if (payload.cover_image) {
          body.cover_image = payload.cover_image;
        }

        if (payload.duration_seconds !== undefined) {
          body.duration_seconds = payload.duration_seconds;
        }

        if (artistId !== undefined && artistId !== null) {
          body.artist_id = artistId;
        }

        return this.api.post('api/songs', body);
      })
    );
  }

  createAlbumRelease(
    payload: {
      title: string;
      release_date?: string;
      tracks: Array<{ title: string; genre?: string; audio_url?: string; audio_file?: File | null; order_number: number }>;
    },
    albumCoverFile?: File | null
  ): Observable<any> {
    const title = String(payload.title || '').trim();
    if (!title) {
      return throwError(() => new Error('Album title is required.'));
    }

    const trackInputs = payload.tracks || [];
    if (!trackInputs.length) {
      return throwError(() => new Error('Add at least one track.'));
    }

    const trackRequests = trackInputs.map((track) => {
      const trackTitle = String(track.title || '').trim();
      const orderNumber = Number(track.order_number);

      if (!trackTitle || !Number.isInteger(orderNumber) || orderNumber <= 0) {
        return throwError(() => new Error('Each track requires title and valid order.'));
      }

      const audioUrl = String(track.audio_url || '').trim();
      const audio$ = track.audio_file
        ? this.mediaService.uploadSongFile(track.audio_file)
        : (audioUrl ? of(audioUrl) : throwError(() => new Error(`Track "${trackTitle}" needs an audio file or URL.`)));

      return audio$.pipe(
        map((fileUrl) => {
          const out: any = {
            title: trackTitle,
            file_url: fileUrl,
            order_number: orderNumber
          };
          const genreId = Number(track.genre);
          if (Number.isInteger(genreId) && genreId > 0) {
            out.genre_id = genreId;
          }
          return out;
        })
      );
    });

    const submit = (coverImage?: string) => forkJoin(trackRequests).pipe(
      switchMap((tracks) => this.api.post('api/songs/albums', {
        title,
        release_date: payload.release_date || null,
        cover_image: coverImage || null,
        tracks
      }))
    );

    if (albumCoverFile) {
      return this.mediaService.uploadImageFile(albumCoverFile).pipe(
        switchMap((coverImage) => submit(coverImage))
      );
    }

    return submit();
  }

  private tryGet<T>(endpoints: string[]): Observable<T> {
    const [current, ...next] = endpoints;
    if (!current) {
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
