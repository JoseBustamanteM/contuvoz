import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaService } from '../../prisma/prisma.service';
import { CrearArchivoBibliotecaDto } from './dto/crear-archivo-biblioteca.dto';

@Injectable()
export class BibliotecaService {
  constructor(private prisma: PrismaService) {}

  async listar() {
    return this.prisma.archivoBiblioteca.findMany({
      select: {
        idArchivo: true,
        tituloArchivo: true,
        descripcionArchivo: true,
        rutaArchivoUrl: true,
        tipoArchivo: true,
        fechaSubido: true,
        imagenUrl: true,
        imagenDescripcionUrl: true,
        idUsuario: true,
      },
      orderBy: {
        fechaSubido: 'desc',
      },
    });
  }

  async obtener(idArchivo: number) {
    const archivo = await this.prisma.archivoBiblioteca.findUnique({
      where: { idArchivo },
      select: {
        idArchivo: true,
        tituloArchivo: true,
        descripcionArchivo: true,
        rutaArchivoUrl: true,
        tipoArchivo: true,
        fechaSubido: true,
        imagenUrl: true,
        imagenDescripcionUrl: true,
        idUsuario: true,
      },
    });

    if (!archivo) {
      throw new NotFoundException(
        'Archivo de biblioteca no encontrado',
      );
    }

    return archivo;
  }

  async crear(
    dto: CrearArchivoBibliotecaDto,
    file: Express.Multer.File,
    idUsuario: number,
  ) {
    if (!file) {
      throw new BadRequestException(
        'Debes seleccionar un archivo',
      );
    }

    const extensionPorMime: Record<string, string> = {
      'application/pdf': 'pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        'docx',
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'video/mp4': 'mp4',
    };

    const extension = extensionPorMime[file.mimetype];

    if (!extension) {
      throw new BadRequestException(
        'Tipo de archivo no soportado',
      );
    }

    const filename = `${crypto.randomUUID()}.${extension}`;

    const uploadDir = join(
      process.cwd(),
      'uploads',
      'biblioteca',
    );

    const filePath = join(uploadDir, filename);

    const rutaArchivoUrl = `/uploads/biblioteca/${filename}`;

    const tipoArchivo = this.obtenerTipoArchivo(
      file.mimetype,
    );

    try {
      /*
       * The interceptor keeps the file in memory.
       * We now persist it using the server-generated filename.
       */

      await writeFile(filePath, file.buffer);

      const archivo =
        await this.prisma.archivoBiblioteca.create({
          data: {
            tituloArchivo: dto.tituloArchivo.trim(),

            descripcionArchivo:
              dto.descripcionArchivo?.trim() || null,

            rutaArchivoUrl,

            tipoArchivo,

            idUsuario,

            /*
             * These fields are required by the existing Prisma model.
             *
             * For Milestone 3A we don't upload a separate thumbnail.
             * The Angular UI can continue using the existing image URL.
             */
            imagenUrl: '',

            imagenDescripcionUrl: '',
          },

          select: {
            idArchivo: true,
            tituloArchivo: true,
            descripcionArchivo: true,
            rutaArchivoUrl: true,
            tipoArchivo: true,
            fechaSubido: true,
            imagenUrl: true,
            imagenDescripcionUrl: true,
            idUsuario: true,
          },
        });

      return archivo;
    } catch (error) {
      /*
       * If Prisma fails after the physical file was written,
       * remove the file so we don't leave an orphan.
       */
      try {
        await unlink(filePath);
      } catch {
        // Nothing else to do if cleanup also fails.
      }

      throw error;
    }
  }

  private obtenerTipoArchivo(mimeType: string): string {
    switch (mimeType) {
      case 'application/pdf':
        return 'pdf';

      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return 'docx';

      case 'image/png':
      case 'image/jpeg':
        return 'imagen';

      case 'video/mp4':
        return 'video';

      default:
        throw new BadRequestException(
          'Tipo de archivo no soportado',
        );
    }
  }
}
