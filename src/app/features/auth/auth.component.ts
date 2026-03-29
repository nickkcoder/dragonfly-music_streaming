import { DOCUMENT } from '@angular/common';
import { Component, Inject, OnDestroy, OnInit, Renderer2, RendererFactory2 } from '@angular/core';
import { Router } from '@angular/router';
import { switchMap } from 'rxjs/operators';
import { AuthService, LoginCredentials, RegisterPayload } from '../../core/services/auth.service';

@Component({
  selector: 'app-auth',
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.css']
})
export class AuthComponent implements OnInit, OnDestroy {
  private readonly renderer: Renderer2;

  isLogin = true;
  showPassword = false;
  particles = Array(25);
  cardTransform = 'rotateX(0deg) rotateY(0deg)';

  loginData: LoginCredentials = { email: '', password: '' };
  registerData: RegisterPayload = { username: '', email: '', password: '' };
  errorMessage = '';

  constructor(
    private router: Router,
    private authService: AuthService,
    rendererFactory: RendererFactory2,
    @Inject(DOCUMENT) private document: Document
  ) {
    this.renderer = rendererFactory.createRenderer(null, null);
  }

  ngOnInit() {
    this.setPageScrollLock(true);
  }

  ngOnDestroy(): void {
    this.setPageScrollLock(false);
  }

  toggleMode() {
    this.isLogin = !this.isLogin;
    this.errorMessage = '';
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  close() {
    this.setPageScrollLock(false);
    this.router.navigate(['/home']);
  }

  submit() {
    this.errorMessage = '';

    if (this.isLogin) {
      this.authService.login(this.loginData).subscribe({
        next: () => {
          this.close();
        },
        error: (err) => {
          this.errorMessage = err.error?.message || 'Login failed. Please try again.';
        }
      });
      return;
    }

    const { email, password } = this.registerData;

    this.authService.register(this.registerData).pipe(
      switchMap(() => this.authService.login({ email, password }))
    ).subscribe({
      next: () => {
        this.close();
      },
      error: (err) => {
        // If login after register fails, fall back to the login form pre-filled
        this.isLogin = true;
        this.loginData.email = email;
        this.errorMessage = err.error?.message || 'Registration successful! Please log in.';
      }
    });
  }

  handleMouseMove(event: MouseEvent) {
    const card = event.currentTarget as HTMLElement;
    const rect = card.getBoundingClientRect();

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * 8;
    const rotateY = ((x - centerX) / centerX) * -8;

    this.cardTransform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  }

  resetTilt() {
    this.cardTransform = 'rotateX(0deg) rotateY(0deg)';
  }

  magnetic(event: MouseEvent) {
    const button = event.currentTarget as HTMLElement;
    const rect = button.getBoundingClientRect();

    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;

    this.renderer.setStyle(button, 'transform', `translate(${x * 0.3}px, ${y * 0.3}px)`);
  }

  resetMagnetic(event: MouseEvent) {
    const button = event.currentTarget as HTMLElement;
    this.renderer.setStyle(button, 'transform', 'translate(0px, 0px)');
  }

  private setPageScrollLock(locked: boolean) {
    const overflow = locked ? 'hidden' : '';
    this.renderer.setStyle(this.document.body, 'overflow', overflow);
    this.renderer.setStyle(this.document.documentElement, 'overflow', overflow);
  }
}
