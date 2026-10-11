import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-aut-guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../enums/rol.enum';
import { UsuarioActual, type UsuarioToken } from '../auth/decorators/usuario-actual.decorator';
import { ActividadesService } from './actividades.service';
import { GuardarPintadoDto } from './dto/guardar-pintado.dto';
import { GuardarSignDto } from './dto/guardar-sign.dto';

/**
 * Actividades de los estudiantes.
 *
 * Alcance: solo Estudiante y Profesor. El Profesor está incluido para poder
 * demostrar la actividad frente al curso; sus resultados quedan igualmente
 * registrados a su nombre. Administradores y Apoderados no generan actividad,
 * así que se les cierra la puerta para no ensuciar las tablas de resultados
 * (y, más adelante, los promedios de "Mi progreso").
 *
 * ⚠️ NOTA DE SEGURIDAD — el puntaje es AUTORREPORTADO.
 *
 * `idUsuario` sale del JWT, así que nadie puede escribir resultados en la cuenta
 * de otra persona. Pero `porcConfianza` y `puntajeFinal` los calcula el cliente
 * (MediaPipe y el canvas corren en el navegador), y el servidor solo decide el
 * booleano de aprobación a partir de esos números. Un usuario con la consola
 * abierta puede enviar un 100 sin haber hecho la seña ni el trazo.
 *
 * Para el contexto de uso —niños en clase, con la profesora presente y sin
 * ninguna recompensa por falsear el resultado— se aceptó este riesgo de forma
 * consciente. Si en algún momento estos datos pasan a usarse para evaluación
 * formal, la solución es que el cliente envíe los landmarks / el trazo crudo y
 * el servidor recalcule el puntaje, en vez de recibirlo ya hecho.
 *
 * ⚠️ IMPORT DE GuardarPintadoDto: este archivo lo espera en
 * `src/actividades/dto/guardar-pintado.dto.ts`. Si todavía lo tenés en
 * `src/auth/dto/`, cambiá el import de arriba por
 * '../auth/dto/guardar-pintado.dto' o mové el archivo (recomendado) y actualizá
 * también la línea 3 de `actividades.service.ts`.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('actividades')
export class ActividadesController {
  constructor(private actividadesService: ActividadesService) {}

  @Roles(Rol.ESTUDIANTE, Rol.PROFESOR)
  @Post('pintado')
  async guardarPintado(
    @UsuarioActual() usuario: UsuarioToken,
    @Body() dto: GuardarPintadoDto,
  ) {
    return this.actividadesService.guardarPintado(usuario.idUsuario, dto);
  }

  @Roles(Rol.ESTUDIANTE, Rol.PROFESOR)
  @Post('sign')
  async guardarSign(
    @UsuarioActual() usuario: UsuarioToken,
    @Body() dto: GuardarSignDto,
  ) {
    return this.actividadesService.guardarSign(usuario.idUsuario, dto);
  }
}
