import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { join } from 'node:path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.set('etag', false);

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
    }),
  );

  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:4200',
    credentials: true,
  });

  /*
   * Biblioteca uploaded files
   *
   * Physical directory:
   *   server-nest/uploads/biblioteca/
   *
   * Public URL:
   *   http://localhost:4000/uploads/biblioteca/<filename>
   */
  const uploadsPath = join(
    process.cwd(),
    'uploads',
    'biblioteca',
  );

  app.useStaticAssets(uploadsPath, {
    prefix: '/uploads/biblioteca',
  });

  await app.listen(process.env.PORT ?? 4000);
}

bootstrap();
