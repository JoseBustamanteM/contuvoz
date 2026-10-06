import { IsString, IsNumber, Min, Max, Length } from 'class-validator';

export class GuardarPronunciacionDto {
  /** La vocal que se le pidió decir. */
  @IsString() @Length(1, 10) textoEsperado!: string;

  /** La vocal detectada, o 'NINGUNA' si no hubo voz suficiente.
   *  La columna es TEXT NOT NULL, así que nunca puede ir vacío. */
  @IsString() @Length(1, 50) textoDetectado!: string;

  /** 0-100. El servicio de detección devuelve 0..1, así que el frontend
   *  multiplica por 100 antes de enviar. */
  @IsNumber() @Min(0) @Max(100) porcConfianza!: number;
}
