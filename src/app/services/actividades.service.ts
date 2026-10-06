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
    return this.http.post<ResultadoPintadoGuardado>(`${this.API}/pintado`, datos).pipe(
      retry({
        count: 3,
        delay: (error: HttpErrorResponse, intento) => {
          // Solo reintentamos fallos de red o del servidor, nunca errores de datos
          const esReintentable = error.status === 0 || error.status >= 500;
          if (!esReintentable) throw error;

          // Backoff progresivo: 1s, 2s, 4s
          return timer(1000 * Math.pow(2, intento - 1));
        },
      }),
    );
  }

  guardarSign(datos: ResultadoSign): Observable<ResultadoSignGuardado> {
  return this.http.post<ResultadoSignGuardado>(`${this.API}/sign`, datos).pipe(
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

   guardarUnePalabras(datos: ResultadoUnePalabras): Observable<ResultadoUnePalabrasGuardado> {
    return this.http.post<ResultadoUnePalabrasGuardado>(`${this.API}/une-palabras`, datos).pipe(
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

    guardarPronunciacion(
    datos: ResultadoPronunciacion,
  ): Observable<ResultadoPronunciacionGuardado> {
    return this.http
      .post<ResultadoPronunciacionGuardado>(`${this.API}/pronunciacion`, datos)
      .pipe(
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
