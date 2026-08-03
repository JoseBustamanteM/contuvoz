import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GuardarPintadoDto } from '../../src/auth/dto/guardar-pintado.dto';
import { GuardarSignDto } from './dto/guardar-sign.dto';


const TIPO_PINTADO = 1;
const UMBRAL_APROBADO = 80;
const TIPO_SIGN = 2;
const UMBRAL_APROBADO_SIGN = 70;

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
        aprobadoSign: dto.porcConfianza >= UMBRAL_APROBADO_SIGN,
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
