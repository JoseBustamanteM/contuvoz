import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-aut-guard';
import { UsuarioActual, type UsuarioToken  } from '../auth/decorators/usuario-actual.decorator';
import { ActividadesService } from './actividades.service';
import { GuardarPintadoDto } from '../auth/dto/guardar-pintado.dto';
import { GuardarSignDto } from './dto/guardar-sign.dto';


@UseGuards(JwtAuthGuard)
@Controller('actividades')
export class ActividadesController {
  constructor(private actividadesService: ActividadesService) {}

  @Post('pintado')
async guardarPintado(
  @UsuarioActual() usuario: UsuarioToken,
  @Body() dto: GuardarPintadoDto,
) {
  return this.actividadesService.guardarPintado(usuario.idUsuario, dto);
}

@Post('sign')
async guardarSign(
  @UsuarioActual() usuario: UsuarioToken,
  @Body() dto: GuardarSignDto,
) {
  return this.actividadesService.guardarSign(usuario.idUsuario, dto);
}
}
