import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { LoginRequest, LoginResponse, RefreshResponse, MeResponse } from '@tempora/shared';
import { ApiService } from '../http/api.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);

  login(dto: LoginRequest): Observable<LoginResponse> {
    return this.api.post<LoginResponse>('/auth/login', dto);
  }

  refresh(): Observable<RefreshResponse> {
    return this.api.post<RefreshResponse>('/auth/refresh', {});
  }

  logout(): Observable<void> {
    return this.api.post<void>('/auth/logout', {});
  }

  me(): Observable<MeResponse> {
    return this.api.get<MeResponse>('/auth/me');
  }
}
