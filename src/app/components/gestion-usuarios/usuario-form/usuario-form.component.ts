import {
  Component, inject, Input, Output, EventEmitter, OnInit, signal, computed,
  viewChild, effect, ElementRef,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { UsuariosService } from '../../../services/usuarios.service';
import { UsuarioListado } from '../../../interfaces/usuario-gestion.interface';
import { Rol, NOMBRE_ROL } from '../../../interfaces/rol.enum';
import { AuthService } from '../../../services/auth.service';
import { ColegiosService } from '../../../services/colegios.service';
import { Colegio } from '../../../interfaces/colegio.interface';
import { formatearRut, rutValidator } from '../../../validators/rut.validator';

/** Teléfono chileno o internacional: dígitos y espacios, con + opcional. */
const PATRON_TELEFONO = /^\+?[\d\s]{8,20}$/;

@Component({
  selector: 'usuario-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './usuario-form.component.html',
  styleUrls: ['./usuario-form.component.scss'],
  host: { '(document:keydown.escape)': 'intentarCerrar()' },
})
export class UsuarioFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private usuariosService = inject(UsuariosService);
  private authService = inject(AuthService);
  private colegiosService = inject(ColegiosService);

  @Input() usuario: UsuarioListado | null = null;
  @Input() rolesDisponibles: Rol[] = [];

  @Output() guardado = new EventEmitter<void>();
  @Output() cancelado = new EventEmitter<void>();

  colegios = signal<Colegio[]>([]);
  cargandoColegios = signal(false);
  nombreRol = NOMBRE_ROL;
  guardando = signal(false);
  error = signal<string | null>(null);
  verPassword = signal(false);

  /** Se pidió cerrar con cambios sin guardar: se muestra la confirmación. */
  confirmandoDescarte = signal(false);

  /** La confirmación vive al final del formulario; si se cerró con la ✕ de
   *  arriba quedaba fuera de la vista y parecía que el botón no hacía nada. */
  private avisoDescarte = viewChild<ElementRef<HTMLElement>>('avisoDescarte');

  constructor() {
    effect(() => {
      this.avisoDescarte()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  esAdministrador = computed(() => this.authService.usuario()?.idRol === Rol.ADMINISTRADOR);

  get esEdicion() {
    return this.usuario !== null;
  }

  get pideColegio() {
    return this.esAdministrador() && !this.esEdicion;
  }

  form = this.fb.nonNullable.group({
    // min(1): el 0 es el "Selecciona un rol" y Validators.required no lo rechaza.
    idRol: [0, [Validators.required, Validators.min(1)]],
    idColegio: [0],
    rutUsuario: ['', [Validators.required, rutValidator]],
    password: [''], // obligatoria solo al crear, se ajusta en ngOnInit
    primerNombre: ['', [Validators.required, Validators.maxLength(100)]],
    segundoNombre: ['', [Validators.required, Validators.maxLength(100)]],
    aPaterno: ['', [Validators.required, Validators.maxLength(100)]],
    aMaterno: ['', [Validators.required, Validators.maxLength(100)]],
    telefonoUsuario: ['', [Validators.required, Validators.pattern(PATRON_TELEFONO)]],
    correo: ['', [Validators.required, Validators.email]],
  });

  ngOnInit() {
    if (this.pideColegio) {
      this.form.controls.idColegio.setValidators([Validators.required, Validators.min(1)]);
      this.cargarColegios();
    }

    if (this.esEdicion && this.usuario) {
      this.form.patchValue({
        idRol: this.usuario.idRol,
        rutUsuario: formatearRut(this.usuario.rutUsuario),
        primerNombre: this.usuario.primerNombre,
        segundoNombre: this.usuario.segundoNombre,
        aPaterno: this.usuario.aPaterno,
        aMaterno: this.usuario.aMaterno,
        telefonoUsuario: this.usuario.telefonoUsuario,
        correo: this.usuario.correo,
      });
      // En edición la contraseña es opcional: vacía = no se cambia.
      this.form.controls.password.setValidators([Validators.minLength(8)]);
    } else {
      this.form.controls.password.setValidators([Validators.required, Validators.minLength(8)]);
      // Si solo puede crear un rol (p. ej. un profesor que crea estudiantes), viene elegido.
      if (this.rolesDisponibles.length === 1) {
        this.form.controls.idRol.setValue(this.rolesDisponibles[0]);
      }
    }
    this.form.controls.password.updateValueAndValidity();
    this.form.controls.idColegio.updateValueAndValidity();
  }

  private cargarColegios() {
    this.cargandoColegios.set(true);
    this.colegiosService.listar().subscribe({
      next: (data) => {
        this.cargandoColegios.set(false);
        this.colegios.set(data);
        if (data.length === 1) this.form.controls.idColegio.setValue(data[0].idColegio);
      },
      error: () => {
        this.cargandoColegios.set(false);
        this.error.set('No se pudieron cargar los colegios. Cierra y vuelve a abrir el formulario.');
      },
    });
  }

  /** true si el campo debe mostrar su error (ya se tocó o se intentó guardar). */
  invalido(campo: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[campo];
    return c.invalid && (c.touched || c.dirty);
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.guardando.set(true);
    this.error.set(null);

    const { idColegio, password, ...resto } = this.form.getRawValue();

    const peticion = this.esEdicion
      ? this.usuariosService.actualizar(this.usuario!.idUsuario, {
          ...resto,
          password: password || undefined, // vacía = no se cambia
        })
      : this.usuariosService.crear({
          ...resto,
          password,
          idColegio: this.pideColegio ? idColegio : undefined,
        });

    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.guardado.emit();
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        this.error.set(this.mensajeDeError(err));
      },
    });
  }

  /** Cerrar desde Cancelar, la X, el fondo o Escape. Con cambios sin guardar
   *  pide confirmación: antes un clic accidental fuera del modal borraba todo. */
  intentarCerrar() {
    if (this.guardando()) return;
    if (this.form.dirty && !this.confirmandoDescarte()) {
      this.confirmandoDescarte.set(true);
      return;
    }
    this.cancelado.emit();
  }

  seguirEditando() {
    this.confirmandoDescarte.set(false);
  }

  descartar() {
    this.cancelado.emit();
  }

  private mensajeDeError(err: HttpErrorResponse): string {
    if (err.status === 0) return 'No pudimos conectar con el servidor. Revisa tu conexión.';
    if (err.status === 403) return 'No tienes permiso para asignar ese rol o editar este usuario.';
    if (err.status >= 500) return 'El servidor tuvo un problema. Inténtalo de nuevo en unos minutos.';

    // class-validator devuelve un arreglo de mensajes; los conflictos, un string.
    const mensaje = err.error?.message;
    if (Array.isArray(mensaje)) return mensaje.join('. ');
    return typeof mensaje === 'string' ? mensaje : 'Ocurrió un error al guardar.';
  }
}
