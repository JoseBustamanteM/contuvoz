/**
 * recorder.worklet.js
 * ─────────────────────────────────────────────────────────────────────────────
 * AudioWorkletProcessor que acumula muestras PCM y las envía al hilo principal
 * cuando se alcanza la cantidad objetivo.
 *
 * UBICACIÓN: coloca este archivo en src/assets/worklets/recorder.worklet.js
 * Angular lo servirá como asset estático y podrás cargarlo con:
 *   audioContext.audioWorklet.addModule('/assets/worklets/recorder.worklet.js')
 * ─────────────────────────────────────────────────────────────────────────────
 */
class RecorderProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    // targetSamples se pasa desde el hilo principal al instanciar el nodo
    this._targetSamples = options?.processorOptions?.targetSamples ?? 48_000;
    this._chunks        = [];
    this._collected     = 0;
    this._done          = false;

    // El hilo principal puede cancelar la grabación enviando { type: 'stop' }
    this.port.onmessage = (evt) => {
      if (evt.data?.type === 'stop') this._done = true;
    };
  }

  /**
   * process() es llamado cada ~2.9 ms (128 muestras a 44.1 kHz).
   * Devuelve false para destruir el nodo una vez completada la grabación.
   */
  process(inputs) {
    if (this._done) return false;

    const input = inputs[0];
    if (!input || input.length === 0) return true;

    // Tomar canal 0 (mono)
    const channelData = input[0];
    const remaining   = this._targetSamples - this._collected;
    const toCopy      = Math.min(channelData.length, remaining);

    // Acumular en un buffer propio (slice para no retener la referencia)
    this._chunks.push(channelData.slice(0, toCopy));
    this._collected += toCopy;

    if (this._collected >= this._targetSamples) {
      // Unir todos los chunks en un único Float32Array
      const merged = new Float32Array(this._targetSamples);
      let offset = 0;
      for (const chunk of this._chunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }

      // Transferir al hilo principal usando el canal de transferencia
      // para copia cero (zero-copy transfer)
      this.port.postMessage({ type: 'done', pcm: merged }, [merged.buffer]);
      this._done = true;
      return false; // destruir el nodo
    }

    return true; // seguir procesando
  }
}

registerProcessor('recorder-processor', RecorderProcessor);
