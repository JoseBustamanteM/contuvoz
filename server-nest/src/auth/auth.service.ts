// auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type { SignOptions } from 'jsonwebtoken';
import { limpiarRut } from '../common/validators/rut.validator';


const ACCESS_TOKEN_EXPIRA = (process.env.ACCESS_TOKEN_EXPIRA ??
  '15m') as SignOptions['expiresIn'];
const REFRESH_TOKEN_DIAS = Number(process.env.REFRESH_TOKEN_DIAS ?? 7);

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
  const rutNormalizado = limpiarRut(rutUsuario);

  const usuario = await this.prisma.usuario.findFirst({
    where: { rutUsuario: rutNormalizado, activo: true },
  });

  const loginValido = usuario && (await bcrypt.compare(password, usuario.claveHash));

  const sesion = await this.prisma.sesion.create({
    data: {
      idUsuario: usuario?.idUsuario ?? null,
      rutIntentado: rutUsuario,
      exitosa: loginValido ? true : false,
      ipOrigen: ip,
      userAgent,
    },
  });

  if (!loginValido) {
    throw new UnauthorizedException('Credenciales inválidas');
  }

  return this.generarTokens(usuario.idUsuario, ip, userAgent, sesion.idSesion);
}

  async generarTokens(
    idUsuario: number,
    ip: string,
    userAgent: string,
    idSesion: number | null = null,
  ) {

     const usuario = await this.prisma.usuario.findFirst({
    where: { idUsuario, activo: true },
    select: { idRol: true },
  });

  if (!usuario) {
    throw new UnauthorizedException('Usuario no disponible');
  }
    const accessToken = this.jwtService.sign(
      { sub: idUsuario, rol: usuario.idRol },
      { expiresIn: ACCESS_TOKEN_EXPIRA },
    );

    const refreshTokenPlano = crypto.randomBytes(64).toString('hex');
    const hash = this.hashRefreshToken(refreshTokenPlano);

    const fechaExpiracion = new Date();
    fechaExpiracion.setDate(fechaExpiracion.getDate() + REFRESH_TOKEN_DIAS);

    await this.prisma.sesionToken.create({
      data: {
        idUsuario,
        idSesion,
        refreshTokenHash: hash,
        fechaExpiracion,
        ipOrigen: ip,
        userAgent,
      },
    });

    await this.prisma.usuario.update({
      where: { idUsuario },
      data: { ultActividad: new Date() },
    });

    return { accessToken, refreshTokenPlano };
  }

  async refrescarToken(refreshTokenPlano: string, ip: string, userAgent: string) {
    if (!refreshTokenPlano) throw new UnauthorizedException();

    const hash = this.hashRefreshToken(refreshTokenPlano);

    const tokenValido = await this.prisma.sesionToken.findFirst({
      where: {
        refreshTokenHash: hash,
        revocado: false,
        fechaExpiracion: { gt: new Date() },
      },
    });

    if (!tokenValido) {
      throw new UnauthorizedException('Sesión expirada, inicia sesión de nuevo');
    }

    await this.prisma.sesionToken.update({
      where: { idSesionToken: tokenValido.idSesionToken },
      data: { revocado: true },
    });

    return this.generarTokens(
      tokenValido.idUsuario,
      ip,
      userAgent,
      tokenValido.idSesion,
    );
  }

  async logout(refreshTokenPlano: string) {
    if (!refreshTokenPlano) return;
    const hash = this.hashRefreshToken(refreshTokenPlano);

    const token = await this.prisma.sesionToken.findFirst({
      where: { refreshTokenHash: hash, revocado: false },
    });

    if (!token) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.sesionToken.update({
        where: { idSesionToken: token.idSesionToken },
        data: { revocado: true },
      });

      if (token.idSesion) {
        await tx.sesion.update({
          where: { idSesion: token.idSesion },
          data: { fechaFin: new Date(), motivoFin: 'logout' },
        });
      }
    });
  }

  async obtenerUsuario(idUsuario: number) {
    const usuario = await this.prisma.usuario.findFirst({
      where: { idUsuario, activo: true },
      select: {
        idUsuario: true,
        rutUsuario: true,
        primerNombre: true,
        segundoNombre: true,
        aPaterno: true,
        aMaterno: true,
        correo: true,
        urlAvatar: true,
        idRol: true,
        idColegio: true,
        rol: { select: { nomRol: true } },
        colegio: { select: { nomColegio: true } },
      },
    });

    if (!usuario) throw new UnauthorizedException('Usuario no encontrado');

    return usuario;
  }
}
