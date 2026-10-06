import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression, Timeout } from '@nestjs/schedule';
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
}
