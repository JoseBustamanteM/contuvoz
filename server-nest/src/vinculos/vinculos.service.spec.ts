import { ForbiddenException } from '@nestjs/common';
import { TipoVinculo } from '@prisma/client';
import { VinculosService } from './vinculos.service';
import { Rol } from '../enums/rol.enum';

/**
 * Matriz de permisos para crear vínculos (ver la tabla en vinculos.service.ts):
 * - Administrador: cualquiera.
 * - Admin. colegio: solo estudiantes de su colegio.
 * - Profesor: solo APODERADO, y solo a sus propios alumnos.
 * - Apoderado y estudiante: nunca.
 */

const COLEGIO = 1;
const OTRO_COLEGIO = 2;

const USUARIOS: Record<number, { idUsuario: number; idRol: Rol; idColegio: number; activo: boolean }> = {
  1: { idUsuario: 1, idRol: Rol.ADMINISTRADOR, idColegio: COLEGIO, activo: true },
  2: { idUsuario: 2, idRol: Rol.ADMIN_COLEGIO, idColegio: COLEGIO, activo: true },
  3: { idUsuario: 3, idRol: Rol.ADMIN_COLEGIO, idColegio: OTRO_COLEGIO, activo: true },
  10: { idUsuario: 10, idRol: Rol.PROFESOR, idColegio: COLEGIO, activo: true }, // profesor del alumno 50
  11: { idUsuario: 11, idRol: Rol.PROFESOR, idColegio: COLEGIO, activo: true }, // otro profesor
  20: { idUsuario: 20, idRol: Rol.APODERADO, idColegio: COLEGIO, activo: true },
  50: { idUsuario: 50, idRol: Rol.ESTUDIANTE, idColegio: COLEGIO, activo: true },
};

function crearServicio() {
  const tx = {
    vinculoEstudiante: { create: jest.fn().mockResolvedValue({ idVinculo: 99 }) },
    auditoria: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    usuario: {
      findUnique: jest.fn(({ where }: { where: { idUsuario: number } }) =>
        Promise.resolve(USUARIOS[where.idUsuario] ?? null),
      ),
    },
    vinculoEstudiante: {
      // esProfesorDe: solo el profesor 10 tiene vínculo PROFESOR vigente con el alumno 50.
      findFirst: jest.fn(({ where }: { where: { idAdulto: number; idEstudiante: number } }) =>
        Promise.resolve(where.idAdulto === 10 && where.idEstudiante === 50 ? { idVinculo: 1 } : null),
      ),
    },
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  return { servicio: new VinculosService(prisma as never), tx };
}

const actor = (id: number) => ({ idUsuario: id, idRol: USUARIOS[id].idRol });
const apoderado = { idEstudiante: 50, idAdulto: 20, tipoVinculo: TipoVinculo.APODERADO };
const profesor = { idEstudiante: 50, idAdulto: 11, tipoVinculo: TipoVinculo.PROFESOR };

describe('VinculosService.crear: quién puede vincular', () => {
  it.each([
    ['administrador → apoderado', 1, apoderado],
    ['administrador → profesor', 1, profesor],
    ['admin. de su colegio → profesor', 2, profesor],
    ['profesor del alumno → apoderado', 10, apoderado],
  ])('permite: %s', async (_caso, idActor, dto) => {
    const { servicio, tx } = crearServicio();

    await expect(servicio.crear(actor(idActor), dto)).resolves.toEqual({ idVinculo: 99 });
    // Cada vínculo creado queda en la auditoría.
    expect(tx.auditoria.create).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['admin. de otro colegio', 3, apoderado],
    ['profesor del alumno → profesor', 10, profesor],
    ['profesor que no es del alumno → apoderado', 11, apoderado],
    ['apoderado', 20, apoderado],
  ])('rechaza: %s', async (_caso, idActor, dto) => {
    const { servicio, tx } = crearServicio();

    await expect(servicio.crear(actor(idActor), dto)).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.vinculoEstudiante.create).not.toHaveBeenCalled();
  });
});
