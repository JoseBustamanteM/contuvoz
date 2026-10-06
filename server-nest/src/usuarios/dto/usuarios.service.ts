import {
  Injectable, ForbiddenException, ConflictException,
  BadRequestException, NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { CrearUsuarioDto } from './crear-usuario.dto';
import { ActualizarUsuarioDto } from './actualizar-usuario.dto';
import { Rol } from '../../enums/rol.enum';
import { UsuarioToken } from '../../auth/decorators/usuario-actual.decorator';
import { limpiarRut } from '../../common/validators/rut.validator';

const PUEDE_GESTIONAR: Record<number, Rol[]> = {
  [Rol.ADMINISTRADOR]: [
    Rol.ADMINISTRADOR, Rol.ADMIN_COLEGIO, Rol.PROFESOR, Rol.APODERADO, Rol.ESTUDIANTE,
  ],
  [Rol.ADMIN_COLEGIO]: [Rol.PROFESOR, Rol.APODERADO, Rol.ESTUDIANTE],
  [Rol.PROFESOR]: [Rol.APODERADO, Rol.ESTUDIANTE],
};

const SELECT_PUBLICO = {
  idUsuario: true,
  rutUsuario: true,
  primerNombre: true,
  segundoNombre: true,
  aPaterno: true,
  aMaterno: true,
  correo: true,
  telefonoUsuario: true,
  urlAvatar: true,
  idRol: true,
  idColegio: true,
  activo: true,
  fechaRegistro: true,
  ultActividad: true,
  rol: { select: { nomRol: true } },
} as const;

@Injectable()
export class UsuariosService {
  constructor(private prisma: PrismaService) {}

  private async datosCreador(idUsuario: number) {
    const creador = await this.prisma.usuario.findUnique({
      where: { idUsuario },
      select: { idColegio: true },
    });
    if (!creador) throw new ForbiddenException('Usuario no válido');
    return creador;
  }

  async crear(creador: UsuarioToken, dto: CrearUsuarioDto) {
    const permitidos = PUEDE_GESTIONAR[creador.idRol] ?? [];
    if (!permitidos.includes(dto.idRol)) {
      throw new ForbiddenException('No puedes crear usuarios con ese rol');
    }

    const creadorBD = await this.datosCreador(creador.idUsuario);


let idColegio: number;
if (creador.idRol === Rol.ADMINISTRADOR) {
  if (!dto.idColegio) throw new BadRequestException('Debes indicar el colegio');

  const colegioExiste = await this.prisma.colegio.findUnique({
    where: { idColegio: dto.idColegio },
    select: { idColegio: true },
  });
  if (!colegioExiste) throw new BadRequestException('El colegio indicado no existe');

  idColegio = dto.idColegio;
} else {
  idColegio = creadorBD.idColegio;
}

    const rutLimpio = limpiarRut(dto.rutUsuario);

    const existente = await this.prisma.usuario.findFirst({
      where: { OR: [{ rutUsuario: rutLimpio }, { correo: dto.correo }] },
      select: { rutUsuario: true, correo: true },
    });

    if (existente) {
      throw new ConflictException(
        existente.rutUsuario === rutLimpio
          ? 'Ya existe un usuario con ese RUT'
          : 'Ya existe un usuario con ese correo',
      );
    }

    const claveHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.usuario.create({
      data: {
        idRol: dto.idRol,
        idColegio,
        rutUsuario: rutLimpio,
        claveHash,
        primerNombre: dto.primerNombre,
        segundoNombre: dto.segundoNombre,
        aPaterno: dto.aPaterno,
        aMaterno: dto.aMaterno,
        telefonoUsuario: dto.telefonoUsuario,
        correo: dto.correo,
        urlAvatar: dto.urlAvatar ?? null,
        creadoPor: creador.idUsuario,
      },
      select: SELECT_PUBLICO,
    });
  }

  /** Determina qué roles y qué colegio puede ver el que consulta */
  private async alcanceDeConsulta(creador: UsuarioToken) {
    if (creador.idRol === Rol.ADMINISTRADOR) {
      return { rolesVisibles: null, idColegio: null }; // sin restricción
    }

    const rolesVisibles = PUEDE_GESTIONAR[creador.idRol];
    if (!rolesVisibles) throw new ForbiddenException('No puedes ver usuarios');

    const creadorBD = await this.datosCreador(creador.idUsuario);
    return { rolesVisibles, idColegio: creadorBD.idColegio };
  }

  async listar(creador: UsuarioToken, filtroRol?: number, filtroColegio?: number) {
    const { rolesVisibles, idColegio } = await this.alcanceDeConsulta(creador);

    const where: Record<string, unknown> = {};

    // Roles: intersección entre lo que puede ver y lo que pidió filtrar
    if (rolesVisibles) {
      where.idRol = filtroRol ? { in: rolesVisibles.filter((r) => r === filtroRol) } : { in: rolesVisibles };
    } else if (filtroRol) {
      where.idRol = filtroRol;
    }

    // Colegio: fijo si no es Administrador; opcional si lo es
    if (idColegio !== null) {
      where.idColegio = idColegio;
    } else if (filtroColegio) {
      where.idColegio = filtroColegio;
    }

    return this.prisma.usuario.findMany({
      where,
      select: SELECT_PUBLICO,
      orderBy: { primerNombre: 'asc' },
    });
  }

  async obtenerUno(creador: UsuarioToken, idUsuario: number) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { idUsuario },
      select: SELECT_PUBLICO,
    });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    await this.verificarAlcance(creador, usuario.idRol, usuario.idColegio);
    return usuario;
  }

  /** Lanza ForbiddenException si el creador no tiene alcance sobre ese rol/colegio */
  private async verificarAlcance(creador: UsuarioToken, idRolObjetivo: number, idColegioObjetivo: number) {
    if (creador.idRol === Rol.ADMINISTRADOR) return;

    const permitidos = PUEDE_GESTIONAR[creador.idRol] ?? [];
    if (!permitidos.includes(idRolObjetivo)) {
      throw new ForbiddenException('No tienes permisos sobre este usuario');
    }

    const creadorBD = await this.datosCreador(creador.idUsuario);
    if (creadorBD.idColegio !== idColegioObjetivo) {
      throw new ForbiddenException('No tienes permisos sobre este usuario');
    }
  }

  async actualizar(creador: UsuarioToken, idUsuario: number, dto: ActualizarUsuarioDto) {
    const objetivo = await this.prisma.usuario.findUnique({
      where: { idUsuario },
      select: { idRol: true, idColegio: true, rutUsuario: true, correo: true },
    });
    if (!objetivo) throw new NotFoundException('Usuario no encontrado');

    await this.verificarAlcance(creador, objetivo.idRol, objetivo.idColegio);

    // Si además cambia el rol, el rol NUEVO también debe estar dentro de lo permitido
    if (dto.idRol !== undefined) {
      const permitidos = PUEDE_GESTIONAR[creador.idRol] ?? [];
      if (creador.idRol !== Rol.ADMINISTRADOR && !permitidos.includes(dto.idRol)) {
        throw new ForbiddenException('No puedes asignar ese rol');
      }
    }

    if (dto.rutUsuario || dto.correo) {
      const rutLimpio = dto.rutUsuario ? limpiarRut(dto.rutUsuario) : undefined;
      const duplicado = await this.prisma.usuario.findFirst({
        where: {
          idUsuario: { not: idUsuario },
          OR: [
            ...(rutLimpio ? [{ rutUsuario: rutLimpio }] : []),
            ...(dto.correo ? [{ correo: dto.correo }] : []),
          ],
        },
        select: { rutUsuario: true },
      });
      if (duplicado) throw new ConflictException('RUT o correo ya en uso por otro usuario');
    }

    return this.prisma.usuario.update({
      where: { idUsuario },
      data: {
        idRol: dto.idRol,
        rutUsuario: dto.rutUsuario ? limpiarRut(dto.rutUsuario) : undefined,
        claveHash: dto.password ? await bcrypt.hash(dto.password, 10) : undefined,
        primerNombre: dto.primerNombre,
        segundoNombre: dto.segundoNombre,
        aPaterno: dto.aPaterno,
        aMaterno: dto.aMaterno,
        telefonoUsuario: dto.telefonoUsuario,
        correo: dto.correo,
        urlAvatar: dto.urlAvatar,
      },
      select: SELECT_PUBLICO,
    });
  }

  async desactivar(creador: UsuarioToken, idUsuario: number) {
    // Sin esto, el único administrador podía desactivarse y dejar el sistema
    // sin nadie que pudiera reactivarlo.
    if (idUsuario === creador.idUsuario) {
      throw new BadRequestException('No puedes desactivar tu propia cuenta');
    }

    const objetivo = await this.prisma.usuario.findUnique({
      where: { idUsuario },
      select: { idRol: true, idColegio: true },
    });
    if (!objetivo) throw new NotFoundException('Usuario no encontrado');

    await this.verificarAlcance(creador, objetivo.idRol, objetivo.idColegio);

    return this.prisma.usuario.update({
      where: { idUsuario },
      data: { activo: false, deshabilitadoPor: creador.idUsuario },
      select: SELECT_PUBLICO,
    });
  }

  async reactivar(creador: UsuarioToken, idUsuario: number) {
    const objetivo = await this.prisma.usuario.findUnique({
      where: { idUsuario },
      select: { idRol: true, idColegio: true },
    });
    if (!objetivo) throw new NotFoundException('Usuario no encontrado');

    await this.verificarAlcance(creador, objetivo.idRol, objetivo.idColegio);

    return this.prisma.usuario.update({
      where: { idUsuario },
      data: { activo: true, deshabilitadoPor: null },
      select: SELECT_PUBLICO,
    });
  }
}
