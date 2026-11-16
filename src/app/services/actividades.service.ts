import { Injectable, computed, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, retry, timer } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { Rol } from '../interfaces/rol.enum';
import {
  ResultadoPintado,
  ResultadoPintadoGuardado,
} from '../interfaces/actividad.interface';

import { ResultadoPronunciacion, ResultadoPronunciacionGuardado }
  from '../interfaces/pronunciacion.interface';


import { ResultadoSign, ResultadoSignGuardado } from '../interfaces/sign-language.interface';
import { ResultadoUnePalabras, ResultadoUnePalabrasGuardado } from '../interfaces/une-palabras.interface';

/** Roles que registran resultados. Espejo de los @Roles(...) de
 *  ActividadesController en el backend: si cambia allá, cambiar acá. */
export const ROLES_QUE_GUARDAN: readonly Rol[] = [Rol.ESTUDIANTE, Rol.PROFESOR];

@Injectable({ providedIn: 'root' })
export class ActividadesService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private readonly API = `${environment.apiUrl}/actividades`;

  /** false para los roles que el backend rechaza con 403 (Administrador,
   *  Admin. Colegio, Apoderado). Las páginas lo usan para no intentar guardar
   *  y mostrar el aviso de modo práctica en vez de un error genérico. */
  readonly puedeGuardarProgreso = computed(() => {
    const usuario = this.authService.usuario();
    return !!usuario && ROLES_QUE_GUARDAN.includes(usuario.idRol);
  });

  guardarPintado(datos: ResultadoPintado): Observable<ResultadoPintadoGuardado> {
    return this.guardar<ResultadoPintadoGuardado>('pintado', datos);
  }

  guardarSign(datos: ResultadoSign): Observable<ResultadoSignGuardado> {
    return this.guardar<ResultadoSignGuardado>('sign', datos);
  }

  guardarUnePalabras(datos: ResultadoUnePalabras): Observable<ResultadoUnePalabrasGuardado> {
    return this.guardar<ResultadoUnePalabrasGuardado>('une-palabras', datos);
  }

  guardarPronunciacion(
    datos: ResultadoPronunciacion,
  ): Observable<ResultadoPronunciacionGuardado> {
    return this.guardar<ResultadoPronunciacionGuardado>('pronunciacion', datos);
  }

  /**
   * Envía un intento y reintenta si falla la red o el servidor (1s, 2s, 4s),
   * nunca ante errores de datos.
   *
   * El idIntento se genera UNA vez, antes de los reintentos, y viaja en todos
   * ellos: si el primer envío alcanzó a guardarse y solo se perdió la
   * respuesta, el backend reconoce el intento y devuelve lo ya guardado en
   * vez de duplicarlo (y duplicar las estrellas).
   */
  private guardar<T>(ruta: string, datos: object): Observable<T> {
    const cuerpo = { ...datos, idIntento: nuevoIdIntento() };

    return this.http.post<T>(`${this.API}/${ruta}`, cuerpo).pipe(
      retry({
        count: 3,
        delay: (error: HttpErrorResponse, intento) => {
          const esReintentable = error.status === 0 || error.status >= 500;
          if (!esReintentable) throw error;
          return timer(1000 * Math.pow(2, intento - 1));
        },
      }),
    );
  }
}

/** UUID v4. crypto.randomUUID solo existe en contextos seguros (HTTPS o
 *  localhost); si la app se abre por http://IP en la red local, se arma con
 *  getRandomValues, que sí está disponible. */
function nuevoIdIntento(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();

  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
