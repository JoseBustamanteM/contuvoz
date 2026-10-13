import { Injectable, Injector, inject } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, of } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * Precarga del código de las páginas (rutas con loadComponent), pero SOLO con
 * sesión iniciada: en el login no tiene sentido bajar Gestión de usuarios ni
 * MediaPipe. El router vuelve a llamar a esto después de cada navegación, así
 * que al entrar al inicio tras el login se precarga todo.
 *
 * Una ruta con `data: { precargar: false }` no se precarga (se baja al abrirla).
 */
@Injectable({ providedIn: 'root' })
export class PrecargaTrasLogin implements PreloadingStrategy {
  private authService = inject(AuthService);

  preload(route: Route, cargar: () => Observable<unknown>): Observable<unknown> {
    if (route.data?.['precargar'] === false) return of(null);
    return this.authService.isLoggedIn() ? cargar() : of(null);
  }
}

/** Imágenes de las actividades. Las del inicio y la barra ya se cargan solas. */
const IMAGENES = [
  'images/gecko-habla.webp',
  'images/lsh-a.png',
  'images/lsh-e.png',
  'images/lsh-i.png',
  'images/lsh-o.png',
  'images/lsh-u.png',
];

/**
 * Prepara en segundo plano lo pesado de cada actividad, una vez por sesión y
 * cuando el navegador está desocupado, para que al abrir cada página no haya
 * que esperar:
 * - Comunícate: descarga el modelo de manos (~8 MB) y los wasm de MediaPipe
 *   (~11 MB) y lo deja inicializado. Es lo que más se notaba.
 * - Pinta letras: la fuente Playwrite de la letra guía.
 * - Imágenes de Hablemos y de las señas.
 *
 * Si el dispositivo pidió ahorro de datos, se salta el modelo (19 MB por datos
 * móviles es mucho): Comunícate lo descargará al abrirse, como antes.
 */
@Injectable({ providedIn: 'root' })
export class PrecargaService {
  private injector = inject(Injector);
  private iniciada = false;

  iniciar() {
    if (this.iniciada) return;
    this.iniciada = true;
    cuandoEsteLibre(() => {
      this.imagenes();
      this.fuentePintaLetras();
      if (!ahorroDeDatos()) this.modeloDeManos();
    });
  }

  private imagenes() {
    for (const src of IMAGENES) {
      const img = new Image();
      img.decoding = 'async';
      img.src = src;
    }
  }

  private fuentePintaLetras() {
    document.fonts?.load('310px "Playwrite CU"').catch(() => {
      /* sin la fuente, Pinta letras usa sans-serif: no es un error */
    });
  }

  /** import() dinámico: así MediaPipe sigue fuera del paquete inicial. El
   *  servicio es singleton (providedIn root): su constructor empieza a cargar
   *  el modelo, y Comunícate usará esa misma instancia ya lista. */
  private modeloDeManos() {
    import('./signLanguage.service')
      .then((m) => this.injector.get(m.SignLanguageService))
      .catch(() => {
        /* si falla, Comunícate lo reintenta al abrirse y muestra su error */
      });
  }
}

function cuandoEsteLibre(tarea: () => void) {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => tarea(), { timeout: 4000 });
  } else {
    setTimeout(tarea, 1500);
  }
}

function ahorroDeDatos(): boolean {
  const conexion = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return conexion?.saveData === true;
}
