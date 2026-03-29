import { Component, OnDestroy, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { AdminService } from '../../core/services/admin.service';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../services/user.service';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css']
})
export class AdminComponent implements OnInit, OnDestroy {
  users: any[] = [];
  admins: any[] = [];
  artists: any[] = [];
  songs: any[] = [];
  deletions: any[] = [];
  currentProfileUser: any = null;
  adminSearch = '';
  loading = false;
  error = '';
  success = '';
  creatingArtist = false;
  creatingSong = false;
  creatingAlbum = false;
  releaseMode: 'single' | 'album' = 'single';
  workingUserIds = new Set<number | string>();
  undoingDeletionIds = new Set<number | string>();
  nowMs = Date.now();
  private clockTimer: any = null;

  artistForm = {
    artist_name: '',
    bio: '',
    genre: ''
  };

  songForm: {
    title: string;
    genre: string;
    artist_id: number | string | 'all';
    audio_url: string;
  } = {
    title: '',
    genre: '',
    artist_id: 'all',
    audio_url: ''
  };

  selectedSongFile: File | null = null;
  selectedCoverImageFile: File | null = null;
  selectedAlbumCoverFile: File | null = null;
  albumTrackAudioFiles: Array<File | null> = [null];

  albumForm: {
    title: string;
    artist_id: number | string | '';
    release_date: string;
    tracks: Array<{
      title: string;
      genre: string;
      audio_url: string;
      order_number: number | '';
    }>;
  } = {
    title: '',
    artist_id: '',
    release_date: '',
    tracks: [
      { title: '', genre: '', audio_url: '', order_number: 1 }
    ]
  };

  constructor(
    private adminService: AdminService,
    private authService: AuthService,
    private userService: UserService,
    private api: ApiService
  ) { }

  ngOnInit(): void {
    this.startClock();
    this.loadAll();
  }

  ngOnDestroy(): void {
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
      this.clockTimer = null;
    }
  }

  private startClock() {
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
    }

    this.clockTimer = setInterval(() => {
      this.nowMs = Date.now();
    }, 1000);
  }

  loadAll() {
    this.loading = true;
    this.error = '';
    this.success = '';

    let usersDone = false;
    let adminsDone = false;
    let artistsDone = false;
    let songsDone = false;
    let deletionsDone = false;

    const completeIfReady = () => {
      if (usersDone && adminsDone && artistsDone && songsDone && deletionsDone) {
        this.loading = false;
      }
    };

    this.adminService.getUsers().subscribe({
      next: (data) => {
        this.users = this.normalizeCollection(data, ['users', 'data', 'result']);
        usersDone = true;
        completeIfReady();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Could not load users.';
        usersDone = true;
        completeIfReady();
      }
    });

    this.userService.getProfile().subscribe({
      next: (data) => {
        this.currentProfileUser = data || null;
      },
      error: () => {
        this.currentProfileUser = null;
      }
    });

    this.adminService.getArtists().subscribe({
      next: (data) => {
        this.artists = this.normalizeCollection(data, ['artists', 'data', 'result']);
        artistsDone = true;
        completeIfReady();
      },
      error: (err) => {
        this.error = this.error || err?.error?.message || 'Could not load artists.';
        artistsDone = true;
        completeIfReady();
      }
    });

    this.adminService.getAdmins().subscribe({
      next: (data) => {
        this.admins = this.normalizeCollection(data, ['admins', 'users', 'data', 'result']);
        adminsDone = true;
        completeIfReady();
      },
      error: () => {
        this.admins = [];
        adminsDone = true;
        completeIfReady();
      }
    });

    this.adminService.getSongs().subscribe({
      next: (data) => {
        this.songs = this.normalizeCollection(data, ['songs', 'data', 'result']);
        songsDone = true;
        completeIfReady();
      },
      error: (err) => {
        this.error = this.error || err?.error?.message || 'Could not load songs.';
        songsDone = true;
        completeIfReady();
      }
    });

    this.adminService.getRecentDeletions().subscribe({
      next: (data) => {
        this.deletions = this.normalizeCollection(data, ['deletions', 'data', 'result']);
        deletionsDone = true;
        completeIfReady();
      },
      error: () => {
        this.deletions = [];
        deletionsDone = true;
        completeIfReady();
      }
    });
  }

  getUserId(user: any): number | string | undefined {
    if (!user) {
      return undefined;
    }
    return user.user_id ?? user.userId ?? user.uid ?? user.id;
  }

  getUserRole(user: any): string {
    if (this.hasAdminFlag(user)) {
      return 'admin';
    }

    const direct = this.normalizeRole(user?.role);
    const userRole = this.normalizeRole(user?.user_role);
    const roleName = this.normalizeRole(user?.role_name);
    const camel = this.normalizeRole(user?.userRole);
    const roleId = this.normalizeRole(user?.role_id);
    const roleCode = this.normalizeRole(user?.role_code);
    const accountType = this.normalizeRole(user?.account_type);
    const type = this.normalizeRole(user?.type);
    const permission = this.normalizeRole(user?.permission);
    const nested =
      this.normalizeRole(user?.role?.name) ||
      this.normalizeRole(user?.role?.role_name) ||
      this.normalizeRole(user?.role?.code) ||
      this.normalizeRole(user?.role?.id);

    return direct || userRole || roleName || camel || roleId || roleCode || accountType || type || permission || nested || 'user';
  }

  isKnownRole(role: string): boolean {
    return role === 'user' || role === 'artist' || role === 'admin';
  }

  getArtistId(artist: any): number | string | undefined {
    return artist.artist_id ?? artist.id;
  }

  getSongId(song: any): number | string | undefined {
    return song.song_id ?? song.id;
  }

  get filteredUsers(): any[] {
    const term = this.adminSearch.trim().toLowerCase();
    if (!term) {
      return this.users;
    }

    return this.users.filter((user) => {
      const id = String(this.getUserId(user) ?? '').toLowerCase();
      const username = String(user?.username ?? user?.user_name ?? user?.name ?? '').toLowerCase();
      const email = String(user?.email ?? '').toLowerCase();
      const role = this.getUserRole(user);
      return id.includes(term) || username.includes(term) || email.includes(term) || role.includes(term);
    });
  }

  get filteredAdminUsers(): any[] {
    const adminsFromUsers = this.users.filter((user) => this.getUserRole(user) === 'admin');
    const adminsFromEndpoint = this.admins.filter((user) => this.getUserRole(user) === 'admin');
    const combined = [...adminsFromEndpoint, ...adminsFromUsers];
    const deduped = this.dedupeUsers(combined);

    const profileIsAdmin = this.authService.isAdmin() ||
      (this.currentProfileUser && this.getUserRole(this.currentProfileUser) === 'admin');

    if (!profileIsAdmin) {
      return deduped;
    }

    const profileId = this.getUserId(this.currentProfileUser);
    const hasProfileAlready = deduped.some((user) => {
      const userId = this.getUserId(user);
      if (profileId !== undefined && userId !== undefined) {
        return String(userId) === String(profileId);
      }

      const emailA = String(user?.email ?? '').toLowerCase();
      const emailB = String(this.currentProfileUser?.email ?? '').toLowerCase();
      return !!emailA && emailA === emailB;
    });

    if (!this.currentProfileUser) {
      return deduped;
    }

    const profileWithAdminRole =
      this.getUserRole(this.currentProfileUser) !== 'admin'
        ? { ...this.currentProfileUser, role: 'admin', user_role: 'admin', role_name: 'admin' }
        : this.currentProfileUser;

    return hasProfileAlready ? deduped : [profileWithAdminRole, ...deduped];
  }

  get filteredArtists(): any[] {
    const term = this.adminSearch.trim().toLowerCase();
    if (!term) {
      return this.artists;
    }

    return this.artists.filter((artist) => {
      const id = String(this.getArtistId(artist) ?? '').toLowerCase();
      const name = String(artist?.artist_name ?? artist?.name ?? '').toLowerCase();
      const genre = String(artist?.genre ?? artist?.bio ?? '').toLowerCase();
      return id.includes(term) || name.includes(term) || genre.includes(term);
    });
  }

  get filteredSongs(): any[] {
    const term = this.adminSearch.trim().toLowerCase();
    if (!term) {
      return this.songs;
    }

    return this.songs.filter((song) => {
      const id = String(this.getSongId(song) ?? '').toLowerCase();
      const title = String(song?.title ?? song?.song_name ?? '').toLowerCase();
      const artist = String(song?.artist_name ?? song?.artist ?? '').toLowerCase();
      return id.includes(term) || title.includes(term) || artist.includes(term);
    });
  }

  get activeDeletions(): any[] {
    return this.deletions.filter((item) => this.getDeletionRemainingSeconds(item) > 0);
  }

  getDeletionRemainingSeconds(item: any): number {
    const fromServer = Number(item?.remaining_seconds);
    if (!Number.isNaN(fromServer) && fromServer >= 0 && !item?.expires_at) {
      return Math.max(0, Math.floor(fromServer));
    }

    const expiry = new Date(item?.expires_at || item?.expiresAt || 0).getTime();
    if (!expiry) {
      return 0;
    }
    return Math.max(0, Math.floor((expiry - this.nowMs) / 1000));
  }

  formatRemaining(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }

  getDeletionTypeLabel(item: any): string {
    const type = String(item?.entity_type || '').toLowerCase();
    if (type === 'artist_bundle') {
      return 'artist';
    }
    return type || 'item';
  }

  getDeletionId(item: any): number | string | undefined {
    return item?.deletion_id ?? item?.id;
  }

  undoDeletion(item: any) {
    const deletionId = this.getDeletionId(item);
    if (deletionId === undefined) {
      this.error = 'Deletion id missing.';
      return;
    }

    this.undoingDeletionIds.add(deletionId);
    this.adminService.undoDeletion(deletionId).subscribe({
      next: () => {
        this.deletions = this.deletions.filter((entry) => this.getDeletionId(entry) !== deletionId);
        this.success = 'Undo successful.';
        this.error = '';
        this.undoingDeletionIds.delete(deletionId);
        this.loadAll();
      },
      error: (err) => {
        this.error = err?.error?.error || err?.error?.message || 'Undo failed.';
        this.success = '';
        this.undoingDeletionIds.delete(deletionId);
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

    if (payload && typeof payload === 'object') {
      const values = Object.values(payload);
      if (values.every((value) => value && typeof value === 'object' && !Array.isArray(value))) {
        const asArray = values as any[];
        const looksLikeEntityList = asArray.some((item) =>
          item.user_id !== undefined ||
          item.userId !== undefined ||
          item.uid !== undefined ||
          item.id !== undefined ||
          item.username !== undefined ||
          item.artist_id !== undefined ||
          item.song_id !== undefined
        );

        if (looksLikeEntityList) {
          return asArray;
        }
      }
    }

    return [];
  }

  private dedupeUsers(users: any[]): any[] {
    const byKey = new Map<string, any>();

    for (const user of users) {
      const id = this.getUserId(user);
      const email = String(user?.email ?? '').toLowerCase();
      const key = id !== undefined ? `id:${id}` : (email ? `email:${email}` : `tmp:${Math.random()}`);
      byKey.set(key, user);
    }

    return Array.from(byKey.values());
  }

  private normalizeRole(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const normalizedItem = this.normalizeRole(item);
        if (normalizedItem) {
          return normalizedItem;
        }
      }
      return '';
    }

    if (typeof value === 'object') {
      return this.normalizeRole(
        value?.name ??
        value?.role_name ??
        value?.role ??
        value?.user_role ??
        value?.code ??
        value?.id
      );
    }

    const normalized = String(value).trim().toLowerCase();
    if (!normalized || normalized === 'null' || normalized === 'undefined') {
      return '';
    }

    return this.canonicalizeRole(normalized);
  }

  private hasAdminFlag(user: any): boolean {
    const adminValues = [true, 1, '1', 'true', 'yes', 'y'];
    const rawFlags = [
      user?.is_admin,
      user?.isAdmin,
      user?.admin,
      user?.is_superadmin,
      user?.isSuperAdmin,
      user?.super_admin
    ];

    return rawFlags.some((flag) => adminValues.includes(
      typeof flag === 'string' ? flag.trim().toLowerCase() : flag
    ));
  }

  private canonicalizeRole(role: string): string {
    if (role === 'a' || role === 'adm' || role === 'administrator') {
      return 'admin';
    }

    if (role === 'u') {
      return 'user';
    }

    if (role === 'ar' || role === 'art') {
      return 'artist';
    }

    if (role === '1') {
      return 'admin';
    }

    if (role === '2') {
      return 'artist';
    }

    if (role === '3') {
      return 'user';
    }

    return role;
  }

  onRoleChange(user: any, event: Event) {
    const select = event.target as HTMLSelectElement;
    this.changeUserRole(user, select.value);
  }

  promoteToAdmin(user: any) {
    this.changeUserRole(user, 'admin');
  }

  private changeUserRole(user: any, role: string) {
    const userId = this.getUserId(user);
    if (userId === undefined) {
      this.error = 'User id missing for role update.';
      return;
    }

    this.workingUserIds.add(userId);

    this.adminService.updateUserRole(userId, role).subscribe({
      next: () => {
        user.role = role;
        user.user_role = role;
        user.role_name = role;
        this.success = 'User role updated.';
        this.error = '';
        this.workingUserIds.delete(userId);
      },
      error: (err) => {
        this.error = err?.error?.message || 'Role update failed.';
        this.success = '';
        this.workingUserIds.delete(userId);
      }
    });
  }

  createArtist() {
    const artist_name = this.artistForm.artist_name.trim();
    if (!artist_name) {
      this.error = 'Artist name is required.';
      this.success = '';
      return;
    }

    this.creatingArtist = true;
    this.adminService.createArtist({
      artist_name,
      bio: this.artistForm.bio.trim(),
      genre: this.artistForm.genre.trim()
    }).subscribe({
      next: () => {
        this.artistForm = { artist_name: '', bio: '', genre: '' };
        this.success = 'Artist created.';
        this.error = '';
        this.creatingArtist = false;
        this.loadAll();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Artist creation failed.';
        this.success = '';
        this.creatingArtist = false;
      }
    });
  }

  deleteUser(user: any) {
    const userId = this.getUserId(user);
    if (userId === undefined) {
      this.error = 'User id missing.';
      return;
    }

    if (!confirm('Delete this user?')) {
      return;
    }

    this.workingUserIds.add(userId);
    this.adminService.deleteUser(userId).subscribe({
      next: () => {
        this.users = this.users.filter(item => this.getUserId(item) !== userId);
        this.success = 'User removed.';
        this.error = '';
        this.workingUserIds.delete(userId);
        this.refreshDeletions();
      },
      error: (err) => {
        this.error = err?.error?.message || 'User deletion failed.';
        this.success = '';
        this.workingUserIds.delete(userId);
      }
    });
  }

  onSongFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.selectedSongFile = input.files?.[0] ?? null;
  }

  onCoverImageFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.selectedCoverImageFile = input.files?.[0] ?? null;
  }

  onAlbumCoverFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.selectedAlbumCoverFile = input.files?.[0] ?? null;
  }

  onAlbumTrackAudioFileChange(index: number, event: Event) {
    const input = event.target as HTMLInputElement;
    this.albumTrackAudioFiles[index] = input.files?.[0] ?? null;
  }

  addAlbumTrackRow() {
    this.albumForm.tracks.push({
      title: '',
      genre: '',
      audio_url: '',
      order_number: this.albumForm.tracks.length + 1
    });
    this.albumTrackAudioFiles.push(null);
  }

  removeAlbumTrackRow(index: number) {
    if (this.albumForm.tracks.length <= 1) {
      return;
    }
    this.albumForm.tracks.splice(index, 1);
    this.albumTrackAudioFiles.splice(index, 1);
  }

  onAlbumArtistChange() {
    this.albumForm.tracks = [{ title: '', genre: '', audio_url: '', order_number: 1 }];
    this.albumTrackAudioFiles = [null];
  }

  createSong() {
    const title = this.songForm.title.trim();
    const audioUrl = this.songForm.audio_url.trim();
    const genre = this.songForm.genre.trim();

    if (!title) {
      this.error = 'Song title is required.';
      this.success = '';
      return;
    }

    if (!this.selectedSongFile && !audioUrl) {
      this.error = 'Select an audio file or provide an audio URL.';
      this.success = '';
      return;
    }

    const isAllArtists = this.songForm.artist_id === 'all';
    const artistIds = isAllArtists
      ? this.artists
          .map((artist) => this.getArtistId(artist))
          .filter((id): id is number | string => this.isValidArtistId(id))
      : (this.isValidArtistId(this.songForm.artist_id) ? [this.songForm.artist_id] : []);

    if (!artistIds.length) {
      this.error = 'Valid artist id is required. Pick a valid artist.';
      this.success = '';
      return;
    }

    this.creatingSong = true;
    const requests = artistIds.map((artistId) => this.adminService.createSong({
      title,
      genre,
      artist_id: artistId,
      audio_url: audioUrl || undefined
    }, this.selectedSongFile, this.selectedCoverImageFile));

    forkJoin(requests).subscribe({
      next: () => {
        this.songForm = { title: '', genre: '', artist_id: 'all', audio_url: '' };
        this.selectedSongFile = null;
        this.selectedCoverImageFile = null;
        this.success = isAllArtists
          ? 'Song added to all artists.'
          : 'Song created.';
        this.error = '';
        this.creatingSong = false;
        this.loadAll();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Song creation failed.';
        this.success = '';
        this.creatingSong = false;
      }
    });
  }

  createAlbum() {
    const title = this.albumForm.title.trim();
    const artistId = this.albumForm.artist_id;

    if (!title) {
      this.error = 'Album title is required.';
      this.success = '';
      return;
    }

    if (!this.isValidArtistId(artistId)) {
      this.error = 'Select a valid artist for this album.';
      this.success = '';
      return;
    }

    const tracks = this.albumForm.tracks
      .map((track, index) => ({
        title: track.title.trim(),
        genre: track.genre.trim(),
        audio_url: track.audio_url.trim(),
        order_number: Number(track.order_number),
        audio_file: this.albumTrackAudioFiles[index] || null
      }))
      .filter((track) =>
        Number.isInteger(track.order_number) && track.order_number > 0 &&
        !!track.title &&
        (!!track.audio_file || !!track.audio_url)
      );

    if (!tracks.length) {
      this.error = 'Add at least one queued track with title, order, and audio.';
      this.success = '';
      return;
    }

    this.creatingAlbum = true;
    this.adminService.createAlbum({
      title,
      artist_id: artistId,
      release_date: this.albumForm.release_date || undefined,
      tracks
    }, this.selectedAlbumCoverFile).subscribe({
      next: () => {
        this.albumForm = {
          title: '',
          artist_id: '',
          release_date: '',
          tracks: [{ title: '', genre: '', audio_url: '', order_number: 1 }]
        };
        this.selectedAlbumCoverFile = null;
        this.albumTrackAudioFiles = [null];
        this.success = 'Album created.';
        this.error = '';
        this.creatingAlbum = false;
        this.loadAll();
      },
      error: (err) => {
        this.error = err?.error?.message || err?.message || 'Album creation failed.';
        this.success = '';
        this.creatingAlbum = false;
      }
    });
  }

  removeArtist(artist: any) {
    const artistId = this.getArtistId(artist);
    if (artistId === undefined) {
      this.error = 'Artist id missing.';
      return;
    }

    if (!confirm('Delete this artist?')) {
      return;
    }

    this.adminService.deleteArtist(artistId).subscribe({
      next: () => {
        this.artists = this.artists.filter(item => this.getArtistId(item) !== artistId);
        this.success = 'Artist removed.';
        this.error = '';
        if (this.songForm.artist_id === artistId) {
          this.songForm.artist_id = 'all';
        }
        this.refreshDeletions();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Artist deletion failed.';
        this.success = '';
      }
    });
  }

  removeSong(song: any) {
    const songId = this.getSongId(song);
    if (songId === undefined) {
      this.error = 'Song id missing.';
      return;
    }

    if (!confirm('Delete this song?')) {
      return;
    }

    this.adminService.deleteSong(songId).subscribe({
      next: () => {
        this.songs = this.songs.filter(item => this.getSongId(item) !== songId);
        this.success = 'Song removed.';
        this.error = '';
        this.refreshDeletions();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Song deletion failed.';
        this.success = '';
      }
    });
  }

  private refreshDeletions() {
    this.adminService.getRecentDeletions().subscribe({
      next: (data) => {
        this.deletions = this.normalizeCollection(data, ['deletions', 'data', 'result']);
      }
    });
  }

  private isValidArtistId(value: any): value is number | string {
    if (value === null || value === undefined) {
      return false;
    }

    return /^\d+$/.test(String(value).trim());
  }

  getAlbumTrackOrderOptions(): number[] {
    const max = Math.max(this.albumForm.tracks.length + 5, 10);
    return Array.from({ length: max }, (_, i) => i + 1);
  }

  getSongCoverUrl(song: any): string {
    const raw = song?.cover_image ?? song?.album_cover_image ?? '';
    return this.api.getAssetUrl(raw) || 'assets/favicon.ico';
  }

}
