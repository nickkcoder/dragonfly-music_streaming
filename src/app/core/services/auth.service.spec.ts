import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

function makeToken(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.sig`;
}

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('should clear an expired token during initialization', () => {
    localStorage.setItem('token', makeToken({ exp: Math.floor(Date.now() / 1000) - 60 }));

    service = TestBed.inject(AuthService);

    expect(service.getToken()).toBe('');
    expect(service.isAdmin()).toBeFalse();
  });

  it('should persist token and refresh role on login', () => {
    service = TestBed.inject(AuthService);

    service.login({ email: 'admin@example.com', password: 'secret' }).subscribe();

    const loginRequest = httpMock.expectOne(`${environment.apiBaseUrl}/api/auth/login`);
    loginRequest.flush({
      token: makeToken({ exp: Math.floor(Date.now() / 1000) + 3600 }),
      role: 'user'
    });

    const profileRequest = httpMock.expectOne(`${environment.apiBaseUrl}/api/auth/profile`);
    profileRequest.flush({ role: 'admin' });

    expect(service.getToken()).not.toBe('');
    expect(service.getCurrentRole()).toBe('admin');
    expect(service.isAdmin()).toBeTrue();
  });

  it('should invalidate the session when profile refresh returns 401', () => {
    localStorage.setItem('token', makeToken({ exp: Math.floor(Date.now() / 1000) + 3600 }));

    service = TestBed.inject(AuthService);

    const profileRequest = httpMock.expectOne(`${environment.apiBaseUrl}/api/auth/profile`);
    profileRequest.flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(service.getToken()).toBe('');
    expect(service.getCurrentRole()).toBe('');
    expect(service.isAdmin()).toBeFalse();
  });
});
