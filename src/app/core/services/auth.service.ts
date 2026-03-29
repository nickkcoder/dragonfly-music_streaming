import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, shareReplay, tap, throwError } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
import { ApiService } from '../../services/api.service';

interface AuthProfileResponse {
  role?: unknown;
  user_role?: unknown;
  role_name?: unknown;
  user?: {
    role?: unknown;
    user_role?: unknown;
    role_name?: unknown;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface AuthResponse {
  token?: string;
  role?: unknown;
  user_role?: unknown;
  role_name?: unknown;
  user?: AuthProfileResponse['user'];
  data?: {
    role?: unknown;
    user_role?: unknown;
    role_name?: unknown;
    user?: AuthProfileResponse['user'];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly tokenStorageKey = 'token';
  private readonly roleStorageKey = 'role';
  private loggedInSubject = new BehaviorSubject<boolean>(this.hasToken());
  private roleSubject = new BehaviorSubject<string>(this.resolveRole());
  private adminSubject = new BehaviorSubject<boolean>(this.resolveIsAdmin());
  private refreshRoleRequest$?: Observable<string>;
  isLoggedIn$ = this.loggedInSubject.asObservable();
  role$ = this.roleSubject.asObservable();
  isAdmin$ = this.adminSubject.asObservable();

  constructor(private api: ApiService) {
    if (!this.hasValidToken()) {
      this.invalidateSession();
      return;
    }

    this.syncSubjects();

    if (this.hasToken()) {
      this.refreshRoleFromProfile().subscribe({
        error: () => {
          // Session invalidation is handled in refreshRoleFromProfile.
        }
      });
    }
  }

  getToken(): string {
    return localStorage.getItem(this.tokenStorageKey) || '';
  }

  register(userData: RegisterPayload): Observable<AuthResponse> {
    return this.api.post<AuthResponse>('api/auth/register', userData);
  }

  login(credentials: LoginCredentials): Observable<AuthResponse> {
    return this.api.post<AuthResponse>('api/auth/login', credentials).pipe(
      tap((response) => {
        if (response?.token) {
          this.persistSession(response.token, this.extractRole(response));
          this.refreshRoleFromProfile(true).subscribe({
            error: () => {
              // Session invalidation is handled in refreshRoleFromProfile.
            }
          });
        }
      })
    );
  }

  isAdmin(): boolean {
    return this.adminSubject.value;
  }

  getCurrentRole(): string {
    return this.roleSubject.value;
  }

  logout(): void {
    this.invalidateSession();
  }

  invalidateSession(): void {
    localStorage.removeItem(this.tokenStorageKey);
    localStorage.removeItem(this.roleStorageKey);
    sessionStorage.clear();
    this.syncSubjects();
  }

  resolveAdminAccess(): Observable<boolean> {
    if (!this.hasValidToken()) {
      this.invalidateSession();
      return of(false);
    }

    if (this.isAdmin()) {
      return of(true);
    }

    return this.refreshRoleFromProfile(true).pipe(
      map(() => this.isAdmin()),
      catchError(() => of(false))
    );
  }

  private hasToken(): boolean {
    return !!this.getToken();
  }

  private resolveIsAdmin(): boolean {
    return this.resolveRole() === 'admin';
  }

  private resolveRole(): string {
    const token = this.getToken();
    const roleFromToken = this.getRoleFromToken(token);
    const roleFromStorage = this.normalizeRoleValue(localStorage.getItem(this.roleStorageKey));
    return roleFromToken || roleFromStorage;
  }

  private extractRole(response: AuthResponse | AuthProfileResponse | null | undefined): string {
    const user = response?.user as Record<string, unknown> | undefined;
    const userRole = user?.['role'] as Record<string, unknown> | undefined;
    const data = response?.data as {
      role?: unknown;
      user_role?: unknown;
      role_name?: unknown;
      user?: Record<string, unknown>;
    } | undefined;
    const dataUserRole = data?.user?.['role'] as Record<string, unknown> | undefined;

    const roleFromResponse =
      this.normalizeRoleValue(response?.role) ||
      this.normalizeRoleValue(response?.user_role) ||
      this.normalizeRoleValue(response?.role_name) ||
      this.normalizeRoleValue(user?.['role']) ||
      this.normalizeRoleValue(user?.['user_role']) ||
      this.normalizeRoleValue(user?.['role_name']) ||
      this.normalizeRoleValue(userRole?.['name']) ||
      this.normalizeRoleValue(userRole?.['role_name']) ||
      this.normalizeRoleValue(data?.role) ||
      this.normalizeRoleValue(data?.user_role) ||
      this.normalizeRoleValue(data?.role_name) ||
      this.normalizeRoleValue(data?.user?.['role']) ||
      this.normalizeRoleValue(dataUserRole?.['name']) ||
      this.normalizeRoleValue(dataUserRole?.['role_name']);

    return roleFromResponse || this.getRoleFromToken(typeof response?.token === 'string' ? response.token : undefined);
  }

  private getRoleFromToken(token: string | null | undefined): string {
    const payload = token ? this.parseTokenPayload(token) : null;
    if (!payload) {
      return '';
    }

    const roleFromPayload =
      this.normalizeRoleValue(payload['role']) ||
      this.normalizeRoleValue(payload['roles']) ||
      this.normalizeRoleValue(payload['user_role']) ||
      this.normalizeRoleValue(payload['role_name']) ||
      this.normalizeRoleValue((payload['user'] as Record<string, unknown> | undefined)?.['role']) ||
      this.normalizeRoleValue((payload['user'] as Record<string, unknown> | undefined)?.['role_name']) ||
      this.normalizeRoleValue((payload['roles'] as unknown[] | undefined)?.[0]) ||
      (payload['is_admin'] ? 'admin' : '');

    return roleFromPayload;
  }

  private refreshRoleFromProfile(force = false): Observable<string> {
    if (!this.hasToken()) {
      return of('');
    }

    if (this.refreshRoleRequest$ && !force) {
      return this.refreshRoleRequest$;
    }

    this.refreshRoleRequest$ = this.api.get<AuthProfileResponse>('api/auth/profile').pipe(
      map((profile) => {
        const role = this.extractRole({ user: profile.user ?? profile, role: profile.role });
        this.persistRole(role);
        return role;
      }),
      catchError((err) => {
        if (err?.status === 401 || err?.status === 403) {
          this.invalidateSession();
        } else {
          this.syncSubjects();
        }
        return throwError(() => err);
      }),
      finalize(() => {
        this.refreshRoleRequest$ = undefined;
      }),
      shareReplay(1)
    );

    return this.refreshRoleRequest$;
  }

  private persistSession(token: string, role: string): void {
    localStorage.setItem(this.tokenStorageKey, token);
    this.persistRole(role);
  }

  private persistRole(role: string): void {
    if (role) {
      localStorage.setItem(this.roleStorageKey, role);
    } else {
      localStorage.removeItem(this.roleStorageKey);
    }
    this.syncSubjects();
  }

  private syncSubjects(): void {
    this.loggedInSubject.next(this.hasToken());
    this.roleSubject.next(this.resolveRole());
    this.adminSubject.next(this.resolveIsAdmin());
  }

  private hasValidToken(): boolean {
    const token = this.getToken();
    if (!token) {
      return false;
    }

    const expiry = this.getTokenExpiry(token);
    return expiry === null || expiry > Date.now();
  }

  private getTokenExpiry(token: string): number | null {
    const payload = this.parseTokenPayload(token);
    const exp = Number(payload?.['exp']);
    return Number.isFinite(exp) && exp > 0 ? exp * 1000 : null;
  }

  private parseTokenPayload(token: string): Record<string, unknown> | null {
    const parts = token.split('.');
    if (parts.length < 2) {
      return null;
    }

    try {
      const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = payloadBase64.padEnd(Math.ceil(payloadBase64.length / 4) * 4, '=');
      return JSON.parse(atob(padded)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private normalizeRoleValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'object') {
      const nested = (
        value as {
          name?: unknown;
          role_name?: unknown;
          role?: unknown;
          user_role?: unknown;
        }
      );
      return this.normalizeRoleValue(
        nested.name ??
        nested.role_name ??
        nested.role ??
        nested.user_role
      );
    }

    const normalized = String(value).trim().toLowerCase();
    if (!normalized || normalized === 'guest' || normalized === 'null' || normalized === 'undefined') {
      return '';
    }

    return this.canonicalizeRole(normalized);
  }

  private canonicalizeRole(role: string): string {
    if (role === 'a' || role === 'adm' || role === 'administrator') {
      return 'admin';
    }

    if (role === 'u') {
      return 'user';
    }

    if (role === 'ar' || role === 'art') {
      return 'artist';
    }

    return role;
  }
}
