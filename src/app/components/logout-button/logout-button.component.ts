import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-logout-button',
  standalone: true,
  template: `
    <button type="button" (click)="onLogout()" [disabled]="cargando()"
        class="inline-flex items-center gap-1.5 rounded-full bg-rose-500
               px-3 sm:px-4 py-1.5 text-sm font-bold text-white
               shadow-md ring-1 ring-white/40
               transition hover:-translate-y-0.5 hover:bg-rose-600 hover:shadow-lg
               active:translate-y-0
               focus:outline-none focus-visible:ring-2 focus-visible:ring-white
               disabled:cursor-not-allowed disabled:opacity-60
               disabled:hover:translate-y-0 disabled:hover:bg-rose-500 disabled:hover:shadow-md">
  @if (cargando()) {
    <svg class="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
      <path class="opacity-75" fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
    <span class="hidden sm:inline">Saliendo...</span>
  } @else {
    <span aria-hidden="true">🚪</span>
    <span class="hidden sm:inline">Cerrar sesión</span>
  }
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
