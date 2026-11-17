// auth/strategies/jwt.strategy.ts
import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import type { Entorno } from '../../config/entorno';

/** Lo único que puede hacer quien debe cambiar su clave: ver sus datos (el
 *  perfil) y cambiarla. Cerrar sesión no pasa por aquí (no usa el token). */
const PERMITIDO_CON_CLAVE_PENDIENTE = new Set(['GET /api/auth/me', 'POST /api/auth/cambiar-clave']);

/** Código que el frontend reconoce para llevar al perfil. */
export const CAMBIO_CLAVE_PENDIENTE = 'CAMBIO_CLAVE_PENDIENTE';

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
      passReqToCallback: true,
    });
  }

  /**
   * El token dura 15 minutos y en ese tiempo la cuenta puede cambiar. Por eso
   * se consulta la base en cada petición: un usuario desactivado queda fuera
   * de inmediato, y el rol que se usa para los permisos es el actual, no el
   * que tenía al iniciar sesión.
   *
   * Un adulto con una clave que le dio otra persona (debe_cambiar_clave) solo
   * puede ver su perfil y cambiarla: el frontend lo lleva ahí, y esto evita
   * que se salte ese paso llamando a la API directamente.
   */
  async validate(req: Request, payload: { sub: number; rol: number }) {
    const usuario = await this.prisma.usuario.findFirst({
      where: { idUsuario: payload.sub, activo: true },
      select: { idUsuario: true, idRol: true, debeCambiarClave: true },
    });

    if (!usuario) throw new UnauthorizedException('Usuario no disponible');

    if (usuario.debeCambiarClave && !PERMITIDO_CON_CLAVE_PENDIENTE.has(`${req.method} ${req.path}`)) {
      throw new ForbiddenException({
        statusCode: 403,
        codigo: CAMBIO_CLAVE_PENDIENTE,
        message: 'Antes de seguir, cambia la contraseña que te dieron.',
      });
    }

    return { idUsuario: usuario.idUsuario, idRol: usuario.idRol };
  }
}
