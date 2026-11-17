import {
  BadRequestException, HttpException, HttpStatus, Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GuardarPintadoDto } from './dto/guardar-pintado.dto';
import { GuardarSignDto } from './dto/guardar-sign.dto';
import { GuardarUnePalabrasDto } from './dto/guardar-une-palabras.dto'
import { GuardarPronunciacionDto } from './dto/guardar-pronunciacion.dto';


const TIPO_PINTADO = 1;
const UMBRAL_APROBADO = 80;
const TIPO_SIGN = 2;
const UMBRAL_APROBADO_SIGN = 70;
const TIPO_UNE = 4
const UMBRAL_APROBADO_UNE = 80
const TIPO_PRONUNCIACION = 3;
// ⚠️ Espejo en src/app/interfaces/pronunciacion.interface.ts (el frontend
// muestra el resultado con esta misma regla): si cambia acá, cambiar allá.
const UMBRAL_APROBADO_PRONUN = 30;

/** Ver verificarFrecuencia(). */
const MAX_INTENTOS_POR_MINUTO = 40;

/**
 * Versión de las reglas de cada actividad: umbral de aprobación y forma de
 * calcular el puntaje o de detectar (canvas, MediaPipe, detector de vocales).
 * Se guarda en actividad.version_reglas con cada intento.
 *
 * SUBIR el número de una actividad cuando cambie cualquiera de esas cosas,
 * para que sus intentos nuevos no se mezclen con los antiguos como si
 * valieran lo mismo. Todo lo guardado hasta el 2026-11-16 es la versión 1.
 */
const VERSION_REGLAS = {
  [TIPO_PINTADO]: 1,
  [TIPO_SIGN]: 1,
  [TIPO_PRONUNCIACION]: 1,
  [TIPO_UNE]: 1,
} as const;


/**
 * Una ronda de Une palabras tiene que ser coherente consigo misma; si no, se
 * rechaza con 400 en vez de guardar puntajes imposibles (por ejemplo, 5
 * aciertos de 3 pares daba 166 %). Reglas, que son las del juego
 * (unePalabras.component.ts):
 * - `pares` trae las palabras de la ronda, sin repetir, una por par.
 * - Cada confusión une dos palabras distintas de la ronda, sin repetirse.
 * - `errores` es la suma de las `veces` de todas las confusiones.
 * - Un acierto es una palabra resuelta sin ningún error: aciertos = pares
 *   menos las palabras que tuvieron alguna confusión.
 *
 * No se valida contra el banco de palabras porque vive en el frontend; se
 * podrá cuando pase a una tabla.
 */
function validarRondaUne(dto: GuardarUnePalabrasDto) {
  const rechazar = (motivo: string) => {
    throw new BadRequestException(`Ronda de Une palabras inválida: ${motivo}`);
  };

  const pares = new Set(dto.pares);
  if (dto.pares.length !== dto.totalPares) rechazar('la cantidad de palabras no coincide con totalPares');
  if (pares.size !== dto.pares.length) rechazar('hay palabras repetidas');

  const vistas = new Set<string>();
  const fallidas = new Set<string>();
  let errores = 0;
  for (const c of dto.confusiones) {
    if (!pares.has(c.palabra) || !pares.has(c.eligio)) rechazar(`"${c.palabra}"→"${c.eligio}" no es de esta ronda`);
    if (c.palabra === c.eligio) rechazar('una confusión une una palabra consigo misma');
    const clave = `${c.palabra}→${c.eligio}`;
    if (vistas.has(clave)) rechazar(`la confusión ${clave} está repetida`);
    vistas.add(clave);
    fallidas.add(c.palabra);
    errores += c.veces;
  }

  if (errores !== dto.errores) rechazar('errores no coincide con las confusiones');
  if (dto.aciertos !== dto.totalPares - fallidas.size) {
    rechazar('aciertos no coincide con las palabras que no tuvieron errores');
  }
}

@Injectable()
export class ActividadesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Guarda un intento una sola vez.
   *
   * El frontend reintenta si falla la red o el servidor, con el mismo
   * idIntento. Si el primer envío alcanzó a guardarse (y solo se perdió la
   * respuesta), se devuelve lo ya guardado en vez de crear otra fila: sin
   * esto el niño recibía estrellas dobles. Si dos envíos llegan a la vez, el
   * índice único (id_usuario, id_intento) deja pasar solo uno y el otro
   * devuelve el mismo resultado.
   */
  private async guardarUnaVez<T>(
    idUsuario: number,
    idIntento: string | undefined,
    guardar: () => Promise<T>,
  ): Promise<T> {
    if (!idIntento) {
      await this.verificarFrecuencia(idUsuario);
      return guardar();
    }

    // Un reintento de algo ya guardado no cuenta para el límite.
    const previo = await this.buscarIntento(idUsuario, idIntento);
    if (previo) return previo as T;

    await this.verificarFrecuencia(idUsuario);

    try {
      return await guardar();
    } catch (error) {
      // Dos envíos simultáneos del mismo intento: el perdedor falla al
      // insertar (MariaDB lo informa como clave duplicada o como conflicto de
      // transacción, según el momento). Si el otro ya lo guardó, se devuelve
      // eso; si no, el error era otro y se propaga.
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        const ganador = await this.buscarIntento(idUsuario, idIntento);
        if (ganador) return ganador as T;
      }
      throw error;
    }
  }

  /**
   * Límite de intentos guardados por minuto y usuario. Jugando de verdad
   * nadie se acerca: el más rápido es Hablemos, unos 2 a 3 segundos por
   * intento (unos 20 por minuto). Lo que se evita es que un script llene la
   * base o las estrellas de un niño con miles de resultados.
   */
  private async verificarFrecuencia(idUsuario: number) {
    const recientes = await this.prisma.actividad.count({
      where: { idUsuario, fechaActividad: { gte: new Date(Date.now() - 60_000) } },
    });
    if (recientes >= MAX_INTENTOS_POR_MINUTO) {
      throw new HttpException(
        'Demasiados intentos seguidos. Espera un momento antes de seguir.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /** El resultado de un intento ya guardado, con la misma forma que devuelve
   *  cada guardar*(): el resultado de su actividad más la duración. */
  private async buscarIntento(idUsuario: number, idIntento: string) {
    const actividad = await this.prisma.actividad.findUnique({
      where: { idUsuario_idIntento: { idUsuario, idIntento } },
      include: {
        resultadoPintado: true,
        resultadoSign: true,
        resultadoUnePalabras: true,
        resultadoPronunciacion: true,
      },
    });
    if (!actividad) return null;

    const resultado =
      actividad.resultadoPintado ??
      actividad.resultadoSign ??
      actividad.resultadoUnePalabras ??
      actividad.resultadoPronunciacion;
    if (!resultado) return null;

    return { ...resultado, duracion: actividad.duracion };
  }

  async guardarPintado(idUsuario: number, dto: GuardarPintadoDto, esDemo = false) {
    // Los dos inserts van juntos: si falla el segundo, no queda una actividad huérfana
    return this.guardarUnaVez(idUsuario, dto.idIntento, () => this.prisma.$transaction(async (tx) => {
      const actividad = await tx.actividad.create({
        data: {
          idUsuario,
          idTipoActividad: TIPO_PINTADO,
          duracion: dto.duracion,
          idIntento: dto.idIntento,
          versionReglas: VERSION_REGLAS[TIPO_PINTADO],
          esDemo,
        },
      });

      const resultado = await tx.resultadoPintado.create({
        data: {
          idActividad: actividad.idActividad,
          letraEsperada: dto.letraEsperada.toUpperCase(),
          trazoInterno: dto.trazoInterno,
          trazoExterno: dto.trazoExterno,
          areaCompletada: dto.areaCompletada,
          puntajeFinal: dto.puntajeFinal,
          aprobadoPintado: dto.puntajeFinal >= UMBRAL_APROBADO,
        },
      });

      await tx.usuario.update({
        where: { idUsuario },
        data: { ultActividad: new Date() },
      });

      return { ...resultado, duracion: actividad.duracion };
    }));
  }

  async guardarSign(idUsuario: number, dto: GuardarSignDto, esDemo = false) {
  return this.guardarUnaVez(idUsuario, dto.idIntento, () => this.prisma.$transaction(async (tx) => {
    const actividad = await tx.actividad.create({
      data: { idUsuario, idTipoActividad: TIPO_SIGN, duracion: dto.duracion, idIntento: dto.idIntento, versionReglas: VERSION_REGLAS[TIPO_SIGN], esDemo },
    });

    const resultado = await tx.resultadoSign.create({
      data: {
        idActividad: actividad.idActividad,
        letraEsperada: dto.letraEsperada.toUpperCase(),
        letraDetectada: dto.letraDetectada.toUpperCase(),
        porcConfianza: dto.porcConfianza,
        aprobadoSign: dto.porcConfianza >= UMBRAL_APROBADO_SIGN && dto.sostenida,
      },
    });

    await tx.usuario.update({
      where: { idUsuario },
      data: { ultActividad: new Date() },
    });

    return { ...resultado, duracion: actividad.duracion };
  }));
}


  async guardarUnePalabras(idUsuario: number, dto: GuardarUnePalabrasDto, esDemo = false) {
    validarRondaUne(dto);

    // El puntaje llega calculado del cliente igual que en las otras actividades,
    // pero acá se puede VERIFICAR: aciertos y totalPares son enteros y la
    // relación entre ellos es aritmética simple, así que no hay razón para
    // confiar en el número del cliente.
    const puntajeVerificado =
      dto.totalPares > 0 ? (dto.aciertos / dto.totalPares) * 100 : 0;

    return this.guardarUnaVez(idUsuario, dto.idIntento, () => this.prisma.$transaction(async (tx) => {
      const actividad = await tx.actividad.create({
        data: { idUsuario, idTipoActividad: TIPO_UNE, duracion: dto.duracion, idIntento: dto.idIntento, versionReglas: VERSION_REGLAS[TIPO_UNE], esDemo },
      });

      const resultado = await tx.resultadoUnePalabras.create({
        data: {
          idActividad: actividad.idActividad,
          totalPares: dto.totalPares,
          aciertos: dto.aciertos,
          errores: dto.errores,
          puntajeFinal: puntajeVerificado,
          aprobadoUne: puntajeVerificado >= UMBRAL_APROBADO_UNE,
          detalle: {
            pares: dto.pares,
            confusiones: dto.confusiones.map((c) => ({
              palabra: c.palabra,
              eligio: c.eligio,
              veces: c.veces,
            })),
          },
        },
      });

      await tx.usuario.update({
        where: { idUsuario },
        data: { ultActividad: new Date() },
      });

      return { ...resultado, duracion: actividad.duracion };
    }));
  }

    async guardarPronunciacion(idUsuario: number, dto: GuardarPronunciacionDto, esDemo = false) {
    // La aprobación NO depende solo de la confianza: el detector puede estar
    // muy seguro de que dijo una E cuando se pidió una A. Hay que exigir
    // ambas cosas, igual que en señas.
    const acerto =
      dto.textoDetectado.toUpperCase() === dto.textoEsperado.toUpperCase();

    return this.guardarUnaVez(idUsuario, dto.idIntento, () => this.prisma.$transaction(async (tx) => {
      const actividad = await tx.actividad.create({
        data: { idUsuario, idTipoActividad: TIPO_PRONUNCIACION, duracion: dto.duracion, idIntento: dto.idIntento, versionReglas: VERSION_REGLAS[TIPO_PRONUNCIACION], esDemo },
      });

      const resultado = await tx.resultadoPronunciacion.create({
        data: {
          idActividad: actividad.idActividad,
          textoEsperado: dto.textoEsperado.toUpperCase(),
          textoDetectado: dto.textoDetectado.toUpperCase(),
          porcConfianza: dto.porcConfianza,
          aprobadoPronun: acerto && dto.porcConfianza >= UMBRAL_APROBADO_PRONUN,
        },
      });

      await tx.usuario.update({
        where: { idUsuario },
        data: { ultActividad: new Date() },
      });

      return { ...resultado, duracion: actividad.duracion };
    }));
  }


}
