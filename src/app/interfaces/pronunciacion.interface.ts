export interface ResultadoPronunciacion {
  textoEsperado: string;
  textoDetectado: string;
  porcConfianza: number;
  /** Segundos que duró el intento (se guarda en actividad.duracion). */
  duracion: number;
}

export interface ResultadoPronunciacionGuardado extends ResultadoPronunciacion {
  idResPronun: number;
  idActividad: number;
  aprobadoPronun: boolean;
}
