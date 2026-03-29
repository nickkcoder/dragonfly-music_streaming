import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpErrorResponse,
  HttpHandler,
  HttpInterceptor,
  HttpRequest
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = localStorage.getItem('token');
    const apiBaseUrl = environment.apiBaseUrl.replace(/\/+$/, '');
    const mediaBaseUrl = environment.mediaBaseUrl.replace(/\/+$/, '');
    const isApiRequest = req.url.startsWith(apiBaseUrl);
    const isMediaRequest = req.url.startsWith(mediaBaseUrl);
    const isAuthBootstrapRequest =
      req.url.includes('/api/auth/login') ||
      req.url.includes('/api/auth/register');

    if (!token || (!isApiRequest && !isMediaRequest) || isAuthBootstrapRequest) {
      return next.handle(req);
    }

    const authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });

    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401 || error.status === 403) {
          localStorage.removeItem('token');
          localStorage.removeItem('role');
          sessionStorage.clear();
        }
        return throwError(() => error);
      })
    );
  }
}
