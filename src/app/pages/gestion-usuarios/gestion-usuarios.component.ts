import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { UsuariosService } from '../../services/usuarios.service';
import { AuthService } from '../../services/auth.service';
import { UsuarioListado } from '../../interfaces/usuario-gestion.interface';
import { NOMBRE_ROL, ROLES_GESTIONABLES, Rol } from '../../interfaces/rol.enum';
import { UsuarioFormComponent } from '../../components/gestion-usuarios/usuario-form/usuario-form.component';
import { formatearRut, limpiarRut } from '../../validators/rut.validator';

/** Clase de color por rol, para las etiquetas de la tabla y los filtros. */
const CLASE_ROL: Record<number, string> = {
  [Rol.ADMINISTRADOR]: 'rol--admin',
  [Rol.ADMIN_COLEGIO]: 'rol--admin-colegio',
  [Rol.PROFESOR]: 'rol--profesor',
  [Rol.APODERADO]: 'rol--apoderado',
  [Rol.ESTUDIANTE]: 'rol--estudiante',
};

const MS_AVISO_EXITO = 3500;

@Component({
  selector: 'app-gestion-usuarios',
  standalone: true,
  imports: [UsuarioFormComponent],
  templateUrl: './gestion-usuarios.component.html',
  styleUrls: ['./gestion-usuarios.component.scss'],
  host: { '(document:keydown.escape)': 'cancelarConfirmacion()' },
})
export class GestionUsuariosComponent implements OnInit {
  private usuariosService = inject(UsuariosService);
  private authService = inject(AuthService);

  usuarios = signal<UsuarioListado[]>([]);
  cargando = signal(false);
  error = signal<string | null>(null);
  exito = signal<string | null>(null);
  private timerExito?: ReturnType<typeof setTimeout>;

  mostrarFormulario = signal(false);
  usuarioEnEdicion = signal<UsuarioListado | null>(null);

  /** Usuario al que se le va a cambiar el estado, esperando confirmación. */
  confirmando = signal<UsuarioListado | null>(null);
  cambiandoEstado = signal(false);

  // ── Filtros ────────────────────────────────────────────
  busqueda = signal('');
  filtroRol = signal<number>(0); // 0 = todos
  mostrarInactivos = signal(true);

  nombreRol = NOMBRE_ROL;
  claseRol = CLASE_ROL;
  formatearRut = formatearRut;

  idPropio = computed(() => this.authService.usuario()?.idUsuario ?? null);

  rolesQuePuedeCrear = computed(() => {
    const miRol = this.authService.usuario()?.idRol;
    return miRol ? (ROLES_GESTIONABLES[miRol] ?? []) : [];
  });

  /** Roles presentes en la lista, con su cantidad, para los chips de filtro. */
  rolesConConteo = computed(() => {
    const conteo = new Map<number, number>();
    for (const u of this.usuarios()) conteo.set(u.idRol, (conteo.get(u.idRol) ?? 0) + 1);
    return [...conteo.entries()]
      .sort(([a], [b]) => a - b)
      .map(([idRol, cantidad]) => ({ idRol, cantidad }));
  });

  usuariosFiltrados = computed(() => {
    const texto = this.normalizar(this.busqueda());
    const textoRut = limpiarRut(this.busqueda());
    const rol = this.filtroRol();
    const inactivos = this.mostrarInactivos();

    return this.usuarios().filter((u) => {
      if (rol && u.idRol !== rol) return false;
      if (!inactivos && !u.activo) return false;
      if (!texto) return true;
      const nombre = this.normalizar(
        `${u.primerNombre} ${u.segundoNombre} ${u.aPaterno} ${u.aMaterno} ${u.correo}`,
      );
      return nombre.includes(texto) || (!!textoRut && limpiarRut(u.rutUsuario).includes(textoRut));
    });
  });

  totalInactivos = computed(() => this.usuarios().filter((u) => !u.activo).length);

  ngOnInit() {
    this.cargarLista();
  }

  cargarLista() {
    this.cargando.set(true);
    this.error.set(null);

    this.usuariosService.listar().subscribe({
      next: (data) => {
        this.usuarios.set(data);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el listado de usuarios. Revisa tu conexión e inténtalo de nuevo.');
        this.cargando.set(false);
      },
    });
  }

  /** Puede editar/desactivar a este usuario. El backend lo valida igual; esto
   *  solo evita mostrar botones que terminarían en un 403. */
  puedeGestionar(u: UsuarioListado): boolean {
    return this.rolesQuePuedeCrear().includes(u.idRol);
  }

  iniciales(u: UsuarioListado): string {
    return `${u.primerNombre.charAt(0)}${u.aPaterno.charAt(0)}`.toUpperCase();
  }

  limpiarFiltros() {
    this.busqueda.set('');
    this.filtroRol.set(0);
    this.mostrarInactivos.set(true);
  }

  // ── Formulario ─────────────────────────────────────────
  abrirCreacion() {
    this.usuarioEnEdicion.set(null);
    this.mostrarFormulario.set(true);
  }

  abrirEdicion(usuario: UsuarioListado) {
    this.usuarioEnEdicion.set(usuario);
    this.mostrarFormulario.set(true);
  }

  cerrarFormulario() {
    this.mostrarFormulario.set(false);
  }

  onGuardado() {
    const editando = this.usuarioEnEdicion() !== null;
    this.mostrarFormulario.set(false);
    this.avisarExito(editando ? 'Cambios guardados.' : 'Usuario creado.');
    this.cargarLista();
  }

  // ── Activar / desactivar ───────────────────────────────
  pedirConfirmacion(usuario: UsuarioListado) {
    this.confirmando.set(usuario);
  }

  cancelarConfirmacion() {
    if (!this.cambiandoEstado()) this.confirmando.set(null);
  }

  confirmarCambioEstado() {
    const usuario = this.confirmando();
    if (!usuario) return;

    this.cambiandoEstado.set(true);
    const accion = usuario.activo
      ? this.usuariosService.desactivar(usuario.idUsuario)
      : this.usuariosService.reactivar(usuario.idUsuario);

    accion.subscribe({
      next: () => {
        this.cambiandoEstado.set(false);
        this.confirmando.set(null);
        this.avisarExito(
          `${usuario.primerNombre} ${usuario.aPaterno} quedó ${usuario.activo ? 'desactivado' : 'activo'}.`,
        );
        this.cargarLista();
      },
      error: (err: HttpErrorResponse) => {
        this.cambiandoEstado.set(false);
        this.confirmando.set(null);
        const mensaje = err.error?.message;
        this.error.set(
          typeof mensaje === 'string' ? mensaje : 'No se pudo actualizar el estado del usuario.',
        );
      },
    });
  }

  private avisarExito(mensaje: string) {
    this.error.set(null);
    this.exito.set(mensaje);
    clearTimeout(this.timerExito);
    this.timerExito = setTimeout(() => this.exito.set(null), MS_AVISO_EXITO);
  }

  /** Minúsculas y sin tildes: buscar "jose" encuentra "José". */
  private normalizar(texto: string): string {
    return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }
}
