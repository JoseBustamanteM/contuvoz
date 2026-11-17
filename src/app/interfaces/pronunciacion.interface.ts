/**
 * Confianza mínima (0-100) para aprobar en Hablemos.
 *
 * ⚠️ Espejo de UMBRAL_APROBADO_PRONUN en
 * server-nest/src/actividades/actividades.service.ts: si cambia allá, cambiar
 * acá. Antes la pantalla mostraba "¡Muy bien!" con solo reconocer la vocal y
 * el servidor exigía además esta confianza, así que el niño podía ver que lo
 * logró y no recibir la estrella.
 */
export const UMBRAL_APROBADO_PRONUN = 30;

/** La misma regla que aplica el servidor al guardar: la vocal reconocida es
 *  la pedida Y el detector está suficientemente seguro. */
export function apruebaPronunciacion(
  esperada: string,
  detectada: string | null,
  confianza: number,
): boolean {
  return (
    !!detectada &&
    detectada.toUpperCase() === esperada.toUpperCase() &&
    confianza >= UMBRAL_APROBADO_PRONUN
  );
}

/** Se guarda como "detectada" cuando el detector no está seguro: se pide
 *  repetir y no cuenta como fallo en Mis logros. */
export const DUDOSA = 'DUDOSA';
/** Se guarda cuando no hubo voz suficiente. */
export const NINGUNA = 'NINGUNA';

export interface ResultadoPronunciacion {
  textoEsperado: string;
  /** La vocal reconocida, NINGUNA (no habló) o DUDOSA (no se pudo decidir). */
  textoDetectado: string;
  porcConfianza: number;
  /** Segundos que duró el intento (se guarda en actividad.duracion). */
  duracion: number;

  // Medidas de la voz (no el audio), para ajustar el detector con datos
  // reales. Faltan si no se alcanzó a medir.
  f0Hz?: number;
  f1Hz?: number;
  f2Hz?: number;
  f3Hz?: number;
  snrDb?: number;
  msVoz?: number;
  versionDetector?: number;
}

export interface ResultadoPronunciacionGuardado extends ResultadoPronunciacion {
  idResPronun: number;
  idActividad: number;
  aprobadoPronun: boolean;
}
