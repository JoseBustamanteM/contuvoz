// src/config/entorno.ts
//
// Variables de entorno del backend, validadas al arrancar.
//
// Antes cada archivo leía process.env por su cuenta y algunos lo hacían al
// importarse (JwtModule.register, constantes de módulo). Eso funcionaba solo
// porque importar @prisma/client carga el .env como efecto secundario; sin esa
// casualidad el secreto JWT llegaba vacío. Ahora ConfigModule carga y valida
// todo aquí, y el resto lo pide a ConfigService cuando lo necesita.
//
// Si falta algo obligatorio o tiene un formato inválido, el backend NO arranca
// y el error dice qué variable revisar.

export interface Entorno {
  DATABASE_URL: string;
  JWT_SECRET: string;
  NODE_ENV: string;
  PORT: number;
  HOST?: string;
  FRONTEND_URL: string;
  /** Vida del token de acceso, en el formato de jsonwebtoken ("15m", "1h"). */
  ACCESS_TOKEN_EXPIRA: string;
  /** Días que dura cada refresh token antes de tener que rotarlo. */
  REFRESH_TOKEN_DIAS: number;
  /** Vida máxima de una sesión desde el login, aunque se siga renovando. */
  SESION_MAX_DIAS: number;
  ZONA_HORARIA: string;
}

const LARGO_MINIMO_SECRETO = 32;

function entero(nombre: string, valor: unknown, porDefecto: number, errores: string[]): number {
  if (valor === undefined || valor === '') return porDefecto;
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) {
    errores.push(`${nombre} debe ser un entero positivo (llegó "${String(valor)}")`);
    return porDefecto;
  }
  return n;
}

function texto(valor: unknown, porDefecto: string): string {
  return typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : porDefecto;
}

/** Se pasa a ConfigModule.forRoot({ validate }). */
export function validarEntorno(crudo: Record<string, unknown>): Entorno {
  const errores: string[] = [];

  const databaseUrl = texto(crudo.DATABASE_URL, '');
  if (!databaseUrl) errores.push('Falta DATABASE_URL');

  const jwtSecret = texto(crudo.JWT_SECRET, '');
  if (!jwtSecret) {
    errores.push('Falta JWT_SECRET');
  } else if (jwtSecret.length < LARGO_MINIMO_SECRETO) {
    errores.push(
      `JWT_SECRET es demasiado corto (mínimo ${LARGO_MINIMO_SECRETO} caracteres). ` +
        'Genera uno con: openssl rand -hex 32',
    );
  }

  const accessExpira = texto(crudo.ACCESS_TOKEN_EXPIRA, '15m');
  if (!/^\d+[smhd]?$/.test(accessExpira)) {
    errores.push(`ACCESS_TOKEN_EXPIRA debe ser como "15m" o "1h" (llegó "${accessExpira}")`);
  }

  const zonaHoraria = texto(crudo.ZONA_HORARIA, 'America/Santiago');
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: zonaHoraria });
  } catch {
    errores.push(`ZONA_HORARIA no es una zona válida (llegó "${zonaHoraria}")`);
  }

  const entorno: Entorno = {
    DATABASE_URL: databaseUrl,
    JWT_SECRET: jwtSecret,
    NODE_ENV: texto(crudo.NODE_ENV, 'development'),
    PORT: entero('PORT', crudo.PORT, 4000, errores),
    HOST: texto(crudo.HOST, '') || undefined,
    FRONTEND_URL: texto(crudo.FRONTEND_URL, 'http://localhost:4200'),
    ACCESS_TOKEN_EXPIRA: accessExpira,
    REFRESH_TOKEN_DIAS: entero('REFRESH_TOKEN_DIAS', crudo.REFRESH_TOKEN_DIAS, 7, errores),
    SESION_MAX_DIAS: entero('SESION_MAX_DIAS', crudo.SESION_MAX_DIAS, 30, errores),
    ZONA_HORARIA: zonaHoraria,
  };

  if (entorno.SESION_MAX_DIAS < entorno.REFRESH_TOKEN_DIAS) {
    errores.push('SESION_MAX_DIAS no puede ser menor que REFRESH_TOKEN_DIAS');
  }

  if (errores.length > 0) {
    throw new Error(
      'Configuración inválida en server-nest/.env:\n  - ' + errores.join('\n  - '),
    );
  }

  return entorno;
}
