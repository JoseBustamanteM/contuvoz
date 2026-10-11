// auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  private hashRefreshToken(tokenPlano: string): string {
    return crypto.createHash('sha256').update(tokenPlano).digest('hex');
  }

  async login(rutUsuario: string, password: string, ip: string, userAgent: string) {
    const usuario = await this.prisma.usuario.findFirst({
      where: { rutUsuario, activo: 1 },
    });

    const loginValido = usuario && (await bcrypt.compare(password, usuario.password));

    await this.prisma.sesion.create({
      data: {
        idUsuario: usuario?.idUsuario ?? null,
        rutIntentado: rutUsuario,
        exitosa: loginValido ? 1 : 0,
        ipOrigen: ip,
        userAgent,
      },
    });

    if (!loginValido) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return this.generarTokens(usuario.idUsuario, ip, userAgent);
  }

  async generarTokens(idUsuario: number, ip: string, userAgent: string) {
    const accessToken = this.jwtService.sign(
      { sub: idUsuario },
      { expiresIn: '15m' },
    );

    const refreshTokenPlano = crypto.randomBytes(64).toString('hex');
    const refreshTokenHash = this.hashRefreshToken(refreshTokenPlano);

    const fechaExpiracion = new Date();
    fechaExpiracion.setDate(fechaExpiracion.getDate() + 7);

    await this.prisma.sesionToken.create({
      data: {
        idUsuario,
        refreshToken: refreshTokenHash,
        fechaExpiracion,
        ipOrigen: ip,
        userAgent,
      },
    });

    return { accessToken, refreshTokenPlano };
  }

  async refrescarToken(refreshTokenPlano: string, ip: string, userAgent: string) {
    if (!refreshTokenPlano) throw new UnauthorizedException();

    const hash = this.hashRefreshToken(refreshTokenPlano);

    const tokenValido = await this.prisma.sesionToken.findFirst({
      where: {
        refreshToken: hash,
        revocado: 0,
        fechaExpiracion: { gt: new Date() },
      },
    });

    if (!tokenValido) {
      throw new UnauthorizedException('Sesión expirada, inicia sesión de nuevo');
    }

    // Rotación: revocamos el usado y creamos uno nuevo
    await this.prisma.sesionToken.update({
      where: { idSesionToken: tokenValido.idSesionToken },
      data: { revocado: 1 },
    });

    return this.generarTokens(tokenValido.idUsuario, ip, userAgent);
  }

  async logout(refreshTokenPlano: string) {
    if (!refreshTokenPlano) return;
    const hash = this.hashRefreshToken(refreshTokenPlano);

    await this.prisma.sesionToken.updateMany({
      where: { refreshToken: hash, revocado: 0 },
      data: { revocado: 1 },
    });
  }
}
