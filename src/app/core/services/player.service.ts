import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';

export interface PlayerTrack {
  songId?: string | number;
  title: string;
  artist: string;
  src: string;
  coverImage?: string;
}

interface PlayerSessionState {
  currentTrack: PlayerTrack;
  queue: PlayerTrack[];
  recentlyPlayed: PlayerTrack[];
}

@Injectable({ providedIn: 'root' })
export class PlayerService {
  private readonly sessionKey = 'player_session_state_v1';
  private readonly defaultTrack: PlayerTrack = {
    title: 'Midnight Ritual',
    artist: 'Chrome Collapse',
    src: 'assets/audio/midnight-ritual.mp3',
    coverImage: ''
  };

  private currentTrackSubject = new BehaviorSubject<PlayerTrack>(this.defaultTrack);
  private queueSubject = new BehaviorSubject<PlayerTrack[]>([]);
  private recentlyPlayedSubject = new BehaviorSubject<PlayerTrack[]>([]);

  private playRequestSubject = new Subject<PlayerTrack>();

  currentTrack$ = this.currentTrackSubject.asObservable();
  queue$ = this.queueSubject.asObservable();
  recentlyPlayed$ = this.recentlyPlayedSubject.asObservable();
  playRequest$ = this.playRequestSubject.asObservable();

  constructor() {
    this.restoreSession();
  }

  playTrack(track: PlayerTrack, options?: { skipRecent?: boolean; emitPlayRequest?: boolean }) {
    if (!options?.skipRecent) {
      this.pushRecent(track);
    }
    this.currentTrackSubject.next(track);
    if (options?.emitPlayRequest !== false) {
      this.playRequestSubject.next(track);
    }
    this.persistSession();
  }

  addToQueue(track: PlayerTrack) {
    const nextQueue = [...this.queueSubject.value, { ...track }];
    this.queueSubject.next(nextQueue);
    this.persistSession();
  }

  playNext(track: PlayerTrack) {
    const nextQueue = [{ ...track }, ...this.queueSubject.value];
    this.queueSubject.next(nextQueue);
    this.persistSession();
  }

  popNextTrack(): PlayerTrack | null {
    const currentQueue = [...this.queueSubject.value];
    const next = currentQueue.shift() || null;
    this.queueSubject.next(currentQueue);
    this.persistSession();
    return next;
  }

  removeFromQueue(index: number) {
    const currentQueue = [...this.queueSubject.value];
    if (index < 0 || index >= currentQueue.length) {
      return;
    }
    currentQueue.splice(index, 1);
    this.queueSubject.next(currentQueue);
    this.persistSession();
  }

  reorderQueue(fromIndex: number, toIndex: number) {
    const currentQueue = [...this.queueSubject.value];
    if (
      fromIndex < 0 || fromIndex >= currentQueue.length ||
      toIndex < 0 || toIndex >= currentQueue.length ||
      fromIndex === toIndex
    ) {
      return;
    }

    const [moved] = currentQueue.splice(fromIndex, 1);
    currentQueue.splice(toIndex, 0, moved);
    this.queueSubject.next(currentQueue);
    this.persistSession();
  }

  clearQueue() {
    this.queueSubject.next([]);
    this.persistSession();
  }

  private pushRecent(track: PlayerTrack) {
    const nextRecent = [
      { ...track },
      ...this.recentlyPlayedSubject.value.filter((item) => item.src !== track.src)
    ].slice(0, 30);
    this.recentlyPlayedSubject.next(nextRecent);
  }

  private restoreSession() {
    const raw = sessionStorage.getItem(this.sessionKey);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<PlayerSessionState>;
      const currentTrack = this.safeTrack(parsed.currentTrack) || this.defaultTrack;
      const queue = Array.isArray(parsed.queue)
        ? parsed.queue.map((item) => this.safeTrack(item)).filter((item): item is PlayerTrack => !!item)
        : [];
      const recentlyPlayed = Array.isArray(parsed.recentlyPlayed)
        ? parsed.recentlyPlayed.map((item) => this.safeTrack(item)).filter((item): item is PlayerTrack => !!item).slice(0, 30)
        : [];

      this.currentTrackSubject.next(currentTrack);
      this.queueSubject.next(queue);
      this.recentlyPlayedSubject.next(recentlyPlayed);
    } catch {
      sessionStorage.removeItem(this.sessionKey);
    }
  }

  private persistSession() {
    const payload: PlayerSessionState = {
      currentTrack: this.currentTrackSubject.value,
      queue: this.queueSubject.value,
      recentlyPlayed: this.recentlyPlayedSubject.value
    };

    sessionStorage.setItem(this.sessionKey, JSON.stringify(payload));
  }

  private safeTrack(value: any): PlayerTrack | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const title = String(value.title || '').trim();
    const artist = String(value.artist || '').trim();
    const src = String(value.src || '').trim();
    if (!title || !artist || !src) {
      return null;
    }

    return {
      songId: value.songId,
      title,
      artist,
      src,
      coverImage: String(value.coverImage || '').trim()
    };
  }
}
