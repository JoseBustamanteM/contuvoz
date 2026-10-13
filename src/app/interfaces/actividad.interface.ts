export interface ResultadoPintado {
  letraEsperada: string;
  trazoInterno: number;
  trazoExterno: number;
  areaCompletada: number;
  puntajeFinal: number;
  /** Segundos que duró el intento (se guarda en actividad.duracion). */
  duracion: number;
}

export interface ResultadoPintadoGuardado extends ResultadoPintado {
  idResPintado: number;
  idActividad: number;
  aprobadoPintado: boolean;
}
