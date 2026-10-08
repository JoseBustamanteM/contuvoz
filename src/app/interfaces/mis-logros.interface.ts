/** Datos del dashboard del estudiante ("Mis logros"). Los calcula el backend
 *  (GET /mis-logros) a partir de las tablas de resultados. */

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

/** Lo que devuelve GET /mis-logros: igual, salvo Une palabras, que trae las
 *  palabras conocidas y el servicio las convierte en "12 de 31". */
export type ResumenEstudianteApi = Omit<ResumenEstudiante, 'une'> & {
  une: { palabrasConocidas: string[] };
};

export interface Medalla {
  id: string;
  nombre: string;
  icono: string;
  obtenida: boolean;
}
