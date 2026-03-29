import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = environment.apiBaseUrl.replace(/\/+$/, '');

  constructor(private http: HttpClient) { }

  private buildUrl(endpoint: string): string {
    const cleanEndpoint = endpoint.replace(/^\/+/, '');
    return `${this.apiUrl}/${cleanEndpoint}`;
  }

  getAssetUrl(path?: string | null): string {
    if (!path) {
      return '';
    }

    if (/^https?:\/\//i.test(path)) {
      return path;
    }

    const cleanPath = path.replace(/^\/+/, '');
    return `${this.apiUrl}/${cleanPath}`;
  }

  get<T>(endpoint: string, params?: HttpParams | { [param: string]: string | number | boolean | ReadonlyArray<string | number | boolean> }): Observable<T> {
    return this.http.get<T>(this.buildUrl(endpoint), { params });
  }

  post<T>(endpoint: string, body: unknown, headers?: HttpHeaders | { [header: string]: string | string[] }): Observable<T> {
    return this.http.post<T>(this.buildUrl(endpoint), body, { headers });
  }

  put<T>(endpoint: string, body: unknown, headers?: HttpHeaders | { [header: string]: string | string[] }): Observable<T> {
    return this.http.put<T>(this.buildUrl(endpoint), body, { headers });
  }

  delete<T>(endpoint: string, params?: HttpParams | { [param: string]: string | number | boolean | ReadonlyArray<string | number | boolean> }): Observable<T> {
    return this.http.delete<T>(this.buildUrl(endpoint), { params });
  }
}
