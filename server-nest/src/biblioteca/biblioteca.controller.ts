import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseFilePipeBuilder,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-aut-guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../enums/rol.enum';

import { BibliotecaService } from './biblioteca.service';
import { CrearArchivoBibliotecaDto } from './dto/crear-archivo-biblioteca.dto';
import { EditarArchivoBibliotecaDto } from './dto/editar-archivo-biblioteca.dto';

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
  @UseGuards(RolesGuard)
  @Roles(
    Rol.ADMINISTRADOR,
    Rol.ADMIN_COLEGIO,
    Rol.PROFESOR,
  )
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: MAX_FILE_SIZE,
        files: 1,
      },
    }),
  )

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(
    Rol.ADMINISTRADOR,
    Rol.ADMIN_COLEGIO,
    Rol.PROFESOR,
  )
  async actualizar(
    @Param('id', ParseIntPipe) id: number,

    @Body()
    dto: EditarArchivoBibliotecaDto,
  ) {
    return this.bibliotecaService.actualizar(
      id,
      dto,
    );
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(
    Rol.ADMINISTRADOR,
    Rol.ADMIN_COLEGIO,
    Rol.PROFESOR,
  )
  async eliminar(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.bibliotecaService.eliminar(id);
  }
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

    @Body()
    dto: CrearArchivoBibliotecaDto,

    @Req()
    req: Request,
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
