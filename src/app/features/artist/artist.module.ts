import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ArtistRoutingModule } from './artist-routing.module';
import { ArtistComponent } from './artist.component';
import { ArtistDetailComponent } from './artist-detail.component';
import { ArtistReleasesComponent } from './artist-releases.component';
import { AlbumDetailComponent } from './album-detail.component';

@NgModule({
  declarations: [
    ArtistComponent,
    ArtistDetailComponent,
    ArtistReleasesComponent,
    AlbumDetailComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    ArtistRoutingModule
  ]
})
export class ArtistModule { }

