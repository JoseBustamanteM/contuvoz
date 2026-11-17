import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) {
    router.navigate(['/login']);
    return false;
  }

  // Un adulto con una clave que le dio otra persona debe cambiarla antes de
  // seguir: cualquier página lo lleva al perfil (el servidor, además, le
  // responde 403 a todo lo demás).
  if (authService.usuario()?.debeCambiarClave && !state.url.startsWith('/perfil')) {
    return router.createUrlTree(['/perfil']);
  }
  return true;
};

/** Para /login: con la sesión ya iniciada se vuelve al inicio, en vez de mostrar
 *  el formulario con la barra de usuario encima. */
export const invitadoGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.isLoggedIn() ? router.createUrlTree(['/']) : true;
};
