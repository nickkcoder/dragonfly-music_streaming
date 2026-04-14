import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { PlayerService } from '../../core/services/player.service';

interface PlaylistTrack {
  id: string;
  title: string;
  artistName: string;
  fileUrl: string;
  coverImage: string;
  duration: string;
  position: number;
}

interface PlaylistDetail {
  id: string;
  title: string;
  description: string;
  ownerName: string;
  coverImage: string;
  tracks: PlaylistTrack[];
  createdAt: string;
}

@Component({
  selector: 'app-playlist-detail',
  templateUrl: './playlist-detail.component.html',
  styleUrls: ['./playlist-detail.component.css']
})
export class PlaylistDetailComponent implements OnInit {
  playlist: PlaylistDetail | null = null;
  loading = true;
  error = '';

  private playlistId = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    private playerService: PlayerService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.playlistId = params.get('id') ?? '';
      if (!this.playlistId) {
        this.error = 'No playlist ID provided.';
        this.loading = false;
        return;
      }
      this.loadPlaylist();
    });
  }

  get bannerStyle(): string {
    return this.playlist?.coverImage
      ? `url('${this.playlist.coverImage}')`
      : 'none';
  }

  playAll(): void {
    if (!this.playlist?.tracks.length) return;
    const [first, ...rest] = this.playlist.tracks;
    this.playerService.playTrack({
      songId: first.id,
      title: first.title,
      artist: first.artistName,
      src: first.fileUrl,
      coverImage: first.coverImage || this.playlist.coverImage
    });
    rest.forEach(t => this.playerService.addToQueue({
      songId: t.id,
      title: t.title,
      artist: t.artistName,
      src: t.fileUrl,
      coverImage: t.coverImage || this.playlist!.coverImage
    }));
  }

  playTrack(track: PlaylistTrack): void {
    if (!track.fileUrl) return;
    this.playerService.playTrack({
      songId: track.id,
      title: track.title,
      artist: track.artistName,
      src: track.fileUrl,
      coverImage: track.coverImage || this.playlist?.coverImage
    });
  }

  addToQueue(track: PlaylistTrack, event: Event): void {
    event.stopPropagation();
    if (!track.fileUrl) return;
    this.playerService.addToQueue({
      songId: track.id,
      title: track.title,
      artist: track.artistName,
      src: track.fileUrl,
      coverImage: track.coverImage || this.playlist?.coverImage
    });
  }

  playNext(track: PlaylistTrack, event: Event): void {
    event.stopPropagation();
    if (!track.fileUrl) return;
    this.playerService.playNext({
      songId: track.id,
      title: track.title,
      artist: track.artistName,
      src: track.fileUrl,
      coverImage: track.coverImage || this.playlist?.coverImage
    });
  }

  goBack(): void {
    this.router.navigate(['/discover']);
  }

  private loadPlaylist(): void {
    this.loading = true;
    this.error = '';

    this.api.get<any>(`api/playlists/${this.playlistId}`).subscribe({
      next: (payload) => this.handlePayload(payload),
      error: (err) => {
        this.error = err?.error?.message || 'Could not load playlist.';
        this.loading = false;
      }
    });
  }

  private handlePayload(payload: any): void {
    const raw = payload?.playlist ?? payload?.data ?? payload;
    if (!raw) {
      this.error = 'Playlist not found.';
      this.loading = false;
      return;
    }

    const tracks = (Array.isArray(raw.tracks) ? raw.tracks : []).map((t: any, i: number): PlaylistTrack => ({
      id: String(t.song_id ?? t.id ?? ''),
      title: String(t.title ?? t.song_title ?? `Track ${i + 1}`),
      artistName: String(t.artist_name ?? t.artist ?? ''),
      fileUrl: this.api.getAssetUrl(t.file_url ?? ''),
      coverImage: this.api.getAssetUrl(t.cover_image ?? t.cover_url ?? ''),
      duration: String(t.duration ?? ''),
      position: Number(t.position ?? t.track_number ?? i + 1)
    })).sort((a: PlaylistTrack, b: PlaylistTrack) => a.position - b.position);

    this.playlist = {
      id: String(raw.playlist_id ?? raw.id ?? this.playlistId),
      title: String(raw.title ?? raw.name ?? 'Untitled Playlist'),
      description: String(raw.description ?? ''),
      ownerName: String(raw.owner_name ?? raw.username ?? ''),
      coverImage: this.api.getAssetUrl(raw.cover_image ?? raw.cover_url ?? ''),
      tracks,
      createdAt: String(raw.created_at ?? '')
    };

    this.loading = false;
  }
}
