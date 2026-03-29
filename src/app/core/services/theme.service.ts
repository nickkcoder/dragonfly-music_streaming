import { Injectable, Inject, Renderer2, RendererFactory2 } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export type ThemeType = 
  | 'luxury' 
  | 'medieval' 
  | 'blobjects' 
  | 'steampunk' 
  | 'vectoflourish' 
  | 'cleartech';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly themeStorageKey = 'dragofly_theme';
  private renderer: Renderer2;
  private currentTheme: ThemeType = 'luxury';

  constructor(
    @Inject(DOCUMENT) private document: Document,
    rendererFactory: RendererFactory2
  ) {
    this.renderer = rendererFactory.createRenderer(null, null);
    this.initTheme();
  }

  private initTheme(): void {
    const savedTheme = localStorage.getItem(this.themeStorageKey) as ThemeType | null;
    if (savedTheme) {
      this.setTheme(savedTheme);
    } else {
      this.setTheme('luxury'); // Default
    }
  }

  setTheme(theme: ThemeType): void {
    // Remove previous theme class
    this.renderer.removeClass(this.document.body, `theme-${this.currentTheme}`);
    
    // Apply new theme class
    this.currentTheme = theme;
    this.renderer.addClass(this.document.body, `theme-${this.currentTheme}`);
    
    // Persist
    localStorage.setItem(this.themeStorageKey, this.currentTheme);
  }

  getCurrentTheme(): ThemeType {
    return this.currentTheme;
  }
}
