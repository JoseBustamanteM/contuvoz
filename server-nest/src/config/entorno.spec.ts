import { validarEntorno } from './entorno';

const SECRETO = 'x'.repeat(64);
const minimo = { DATABASE_URL: 'mysql://u:p@localhost/db', JWT_SECRET: SECRETO };

describe('validarEntorno', () => {
  it('completa los valores por defecto', () => {
    expect(validarEntorno(minimo)).toMatchObject({
      PORT: 4000,
      FRONTEND_URL: 'http://localhost:4200',
      ACCESS_TOKEN_EXPIRA: '15m',
      REFRESH_TOKEN_DIAS: 7,
      SESION_MAX_DIAS: 30,
      ZONA_HORARIA: 'America/Santiago',
    });
  });

  it('convierte los números que llegan como texto desde el .env', () => {
    expect(validarEntorno({ ...minimo, PORT: '5000', REFRESH_TOKEN_DIAS: '3' })).toMatchObject({
      PORT: 5000,
      REFRESH_TOKEN_DIAS: 3,
    });
  });

  it.each([
    ['sin JWT_SECRET', { DATABASE_URL: minimo.DATABASE_URL }, 'Falta JWT_SECRET'],
    ['JWT_SECRET corto', { ...minimo, JWT_SECRET: 'corto' }, 'demasiado corto'],
    ['sin DATABASE_URL', { JWT_SECRET: SECRETO }, 'Falta DATABASE_URL'],
    ['zona horaria inválida', { ...minimo, ZONA_HORARIA: 'Marte/Base' }, 'ZONA_HORARIA'],
    ['puerto no numérico', { ...minimo, PORT: 'abc' }, 'PORT'],
    ['sesión más corta que el refresh', { ...minimo, SESION_MAX_DIAS: '3' }, 'SESION_MAX_DIAS'],
  ])('falla al arrancar: %s', (_caso, entorno, mensaje) => {
    expect(() => validarEntorno(entorno)).toThrow(mensaje);
  });
});
