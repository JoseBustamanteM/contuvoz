import { IsNumber, Min, Max, IsIn } from 'class-validator';
import { ConDuracionDto } from './con-duracion.dto';
import { DETECCIONES_VOCAL, EnMayusculas, VOCALES } from '../letras';

export class GuardarPronunciacionDto extends ConDuracionDto {
  /** La vocal que se le pidió decir. */
  @EnMayusculas()
  @IsIn(VOCALES, { message: 'textoEsperado debe ser una vocal' })
  textoEsperado!: string;

  /** La vocal detectada, o 'NINGUNA' si no hubo voz suficiente. */
  @EnMayusculas()
  @IsIn(DETECCIONES_VOCAL, { message: 'textoDetectado debe ser una vocal o NINGUNA' })
  textoDetectado!: string;

  /** 0-100. El servicio de detección devuelve 0..1, así que el frontend
   *  multiplica por 100 antes de enviar. */
  @IsNumber() @Min(0) @Max(100) porcConfianza!: number;
}
