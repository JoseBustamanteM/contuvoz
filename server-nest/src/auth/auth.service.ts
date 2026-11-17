// auth/auth.service.ts
import {
  BadRequestException, HttpException, HttpStatus, Injectable, Logger, UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { SignOptions } from 'jsonwebtoken';
import { limpiarRut } from '../common/validators/rut.validator';
import { ConfigService } from '@nestjs/config';
import type { Entorno } from '../config/entorno';
import { cerrarSesionesDeUsuario } from './sesiones';

const VENTANA_INTENTOS_MS = 15 * 60 * 1000;
const MAX_FALLOS_POR_RUT = 5;
const MAX_FALLOS_POR_IP = 100;

/** Hash de una clave que nadie tiene, con el mismo costo que las reales
 *  (usuarios.service usa 10). Ver login(). */
const HASH_FICTICIO = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 10);

const DIA_MS = 24 * 60 * 60 * 1000;

/** Margen para que dos pestañas renueven a la vez sin que cuente como reúso. */
const GRACIA_REUSO_MS = 30 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
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
    this.sesionMaxDias = config.get('SESION_MAX_DIAS', { infer: true });
  }

  /** Vida máxima de una sesión desde el login, aunque se siga renovando. */
  private readonly sesionMaxDias: number;

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

    return this.generarTokens(
      usuario.idUsuario,
      ip,
      userAgent,
      sesion.idSesion,
      sesion.fechaInicio,
    );
  }

  /**
   * Límite de intentos fallidos, contados en la tabla `sesion` (que ya
   * registra cada intento con su RUT e IP):
   *
   * - Por RUT: 5 fallos en 15 minutos bloquean ese RUT hasta que el más
   *   antiguo de esos 5 cumpla 15 minutos. Un login correcto reinicia la
   *   cuenta. Los intentos hechos durante el bloqueo no se registran, así
   *   que insistir no lo alarga.
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
    idSesion: number,
    inicioSesion: Date,
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

    // Cada refresh dura REFRESH_TOKEN_DIAS, pero nunca más allá de la vida
    // máxima de la sesión: sin este tope, rotar el token cada pocos días
    // mantenía la sesión abierta para siempre.
    const ahora = Date.now();
    const fechaExpiracion = new Date(
      Math.min(
        ahora + this.refreshTokenDias * DIA_MS,
        inicioSesion.getTime() + this.sesionMaxDias * DIA_MS,
      ),
    );

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
      include: { sesion: { select: { fechaInicio: true, fechaFin: true } } },
    });

    if (!tokenValido) {
      await this.detectarReuso(hash);
      throw new UnauthorizedException('Sesión expirada, inicia sesión de nuevo');
    }

    // Sin sesión asociada o con la sesión ya cerrada, no se renueva: toca
    // iniciar sesión de nuevo.
    if (!tokenValido.idSesion || !tokenValido.sesion || tokenValido.sesion.fechaFin) {
      throw new UnauthorizedException('Sesión expirada, inicia sesión de nuevo');
    }

    // Revocar solo si sigue sin revocar, en una sola operación: si llegan dos
    // peticiones a la vez con el mismo token, solo una gana y la otra recibe
    // 401 (antes ambas pasaban la búsqueda y generaban dos tokens nuevos).
    const { count } = await this.prisma.sesionToken.updateMany({
      where: { idSesionToken: tokenValido.idSesionToken, revocado: false },
      data: { revocado: true },
    });

    if (count !== 1) {
      throw new UnauthorizedException('Sesión expirada, inicia sesión de nuevo');
    }

    return this.generarTokens(
      tokenValido.idUsuario,
      ip,
      userAgent,
      tokenValido.idSesion,
      tokenValido.sesion.fechaInicio,
    );
  }

  /**
   * Detección de reúso. Cada refresh token sirve una sola vez: al usarlo se
   * revoca y se entrega otro. Si vuelve a llegar uno ya reemplazado, alguien
   * más tiene una copia (por ejemplo, la cookie robada): no se sabe quién es
   * el legítimo, así que se cierra esa sesión completa y ambos tienen que
   * volver a ingresar.
   *
   * Se da un margen de GRACIA_REUSO_MS desde el reemplazo: dos pestañas que
   * renuevan casi a la vez mandan el mismo token y una pierde, sin que haya
   * nada raro (ver refresh() en el auth.service del frontend).
   */
  private async detectarReuso(hash: string) {
    const usado = await this.prisma.sesionToken.findFirst({
      where: { refreshTokenHash: hash, revocado: true },
      select: {
        idSesionToken: true,
        idSesion: true,
        sesion: { select: { fechaFin: true } },
      },
    });
    // Desconocido, sin sesión o con la sesión ya cerrada (logout, cambio de
    // clave…): no hay nada que proteger.
    if (!usado?.idSesion || !usado.sesion || usado.sesion.fechaFin) return;

    // Su reemplazo es el token siguiente de la misma sesión. Si no hay
    // reemplazo, se revocó por otro motivo y no es reúso.
    const reemplazo = await this.prisma.sesionToken.findFirst({
      where: { idSesion: usado.idSesion, idSesionToken: { gt: usado.idSesionToken } },
      orderBy: { idSesionToken: 'asc' },
      select: { fechaCreacion: true },
    });
    if (!reemplazo) return;
    if (Date.now() - reemplazo.fechaCreacion.getTime() < GRACIA_REUSO_MS) return;

    const idSesion = usado.idSesion;
    await this.prisma.$transaction([
      this.prisma.sesionToken.updateMany({
        where: { idSesion, revocado: false },
        data: { revocado: true },
      }),
      this.prisma.sesion.updateMany({
        where: { idSesion, fechaFin: null },
        data: { fechaFin: new Date(), motivoFin: 'reuso_token' },
      }),
    ]);
    this.logger.warn(`Refresh token reutilizado: sesión ${idSesion} cerrada`);
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

  /**
   * El usuario cambia su propia contraseña. Antes no podía: la clave la
   * elegía quien creaba la cuenta y la conocía para siempre.
   *
   * Exige la contraseña actual, para que alguien que encuentre la sesión
   * abierta en un equipo no pueda adueñarse de la cuenta. Al cambiarla se
   * cierran TODAS las sesiones, también la actual: hay que volver a entrar
   * con la clave nueva, y cualquier otro equipo con la sesión abierta queda
   * fuera.
   */
  async cambiarClave(idUsuario: number, claveActual: string, claveNueva: string) {
    const usuario = await this.prisma.usuario.findFirst({
      where: { idUsuario, activo: true },
      select: { claveHash: true },
    });
    if (!usuario) throw new UnauthorizedException('Usuario no disponible');

    if (!(await bcrypt.compare(claveActual, usuario.claveHash))) {
      throw new BadRequestException('La contraseña actual no es correcta');
    }
    if (claveActual === claveNueva) {
      throw new BadRequestException('La contraseña nueva debe ser distinta de la actual');
    }

    const claveHash = await bcrypt.hash(claveNueva, 10);
    await this.prisma.$transaction(async (tx) => {
      await tx.usuario.update({ where: { idUsuario }, data: { claveHash } });
      await cerrarSesionesDeUsuario(tx, idUsuario, 'cambio_clave');
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
