import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ArtistRoutingModule } from './artist-routing.module';
import { ArtistComponent } from './artist.component';
import { ArtistDetailComponent } from './artist-detail.component';
import { ArtistReleasesComponent } from './artist-releases.component';

@NgModule({
  declarations: [
    ArtistComponent,
    ArtistDetailComponent,
    ArtistReleasesComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ArtistRoutingModule
  ]
})
export class ArtistModule { }
