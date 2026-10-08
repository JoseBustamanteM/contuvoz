import { Module } from '@nestjs/common';
import { VinculosModule } from '../vinculos/vinculos.module';
import { MisLogrosController } from './mis-logros.controller';
import { MisLogrosService } from './mis-logros.service';

@Module({
  imports: [VinculosModule],
  controllers: [MisLogrosController],
  providers: [MisLogrosService],
})
export class MisLogrosModule {}
