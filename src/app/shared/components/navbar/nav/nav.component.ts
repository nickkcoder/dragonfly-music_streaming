import { Component, HostListener, OnDestroy, Renderer2 } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-nav',
  templateUrl: './nav.component.html',
  styleUrls: ['./nav.component.css']
})
export class NavbarComponent implements OnDestroy {
  isLoggedIn$ = this.authService.isLoggedIn$;
  role$ = this.authService.role$;
  isAdmin$ = this.authService.isAdmin$;
  isArtistOrAdmin$ = this.role$.pipe(map(route => route === 'artist' || route === 'admin'));
  isDiscoverRoute = false;
  private routerEventsSub: Subscription;

  constructor(
    private router: Router,
    private authService: AuthService,
    private renderer: Renderer2
  ) {
    this.updateRouteState(this.router.url);
    this.routerEventsSub = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.updateRouteState(event.urlAfterRedirects);
      }
    });
  }
  isScrolled = false;
  menuRotation = 0;
  mobileOpen = false;
  searchQuery: string = '';


  // -----------------------------
  // Search
  // -----------------------------
  searchActive = false;

  toggleSearch() {
    if (this.isDiscoverRoute) {
      return;
    }
    this.searchActive = !this.searchActive;
  }

  onSearch() {
    const query = this.searchQuery?.trim();
    this.router.navigate(['/artist'], {
      queryParams: query ? { q: query } : {}
    });
    this.searchActive = false;
    this.mobileOpen = false;
  }

  // -----------------------------
  // Scroll detection for navbar
  // -----------------------------
  @HostListener('window:scroll', [])
  onWindowScroll() {
    this.isScrolled = window.scrollY > 50;
  }

  // -----------------------------
  // Mobile menu toggle
  // -----------------------------
  toggleMobile() {
    this.mobileOpen = !this.mobileOpen;
  }

  onMenuScroll(event: Event) {
    const target = event.target as HTMLElement;
    // Scroll down moves negative, meaning top tilts back
    this.menuRotation = target.scrollTop * -0.25;
  }

  // -----------------------------
  // Magnetic logo effect
  // -----------------------------
  magnet(event: MouseEvent) {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;

    this.renderer.setStyle(target, 'transform', `translate(${x * 0.15}px, ${y * 0.15}px)`);
  }

  resetMagnet(event: MouseEvent) {
    const target = event.currentTarget as HTMLElement;
    this.renderer.setStyle(target, 'transform', 'translate(0, 0)');
  }

  shouldShowRoleBadge(role: string | null | undefined, isAdmin: boolean | null | undefined): boolean {
    return this.getRoleBadgeLabel(role, isAdmin).length > 0;
  }

  getRoleBadgeLabel(role: string | null | undefined, isAdmin: boolean | null | undefined): string {
    if (isAdmin) {
      return 'ADMIN';
    }

    const value = (role || '').toLowerCase();
    if (value === 'artist') {
      return 'ARTIST';
    }
    if (value) {
      return value.toUpperCase();
    }

    return '';
  }

  getRoleBadgeClass(label: string): string {
    const value = label.toLowerCase();
    if (value === 'admin') {
      return 'admin';
    }
    if (value === 'artist') {
      return 'artist';
    }
    return 'generic';
  }

  private updateRouteState(url: string) {
    this.isDiscoverRoute = url.startsWith('/discover');
    if (this.isDiscoverRoute) {
      this.searchActive = false;
    }
  }

  ngOnDestroy(): void {
    this.routerEventsSub.unsubscribe();
  }

}
