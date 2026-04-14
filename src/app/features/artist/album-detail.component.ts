import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { ArtistService } from '../../core/services/artist.service';
import { PlayerService } from '../../core/services/player.service';

interface AlbumTrack {
  id: string;
  title: string;
  fileUrl: string;
  coverImage: string;
  trackNumber: number;
  duration: string;
}

interface AlbumDetail {
  id: string;
  title: string;
  artistName: string;
  artistId: string;
  releaseDate: string;
  coverImage: string;
  tracks: AlbumTrack[];
}

@Component({
  selector: 'app-album-detail',
  templateUrl: './album-detail.component.html',
  styleUrls: ['./album-detail.component.css']
})
export class AlbumDetailComponent implements OnInit {
  album: AlbumDetail | null = null;
  loading = true;
  error = '';

  private albumId = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    private artistService: ArtistService,
    private playerService: PlayerService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.albumId = params.get('id') ?? '';
      if (!this.albumId) {
        this.error = 'No album ID provided.';
        this.loading = false;
        return;
      }
      this.loadAlbum();
    });
  }

  get bannerStyle(): string {
    return this.album?.coverImage
      ? `url('${this.album.coverImage}')`
      : 'none';
  }

  playAll(): void {
    if (!this.album?.tracks.length) return;
    const [first, ...rest] = this.album.tracks;
    this.playerService.playTrack({
      songId: first.id,
      title: first.title,
      artist: this.album.artistName,
      src: first.fileUrl,
      coverImage: first.coverImage || this.album.coverImage
    });
    rest.forEach(t => this.playerService.addToQueue({
      songId: t.id,
      title: t.title,
      artist: this.album!.artistName,
      src: t.fileUrl,
      coverImage: t.coverImage || this.album!.coverImage
    }));
  }

  playTrack(track: AlbumTrack): void {
    if (!track.fileUrl) return;
    this.playerService.playTrack({
      songId: track.id,
      title: track.title,
      artist: this.album?.artistName ?? '',
      src: track.fileUrl,
      coverImage: track.coverImage || this.album?.coverImage
    });
  }

  addToQueue(track: AlbumTrack, event: Event): void {
    event.stopPropagation();
    if (!track.fileUrl) return;
    this.playerService.addToQueue({
      songId: track.id,
      title: track.title,
      artist: this.album?.artistName ?? '',
      src: track.fileUrl,
      coverImage: track.coverImage || this.album?.coverImage
    });
  }

  playNext(track: AlbumTrack, event: Event): void {
    event.stopPropagation();
    if (!track.fileUrl) return;
    this.playerService.playNext({
      songId: track.id,
      title: track.title,
      artist: this.album?.artistName ?? '',
      src: track.fileUrl,
      coverImage: track.coverImage || this.album?.coverImage
    });
  }

  goBack(): void {
    if (this.album?.artistId) {
      this.router.navigate(['/artist', this.album.artistId]);
    } else {
      this.router.navigate(['/discover']);
    }
  }

  private loadAlbum(): void {
    this.loading = true;
    this.error = '';

    // Try the direct album endpoint first
    this.api.get<any>(`api/albums/${this.albumId}`).subscribe({
      next: (payload) => this.handlePayload(payload),
      error: () => {
        // Fallback: search artist catalog
        this.api.get<any>(`api/songs/albums/${this.albumId}`).subscribe({
          next: (payload) => this.handlePayload(payload),
          error: (err) => {
            this.error = err?.error?.message || 'Could not load album.';
            this.loading = false;
          }
        });
      }
    });
  }

  private handlePayload(payload: any): void {
    const raw = payload?.album ?? payload?.data ?? payload;
    if (!raw) {
      this.error = 'Album not found.';
      this.loading = false;
      return;
    }

    const tracks = (Array.isArray(raw.tracks) ? raw.tracks : []).map((t: any, i: number) => ({
      id: String(t.song_id ?? t.id ?? ''),
      title: String(t.title ?? t.song_title ?? `Track ${i + 1}`),
      fileUrl: this.api.getAssetUrl(t.file_url ?? ''),
      coverImage: this.api.getAssetUrl(t.cover_image ?? '') || this.api.getAssetUrl(raw.cover_image ?? ''),
      trackNumber: Number(t.track_number ?? t.order_number ?? i + 1),
      duration: t.duration ?? ''
    })).sort((a: AlbumTrack, b: AlbumTrack) => a.trackNumber - b.trackNumber);

    this.album = {
      id: String(raw.album_id ?? raw.id ?? this.albumId),
      title: String(raw.title ?? 'Untitled Album'),
      artistName: String(raw.artist_name ?? raw.artist ?? ''),
      artistId: String(raw.artist_id ?? ''),
      releaseDate: String(raw.release_date ?? ''),
      coverImage: this.api.getAssetUrl(raw.cover_image ?? ''),
      tracks
    };

    this.loading = false;
  }
}
