import { DOCUMENT } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { Router } from '@angular/router';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'dragofly';

  constructor(
    private router: Router,
    private themeService: ThemeService,
    @Inject(DOCUMENT) private document: Document
  ) {}

  get currentRoute(): string {
    return this.router.url;
  }
}
