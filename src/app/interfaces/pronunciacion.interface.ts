export interface ResultadoPronunciacion {
  textoEsperado: string;
  textoDetectado: string;
  porcConfianza: number;
}

export interface ResultadoPronunciacionGuardado extends ResultadoPronunciacion {
  idResPronun: number;
  idActividad: number;
  aprobadoPronun: boolean;
}
