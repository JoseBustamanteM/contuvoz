/**
 * Cálculo del detector de vocales de Hablemos, sin Angular ni Web Audio: recibe
 * muestras y devuelve medidas y veredicto. Así se puede probar con vocales
 * sintéticas (vowel-dsp.spec.ts) y ajustar sin abrir el micrófono.
 *
 * Pasos (ver MEJORAS.md, sección A):
 * 1. remuestrear(): todo se analiza a 16 kHz.
 * 2. medirVoz(): busca el tramo de voz estable más largo (energía sobre el
 *    ruido y periodicidad), mide el tono (f0) y los formantes F1-F3 con LPC
 *    (a 10 kHz: ver FS_LPC).
 * 3. verificar(): normaliza por hablante en escala Bark y decide si se dijo la
 *    vocal pedida: 'correcta', 'otra' o 'dudosa'.
 *
 * Los niños de ContuVoz son sordos: su habla no se parece a la de las tablas.
 * Por eso el criterio es tolerante: ante la duda, 'dudosa' (pedir repetir),
 * nunca un fallo.
 */

export type Vocal = 'A' | 'E' | 'I' | 'O' | 'U';
export const VOCALES: readonly Vocal[] = ['A', 'E', 'I', 'O', 'U'];

/** Sube cuando cambie el cálculo, para distinguir los datos guardados. */
export const VERSION_DETECTOR = 2;

/** Frecuencia de análisis. */
export const FS = 16000;

// ── Parámetros ─────────────────────────────────────────────

const TRAMO_MS = 30;
const SALTO_MS = 10;
const TRAMO = (FS * TRAMO_MS) / 1000; // 480 muestras
const SALTO = (FS * SALTO_MS) / 1000; // 160 muestras

/** Los primeros ~150 ms, antes de que el niño alcance a hablar, dan el ruido de sala. */
const TRAMOS_RUIDO = 15;
/** Un tramo es voz si supera el ruido en esto (dB)... */
const DB_SOBRE_RUIDO = 10;
/** ...y es periódico: pico de autocorrelación normalizada sobre esto. */
const PERIODICIDAD_MINIMA = 0.5;
const F0_MIN = 80;
const F0_MAX = 500;
/** Voz mínima para medir (tramo continuo, antes de recortar los extremos). */
export const VOZ_MINIMA_MS = 250;
/** Se descarta el ataque y el final de la vocal, que no son estables. */
const RECORTE_TRAMOS = 5; // 50 ms por lado

/**
 * Los formantes se buscan a 10 kHz, no a 16: así los polos del LPC se reparten
 * entre 0 y 5 kHz, donde están F1-F3 de adultos y niños. Con las vocales
 * sintéticas de las pruebas fue la combinación más estable, sobre todo en O y
 * U (F1 y F2 juntos) y con ruido: a 16 kHz, con orden 12-16, a menudo no
 * aparecía el F2 de la U.
 */
const FS_LPC = 10000;
const ORDEN_LPC = 12;
const TRAMO_LPC = (FS_LPC * TRAMO_MS) / 1000; // 300 muestras
const SALTO_LPC = (FS_LPC * SALTO_MS) / 1000; // 100 muestras
const PREENFASIS = 0.97;
const ANCHO_BANDA_MAX = 400;
const FORMANTE_MIN = 200;

/** Con un tono más agudo que esto los armónicos quedan tan separados que el
 *  F1 no se puede medir bien. */
export const F0_POCO_FIABLE = 350;

// ── Remuestreo ─────────────────────────────────────────────

/** Remuestrea a `destino` Hz con un filtro paso bajo (sinc con ventana) para
 *  no meter alias, e interpolación lineal. El filtro se calcula solo en las
 *  muestras que la interpolación usa, no en toda la grabación: a 48 kHz es
 *  unas 3 veces menos trabajo, que se nota en un celular. */
export function remuestrear(x: Float32Array, origen: number, destino = FS): Float32Array {
  if (origen === destino) return x;

  let filtrada = (j: number) => x[j];
  if (origen > destino) {
    const corte = (0.45 * destino) / origen; // fracción de la frecuencia de origen
    const mitad = 32;
    const h = new Float32Array(2 * mitad + 1);
    let suma = 0;
    for (let n = -mitad; n <= mitad; n++) {
      const sinc = n === 0 ? 2 * corte : Math.sin(2 * Math.PI * corte * n) / (Math.PI * n);
      const ventana = 0.54 + 0.46 * Math.cos((Math.PI * n) / mitad);
      h[n + mitad] = sinc * ventana;
      suma += h[n + mitad];
    }
    for (let i = 0; i < h.length; i++) h[i] /= suma;
    filtrada = (j: number) => {
      const desde = Math.max(0, j - mitad);
      const hasta = Math.min(x.length - 1, j + mitad);
      let acc = 0;
      for (let k = desde; k <= hasta; k++) acc += h[k - j + mitad] * x[k];
      return acc;
    };
  }

  const largo = Math.floor((x.length * destino) / origen);
  const out = new Float32Array(largo);
  const paso = origen / destino;
  for (let i = 0; i < largo; i++) {
    const t = i * paso;
    const j = Math.floor(t);
    const f = t - j;
    out[i] = j + 1 < x.length && f > 0 ? filtrada(j) * (1 - f) + filtrada(j + 1) * f : filtrada(j);
  }
  return out;
}

// ── Medición ───────────────────────────────────────────────

export interface Medidas {
  f0: number;
  f1: number;
  f2: number;
  /** 0 si no se pudo medir: no se usa para decidir, solo se guarda. */
  f3: number;
  /** Energía de la voz sobre el ruido de sala (dB). */
  snrDb: number;
  /** Duración del tramo de voz usado (ms). */
  msVoz: number;
}

export type MotivoSinMedida = 'sin-voz' | 'muy-corta' | 'sin-formantes';

export type ResultadoMedicion =
  | { ok: true; medidas: Medidas }
  | { ok: false; motivo: MotivoSinMedida; msVoz: number };

interface Tramo {
  db: number;
  periodicidad: number;
  f0: number;
}

/** Analiza una grabación a 16 kHz y mide la vocal del tramo de voz estable más largo. */
export function medirVoz(x: Float32Array): ResultadoMedicion {
  const tramos: Tramo[] = [];
  for (let ini = 0; ini + TRAMO <= x.length; ini += SALTO) {
    tramos.push(analizarTramo(x.subarray(ini, ini + TRAMO)));
  }
  if (tramos.length < TRAMOS_RUIDO + 5) return { ok: false, motivo: 'sin-voz', msVoz: 0 };

  // Piso de ruido: el promedio del comienzo, o el percentil 10 si el niño
  // empezó a hablar enseguida y el comienzo no es silencio.
  const inicio = tramos.slice(0, TRAMOS_RUIDO).map((t) => t.db);
  const ordenados = tramos.map((t) => t.db).sort((a, b) => a - b);
  const piso = Math.min(mediana(inicio), ordenados[Math.floor(ordenados.length * 0.1)]);

  const esVoz = tramos.map(
    (t) => t.db > piso + DB_SOBRE_RUIDO && t.periodicidad > PERIODICIDAD_MINIMA,
  );

  // Tramo continuo de voz más largo (se tolera un tramo suelto sin voz).
  let mejorIni = -1;
  let mejorLargo = 0;
  for (let i = 0; i < esVoz.length; ) {
    if (!esVoz[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < esVoz.length && (esVoz[j + 1] || (j + 2 < esVoz.length && esVoz[j + 2]))) j++;
    if (j - i + 1 > mejorLargo) {
      mejorLargo = j - i + 1;
      mejorIni = i;
    }
    i = j + 1;
  }

  const msVoz = mejorLargo > 0 ? (mejorLargo - 1) * SALTO_MS + TRAMO_MS : 0;
  if (mejorLargo === 0) return { ok: false, motivo: 'sin-voz', msVoz: 0 };
  if (msVoz < VOZ_MINIMA_MS) return { ok: false, motivo: 'muy-corta', msVoz };

  const x10 = remuestrear(x, FS, FS_LPC);
  const desde = mejorIni + RECORTE_TRAMOS;
  const hasta = mejorIni + mejorLargo - RECORTE_TRAMOS; // exclusivo
  const f0s: number[] = [];
  const dbs: number[] = [];
  const porTramo: number[][] = [];
  for (let i = desde; i < hasta; i++) {
    if (!esVoz[i]) continue;
    f0s.push(tramos[i].f0);
    dbs.push(tramos[i].db);
    porTramo.push(formantesLPC(x10.subarray(i * SALTO_LPC, i * SALTO_LPC + TRAMO_LPC)));
  }

  const [f1, f2, f3] = formantesEstables(porTramo);
  if (!f1 || !f2) return { ok: false, motivo: 'sin-formantes', msVoz };

  return {
    ok: true,
    medidas: { f0: mediana(f0s), f1, f2, f3: f3 ?? 0, snrDb: mediana(dbs) - piso, msVoz },
  };
}

/** Un formante debe aparecer en al menos esta fracción de los tramos. */
const PRESENCIA_MINIMA = 0.35;
/** Candidatos más cercanos que esto (Bark) son el mismo formante. */
const SEPARACION_GRUPO = 0.6;

/**
 * F1, F2 y F3 a partir de los candidatos de todos los tramos.
 *
 * No basta con la mediana del 1.º, 2.º y 3.º de cada tramo: con ruido, un
 * formante débil (el F2 de la U, por ejemplo) falta en la mitad de los tramos
 * y en esos el "2.º" es en realidad el F3. Aquí se agrupan todos los
 * candidatos por cercanía (en Bark) y se quedan los grupos que aparecen en
 * una buena parte de los tramos; los formantes son los tres más bajos.
 */
export function formantesEstables(porTramo: number[][]): number[] {
  const conTramo = porTramo
    .flatMap((lista, tramo) => lista.map((f) => ({ f, b: bark(f), tramo })))
    .sort((p, q) => p.b - q.b);
  if (conTramo.length === 0 || porTramo.length < 3) return [];

  const grupos: (typeof conTramo)[] = [];
  for (const c of conTramo) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && c.b - ultimo[ultimo.length - 1].b < SEPARACION_GRUPO) ultimo.push(c);
    else grupos.push([c]);
  }

  return grupos
    .filter((g) => new Set(g.map((c) => c.tramo)).size >= PRESENCIA_MINIMA * porTramo.length)
    .map((g) => mediana(g.map((c) => c.f)))
    .slice(0, 3);
}

/** Energía (dB), periodicidad y tono de un tramo. */
function analizarTramo(t: Float32Array): Tramo {
  let media = 0;
  for (let i = 0; i < t.length; i++) media += t[i];
  media /= t.length;
  const y = new Float64Array(t.length);
  let energia = 0;
  for (let i = 0; i < t.length; i++) {
    y[i] = t[i] - media;
    energia += y[i] * y[i];
  }
  const db = 10 * Math.log10(energia / t.length + 1e-12);

  // Autocorrelación normalizada entre los retardos de 500 Hz y 80 Hz.
  const minLag = Math.floor(FS / F0_MAX);
  const maxLag = Math.min(Math.ceil(FS / F0_MIN), t.length - 1);
  const r = new Float64Array(maxLag + 2);
  for (let lag = minLag - 1; lag <= maxLag + 1 && lag < t.length; lag++) {
    let s = 0;
    let e1 = 0;
    let e2 = 0;
    for (let i = 0; i + lag < t.length; i++) {
      s += y[i] * y[i + lag];
      e1 += y[i] * y[i];
      e2 += y[i + lag] * y[i + lag];
    }
    r[lag] = s / (Math.sqrt(e1 * e2) + 1e-12);
  }
  let mejor = minLag;
  for (let lag = minLag; lag <= maxLag; lag++) if (r[lag] > r[mejor]) mejor = lag;

  // El primer pico cercano al máximo evita elegir el doble del período.
  for (let lag = minLag; lag < mejor; lag++) {
    if (r[lag] > 0.9 * r[mejor] && r[lag] >= r[lag - 1] && r[lag] >= r[lag + 1]) {
      mejor = lag;
      break;
    }
  }

  // Interpolación parabólica para afinar el período.
  let periodo = mejor;
  const a = r[mejor - 1];
  const b = r[mejor];
  const c = r[mejor + 1];
  const den = a - 2 * b + c;
  if (den < 0) periodo = mejor + (0.5 * (a - c)) / den;

  return { db, periodicidad: r[mejor], f0: FS / periodo };
}

/** F1, F2, F3... (Hz) de un tramo, por LPC: raíces del polinomio predictor. */
export function formantesLPC(t: Float32Array, orden = ORDEN_LPC, fs = FS_LPC): number[] {
  const n = t.length;
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const enfatizada = t[i] - (i > 0 ? PREENFASIS * t[i - 1] : 0);
    y[i] = enfatizada * (0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (n - 1)));
  }

  const r = new Float64Array(orden + 1);
  for (let lag = 0; lag <= orden; lag++) {
    let s = 0;
    for (let i = 0; i + lag < n; i++) s += y[i] * y[i + lag];
    r[lag] = s;
  }
  if (r[0] <= 0) return [];
  r[0] *= 1 + 1e-9; // estabilidad numérica

  const a = levinson(r, orden);
  if (!a) return [];

  const formantes: number[] = [];
  for (const [re, im] of raices(a)) {
    if (im <= 0) continue;
    const frec = (Math.atan2(im, re) * fs) / (2 * Math.PI);
    const anchoBanda = (-fs / Math.PI) * Math.log(Math.hypot(re, im));
    if (frec > FORMANTE_MIN && frec < fs / 2 - 100 && anchoBanda < ANCHO_BANDA_MAX) formantes.push(frec);
  }
  return formantes.sort((p, q) => p - q);
}

/** Levinson-Durbin: coeficientes [1, a1..ap] del predictor. */
function levinson(r: Float64Array, p: number): Float64Array | null {
  const a = new Float64Array(p + 1);
  a[0] = 1;
  let error = r[0];
  for (let i = 1; i <= p; i++) {
    let acc = r[i];
    for (let j = 1; j < i; j++) acc += a[j] * r[i - j];
    const k = -acc / error;
    const previo = a.slice();
    for (let j = 1; j < i; j++) a[j] = previo[j] + k * previo[i - j];
    a[i] = k;
    error *= 1 - k * k;
    if (error <= 0) return null;
  }
  return a;
}

/** Raíces de z^p + a1 z^(p-1) + ... + ap por Durand-Kerner. */
function raices(a: Float64Array): [number, number][] {
  const p = a.length - 1;
  const re = new Float64Array(p);
  const im = new Float64Array(p);
  for (let i = 0; i < p; i++) {
    // Puntos de partida en espiral, el estándar del método.
    const ang = (2 * Math.PI * i) / p + 0.4;
    re[i] = 0.9 * Math.cos(ang);
    im[i] = 0.9 * Math.sin(ang);
  }
  for (let iter = 0; iter < 500; iter++) {
    let cambio = 0;
    for (let i = 0; i < p; i++) {
      // Valor del polinomio en z_i (Horner).
      let pr = 1;
      let pi = 0;
      for (let k = 1; k <= p; k++) {
        const nr = pr * re[i] - pi * im[i] + a[k];
        pi = pr * im[i] + pi * re[i];
        pr = nr;
      }
      // Producto de (z_i - z_j).
      let qr = 1;
      let qi = 0;
      for (let j = 0; j < p; j++) {
        if (j === i) continue;
        const dr = re[i] - re[j];
        const di = im[i] - im[j];
        const nr = qr * dr - qi * di;
        qi = qr * di + qi * dr;
        qr = nr;
      }
      const den = qr * qr + qi * qi || 1e-30;
      const cr = (pr * qr + pi * qi) / den;
      const ci = (pi * qr - pr * qi) / den;
      re[i] -= cr;
      im[i] -= ci;
      cambio = Math.max(cambio, Math.hypot(cr, ci));
    }
    if (cambio < 1e-10) break;
  }
  return Array.from({ length: p }, (_, i) => [re[i], im[i]] as [number, number]);
}

// ── Verificación ───────────────────────────────────────────

/** Escala Bark (Traunmüller). */
export const bark = (f: number) => (26.81 * f) / (1960 + f) - 0.53;

/** Coordenadas normalizadas por hablante (Syrdal y Gopal): en este espacio las
 *  voces de hombres, mujeres y niños casi coinciden. */
export function coordenadas(m: Pick<Medidas, 'f0' | 'f1' | 'f2'>) {
  return {
    altura: bark(m.f1) - bark(m.f0),
    anterioridad: bark(m.f2) - bark(m.f1),
  };
}

/**
 * Valores de referencia de adulto (Hz) del español, aproximados a los de
 * Quilis y Esgueva (1983), con un f0 típico de 125 Hz. NO se contrastaron con
 * la tabla original: son un punto de partida, y con niños sordos solo eso.
 * Las medidas que se guardan de cada intento sirven para ajustarlos.
 */
const REFERENCIAS: Record<Vocal, { f0: number; f1: number; f2: number }> = {
  I: { f0: 125, f1: 264, f2: 2317 },
  E: { f0: 125, f1: 458, f2: 1925 },
  A: { f0: 125, f1: 653, f2: 1236 },
  O: { f0: 125, f1: 488, f2: 1018 },
  U: { f0: 125, f1: 293, f2: 820 },
};

export const PROTOTIPOS: Record<Vocal, { altura: number; anterioridad: number }> = Object.fromEntries(
  VOCALES.map((v) => [v, coordenadas(REFERENCIAS[v])]),
) as Record<Vocal, { altura: number; anterioridad: number }>;

/** La anterioridad recorre un rango mucho mayor (de U a I, ~7 Bark) que la
 *  altura (~3,5 Bark): se pesa menos para que ambas cuenten parecido. */
const PESO_ANTERIORIDAD = 0.5;
/** Si la pedida está a esta distancia (Bark) de la más cercana, se acepta como empate a favor del niño. */
const MARGEN_EMPATE = 0.35;
/** Para decir "dijiste otra vocal", la otra debe ganar por al menos esto. */
const MARGEN_CLARO = 0.8;
/** Entre vocales vecinas se exige más: se confunden por error de medida
 *  (el F1 de I y U tiende a salir alto, hacia el armónico más cercano). */
const MARGEN_CLARO_VECINAS = 1.5;

/** Pares de vocales vecinas en el espacio de medida. */
export const VECINAS: Record<Vocal, Vocal[]> = {
  A: ['O'],
  E: ['I'],
  I: ['E'],
  O: ['A', 'U'],
  U: ['O'],
};
/** Más lejos que esto de todas las vocales: la medida no se parece a ninguna. */
const DISTANCIA_MAXIMA = 2.2;
/** Con tono muy agudo la medida es menos fiable: para aceptar, la pedida debe
 *  estar más cerca. Evita aceptar una I como U cuando el F2 se midió mal. */
const DISTANCIA_MAXIMA_POCO_FIABLE = 1.8;

export type Veredicto = 'correcta' | 'otra' | 'dudosa';

export interface Verificacion {
  veredicto: Veredicto;
  /** La vocal más cercana a lo que se escuchó. */
  masCercana: Vocal;
  /** 0..1: seguridad del veredicto. */
  confianza: number;
  distancias: Record<Vocal, number>;
}

export function distancia(c: { altura: number; anterioridad: number }, v: Vocal): number {
  const p = PROTOTIPOS[v];
  return Math.hypot(c.altura - p.altura, PESO_ANTERIORIDAD * (c.anterioridad - p.anterioridad));
}

/** ¿Se dijo la vocal pedida? */
export function verificar(m: Medidas, pedida: Vocal): Verificacion {
  const c = coordenadas(m);
  const distancias = Object.fromEntries(VOCALES.map((v) => [v, distancia(c, v)])) as Record<Vocal, number>;
  const orden = [...VOCALES].sort((p, q) => distancias[p] - distancias[q]);
  const masCercana = orden[0];
  const dPedida = distancias[pedida];
  const dMejor = distancias[masCercana];
  const dOtra = distancias[orden[0] === pedida ? orden[1] : orden[0]];
  const pocoFiable = m.f0 > F0_POCO_FIABLE;

  const resultado = (veredicto: Veredicto, confianza: number): Verificacion => ({
    veredicto,
    masCercana,
    confianza: Math.max(0, Math.min(1, confianza)),
    distancias,
  });

  // Se escucha algo que no se parece a ninguna vocal: pedir repetir.
  if (dMejor > DISTANCIA_MAXIMA) return resultado('dudosa', 0.3 * (1 - dMejor / (2 * DISTANCIA_MAXIMA)));

  // Correcta si la pedida es la más cercana, o casi empata con ella.
  const alcance = pocoFiable ? DISTANCIA_MAXIMA_POCO_FIABLE : DISTANCIA_MAXIMA;
  if (dPedida - dMejor <= MARGEN_EMPATE && dPedida <= alcance) {
    // Seguridad: cuánto más cerca está de la pedida que de la siguiente.
    const ventaja = (dOtra - dPedida) / (dOtra + dPedida + 1e-9);
    return resultado('correcta', 0.55 + 0.45 * Math.max(0, ventaja) - (pocoFiable ? 0.1 : 0));
  }

  // Otra vocal gana con claridad, y la medida es fiable.
  const margen = VECINAS[pedida].includes(masCercana) ? MARGEN_CLARO_VECINAS : MARGEN_CLARO;
  if (dPedida - dMejor >= margen && !pocoFiable) {
    const ventaja = (dPedida - dMejor) / (dPedida + dMejor + 1e-9);
    return resultado('otra', 0.5 + 0.5 * ventaja);
  }

  return resultado('dudosa', 0.4 * (1 - (dPedida - dMejor) / (margen * 2)));
}

// ── Utilidades ─────────────────────────────────────────────

function mediana(v: number[]): number {
  if (v.length === 0) return 0;
  const o = [...v].sort((a, b) => a - b);
  const m = o.length >> 1;
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}
