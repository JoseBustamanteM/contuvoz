import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { LetraProgreso, Medalla, ResumenEstudiante } from '../interfaces/mis-logros.interface';

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

const ABECEDARIO = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('');

function letras(dominadas: string, practicando: string, todas: string[]): LetraProgreso[] {
  return todas.map((letra) => ({
    letra,
    estado: dominadas.includes(letra) ? 'dominada' : practicando.includes(letra) ? 'practicando' : 'por-descubrir',
  }));
}

/** ⚠️ DATOS DE EJEMPLO. Reemplazar por la llamada al backend cuando exista
 *  el endpoint (p. ej. GET /dashboard/estudiante), que devolverá un
 *  ResumenEstudiante calculado de las tablas de resultados. */
const EJEMPLO: ResumenEstudiante = {
  estrellasSemana: 12,
  racha: 3,
  diasSemana: [true, true, false, true, true, false, false],
  estrellasPorActividad: { pinta: 3, comunicate: 2, hablemos: 4, une: 3 },
  practicar: { letra: 'O', actividad: 'hablemos' },
  hablemos: { letras: letras('AEI', 'OU', ['A', 'E', 'I', 'O', 'U']), pista: 'A veces tu O suena como U' },
  comunicate: { letras: letras('AI', 'E', ['A', 'E', 'I', 'O', 'U']), pista: 'Para la E, deja el pulgar afuera' },
  pinta: { letras: letras('ABCEIM', 'DL', ABECEDARIO), pista: 'La D se te escapa por los bordes' },
  une: { conocidas: 12, total: 31 },
};

@Injectable({ providedIn: 'root' })
export class MisLogrosService {
  obtenerResumen(): Observable<ResumenEstudiante> {
    // El retraso simula la red para poder ver el skeleton de carga.
    return of(EJEMPLO).pipe(delay(900));
  }

  obtenerMedallas(): Medalla[] {
    return MEDALLAS;
  }
}
