// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ActividadesModule } from './actividades/actividades.module';
import { ScheduleModule } from '@nestjs/schedule';
import { UsuariosModule } from './usuarios/dto/usuarios.module';
import { ColegiosModule } from './colegios/colegios.module';
import { VinculosModule } from './vinculos/vinculos.module';
import { MisLogrosModule } from './mis-logros/mis-logros.module';
import { validarEntorno } from './config/entorno';

@Module({
  imports: [
    // Carga y valida el .env al arrancar (ver src/config/entorno.ts).
    ConfigModule.forRoot({ isGlobal: true, validate: validarEntorno }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    ActividadesModule,
     UsuariosModule,
     ColegiosModule,
    VinculosModule,
    MisLogrosModule,
  ],
})
export class AppModule {}
