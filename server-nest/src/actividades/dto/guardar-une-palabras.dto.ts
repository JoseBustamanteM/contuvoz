import {
  IsString, IsInt, IsNumber, IsArray, ValidateNested, Min, Max, Length, ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

/** Una confusión: el niño tocó `palabra` y la unió con el dibujo de `eligio`. */
export class ConfusionDto {
  @IsString() @Length(1, 50) palabra!: string;
  @IsString() @Length(1, 50) eligio!: string;
  @IsInt() @Min(1) veces!: number;
}

export class GuardarUnePalabrasDto {
  @IsInt() @Min(1) @Max(20) totalPares!: number;
  @IsInt() @Min(0) aciertos!: number;
  @IsInt() @Min(0) errores!: number;
  @IsNumber() @Min(0) @Max(100) puntajeFinal!: number;
  @IsInt() @Min(0) duracionUne!: number;

  /** Las palabras que tocaron en esta ronda, en orden. */
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  pares!: string[];

  /**
   * ⚠️ @ValidateNested + @Type son obligatorios: sin ellos el ValidationPipe
   * con `whitelist: true` vacía los objetos del array (quedan como `{}`),
   * porque no sabe qué clase validar y descarta todas las propiedades.
   */
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ConfusionDto)
  confusiones!: ConfusionDto[];
}
