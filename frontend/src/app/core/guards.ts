import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';
import { Rol } from './models';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.autenticado() ? true : inject(Router).createUrlTree(['/login']);
};

/** Guard RBAC: la ruta debe declarar `data: { roles: [...] }`. */
export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const roles = (route.data['roles'] ?? []) as Rol[];
  return roles.length === 0 || auth.tieneRol(...roles) ? true : inject(Router).createUrlTree(['/inicio']);
};
