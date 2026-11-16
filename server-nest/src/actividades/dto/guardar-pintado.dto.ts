import { IsNumber, Min, Max, IsIn } from 'class-validator';
import { ConDuracionDto } from './con-duracion.dto';
import { ABECEDARIO, EnMayusculas } from '../letras';

export class GuardarPintadoDto extends ConDuracionDto {
  @EnMayusculas()
  @IsIn(ABECEDARIO, { message: 'letraEsperada debe ser una letra de la A a la Z (o Ñ)' })
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
