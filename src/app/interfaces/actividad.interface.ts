export interface ResultadoPintado {
  letraEsperada: string;
  trazoInterno: number;
  trazoExterno: number;
  areaCompletada: number;
  puntajeFinal: number;
  duracionPintado: number;
}

export interface ResultadoPintadoGuardado extends ResultadoPintado {
  idResPintado: number;
  idActividad: number;
  aprobadoPintado: boolean;
}
