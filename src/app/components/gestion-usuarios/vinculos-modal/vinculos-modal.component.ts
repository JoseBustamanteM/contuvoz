import { Component, computed, inject, input, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../../services/auth.service';
import { VinculosService } from '../../../services/vinculos.service';
import {
  TipoVinculo, UsuarioListado, VinculoDetalle, VinculoResumen,
} from '../../../interfaces/usuario-gestion.interface';
import { Rol } from '../../../interfaces/rol.enum';

interface Seccion {
  tipo: TipoVinculo;
  titulo: string;
  icono: string;
  singular: string;
  rolAdulto: Rol;
}

const SECCIONES: Seccion[] = [
  { tipo: 'PROFESOR', titulo: 'Profesores', icono: '👩‍🏫', singular: 'profesor', rolAdulto: Rol.PROFESOR },
  { tipo: 'APODERADO', titulo: 'Apoderados', icono: '👪', singular: 'apoderado', rolAdulto: Rol.APODERADO },
];

/**
 * Vínculos de un estudiante. Los botones siguen las mismas reglas que el
 * backend (que es quien de verdad las aplica):
 * - Agregar profesor: solo admins.
 * - Agregar apoderado: admins, o el profesor del alumno.
 * - Quitar: admins cualquiera; un profesor solo los apoderados que vinculó él.
 */
@Component({
  selector: 'vinculos-modal',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './vinculos-modal.component.html',
  styleUrl: './vinculos-modal.component.scss',
  host: { '(document:keydown.escape)': 'intentarCerrar()' },
})
export class VinculosModalComponent {
  private authService = inject(AuthService);
  private vinculosService = inject(VinculosService);

  /** El estudiante, ya actualizado por la página tras cada cambio. */
  estudiante = input.required<UsuarioListado>();
  /** Todos los usuarios cargados en la página: de ahí salen los candidatos. */
  usuarios = input.required<UsuarioListado[]>();

  cambiado = output<string>();
  cerrado = output<void>();

  readonly secciones = SECCIONES;

  private yo = this.authService.usuario;
  esAdmin = computed(() => {
    const rol = this.yo()?.idRol;
    return rol === Rol.ADMINISTRADOR || rol === Rol.ADMIN_COLEGIO;
  });

  private vigentes = computed(() => this.estudiante().vinculosComoEstudiante ?? []);

  esProfesorDelAlumno = computed(() =>
    this.vigentes().some((v) => v.tipoVinculo === 'PROFESOR' && v.adulto.idUsuario === this.yo()?.idUsuario),
  );

  /** Formulario "agregar" abierto (uno a la vez) y el adulto elegido. */
  agregando = signal<TipoVinculo | null>(null);
  elegido = signal<number>(0);

  /** Vínculo que se va a quitar, esperando confirmación. */
  quitando = signal<VinculoResumen | null>(null);

  guardando = signal(false);
  error = signal<string | null>(null);

  historial = signal<VinculoDetalle[] | null>(null);
  cargandoHistorial = signal(false);

  vigentesDe(tipo: TipoVinculo) {
    return this.vigentes().filter((v) => v.tipoVinculo === tipo);
  }

  puedeAgregar(tipo: TipoVinculo): boolean {
    if (!this.estudiante().activo) return false;
    return tipo === 'PROFESOR' ? this.esAdmin() : this.esAdmin() || this.esProfesorDelAlumno();
  }

  puedeQuitar(v: VinculoResumen): boolean {
    const yo = this.yo();
    if (!yo) return false;
    if (this.esAdmin()) return true;
    return yo.idRol === Rol.PROFESOR && v.tipoVinculo === 'APODERADO' && v.creadoPor === yo.idUsuario;
  }

  /** Adultos que se pueden vincular: rol correcto, activos, del mismo colegio
   *  y que no estén ya vinculados (el backend lo rechazaría con 409). */
  candidatos(seccion: Seccion) {
    const est = this.estudiante();
    const yaVinculados = new Set(this.vigentesDe(seccion.tipo).map((v) => v.adulto.idUsuario));
    return this.usuarios()
      .filter(
        (u) =>
          u.idRol === seccion.rolAdulto &&
          u.activo &&
          u.idColegio === est.idColegio &&
          !yaVinculados.has(u.idUsuario),
      )
      .sort((a, b) => `${a.primerNombre} ${a.aPaterno}`.localeCompare(`${b.primerNombre} ${b.aPaterno}`));
  }

  iniciales(p: { primerNombre: string; aPaterno: string }) {
    return `${p.primerNombre.charAt(0)}${p.aPaterno.charAt(0)}`.toUpperCase();
  }

  // ── Agregar ────────────────────────────────────────────
  abrirAgregar(tipo: TipoVinculo) {
    this.quitando.set(null);
    this.error.set(null);
    this.elegido.set(0);
    this.agregando.set(tipo);
  }

  confirmarAgregar(seccion: Seccion) {
    const idAdulto = this.elegido();
    if (!idAdulto) return;
    const adulto = this.usuarios().find((u) => u.idUsuario === idAdulto);

    this.guardando.set(true);
    this.error.set(null);
    this.vinculosService.crear(this.estudiante().idUsuario, idAdulto, seccion.tipo).subscribe({
      next: () => {
        this.guardando.set(false);
        this.agregando.set(null);
        this.historial.set(null);
        this.cambiado.emit(
          `${adulto?.primerNombre} ${adulto?.aPaterno} quedó como ${seccion.singular} de ${this.estudiante().primerNombre}.`,
        );
      },
      error: (err: HttpErrorResponse) => this.fallo(err),
    });
  }

  // ── Quitar ─────────────────────────────────────────────
  pedirQuitar(v: VinculoResumen) {
    this.agregando.set(null);
    this.error.set(null);
    this.quitando.set(v);
  }

  confirmarQuitar() {
    const v = this.quitando();
    if (!v) return;

    this.guardando.set(true);
    this.error.set(null);
    this.vinculosService.deshabilitar(v.idVinculo).subscribe({
      next: () => {
        this.guardando.set(false);
        this.quitando.set(null);
        this.historial.set(null);
        const seccion = SECCIONES.find((s) => s.tipo === v.tipoVinculo)!;
        this.cambiado.emit(
          `${v.adulto.primerNombre} ${v.adulto.aPaterno} ya no es ${seccion.singular} de ${this.estudiante().primerNombre}.`,
        );
      },
      error: (err: HttpErrorResponse) => this.fallo(err),
    });
  }

  // ── Historial (admins) ─────────────────────────────────
  verHistorial() {
    if (this.historial()) {
      this.historial.set(null);
      return;
    }
    this.cargandoHistorial.set(true);
    this.vinculosService.listarDeEstudiante(this.estudiante().idUsuario, true).subscribe({
      next: (data) => {
        this.cargandoHistorial.set(false);
        this.historial.set(data);
      },
      error: (err: HttpErrorResponse) => {
        this.cargandoHistorial.set(false);
        this.fallo(err);
      },
    });
  }

  nombreTipo(tipo: TipoVinculo) {
    return SECCIONES.find((s) => s.tipo === tipo)!.singular;
  }

  intentarCerrar() {
    if (this.guardando()) return;
    // Escape primero cancela la confirmación o el formulario abierto.
    if (this.quitando()) return this.quitando.set(null);
    if (this.agregando()) return this.agregando.set(null);
    this.cerrado.emit();
  }

  private fallo(err: HttpErrorResponse) {
    this.guardando.set(false);
    if (err.status === 0) {
      this.error.set('No pudimos conectar con el servidor. Revisa tu conexión.');
      return;
    }
    const mensaje = err.error?.message;
    this.error.set(
      Array.isArray(mensaje) ? mensaje.join('. ')
      : typeof mensaje === 'string' ? mensaje
      : 'No se pudo guardar el cambio. Inténtalo de nuevo.',
    );
  }
}
