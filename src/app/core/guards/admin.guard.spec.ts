import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { AdminGuard } from './admin.guard';
import { AuthService } from '../services/auth.service';

describe('AdminGuard', () => {
  let guard: AdminGuard;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [
        {
          provide: AuthService,
          useValue: {
            resolveAdminAccess: jasmine.createSpy('resolveAdminAccess')
          }
        }
      ]
    });

    guard = TestBed.inject(AdminGuard);
    router = TestBed.inject(Router);
  });

  it('should allow access for admins', (done) => {
    const authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    authService.resolveAdminAccess.and.returnValue(of(true));

    guard.canActivate().subscribe((result) => {
      expect(result).toBeTrue();
      done();
    });
  });

  it('should redirect non-admin users to home', (done) => {
    const authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    authService.resolveAdminAccess.and.returnValue(of(false));

    guard.canActivate().subscribe((result) => {
      expect(result).toEqual(router.parseUrl('/home'));
      done();
    });
  });
});
