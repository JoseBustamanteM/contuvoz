import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { LogoutButtonComponent } from '../logout-button/logout-button.component';
import { NOMBRE_ROL, Rol } from '../../interfaces/rol.enum';

/** Roles que ven "Usuarios": los mismos que deja pasar rolGuard. */
const ROLES_GESTION: readonly number[] = [Rol.ADMINISTRADOR, Rol.ADMIN_COLEGIO, Rol.PROFESOR];

const MS_AVISO_PRONTO = 2200;

@Component({
  selector: 'app-barra-superior',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, LogoutButtonComponent],
  templateUrl: './barra-superior.component.html',
  styleUrl: './barra-superior.component.scss',
})
export class BarraSuperiorComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  usuario = this.authService.usuario;

  /** En el inicio no se muestra "Inicio": ya estás ahí. Reemplaza al botón
   *  flotante que cada página ponía encima de la barra. */
  private url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  enInicio = computed(() => this.url().split('?')[0] === '/');

  esEstudiante = computed(() => this.usuario()?.idRol === Rol.ESTUDIANTE);

  puedeGestionar = computed(() => {
    const u = this.usuario();
    return !!u && ROLES_GESTION.includes(u.idRol);
  });

  iniciales = computed(() => {
    const u = this.usuario();
    return u ? `${u.primerNombre.charAt(0)}${u.aPaterno.charAt(0)}`.toUpperCase() : '';
  });

  nombreRol = computed(() => {
    const u = this.usuario();
    return u ? (NOMBRE_ROL[u.idRol] ?? u.rol.nomRol) : '';
  });

  /** Biblioteca y Perfil todavía no tienen página: en vez de un botón que no
   *  hace nada, el gecko avisa que vienen pronto. */
  avisoPronto = signal<string | null>(null);
  private timerPronto?: ReturnType<typeof setTimeout>;

  pronto(seccion: string) {
    this.avisoPronto.set(`¡${seccion} llega muy pronto!`);
    clearTimeout(this.timerPronto);
    this.timerPronto = setTimeout(() => this.avisoPronto.set(null), MS_AVISO_PRONTO);
  }
}
