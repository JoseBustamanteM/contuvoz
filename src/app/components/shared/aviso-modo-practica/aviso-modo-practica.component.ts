import { Component, computed, inject } from '@angular/core';
import { AuthService } from '../../../services/auth.service';
import { ActividadesService } from '../../../services/actividades.service';
import { NOMBRE_ROL } from '../../../interfaces/rol.enum';

/** Aviso para los roles que no registran progreso (el backend responde 403).
 *  Sin esto, un Administrador probando una actividad solo veía
 *  "No se pudo guardar", que parece un fallo de la app. */
@Component({
  selector: 'app-aviso-modo-practica',
  standalone: true,
  template: `
    @if (visible()) {
      <div class="aviso" role="status">
        <span aria-hidden="true">👀</span>
        <span>
          <strong>Modo práctica:</strong> entraste como {{ nombreRol() }}, así que tu progreso
          no se guarda. Solo estudiantes y profesores registran resultados.
        </span>
      </div>
    }
  `,
  styleUrl: './aviso-modo-practica.component.scss',
})
export class AvisoModoPracticaComponent {
  private authService = inject(AuthService);
  private actividadesService = inject(ActividadesService);

  visible = computed(
    () => !!this.authService.usuario() && !this.actividadesService.puedeGuardarProgreso(),
  );

  nombreRol = computed(() => {
    const usuario = this.authService.usuario();
    return usuario ? (NOMBRE_ROL[usuario.idRol] ?? usuario.rol.nomRol) : '';
  });
}
