import { Injectable, signal } from '@angular/core';
import {
  FS,
  Medidas,
  Vocal,
  VERSION_DETECTOR,
  Veredicto,
  medirVoz,
  remuestrear,
  verificar,
} from './vowel-dsp';

export type Vowel = Vocal;

/**
 * Resultado de un intento:
 * - 'correcta' / 'otra' / 'dudosa': ver verificar() en vowel-dsp.ts.
 * - 'sin-voz': no habló, o tan bajo que no se distingue del ruido.
 * - 'muy-corta': habló, pero menos de lo necesario para medir.
 */
export type ResultadoVoz = Veredicto | 'sin-voz' | 'muy-corta';

export interface DetectionResult {
  target: Vowel;
  resultado: ResultadoVoz;
  /** La vocal que más se parece a lo escuchado (null si no hubo medida). */
  detected: Vowel | null;
  /** 0..1: seguridad del resultado. */
  confidence: number;
  /** Medidas de la voz, para guardarlas (null si no hubo medida). */
  medidas: Medidas | null;
  versionDetector: number;
}

/** Cuánto se espera a que el niño empiece a hablar. */
export const ESPERA_MAXIMA_MS = 4000;
/** Una vez que habla, cuánto se escucha como máximo. */
export const VOZ_MAXIMA_MS = 2000;
/** Silencio después de hablar que da el intento por terminado... */
const SILENCIO_FINAL_MS = 400;
/** ...si ya habló al menos esto. */
const VOZ_PARA_TERMINAR_MS = 350;
/** Con una voz más breve que eso, se espera un poco más por si sigue. */
const SILENCIO_FINAL_LARGO_MS = 1000;
/** Primeros milisegundos: el ruido de la sala, antes de que hable. */
const RUIDO_INICIAL_MS = 150;
/** Habla si la energía supera al ruido en esto (dB). */
const DB_INICIO_VOZ = 10;
/** Calló si baja de esto sobre el ruido (dB). */
const DB_FIN_VOZ = 6;
/** Piso mínimo: algunos micrófonos entregan ceros puros al comienzo. */
const PISO_MINIMO_DB = -70;

@Injectable({ providedIn: 'root' })
export class VowelDetectorService {
  /** true mientras el micrófono está abierto. */
  readonly isListening = signal(false);
  /** true desde que el niño empieza a hablar. */
  readonly oyendoVoz = signal(false);
  /** 1 → 0: tiempo que queda (esperando que hable, o escuchándolo). */
  readonly progreso = signal(1);
  /** Mensaje de error legible (p.ej. permiso denegado). */
  readonly error = signal<string | null>(null);
  /** Para dibujar la onda mientras escucha. */
  readonly analyser = signal<AnalyserNode | null>(null);

  /**
   * Escucha al niño y verifica si dijo la vocal pedida.
   * DEBE llamarse dentro de un clic (permisos de audio del navegador).
   *
   * Capta el audio sin los filtros del navegador (cancelación de eco,
   * supresión de ruido, ganancia automática): deforman el espectro y pueden
   * tomar una vocal sostenida por ruido. Escucha hasta que el niño habla y
   * calla (o se acaba el tiempo) y recién ahí analiza todo junto.
   */
  async listen(target: Vowel): Promise<DetectionResult> {
    this.error.set(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
      });
    } catch (e) {
      this.error.set(this.mensajeErrorMicrofono(e));
      throw new Error('mic-error');
    }

    let audioCtx: AudioContext | null = null;
    let captura: AudioNode | null = null;
    let tope: ReturnType<typeof setTimeout> | null = null;

    try {
      audioCtx = new AudioContext();
      // Safari (iOS) crea el contexto suspendido aunque venga de un clic.
      if (audioCtx.state === 'suspended') await audioCtx.resume();

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      const bloques: Float32Array[] = [];
      let terminar!: () => void;
      const fin = new Promise<void>((resolve) => (terminar = resolve));
      const control = this.controlDeEscucha(audioCtx.sampleRate, () => terminar());
      captura = await this.crearCaptura(audioCtx, source, (bloque) => {
        bloques.push(bloque);
        control(bloque);
      });

      this.analyser.set(analyser);
      this.isListening.set(true);
      // Por si el micrófono no entrega audio: no quedarse esperando para siempre.
      tope = setTimeout(() => terminar(), ESPERA_MAXIMA_MS + VOZ_MAXIMA_MS + 1000);
      await fin;

      const sampleRate = audioCtx.sampleRate;
      const grabacion = unir(bloques);
      return this.analizar(target, remuestrear(grabacion, sampleRate, FS));
    } finally {
      // Pase lo que pase: sin esto, un fallo a mitad de camino dejaba el
      // micrófono abierto (con su luz encendida) hasta recargar la página.
      if (tope) clearTimeout(tope);
      captura?.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      this.analyser.set(null);
      if (audioCtx && audioCtx.state !== 'closed') {
        await audioCtx.close().catch(() => {
          /* ya cerrado */
        });
      }
      this.isListening.set(false);
      this.oyendoVoz.set(false);
      this.progreso.set(1);
    }
  }

  private analizar(target: Vowel, x: Float32Array): DetectionResult {
    const base = { target, versionDetector: VERSION_DETECTOR };
    const medicion = medirVoz(x);
    if (!medicion.ok) {
      // Sin F1/F2 estables hubo voz pero no se pudo medir: pedir repetir.
      const resultado: ResultadoVoz =
        medicion.motivo === 'sin-formantes' ? 'dudosa' : medicion.motivo;
      return { ...base, resultado, detected: null, confidence: 0, medidas: null };
    }
    const v = verificar(medicion.medidas, target);
    return {
      ...base,
      resultado: v.veredicto,
      detected: v.veredicto === 'correcta' ? target : v.masCercana,
      confidence: v.confianza,
      medidas: medicion.medidas,
    };
  }

  /**
   * Decide, bloque a bloque, cuándo dejar de escuchar: espera a que el niño
   * hable (hasta ESPERA_MAXIMA_MS) y corta cuando calla o se cumple
   * VOZ_MAXIMA_MS. Es un cálculo simple de energía; el análisis fino lo hace
   * medirVoz() con la grabación completa.
   */
  private controlDeEscucha(sampleRate: number, terminar: () => void) {
    let ms = 0;
    let piso = Infinity;
    let inicioVoz: number | null = null;
    let msVoz = 0;
    let silencio = 0;
    let terminado = false;

    return (bloque: Float32Array) => {
      if (terminado) return;
      const dur = (bloque.length / sampleRate) * 1000;
      ms += dur;
      const db = energiaDb(bloque);

      if (ms <= RUIDO_INICIAL_MS) {
        piso = Math.min(piso, Math.max(db, PISO_MINIMO_DB));
        this.progreso.set(1);
        return;
      }
      if (!Number.isFinite(piso)) piso = Math.max(db, PISO_MINIMO_DB);

      if (inicioVoz === null) {
        if (db > piso + DB_INICIO_VOZ) {
          inicioVoz = ms;
          this.oyendoVoz.set(true);
        } else {
          this.progreso.set(Math.max(0, 1 - ms / ESPERA_MAXIMA_MS));
          if (ms >= ESPERA_MAXIMA_MS) {
            terminado = true;
            terminar();
          }
          return;
        }
      }

      if (db > piso + DB_FIN_VOZ) {
        msVoz += dur;
        silencio = 0;
      } else {
        silencio += dur;
      }
      const transcurrido = ms - inicioVoz;
      this.progreso.set(Math.max(0, 1 - transcurrido / VOZ_MAXIMA_MS));
      if (
        transcurrido >= VOZ_MAXIMA_MS ||
        (silencio >= SILENCIO_FINAL_MS && msVoz >= VOZ_PARA_TERMINAR_MS) ||
        silencio >= SILENCIO_FINAL_LARGO_MS
      ) {
        terminado = true;
        terminar();
      }
    };
  }

  /**
   * Nodo que entrega las muestras crudas: AudioWorklet si el navegador lo
   * tiene, y ScriptProcessor (obsoleto, pero universal) si no. Devuelve una
   * promesa porque cargar el worklet es asíncrono.
   */
  private crearCaptura(
    ctx: AudioContext,
    source: MediaStreamAudioSourceNode,
    recibir: (b: Float32Array) => void,
  ): Promise<AudioNode> {
    // Salida en silencio: los nodos de captura solo procesan si llegan al destino.
    const mudo = ctx.createGain();
    mudo.gain.value = 0;
    mudo.connect(ctx.destination);

    const conScriptProcessor = (): AudioNode => {
      const nodo = ctx.createScriptProcessor(2048, 1, 1);
      nodo.onaudioprocess = (e) => recibir(new Float32Array(e.inputBuffer.getChannelData(0)));
      source.connect(nodo);
      nodo.connect(mudo);
      return nodo;
    };

    if (!ctx.audioWorklet) return Promise.resolve(conScriptProcessor());

    const url = new URL('audio/captura-pcm.worklet.js', document.baseURI).href;
    return ctx.audioWorklet.addModule(url).then(
      () => {
        const nodo = new AudioWorkletNode(ctx, 'captura-pcm', {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          channelCount: 1,
          channelCountMode: 'explicit',
        });
        nodo.port.onmessage = (e: MessageEvent<Float32Array>) => recibir(e.data);
        source.connect(nodo);
        nodo.connect(mudo);
        return nodo;
      },
      () => conScriptProcessor(),
    );
  }

  /** Explica en lenguaje simple por qué no se pudo abrir el micrófono. */
  private mensajeErrorMicrofono(e: unknown): string {
    if (!window.isSecureContext || !navigator.mediaDevices) {
      return 'Este navegador no deja usar el micrófono en esta página. Ábrela con https.';
    }
    switch ((e as DOMException)?.name) {
      case 'NotAllowedError':
      case 'SecurityError':
        return 'No tenemos permiso para usar el micrófono. Toca el candado 🔒 junto a la dirección de la página, permite el micrófono y vuelve a intentarlo.';
      case 'NotFoundError':
      case 'OverconstrainedError':
        return 'No encontramos ningún micrófono. Conecta uno y vuelve a intentarlo.';
      case 'NotReadableError':
      case 'AbortError':
        return 'El micrófono está ocupado por otra aplicación. Ciérrala y vuelve a intentarlo.';
      default:
        return 'No pudimos usar el micrófono. Recarga la página y vuelve a intentarlo.';
    }
  }
}

function energiaDb(b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < b.length; i++) s += b[i] * b[i];
  return 10 * Math.log10(s / b.length + 1e-12);
}

function unir(bloques: Float32Array[]): Float32Array {
  const total = bloques.reduce((n, b) => n + b.length, 0);
  const out = new Float32Array(total);
  let i = 0;
  for (const b of bloques) {
    out.set(b, i);
    i += b.length;
  }
  return out;
}
