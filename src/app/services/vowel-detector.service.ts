import { Injectable, signal } from '@angular/core';

export type Vowel = 'A' | 'E' | 'I' | 'O' | 'U';

export interface DetectionResult {
  target: Vowel;
  detected: Vowel | null;
  success: boolean;
  confidence: number; // 0..1
  voiced: boolean;    // hubo voz suficiente
  f1: number;
  f2: number;
}

@Injectable({ providedIn: 'root' })
export class VowelDetectorService {
  /** true mientras se captura audio */
  readonly isListening = signal(false);
  /** mensaje de error legible (p.ej. permiso denegado) */
  readonly error = signal<string | null>(null);
  readonly analyser = signal<AnalyserNode | null>(null); 

  /**
   * Centroides de formantes (Hz) de las vocales del español.
   * 👉 Estos valores son un punto de partida. Con niños (voz aguda) suben.
   *    Usa el console.log del final para calibrarlos con voces reales.
   */
  private readonly refs: Record<Vowel, { f1: number; f2: number }> = {
    A: { f1: 750, f2: 1350 },
    E: { f1: 480, f2: 2000 },
    I: { f1: 300, f2: 2600 },
    O: { f1: 500, f2: 900 },
    U: { f1: 350, f2: 850 },
  };

  /**
   * Escucha el micrófono `durationMs` y decide qué vocal se pronunció.
   * DEBE llamarse dentro de un click (permisos de audio del navegador).
   */
  async listen(target: Vowel, durationMs = 2000): Promise<DetectionResult> {
    this.error.set(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      this.error.set('No se pudo acceder al micrófono.');
      throw new Error('mic-denied');
    }

    this.isListening.set(true);

    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = 0;
    source.connect(analyser);
        this.analyser.set(analyser); 
    const binCount = analyser.frequencyBinCount;      // 2048
    const binHz = audioCtx.sampleRate / analyser.fftSize;

    const freqDb = new Float32Array(binCount);
    const timeData = new Uint8Array(analyser.fftSize);
    const accum = new Float64Array(binCount);         // espectro acumulado (solo voz)
    let voicedFrames = 0;

    await new Promise<void>((resolve) => {
      const tick = setInterval(() => {
        analyser.getByteTimeDomainData(timeData);
        let sum = 0;
        for (let i = 0; i < timeData.length; i++) {
          const v = (timeData[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / timeData.length);

        if (rms > 0.015) { // hay voz
          analyser.getFloatFrequencyData(freqDb);
          for (let i = 0; i < binCount; i++) {
            accum[i] += freqDb[i] > -140 ? Math.pow(10, freqDb[i] / 20) : 0;
          }
          voicedFrames++;
        }
      }, 30);

      setTimeout(() => { clearInterval(tick); resolve(); }, durationMs);
    });

    stream.getTracks().forEach((t) => t.stop());
    this.analyser.set(null);
    await audioCtx.close();
    this.isListening.set(false);

    // ¿Habló al menos ~0.4 s?
    const voiced = voicedFrames >= Math.floor(durationMs / 30 / 5);
    if (!voiced) {
      return { target, detected: null, success: false, confidence: 0, voiced: false, f1: 0, f2: 0 };
    }

    const env = this.smooth(accum, 6);               // envolvente (atenúa armónicos)
    const f1 = this.peakHz(env, binHz, 200, 900);
    const f2 = this.peakHz(env, binHz, 900, 2800);
    const { vowel, confidence } = this.classify(f1, f2);

    // 👇 Para calibrar refs con voces reales, mira la consola del navegador
    console.log(`[vocal] F1=${f1.toFixed(0)}Hz F2=${f2.toFixed(0)}Hz → ${vowel} (objetivo ${target})`);

    return { target, detected: vowel, success: vowel === target, confidence, voiced: true, f1, f2 };
  }

  /** Media móvil simple → envolvente espectral. */
  private smooth(data: ArrayLike<number>, radius: number): Float64Array {
    const out = new Float64Array(data.length);
    for (let i = 0; i < data.length; i++) {
      let s = 0, n = 0;
      for (let j = i - radius; j <= i + radius; j++) {
        if (j >= 0 && j < data.length) { s += data[j]; n++; }
      }
      out[i] = s / n;
    }
    return out;
  }

  /** Frecuencia (Hz) del pico máximo dentro de un rango. */
  private peakHz(env: Float64Array, binHz: number, minHz: number, maxHz: number): number {
    const start = Math.max(1, Math.floor(minHz / binHz));
    const end = Math.min(env.length - 1, Math.ceil(maxHz / binHz));
    let bestI = start, bestV = -Infinity;
    for (let i = start; i <= end; i++) {
      if (env[i] > bestV) { bestV = env[i]; bestI = i; }
    }
    return bestI * binHz;
  }

  /** Clasifica por cercanía en (F1,F2) en escala logarítmica (tolera voces agudas). */
  private classify(f1: number, f2: number): { vowel: Vowel; confidence: number } {
    let best: Vowel = 'A', bestD = Infinity, secondD = Infinity;
    for (const key of Object.keys(this.refs) as Vowel[]) {
      const r = this.refs[key];
      const d = Math.hypot(Math.log(f1 / r.f1), Math.log(f2 / r.f2));
      if (d < bestD) { secondD = bestD; bestD = d; best = key; }
      else if (d < secondD) { secondD = d; }
    }
    const margin = secondD === Infinity ? 1 : (secondD - bestD) / (secondD + bestD);
    const confidence = Math.max(0, Math.min(1, (1 - bestD) * 0.5 + margin * 0.5));
    return { vowel: best, confidence };
  }
}