import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-logout-button',
  standalone: true,
  template: `
    <button
      type="button"
      (click)="abrirConfirmacion()"
      [disabled]="cargando()"
      aria-label="Cerrar sesión"
    >
      @if (cargando()) {
        <svg class="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        <span class="hidden sm:inline">Saliendo...</span>
      } @else {
        <span aria-hidden="true"><img src="/images/logout.png" alt="" width="40"></span>
      }
    </button>

    @if (mostrarModal()) {
      <!-- Fondo oscuro. Cerrar tocando afuera es la salida más intuitiva para un
           niño que abrió esto sin querer. -->
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        (click)="cancelar()"
      >
        <!-- stopPropagation: tocar la tarjeta no debe cerrarla -->
        <div
          class="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl
                 ring-4 ring-emerald-300"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="titulo-logout"
          (click)="$event.stopPropagation()"
        >
          <img
            src="/images/gecko cara.png"
            alt=""
            aria-hidden="true"
            class="mx-auto mb-3 h-24 w-24 object-contain"
          />

          <h2 id="titulo-logout" class="text-2xl font-extrabold text-emerald-700">
            ¿Ya te vas?
          </h2>
          <p class="mt-1 text-base text-emerald-800/70">
            Puedes volver cuando quieras. 👋
          </p>

          <div class="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
            <!-- Quedarse es la acción segura, así que va primero visualmente
                 (a la derecha en fila, arriba en columna) y con el color fuerte. -->
            <button
              type="button"
              (click)="cancelar()"
              class="min-h-[48px] flex-1 rounded-full bg-emerald-500 px-5 text-lg
                     font-extrabold text-white shadow-md transition
                     hover:-translate-y-0.5 hover:bg-emerald-400 hover:shadow-lg
                     focus-visible:outline focus-visible:outline-4
                     focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
            >
              Me quedo 🎮
            </button>

            <button
              type="button"
              (click)="confirmar()"
              class="min-h-[48px] flex-1 rounded-full bg-white px-5 text-lg
                     font-bold text-rose-600 ring-2 ring-rose-300 transition
                     hover:bg-rose-50
                     focus-visible:outline focus-visible:outline-4
                     focus-visible:outline-offset-2 focus-visible:outline-rose-300"
            >
              Sí, salir
            </button>
          </div>
        </div>
      </div>
    }
  `,
  host: {
    // Escape cierra el modal. Va en el host porque el @if no garantiza que el
    // div tenga el foco cuando aparece.
    '(document:keydown.escape)': 'cancelar()',
  },
})
export class LogoutButtonComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  cargando = signal(false);
  mostrarModal = signal(false);

  abrirConfirmacion() {
    this.mostrarModal.set(true);
  }

  cancelar() {
    // Si ya está saliendo no se puede cancelar: la sesión del servidor ya se cerró.
    if (this.cargando()) return;
    this.mostrarModal.set(false);
  }

  confirmar() {
    this.mostrarModal.set(false);
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
