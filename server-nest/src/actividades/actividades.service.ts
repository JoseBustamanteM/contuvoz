import { Injectable } from '@nestjs/common';
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
const UMBRAL_APROBADO_PRONUN = 30;


@Injectable()
export class ActividadesService {
  constructor(private prisma: PrismaService) {}

  async guardarPintado(idUsuario: number, dto: GuardarPintadoDto) {
    // Los dos inserts van juntos: si falla el segundo, no queda una actividad huérfana
    return this.prisma.$transaction(async (tx) => {
      const actividad = await tx.actividad.create({
        data: {
          idUsuario,
          idTipoActividad: TIPO_PINTADO,
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
          duracionPintado: dto.duracionPintado,
        },
      });

      await tx.usuario.update({
        where: { idUsuario },
        data: { ultActividad: new Date() },
      });

      return resultado;
    });
  }

  async guardarSign(idUsuario: number, dto: GuardarSignDto) {
  return this.prisma.$transaction(async (tx) => {
    const actividad = await tx.actividad.create({
      data: { idUsuario, idTipoActividad: TIPO_SIGN },
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

    return resultado;
  });
}


  async guardarUnePalabras(idUsuario: number, dto: GuardarUnePalabrasDto) {
    // El puntaje llega calculado del cliente igual que en las otras actividades,
    // pero acá se puede VERIFICAR: aciertos y totalPares son enteros y la
    // relación entre ellos es aritmética simple, así que no hay razón para
    // confiar en el número del cliente.
    const puntajeVerificado =
      dto.totalPares > 0 ? (dto.aciertos / dto.totalPares) * 100 : 0;

    return this.prisma.$transaction(async (tx) => {
      const actividad = await tx.actividad.create({
        data: { idUsuario, idTipoActividad: TIPO_UNE },
      });

      const resultado = await tx.resultadoUnePalabras.create({
        data: {
          idActividad: actividad.idActividad,
          totalPares: dto.totalPares,
          aciertos: dto.aciertos,
          errores: dto.errores,
          puntajeFinal: puntajeVerificado,
          aprobadoUne: puntajeVerificado >= UMBRAL_APROBADO_UNE,
                    duracionUne: dto.duracionUne,
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

      return resultado;
    });
  }

    async guardarPronunciacion(idUsuario: number, dto: GuardarPronunciacionDto) {
    // La aprobación NO depende solo de la confianza: el detector puede estar
    // muy seguro de que dijo una E cuando se pidió una A. Hay que exigir
    // ambas cosas, igual que en señas.
    const acerto =
      dto.textoDetectado.toUpperCase() === dto.textoEsperado.toUpperCase();

    return this.prisma.$transaction(async (tx) => {
      const actividad = await tx.actividad.create({
        data: { idUsuario, idTipoActividad: TIPO_PRONUNCIACION },
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

      return resultado;
    });
  }


}
