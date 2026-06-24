import { CanMatchFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

export const moduleGuard = (moduleCode: string, permissionCode?: string): CanMatchFn => {
    return () => {
        const auth = inject(AuthService);
        const router = inject(Router);

        if (!auth.isLoggedIn()) {
            router.navigate(['/login']);
            return false;
        }

        if (!auth.can(moduleCode, permissionCode)) {
            router.navigate(['/sin-acceso']);
            return false;
        }

        return true;
    };
};
