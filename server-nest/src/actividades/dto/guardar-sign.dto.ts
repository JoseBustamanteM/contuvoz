import { IsString, IsNumber, IsBoolean, Min, Max, Length } from 'class-validator';

export class GuardarSignDto {
  @IsString() @Length(1, 10) letraEsperada!: string;
  @IsString() @Length(1, 10) letraDetectada!: string;
  @IsNumber() @Min(0) @Max(100) porcConfianza!: number;
  /** El niño mantuvo la seña el tiempo mínimo exigido, no solo un instante. */
  @IsBoolean() sostenida!: boolean;
}
