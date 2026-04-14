import { Component, OnInit } from '@angular/core';
import { SongService } from '../../core/services/song.service';
import { PlayerService } from '../../core/services/player.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  greeting = 'Good evening';
  
  quickPicks = [
    { title: 'Liked Songs',      img: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&q=80', link: '/playlist/liked' },
    { title: 'Daily Mix 1',      img: 'https://images.unsplash.com/photo-1493225457124-a1a2a5f5f4b5?w=300&q=80', link: '/discover' },
    { title: 'Release Radar',    img: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&q=80', link: '/discover' },
    { title: 'Discover Weekly',  img: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&q=80', link: '/discover' },
    { title: 'Repeat Rewind',    img: 'https://images.unsplash.com/photo-1483032469466-b937c425697b?w=300&q=80', link: '/discover' },
    { title: 'Top Hits 2026',    img: 'https://images.unsplash.com/photo-1611078864700-ce1e2fedb2b4?w=300&q=80', link: '/discover' }
  ];

  madeForYou = [
    { title: 'Late Night Focus', description: 'Deep focus, atmospheric beats.', img: 'https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=400&q=80' },
    { title: 'Mega Hit Mix', description: 'A mega mix of 75 favorites.', img: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=400&q=80' },
    { title: 'Chill Vibes', description: 'Kick back to the best new chill tunes.', img: 'https://images.unsplash.com/photo-1520690286581-64a93c6f1a8e?w=400&q=80' },
    { title: 'Are & Be', description: 'The absolute best RnB tracks out right now.', img: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400&q=80' },
    { title: 'New Music Friday', description: 'The best new releases from this week.', img: 'https://images.unsplash.com/photo-1485038101637-2d4833df1b35?w=400&q=80' }
  ];

  trendingSongs: any[] = [];
  trendingLoading = true;

  constructor(
    private songService: SongService,
    private playerService: PlayerService
  ) {}

  ngOnInit() {
    this.updateGreeting();
    this.loadTrending();
  }

  updateGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) this.greeting = 'Good morning';
    else if (hour < 18) this.greeting = 'Good afternoon';
    else this.greeting = 'Good evening';
  }

  loadTrending() {
    this.songService.getTrending(10).subscribe({
      next: (songs) => {
        this.trendingSongs = songs || [];
        this.trendingLoading = false;
      },
      error: () => {
        this.trendingLoading = false;
      }
    });
  }

  playSong(song: any, event: Event) {
    event.stopPropagation();
    this.playerService.playTrack({
      songId: song.id || song.song_id,
      title: song.title,
      artist: song.artist_name || song.artist || 'Unknown Artist',
      src: song.s3_url || song.file_url,
      coverImage: song.cover_url || song.cover_image || ''
    });
    // Record play event to keep trending data fresh
    const id = song.song_id || song.id;
    if (id) this.songService.recordPlay(id);
  }
}
