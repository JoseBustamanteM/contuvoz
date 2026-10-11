import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ColegiosService {
  constructor(private prisma: PrismaService) {}

  async listar() {
    return this.prisma.colegio.findMany({
      where: { activo: true },
      select: { idColegio: true, nomColegio: true },
      orderBy: { nomColegio: 'asc' },
    });
  }
}
