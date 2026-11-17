import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Rol } from '../../interfaces/rol.enum';

/**
 * Pestañas "Mis logros | Mi perfil" arriba de ambas páginas: para el
 * estudiante son dos caras de lo mismo (lo que logró y quién es). Los
 * adultos no tienen Mis logros, así que no ven nada.
 */
@Component({
  selector: 'app-pestanas-estudiante',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    @if (esEstudiante()) {
      <nav class="pestanas" aria-label="Mis logros y mi perfil">
        <a routerLink="/mis-logros" routerLinkActive="activa" ariaCurrentWhenActive="page" class="pestana">
          <span aria-hidden="true">⭐</span> Mis logros
        </a>
        <a routerLink="/perfil" routerLinkActive="activa" ariaCurrentWhenActive="page" class="pestana">
          <span aria-hidden="true">🦎</span> Mi perfil
        </a>
      </nav>
    }
  `,
  styles: `
    .pestanas {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.25rem;
      padding: 0.3rem;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.75);
      font-family: 'Nunito', system-ui, sans-serif;
    }
    .pestana {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      min-height: 44px;
      border-radius: 999px;
      color: #047857;
      font-weight: 900;
      text-decoration: none;
    }
    .pestana:focus-visible { outline: 3px solid #34d399; outline-offset: 2px; }
    .pestana.activa { background: #10b981; color: #fff; box-shadow: 0 3px 0 #047857; }
  `,
})
export class PestanasEstudianteComponent {
  private authService = inject(AuthService);
  esEstudiante = computed(() => this.authService.usuario()?.idRol === Rol.ESTUDIANTE);
}
