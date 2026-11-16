import { IsNumber, IsBoolean, Min, Max, IsIn } from 'class-validator';
import { ConDuracionDto } from './con-duracion.dto';
import { DETECCIONES_VOCAL, EnMayusculas, VOCALES } from '../letras';

export class GuardarSignDto extends ConDuracionDto {
  @EnMayusculas()
  @IsIn(VOCALES, { message: 'letraEsperada debe ser una vocal' })
  letraEsperada!: string;

  @EnMayusculas()
  @IsIn(DETECCIONES_VOCAL, { message: 'letraDetectada debe ser una vocal o NINGUNA' })
  letraDetectada!: string;

  @IsNumber() @Min(0) @Max(100) porcConfianza!: number;
  /** El niño mantuvo la seña el tiempo mínimo exigido, no solo un instante. */
  @IsBoolean() sostenida!: boolean;
}
