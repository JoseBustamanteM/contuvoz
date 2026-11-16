// src/auth/sesiones.ts
import type { Prisma, PrismaClient } from '@prisma/client';

/** Por qué se cerraron las sesiones de un usuario (queda en sesion.motivo_fin). */
export type MotivoCierre = 'cambio_clave' | 'cambio_rol' | 'desactivado';

/**
 * Cierra TODAS las sesiones abiertas de un usuario: revoca sus refresh tokens
 * y marca el fin de cada sesión.
 *
 * Se usa cuando cambia algo que debe sacarlo de la app en todos sus equipos
 * (nueva contraseña, otro rol, cuenta desactivada). Sin esto, la rotación del
 * refresh mantenía viva la sesión anterior indefinidamente. El token de acceso
 * que ya tenga deja de servir en la siguiente petición: JwtStrategy revisa que
 * la cuenta siga activa, y al vencer (15 min) ya no hay refresh con qué
 * renovarlo.
 *
 * Recibe el cliente de Prisma o una transacción, para ir junto con el cambio
 * que lo provoca.
 */
export async function cerrarSesionesDeUsuario(
  db: PrismaClient | Prisma.TransactionClient,
  idUsuario: number,
  motivo: MotivoCierre,
): Promise<void> {
  await db.sesionToken.updateMany({
    where: { idUsuario, revocado: false },
    data: { revocado: true },
  });

  await db.sesion.updateMany({
    where: { idUsuario, exitosa: true, fechaFin: null },
    data: { fechaFin: new Date(), motivoFin: motivo },
  });
}
