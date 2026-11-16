// auth/dto/login.dto.ts
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class LoginDto {
  // Un RUT con puntos y guion ocupa 12 caracteres; 20 es lo que admite
  // sesion.rut_intentado. Más largo no puede ser un RUT.
  @IsString()
  @IsNotEmpty()
  @MaxLength(20, { message: 'El RUT es demasiado largo' })
  rutUsuario!: string;

  // bcrypt solo considera los primeros 72 bytes; el tope evita además que
  // alguien mande megas de texto para hacer trabajar al servidor.
  @IsString()
  @IsNotEmpty()
  @MaxLength(128, { message: 'La contraseña es demasiado larga' })
  password!: string;
}
