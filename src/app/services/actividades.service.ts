import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, retry, timer } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ResultadoPintado,
  ResultadoPintadoGuardado,
} from '../interfaces/actividad.interface';

import { ResultadoSign, ResultadoSignGuardado } from '../interfaces/sign-language.interface';

@Injectable({ providedIn: 'root' })
export class ActividadesService {
  private http = inject(HttpClient);
  private readonly API = `${environment.apiUrl}/actividades`;

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
}
