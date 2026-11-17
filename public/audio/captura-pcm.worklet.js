// Procesador de audio de Hablemos: copia las muestras del micrófono, sin
// tocarlas, y las manda al hilo principal en bloques de ~43 ms (a 48 kHz).
// Lo carga VowelDetectorService con audioWorklet.addModule(). Va como archivo
// aparte (y no como blob) porque la política de contenido solo permite
// scripts del propio sitio.
class CapturaPcm extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bloque = new Float32Array(2048);
    this.lleno = 0;
  }

  process(entradas) {
    const canal = entradas[0] && entradas[0][0];
    if (canal) {
      for (let i = 0; i < canal.length; i++) {
        this.bloque[this.lleno++] = canal[i];
        if (this.lleno === this.bloque.length) {
          this.port.postMessage(this.bloque);
          this.bloque = new Float32Array(2048);
          this.lleno = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor('captura-pcm', CapturaPcm);
