import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { AppComponent } from './app.component';
import { NavbarComponent } from './shared/components/navbar/nav/nav.component';
import { PlayerComponent } from './shared/components/player/player/player.component';
import { AuthService } from './core/services/auth.service';
import { PlayerService } from './core/services/player.service';
import { SongService } from './core/services/song.service';
describe('AppComponent', () => {
  beforeEach(async () => {
    const authServiceStub = {
      isLoggedIn$: of(false),
      role$: of(''),
      isAdmin$: of(false)
    };

    const playerServiceStub = {
      currentTrack$: of({
        title: 'Track',
        artist: 'Artist',
        src: 'assets/audio/test.mp3',
        coverImage: ''
      }),
      queue$: of([]),
      recentlyPlayed$: of([]),
      playRequest$: of()
    };

    const songServiceStub = {
      getLikedSongs: () => of([])
    };

    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        FormsModule
      ],
      declarations: [
        AppComponent,
        NavbarComponent,
        PlayerComponent
      ],
      providers: [
        { provide: AuthService, useValue: authServiceStub },
        { provide: PlayerService, useValue: playerServiceStub },
        { provide: SongService, useValue: songServiceStub }
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have as title 'dragofly'`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('dragofly');
  });

  it('should render app shell', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-nav')).not.toBeNull();
    expect(compiled.querySelector('app-player')).not.toBeNull();
  });
});
