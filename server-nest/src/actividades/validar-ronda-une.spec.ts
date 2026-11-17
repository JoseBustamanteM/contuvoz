import { BadRequestException } from '@nestjs/common';
import { validarRondaUne } from './actividades.service';
import type { GuardarUnePalabrasDto } from './dto/guardar-une-palabras.dto';

/** Una ronda coherente: 5 pares, "sol" se confundió dos veces con "flor". */
const valida = (): GuardarUnePalabrasDto =>
  ({
    totalPares: 5,
    aciertos: 4,
    errores: 2,
    puntajeFinal: 80,
    duracion: 20,
    pares: ['mamá', 'sol', 'libro', 'flor', 'casa'],
    confusiones: [{ palabra: 'sol', eligio: 'flor', veces: 2 }],
  }) as GuardarUnePalabrasDto;

describe('validarRondaUne', () => {
  it('acepta una ronda coherente', () => {
    expect(() => validarRondaUne(valida())).not.toThrow();
  });

  it('acepta una ronda perfecta, sin confusiones', () => {
    expect(() =>
      validarRondaUne({ ...valida(), aciertos: 5, errores: 0, confusiones: [] }),
    ).not.toThrow();
  });

  it.each<[string, Partial<GuardarUnePalabrasDto>]>([
    ['más aciertos que pares (puntaje sobre 100)', { totalPares: 3, aciertos: 5, pares: ['a', 'b', 'c'], errores: 0, confusiones: [] }],
    ['aciertos que no descuentan las palabras con error', { aciertos: 5 }],
    ['errores que no suman las confusiones', { errores: 7 }],
    ['palabras repetidas', { pares: ['sol', 'sol', 'libro', 'flor', 'casa'] }],
    ['cantidad de palabras distinta de totalPares', { pares: ['sol', 'libro', 'flor', 'casa'] }],
    ['confusión con una palabra de otra ronda', { confusiones: [{ palabra: 'sol', eligio: 'perro', veces: 2 }] }],
    ['confusión de una palabra consigo misma', { confusiones: [{ palabra: 'sol', eligio: 'sol', veces: 2 }] }],
  ])('rechaza: %s', (_caso, cambio) => {
    expect(() => validarRondaUne({ ...valida(), ...cambio } as GuardarUnePalabrasDto)).toThrow(
      BadRequestException,
    );
  });
});
