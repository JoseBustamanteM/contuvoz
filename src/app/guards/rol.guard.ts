import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { Rol } from '../interfaces/rol.enum';

export const rolGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const usuario = authService.usuario();
  const rolesPermitidos = [Rol.ADMINISTRADOR, Rol.ADMIN_COLEGIO, Rol.PROFESOR];

  if (usuario && rolesPermitidos.includes(usuario.idRol)) return true;

  router.navigate(['/']);
  return false;
};
