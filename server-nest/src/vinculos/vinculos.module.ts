import { Module } from '@nestjs/common';
import { VinculosController } from './vinculos.controller';
import { VinculosService } from './vinculos.service';

@Module({
  controllers: [VinculosController],
  providers: [VinculosService],
  // UsuariosService lo usa para vincular al profesor que crea un estudiante.
  exports: [VinculosService],
})
export class VinculosModule {}
