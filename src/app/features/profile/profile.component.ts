import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { UpdateProfilePayload, UserProfile, UserService } from '../../services/user.service';
import { SongService } from '../../core/services/song.service';
import { ApiService } from '../../services/api.service';
import { PlayerService } from '../../core/services/player.service';

interface LikedSongPayload {
  song_id?: string | number;
  id?: string | number;
  title?: string;
  song_name?: string;
  artist_name?: string;
  artist?: {
    artist_name?: string;
    name?: string;
  } | string;
  cover_image?: string;
  album_cover_image?: string;
  file_url?: string;
}

interface LikedSongsResponse {
  songs?: LikedSongPayload[];
}

interface LikedSongViewModel {
  id: string;
  title: string;
  artist: string;
  coverImage: string;
  fileUrl: string;
}

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {
  user: UserProfile = this.createEmptyProfile();
  editOpen = false;
  avatarPreview: string | null = null;
  readonly defaultAccent = '#ff4df0';
  readonly hiddenSections = ['Playlists', 'Following artists'];
  panelMessage = '';
  panelError = '';
  panelBusy = false;
  likedSongs: LikedSongViewModel[] = [];

  constructor(
    private userService: UserService,
    private router: Router,
    private authService: AuthService,
    private songService: SongService,
    private api: ApiService,
    private playerService: PlayerService
  ) {}

  ngOnInit(): void {
    this.loadProfile();
    this.loadLikedSongs();
  }

  loadProfile() {
    this.userService.getProfile().subscribe({
      next: (data) => {
        this.user = {
          ...this.createEmptyProfile(),
          ...(data || {})
        };
        if (!this.user.accent) {
          this.user.accent = this.defaultAccent;
        }
      },
      error: () => {
        this.user = this.createEmptyProfile();
      }
    });
  }

  openEdit() { this.editOpen = true; }

  closeEdit() {
    this.editOpen = false;
  }

  setAccent(color: string) { this.user.accent = color; }

  onAvatarChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => this.avatarPreview = reader.result as string;
      reader.readAsDataURL(file);
    }
  }

  saveProfile() {
    this.panelBusy = true;
    this.panelError = '';
    this.panelMessage = '';

    const payload: UpdateProfilePayload = {
      username: this.user.username,
      bio: this.user.bio,
      accent: this.user.accent || this.defaultAccent
    };
    if (this.avatarPreview) {
      payload.avatar = this.avatarPreview;
    }

    this.userService.updateProfile(payload).subscribe({
      next: (data) => {
        this.user = {
          ...this.createEmptyProfile(),
          ...data
        };
        if (!this.user.accent) {
          this.user.accent = this.defaultAccent;
        }
        this.avatarPreview = null;
        this.panelMessage = 'Profile updated.';
        this.panelBusy = false;
        this.closeEdit();
      },
      error: (err) => {
        this.panelError = err?.error?.message || 'Could not update profile.';
        this.panelBusy = false;
      }
    });
  }

  logout() {
    if (!confirm('Are you sure you want to log out?')) {
      return;
    }

    this.userService.logoutBackend().subscribe({
      next: () => this.finishLogout(),
      error: () => this.finishLogout()
    });
  }

  private finishLogout() {
    this.authService.logout();
    this.user = this.createEmptyProfile();
    this.router.navigate(['/home']);
  }

  get accentColor(): string {
    return this.user.accent || this.defaultAccent;
  }

  private loadLikedSongs() {
    this.songService.getLikedSongs().subscribe({
      next: (payload: LikedSongPayload[] | LikedSongsResponse) => {
        const rows = Array.isArray(payload) ? payload : (payload.songs || []);
        this.likedSongs = rows.map((song) => ({
          id: String(song.song_id ?? song.id ?? ''),
          title: String(song.title ?? song.song_name ?? 'Untitled'),
          artist: String(
            song.artist_name ??
            (typeof song.artist === 'object' ? (song.artist.artist_name ?? song.artist.name) : song.artist) ??
            'Unknown Artist'
          ),
          coverImage: this.api.getAssetUrl(song.cover_image ?? song.album_cover_image ?? '') || 'assets/favicon.ico',
          fileUrl: this.api.getAssetUrl(song.file_url ?? '')
        }));
      },
      error: () => {
        this.likedSongs = [];
      }
    });
  }

  playLikedSong(song: LikedSongViewModel) {
    if (!song.fileUrl) {
      return;
    }

    this.playerService.playTrack({
      songId: song.id,
      title: song.title,
      artist: song.artist,
      src: song.fileUrl,
      coverImage: song.coverImage
    });
  }

  queueLikedSong(song: LikedSongViewModel, event: Event) {
    event.stopPropagation();
    if (!song.fileUrl) {
      return;
    }

    this.playerService.addToQueue({
      songId: song.id,
      title: song.title,
      artist: song.artist,
      src: song.fileUrl,
      coverImage: song.coverImage
    });
  }

  playNextLikedSong(song: LikedSongViewModel, event: Event) {
    event.stopPropagation();
    if (!song.fileUrl) {
      return;
    }

    this.playerService.playNext({
      songId: song.id,
      title: song.title,
      artist: song.artist,
      src: song.fileUrl,
      coverImage: song.coverImage
    });
  }

  private createEmptyProfile(): UserProfile {
    return {
      username: '',
      bio: '',
      avatarUrl: 'assets/default-avatar.png',
      accent: this.defaultAccent
    };
  }
}
