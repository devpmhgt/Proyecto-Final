import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

import { Rol, TokenResponse, Usuario } from './models';

const TOKEN_KEY = 'saiu.token';
const USER_KEY = 'saiu.usuario';

function leer<T>(clave: string): T | null {
  try {
    const v = localStorage.getItem(clave);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly token = signal<string | null>(leer<string>(TOKEN_KEY));
  readonly usuario = signal<Usuario | null>(leer<Usuario>(USER_KEY));
  readonly autenticado = computed(() => !!this.token() && !this.expirado());
  readonly rol = computed(() => this.usuario()?.rol ?? null);

  login(email: string, password: string): Observable<TokenResponse> {
    return this.http.post<TokenResponse>('/api/auth/login', { email, password }).pipe(
      tap((r) => {
        this.token.set(r.access_token);
        this.usuario.set(r.usuario);
        localStorage.setItem(TOKEN_KEY, JSON.stringify(r.access_token));
        localStorage.setItem(USER_KEY, JSON.stringify(r.usuario));
      }),
    );
  }

  logout(): void {
    this.token.set(null);
    this.usuario.set(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.router.navigate(['/login']);
  }

  tieneRol(...roles: Rol[]): boolean {
    const r = this.rol();
    return r !== null && roles.includes(r);
  }

  private expirado(): boolean {
    const t = this.token();
    if (!t) return true;
    try {
      const payload = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return typeof payload.exp === 'number' && payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }
}
