import { IsString, IsNumber, IsBoolean, Min, Max, Length } from 'class-validator';
import { ConDuracionDto } from './con-duracion.dto';

export class GuardarSignDto extends ConDuracionDto {
  @IsString() @Length(1, 10) letraEsperada!: string;
  @IsString() @Length(1, 10) letraDetectada!: string;
  @IsNumber() @Min(0) @Max(100) porcConfianza!: number;
  /** El niño mantuvo la seña el tiempo mínimo exigido, no solo un instante. */
  @IsBoolean() sostenida!: boolean;
}
