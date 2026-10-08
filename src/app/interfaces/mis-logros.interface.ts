/** Datos del dashboard del estudiante ("Mis logros"). Hoy los arma
 *  MisLogrosService con datos de ejemplo; después vendrán del backend con
 *  esta misma forma. */

export type EstadoLetra = 'dominada' | 'practicando' | 'por-descubrir';

export interface LetraProgreso {
  letra: string;
  estado: EstadoLetra;
}

export type ClaveActividad = 'hablemos' | 'comunicate' | 'pinta' | 'une';

export interface ResumenEstudiante {
  /** Estrellas ganadas esta semana (un intento aprobado = una estrella). */
  estrellasSemana: number;
  /** Días seguidos con al menos una actividad, contando hoy o ayer. */
  racha: number;
  /** Lunes a domingo de la semana actual: true si jugó ese día. */
  diasSemana: boolean[];
  /** Estrellas de la semana por actividad, para las tarjetas de arriba. */
  estrellasPorActividad: Record<ClaveActividad, number>;
  hablemos: { letras: LetraProgreso[]; pista: string | null };
  comunicate: { letras: LetraProgreso[]; pista: string | null };
  pinta: { letras: LetraProgreso[]; pista: string | null };
  une: { conocidas: number; total: number };
}

export interface Medalla {
  id: string;
  nombre: string;
  icono: string;
  obtenida: boolean;
}
