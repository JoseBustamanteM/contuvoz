import { IsString, IsNumber, IsInt, Min, Max, Length } from 'class-validator';

export class GuardarPintadoDto {
  @IsString()
  @Length(1, 10)
  letraEsperada!: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  trazoInterno!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  trazoExterno!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  areaCompletada!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  puntajeFinal!: number;

  @IsInt()
  @Min(0)
  duracionPintado!: number;
}
