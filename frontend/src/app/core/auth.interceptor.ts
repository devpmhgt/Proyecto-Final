import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TimeoutError, catchError, throwError, timeout } from 'rxjs';

import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token();
  const peticion = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(peticion).pipe(
    timeout(20_000),
    catchError((err: HttpErrorResponse | TimeoutError) => {
      if (err instanceof TimeoutError) {
        return throwError(() => new HttpErrorResponse({ status: 0, statusText: 'timeout', url: req.url }));
      }
      if (err.status === 401 && !req.url.endsWith('/auth/login')) {
        auth.logout();
      }
      return throwError(() => err);
    }),
  );
};

/** Extrae un mensaje legible de un error de la API (FastAPI devuelve `detail`). */
export function mensajeError(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const detail = err.error?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) return detail.map((d) => `${d.loc?.slice(-1)[0] ?? ''}: ${d.msg}`).join('; ');
    if (err.status === 0) return 'No se pudo conectar con el servidor. Verifique que el backend esté en ejecución.';
    if (err.status >= 500) return 'Error interno del servidor. Revise la consola del backend (¿conexión a MySQL?).';
    return `Error ${err.status}`;
  }
  return 'Error inesperado';
}
