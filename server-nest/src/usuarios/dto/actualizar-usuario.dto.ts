import {
  IsString, IsInt, IsEmail, IsOptional, Length, MinLength,
} from 'class-validator';
import { IsRut } from '../../common/validators/rut.validator';

export class ActualizarUsuarioDto {
  @IsOptional()
  @IsInt()
  idRol?: number;

  @IsOptional()
  @IsRut()
  rutUsuario?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  primerNombre?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  segundoNombre?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  aPaterno?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  aMaterno?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  telefonoUsuario?: string;

  @IsOptional()
  @IsEmail()
  correo?: string;

  @IsOptional()
  @IsString()
  urlAvatar?: string;
}
