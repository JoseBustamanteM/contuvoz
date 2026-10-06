import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TimeoutError, timeout } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { rutValidator } from '../../validators/rut.validator';

/** Si el servidor no responde en este tiempo se avisa, en vez de dejar el botón
 *  girando para siempre (pasa con un backend colgado o una red escolar lenta). */
const TIMEOUT_LOGIN_MS = 15_000;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  cargando = signal(false);
  error = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    rutUsuario: ['', [Validators.required, rutValidator]],
    password: ['', [Validators.required]],
  });

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.cargando.set(true);
    this.error.set(null);

    const { rutUsuario, password } = this.form.getRawValue();

    this.authService
      .login(rutUsuario, password)
      .pipe(timeout(TIMEOUT_LOGIN_MS))
      .subscribe({
        next: (usuario) => {
          this.cargando.set(false);
          // El token llegó pero /auth/me falló: sin perfil, la cabecera y los
          // guards no funcionan, así que no se navega.
          if (!usuario) {
            this.error.set('Entraste, pero no pudimos cargar tu perfil. Inténtalo de nuevo.');
            return;
          }
          this.router.navigate(['/']);
        },
        error: (err) => {
          this.cargando.set(false);
          this.error.set(this.mensajeDeError(err));
        },
      });
  }

  private mensajeDeError(err: unknown): string {
    if (err instanceof TimeoutError) {
      return 'El servidor está tardando demasiado. Inténtalo de nuevo en un momento.';
    }
    if (!(err instanceof HttpErrorResponse)) {
      return 'Ocurrió un error inesperado. Recarga la página e inténtalo de nuevo.';
    }

    switch (err.status) {
      case 0:
        return 'No pudimos conectar con el servidor. Revisa tu conexión a internet.';
      case 400:
        return 'Revisa que el RUT y la contraseña estén bien escritos.';
      case 401:
        // El backend no distingue clave incorrecta de usuario inactivo, a propósito:
        // así no se puede averiguar qué RUTs existen.
        return 'RUT o contraseña incorrectos. Si tu cuenta fue desactivada, pide ayuda a tu profesor.';
      case 429:
        return 'Demasiados intentos seguidos. Espera un minuto antes de volver a intentar.';
      default:
        return err.status >= 500
          ? 'El servidor tuvo un problema. Inténtalo de nuevo en unos minutos.'
          : `No pudimos iniciar sesión (error ${err.status}). Inténtalo de nuevo.`;
    }
  }
}
