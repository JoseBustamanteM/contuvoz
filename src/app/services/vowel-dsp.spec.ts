import {
  FS,
  Medidas,
  Vocal,
  VOCALES,
  F0_POCO_FIABLE,
  VECINAS,
  medirVoz,
  remuestrear,
  verificar,
} from './vowel-dsp';

/**
 * Pruebas del detector sin grabaciones: vocales sintéticas hechas como en la
 * voz real (fuente glotal con tono → resonancias del tracto vocal → radiación
 * por los labios), con tres tamaños de tracto vocal, varios tonos y ruido.
 *
 * Las frecuencias de la síntesis NO son las de referencia del detector: se
 * corren un poco (FORMANTES_SINTESIS) para no probar el detector contra sí
 * mismo. Cuando haya grabaciones reales, se suman como pruebas aparte.
 */

/** Formantes de adulto (Hz) usados para sintetizar, distintos de las referencias del detector. */
const FORMANTES_SINTESIS: Record<Vocal, [number, number, number, number]> = {
  I: [280, 2250, 2950, 3700],
  E: [440, 1850, 2600, 3500],
  A: [690, 1300, 2550, 3600],
  O: [470, 960, 2500, 3500],
  U: [310, 780, 2450, 3400],
};

/** Voces: tamaño del tracto vocal (los formantes suben en los más cortos) y tono. */
const VOCES = [
  { nombre: 'hombre', escala: 1.0, f0: 110 },
  { nombre: 'mujer', escala: 1.15, f0: 220 },
  { nombre: 'niño', escala: 1.28, f0: 300 },
  { nombre: 'niño agudo', escala: 1.35, f0: 380 },
];

/** Generador pseudoaleatorio con semilla, para que las pruebas den siempre lo mismo. */
function azar(semilla: number) {
  let s = semilla >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

interface Opciones {
  vocal: Vocal;
  escala: number;
  f0: number;
  /** Relación señal/ruido (dB). */
  snr?: number;
  /** Frecuencia de muestreo de la "grabación". */
  fs?: number;
  silencioInicialMs?: number;
  vozMs?: number;
  semilla?: number;
}

/** Una "grabación": silencio con ruido, la vocal, y silencio otra vez. */
function sintetizar(o: Opciones): Float32Array {
  const fs = o.fs ?? 48000;
  const rnd = azar(o.semilla ?? 1);
  const nSil = Math.round(((o.silencioInicialMs ?? 400) * fs) / 1000);
  const nVoz = Math.round(((o.vozMs ?? 700) * fs) / 1000);
  const nFin = Math.round(0.2 * fs);

  // Fuente: pulsos glotales con un poco de jitter y vibrato.
  const fuente = new Float64Array(nVoz);
  let fase = 0;
  for (let i = 0; i < nVoz; i++) {
    const f0 = o.f0 * (1 + 0.02 * Math.sin((2 * Math.PI * 5 * i) / fs));
    fase += f0 / fs;
    if (fase >= 1) {
      fase -= 1 + (rnd() - 0.5) * 0.01;
      fuente[i] = 1;
    }
  }
  // Pendiente espectral de la glotis (-12 dB/octava): dos polos reales.
  let y = filtroPolo(filtroPolo(fuente, 0.95), 0.95);

  // Tracto vocal: resonadores en cascada.
  const anchos = [70, 90, 140, 200];
  FORMANTES_SINTESIS[o.vocal].forEach((f, k) => {
    y = resonador(y, f * o.escala, anchos[k] * o.escala, fs);
  });

  // Radiación por los labios (+6 dB/octava).
  const voz = new Float64Array(nVoz);
  for (let i = 0; i < nVoz; i++) voz[i] = y[i] - (i > 0 ? y[i - 1] : 0);

  // Ataque y caída suaves, como una vocal real.
  const rampa = Math.round(0.04 * fs);
  for (let i = 0; i < rampa; i++) {
    voz[i] *= i / rampa;
    voz[nVoz - 1 - i] *= i / rampa;
  }

  let potencia = 0;
  for (const v of voz) potencia += v * v;
  potencia /= nVoz;
  const amp = 0.3 / Math.sqrt(potencia);
  const ruido = Math.sqrt(0.09 / 10 ** ((o.snr ?? 20) / 10));

  const total = new Float32Array(nSil + nVoz + nFin);
  for (let i = 0; i < total.length; i++) {
    // Ruido gaussiano (Box-Muller).
    const g = Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
    const v = i >= nSil && i < nSil + nVoz ? voz[i - nSil] * amp : 0;
    total[i] = v + ruido * g;
  }
  return total;
}

function filtroPolo(x: Float64Array, a: number): Float64Array {
  const y = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) y[i] = x[i] + (i > 0 ? a * y[i - 1] : 0);
  return y;
}

/** Resonador de dos polos (como en un sintetizador de formantes). */
function resonador(x: Float64Array, f: number, ancho: number, fs: number): Float64Array {
  const r = Math.exp((-Math.PI * ancho) / fs);
  const b1 = 2 * r * Math.cos((2 * Math.PI * f) / fs);
  const b2 = -r * r;
  const g = 1 - b1 - b2;
  const y = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) {
    y[i] = g * x[i] + (i > 0 ? b1 * y[i - 1] : 0) + (i > 1 ? b2 * y[i - 2] : 0);
  }
  return y;
}

/** Graba (sintetiza a 48 kHz), remuestrea y mide, como hace el servicio. */
function medir(o: Opciones): Medidas {
  const r = medirVoz(remuestrear(sintetizar(o), o.fs ?? 48000, FS));
  if (!r.ok) throw new Error(`sin medida: ${r.motivo} (${r.msVoz} ms)`);
  return r.medidas;
}

describe('vowel-dsp: medición', () => {
  it('mide el tono de la voz', () => {
    for (const voz of VOCES) {
      const m = medir({ vocal: 'A', escala: voz.escala, f0: voz.f0 });
      expect(Math.abs(m.f0 - voz.f0) / voz.f0).toBeLessThan(0.05);
    }
  });

  it('mide F1 y F2 de un hombre (F2 con menos de 12% de error, F1 con menos de 25%)', () => {
    // El F1 de I y U sale alto: el LPC se corre hacia el armónico más cercano.
    // Es un sesgo conocido; la verificación lo tolera (ver VECINAS).
    for (const vocal of VOCALES) {
      const m = medir({ vocal, escala: 1, f0: 110 });
      const [f1, f2] = FORMANTES_SINTESIS[vocal];
      expect(Math.abs(m.f1 - f1) / f1, `${vocal} F1=${m.f1.toFixed(0)}`).toBeLessThan(0.25);
      expect(Math.abs(m.f2 - f2) / f2, `${vocal} F2=${m.f2.toFixed(0)}`).toBeLessThan(0.12);
    }
  });

  it('el silencio con ruido no se toma por voz', () => {
    const fs = 48000;
    const rnd = azar(7);
    const ruido = Float32Array.from({ length: fs * 2 }, () => (rnd() - 0.5) * 0.02);
    const r = medirVoz(remuestrear(ruido, fs, FS));
    expect(r.ok).toBe(false);
  });

  it('una vocal demasiado corta pide repetir', () => {
    const r = medirVoz(remuestrear(sintetizar({ vocal: 'A', escala: 1, f0: 110, vozMs: 180 }), 48000, FS));
    expect(r).toMatchObject({ ok: false, motivo: 'muy-corta' });
  });

  it('el niño puede empezar a hablar apenas se abre el micrófono', () => {
    const m = medir({ vocal: 'E', escala: 1.28, f0: 300, silencioInicialMs: 30 });
    expect(verificar(m, 'E').veredicto).toBe('correcta');
  });

  it('funciona con grabaciones a 44,1 kHz', () => {
    const m = medir({ vocal: 'I', escala: 1, f0: 110, fs: 44100 });
    expect(verificar(m, 'I').veredicto).toBe('correcta');
  });
});

describe('vowel-dsp: verificación', () => {
  const casos = VOCES.flatMap((voz) =>
    [10, 20].flatMap((snr) => VOCALES.map((vocal) => ({ ...voz, vocal, snr }))),
  );

  it.each(casos)('$nombre dice la $vocal (ruido a $snr dB): nunca es "otra vocal"', (c) => {
    const m = medir({ vocal: c.vocal, escala: c.escala, f0: c.f0, snr: c.snr, semilla: c.f0 + c.snr });
    const v = verificar(m, c.vocal);
    expect(v.veredicto, JSON.stringify({ m, v: v.masCercana })).not.toBe('otra');
    // Con tono fiable y poco ruido debe aceptarla. Con tono muy agudo o mucho
    // ruido basta con no castigar: "dudosa" pide repetir y no cuenta.
    if (c.f0 <= F0_POCO_FIABLE && c.snr >= 20) expect(v.veredicto, JSON.stringify(m)).toBe('correcta');
  });

  it('con mucho ruido (10 dB) y tono fiable, acepta al menos 4 de cada 5', () => {
    const fiables = casos.filter((c) => c.snr === 10 && c.f0 <= F0_POCO_FIABLE);
    const aceptadas = fiables.filter((c) => {
      const m = medir({ vocal: c.vocal, escala: c.escala, f0: c.f0, snr: c.snr, semilla: c.f0 + c.snr });
      return verificar(m, c.vocal).veredicto === 'correcta';
    });
    expect(aceptadas.length / fiables.length).toBeGreaterThanOrEqual(0.8);
  });

  it.each(casos)('$nombre dice la $vocal (ruido a $snr dB): no se acepta como otra vocal lejana', (c) => {
    const m = medir({ vocal: c.vocal, escala: c.escala, f0: c.f0, snr: c.snr, semilla: c.f0 + c.snr });
    for (const pedida of LEJANAS[c.vocal]) {
      expect(verificar(m, pedida).veredicto, `pedida ${pedida}`).not.toBe('correcta');
    }
  });

  it('con tono fiable, decir una vocal lejana a la pedida es "otra vocal"', () => {
    for (const voz of VOCES.filter((v) => v.f0 <= F0_POCO_FIABLE)) {
      for (const vocal of VOCALES) {
        const m = medir({ vocal, escala: voz.escala, f0: voz.f0 });
        for (const pedida of LEJANAS[vocal]) {
          const v = verificar(m, pedida);
          expect(v.veredicto, `${voz.nombre}: dijo ${vocal}, pedida ${pedida}`).toBe('otra');
          // Puede confundirla con una vecina de lo que dijo, nunca con algo lejano.
          expect([vocal, ...VECINAS[vocal]]).toContain(v.masCercana);
        }
      }
    }
  });

  it('la confianza de una correcta alcanza el umbral de aprobación del servidor (30)', () => {
    for (const vocal of VOCALES) {
      const v = verificar(medir({ vocal, escala: 1.28, f0: 300 }), vocal);
      expect(v.confianza).toBeGreaterThanOrEqual(0.3);
    }
  });
});

/** Pares que el detector debe distinguir siempre. Las vecinas (VECINAS:
 *  O-U, E-I, A-O) pueden quedar en "dudosa" o aceptarse: es lo tolerante. */
const LEJANAS: Record<Vocal, Vocal[]> = {
  A: ['I', 'U', 'E'],
  E: ['U', 'O'],
  I: ['A', 'O', 'U'],
  O: ['I', 'E'],
  U: ['A', 'E', 'I'],
};
