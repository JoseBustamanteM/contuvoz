import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-logout-button',
  standalone: true,
  template: `
    <button type="button" (click)="onLogout()" [disabled]="cargando()">
      {{ cargando() ? 'Saliendo...' : 'Cerrar sesión' }}
    </button>
  `,
})
export class LogoutButtonComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  cargando = signal(false);

  onLogout() {
    this.cargando.set(true);

    this.authService.logout().subscribe({
      next: () => this.redirigir(),
      error: () => this.redirigir(), // si el server falla, igual sacamos al usuario
    });
  }

  private redirigir() {
    this.cargando.set(false);
    this.router.navigate(['/login']);
  }
}
