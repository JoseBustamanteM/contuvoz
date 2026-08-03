import { Component, inject, Input, Output, EventEmitter, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { UsuariosService } from '../../../services/usuarios.service';
import { UsuarioListado } from '../../../interfaces/usuario-gestion.interface';
import { Rol, NOMBRE_ROL } from '../../../interfaces/rol.enum';
import { AuthService } from '../../../services/auth.service';
import { ColegiosService } from '../../../services/colegios.service';
import { Colegio } from '../../../interfaces/colegio.interface';


@Component({
  selector: 'usuario-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './usuario-form.component.html',
  styleUrls: ['./usuario-form.component.scss'],
})
export class UsuarioFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private usuariosService = inject(UsuariosService);
   private authService = inject(AuthService);
   private colegiosService = inject(ColegiosService);


  colegios = signal<Colegio[]>([]);

  @Input() usuario: UsuarioListado | null = null;
  @Input() rolesDisponibles: Rol[] = [];

  @Output() guardado = new EventEmitter<void>();
  @Output() cancelado = new EventEmitter<void>();

  nombreRol = NOMBRE_ROL;
  guardando = signal(false);
  error = signal<string | null>(null);

  get esEdicion() {
    return this.usuario !== null;
  }

   esAdministrador = computed(() => this.authService.usuario()?.idRol === Rol.ADMINISTRADOR);


  form = this.fb.nonNullable.group({
    idRol: [0, [Validators.required]],
     idColegio: [0],
    rutUsuario: ['', [Validators.required]],
    password: [''],   // requerido solo al crear, se ajusta en ngOnInit
    primerNombre: ['', [Validators.required]],
    segundoNombre: ['', [Validators.required]],
    aPaterno: ['', [Validators.required]],
    aMaterno: ['', [Validators.required]],
    telefonoUsuario: ['', [Validators.required]],
    correo: ['', [Validators.required, Validators.email]],
  });

  ngOnInit() {

    if (this.esAdministrador() && !this.esEdicion) {
      this.form.controls.idColegio.setValidators([Validators.required, Validators.min(1)]);
       this.cargarColegios();
    }





    if (this.esEdicion && this.usuario) {
      this.form.patchValue({
        idRol: this.usuario.idRol,
        rutUsuario: this.usuario.rutUsuario,
        primerNombre: this.usuario.primerNombre,
        segundoNombre: this.usuario.segundoNombre,
        aPaterno: this.usuario.aPaterno,
        aMaterno: this.usuario.aMaterno,
        telefonoUsuario: this.usuario.telefonoUsuario,
        correo: this.usuario.correo,
      });
      // en edición la contraseña es opcional (solo si se quiere cambiar)
      this.form.controls.password.clearValidators();
    } else {
      this.form.controls.password.setValidators([Validators.required, Validators.minLength(8)]);
    }
    this.form.controls.password.updateValueAndValidity();
    this.form.controls.idColegio.updateValueAndValidity();
  }

    private cargarColegios() {
    this.colegiosService.listar().subscribe({
      next: (data) => this.colegios.set(data),
      error: () => this.error.set('No se pudieron cargar los colegios'),
    });
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.guardando.set(true);
    this.error.set(null);

    const valores = this.form.getRawValue();

    const peticion = this.esEdicion
      ? this.usuariosService.actualizar(this.usuario!.idUsuario, {
          ...valores,
          password: valores.password || undefined, // no se manda si quedó vacío
        })
      : this.usuariosService.crear({
          ...valores,
          idColegio: this.esAdministrador() ? valores.idColegio : undefined,  // 👈 solo se manda si aplica
        });

    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.guardado.emit();
      },
      error: (err) => {
        this.guardando.set(false);
        this.error.set(err.error?.message ?? 'Ocurrió un error al guardar');
      },
    });
  }

  onCancelar() {
    this.cancelado.emit();
  }
}
