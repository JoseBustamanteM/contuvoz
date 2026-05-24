import { Injectable, signal } from '@angular/core';

export type ModelStatus = 'idle' | 'loading' | 'ready' | 'error';

@Injectable({ providedIn: 'root' })
export class WavlmService {
  readonly modelStatus     = signal<ModelStatus>('idle');
  readonly loadingProgress = signal<number>(0);

  private model: any     = null;
  private processor: any = null;
  private readonly MODEL_ID    = 'Xenova/wavlm-base-plus-sv';
  private readonly SAMPLE_RATE = 16_000;

  // ── Carga del modelo ──────────────────────────────────────────────────────
  async loadModel(): Promise<void> {
    if (this.modelStatus() === 'ready' || this.modelStatus() === 'loading') return;

    this.modelStatus.set('loading');
    this.loadingProgress.set(0);

    try {
      const { AutoProcessor, AutoModel, env } =
        await import('@huggingface/transformers');

      env.useBrowserCache  = true;
      env.allowLocalModels = false;

      const progressCb = (p: any) => {
        if (p.status === 'progress' && p.progress != null) {
          this.loadingProgress.set(Math.round(p.progress));
        }
      };

      this.processor = await AutoProcessor.from_pretrained(this.MODEL_ID, {
        progress_callback: progressCb,
      } as any);

      this.model = await AutoModel.from_pretrained(this.MODEL_ID, {
        progress_callback: progressCb,
      } as any);

      this.modelStatus.set('ready');
      this.loadingProgress.set(100);
    } catch (err) {
      console.error('[WavlmService] Error al cargar el modelo:', err);
      this.modelStatus.set('error');
    }
  }

  // ── Extracción de embeddings ──────────────────────────────────────────────
  async extractEmbedding(audioData: Float32Array): Promise<Float32Array> {
    if (!this.model || !this.processor || this.modelStatus() !== 'ready') {
      throw new Error('El modelo no está listo.');
    }

    const inputs = await this.processor(audioData, {
      sampling_rate: this.SAMPLE_RATE,
    });

    const output = await this.model(inputs);

    // El modelo wavlm-base-plus-sv devuelve:
    //   output.embeddings → shape [1, 512]  ← vector final listo para comparar
    //   output.logits     → shape [1, 512]  ← NO usar, es para clasificación
    const tensor: any =
      output.embeddings        ??   // ✅ clave correcta confirmada por los logs
      output.last_hidden_state ??   // fallback para otros modelos WavLM
      output.logits;                // último recurso

    if (!tensor?.dims) {
      throw new Error(
        `Tensor no encontrado. Claves: [${Object.keys(output).join(', ')}]`
      );
    }

    const dims    = tensor.dims as number[];
    const rawData = tensor.data as Float32Array;

    // Shape [1, 512] → extraer el vector de la primera (y única) fila
    if (dims.length === 2) {
      return this.normalizeL2(rawData.slice(0, dims[1]));
    }

    // Shape [1, seq_len, hidden] → mean pool sobre seq_len
    if (dims.length === 3) {
      const [, seqLen, hiddenSize] = dims;
      const pooled = new Float32Array(hiddenSize);
      for (let t = 0; t < seqLen; t++) {
        for (let h = 0; h < hiddenSize; h++) {
          pooled[h] += rawData[t * hiddenSize + h];
        }
      }
      for (let h = 0; h < hiddenSize; h++) pooled[h] /= seqLen;
      return this.normalizeL2(pooled);
    }

    return this.normalizeL2(rawData);
  }

  // ── Similitud de Coseno ───────────────────────────────────────────────────
  cosineSimilarity(vecA: Float32Array, vecB: Float32Array): number {
    const len = Math.min(vecA.length, vecB.length);
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < len; i++) {
      dot   += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }

  // ── Remuestreo a 16 kHz ───────────────────────────────────────────────────
  async resampleTo16kHz(buffer: AudioBuffer): Promise<Float32Array> {
    const targetLength = Math.round(buffer.duration * this.SAMPLE_RATE);
    const offlineCtx   = new OfflineAudioContext(1, targetLength, this.SAMPLE_RATE);
    const source       = offlineCtx.createBufferSource();
    source.buffer      = buffer;
    source.connect(offlineCtx.destination);
    source.start(0);
    const rendered = await offlineCtx.startRendering();
    return rendered.getChannelData(0);
  }

  private normalizeL2(arr: Float32Array): Float32Array {
    let norm = 0;
    for (let i = 0; i < arr.length; i++) norm += arr[i] * arr[i];
    norm = Math.sqrt(norm);
    if (norm === 0) return arr;
    const out = new Float32Array(arr.length);
    for (let i = 0; i < arr.length; i++) out[i] = arr[i] / norm;
    return out;
  }

  get sampleRate(): number { return this.SAMPLE_RATE; }
}
