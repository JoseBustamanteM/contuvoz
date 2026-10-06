import { IsEnum, IsInt, Min } from 'class-validator';
import { TipoVinculo } from '@prisma/client';

export class CrearVinculoDto {
  @IsInt()
  @Min(1)
  idEstudiante!: number;

  /** El profesor o apoderado, según tipoVinculo. */
  @IsInt()
  @Min(1)
  idAdulto!: number;

  @IsEnum(TipoVinculo, { message: 'El tipo de vínculo debe ser PROFESOR o APODERADO' })
  tipoVinculo!: TipoVinculo;
}
