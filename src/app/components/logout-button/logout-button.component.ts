import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-logout-button',
  standalone: true,
  template: `
    <!-- Misma forma de hoja colgando de la rama que los botones de la barra
         superior (ver barra-superior.component.scss), en blanco y coral para
         que se distinga como la acción de salir. Bajo 900px pasa a dibujo con
         la palabra debajo, igual que las demás hojas. -->
    <button
      type="button"
      (click)="abrirConfirmacion()"
      [disabled]="cargando()"
      aria-label="Cerrar sesión"
      title="Salir"
      class="relative inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5
             rounded-[6px_24px_6px_24px] whitespace-nowrap bg-white px-3.5 text-[0.92rem]
             font-extrabold text-[#c4362a] shadow-[0_4px_0_#f2b8b1] transition
             before:absolute before:bottom-full before:left-1/2 before:-ml-0.5 before:h-2 before:w-1
             before:rounded-sm before:bg-[#5a7a00] before:content-['']
             hover:translate-y-0.5 hover:bg-[#fff3f1]
             focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2
             focus-visible:outline-[#c4362a]
             disabled:cursor-wait disabled:opacity-70
             max-[899px]:min-h-[48px] max-[899px]:min-w-[52px] max-[899px]:flex-col
             max-[899px]:gap-px max-[899px]:rounded-[6px_20px_6px_20px] max-[899px]:px-1.5 max-[899px]:py-1
             max-[899px]:text-[0.68rem] max-[899px]:leading-[1.1]
             max-[559px]:min-w-[46px] max-[559px]:px-[3px] max-[559px]:text-[0.64rem]"
    >
      @if (cargando()) {
        <svg class="size-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
      } @else {
        <svg class="size-5 flex-none fill-current" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3h7A1.5 1.5 0 0 1 14 4.5v3a1 1 0 1 1-2 0V5H6v14h6v-2.5a1 1 0 1 1 2 0v3a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 4 19.5zm13.3 3.800a1 1 0 0 1 1.4 0l3 3a1 1 0 0 1 0 1.4l-3 3a1 1 0 0 1-1.4-1.4l1.29-1.3H10a1 1 0 1 1 0-2h8.59l-1.3-1.3a1 1 0 0 1 0-1.4z"/>
        </svg>
      }
      <span>{{ cargando() ? 'Saliendo…' : 'Salir' }}</span>
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
          class="w-full max-w-sm rounded-3xl bg-[#fffaf0] p-6 text-center
                 shadow-[0_0_0_8px_#c98a4b,0_14px_0_8px_#8e5626]"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="titulo-logout"
          (click)="$event.stopPropagation()"
        >
          <img
            src="images/gecko-cara.webp"
            alt=""
            aria-hidden="true"
            class="mx-auto mb-3 h-24 w-24 object-contain"
          />

          <h2 id="titulo-logout" class="text-2xl font-extrabold text-[#25661f]">
            ¿Ya te vas?
          </h2>
          <p class="mt-1 text-base font-semibold text-[#7a6450]">
            Puedes volver cuando quieras. 👋
          </p>

          <div class="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
            <!-- Quedarse es la acción segura, así que va primero visualmente
                 (a la derecha en fila, arriba en columna) y con el color fuerte. -->
            <button
              type="button"
              (click)="cancelar()"
              class="min-h-[48px] flex-1 rounded-full bg-[#3f9b3f] px-5 text-lg
                     font-extrabold text-white shadow-[0_5px_0_#25661f] transition
                     active:translate-y-1 active:shadow-[0_1px_0_#25661f]
                     focus-visible:outline focus-visible:outline-4
                     focus-visible:outline-offset-2 focus-visible:outline-[#ffc928]"
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
