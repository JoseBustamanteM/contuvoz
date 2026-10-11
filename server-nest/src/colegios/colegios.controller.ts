import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-aut-guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../enums/rol.enum';
import { ColegiosService } from './colegios.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('colegios')
export class ColegiosController {
  constructor(private colegiosService: ColegiosService) {}

  @Roles(Rol.ADMINISTRADOR)
  @Get()
  async listar() {
    return this.colegiosService.listar();
  }
}
