import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

/**
 * Quien debe cambiar la clave que le dieron solo puede ver su perfil y
 * cambiarla, aunque llame a la API directamente.
 */

function crear(usuario: object | null) {
  const prisma = { usuario: { findFirst: jest.fn().mockResolvedValue(usuario) } };
  const config = { get: () => 'secreto-de-prueba-con-mas-de-32-caracteres' };
  return new JwtStrategy(config as never, prisma as never);
}

const req = (method: string, path: string) => ({ method, path }) as never;
const payload = { sub: 7, rol: 3 };

describe('JwtStrategy', () => {
  it('un usuario desactivado (o que no existe) queda fuera', async () => {
    await expect(crear(null).validate(req('GET', '/api/auth/me'), payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('con la clave al día pasa a cualquier ruta, con el rol actual', async () => {
    const s = crear({ idUsuario: 7, idRol: 2, debeCambiarClave: false });
    await expect(s.validate(req('GET', '/api/usuarios'), payload)).resolves.toEqual({ idUsuario: 7, idRol: 2 });
  });

  it.each([
    ['GET', '/api/auth/me'],
    ['POST', '/api/auth/cambiar-clave'],
  ])('con la clave pendiente puede %s %s', async (method, path) => {
    const s = crear({ idUsuario: 7, idRol: 3, debeCambiarClave: true });
    await expect(s.validate(req(method, path), payload)).resolves.toEqual({ idUsuario: 7, idRol: 3 });
  });

  it.each([
    ['GET', '/api/usuarios'],
    ['POST', '/api/actividades/pronunciacion'],
    ['GET', '/api/mis-logros'],
    ['POST', '/api/auth/me'],
  ])('con la clave pendiente NO puede %s %s', async (method, path) => {
    const s = crear({ idUsuario: 7, idRol: 3, debeCambiarClave: true });
    const error = await s.validate(req(method, path), payload).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toMatchObject({ codigo: 'CAMBIO_CLAVE_PENDIENTE' });
  });
});
