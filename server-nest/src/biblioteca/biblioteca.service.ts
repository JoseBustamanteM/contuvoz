import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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
      throw new NotFoundException('Archivo de biblioteca no encontrado');
    }

    return archivo;
  }
}
