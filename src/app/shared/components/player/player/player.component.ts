import { DOCUMENT } from '@angular/common';
import { Component, Inject, Renderer2, RendererFactory2 } from '@angular/core';
import { Subscription } from 'rxjs';
import { PlayerService, PlayerTrack } from '../../../../core/services/player.service';
import { SongService } from '../../../../core/services/song.service';

interface LikedSongLookup {
  song_id?: string | number;
  id?: string | number;
}

interface LikedSongsPayload {
  songs?: LikedSongLookup[];
}

@Component({
  selector: 'app-player',
  templateUrl: './player.component.html',
  styleUrls: ['./player.component.css']
})
export class PlayerComponent {
  private readonly renderer: Renderer2;
  private readonly onTimeUpdate = () => this.updateProgress();
  private readonly onLoadedMetadata = () => {
    this.duration = this.formatTime(this.audio.duration);
  };
  private readonly onEnded = () => {
    if (this.isRepeating) {
      this.audio.currentTime = 0;
      this.audio.play();
    } else {
      this.next();
    }
  };

  isPlaying = false;
  progress = 0;
  isExpanded = false;
  isShuffled = false;
  isRepeating = false;

  audio!: HTMLAudioElement;

  currentTrack: PlayerTrack = {
    title: 'Midnight Ritual',
    artist: 'Chrome Collapse',
    src: 'assets/audio/midnight-ritual.mp3',
    coverImage: ''
  };

  currentTime = '0:00';
  duration = '0:00';

  waveformBars: number[] = [];
  readonly WAVEFORM_BARS = 70;

  recentlyPlayed: PlayerTrack[] = [];
  queue: PlayerTrack[] = [];
  activeExpandedTab: 'recent' | 'queue' | null = null;
  isSidebarOpen = true;
  isCurrentTrackLiked = false;
  likeBusy = false;

  private playRequestSub?: Subscription;
  private currentTrackSub?: Subscription;
  private queueSub?: Subscription;
  private recentSub?: Subscription;
  private previousTrackStack: PlayerTrack[] = [];
  private lastPrevClickAt = 0;

  constructor(
    private playerService: PlayerService,
    private songService: SongService,
    rendererFactory: RendererFactory2,
    @Inject(DOCUMENT) private document: Document
  ) {
    this.renderer = rendererFactory.createRenderer(null, null);
  }

  ngOnInit() {
    this.currentTrackSub = this.playerService.currentTrack$.subscribe((track) => {
      this.currentTrack = track;
    });

    this.queueSub = this.playerService.queue$.subscribe((queue) => {
      this.queue = queue;
    });

    this.recentSub = this.playerService.recentlyPlayed$.subscribe((rows) => {
      this.recentlyPlayed = rows;
    });
  }

  ngAfterViewInit() {
    this.audio = new Audio(this.currentTrack.src);

    this.audio.addEventListener('timeupdate', this.onTimeUpdate);
    this.audio.addEventListener('loadedmetadata', this.onLoadedMetadata);
    this.audio.addEventListener('ended', this.onEnded);

    this.playRequestSub = this.playerService.playRequest$.subscribe((track) => {
      this.loadTrack(track, { autoplay: true, pushCurrentToHistory: true, addToRecent: true });
    });

    this.generateWaveform(this.currentTrack.src);
    this.refreshLikeState();
  }

  ngOnDestroy() {
    this.playRequestSub?.unsubscribe();
    this.currentTrackSub?.unsubscribe();
    this.queueSub?.unsubscribe();
    this.recentSub?.unsubscribe();
    if (this.audio) {
      this.audio.removeEventListener('timeupdate', this.onTimeUpdate);
      this.audio.removeEventListener('loadedmetadata', this.onLoadedMetadata);
      this.audio.removeEventListener('ended', this.onEnded);
      this.audio.pause();
    }
    this.setPageScrollLock(false);
  }

  togglePlay() {
    this.isPlaying = !this.isPlaying;

    if (this.isPlaying) {
      this.audio.play();
    } else {
      this.audio.pause();
    }
  }

  updateProgress() {
    const current = this.audio.currentTime;
    const duration = this.audio.duration;

    this.progress = duration ? (current / duration) * 100 : 0;
    this.currentTime = this.formatTime(current);
  }

  seek(event: MouseEvent) {
    const element = event.currentTarget as HTMLElement;
    const rect = element.getBoundingClientRect();

    const clickX = event.clientX - rect.left;
    const width = rect.width;

    const percent = clickX / width;

    this.audio.currentTime = percent * this.audio.duration;
  }

  formatTime(seconds: number): string {
    const safeSeconds = Number.isFinite(seconds) ? seconds : 0;
    const minutes = Math.floor(safeSeconds / 60);
    const secs = Math.floor(safeSeconds % 60);

    return `${minutes}:${secs < 10 ? '0' + secs : secs}`;
  }

  toggleExpanded() {
    this.isExpanded = !this.isExpanded;
    this.setPageScrollLock(this.isExpanded);
    if (!this.isExpanded) {
      this.activeExpandedTab = null;
      this.isSidebarOpen = true;
    }
  }

  toggleShuffle() {
    this.isShuffled = !this.isShuffled;
  }

  toggleRepeat() {
    this.isRepeating = !this.isRepeating;
  }

  selectExpandedTab(tab: 'recent' | 'queue') {
    this.activeExpandedTab = this.activeExpandedTab === tab ? null : tab;
    if (this.activeExpandedTab) {
      this.isSidebarOpen = true;
    }
  }

  next() {
    const nextTrack = this.playerService.popNextTrack();

    if (!nextTrack) {
      return;
    }

    this.loadTrack(nextTrack, { autoplay: true, pushCurrentToHistory: true, addToRecent: true });
  }

  prev() {
    if (!this.audio) {
      return;
    }

    const now = Date.now();
    const nearStart = this.audio.currentTime <= 0.7;
    const isDoubleClick = now - this.lastPrevClickAt <= 650;

    // First click: restart current song.
    if (!nearStart && !isDoubleClick) {
      this.audio.currentTime = 0;
      this.lastPrevClickAt = now;
      return;
    }

    // Second quick click (or already at 0:00): go to previous song.
    const previousTrack = this.previousTrackStack.pop();
    if (previousTrack) {
      this.loadTrack(previousTrack, { autoplay: true, pushCurrentToHistory: false, addToRecent: false });
    } else {
      this.audio.currentTime = 0;
    }

    this.lastPrevClickAt = now;
  }

  magnetic(event: MouseEvent) {
    const btn = event.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();

    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;

    this.renderer.setStyle(btn, 'transform', `translate(${x * 0.25}px, ${y * 0.25}px)`);
  }

  resetMagnetic(event: MouseEvent) {
    const btn = event.currentTarget as HTMLElement;
    this.renderer.setStyle(btn, 'transform', 'translate(0px, 0px)');
  }

  private loadTrack(
    track: PlayerTrack,
    opts: { autoplay: boolean; pushCurrentToHistory: boolean; addToRecent: boolean }
  ) {
    const currentSrc = this.currentTrack?.src || '';
    const isDifferentTrack = !!currentSrc && currentSrc !== track.src;

    if (opts.pushCurrentToHistory && isDifferentTrack && this.currentTrack?.src) {
      this.previousTrackStack.push({ ...this.currentTrack });
      const queueIndex = this.queue.findIndex((queued) => queued.src === track.src);
      if (queueIndex >= 0) {
        this.playerService.removeFromQueue(queueIndex);
      }
    }

    this.currentTrack = track;
    this.playerService.playTrack(track, { skipRecent: !opts.addToRecent, emitPlayRequest: false });

    this.audio.pause();
    this.audio.src = track.src;
    this.audio.load();

    this.currentTime = '0:00';
    this.progress = 0;
    this.generateWaveform(track.src);

    if (opts.autoplay) {
      this.audio.play();
      this.isPlaying = true;
    }

    this.refreshLikeState();
  }

  moveQueueItemUp(index: number, event?: Event) {
    event?.stopPropagation();
    this.playerService.reorderQueue(index, index - 1);
  }

  moveQueueItemDown(index: number, event?: Event) {
    event?.stopPropagation();
    this.playerService.reorderQueue(index, index + 1);
  }

  removeQueueItem(index: number, event?: Event) {
    event?.stopPropagation();
    this.playerService.removeFromQueue(index);
  }

  playQueuedItem(index: number, event?: Event) {
    event?.stopPropagation();
    const item = this.queue[index];
    if (!item) {
      return;
    }

    this.playerService.removeFromQueue(index);
    this.loadTrack(item, { autoplay: true, pushCurrentToHistory: true, addToRecent: true });
  }

  playRecentItem(item: PlayerTrack, event?: Event) {
    event?.stopPropagation();
    this.loadTrack(item, { autoplay: true, pushCurrentToHistory: true, addToRecent: true });
  }

  toggleLikeCurrentTrack(event?: Event) {
    event?.stopPropagation();
    const songId = this.currentTrack.songId;
    if (!songId || this.likeBusy) {
      return;
    }

    this.likeBusy = true;
    const request$ = this.isCurrentTrackLiked
      ? this.songService.unlikeSong(songId)
      : this.songService.likeSong(songId);

    request$.subscribe({
      next: () => {
        this.isCurrentTrackLiked = !this.isCurrentTrackLiked;
        this.likeBusy = false;
      },
      error: () => {
        this.likeBusy = false;
      }
    });
  }

  private refreshLikeState() {
    const songId = this.currentTrack.songId;
    if (!songId || !localStorage.getItem('token')) {
      this.isCurrentTrackLiked = false;
      return;
    }

    this.songService.getLikedSongs().subscribe({
      next: (payload: LikedSongLookup[] | LikedSongsPayload) => {
        const rows = Array.isArray(payload) ? payload : (payload.songs || []);
        const ids = new Set(rows.map((song) => String(song.song_id ?? song.id ?? '')));
        this.isCurrentTrackLiked = ids.has(String(songId));
      },
      error: () => {
        // Back-end may not support liked songs; keep UI stable without logging.
        this.isCurrentTrackLiked = false;
      }
    });
  }

  private generateWaveform(seed: string) {
    // Seeded pseudo-random so bars are consistent per track
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
      h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
    }
    this.waveformBars = Array.from({ length: this.WAVEFORM_BARS }, (_, i) => {
      h = ((h << 5) - h + i * 2654435761) | 0;
      const raw = Math.abs(h % 1000) / 1000; // 0–1
      return 0.2 + raw * 0.8; // clamp to 0.2–1.0
    });
  }

  private setPageScrollLock(locked: boolean) {
    const value = locked ? 'hidden' : '';
    this.renderer.setStyle(this.document.body, 'overflow', value);
    this.renderer.setStyle(this.document.documentElement, 'overflow', value);
  }
}
