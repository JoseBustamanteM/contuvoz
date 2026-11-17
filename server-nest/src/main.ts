import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import type { Entorno } from './config/entorno';
import { PrismaExcepcionFilter } from './common/filtros/prisma-excepcion.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Todas las rutas bajo /api (/api/auth/login, /api/usuarios…). En el
  // servidor, Nginx sirve el frontend en / y manda /api/ al backend: una sola
  // dirección para todo, que es lo que necesita la cookie de sesión
  // (sameSite strict) para viajar.
  app.setGlobalPrefix('api');

  // Detrás de Nginx (en la misma máquina), req.ip debe ser la IP real del
  // visitante (X-Forwarded-For) y no 127.0.0.1. Se registra en `sesion`.
  app.set('trust proxy', 'loopback');

  app.set('etag', false);

  app.use(cookieParser());
  // whitelist + forbidNonWhitelisted: un campo que el DTO no declara se
  // rechaza con 400 en vez de descartarse en silencio (así un error de
  // nombre en el frontend se nota de inmediato). transform: el DTO llega
  // como instancia de su clase, con los tipos ya convertidos.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new PrismaExcepcionFilter());
  const config = app.get<ConfigService<Entorno, true>>(ConfigService);

  app.enableCors({
    origin: config.get('FRONTEND_URL', { infer: true }),
    credentials: true,
  });

  // HOST=127.0.0.1 en el servidor: el backend solo es accesible a través de
  // Nginx, no directo desde internet por el puerto 4000.
  const puerto = config.get('PORT', { infer: true });
  const host = config.get('HOST', { infer: true });
  if (host) await app.listen(puerto, host);
  else await app.listen(puerto);
}
bootstrap();
