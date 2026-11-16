// auth/auth.service.ts
import {
  HttpException, HttpStatus, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { SignOptions } from 'jsonwebtoken';
import { limpiarRut } from '../common/validators/rut.validator';
import { ConfigService } from '@nestjs/config';
import type { Entorno } from '../config/entorno';

const VENTANA_INTENTOS_MS = 15 * 60 * 1000;
const MAX_FALLOS_POR_RUT = 5;
const MAX_FALLOS_POR_IP = 100;

/** Hash de una clave que nadie tiene, con el mismo costo que las reales
 *  (usuarios.service usa 10). Ver login(). */
const HASH_FICTICIO = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 10);

@Injectable()
export class AuthService {
  private readonly accessTokenExpira: SignOptions['expiresIn'];
  /** Días de vida de cada refresh token (también lo usa la cookie). */
  readonly refreshTokenDias: number;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    config: ConfigService<Entorno, true>,
  ) {
    this.accessTokenExpira = config.get('ACCESS_TOKEN_EXPIRA', {
      infer: true,
    }) as SignOptions['expiresIn'];
    this.refreshTokenDias = config.get('REFRESH_TOKEN_DIAS', { infer: true });
  }

  private hashRefreshToken(tokenPlano: string): string {
    return crypto.createHash('sha256').update(tokenPlano).digest('hex');
  }

  async login(rutUsuario: string, password: string, ip: string, userAgent: string) {
    // Normalizado (sin puntos ni guion) para que "19.497.449-3" y "194974493"
    // cuenten como el mismo RUT al limitar intentos.
    const rutNormalizado = limpiarRut(rutUsuario).slice(0, 20);

    await this.verificarLimiteDeIntentos(rutNormalizado, ip);

    const usuario = await this.prisma.usuario.findFirst({
      where: { rutUsuario: rutNormalizado, activo: true },
    });

    // Si el RUT no existe se compara igual contra un hash ficticio: así la
    // respuesta tarda lo mismo y no se puede saber por el tiempo qué RUTs
    // tienen cuenta.
    const claveCorrecta = await bcrypt.compare(
      password,
      usuario?.claveHash ?? HASH_FICTICIO,
    );
    const loginValido = !!usuario && claveCorrecta;

    const sesion = await this.prisma.sesion.create({
      data: {
        idUsuario: usuario?.idUsuario ?? null,
        rutIntentado: rutNormalizado,
        exitosa: loginValido,
        ipOrigen: ip,
        userAgent,
      },
    });

    if (!loginValido) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return this.generarTokens(usuario.idUsuario, ip, userAgent, sesion.idSesion);
  }

  /**
   * Límite de intentos fallidos, contados en la tabla `sesion` (que ya
   * registra cada intento con su RUT e IP):
   *
   * - Por RUT: 5 fallos en 15 minutos bloquean ese RUT hasta que el más
   *   antiguo de esos 5 cumpla 15 minutos. Un login correcto reinicia la
   *   cuenta. Los intentos bloqueados no se registran, para que alguien no
   *   pueda mantener bloqueada la cuenta de otro indefinidamente.
   * - Por IP: 100 fallos en 15 minutos. Es holgado a propósito: todo un
   *   colegio sale a internet con la misma IP y los niños se equivocan.
   */
  private async verificarLimiteDeIntentos(rut: string, ip: string) {
    const ahora = Date.now();
    const desde = new Date(ahora - VENTANA_INTENTOS_MS);

    const ultimoExito = await this.prisma.sesion.findFirst({
      where: { rutIntentado: rut, exitosa: true, fechaInicio: { gte: desde } },
      orderBy: { fechaInicio: 'desc' },
      select: { fechaInicio: true },
    });

    const fallosRut = await this.prisma.sesion.findMany({
      where: {
        rutIntentado: rut,
        exitosa: false,
        fechaInicio: ultimoExito ? { gt: ultimoExito.fechaInicio } : { gte: desde },
      },
      orderBy: { fechaInicio: 'desc' },
      take: MAX_FALLOS_POR_RUT,
      select: { fechaInicio: true },
    });

    if (fallosRut.length >= MAX_FALLOS_POR_RUT) {
      const masAntiguo = fallosRut[fallosRut.length - 1].fechaInicio.getTime();
      const minutos = Math.max(1, Math.ceil((masAntiguo + VENTANA_INTENTOS_MS - ahora) / 60_000));
      throw new HttpException(
        `Demasiados intentos fallidos con este RUT. Espera ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'} antes de volver a intentar.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!ip) return;

    const fallosIp = await this.prisma.sesion.count({
      where: { ipOrigen: ip, exitosa: false, fechaInicio: { gte: desde } },
    });

    if (fallosIp >= MAX_FALLOS_POR_IP) {
      throw new HttpException(
        'Demasiados intentos fallidos desde esta conexión. Espera unos minutos antes de volver a intentar.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
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
      { expiresIn: this.accessTokenExpira },
    );

    const refreshTokenPlano = crypto.randomBytes(64).toString('hex');
    const hash = this.hashRefreshToken(refreshTokenPlano);

    const fechaExpiracion = new Date();
    fechaExpiracion.setDate(fechaExpiracion.getDate() + this.refreshTokenDias);

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
