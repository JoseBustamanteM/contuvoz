import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

/** Base de los DTO de actividades: todas guardan su duración en
 *  actividad.duracion. Segundos enteros; una hora como tope evita valores
 *  absurdos si el reloj del navegador salta. */
export class ConDuracionDto {
  @IsInt({ message: 'La duración debe ser un número entero de segundos' })
  @Min(0, { message: 'La duración no puede ser negativa' })
  @Max(3600, { message: 'La duración no puede superar una hora (3600 segundos)' })
  duracion!: number;

  /** UUID del intento, generado en el navegador y el mismo en todos sus
   *  reintentos: si el intento ya se guardó, se devuelve ese resultado en vez
   *  de crear otro. Opcional para no rechazar una pestaña abierta con una
   *  versión anterior del frontend. */
  @IsOptional()
  @IsUUID('all', { message: 'El identificador del intento no es válido' })
  idIntento?: string;
}
