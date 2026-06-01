import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from './auth.store';

export function roleGuard(allowedRoles: string[]): CanActivateFn {
  return () => {
    const auth = inject(AuthStore);
    const router = inject(Router);
    return allowedRoles.includes(auth.role() ?? '')
      ? true
      : router.createUrlTree(['/dashboard']);
  };
}
