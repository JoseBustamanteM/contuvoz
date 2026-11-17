import {
  IsString, IsInt, IsEmail, IsOptional, IsIn, Length, Matches, MaxLength, MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { IsRut } from '../../common/validators/rut.validator';
import { Rol } from '../../enums/rol.enum';

/** Roles válidos (1 a 5). Si el rol no existe, la base respondía con un
 *  error de llave foránea (500) en vez de un 400 claro. */
const ROLES_VALIDOS = Object.values(Rol).filter((v): v is Rol => typeof v === 'number');

/** Avatar: una ruta del propio sitio (/assets/...) o una dirección https.
 *  Nada de javascript:, data: u otros esquemas. */
const PATRON_AVATAR = /^(\/|https:\/\/)[\w\-./%~]+$/;

/** Un campo vacío del formulario ("") llega como null: "sin dato". */
const VacioANull = () => Transform(({ value }) => (value === '' ? null : value));

export class ActualizarUsuarioDto {
  @IsOptional()
  @IsInt()
  @IsIn(ROLES_VALIDOS, { message: 'El rol no existe' })
  idRol?: number;

  @IsOptional()
  @IsRut()
  rutUsuario?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(72, { message: 'La contraseña no puede superar 72 caracteres' })
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

  // undefined = no se cambia; "" o null = se borra (solo permitido si el
  // usuario queda como ESTUDIANTE, lo valida UsuariosService).
  @VacioANull()
  @IsOptional()
  @IsString()
  @Length(1, 20)
  telefonoUsuario?: string | null;

  @VacioANull()
  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  correo?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(PATRON_AVATAR, { message: 'urlAvatar debe ser una ruta del sitio o una dirección https' })
  urlAvatar?: string;
}
