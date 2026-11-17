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
import { Prisma, TipoVinculo } from '@prisma/client';
import { VIGENTE, VinculosService } from '../../vinculos/vinculos.service';
import { cerrarSesionesDeUsuario } from '../../auth/sesiones';
import { registrarAuditoria } from '../../auditoria/auditoria';

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

/** En el listado, cada estudiante trae sus vínculos VIGENTES (profesores y
 *  apoderados): con eso la pantalla muestra a quién está asignado y filtra
 *  "sin profesor" / "sin apoderado" sin otra petición. Para los demás roles
 *  la lista viene vacía. */
const SELECT_LISTADO = {
  ...SELECT_PUBLICO,
  vinculosComoEstudiante: {
    where: VIGENTE,
    select: {
      idVinculo: true,
      tipoVinculo: true,
      creadoPor: true,
      adulto: { select: { idUsuario: true, primerNombre: true, aPaterno: true } },
    },
    orderBy: { fechaInicio: 'asc' },
  },
} as const satisfies Prisma.UsuarioSelect;

/**
 * Usuarios que un PROFESOR puede ver con todos sus datos y gestionar (editar,
 * desactivar, cambiar clave):
 * - sus alumnos, con vínculo PROFESOR vigente con él;
 * - los apoderados de esos alumnos (vínculo APODERADO vigente);
 * - los apoderados que él mismo creó, para poder vincularlos recién creados.
 *
 * Antes veía y podía modificar a TODOS los estudiantes y apoderados del
 * colegio, con RUT, correo y teléfono. Los demás apoderados del colegio solo
 * los ve por nombre, para elegirlos al vincular (apoderadosVinculables).
 */
function alcanceProfesor(idProfesor: number): Prisma.UsuarioWhereInput {
  const misAlumnos: Prisma.UsuarioWhereInput = {
    vinculosComoEstudiante: {
      some: { idAdulto: idProfesor, tipoVinculo: TipoVinculo.PROFESOR, ...VIGENTE },
    },
  };
  return {
    OR: [
      { idRol: Rol.ESTUDIANTE, ...misAlumnos },
      {
        idRol: Rol.APODERADO,
        vinculosComoAdulto: {
          some: { tipoVinculo: TipoVinculo.APODERADO, ...VIGENTE, estudiante: misAlumnos },
        },
      },
      { idRol: Rol.APODERADO, creadoPor: idProfesor },
    ],
  };
}

/**
 * Correo y teléfono son opcionales SOLO para estudiantes: obligarlos llevaba
 * a inventarle datos a un niño. A los adultos se les siguen exigiendo.
 */
function exigirContactoSiEsAdulto(
  idRol: number,
  correo: string | null | undefined,
  telefono: string | null | undefined,
) {
  if (idRol === Rol.ESTUDIANTE) return;
  if (!correo || !telefono) {
    throw new BadRequestException('El correo y el teléfono son obligatorios, salvo para estudiantes');
  }
}

@Injectable()
export class UsuariosService {
  constructor(
    private prisma: PrismaService,
    private vinculosService: VinculosService,
  ) {}

  private async datosCreador(idUsuario: number) {
    const creador = await this.prisma.usuario.findUnique({
      where: { idUsuario },
      select: { idColegio: true },
    });
    if (!creador) throw new ForbiddenException('Usuario no válido');
    return creador;
  }

  async crear(creador: UsuarioToken, dto: CrearUsuarioDto, ip?: string) {
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

    exigirContactoSiEsAdulto(dto.idRol, dto.correo, dto.telefonoUsuario);

    const rutLimpio = limpiarRut(dto.rutUsuario);

    // Sin correo (estudiante) solo se busca por RUT: { correo: null } haría
    // coincidir a todos los que tampoco tienen correo.
    const existente = await this.prisma.usuario.findFirst({
      where: {
        OR: [{ rutUsuario: rutLimpio }, ...(dto.correo ? [{ correo: dto.correo }] : [])],
      },
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

    // Un profesor que crea un estudiante queda como su profesor. Va en la
    // misma transacción: si el vínculo fallara, tampoco se crea el usuario
    // (no queda un alumno "huérfano" que el profesor ya no puede ver).
    const vincularProfesor = creador.idRol === Rol.PROFESOR && dto.idRol === Rol.ESTUDIANTE;

    return this.prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.create({
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

      if (vincularProfesor) {
        await this.vinculosService.vincularAlCrear(tx, usuario.idUsuario, creador.idUsuario);
      }

      await registrarAuditoria(tx, {
        idActor: creador.idUsuario,
        idUsuarioAfectado: usuario.idUsuario,
        accion: 'crear_usuario',
        detalle: { idRol: dto.idRol, idColegio, vinculadoComoProfesor: vincularProfesor },
        ip,
      });
      return usuario;
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

  async listar(
    creador: UsuarioToken,
    filtroRol?: number,
    filtroColegio?: number,
    sinVinculo?: TipoVinculo,
  ) {
    const { rolesVisibles, idColegio } = await this.alcanceDeConsulta(creador);

    const where: Prisma.UsuarioWhereInput = {};

    // "Sin profesor" / "sin apoderado": estudiantes sin un vínculo VIGENTE de
    // ese tipo (los que tuvieron uno y se cerró también cuentan como sin).
    if (sinVinculo) {
      where.vinculosComoEstudiante = { none: { tipoVinculo: sinVinculo, ...VIGENTE } };
      filtroRol = Rol.ESTUDIANTE;
    }

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

    if (creador.idRol === Rol.PROFESOR) {
      where.AND = [alcanceProfesor(creador.idUsuario)];
    }

    return this.prisma.usuario.findMany({
      where,
      select: SELECT_LISTADO,
      orderBy: { primerNombre: 'asc' },
    });
  }

  async obtenerUno(creador: UsuarioToken, idUsuario: number) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { idUsuario },
      select: SELECT_PUBLICO,
    });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    await this.verificarAlcance(creador, idUsuario, usuario.idRol, usuario.idColegio);
    return usuario;
  }

  /**
   * Apoderados activos del colegio del profesor, SOLO con nombre: los que
   * puede elegir al vincular un apoderado a uno de sus alumnos. Sin RUT,
   * correo ni teléfono, porque no son suyos (ver alcanceProfesor).
   */
  async apoderadosVinculables(creador: UsuarioToken) {
    const { idColegio } = await this.datosCreador(creador.idUsuario);
    return this.prisma.usuario.findMany({
      where: { idRol: Rol.APODERADO, activo: true, idColegio },
      select: {
        idUsuario: true,
        primerNombre: true,
        aPaterno: true,
        aMaterno: true,
        idRol: true,
        idColegio: true,
        activo: true,
      },
      orderBy: { primerNombre: 'asc' },
    });
  }

  /** Lanza ForbiddenException si el creador no tiene alcance sobre ese usuario */
  private async verificarAlcance(
    creador: UsuarioToken,
    idUsuarioObjetivo: number,
    idRolObjetivo: number,
    idColegioObjetivo: number,
  ) {
    if (creador.idRol === Rol.ADMINISTRADOR) return;

    const permitidos = PUEDE_GESTIONAR[creador.idRol] ?? [];
    if (!permitidos.includes(idRolObjetivo)) {
      throw new ForbiddenException('No tienes permisos sobre este usuario');
    }

    const creadorBD = await this.datosCreador(creador.idUsuario);
    if (creadorBD.idColegio !== idColegioObjetivo) {
      throw new ForbiddenException('No tienes permisos sobre este usuario');
    }

    if (creador.idRol === Rol.PROFESOR) {
      const enAlcance = await this.prisma.usuario.count({
        where: { idUsuario: idUsuarioObjetivo, ...alcanceProfesor(creador.idUsuario) },
      });
      if (enAlcance === 0) {
        throw new ForbiddenException(
          'Solo puedes gestionar a tus alumnos y a sus apoderados',
        );
      }
    }
  }

  async actualizar(
    creador: UsuarioToken,
    idUsuario: number,
    dto: ActualizarUsuarioDto,
    ip?: string,
  ) {
    const objetivo = await this.prisma.usuario.findUnique({
      where: { idUsuario },
      select: { idRol: true, idColegio: true, rutUsuario: true, correo: true, telefonoUsuario: true },
    });
    if (!objetivo) throw new NotFoundException('Usuario no encontrado');

    await this.verificarAlcance(creador, idUsuario, objetivo.idRol, objetivo.idColegio);

    // Cómo queda después del cambio (undefined = ese campo no se toca).
    exigirContactoSiEsAdulto(
      dto.idRol ?? objetivo.idRol,
      dto.correo !== undefined ? dto.correo : objetivo.correo,
      dto.telefonoUsuario !== undefined ? dto.telefonoUsuario : objetivo.telefonoUsuario,
    );

    // Si además cambia el rol, el rol NUEVO también debe estar dentro de lo permitido
    if (dto.idRol !== undefined) {
      const permitidos = PUEDE_GESTIONAR[creador.idRol] ?? [];
      if (creador.idRol !== Rol.ADMINISTRADOR && !permitidos.includes(dto.idRol)) {
        throw new ForbiddenException('No puedes asignar ese rol');
      }
      if (dto.idRol !== objetivo.idRol) {
        await this.verificarPuedeCambiarRol(idUsuario);
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

    const claveHash = dto.password ? await bcrypt.hash(dto.password, 10) : undefined;
    const cambiaRol = dto.idRol !== undefined && dto.idRol !== objetivo.idRol;

    return this.prisma.$transaction(async (tx) => {
      const actualizado = await tx.usuario.update({
        where: { idUsuario },
        data: {
          idRol: dto.idRol,
          rutUsuario: dto.rutUsuario ? limpiarRut(dto.rutUsuario) : undefined,
          claveHash,
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

      // Con clave nueva u otro rol, las sesiones abiertas se cierran en todos
      // sus equipos: quien conocía la clave anterior queda fuera.
      if (claveHash) await cerrarSesionesDeUsuario(tx, idUsuario, 'cambio_clave');
      else if (cambiaRol) await cerrarSesionesDeUsuario(tx, idUsuario, 'cambio_rol');

      // Solo los NOMBRES de los campos enviados ("password" indica que se
      // cambió la clave, nunca su valor) y el rol antes/después.
      await registrarAuditoria(tx, {
        idActor: creador.idUsuario,
        idUsuarioAfectado: idUsuario,
        accion: 'editar_usuario',
        detalle: {
          campos: Object.entries(dto)
            .filter(([, valor]) => valor !== undefined)
            .map(([campo]) => campo),
          ...(cambiaRol ? { rolAntes: objetivo.idRol, rolDespues: dto.idRol } : {}),
        },
        ip,
      });

      return actualizado;
    });
  }

  async desactivar(creador: UsuarioToken, idUsuario: number, ip?: string) {
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

    await this.verificarAlcance(creador, idUsuario, objetivo.idRol, objetivo.idColegio);

    return this.prisma.$transaction(async (tx) => {
      const desactivado = await tx.usuario.update({
        where: { idUsuario },
        data: { activo: false, deshabilitadoPor: creador.idUsuario },
        select: SELECT_PUBLICO,
      });

      await cerrarSesionesDeUsuario(tx, idUsuario, 'desactivado');

      // Un profesor o apoderado desactivado deja de acompañar a sus alumnos:
      // se cierran sus vínculos (queda el historial). Si no, el alumno no
      // aparecía en "sin profesor" / "sin apoderado" aunque nadie activo lo
      // acompañara. Al reactivarlo, los vínculos hay que volver a crearlos.
      // Los de un ESTUDIANTE desactivado se mantienen: sigue siendo alumno
      // de su profesor y, al reactivarlo, vuelve con todo.
      if (objetivo.idRol === Rol.PROFESOR || objetivo.idRol === Rol.APODERADO) {
        await tx.vinculoEstudiante.updateMany({
          where: { idAdulto: idUsuario, ...VIGENTE },
          data: { fechaFin: new Date(), deshabilitadoPor: creador.idUsuario },
        });
      }

      await registrarAuditoria(tx, {
        idActor: creador.idUsuario,
        idUsuarioAfectado: idUsuario,
        accion: 'desactivar_usuario',
        ip,
      });

      return desactivado;
    });
  }

  /**
   * Un cambio de rol no puede dejar datos que ya no tienen sentido: si un
   * estudiante pasa a apoderado, sus vínculos quedarían con un "estudiante"
   * que no lo es, y sus actividades se mezclarían con las de un adulto. Solo
   * se permite si no tiene vínculos vigentes ni actividades registradas;
   * para lo demás, se crea un usuario nuevo con el rol correcto.
   */
  private async verificarPuedeCambiarRol(idUsuario: number) {
    const [vinculos, actividades] = await Promise.all([
      this.prisma.vinculoEstudiante.count({
        where: { OR: [{ idEstudiante: idUsuario }, { idAdulto: idUsuario }], ...VIGENTE },
      }),
      this.prisma.actividad.count({ where: { idUsuario } }),
    ]);

    if (vinculos > 0) {
      throw new ConflictException(
        'No se puede cambiar el rol: tiene vínculos vigentes. Quítalos primero o crea un usuario nuevo.',
      );
    }
    if (actividades > 0) {
      throw new ConflictException(
        'No se puede cambiar el rol: ya tiene actividades registradas. Crea un usuario nuevo con el rol correcto.',
      );
    }
  }

  async reactivar(creador: UsuarioToken, idUsuario: number, ip?: string) {
    const objetivo = await this.prisma.usuario.findUnique({
      where: { idUsuario },
      select: { idRol: true, idColegio: true },
    });
    if (!objetivo) throw new NotFoundException('Usuario no encontrado');

    await this.verificarAlcance(creador, idUsuario, objetivo.idRol, objetivo.idColegio);

    return this.prisma.$transaction(async (tx) => {
      const reactivado = await tx.usuario.update({
        where: { idUsuario },
        data: { activo: true, deshabilitadoPor: null },
        select: SELECT_PUBLICO,
      });

      await registrarAuditoria(tx, {
        idActor: creador.idUsuario,
        idUsuarioAfectado: idUsuario,
        accion: 'reactivar_usuario',
        ip,
      });

      return reactivado;
    });
  }
}
