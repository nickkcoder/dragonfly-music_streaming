import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PlaylistRoutingModule } from './playlist-routing.module';
import { PlaylistDetailComponent } from './playlist-detail.component';
import { LikedSongsComponent } from './liked-songs.component';

@NgModule({
  declarations: [PlaylistDetailComponent, LikedSongsComponent],
  imports: [
    CommonModule,
    RouterModule,
    PlaylistRoutingModule
  ]
})
export class PlaylistModule { }
