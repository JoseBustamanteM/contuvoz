import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ParseFilePipeBuilder,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-aut-guard';
import { BibliotecaService } from './biblioteca.service';
import { CrearArchivoBibliotecaDto } from './dto/crear-archivo-biblioteca.dto';

const MAX_FILE_SIZE = 25 * 1024 * 1024;

const ALLOWED_FILE_TYPES =
  /^(application\/pdf|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|image\/png|image\/jpeg|video\/mp4)$/;

@UseGuards(JwtAuthGuard)
@Controller('biblioteca')
export class BibliotecaController {
  constructor(
    private bibliotecaService: BibliotecaService,
  ) {}

  @Get()
  async listar() {
    return this.bibliotecaService.listar();
  }

  @Get(':id')
  async obtener(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.bibliotecaService.obtener(id);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: MAX_FILE_SIZE,
        files: 1,
      },
    }),
  )
  async subir(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: ALLOWED_FILE_TYPES,
        })
        .addMaxSizeValidator({
          maxSize: MAX_FILE_SIZE,
        })
        .build({
          fileIsRequired: true,
        }),
    )
    file: Express.Multer.File,

    @Body() dto: CrearArchivoBibliotecaDto,

    @Req() req: Request,
  ) {
    const usuario = req.user as
      | {
          idUsuario?: number;
          sub?: number | string;
        }
      | undefined;

    const idUsuario = Number(
      usuario?.idUsuario ?? usuario?.sub,
    );

    if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
      throw new BadRequestException(
        'No fue posible identificar al usuario autenticado',
      );
    }

    return this.bibliotecaService.crear(
      dto,
      file,
      idUsuario,
    );
  }
}
