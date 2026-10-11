import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class EditarArchivoBibliotecaDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  tituloArchivo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descripcionArchivo?: string;
}
