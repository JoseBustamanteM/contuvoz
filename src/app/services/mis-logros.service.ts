import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { BANCO_PALABRAS } from '../interfaces/banco-palabras';
import { Medalla, ResumenEstudiante, ResumenEstudianteApi } from '../interfaces/mis-logros.interface';

/** Medallas fijas por ahora, solo para ver cómo lucen en la interfaz.
 *  Cuando exista el cálculo real, `obtenida` vendrá del backend. */
export const MEDALLAS: Medalla[] = [
  { id: 'primera-estrella', nombre: 'Primera estrella', icono: '⭐', obtenida: true },
  { id: 'racha-3', nombre: '3 días seguidos', icono: '🔥', obtenida: true },
  { id: 'racha-7', nombre: '7 días seguidos', icono: '🌈', obtenida: false },
  { id: 'vocales', nombre: 'Todas las vocales', icono: '🎤', obtenida: false },
  { id: 'senas', nombre: 'Todas las señas', icono: '🤟', obtenida: false },
  { id: 'palabras-10', nombre: '10 palabras', icono: '🧩', obtenida: true },
];

@Injectable({ providedIn: 'root' })
export class MisLogrosService {
  private http = inject(HttpClient);
  private readonly API = `${environment.apiUrl}/mis-logros`;

  /** Dashboard de quien inició sesión (GET /mis-logros). */
  obtenerResumen(): Observable<ResumenEstudiante> {
    return this.http.get<ResumenEstudianteApi>(this.API).pipe(map((r) => this.adaptar(r)));
  }

  obtenerMedallas(): Medalla[] {
    return MEDALLAS;
  }

  /** El backend devuelve las palabras que unió bien; el total lo pone el banco
   *  de palabras, que vive en el frontend. Solo cuentan las que siguen en el
   *  banco (si se quita una palabra, no queda "13 de 12"). */
  private adaptar({ une, ...resto }: ResumenEstudianteApi): ResumenEstudiante {
    const conocidas = new Set(une.palabrasConocidas);
    return {
      ...resto,
      une: {
        conocidas: BANCO_PALABRAS.filter((p) => conocidas.has(p.texto)).length,
        total: BANCO_PALABRAS.length,
      },
    };
  }
}
