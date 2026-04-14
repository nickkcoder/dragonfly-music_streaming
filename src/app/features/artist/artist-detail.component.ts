import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ArtistService } from '../../core/services/artist.service';
import { AuthService } from '../../core/services/auth.service';
import { MediaService } from '../../core/services/media.service';
import { ApiService } from '../../services/api.service';
import { SongService } from '../../core/services/song.service';
import { PlayerService } from '../../core/services/player.service';

@Component({
  selector: 'app-artist-detail',
  templateUrl: './artist-detail.component.html',
  styleUrls: ['./artist-detail.component.css']
})
export class ArtistDetailComponent {
  private readonly fallbackImage = 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce';
  artistId = '';
  artistName = 'Artist Profile';
  artistImage = '';
  artistSongs: Array<{ id: string; title: string; genre: string; fileUrl: string; coverImage: string }> = [];
  artistAlbums: Array<{
    id: string;
    title: string;
    releaseDate: string;
    coverImage: string;
    tracks: Array<{ id: string; title: string; fileUrl: string; coverImage: string; trackNumber: number }>;
  }> = [];
  artistSingles: Array<{ id: string; title: string; fileUrl: string; coverImage: string; uploadedAt: string }> = [];
  loadingSongs = false;
  songsError = '';
  imageUrlInput = '';
  selectedImageFile: File | null = null;
  savingImage = false;
  statusMessage = '';
  errorMessage = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private artistService: ArtistService,
    private songService: SongService,
    private playerService: PlayerService,
    private authService: AuthService,
    private mediaService: MediaService,
    private api: ApiService
  ) {
    this.route.paramMap.subscribe(params => {
      this.artistId = params.get('id') ?? '';
      this.loadArtist();
    });
  }

  get bannerBackgroundImage(): string {
    return `url('${this.artistImage || this.fallbackImage}')`;
  }

  get isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  onImageFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.selectedImageFile = input.files?.[0] ?? null;
  }

  saveArtistImage() {
    const artistId = this.artistId.trim();
    if (!artistId) {
      this.errorMessage = 'Artist id is missing.';
      this.statusMessage = '';
      return;
    }

    const directUrl = this.imageUrlInput.trim();
    if (!this.selectedImageFile && !directUrl) {
      this.errorMessage = 'Select an image file or enter an image URL.';
      this.statusMessage = '';
      return;
    }

    this.savingImage = true;
    this.errorMessage = '';
    this.statusMessage = '';

    const saveUrl = (imgUrl: string) => {
      this.artistService.updateArtistImage(artistId, imgUrl).subscribe({
        next: () => {
          this.artistImage = this.api.getAssetUrl(imgUrl);
          this.imageUrlInput = '';
          this.selectedImageFile = null;
          this.statusMessage = 'Artist image updated.';
          this.errorMessage = '';
          this.savingImage = false;
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Could not update artist image.';
          this.statusMessage = '';
          this.savingImage = false;
        }
      });
    };

    if (this.selectedImageFile) {
      this.mediaService.uploadImageFile(this.selectedImageFile, artistId).subscribe({
        next: (uploadedUrl) => saveUrl(uploadedUrl),
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Image upload failed.';
          this.statusMessage = '';
          this.savingImage = false;
        }
      });
      return;
    }

    saveUrl(directUrl);
  }

  navigateToAlbum(albumId: string): void {
    this.router.navigate(['/artist/album', albumId]);
  }

  playSong(song: { id: string; title: string; fileUrl: string; coverImage?: string }) {
    if (!song?.fileUrl) {
      return;
    }

    this.playerService.playTrack({
      songId: song.id,
      title: song.title,
      artist: this.artistName,
      src: song.fileUrl,
      coverImage: song.coverImage || this.artistImage
    });
  }

  addToQueue(song: { id: string; title: string; fileUrl: string; coverImage?: string }, event: Event) {
    event.stopPropagation();
    if (!song?.fileUrl) {
      return;
    }

    this.playerService.addToQueue({
      songId: song.id,
      title: song.title,
      artist: this.artistName,
      src: song.fileUrl,
      coverImage: song.coverImage || this.artistImage
    });
  }

  playNext(song: { id: string; title: string; fileUrl: string; coverImage?: string }, event: Event) {
    event.stopPropagation();
    if (!song?.fileUrl) {
      return;
    }

    this.playerService.playNext({
      songId: song.id,
      title: song.title,
      artist: this.artistName,
      src: song.fileUrl,
      coverImage: song.coverImage || this.artistImage
    });
  }

  private loadArtist() {
    const artistId = this.artistId.trim();
    if (!artistId) {
      return;
    }

    this.loadCatalog(artistId);
  }

  private loadCatalog(artistId: string) {
    this.loadingSongs = true;
    this.songsError = '';

    this.artistService.getArtistCatalog(artistId).subscribe({
      next: (payload) => {
        const artist = payload?.artist || {};
        this.artistName = String(artist?.artist_name ?? artist?.name ?? 'Artist Profile');
        this.artistImage = this.api.getAssetUrl(artist?.img_url ?? '') || this.fallbackImage;

        const albums = Array.isArray(payload?.albums) ? payload.albums : [];
        const singles = Array.isArray(payload?.singles) ? payload.singles : [];

        this.artistAlbums = albums.map((album: any) => ({
          id: String(album.album_id ?? album.id ?? ''),
          title: String(album.title ?? 'Untitled Album'),
          releaseDate: String(album.release_date ?? ''),
          coverImage: this.api.getAssetUrl(album.cover_image ?? '') || this.artistImage,
          tracks: (Array.isArray(album.tracks) ? album.tracks : []).map((track: any) => ({
            id: String(track.song_id ?? track.id ?? ''),
            title: String(track.title ?? track.song_title ?? 'Untitled'),
            fileUrl: this.api.getAssetUrl(track.file_url ?? ''),
            coverImage: this.api.getAssetUrl(track.cover_image ?? '') || this.api.getAssetUrl(album.cover_image ?? '') || this.artistImage,
            trackNumber: Number(track.track_number ?? 0)
          }))
        }));

        this.artistSingles = singles.map((song: any) => ({
          id: String(song.song_id ?? song.id ?? ''),
          title: String(song.title ?? song.song_name ?? 'Untitled'),
          fileUrl: this.api.getAssetUrl(song.file_url ?? ''),
          coverImage: this.api.getAssetUrl(song.cover_image ?? '') || this.artistImage,
          uploadedAt: String(song.uploaded_at ?? '')
        }));

        const albumTracks = this.artistAlbums.flatMap((album) =>
          album.tracks.map((track) => ({
            id: track.id,
            title: track.title,
            genre: `Track ${track.trackNumber || '-'}`,
            fileUrl: track.fileUrl,
            coverImage: track.coverImage
          }))
        );

        const singlesAsSongs = this.artistSingles.map((song) => ({
          id: song.id,
          title: song.title,
          genre: 'Single',
          fileUrl: song.fileUrl,
          coverImage: song.coverImage
        }));

        this.artistSongs = [...singlesAsSongs, ...albumTracks];
        this.loadingSongs = false;
      },
      error: (err) => {
        this.artistSongs = [];
        this.artistAlbums = [];
        this.artistSingles = [];
        this.songsError = err?.error?.message || 'Could not load songs.';
        this.loadingSongs = false;
      }
    });
  }

  private normalizeCollection(payload: any, keys: string[]): any[] {
    if (Array.isArray(payload)) {
      return payload;
    }

    for (const key of keys) {
      const value = payload?.[key];
      if (Array.isArray(value)) {
        return value;
      }
    }

    return [];
  }
}
