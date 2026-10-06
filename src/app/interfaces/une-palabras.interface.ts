/** Una confusión: el niño tocó `palabra` y la unió con el dibujo de `eligio`. */
export interface Confusion {
  palabra: string;
  eligio: string;
  veces: number;
}

/** Lo que se envía a POST /actividades/une-palabras */
export interface ResultadoUnePalabras {
  totalPares: number;
  aciertos: number;
  errores: number;
  puntajeFinal: number;
  duracionUne: number;
  pares: string[];
  confusiones: Confusion[];
}

/** Lo que devuelve el servidor. `puntajeFinal` y `aprobadoUne` los recalcula él,
 *  así que pueden diferir de lo enviado. */
export interface ResultadoUnePalabrasGuardado {
  idResUne: number;
  idActividad: number;
  totalPares: number;
  aciertos: number;
  errores: number;
  puntajeFinal: number;
  aprobadoUne: boolean;
  duracionUne: number;
  detalle: {
    pares: string[];
    confusiones: Confusion[];
  };
}
