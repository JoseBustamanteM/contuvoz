import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards, ParseIntPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-aut-guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioActual, type UsuarioToken } from '../auth/decorators/usuario-actual.decorator';
import { Rol } from '../enums/rol.enum';
import { VinculosService } from './vinculos.service';
import { CrearVinculoDto } from './dto/crear-vinculo.dto';

/** Las reglas finas (qué tipo de vínculo, de qué alumno) están en el servicio;
 *  @Roles solo deja fuera a quien nunca puede usar la ruta. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('vinculos')
export class VinculosController {
  constructor(private vinculosService: VinculosService) {}

  @Roles(Rol.ADMINISTRADOR, Rol.ADMIN_COLEGIO, Rol.PROFESOR)
  @Post()
  crear(@UsuarioActual() actor: UsuarioToken, @Body() dto: CrearVinculoDto) {
    return this.vinculosService.crear(actor, dto);
  }

  @Roles(Rol.ADMINISTRADOR, Rol.ADMIN_COLEGIO, Rol.PROFESOR)
  @Patch(':id/deshabilitar')
  deshabilitar(@UsuarioActual() actor: UsuarioToken, @Param('id', ParseIntPipe) id: number) {
    return this.vinculosService.deshabilitar(actor, id);
  }

  /** Vínculos vigentes del estudiante; `?historial=true` incluye los cerrados (solo admins). */
  @Roles(Rol.ADMINISTRADOR, Rol.ADMIN_COLEGIO, Rol.PROFESOR)
  @Get('estudiante/:id')
  listarDeEstudiante(
    @UsuarioActual() actor: UsuarioToken,
    @Param('id', ParseIntPipe) id: number,
    @Query('historial') historial?: string,
  ) {
    return this.vinculosService.listarDeEstudiante(actor, id, historial === 'true');
  }

  @Roles(Rol.PROFESOR, Rol.APODERADO)
  @Get('mis-estudiantes')
  misEstudiantes(@UsuarioActual() actor: UsuarioToken) {
    return this.vinculosService.misEstudiantes(actor);
  }
}
