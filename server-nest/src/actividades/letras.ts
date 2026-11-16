// src/actividades/letras.ts
import { Transform } from 'class-transformer';

/** Letras que se trabajan en Comunícate (señas) y Hablemos (voz). */
export const VOCALES = ['A', 'E', 'I', 'O', 'U'] as const;

/** Pinta letras. Incluye la Ñ aunque el selector del frontend todavía no la
 *  ofrezca, igual que Mis logros. */
export const ABECEDARIO = [...'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'] as const;

/** Lo que se guarda como "detectada" cuando no hubo seña o voz suficiente. */
export const NINGUNA = 'NINGUNA';

/** Detecciones válidas en señas y voz: una vocal o NINGUNA. */
export const DETECCIONES_VOCAL = [...VOCALES, NINGUNA] as const;

/** Pasa a mayúsculas antes de validar, para aceptar "a" igual que "A" (el
 *  servicio ya guarda en mayúsculas). */
export const EnMayusculas = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value));
