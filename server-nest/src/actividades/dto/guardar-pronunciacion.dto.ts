import { IsNumber, Min, Max, IsIn, IsInt, IsOptional } from 'class-validator';
import { ConDuracionDto } from './con-duracion.dto';
import { DETECCIONES_VOZ, EnMayusculas, VOCALES } from '../letras';

export class GuardarPronunciacionDto extends ConDuracionDto {
  /** La vocal que se le pidió decir. */
  @EnMayusculas()
  @IsIn(VOCALES, { message: 'textoEsperado debe ser una vocal' })
  textoEsperado!: string;

  /** La vocal detectada, 'NINGUNA' si no hubo voz suficiente o 'DUDOSA' si
   *  el detector no estuvo seguro (pidió repetir). */
  @EnMayusculas()
  @IsIn(DETECCIONES_VOZ, { message: 'textoDetectado debe ser una vocal, NINGUNA o DUDOSA' })
  textoDetectado!: string;

  /** 0-100. El servicio de detección devuelve 0..1, así que el frontend
   *  multiplica por 100 antes de enviar. */
  @IsNumber() @Min(0) @Max(100) porcConfianza!: number;

  // ── Medidas de la voz (no el audio). Opcionales: un intento sin voz no
  //    tiene qué medir, y una pestaña con el frontend anterior no las manda.
  //    Los rangos son los de chk_pronun_medidas en la base.

  /** Tono (Hz). */
  @IsOptional() @IsInt() @Min(50) @Max(1000) f0Hz?: number;
  /** Formantes (Hz). */
  @IsOptional() @IsInt() @Min(0) @Max(8000) f1Hz?: number;
  @IsOptional() @IsInt() @Min(0) @Max(8000) f2Hz?: number;
  @IsOptional() @IsInt() @Min(0) @Max(8000) f3Hz?: number;
  /** Voz sobre el ruido de la sala (dB). */
  @IsOptional() @IsNumber() @Min(-20) @Max(150) snrDb?: number;
  /** Duración de la vocal medida (ms). */
  @IsOptional() @IsInt() @Min(0) @Max(10000) msVoz?: number;
  /** Versión del cálculo (VERSION_DETECTOR en vowel-dsp.ts del frontend). */
  @IsOptional() @IsInt() @Min(1) @Max(255) versionDetector?: number;
}
