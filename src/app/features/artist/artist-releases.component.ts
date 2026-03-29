import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { switchMap, catchError, of } from 'rxjs';
import { ArtistService } from '../../core/services/artist.service';
import { SongService } from '../../core/services/song.service';

interface ArtistCatalog {
  artist?: {
    artist_name?: string;
  };
  albums?: Array<{
    album_id: number;
    title: string;
    cover_image?: string;
    release_date?: string;
    tracks?: Array<{
      song_id: number;
      title: string;
      file_url?: string;
      cover_image?: string;
      track_number?: number;
    }>;
  }>;
  singles?: Array<{
    song_id: number;
    title: string;
    file_url?: string;
    cover_image?: string;
  }>;
}

interface ReleaseTrackForm {
  title: string;
  genre: string;
  audio_url: string;
  order_number: number | '';
}

@Component({
  selector: 'app-artist-releases',
  templateUrl: './artist-releases.component.html',
  styleUrls: ['./artist-releases.component.css']
})
export class ArtistReleasesComponent implements OnInit {
  loading = true;
  error = '';
  artistId: number | null = null;
  catalog: ArtistCatalog = {};

  releaseMode: 'single' | 'album' = 'single';
  singleReleaseData = { title: '', genre: '', audio_url: '' };
  selectedSingleSongFile: File | null = null;
  albumReleaseData: {
    title: string;
    release_date: string;
    tracks: ReleaseTrackForm[];
  } = {
    title: '',
    release_date: '',
    tracks: [{ title: '', genre: '', audio_url: '', order_number: 1 }]
  };
  selectedAlbumCoverFile: File | null = null;
  albumTrackAudioFiles: Array<File | null> = [null];
  submitBusy = false;
  submitMessage = '';
  submitError = '';

  constructor(
    private artistService: ArtistService,
    private songService: SongService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadCatalog();
  }

  loadCatalog() {
    this.loading = true;
    this.error = '';

    this.artistService.getMyArtistId().pipe(
      switchMap((payload) => {
        this.artistId = payload?.artist_id ?? null;
        if (!this.artistId) {
          return of(null);
        }
        return this.artistService.getArtistCatalog(this.artistId);
      }),
      catchError((err) => {
        this.error = err?.error?.message || 'Artist profile not found.';
        return of(null);
      })
    ).subscribe((catalog) => {
      this.catalog = catalog || {};
      this.loading = false;
    });
  }

  onSongFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.selectedSingleSongFile = input.files?.[0] || null;
  }

  onAlbumCoverFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.selectedAlbumCoverFile = input.files?.[0] || null;
  }

  onAlbumTrackAudioFileChange(index: number, event: Event) {
    const input = event.target as HTMLInputElement;
    this.albumTrackAudioFiles[index] = input.files?.[0] ?? null;
  }

  addAlbumTrack() {
    this.albumReleaseData.tracks.push({
      title: '',
      genre: '',
      audio_url: '',
      order_number: this.albumReleaseData.tracks.length + 1
    });
    this.albumTrackAudioFiles.push(null);
  }

  removeAlbumTrack(index: number) {
    if (this.albumReleaseData.tracks.length <= 1) {
      return;
    }
    this.albumReleaseData.tracks.splice(index, 1);
    this.albumTrackAudioFiles.splice(index, 1);
  }

  getAlbumTrackOrderOptions(): number[] {
    const max = Math.max(this.albumReleaseData.tracks.length + 5, 10);
    return Array.from({ length: max }, (_, i) => i + 1);
  }

  submitRelease() {
    this.submitMessage = '';
    this.submitError = '';
    this.submitBusy = true;

    if (this.releaseMode === 'single') {
      const title = this.singleReleaseData.title.trim();
      const genre = this.singleReleaseData.genre.trim();

      if (!title) {
        this.submitError = 'Song title is required.';
        this.submitBusy = false;
        return;
      }

      if (!this.selectedSingleSongFile) {
        this.submitError = 'Select an audio file for the single.';
        this.submitBusy = false;
        return;
      }

      this.artistService.uploadSong({
        title,
        genre: genre || undefined,
        cover_image: undefined
      }, this.selectedSingleSongFile, this.artistId ?? undefined).subscribe({
        next: () => {
          this.submitMessage = 'Single uploaded successfully.';
          this.singleReleaseData = { title: '', genre: '', audio_url: '' };
          this.selectedSingleSongFile = null;
          this.submitBusy = false;
          this.loadCatalog();
        },
        error: (err) => {
          this.submitError = err?.error?.message || 'Single upload failed.';
          this.submitBusy = false;
        }
      });
      return;
    }

    const albumTitle = this.albumReleaseData.title.trim();
    if (!albumTitle) {
      this.submitError = 'Album title is required.';
      this.submitBusy = false;
      return;
    }

    const tracks = this.albumReleaseData.tracks
      .map((track, index) => ({
        title: track.title.trim(),
        genre: track.genre.trim(),
        audio_url: track.audio_url.trim(),
        audio_file: this.albumTrackAudioFiles[index] || null,
        order_number: Number(track.order_number)
      }))
      .filter((track) =>
        !!track.title &&
        Number.isInteger(track.order_number) &&
        track.order_number > 0 &&
        (!!track.audio_file || !!track.audio_url)
      );

    if (!tracks.length) {
      this.submitError = 'Add at least one valid album track.';
      this.submitBusy = false;
      return;
    }

    this.artistService.createAlbumRelease({
      title: albumTitle,
      release_date: this.albumReleaseData.release_date || undefined,
      tracks
    }, this.selectedAlbumCoverFile).subscribe({
      next: () => {
        this.submitMessage = 'Album uploaded successfully.';
        this.albumReleaseData = {
          title: '',
          release_date: '',
          tracks: [{ title: '', genre: '', audio_url: '', order_number: 1 }]
        };
        this.selectedAlbumCoverFile = null;
        this.albumTrackAudioFiles = [null];
        this.submitBusy = false;
        this.loadCatalog();
      },
      error: (err) => {
        this.submitError = err?.error?.message || err?.message || 'Album upload failed.';
        this.submitBusy = false;
      }
    });
  }

  deleteSingle(songId: number) {
    if (!confirm('Delete this single?')) {
      return;
    }

    this.songService.deleteSong(songId).subscribe({
      next: () => this.loadCatalog(),
      error: () => {
        this.submitError = 'Could not delete song.';
      }
    });
  }

  deleteAlbumTrack(songId: number) {
    if (!confirm('Delete this track?')) {
      return;
    }

    this.songService.deleteSong(songId).subscribe({
      next: () => this.loadCatalog(),
      error: () => {
        this.submitError = 'Could not delete track.';
      }
    });
  }

  goToSettings() {
    this.router.navigate(['/settings']);
  }
}
