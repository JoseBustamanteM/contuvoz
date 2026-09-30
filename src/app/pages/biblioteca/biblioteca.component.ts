import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BibliotecaService } from '../../services/biblioteca.service';
import { ArchivoBiblioteca } from '../../interfaces/biblioteca.interface';
import { environment } from '../../../environments/environment';
@Component({
  selector: 'app-biblioteca',
  imports: [RouterLink, DatePipe],
  template: `
    <div class="min-h-[100dvh] bg-white px-4 py-6">
      <div class="mx-auto w-full max-w-5xl">

        <div class="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 class="text-3xl font-bold text-gray-800">
              Biblioteca
            </h1>

            <p class="mt-1 text-gray-500">
              Recursos para aprender y practicar.
            </p>
          </div>

          <a
            routerLink="/"
            class="rounded-xl bg-gray-100 px-4 py-2 font-semibold
                   text-gray-700 transition hover:bg-gray-200"
          >
            Volver
          </a>
        </div>

        @if (cargando()) {
          <div class="rounded-2xl bg-gray-100 p-8 text-center">
            <p class="text-gray-500">Cargando biblioteca...</p>
          </div>
        }

        @else if (error()) {
          <div class="rounded-2xl bg-red-50 p-8 text-center">
            <p class="font-semibold text-red-700">
              {{ error() }}
            </p>

            <button
              type="button"
              (click)="cargarArchivos()"
              class="mt-4 rounded-xl bg-red-600 px-4 py-2
                     font-semibold text-white hover:bg-red-700"
            >
              Reintentar
            </button>
          </div>
        }

        @else if (archivos().length === 0) {
          <div class="rounded-2xl bg-gray-100 p-8 text-center">
            <p class="text-gray-500">
              No hay recursos disponibles en la biblioteca.
            </p>
          </div>
        }

        @else {
          <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">

            @for (archivo of archivos(); track archivo.idArchivo) {
              <article
                class="overflow-hidden rounded-2xl bg-white shadow-md
                       ring-1 ring-gray-100"
              >

                @if (archivo.imagenUrl) {
                  <img
                    [src]="archivo.imagenUrl"
                    [alt]="archivo.imagenDescripcionUrl || archivo.tituloArchivo"
                    class="h-40 w-full object-cover"
                  />
                }

                <div class="p-5">

                  <p class="mb-2 text-sm font-semibold uppercase text-green-600">
                    {{ archivo.tipoArchivo }}
                  </p>

                  <h2 class="text-xl font-bold text-gray-800">
                    {{ archivo.tituloArchivo }}
                  </h2>

                  @if (archivo.descripcionArchivo) {
                    <p class="mt-2 text-sm text-gray-500">
                      {{ archivo.descripcionArchivo }}
                    </p>
                  }

                  <p class="mt-4 text-xs text-gray-400">
                    Subido:
                    {{ archivo.fechaSubido | date:'dd/MM/yyyy' }}
                  </p>

                  <a
                    [href]="getArchivoUrl(archivo.rutaArchivoUrl)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="mt-4 block rounded-xl bg-green-500 px-4 py-2
                           text-center font-semibold text-white
                           transition hover:bg-green-600"
                  >
                    Abrir recurso
                  </a>

                </div>
              </article>
            }

          </div>
        }

      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BibliotecaComponent implements OnInit {
  private bibliotecaService = inject(BibliotecaService);

  archivos = signal<ArchivoBiblioteca[]>([]);
  cargando = signal(true);
  error = signal<string | null>(null);

  ngOnInit() {
    this.cargarArchivos();
  }

  getArchivoUrl(rutaArchivoUrl: string): string {
    return `${environment.apiUrl}${rutaArchivoUrl}`;
  }

  cargarArchivos() {
    this.cargando.set(true);
    this.error.set(null);

    this.bibliotecaService.listar().subscribe({
      next: (data) => {
        this.archivos.set(data);
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('Error cargando biblioteca:', err);
        this.error.set(
          'No se pudo cargar la biblioteca. Verifica que el servidor esté funcionando.',
        );
        this.cargando.set(false);
      },
    });
  }
}
