import { MisLogrosService } from './mis-logros.service';

/**
 * Fechas de Mis logros. Prisma guarda en UTC y el día del niño es el de
 * Chile: estas pruebas fijan "ahora" y arman actividades en UTC para
 * comprobar que se cuentan en el día chileno correcto, también en los dos
 * cambios de hora (en 2026: 5 de abril y 6 de septiembre).
 */

const TIPO = { PINTA: 1, SIGN: 2, HABLEMOS: 3, UNE: 4 };

let siguienteId = 1;

/** Un intento de Hablemos (o Comunícate) en la fecha UTC indicada. */
function vocal(utc: string, letra: string, aprobado: boolean, tipo = TIPO.HABLEMOS) {
  return {
    idActividad: siguienteId++,
    idTipoActividad: tipo,
    fechaActividad: new Date(utc),
    resultadoPintado: null,
    resultadoSign:
      tipo === TIPO.SIGN ? { letraEsperada: letra, letraDetectada: letra, aprobadoSign: aprobado } : null,
    resultadoPronunciacion:
      tipo === TIPO.HABLEMOS
        ? { textoEsperado: letra, textoDetectado: aprobado ? letra : 'NINGUNA', aprobadoPronun: aprobado }
        : null,
    resultadoUnePalabras: null,
  };
}

/** Servicio con un Prisma falso que devuelve `actividades` como lo haría
 *  la base: filtradas por tipo y de la más reciente a la más antigua. */
function crearServicio(actividades: ReturnType<typeof vocal>[]) {
  const prisma = {
    actividad: {
      findMany: jest.fn(({ where }: { where: { idTipoActividad: number } }) =>
        Promise.resolve(
          actividades
            .filter((a) => a.idTipoActividad === where.idTipoActividad)
            .sort((x, y) => y.fechaActividad.getTime() - x.fechaActividad.getTime()),
        ),
      ),
    },
  };
  const config = { get: () => 'America/Santiago' };
  return new MisLogrosService(prisma as never, config as never);
}

describe('MisLogrosService', () => {
  beforeEach(() => {
    siguienteId = 1;
  });
  afterEach(() => jest.useRealTimers());

  it('cuenta una actividad de las 23:30 en el día de Chile, no en el UTC', async () => {
    // Ahora: miércoles 18 de noviembre de 2026, 09:00 en Chile (UTC-3).
    jest.useFakeTimers({ now: new Date('2026-11-18T12:00:00Z'), doNotFake: ['nextTick', 'setImmediate'] });
    // Lunes 16 a las 23:30 en Chile = martes 17 a las 02:30 UTC.
    const servicio = crearServicio([vocal('2026-11-17T02:30:00Z', 'A', true)]);

    const r = await servicio.resumen(1);

    expect(r.diasSemana).toEqual([true, false, false, false, false, false, false]);
  });

  it('las estrellas de la semana empiezan el lunes en Chile', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-18T12:00:00Z'), doNotFake: ['nextTick', 'setImmediate'] });
    const servicio = crearServicio([
      vocal('2026-11-17T15:00:00Z', 'A', true), // martes 17: cuenta
      vocal('2026-11-16T02:30:00Z', 'E', true), // domingo 15, 23:30 Chile: semana pasada
      vocal('2026-11-16T03:30:00Z', 'O', true), // lunes 16, 00:30 Chile: esta semana
      vocal('2026-11-17T16:00:00Z', 'I', false), // no aprobado: no es estrella
    ]);

    const r = await servicio.resumen(1);

    expect(r.estrellasSemana).toBe(2);
    expect(r.estrellasPorActividad.hablemos).toBe(2);
  });

  it('la racha no se corta cuando Chile adelanta la hora (6 de septiembre)', async () => {
    // Martes 8 de septiembre, 09:00 en Chile (ya en UTC-3).
    jest.useFakeTimers({ now: new Date('2026-09-08T12:00:00Z'), doNotFake: ['nextTick', 'setImmediate'] });
    // Todos los días a las 21:00 de Chile, del viernes 4 al lunes 7.
    const servicio = crearServicio([
      vocal('2026-09-05T01:00:00Z', 'A', true), // vie 4, UTC-4
      vocal('2026-09-06T01:00:00Z', 'A', true), // sáb 5, UTC-4
      vocal('2026-09-07T00:00:00Z', 'A', true), // dom 6, UTC-3
      vocal('2026-09-08T00:00:00Z', 'A', true), // lun 7, UTC-3
    ]);

    const r = await servicio.resumen(1);

    // Hoy (martes) aún no juega: la racha de ayer sigue viva.
    expect(r.racha).toBe(4);
  });

  it('la racha no se corta cuando Chile atrasa la hora (5 de abril)', async () => {
    // Lunes 6 de abril, 11:00 en Chile (ya en UTC-4).
    jest.useFakeTimers({ now: new Date('2026-04-06T15:00:00Z'), doNotFake: ['nextTick', 'setImmediate'] });
    const servicio = crearServicio([
      vocal('2026-04-04T02:30:00Z', 'O', true), // vie 3, 23:30 UTC-3
      vocal('2026-04-05T02:30:00Z', 'O', true), // sáb 4, 23:30 UTC-3
      vocal('2026-04-06T03:30:00Z', 'O', true), // dom 5, 23:30 UTC-4
    ]);

    const r = await servicio.resumen(1);

    expect(r.racha).toBe(3);
  });

  it('un día sin jugar corta la racha', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-18T12:00:00Z'), doNotFake: ['nextTick', 'setImmediate'] });
    const servicio = crearServicio([
      vocal('2026-11-18T11:00:00Z', 'A', true), // hoy
      vocal('2026-11-17T11:00:00Z', 'A', true), // ayer
      vocal('2026-11-15T11:00:00Z', 'A', true), // anteayer no; este no suma
    ]);

    expect((await servicio.resumen(1)).racha).toBe(2);
  });

  it('el estado de cada letra mira solo sus últimos 5 intentos', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-18T12:00:00Z'), doNotFake: ['nextTick', 'setImmediate'] });
    const hora = (n: number) => new Date(Date.UTC(2026, 10, 18, 11, 0) - n * 60_000).toISOString();
    const servicio = crearServicio([
      // A: 3 aprobados entre los últimos 5 → dominada.
      vocal(hora(1), 'A', true), vocal(hora(2), 'A', false), vocal(hora(3), 'A', true),
      vocal(hora(4), 'A', false), vocal(hora(5), 'A', true),
      // E: 5 fallos recientes; los aprobados son más antiguos que esos 5 → por descubrir.
      vocal(hora(10), 'E', false), vocal(hora(11), 'E', false), vocal(hora(12), 'E', false),
      vocal(hora(13), 'E', false), vocal(hora(14), 'E', false),
      vocal(hora(15), 'E', true), vocal(hora(16), 'E', true), vocal(hora(17), 'E', true),
      // I: un aprobado → practicando.
      vocal(hora(20), 'I', true),
    ]);

    const r = await servicio.resumen(1);
    const estado = Object.fromEntries(r.hablemos.letras.map((l) => [l.letra, l.estado]));

    expect(estado).toEqual({
      A: 'dominada',
      E: 'por-descubrir',
      I: 'practicando',
      O: 'por-descubrir',
      U: 'por-descubrir',
    });
  });

  it('un intento DUDOSA (pidió repetir) no cuenta como fallo, pero sí como día jugado', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-18T12:00:00Z'), doNotFake: ['nextTick', 'setImmediate'] });
    const hora = (n: number) => new Date(Date.UTC(2026, 10, 18, 11, 0) - n * 60_000).toISOString();
    const dudosa = (utc: string) => {
      const a = vocal(utc, 'A', false);
      a.resultadoPronunciacion!.textoDetectado = 'DUDOSA';
      return a;
    };
    const servicio = crearServicio([
      // 5 dudosas recientes encima de 3 aprobados: la A sigue dominada.
      dudosa(hora(1)), dudosa(hora(2)), dudosa(hora(3)), dudosa(hora(4)), dudosa(hora(5)),
      vocal(hora(6), 'A', true), vocal(hora(7), 'A', true), vocal(hora(8), 'A', true),
      // Ayer solo hubo dudosas: igual mantiene la racha.
      dudosa('2026-11-17T15:00:00Z'), dudosa('2026-11-17T15:01:00Z'), dudosa('2026-11-17T15:02:00Z'),
    ]);

    const r = await servicio.resumen(1);

    expect(r.hablemos.letras.find((l) => l.letra === 'A')?.estado).toBe('dominada');
    expect(r.hablemos.pista).toBeNull();
    expect(r.racha).toBe(2);
  });

  it('Comunícate y Hablemos se evalúan por separado', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-18T12:00:00Z'), doNotFake: ['nextTick', 'setImmediate'] });
    const servicio = crearServicio([vocal('2026-11-18T11:00:00Z', 'U', true, TIPO.SIGN)]);

    const r = await servicio.resumen(1);

    expect(r.comunicate.letras.find((l) => l.letra === 'U')?.estado).toBe('practicando');
    expect(r.hablemos.letras.find((l) => l.letra === 'U')?.estado).toBe('por-descubrir');
  });
});
