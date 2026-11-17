import { ForbiddenException } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { Rol } from '../enums/rol.enum';

/**
 * Matriz de permisos para ver/editar a un usuario (verificarAlcance), probada
 * a través de obtenerUno:
 * - Administrador: a cualquiera.
 * - Admin. colegio: profesores, apoderados y estudiantes de SU colegio.
 * - Profesor: solo sus alumnos y los apoderados de ellos (o los que creó).
 * - Apoderado: a nadie.
 */

const COLEGIO = 1;

const USUARIOS: Record<number, { idUsuario: number; idRol: Rol; idColegio: number }> = {
  1: { idUsuario: 1, idRol: Rol.ADMINISTRADOR, idColegio: COLEGIO },
  2: { idUsuario: 2, idRol: Rol.ADMIN_COLEGIO, idColegio: COLEGIO },
  3: { idUsuario: 3, idRol: Rol.ADMIN_COLEGIO, idColegio: 2 }, // otro colegio
  10: { idUsuario: 10, idRol: Rol.PROFESOR, idColegio: COLEGIO },
  20: { idUsuario: 20, idRol: Rol.APODERADO, idColegio: COLEGIO },
  50: { idUsuario: 50, idRol: Rol.ESTUDIANTE, idColegio: COLEGIO }, // alumno del profesor 10
  51: { idUsuario: 51, idRol: Rol.ESTUDIANTE, idColegio: COLEGIO }, // alumno de otro profesor
};

/** Alumnos del profesor 10 y apoderados de ellos (lo que resuelve alcanceProfesor en la base). */
const EN_ALCANCE_DEL_PROFESOR = new Set([50, 20]);

function crearServicio() {
  const prisma = {
    usuario: {
      findUnique: jest.fn(({ where }: { where: { idUsuario: number } }) =>
        Promise.resolve(USUARIOS[where.idUsuario] ?? null),
      ),
      count: jest.fn(({ where }: { where: { idUsuario: number } }) =>
        Promise.resolve(EN_ALCANCE_DEL_PROFESOR.has(where.idUsuario) ? 1 : 0),
      ),
    },
  };
  return new UsuariosService(prisma as never, {} as never);
}

const actor = (id: number) => ({ idUsuario: id, idRol: USUARIOS[id].idRol });

describe('UsuariosService: quién puede ver y editar a quién', () => {
  it.each([
    ['administrador → admin. colegio', 1, 2],
    ['administrador → alumno', 1, 51],
    ['admin. colegio → alumno de su colegio', 2, 51],
    ['admin. colegio → profesor de su colegio', 2, 10],
    ['profesor → su alumno', 10, 50],
    ['profesor → apoderado de su alumno', 10, 20],
  ])('permite: %s', async (_caso, idActor, idObjetivo) => {
    await expect(crearServicio().obtenerUno(actor(idActor), idObjetivo)).resolves.toMatchObject({
      idUsuario: idObjetivo,
    });
  });

  it.each([
    ['admin. colegio → alumno de otro colegio', 3, 50],
    ['admin. colegio → otro admin. colegio', 2, 2],
    ['profesor → alumno de otro profesor', 10, 51],
    ['profesor → admin. colegio', 10, 2],
    ['apoderado → alumno', 20, 50],
  ])('rechaza: %s', async (_caso, idActor, idObjetivo) => {
    await expect(crearServicio().obtenerUno(actor(idActor), idObjetivo)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
