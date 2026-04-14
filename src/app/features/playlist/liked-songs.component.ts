import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SongService } from '../../core/services/song.service';
import { ApiService } from '../../services/api.service';
import { PlayerService } from '../../core/services/player.service';

interface LikedTrack {
  id: string;
  title: string;
  artistName: string;
  fileUrl: string;
  coverImage: string;
  duration: string;
  position: number;
}

@Component({
  selector: 'app-liked-songs',
  templateUrl: './liked-songs.component.html',
  styleUrls: ['./liked-songs.component.css']
})
export class LikedSongsComponent implements OnInit {
  tracks: LikedTrack[] = [];
  loading = true;
  error = '';

  constructor(
    private router: Router,
    private songService: SongService,
    private api: ApiService,
    private playerService: PlayerService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  playAll(): void {
    if (!this.tracks.length) return;
    const [first, ...rest] = this.tracks;
    this.playerService.playTrack({
      songId: first.id,
      title: first.title,
      artist: first.artistName,
      src: first.fileUrl,
      coverImage: first.coverImage
    });
    rest.forEach(t => this.playerService.addToQueue({
      songId: t.id,
      title: t.title,
      artist: t.artistName,
      src: t.fileUrl,
      coverImage: t.coverImage
    }));
  }

  playTrack(track: LikedTrack): void {
    if (!track.fileUrl) return;
    this.playerService.playTrack({
      songId: track.id,
      title: track.title,
      artist: track.artistName,
      src: track.fileUrl,
      coverImage: track.coverImage
    });
  }

  addToQueue(track: LikedTrack, event: Event): void {
    event.stopPropagation();
    this.playerService.addToQueue({
      songId: track.id,
      title: track.title,
      artist: track.artistName,
      src: track.fileUrl,
      coverImage: track.coverImage
    });
  }

  playNext(track: LikedTrack, event: Event): void {
    event.stopPropagation();
    this.playerService.playNext({
      songId: track.id,
      title: track.title,
      artist: track.artistName,
      src: track.fileUrl,
      coverImage: track.coverImage
    });
  }

  goBack(): void {
    this.router.navigate(['/profile']);
  }

  private load(): void {
    this.loading = true;
    this.error = '';

    this.songService.getLikedSongs().subscribe({
      next: (payload: any) => {
        const rows: any[] = Array.isArray(payload) ? payload : (payload?.songs ?? []);
        this.tracks = rows.map((song: any, i: number): LikedTrack => ({
          id: String(song.song_id ?? song.id ?? ''),
          title: String(song.title ?? song.song_name ?? 'Untitled'),
          artistName: String(
            song.artist_name ??
            (typeof song.artist === 'object'
              ? (song.artist?.artist_name ?? song.artist?.name ?? '')
              : (song.artist ?? '')) ??
            'Unknown Artist'
          ),
          fileUrl: this.api.getAssetUrl(song.file_url ?? ''),
          coverImage: this.api.getAssetUrl(song.cover_image ?? song.album_cover_image ?? '') || 'assets/default-cover.png',
          duration: String(song.duration ?? ''),
          position: i + 1
        }));
        this.loading = false;
      },
      error: (err: any) => {
        this.error = err?.error?.message || 'Could not load liked songs.';
        this.loading = false;
      }
    });
  }
}
