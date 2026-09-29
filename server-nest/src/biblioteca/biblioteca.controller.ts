import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-aut-guard';
import { BibliotecaService } from './biblioteca.service';

@UseGuards(JwtAuthGuard)
@Controller('biblioteca')
export class BibliotecaController {
  constructor(private bibliotecaService: BibliotecaService) {}

  @Get()
  async listar() {
    return this.bibliotecaService.listar();
  }

  @Get(':id')
  async obtener(@Param('id', ParseIntPipe) id: number) {
    return this.bibliotecaService.obtener(id);
  }
}
