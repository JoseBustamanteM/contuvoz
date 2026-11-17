import { HttpStatus, UnauthorizedException, HttpException } from '@nestjs/common';
import { AuthService } from './auth.service';

/**
 * Sesión: límite de intentos de login, rotación atómica del refresh token y
 * detección de reúso. Prisma y JWT van simulados.
 */

const CONFIG: Record<string, unknown> = {
  ACCESS_TOKEN_EXPIRA: '15m',
  REFRESH_TOKEN_DIAS: 7,
  SESION_MAX_DIAS: 30,
};

function crearPrisma() {
  return {
    usuario: { findFirst: jest.fn(), update: jest.fn() },
    sesion: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
    sesionToken: { findFirst: jest.fn(), updateMany: jest.fn(), create: jest.fn() },
    $transaction: jest.fn().mockResolvedValue([]),
  };
}

function crearServicio(prisma: ReturnType<typeof crearPrisma>) {
  const jwt = { sign: jest.fn().mockReturnValue('token-acceso') };
  const config = { get: (clave: string) => CONFIG[clave] };
  return new AuthService(prisma as never, jwt as never, config as never);
}

describe('AuthService.login: límite de intentos', () => {
  it('con 5 fallos recientes del mismo RUT responde 429 sin revisar la clave', async () => {
    const prisma = crearPrisma();
    prisma.sesion.findFirst.mockResolvedValue(null); // sin login correcto reciente
    const haceUnMinuto = new Date(Date.now() - 60_000);
    prisma.sesion.findMany.mockResolvedValue(Array(5).fill({ fechaInicio: haceUnMinuto }));

    const error = await crearServicio(prisma)
      .login('19.497.449-3', 'lo-que-sea', '1.2.3.4', 'test')
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(prisma.usuario.findFirst).not.toHaveBeenCalled();
    // El intento bloqueado no se registra (no alarga el bloqueo).
    expect(prisma.sesion.create).not.toHaveBeenCalled();
  });

  it('cuenta el RUT normalizado: con y sin puntos es el mismo', async () => {
    const prisma = crearPrisma();
    prisma.sesion.findFirst.mockResolvedValue(null);
    prisma.sesion.findMany.mockResolvedValue([]);
    prisma.sesion.count.mockResolvedValue(0);
    prisma.usuario.findFirst.mockResolvedValue(null);
    prisma.sesion.create.mockResolvedValue({ idSesion: 1, fechaInicio: new Date() });

    await crearServicio(prisma).login('19.497.449-3', 'x', '1.2.3.4', 'test').catch(() => undefined);

    expect(prisma.sesion.findMany.mock.calls[0][0].where.rutIntentado).toBe('194974493');
    expect(prisma.sesion.create.mock.calls[0][0].data.rutIntentado).toBe('194974493');
  });
});

describe('AuthService.refrescarToken', () => {
  const tokenVigente = {
    idSesionToken: 7,
    idUsuario: 3,
    idSesion: 40,
    sesion: { fechaInicio: new Date(), fechaFin: null },
  };

  it('si otra petición ya rotó el mismo token, responde 401 y no genera otro', async () => {
    const prisma = crearPrisma();
    prisma.sesionToken.findFirst.mockResolvedValue(tokenVigente);
    prisma.sesionToken.updateMany.mockResolvedValue({ count: 0 }); // ya estaba revocado

    await expect(crearServicio(prisma).refrescarToken('abc', 'ip', 'ua')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.sesionToken.create).not.toHaveBeenCalled();
  });

  it('no renueva una sesión ya cerrada', async () => {
    const prisma = crearPrisma();
    prisma.sesionToken.findFirst.mockResolvedValue({
      ...tokenVigente,
      sesion: { fechaInicio: new Date(), fechaFin: new Date() },
    });

    await expect(crearServicio(prisma).refrescarToken('abc', 'ip', 'ua')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.sesionToken.updateMany).not.toHaveBeenCalled();
  });

  /** Token ya reemplazado hace `segundos`: simula la búsqueda del vigente
   *  (no lo encuentra), la del usado y la de su reemplazo. */
  function reutilizado(segundos: number) {
    const prisma = crearPrisma();
    prisma.sesionToken.findFirst
      .mockResolvedValueOnce(null) // no hay token vigente con ese hash
      .mockResolvedValueOnce({ idSesionToken: 7, idSesion: 40, sesion: { fechaFin: null } })
      .mockResolvedValueOnce({ fechaCreacion: new Date(Date.now() - segundos * 1000) });
    return prisma;
  }

  it('un token reutilizado pasado el margen de gracia cierra toda la sesión', async () => {
    const prisma = reutilizado(60);

    await expect(crearServicio(prisma).refrescarToken('viejo', 'ip', 'ua')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('dentro del margen de gracia (dos pestañas a la vez) no cierra la sesión', async () => {
    const prisma = reutilizado(5);

    await expect(crearServicio(prisma).refrescarToken('viejo', 'ip', 'ua')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
