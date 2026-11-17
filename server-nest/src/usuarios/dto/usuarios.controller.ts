import {
  Controller, Get, Post, Patch, Param, Query, Body, UseGuards, ParseIntPipe, ParseEnumPipe,
  BadRequestException,
} from '@nestjs/common';
import { TipoVinculo } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-aut-guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UsuarioActual, type UsuarioToken } from '../../auth/decorators/usuario-actual.decorator';
import { Rol } from '../../enums/rol.enum';
import { UsuariosService } from './usuarios.service';
import { CrearUsuarioDto } from './crear-usuario.dto';
import { ActualizarUsuarioDto } from './actualizar-usuario.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('usuarios')
export class UsuariosController {
  constructor(private usuariosService: UsuariosService) {}

  @Roles(Rol.ADMINISTRADOR, Rol.ADMIN_COLEGIO, Rol.PROFESOR)
  @Post()
  async crear(@UsuarioActual() creador: UsuarioToken, @Body() dto: CrearUsuarioDto) {
    return this.usuariosService.crear(creador, dto);
  }

  @Roles(Rol.ADMINISTRADOR, Rol.ADMIN_COLEGIO, Rol.PROFESOR)
  @Get()
  async listar(
    @UsuarioActual() creador: UsuarioToken,
    // ParseIntPipe: "?rol=abc" responde 400 en vez de llegar como NaN.
    @Query('rol', new ParseIntPipe({ optional: true })) rol?: number,
    @Query('colegio', new ParseIntPipe({ optional: true })) colegio?: number,
    @Query(
      'sinVinculo',
      new ParseEnumPipe(TipoVinculo, {
        optional: true,
        exceptionFactory: () =>
          new BadRequestException('sinVinculo debe ser PROFESOR o APODERADO'),
      }),
    )
    sinVinculo?: TipoVinculo,
  ) {
    return this.usuariosService.listar(
      creador,
      rol || undefined,
      colegio || undefined,
      sinVinculo,
    );
  }

  /** Apoderados del colegio que el profesor puede elegir al vincular, solo
   *  con nombre. Va antes de ':id' para que Nest no lo tome como un id. */
  @Roles(Rol.PROFESOR)
  @Get('apoderados-vinculables')
  async apoderadosVinculables(@UsuarioActual() creador: UsuarioToken) {
    return this.usuariosService.apoderadosVinculables(creador);
  }

  @Roles(Rol.ADMINISTRADOR, Rol.ADMIN_COLEGIO, Rol.PROFESOR)
  @Get(':id')
  async obtenerUno(
    @UsuarioActual() creador: UsuarioToken,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.usuariosService.obtenerUno(creador, id);
  }

  @Roles(Rol.ADMINISTRADOR, Rol.ADMIN_COLEGIO, Rol.PROFESOR)
  @Patch(':id')
  async actualizar(
    @UsuarioActual() creador: UsuarioToken,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarUsuarioDto,
  ) {
    return this.usuariosService.actualizar(creador, id, dto);
  }

  @Roles(Rol.ADMINISTRADOR, Rol.ADMIN_COLEGIO, Rol.PROFESOR)
  @Patch(':id/desactivar')
  async desactivar(
    @UsuarioActual() creador: UsuarioToken,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.usuariosService.desactivar(creador, id);
  }

  @Roles(Rol.ADMINISTRADOR, Rol.ADMIN_COLEGIO, Rol.PROFESOR)
  @Patch(':id/reactivar')
  async reactivar(
    @UsuarioActual() creador: UsuarioToken,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.usuariosService.reactivar(creador, id);
  }
}
