import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DiscoverRoutingModule } from './discover-routing.module';
import { DiscoverComponent } from './discover.component';

@NgModule({
  declarations: [DiscoverComponent],
  imports: [
    CommonModule,
    FormsModule,
    DiscoverRoutingModule
  ]
})
export class DiscoverModule { }
