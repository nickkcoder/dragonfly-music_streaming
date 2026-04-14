import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PlaylistDetailComponent } from './playlist-detail.component';
import { LikedSongsComponent } from './liked-songs.component';

const routes: Routes = [
  { path: 'liked', component: LikedSongsComponent },
  { path: ':id', component: PlaylistDetailComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PlaylistRoutingModule { }
