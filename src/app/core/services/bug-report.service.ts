import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '../../services/api.service';

export interface BugReportPayload {
  message: string;
  email?: string;
  page_url: string;
  user_agent: string;
  reported_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class BugReportService {
  constructor(private api: ApiService) {}

  report(payload: BugReportPayload): Observable<unknown> {
    return this.tryPost([
      'api/bugs/report',
      'api/bug-reports',
      'api/report-bug',
      'api/feedback/bug'
    ], payload);
  }

  private tryPost<T>(endpoints: string[], body: unknown): Observable<T> {
    const [current, ...next] = endpoints;
    if (!current) {
      return throwError(() => new Error('No bug report endpoint available.'));
    }

    return this.api.post<T>(current, body).pipe(
      catchError((err) => {
        if (!next.length || err?.status !== 404) {
          return throwError(() => err);
        }
        return this.tryPost<T>(next, body);
      })
    );
  }
}
