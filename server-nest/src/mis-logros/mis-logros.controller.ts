import { Controller, ForbiddenException, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-aut-guard';
import { UsuarioActual, type UsuarioToken } from '../auth/decorators/usuario-actual.decorator';
import { VinculosService } from '../vinculos/vinculos.service';
import { MisLogrosService } from './mis-logros.service';

@UseGuards(JwtAuthGuard)
@Controller('mis-logros')
export class MisLogrosController {
  constructor(
    private misLogrosService: MisLogrosService,
    private vinculosService: VinculosService,
  ) {}

  /** El dashboard de quien inició sesión. */
  @Get()
  propio(@UsuarioActual() usuario: UsuarioToken) {
    return this.misLogrosService.resumen(usuario.idUsuario);
  }

  /** El dashboard de otro estudiante: para el profesor o apoderado vinculado y
   *  los administradores (misma regla que el resto del detalle del niño). */
  @Get('estudiante/:id')
  async deEstudiante(@UsuarioActual() actor: UsuarioToken, @Param('id', ParseIntPipe) id: number) {
    if (!(await this.vinculosService.puedeVerEstudiante(actor, id))) {
      throw new ForbiddenException('No puedes ver el progreso de este estudiante');
    }
    return this.misLogrosService.resumen(id);
  }
}
