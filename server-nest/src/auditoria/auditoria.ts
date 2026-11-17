// src/auditoria/auditoria.ts
import type { Prisma, PrismaClient } from '@prisma/client';

export type AccionAuditoria =
  | 'crear_usuario'
  | 'editar_usuario'
  | 'desactivar_usuario'
  | 'reactivar_usuario'
  | 'cambio_clave_propia'
  | 'crear_vinculo'
  | 'deshabilitar_vinculo';

export interface RegistroAuditoria {
  /** Quién hizo el cambio. */
  idActor: number;
  /** A quién afecta (el usuario editado, el estudiante del vínculo…). */
  idUsuarioAfectado?: number | null;
  accion: AccionAuditoria;
  /** Contexto del cambio. NUNCA contraseñas ni hashes: solo nombres de
   *  campos y valores que no sean secretos (rol, ids). */
  detalle?: Prisma.InputJsonValue;
  ip?: string;
}

/**
 * Deja constancia de un cambio en la tabla `auditoria`. Se llama con la
 * transacción del cambio, para que ambos queden juntos o ninguno.
 *
 * Para consultar, por ejemplo, todo lo que le pasó a un usuario:
 *   SELECT a.fecha, a.accion, a.detalle, u.primer_nombre AS quien
 *     FROM auditoria a JOIN usuario u ON u.id_usuario = a.id_actor
 *    WHERE a.id_usuario_afectado = ? ORDER BY a.fecha DESC;
 */
export function registrarAuditoria(
  db: PrismaClient | Prisma.TransactionClient,
  registro: RegistroAuditoria,
) {
  return db.auditoria.create({
    data: {
      idActor: registro.idActor,
      idUsuarioAfectado: registro.idUsuarioAfectado ?? null,
      accion: registro.accion,
      detalle: registro.detalle,
      ipOrigen: registro.ip?.slice(0, 45) || null,
    },
  });
}
