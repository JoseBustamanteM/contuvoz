import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Calcula el dashboard "Mis logros" de un estudiante a partir de las tablas de
 * resultados. No guarda nada: todo se deriva de lo que ya registran las
 * actividades.
 *
 * Reglas:
 * - Estrella: cada intento APROBADO de la semana (lunes a domingo).
 * - Letra "dominada": 3 o más aprobados en sus últimos 5 intentos.
 *   "practicando": 1 o 2 aprobados en esos 5. "por-descubrir": ninguno
 *   (también si nunca la intentó).
 * - Racha: días seguidos con actividad, terminando hoy o ayer (si hoy aún no
 *   jugó, la racha de ayer sigue viva).
 * - Palabra conocida (Une palabras): la unió bien a la primera en alguna ronda.
 *
 * ⚠️ Fechas: Prisma guarda fecha_actividad en UTC, pero el día del niño es el
 * de Chile. Una actividad a las 21:30 queda guardada como 00:30 del día
 * siguiente; por eso los días se calculan convirtiendo a ZONA_HORARIA y no con
 * DATE() en SQL.
 */

const ZONA_HORARIA = process.env.ZONA_HORARIA ?? 'America/Santiago';

const TIPO = { PINTA: 1, SIGN: 2, HABLEMOS: 3, UNE: 4 } as const;

const VOCALES = ['A', 'E', 'I', 'O', 'U'];
const ABECEDARIO = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('');

const INTENTOS_EVALUADOS = 5;
const APROBADOS_PARA_DOMINAR = 3;

/** Para las pistas solo se miran los intentos recientes: un error de hace
 *  meses ya no describe cómo le va hoy. */
const INTENTOS_PARA_PISTA = 30;
/** Una confusión tiene que repetirse para convertirse en pista. */
const MINIMO_PARA_PISTA = 2;

/** Consejos de Comunícate: los mismos textos que muestra el hand-tracker. */
const CONSEJO_SENA: Record<string, string> = {
  A: 'Para la A, cierra el puño con el pulgar al lado',
  E: 'Para la E, encoge los dedos como garra y deja el pulgar afuera',
  I: 'Para la I, levanta solo el dedo meñique',
  O: 'Para la O, junta el pulgar con las puntas de los dedos',
  U: 'Para la U, levanta el índice y el meñique',
};

export type EstadoLetra = 'dominada' | 'practicando' | 'por-descubrir';
type ClaveActividad = 'pinta' | 'comunicate' | 'hablemos' | 'une';

export interface ResumenEstudiante {
  estrellasSemana: number;
  racha: number;
  diasSemana: boolean[];
  estrellasPorActividad: Record<ClaveActividad, number>;
  hablemos: { letras: { letra: string; estado: EstadoLetra }[]; pista: string | null };
  comunicate: { letras: { letra: string; estado: EstadoLetra }[]; pista: string | null };
  pinta: { letras: { letra: string; estado: EstadoLetra }[]; pista: string | null };
  /** Palabras que unió bien a la primera. El total lo pone el frontend, que es
   *  quien tiene el banco de palabras. */
  une: { palabrasConocidas: string[] };
}

/** Un intento, ya normalizado, de cualquier actividad con letras. */
interface Intento {
  letra: string;
  aprobado: boolean;
  /** Pronunciación / señas: lo que se detectó en vez de la letra pedida. */
  detectada?: string;
  /** Pintado: qué parte del trazo cayó fuera de la letra (0-100). */
  trazoExterno?: number;
}

@Injectable()
export class MisLogrosService {
  constructor(private prisma: PrismaService) {}

  async resumen(idEstudiante: number): Promise<ResumenEstudiante> {
    // Una sola consulta: todas las actividades con su resultado, de la más
    // reciente a la más antigua (el orden importa para "últimos 5 intentos").
    const actividades = await this.prisma.actividad.findMany({
      where: { idUsuario: idEstudiante },
      orderBy: [{ fechaActividad: 'desc' }, { idActividad: 'desc' }],
      select: {
        idTipoActividad: true,
        fechaActividad: true,
        resultadoPintado: { select: { letraEsperada: true, aprobadoPintado: true, trazoExterno: true } },
        resultadoSign: { select: { letraEsperada: true, letraDetectada: true, aprobadoSign: true } },
        resultadoPronunciacion: { select: { textoEsperado: true, textoDetectado: true, aprobadoPronun: true } },
        resultadoUnePalabras: { select: { detalle: true, aprobadoUne: true } },
      },
    });

    const hoy = this.diaLocal(new Date());
    const lunes = this.sumarDias(hoy, -this.diaSemana(hoy));

    const estrellasPorActividad: Record<ClaveActividad, number> = { pinta: 0, comunicate: 0, hablemos: 0, une: 0 };
    const diasConActividad = new Set<string>();
    const diasSemana = Array<boolean>(7).fill(false);

    const pinta: Intento[] = [];
    const sign: Intento[] = [];
    const hablemos: Intento[] = [];
    const palabrasConocidas = new Set<string>();

    for (const a of actividades) {
      const dia = this.diaLocal(a.fechaActividad);
      diasConActividad.add(dia);
      const estaSemana = dia >= lunes;
      if (estaSemana) diasSemana[this.diaSemana(dia)] = true;

      const { resultadoPintado: rp, resultadoSign: rs, resultadoPronunciacion: rh, resultadoUnePalabras: ru } = a;

      if (a.idTipoActividad === TIPO.PINTA && rp) {
        pinta.push({ letra: rp.letraEsperada.toUpperCase(), aprobado: rp.aprobadoPintado, trazoExterno: rp.trazoExterno });
        if (estaSemana && rp.aprobadoPintado) estrellasPorActividad.pinta++;
      } else if (a.idTipoActividad === TIPO.SIGN && rs) {
        sign.push({ letra: rs.letraEsperada.toUpperCase(), aprobado: rs.aprobadoSign, detectada: rs.letraDetectada.toUpperCase() });
        if (estaSemana && rs.aprobadoSign) estrellasPorActividad.comunicate++;
      } else if (a.idTipoActividad === TIPO.HABLEMOS && rh) {
        hablemos.push({ letra: rh.textoEsperado.toUpperCase(), aprobado: rh.aprobadoPronun, detectada: rh.textoDetectado.toUpperCase() });
        if (estaSemana && rh.aprobadoPronun) estrellasPorActividad.hablemos++;
      } else if (a.idTipoActividad === TIPO.UNE && ru) {
        for (const p of this.palabrasLimpias(ru.detalle)) palabrasConocidas.add(p);
        // Une palabras no tiene "letras": una ronda aprobada es una estrella.
        if (estaSemana && ru.aprobadoUne) estrellasPorActividad.une++;
      }
    }

    const estadosHablemos = this.estados(hablemos, VOCALES);
    const estadosSign = this.estados(sign, VOCALES);
    const estadosPinta = this.estados(pinta, ABECEDARIO);

    return {
      estrellasSemana: Object.values(estrellasPorActividad).reduce((s, n) => s + n, 0),
      racha: this.racha(diasConActividad, hoy),
      diasSemana,
      estrellasPorActividad,
      hablemos: { letras: estadosHablemos, pista: this.pistaHablemos(hablemos, estadosHablemos) },
      comunicate: { letras: estadosSign, pista: this.pistaSign(sign, estadosSign) },
      pinta: { letras: estadosPinta, pista: this.pistaPinta(pinta, estadosPinta) },
      une: { palabrasConocidas: [...palabrasConocidas].sort() },
    };
  }

  // ── Estado de cada letra ─────────────────────────────────

  private estados(intentos: Intento[], letras: string[]) {
    // `intentos` viene del más reciente al más antiguo.
    const ultimos = new Map<string, boolean[]>();
    for (const i of intentos) {
      const lista = ultimos.get(i.letra) ?? [];
      if (lista.length < INTENTOS_EVALUADOS) lista.push(i.aprobado);
      ultimos.set(i.letra, lista);
    }

    return letras.map((letra) => {
      const aprobados = (ultimos.get(letra) ?? []).filter(Boolean).length;
      const estado: EstadoLetra =
        aprobados >= APROBADOS_PARA_DOMINAR ? 'dominada' : aprobados > 0 ? 'practicando' : 'por-descubrir';
      return { letra, estado };
    });
  }

  // ── Pistas ───────────────────────────────────────────────

  /** Fallos recientes de letras que todavía no domina. */
  private fallosRecientes(intentos: Intento[], estados: { letra: string; estado: EstadoLetra }[]) {
    const dominadas = new Set(estados.filter((e) => e.estado === 'dominada').map((e) => e.letra));
    return intentos.slice(0, INTENTOS_PARA_PISTA).filter((i) => !i.aprobado && !dominadas.has(i.letra));
  }

  /** La clave que más se repite, si se repite lo suficiente. */
  private masRepetida(claves: string[]): string | null {
    const conteo = new Map<string, number>();
    for (const c of claves) conteo.set(c, (conteo.get(c) ?? 0) + 1);
    let mejor: string | null = null;
    let max = 0;
    for (const [c, n] of conteo) if (n > max) [mejor, max] = [c, n];
    return max >= MINIMO_PARA_PISTA ? mejor : null;
  }

  private pistaHablemos(intentos: Intento[], estados: { letra: string; estado: EstadoLetra }[]) {
    const fallos = this.fallosRecientes(intentos, estados);
    const confusion = this.masRepetida(
      fallos.filter((f) => f.detectada && f.detectada !== 'NINGUNA' && f.detectada !== f.letra).map((f) => `${f.letra}→${f.detectada}`),
    );
    if (confusion) {
      const [pedida, dijo] = confusion.split('→');
      return `A veces tu ${pedida} suena como ${dijo}`;
    }
    if (this.masRepetida(fallos.filter((f) => f.detectada === 'NINGUNA').map(() => 'x'))) {
      return 'Habla fuerte y cerca del micrófono';
    }
    return null;
  }

  private pistaSign(intentos: Intento[], estados: { letra: string; estado: EstadoLetra }[]) {
    const fallos = this.fallosRecientes(intentos, estados);
    const letra = this.masRepetida(fallos.map((f) => f.letra));
    if (!letra) return null;
    const sinMano = fallos.filter((f) => f.letra === letra && f.detectada === 'NINGUNA').length;
    // Si casi nunca se vio la mano, el problema no es la seña sino la cámara.
    if (sinMano > fallos.filter((f) => f.letra === letra).length / 2) {
      return 'Muestra bien tu mano a la cámara';
    }
    return CONSEJO_SENA[letra] ?? null;
  }

  private pistaPinta(intentos: Intento[], estados: { letra: string; estado: EstadoLetra }[]) {
    const fallos = this.fallosRecientes(intentos, estados);
    const letra = this.masRepetida(fallos.map((f) => f.letra));
    if (!letra) return null;
    const deEsa = fallos.filter((f) => f.letra === letra);
    const fuera = deEsa.reduce((s, f) => s + (f.trazoExterno ?? 0), 0) / deEsa.length;
    return fuera > 30 ? `La ${letra} se te escapa por los bordes` : `Rellena toda la ${letra}`;
  }

  // ── Une palabras ─────────────────────────────────────────

  /** Palabras de la ronda que NO aparecen en sus confusiones: unidas a la primera. */
  private palabrasLimpias(detalle: unknown): string[] {
    const d = detalle as { pares?: unknown; confusiones?: unknown } | null;
    if (!d || !Array.isArray(d.pares)) return [];
    const confundidas = new Set(
      (Array.isArray(d.confusiones) ? d.confusiones : [])
        .map((c) => (c as { palabra?: unknown })?.palabra)
        .filter((p): p is string => typeof p === 'string'),
    );
    return d.pares.filter((p): p is string => typeof p === 'string' && !confundidas.has(p));
  }

  // ── Fechas (siempre en ZONA_HORARIA, como 'YYYY-MM-DD') ──

  private diaLocal(fecha: Date): string {
    // en-CA formatea como YYYY-MM-DD.
    return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA }).format(fecha);
  }

  /** 0 = lunes … 6 = domingo. */
  private diaSemana(dia: string): number {
    return (new Date(`${dia}T12:00:00Z`).getUTCDay() + 6) % 7;
  }

  private sumarDias(dia: string, n: number): string {
    const d = new Date(`${dia}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  private racha(dias: Set<string>, hoy: string): number {
    let actual = dias.has(hoy) ? hoy : this.sumarDias(hoy, -1);
    let racha = 0;
    while (dias.has(actual)) {
      racha++;
      actual = this.sumarDias(actual, -1);
    }
    return racha;
  }
}
