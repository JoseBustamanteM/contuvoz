import { IsString, IsInt, IsEmail, IsOptional, Length, MinLength } from 'class-validator';
import { IsRut } from '../../common/validators/rut.validator';

export class CrearUsuarioDto {
  @IsInt()
  idRol!: number;

  @IsOptional()
  @IsInt()
  idColegio?: number;   // solo lo usa el Administrador

  @IsRut()
  rutUsuario!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @Length(1, 100)
  primerNombre!: string;

  @IsString()
  @Length(1, 100)
  segundoNombre!: string;

  @IsString()
  @Length(1, 100)
  aPaterno!: string;

  @IsString()
  @Length(1, 100)
  aMaterno!: string;

  @IsString()
  @Length(1, 20)
  telefonoUsuario!: string;

  @IsEmail()
  correo!: string;

  @IsOptional()
  @IsString()
  urlAvatar?: string;
}
