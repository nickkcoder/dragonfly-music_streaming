import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { ArtistService } from '../../core/services/artist.service';

@Component({
  selector: 'app-artists',
  templateUrl: './artist.component.html',
  styleUrls: ['./artist.component.css']
})
export class ArtistComponent implements OnInit {

  searchTerm = '';

  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
    private artistService: ArtistService
  ) {
    this.route.queryParams.subscribe(params => {
      this.searchTerm = (params['q'] ?? '').toString();
    });
  }

  artists: Array<{ id: string; name: string; genre: string; image: string }> = [];

  get filteredArtists() {
    return this.artists.filter(artist =>
      artist.name.toLowerCase().includes(this.searchTerm.toLowerCase())
    );
  }

  ngOnInit(): void {
    this.artistService.getArtists().subscribe({
      next: (data) => {
        const list = Array.isArray(data) ? data : [];
        this.artists = list.map(backendArtist => ({
          id: String(backendArtist.artist_id ?? backendArtist.id ?? ''),
          name: backendArtist.artist_name ?? backendArtist.name ?? 'Unknown Artist',
          genre: backendArtist.genre || backendArtist.bio || 'Unknown Genre',
          image: backendArtist.img_url
            ? this.api.getAssetUrl(backendArtist.img_url)
            : 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce'
        }));
      },
      error: (err) => {
        console.error("Error fetching artists:", err);
      }
    });
  }

}
