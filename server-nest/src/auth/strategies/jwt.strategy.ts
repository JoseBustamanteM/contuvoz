// auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import type { Entorno } from '../../config/entorno';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService<Entorno, true>,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', { infer: true }),
    });
  }

  /**
   * El token dura 15 minutos y en ese tiempo la cuenta puede cambiar. Por eso
   * se consulta la base en cada petición: un usuario desactivado queda fuera
   * de inmediato, y el rol que se usa para los permisos es el actual, no el
   * que tenía al iniciar sesión.
   */
  async validate(payload: { sub: number; rol: number }) {
    const usuario = await this.prisma.usuario.findFirst({
      where: { idUsuario: payload.sub, activo: true },
      select: { idUsuario: true, idRol: true },
    });

    if (!usuario) throw new UnauthorizedException('Usuario no disponible');

    return { idUsuario: usuario.idUsuario, idRol: usuario.idRol };
  }
}
