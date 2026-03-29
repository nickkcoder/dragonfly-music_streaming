import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface UserProfile {
  id?: string | number;
  username: string;
  email?: string;
  bio: string;
  accent?: string;
  avatarUrl?: string;
  role?: string;
  roles?: string;   // backend returns this field name
  [key: string]: unknown;
}

export interface UpdateProfilePayload {
  username: string;
  bio: string;
  accent: string;
  avatar?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  constructor(private api: ApiService) {}

  getProfile(): Observable<UserProfile> {
    return this.api.get<UserProfile>('api/auth/profile');
  }

  updateProfile(data: UpdateProfilePayload): Observable<UserProfile> {
    return this.api.put<UserProfile>('api/auth/profile', data);
  }

  logoutBackend(): Observable<unknown> {
    return this.api.post<unknown>('api/auth/logout', {});
  }
}
