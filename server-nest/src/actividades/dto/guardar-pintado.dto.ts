import { IsString, IsNumber, Min, Max, Length } from 'class-validator';
import { ConDuracionDto } from './con-duracion.dto';

export class GuardarPintadoDto extends ConDuracionDto {
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
}
