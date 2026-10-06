import {
  Injectable, ForbiddenException, ConflictException, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { Prisma, TipoVinculo } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Rol } from '../enums/rol.enum';
import { UsuarioToken } from '../auth/decorators/usuario-actual.decorator';
import { CrearVinculoDto } from './dto/crear-vinculo.dto';

/**
 * Filtro de vínculo VIGENTE. Usar SIEMPRE este objeto (o vigentes()) para
 * consultar vínculos: la tabla guarda historial, y una consulta que olvide
 * `fechaFin: null` le daría acceso a un profesor ya desvinculado.
 */
export const VIGENTE = { fechaFin: null } as const satisfies Prisma.VinculoEstudianteWhereInput;

/** Rol que debe tener el adulto para cada tipo de vínculo. */
const ROL_DEL_TIPO: Record<TipoVinculo, Rol> = {
  PROFESOR: Rol.PROFESOR,
  APODERADO: Rol.APODERADO,
};

const SELECT_PERSONA = {
  idUsuario: true,
  primerNombre: true,
  aPaterno: true,
  idRol: true,
} as const;

const SELECT_VINCULO = {
  idVinculo: true,
  idEstudiante: true,
  idAdulto: true,
  tipoVinculo: true,
  fechaInicio: true,
  fechaFin: true,
  adulto: { select: SELECT_PERSONA },
  creador: { select: SELECT_PERSONA },
  deshabilitador: { select: SELECT_PERSONA },
} as const;

type ClienteTx = Prisma.TransactionClient | PrismaService;

/**
 * Reglas de vínculos:
 *
 * | Acción                                   | Quién                                              |
 * |------------------------------------------|----------------------------------------------------|
 * | Vincular PROFESOR                        | Administrador · Admin. Colegio (su colegio)        |
 * | Vincular APODERADO                       | Admins · Profesor, solo a SUS alumnos vigentes     |
 * | Deshabilitar cualquier vínculo           | Administrador · Admin. Colegio (su colegio)        |
 * | Deshabilitar un vínculo APODERADO        | Profesor, solo los que creó él                     |
 * | Profesor crea un estudiante              | Queda vinculado como PROFESOR (vincularAlCrear)    |
 *
 * Estudiante y adulto deben ser del mismo colegio y estar activos.
 */
@Injectable()
export class VinculosService {
  constructor(private prisma: PrismaService) {}

  // ── Consultas ────────────────────────────────────────────

  /** Vínculos vigentes de un estudiante (o todos, con historial). */
  async listarDeEstudiante(actor: UsuarioToken, idEstudiante: number, conHistorial: boolean) {
    const estudiante = await this.buscarEstudiante(idEstudiante);
    await this.verificarPuedeVer(actor, estudiante);

    // El historial (quién desvinculó a quién) es información de administración.
    if (conHistorial && !this.esAdmin(actor)) {
      throw new ForbiddenException('Solo un administrador puede ver el historial de vínculos');
    }

    return this.prisma.vinculoEstudiante.findMany({
      where: { idEstudiante, ...(conHistorial ? {} : VIGENTE) },
      select: SELECT_VINCULO,
      orderBy: [{ fechaFin: { sort: 'asc', nulls: 'first' } }, { fechaInicio: 'desc' }],
    });
  }

  /** "Mis alumnos" del profesor / "mis hijos" del apoderado. */
  async misEstudiantes(actor: UsuarioToken) {
    const tipo =
      actor.idRol === Rol.PROFESOR ? TipoVinculo.PROFESOR
      : actor.idRol === Rol.APODERADO ? TipoVinculo.APODERADO
      : null;
    if (!tipo) throw new ForbiddenException('Solo profesores y apoderados tienen estudiantes vinculados');

    const vinculos = await this.prisma.vinculoEstudiante.findMany({
      where: { idAdulto: actor.idUsuario, tipoVinculo: tipo, ...VIGENTE },
      select: {
        idVinculo: true,
        fechaInicio: true,
        estudiante: {
          select: {
            idUsuario: true,
            rutUsuario: true,
            primerNombre: true,
            segundoNombre: true,
            aPaterno: true,
            aMaterno: true,
            activo: true,
            ultActividad: true,
          },
        },
      },
      orderBy: { estudiante: { primerNombre: 'asc' } },
    });

    return vinculos.map(({ idVinculo, fechaInicio, estudiante }) => ({
      ...estudiante,
      idVinculo,
      vinculadoDesde: fechaInicio,
    }));
  }

  /** true si el actor puede ver el detalle (actividades) de este estudiante.
   *  Pensado para el dashboard: admins de su alcance, adultos con vínculo
   *  vigente y el propio estudiante. */
  async puedeVerEstudiante(actor: UsuarioToken, idEstudiante: number): Promise<boolean> {
    if (actor.idUsuario === idEstudiante) return true;
    try {
      await this.verificarPuedeVer(actor, await this.buscarEstudiante(idEstudiante));
      return true;
    } catch {
      return false;
    }
  }

  // ── Escritura ────────────────────────────────────────────

  async crear(actor: UsuarioToken, dto: CrearVinculoDto) {
    const estudiante = await this.buscarEstudiante(dto.idEstudiante);
    if (!estudiante.activo) throw new BadRequestException('El estudiante está desactivado');

    const adulto = await this.prisma.usuario.findUnique({
      where: { idUsuario: dto.idAdulto },
      select: { idUsuario: true, idRol: true, idColegio: true, activo: true },
    });
    if (!adulto) throw new NotFoundException('El profesor o apoderado no existe');
    if (adulto.idRol !== ROL_DEL_TIPO[dto.tipoVinculo]) {
      throw new BadRequestException(
        dto.tipoVinculo === TipoVinculo.PROFESOR
          ? 'Ese usuario no es profesor'
          : 'Ese usuario no es apoderado',
      );
    }
    if (!adulto.activo) throw new BadRequestException('Ese usuario está desactivado');
    if (adulto.idColegio !== estudiante.idColegio) {
      throw new BadRequestException('El estudiante y el adulto deben ser del mismo colegio');
    }

    await this.verificarPuedeVincular(actor, estudiante, dto.tipoVinculo);

    try {
      return await this.prisma.vinculoEstudiante.create({
        data: {
          idEstudiante: dto.idEstudiante,
          idAdulto: dto.idAdulto,
          tipoVinculo: dto.tipoVinculo,
          creadoPor: actor.idUsuario,
        },
        select: SELECT_VINCULO,
      });
    } catch (e) {
      // uq_vinculo_vigente: ya hay un vínculo vigente igual.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Ese vínculo ya existe');
      }
      throw e;
    }
  }

  async deshabilitar(actor: UsuarioToken, idVinculo: number) {
    const vinculo = await this.prisma.vinculoEstudiante.findUnique({
      where: { idVinculo },
      select: {
        idVinculo: true,
        tipoVinculo: true,
        creadoPor: true,
        fechaFin: true,
        estudiante: { select: { idColegio: true } },
      },
    });
    if (!vinculo) throw new NotFoundException('Vínculo no encontrado');
    if (vinculo.fechaFin) throw new ConflictException('Ese vínculo ya estaba deshabilitado');

    const puede =
      actor.idRol === Rol.ADMINISTRADOR ||
      (actor.idRol === Rol.ADMIN_COLEGIO &&
        (await this.colegioDe(actor.idUsuario)) === vinculo.estudiante.idColegio) ||
      // El profesor corrige sus propios errores: solo apoderados que vinculó él.
      (actor.idRol === Rol.PROFESOR &&
        vinculo.tipoVinculo === TipoVinculo.APODERADO &&
        vinculo.creadoPor === actor.idUsuario);
    if (!puede) throw new ForbiddenException('No puedes deshabilitar este vínculo');

    // updateMany con fechaFin: null: si dos personas lo deshabilitan a la vez,
    // solo la primera lo cierra y la segunda recibe el 409.
    const { count } = await this.prisma.vinculoEstudiante.updateMany({
      where: { idVinculo, ...VIGENTE },
      data: { fechaFin: new Date(), deshabilitadoPor: actor.idUsuario },
    });
    if (count === 0) throw new ConflictException('Ese vínculo ya estaba deshabilitado');

    return this.prisma.vinculoEstudiante.findUnique({ where: { idVinculo }, select: SELECT_VINCULO });
  }

  /** Lo usa UsuariosService al crear un estudiante: el profesor que lo crea
   *  queda vinculado. Recibe el cliente de la transacción para que usuario y
   *  vínculo se creen juntos o ninguno. */
  vincularAlCrear(tx: ClienteTx, idEstudiante: number, idProfesor: number) {
    return tx.vinculoEstudiante.create({
      data: {
        idEstudiante,
        idAdulto: idProfesor,
        tipoVinculo: TipoVinculo.PROFESOR,
        creadoPor: idProfesor,
      },
    });
  }

  // ── Permisos ─────────────────────────────────────────────

  private esAdmin(actor: UsuarioToken) {
    return actor.idRol === Rol.ADMINISTRADOR || actor.idRol === Rol.ADMIN_COLEGIO;
  }

  private async verificarPuedeVincular(
    actor: UsuarioToken,
    estudiante: { idUsuario: number; idColegio: number },
    tipo: TipoVinculo,
  ) {
    if (actor.idRol === Rol.ADMINISTRADOR) return;

    if (actor.idRol === Rol.ADMIN_COLEGIO) {
      if ((await this.colegioDe(actor.idUsuario)) === estudiante.idColegio) return;
      throw new ForbiddenException('Ese estudiante no es de tu colegio');
    }

    if (actor.idRol === Rol.PROFESOR) {
      if (tipo !== TipoVinculo.APODERADO) {
        throw new ForbiddenException('Solo un administrador puede asignar profesores');
      }
      if (await this.esProfesorDe(actor.idUsuario, estudiante.idUsuario)) return;
      throw new ForbiddenException('Solo puedes asignar apoderados a tus propios alumnos');
    }

    throw new ForbiddenException('No puedes crear vínculos');
  }

  private async verificarPuedeVer(
    actor: UsuarioToken,
    estudiante: { idUsuario: number; idColegio: number },
  ) {
    if (actor.idRol === Rol.ADMINISTRADOR) return;
    if (actor.idRol === Rol.ADMIN_COLEGIO) {
      if ((await this.colegioDe(actor.idUsuario)) === estudiante.idColegio) return;
      throw new ForbiddenException('Ese estudiante no es de tu colegio');
    }

    const vinculado = await this.prisma.vinculoEstudiante.findFirst({
      where: { idEstudiante: estudiante.idUsuario, idAdulto: actor.idUsuario, ...VIGENTE },
      select: { idVinculo: true },
    });
    if (!vinculado) throw new ForbiddenException('No tienes un vínculo con este estudiante');
  }

  private async esProfesorDe(idProfesor: number, idEstudiante: number) {
    const v = await this.prisma.vinculoEstudiante.findFirst({
      where: { idEstudiante, idAdulto: idProfesor, tipoVinculo: TipoVinculo.PROFESOR, ...VIGENTE },
      select: { idVinculo: true },
    });
    return !!v;
  }

  private async buscarEstudiante(idEstudiante: number) {
    const estudiante = await this.prisma.usuario.findUnique({
      where: { idUsuario: idEstudiante },
      select: { idUsuario: true, idRol: true, idColegio: true, activo: true },
    });
    if (!estudiante) throw new NotFoundException('Estudiante no encontrado');
    if (estudiante.idRol !== Rol.ESTUDIANTE) throw new BadRequestException('Ese usuario no es estudiante');
    return estudiante;
  }

  private async colegioDe(idUsuario: number) {
    const u = await this.prisma.usuario.findUnique({ where: { idUsuario }, select: { idColegio: true } });
    if (!u) throw new ForbiddenException('Usuario no válido');
    return u.idColegio;
  }
}
