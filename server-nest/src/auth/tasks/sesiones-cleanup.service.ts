import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression, Timeout } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SesionesCleanupService {
  private readonly logger = new Logger(SesionesCleanupService.name);

  constructor(private prisma: PrismaService) {}


   @Timeout(5000)
  async limpiezaInicial() {
    this.logger.log('Ejecutando limpieza de sesiones al arrancar...');
    await this.cerrarSesionesExpiradas();
  }

  @Cron(CronExpression.EVERY_HOUR )
  async cerrarSesionesExpiradas() {
    const ahora = new Date();

    // Una sesión se cierra solo cuando NINGUNO de sus tokens sigue vivo.
    // (El refresh rota tokens: hay revocados viejos con uno activo nuevo.)
    const sesiones = await this.prisma.sesion.findMany({
      where: {
        fechaFin: null,
        exitosa: true,
        AND: [
          { sesionTokens: { some: {} } },
          {
            sesionTokens: {
              none: { revocado: false, fechaExpiracion: { gt: ahora } },
            },
          },
        ],
      },
      select: { idSesion: true },
    });

    if (sesiones.length === 0) return;

    await this.prisma.sesion.updateMany({
      where: { idSesion: { in: sesiones.map((s) => s.idSesion) } },
      data: { fechaFin: ahora, motivoFin: 'expiracion' },
    });

    this.logger.log(`Sesiones cerradas por expiración: ${sesiones.length}`);
  }

  /**
   * Borra el historial de sesiones viejo. Cada login (bueno o malo) agrega
   * una fila a `sesion` y cada renovación una a `sesion_token`: sin purga
   * crecen sin fin.
   *
   * - Tokens vencidos hace más de 30 días: ya no sirven para nada (la sesión
   *   dura como máximo SESION_MAX_DIAS, 30 por defecto).
   * - Sesiones terminadas, e intentos fallidos, de hace más de 180 días: se
   *   guarda medio año de historial de accesos. El límite de intentos solo
   *   mira los últimos 15 minutos.
   */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async purgarHistorialViejo() {
    const hace = (dias: number) => new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

    const tokens = await this.prisma.sesionToken.deleteMany({
      where: { fechaExpiracion: { lt: hace(30) } },
    });

    const viejas: Prisma.SesionWhereInput = {
      OR: [
        { fechaFin: { lt: hace(180) } },
        { exitosa: false, fechaInicio: { lt: hace(180) } },
      ],
    };
    // Primero los tokens que aún apunten a esas sesiones (llave foránea).
    await this.prisma.sesionToken.deleteMany({ where: { sesion: viejas } });
    const sesiones = await this.prisma.sesion.deleteMany({ where: viejas });

    if (tokens.count || sesiones.count) {
      this.logger.log(
        `Purga: ${tokens.count} tokens vencidos y ${sesiones.count} sesiones antiguas borradas`,
      );
    }
  }
}
