// src\app\pages\biblioteca\biblioteca.component.ts
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  BibliotecaService,
  CrearArchivoBiblioteca,
} from '../../services/biblioteca.service';

import { ArchivoBiblioteca } from '../../interfaces/biblioteca.interface';
import { environment } from '../../../environments/environment';
@Component({
  selector: 'app-biblioteca',
  imports: [RouterLink, DatePipe, FormsModule],
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

        <section class="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div class="mb-5">
            <h2 class="text-xl font-semibold text-slate-900">
              Subir recurso
            </h2>

            <p class="mt-1 text-sm text-slate-500">
              Agrega un documento, imagen o video a la biblioteca.
            </p>
          </div>

          <div class="space-y-4">

            <!-- Título -->
            <div>
              <label
                for="tituloArchivo"
                class="mb-1 block text-sm font-medium text-slate-700"
              >
                Título
              </label>

              <input
                id="tituloArchivo"
                type="text"
                [ngModel]="tituloArchivo()"
                (ngModelChange)="tituloArchivo.set($event)"
                maxlength="200"
                placeholder="Ej. Reglamento escolar 2026"
                class="w-full rounded-xl border border-slate-300 px-4 py-2.5
                      text-sm outline-none transition
                      focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <!-- Descripción -->
            <div>
              <label
                for="descripcionArchivo"
                class="mb-1 block text-sm font-medium text-slate-700"
              >
                Descripción
              </label>

              <textarea
                id="descripcionArchivo"
                [ngModel]="descripcionArchivo()"
                (ngModelChange)="descripcionArchivo.set($event)"
                maxlength="5000"
                rows="3"
                placeholder="Descripción opcional del recurso"
                class="w-full rounded-xl border border-slate-300 px-4 py-2.5
                      text-sm outline-none transition
                      focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              ></textarea>
            </div>

            <!-- Archivo -->
            <div>
              <label
                for="archivo"
                class="mb-1 block text-sm font-medium text-slate-700"
              >
                Archivo
              </label>

              <input
                id="archivo"
                type="file"
                accept=".pdf,.docx,.png,.jpg,.jpeg,.mp4"
                (change)="onArchivoSeleccionado($event)"
                class="block w-full rounded-xl border border-slate-300
                      bg-white text-sm text-slate-600
                      file:mr-4 file:rounded-lg file:border-0
                      file:bg-slate-100 file:px-4 file:py-2
                      file:text-sm file:font-medium"
              />

              <p class="mt-1 text-xs text-slate-500">
                PDF, DOCX, PNG, JPG o MP4. Máximo 25 MB.
              </p>
            </div>

            <!-- Archivo seleccionado -->
            @if (archivoSeleccionado(); as archivo) {
              <div class="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Archivo seleccionado:
                <strong>{{ archivo.name }}</strong>
              </div>
            }

            <!-- Error -->
            @if (errorSubida()) {
              <div
                class="rounded-xl border border-red-200 bg-red-50 px-4 py-3
                      text-sm text-red-700"
              >
                {{ errorSubida() }}
              </div>
            }

            <!-- Éxito -->
            @if (exitoSubida()) {
              <div
                class="rounded-xl border border-green-200 bg-green-50 px-4 py-3
                      text-sm text-green-700"
              >
                {{ exitoSubida() }}
              </div>
            }

            <!-- Submit -->
            <button
              type="button"
              (click)="subirArchivo()"
              [disabled]="subiendo()"
              class="rounded-xl bg-slate-900 px-5 py-2.5
                    text-sm font-medium text-white
                    transition hover:bg-slate-800
                    disabled:cursor-not-allowed disabled:opacity-50"
            >
              @if (subiendo()) {
                Subiendo...
              } @else {
                Subir recurso
              }
            </button>

          </div>
        </section>

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

  tituloArchivo = signal('');
  descripcionArchivo = signal('');
  archivoSeleccionado = signal<File | null>(null);

  subiendo = signal(false);
  errorSubida = signal<string | null>(null);
  exitoSubida = signal<string | null>(null);

  archivos = signal<ArchivoBiblioteca[]>([]);
  cargando = signal(true);
  error = signal<string | null>(null);

  ngOnInit() {
    this.cargarArchivos();
  }

  onArchivoSeleccionado(event: Event): void {
    const input = event.target as HTMLInputElement;

    const file = input.files?.[0] ?? null;

    this.archivoSeleccionado.set(file);
    this.errorSubida.set(null);
    this.exitoSubida.set(null);
  }

  subirArchivo(): void {
    const titulo = this.tituloArchivo().trim();
    const descripcion = this.descripcionArchivo().trim();
    const file = this.archivoSeleccionado();

    this.errorSubida.set(null);
    this.exitoSubida.set(null);

    if (!titulo) {
      this.errorSubida.set('El título es obligatorio.');
      return;
    }

    if (!file) {
      this.errorSubida.set('Debes seleccionar un archivo.');
      return;
    }

    const archivo: CrearArchivoBiblioteca = {
      tituloArchivo: titulo,
      descripcionArchivo: descripcion || undefined,
      file,
    };

    this.subiendo.set(true);

    this.bibliotecaService.subir(archivo).subscribe({
      next: () => {
        this.subiendo.set(false);

        this.exitoSubida.set(
          'El recurso se subió correctamente.',
        );

        this.tituloArchivo.set('');
        this.descripcionArchivo.set('');
        this.archivoSeleccionado.set(null);

        this.cargarArchivos();
      },

      error: (err) => {
        console.error('Error subiendo archivo:', err);

        this.subiendo.set(false);

        const mensaje =
          err?.error?.message ||
          'No se pudo subir el archivo.';

        this.errorSubida.set(mensaje);
      },
    });
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
