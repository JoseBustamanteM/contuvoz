import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const esRutaPublica =
    req.url.includes('/auth/login') ||
    req.url.includes('/auth/refresh') ||
    req.url.includes('/auth/logout');

  const conToken = (peticion: typeof req) => {
    const token = authService.getAccessToken();
    return token && !esRutaPublica
      ? peticion.clone({
          setHeaders: { Authorization: `Bearer ${token}` },
          withCredentials: true,
        })
      : peticion;
  };

  return next(conToken(req)).pipe(
    catchError((error: HttpErrorResponse) => {
      // Solo intervenimos en 401 de rutas protegidas
      if (error.status !== 401 || esRutaPublica) {
        return throwError(() => error);
      }

      return authService.refreshCompartido().pipe(
        switchMap((res) => {
          if (!res) {
            // El refresh también falló: la sesión murió de verdad
            router.navigate(['/login']);
            return throwError(() => error);
          }
          // Reintentamos la original con el token nuevo
          return next(conToken(req));
        }),
      );
    }),
  );
};
