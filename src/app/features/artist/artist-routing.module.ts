import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ArtistComponent } from './artist.component';
import { ArtistDetailComponent } from './artist-detail.component';
import { ArtistReleasesComponent } from './artist-releases.component';

const routes: Routes = [
  { path: '', component: ArtistComponent },
  { path: 'releases', component: ArtistReleasesComponent },
  { path: ':id', component: ArtistDetailComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ArtistRoutingModule { }
