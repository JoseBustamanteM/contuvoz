import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface UsuarioToken {
  idUsuario: number;
  idRol: number;
}

export const UsuarioActual = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): UsuarioToken => {
    return ctx.switchToHttp().getRequest().user;
  },
);
