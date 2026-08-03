import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';



@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule,],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  cargando = signal(false);
  error = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    rutUsuario: ['', [Validators.required]],
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

    this.authService.login(rutUsuario, password).subscribe({
      next: () => {
        this.cargando.set(false);
        this.router.navigate(['/']); // ajusta a tu ruta principal
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(
          err.status === 401
            ? 'RUT o contraseña incorrectos'
            : 'Error de conexión con el servidor',
        );
      },
    });
  }
}
