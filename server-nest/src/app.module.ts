// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ActividadesModule } from './actividades/actividades.module';
import { ScheduleModule } from '@nestjs/schedule';
import { UsuariosModule } from './usuarios/dto/usuarios.module';
import { ColegiosModule } from './colegios/colegios.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    ActividadesModule,
     UsuariosModule,
     ColegiosModule,
  ],
})
export class AppModule {}
