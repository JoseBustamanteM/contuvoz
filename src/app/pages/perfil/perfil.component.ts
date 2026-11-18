import { Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { NOMBRE_ROL, Rol } from '../../interfaces/rol.enum';
import { formatearRut } from '../../validators/rut.validator';

/** La nueva y su repetición deben coincidir. */
function clavesIguales(grupo: AbstractControl): ValidationErrors | null {
  const nueva = grupo.get('claveNueva')?.value;
  const repetida = grupo.get('repetir')?.value;
  return nueva && repetida && nueva !== repetida ? { distintas: true } : null;
}

/**
 * Perfil: los datos de quien entró y, para los adultos, el cambio de
 * contraseña. Si un adulto entra con una clave que le dio otra persona
 * (debeCambiarClave), authGuard lo trae aquí y no lo deja seguir hasta
 * cambiarla. Los estudiantes no cambian su clave: si la olvidan, se la
 * cambia su profesor.
 */
@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './perfil.component.html',
  styleUrl: './perfil.component.scss',
})
export class PerfilComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  usuario = this.authService.usuario;

  esEstudiante = computed(() => this.usuario()?.idRol === Rol.ESTUDIANTE);
  debeCambiarClave = computed(() => !!this.usuario()?.debeCambiarClave);

  nombreCompleto = computed(() => {
    const u = this.usuario();
    return u ? [u.primerNombre, u.segundoNombre, u.aPaterno, u.aMaterno].filter(Boolean).join(' ') : '';
  });
  iniciales = computed(() => {
    const u = this.usuario();
    return u ? `${u.primerNombre.charAt(0)}${u.aPaterno.charAt(0)}`.toUpperCase() : '';
  });
  nombreRol = computed(() => {
    const u = this.usuario();
    return u ? (NOMBRE_ROL[u.idRol] ?? u.rol.nomRol) : '';
  });
  rut = computed(() => {
    const u = this.usuario();
    return u ? formatearRut(u.rutUsuario) : '';
  });

  // ── Cambio de contraseña ─────────────────────────────────
  form = this.fb.nonNullable.group(
    {
      claveActual: ['', [Validators.required, Validators.maxLength(128)]],
      claveNueva: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
      repetir: ['', [Validators.required]],
    },
    { validators: clavesIguales },
  );

  verClaves = signal(false);
  enviando = signal(false);
  error = signal<string | null>(null);
  /** true tras cambiarla; si era obligatorio, ofrece seguir al inicio. */
  listo = signal(false);
  eraObligatorio = signal(false);

  invalido(campo: 'claveActual' | 'claveNueva' | 'repetir'): boolean {
    const c = this.form.controls[campo];
    return c.invalid && (c.touched || c.dirty);
  }

  cambiarClave(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.enviando()) return;

    const { claveActual, claveNueva } = this.form.getRawValue();
    this.enviando.set(true);
    this.error.set(null);
    this.eraObligatorio.set(this.debeCambiarClave());

    this.authService.cambiarClave(claveActual, claveNueva).subscribe({
      next: (usuario) => {
        this.enviando.set(false);
        if (!usuario) {
          // Se cambió, pero no se pudo volver a entrar solo: que entre a mano.
          this.router.navigate(['/login']);
          return;
        }
        this.form.reset();
        this.listo.set(true);
      },
      error: (e: HttpErrorResponse) => {
        this.enviando.set(false);
        const mensaje = e.error?.message;
        this.error.set(
          e.status === 400 && typeof mensaje === 'string'
            ? mensaje
            : e.status === 400 && Array.isArray(mensaje)
              ? mensaje[0]
              : 'No pudimos cambiar la contraseña. Inténtalo de nuevo.',
        );
      },
    });
  }
}
