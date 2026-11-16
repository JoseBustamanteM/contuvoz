// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { SignOptions } from 'jsonwebtoken';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { SesionesCleanupService } from './tasks/sesiones-cleanup.service';
import type { Entorno } from '../config/entorno';

@Module({
  imports: [
    PassportModule,
    // registerAsync: el secreto se lee cuando ConfigModule ya cargó y validó el
    // .env, no al importar este archivo (ver src/config/entorno.ts).
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Entorno, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: {
          expiresIn: config.get('ACCESS_TOKEN_EXPIRA', { infer: true }) as SignOptions['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, SesionesCleanupService],
  exports: [AuthService],
})
export class AuthModule {}
