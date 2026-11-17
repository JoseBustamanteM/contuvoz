// auth/dto/cambiar-clave.dto.ts
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CambiarClaveDto {
  @IsString()
  @IsNotEmpty({ message: 'Escribe tu contraseña actual' })
  @MaxLength(128)
  claveActual!: string;

  // Mismas reglas que al crear un usuario: mínimo 8 y máximo 72 (lo que
  // considera bcrypt).
  @IsString()
  @MinLength(8, { message: 'La contraseña nueva debe tener al menos 8 caracteres' })
  @MaxLength(72, { message: 'La contraseña nueva no puede superar 72 caracteres' })
  claveNueva!: string;
}
