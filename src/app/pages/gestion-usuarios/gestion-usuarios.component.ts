import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UsuariosService } from '../../services/usuarios.service';
import { AuthService } from '../../services/auth.service';
import { UsuarioListado } from '../../interfaces/usuario-gestion.interface';
import { NOMBRE_ROL, ROLES_GESTIONABLES } from '../../interfaces/rol.enum';
import { BackButtonComponent } from '../../components/shared/back-button/back-button.component';
import { UsuarioFormComponent } from '../../components/gestion-usuarios/usuario-form/usuario-form.component';


@Component({
  selector: 'app-gestion-usuarios',
  standalone: true,
  imports: [CommonModule, BackButtonComponent, UsuarioFormComponent],
  templateUrl: './gestion-usuarios.component.html',
  styleUrls: ['./gestion-usuarios.component.scss'],
})
export class GestionUsuariosComponent implements OnInit {
  private usuariosService = inject(UsuariosService);
  private authService = inject(AuthService);

  usuarios = signal<UsuarioListado[]>([]);
  cargando = signal(false);
  error = signal<string | null>(null);

  mostrarFormulario = signal(false);
  usuarioEnEdicion = signal<UsuarioListado | null>(null);

  nombreRol = NOMBRE_ROL;

  rolesQuePuedeCrear = computed(() => {
    const miRol = this.authService.usuario()?.idRol;
    return miRol ? (ROLES_GESTIONABLES[miRol] ?? []) : [];
  });

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
        this.error.set('No se pudo cargar el listado de usuarios');
        this.cargando.set(false);
      },
    });
  }

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
    this.mostrarFormulario.set(false);
    this.cargarLista();
  }

  alternarActivo(usuario: UsuarioListado) {
    const accion = usuario.activo
      ? this.usuariosService.desactivar(usuario.idUsuario)
      : this.usuariosService.reactivar(usuario.idUsuario);

    accion.subscribe({
      next: () => this.cargarLista(),
      error: () => this.error.set('No se pudo actualizar el estado del usuario'),
    });
  }
}
