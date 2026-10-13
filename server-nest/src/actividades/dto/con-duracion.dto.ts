import { IsInt, Max, Min } from 'class-validator';

/** Base de los DTO de actividades: todas guardan su duración en
 *  actividad.duracion. Segundos enteros; una hora como tope evita valores
 *  absurdos si el reloj del navegador salta. */
export class ConDuracionDto {
  @IsInt({ message: 'La duración debe ser un número entero de segundos' })
  @Min(0, { message: 'La duración no puede ser negativa' })
  @Max(3600, { message: 'La duración no puede superar una hora (3600 segundos)' })
  duracion!: number;
}
