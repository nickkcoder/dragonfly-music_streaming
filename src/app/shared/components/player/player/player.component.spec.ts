import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { PlayerComponent } from './player.component';
import { PlayerService } from '../../../../core/services/player.service';
import { SongService } from '../../../../core/services/song.service';

describe('PlayerComponent', () => {
  let component: PlayerComponent;
  let fixture: ComponentFixture<PlayerComponent>;

  beforeEach(async () => {
    const playerServiceStub = {
      currentTrack$: of({
        title: 'Track',
        artist: 'Artist',
        src: 'assets/audio/test.mp3',
        coverImage: ''
      }),
      queue$: of([]),
      recentlyPlayed$: of([]),
      playRequest$: of(),
      popNextTrack: () => null,
      removeFromQueue: () => undefined,
      playTrack: () => undefined,
      reorderQueue: () => undefined,
      addToQueue: () => undefined,
      playNext: () => undefined
    };

    const songServiceStub = {
      likeSong: () => of({}),
      unlikeSong: () => of({}),
      getLikedSongs: () => of([])
    };

    await TestBed.configureTestingModule({
      declarations: [ PlayerComponent ],
      providers: [
        { provide: PlayerService, useValue: playerServiceStub },
        { provide: SongService, useValue: songServiceStub }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlayerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
