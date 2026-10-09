import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

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
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:4200',
    credentials: true,
  });

  // HOST=127.0.0.1 en el servidor: el backend solo es accesible a través de
  // Nginx, no directo desde internet por el puerto 4000.
  const puerto = process.env.PORT ?? 4000;
  if (process.env.HOST) await app.listen(puerto, process.env.HOST);
  else await app.listen(puerto);
}
bootstrap();
