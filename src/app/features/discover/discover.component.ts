import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ArtistService } from '../../core/services/artist.service';
import { SongService } from '../../core/services/song.service';
import { PlayerService } from '../../core/services/player.service';
import { ApiService } from '../../services/api.service';

interface DiscoverArtist {
  id: string;
  name: string;
  genre: string;
  image: string;
}

interface DiscoverSong {
  id: string;
  title: string;
  artistName: string;
  genre: string;
  coverImage: string;
  fileUrl: string;
}

@Component({
  selector: 'app-discover',
  templateUrl: './discover.component.html',
  styleUrls: ['./discover.component.css']
})
export class DiscoverComponent implements OnInit {
  searchTerm = '';
  sectionFilter: 'all' | 'artists' | 'songs' = 'all';
  artistGenreFilter = 'all';
  songGenreFilter = 'all';
  loading = false;
  error = '';

  artists: DiscoverArtist[] = [];
  songs: DiscoverSong[] = [];

  constructor(
    private route: ActivatedRoute,
    private artistService: ArtistService,
    private songService: SongService,
    private playerService: PlayerService,
    private api: ApiService
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      this.searchTerm = String(params['q'] ?? '');
    });
    this.loadDiscoverData();
  }

  get filteredArtists(): DiscoverArtist[] {
    const term = this.searchTerm.trim().toLowerCase();
    const genre = this.artistGenreFilter.trim().toLowerCase();
    return this.artists.filter((artist) => {
      const matchesTerm = !term ||
        artist.name.toLowerCase().includes(term) ||
        artist.genre.toLowerCase().includes(term);
      const matchesGenre = genre === 'all' || artist.genre.toLowerCase() === genre;
      return matchesTerm && matchesGenre;
    });
  }

  get filteredSongs(): DiscoverSong[] {
    const term = this.searchTerm.trim().toLowerCase();
    const genre = this.songGenreFilter.trim().toLowerCase();
    return this.songs.filter((song) => {
      const matchesTerm = !term ||
        song.title.toLowerCase().includes(term) ||
        song.artistName.toLowerCase().includes(term) ||
        song.genre.toLowerCase().includes(term);
      const matchesGenre = genre === 'all' || song.genre.toLowerCase() === genre;
      return matchesTerm && matchesGenre;
    });
  }

  get artistGenreOptions(): string[] {
    return this.uniqueGenres(this.artists.map((artist) => artist.genre));
  }

  get songGenreOptions(): string[] {
    return this.uniqueGenres(this.songs.map((song) => song.genre));
  }

  get showArtistsSection(): boolean {
    return this.sectionFilter === 'all' || this.sectionFilter === 'artists';
  }

  get showSongsSection(): boolean {
    return this.sectionFilter === 'all' || this.sectionFilter === 'songs';
  }

  private loadDiscoverData(): void {
    this.loading = true;
    this.error = '';

    this.artistService.getArtists().subscribe({
      next: (artistsPayload) => {
        const artistRows = this.normalizeCollection(artistsPayload, ['artists', 'data', 'result']);
        this.artists = artistRows.map((artist: any) => ({
          id: String(artist.artist_id ?? artist.id ?? ''),
          name: String(artist.artist_name ?? artist.name ?? 'Unknown Artist'),
          genre: String(artist.genre ?? artist.bio ?? 'Unknown Genre'),
          image: artist.img_url
            ? this.api.getAssetUrl(String(artist.img_url))
            : 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce'
        }));

        this.loadSongsWithFallback();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Could not load discover data.';
        this.loading = false;
      }
    });
  }

  private loadSongsWithFallback(): void {
    this.songService.getAllSongs().subscribe({
      next: (songsPayload) => {
        const songRows = this.normalizeCollection(songsPayload, ['songs', 'data', 'result']);
        this.songs = this.mapSongs(songRows);
        this.loading = false;
      },
      error: () => {
        const artistIds = this.artists
          .map((artist) => artist.id)
          .filter((id) => id.trim().length > 0);

        if (!artistIds.length) {
          this.songs = [];
          this.loading = false;
          return;
        }

        const requests = artistIds.map((artistId) => this.songService.getSongsByArtist(artistId));
        forkJoin(requests).subscribe({
          next: (songsPayloadList) => {
            const songRows = songsPayloadList.flatMap((payload) =>
              this.normalizeCollection(payload, ['songs', 'data', 'result'])
            );
            this.songs = this.mapSongs(songRows);
            this.loading = false;
          },
          error: (err) => {
            this.error = err?.error?.message || 'Could not load songs for discover.';
            this.loading = false;
          }
        });
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

  private uniqueGenres(values: string[]): string[] {
    const unique = new Set<string>();

    for (const value of values) {
      const normalized = (value || '-').trim();
      if (normalized) {
        unique.add(normalized);
      }
    }

    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }

  private mapSongs(songRows: any[]): DiscoverSong[] {
    const byId = new Map<string, DiscoverSong>();

    for (const song of songRows) {
      const id = String(song.song_id ?? song.id ?? '');
      const mapped: DiscoverSong = {
        id,
        title: String(song.title ?? song.song_name ?? 'Untitled'),
        artistName: String(
          song.artist_name ??
          song.artist?.artist_name ??
          song.artist?.name ??
          song.artist ??
          'Unknown Artist'
        ),
        genre: String(song.genre ?? '-'),
        coverImage: this.api.getAssetUrl(song.cover_image ?? song.album_cover_image ?? '') || 'assets/favicon.ico',
        fileUrl: this.api.getAssetUrl(song.file_url ?? '')
      };

      byId.set(id || `${mapped.title}:${mapped.artistName}`, mapped);
    }

    return Array.from(byId.values());
  }

  playSong(song: DiscoverSong): void {
    if (!song.fileUrl) {
      return;
    }

    this.playerService.playTrack({
      songId: song.id,
      title: song.title,
      artist: song.artistName,
      src: song.fileUrl,
      coverImage: song.coverImage
    });
  }

  addToQueue(song: DiscoverSong, event: Event): void {
    event.stopPropagation();
    if (!song.fileUrl) {
      return;
    }

    this.playerService.addToQueue({
      songId: song.id,
      title: song.title,
      artist: song.artistName,
      src: song.fileUrl,
      coverImage: song.coverImage
    });
  }

  playNext(song: DiscoverSong, event: Event): void {
    event.stopPropagation();
    if (!song.fileUrl) {
      return;
    }

    this.playerService.playNext({
      songId: song.id,
      title: song.title,
      artist: song.artistName,
      src: song.fileUrl,
      coverImage: song.coverImage
    });
  }
}
