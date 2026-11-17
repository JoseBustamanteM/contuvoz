// src/common/filtros/prisma-excepcion.filter.ts
import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

/**
 * Traduce los errores conocidos de Prisma a respuestas HTTP claras.
 *
 * Sin esto, cualquier error de la base llegaba como 500 "Internal server
 * error": por ejemplo, dos personas creando el mismo RUT a la vez (el
 * segundo pasa la verificación previa y choca con el índice único). El
 * frontend mostraba "el servidor tuvo un problema" cuando en realidad era un
 * dato repetido.
 *
 * | Código | Qué pasó                                   | Respuesta |
 * |--------|--------------------------------------------|-----------|
 * | P2002  | Valor repetido en un índice único          | 409       |
 * | P2000  | Texto más largo que la columna             | 400       |
 * | P2003  | Referencia a algo que no existe            | 400       |
 * | P2004  | Restricción de la base (CHECK) no cumplida | 400       |
 * | P2025  | El registro a modificar no existe          | 404       |
 *
 * Los servicios que ya atrapan un código por su cuenta (vínculos, intentos
 * de actividad) siguen haciéndolo: este filtro solo ve lo que nadie atrapó.
 * Cualquier otro error de Prisma sigue siendo 500 y queda en el log.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExcepcionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Prisma');

  catch(error: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const traducido = this.traducir(error);

    if (!traducido) {
      this.logger.error(`${error.code}: ${error.message}`);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
      });
      return;
    }

    this.logger.warn(`${error.code} → ${traducido.status}: ${traducido.message}`);
    res.status(traducido.status).json({
      statusCode: traducido.status,
      message: traducido.message,
    });
  }

  private traducir(error: Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        return { status: HttpStatus.CONFLICT, message: this.mensajeDuplicado(error) };
      case 'P2000':
        return { status: HttpStatus.BAD_REQUEST, message: 'Uno de los datos es demasiado largo' };
      case 'P2003':
        return { status: HttpStatus.BAD_REQUEST, message: 'Se hace referencia a un registro que no existe' };
      case 'P2004':
        return { status: HttpStatus.BAD_REQUEST, message: 'Los datos no cumplen las reglas de la base' };
      case 'P2025':
        return { status: HttpStatus.NOT_FOUND, message: 'El registro no existe' };
      default:
        return null;
    }
  }

  private mensajeDuplicado(error: Prisma.PrismaClientKnownRequestError): string {
    // meta.target trae el nombre del índice (MySQL/MariaDB) o sus columnas.
    const objetivo = JSON.stringify(error.meta?.target ?? '');
    if (/rut/i.test(objetivo)) return 'Ya existe un usuario con ese RUT';
    if (/correo/i.test(objetivo)) return 'Ya existe un usuario con ese correo';
    return 'Ese registro ya existe';
  }
}
