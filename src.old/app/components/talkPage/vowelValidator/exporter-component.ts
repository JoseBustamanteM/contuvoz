import {
  Component, OnInit, signal, inject, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { WavlmService } from '../../../services/wavlm.service';

/**
 * EmbeddingExporterComponent
 * ─────────────────────────────────────────────────────────────────────────────
 * Componente TEMPORAL de desarrollo. Permite grabar audios de referencia
 * directamente en el navegador y exportar los embeddings como TypeScript,
 * garantizando que usen el mismo modelo ONNX que el validador de vocales.
 *
 * USO:
 *   1. Añade <app-embedding-exporter> temporalmente en tu app
 *   2. Graba 3-5 veces cada vocal
 *   3. Pulsa "Exportar .ts" → copia el contenido en reference-embeddings.ts
 *   4. Elimina este componente de producción
 * ─────────────────────────────────────────────────────────────────────────────
 */

type Vowel = 'A' | 'E' | 'I' | 'O' | 'U';
const VOWELS: Vowel[] = ['A', 'E', 'I', 'O', 'U'];
const SAMPLE_RATE = 16_000;
const RECORD_MS   = 1500;

@Component({
  selector: 'app-embedding-exporter',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="exporter">
      <h2>🔬 Generador de Embeddings de Referencia</h2>
      <p class="subtitle">
        Graba cada vocal 3–5 veces. El sistema promediará los embeddings
        usando el mismo modelo ONNX que el validador.
      </p>

      @if (wavlm.modelStatus() !== 'ready') {
        <button class="btn-load" (click)="wavlm.loadModel()">
          Cargar modelo ({{ wavlm.loadingProgress() }}%)
        </button>
      }

      <!-- Selector de vocal activa -->
      <div class="vowel-tabs">
        @for (v of vowels; track v) {
          <button
            class="tab"
            [class.active]="activeVowel() === v"
            (click)="activeVowel.set(v)"
          >
            {{ v }}
            <span class="count">{{ embeddings[v].length }}</span>
          </button>
        }
      </div>

      <!-- Controles de grabación -->
      <div class="record-area">
        <button
          class="btn-record"
          [disabled]="wavlm.modelStatus() !== 'ready' || recording()"
          (click)="record()"
        >
          {{ recording() ? '⏺ Grabando ' + activeVowel() + '…' : '🎤 Grabar vocal ' + activeVowel() }}
        </button>

        @if (lastScore() !== null) {
          <div class="last-score">
            Último embedding: {{ embeddings[activeVowel()].length }} muestras acumuladas
          </div>
        }
      </div>

      <!-- Estado por vocal -->
      <table class="status-table">
        <tr>
          <th>Vocal</th>
          <th>Muestras</th>
          <th>Estado</th>
          <th>Acción</th>
        </tr>
        @for (v of vowels; track v) {
          <tr [class.ready-row]="embeddings[v].length >= 3">
            <td><strong>{{ v }}</strong></td>
            <td>{{ embeddings[v].length }}</td>
            <td>
              @if (embeddings[v].length === 0) { <span class="s-empty">Sin datos</span> }
              @else if (embeddings[v].length < 3) { <span class="s-few">Pocas muestras</span> }
              @else { <span class="s-ok">✅ Lista</span> }
            </td>
            <td>
              <button class="btn-clear" (click)="clear(v)">Borrar</button>
            </td>
          </tr>
        }
      </table>

      <!-- Log de actividad -->
      <div class="log">
        @for (entry of log(); track $index) {
          <div class="log-entry">{{ entry }}</div>
        }
      </div>

      <!-- Exportar -->
      <div class="export-area">
        <button
          class="btn-export"
          [disabled]="!canExport()"
          (click)="exportTs()"
        >
          📄 Exportar reference-embeddings.ts
        </button>
        @if (!canExport()) {
          <p class="export-hint">Necesitas al menos 1 muestra por vocal para exportar.</p>
        }
      </div>

      <!-- Output del archivo TS -->
      @if (tsOutput()) {
        <div class="ts-output-area">
          <div class="ts-header">
            <span>reference-embeddings.ts — copia este contenido</span>
            <button (click)="copyToClipboard()">📋 Copiar</button>
          </div>
          <textarea class="ts-output" readonly [value]="tsOutput()"></textarea>
        </div>
      }
    </div>
  `,
  styles: [`
    .exporter {
      max-width: 700px;
      margin: 20px auto;
      padding: 24px;
      font-family: 'Nunito', sans-serif;
      background: #1a1a2e;
      color: #e0e0f0;
      border-radius: 16px;
    }
    h2 { margin: 0 0 4px; color: #7EC8E3; }
    .subtitle { color: #888; font-size: 0.9rem; margin-bottom: 20px; }

    .btn-load {
      background: #3B82F6; color: white; border: none;
      padding: 10px 24px; border-radius: 8px; cursor: pointer;
      font-size: 1rem; margin-bottom: 16px;
    }

    .vowel-tabs {
      display: flex; gap: 8px; margin-bottom: 16px;
    }
    .tab {
      flex: 1; padding: 10px; border: 2px solid #333;
      background: #16213e; color: #aaa; border-radius: 8px;
      cursor: pointer; font-size: 1.1rem; font-weight: 700;
      display: flex; flex-direction: column; align-items: center; gap: 2px;
    }
    .tab.active { border-color: #7EC8E3; color: #7EC8E3; background: #0f3460; }
    .count { font-size: 0.75rem; background: #333; border-radius: 99px; padding: 1px 7px; }

    .record-area { margin-bottom: 20px; }
    .btn-record {
      width: 100%; padding: 14px; font-size: 1.1rem; font-weight: 700;
      background: #e74c3c; color: white; border: none; border-radius: 10px;
      cursor: pointer; margin-bottom: 8px;
    }
    .btn-record:disabled { opacity: 0.5; cursor: not-allowed; }
    .last-score { font-size: 0.85rem; color: #7EC8E3; }

    .status-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    .status-table th, .status-table td {
      padding: 8px 12px; border-bottom: 1px solid #333; text-align: left;
    }
    .status-table th { color: #888; font-size: 0.8rem; text-transform: uppercase; }
    .ready-row { background: rgba(34,197,94,0.05); }
    .s-empty { color: #666; }
    .s-few   { color: #F59E0B; }
    .s-ok    { color: #22C55E; }
    .btn-clear {
      background: none; border: 1px solid #444; color: #888;
      padding: 3px 10px; border-radius: 6px; cursor: pointer; font-size: 0.8rem;
    }

    .log {
      background: #0d0d1a; border-radius: 8px; padding: 10px;
      max-height: 120px; overflow-y: auto; margin-bottom: 16px;
      font-size: 0.8rem; font-family: monospace; color: #7EC8E3;
    }
    .log-entry { padding: 1px 0; }

    .export-area { margin-bottom: 16px; }
    .btn-export {
      width: 100%; padding: 14px; font-size: 1rem; font-weight: 700;
      background: #22C55E; color: white; border: none; border-radius: 10px;
      cursor: pointer;
    }
    .btn-export:disabled { opacity: 0.4; cursor: not-allowed; }
    .export-hint { color: #888; font-size: 0.85rem; margin: 6px 0 0; }

    .ts-output-area {
      background: #0d0d1a; border-radius: 8px; overflow: hidden;
    }
    .ts-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 8px 12px; background: #111; color: #888; font-size: 0.8rem;
    }
    .ts-header button {
      background: #333; color: #aaa; border: none; border-radius: 4px;
      padding: 4px 10px; cursor: pointer;
    }
    .ts-output {
      width: 100%; height: 200px; background: transparent; color: #98D8A8;
      border: none; padding: 12px; font-family: monospace; font-size: 0.75rem;
      resize: vertical; box-sizing: border-box;
    }
  `]
})
export class EmbeddingExporterComponent implements OnInit {
  readonly wavlm = inject(WavlmService);

  readonly vowels      = VOWELS;
  readonly activeVowel = signal<Vowel>('A');
  readonly recording   = signal(false);
  readonly lastScore   = signal<number | null>(null);
  readonly log         = signal<string[]>([]);
  readonly tsOutput    = signal('');

  // Almacena los embeddings crudos por vocal
  embeddings: Record<Vowel, Float32Array[]> = {
    A: [], E: [], I: [], O: [], U: []
  };

  readonly canExport = () =>
    VOWELS.every(v => this.embeddings[v].length >= 1);

  ngOnInit() { this.wavlm.loadModel(); }

  async record(): Promise<void> {
    if (this.recording() || this.wavlm.modelStatus() !== 'ready') return;
    this.recording.set(true);
    const vowel = this.activeVowel();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 48_000,
                 echoCancellation: true, noiseSuppression: true }
      });

      const ctx    = new AudioContext({ sampleRate: 48_000 });
      const source = ctx.createMediaStreamSource(stream);

      // Grabar con AudioWorklet si está disponible, si no fallback a MediaRecorder
      const pcmRaw = await this.captureAudio(source, ctx);

      stream.getTracks().forEach(t => t.stop());
      await ctx.close();

      // Construir AudioBuffer y remuestrear
      const buf = ctx.createBuffer(1, pcmRaw.length, 48_000);
      buf.getChannelData(0).set(pcmRaw);
      const pcm16k = await this.wavlm.resampleTo16kHz(buf);

      // Extraer embedding
      const emb = await this.wavlm.extractEmbedding(pcm16k);
      this.embeddings[vowel].push(emb);

      this.lastScore.set(emb.length);
      this.addLog(`✅ ${vowel} #${this.embeddings[vowel].length} — ${emb.length} dims`);

    } catch (err: any) {
      this.addLog(`❌ Error: ${err.message}`);
    } finally {
      this.recording.set(false);
    }
  }

  clear(vowel: Vowel): void {
    this.embeddings[vowel] = [];
    this.addLog(`🗑️  ${vowel} borrada`);
  }

  exportTs(): void {
    const lines: string[] = [
      '/**',
      ' * reference-embeddings.ts — GENERADO DESDE EL NAVEGADOR',
      ` * Fecha  : ${new Date().toISOString()}`,
      ' * Modelo : Xenova/wavlm-base-plus-sv (ONNX, mismo que el validador)',
      ' *',
      ' * Embeddings promediados desde grabaciones reales.',
      ' * NO editar manualmente.',
      ' */',
      '',
      "export type Vowel = 'A' | 'E' | 'I' | 'O' | 'U';",
      '',
      'export const REFERENCE_EMBEDDINGS: Record<Vowel, Float32Array> = {',
    ];

    let maxCross = 0;
    const means: Record<string, Float32Array> = {};

    for (const vowel of VOWELS) {
      const embs = this.embeddings[vowel];
      if (!embs.length) continue;

      // Mean pooling de todos los embeddings de esa vocal
      const dim    = embs[0].length;
      const pooled = new Float32Array(dim);
      for (const e of embs) for (let i = 0; i < dim; i++) pooled[i] += e[i];
      for (let i = 0; i < dim; i++) pooled[i] /= embs.length;

      // Normalizar L2
      let norm = 0;
      for (let i = 0; i < dim; i++) norm += pooled[i] * pooled[i];
      norm = Math.sqrt(norm);
      for (let i = 0; i < dim; i++) pooled[i] /= norm;

      means[vowel] = pooled;
      const vals   = Array.from(pooled).map(v => v.toFixed(8)).join(', ');
      lines.push(`  ${vowel}: new Float32Array([${vals}]),`);
    }

    lines.push('};', '');

    // Calcular umbral sugerido desde similitudes cruzadas
    const vowelsReady = VOWELS.filter(v => means[v]);
    for (let i = 0; i < vowelsReady.length; i++) {
      for (let j = i + 1; j < vowelsReady.length; j++) {
        const sim = this.cosineSim(means[vowelsReady[i]], means[vowelsReady[j]]);
        if (sim > maxCross) maxCross = sim;
      }
    }
    const threshold = Math.min(0.95, +(maxCross + 0.02).toFixed(2));
    const dim       = Object.values(means)[0]?.length ?? 512;

    lines.push(
      `export const EMBEDDING_DIMS = ${dim};`,
      '',
      '/** Umbral calculado desde la similitud máxima entre vocales distintas */',
      `export const SUGGESTED_THRESHOLD = ${threshold.toFixed(2)};`,
    );

    this.tsOutput.set(lines.join('\n'));
    this.addLog(`📄 Exportado — umbral sugerido: ${threshold.toFixed(2)}`);
  }

  copyToClipboard(): void {
    navigator.clipboard.writeText(this.tsOutput()).then(() =>
      this.addLog('📋 Copiado al portapapeles')
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private captureAudio(
    source: MediaStreamAudioSourceNode,
    ctx: AudioContext
  ): Promise<Float32Array> {
    return new Promise((resolve) => {
      const bufSize  = 4096;
      const proc     = ctx.createScriptProcessor(bufSize, 1, 1);
      const chunks: Float32Array[] = [];
      const target   = Math.ceil((RECORD_MS / 1000) * ctx.sampleRate);
      let collected  = 0;

      proc.onaudioprocess = (e) => {
        const chunk = e.inputBuffer.getChannelData(0).slice();
        chunks.push(chunk);
        collected += chunk.length;
        if (collected >= target) {
          source.disconnect(proc);
          proc.disconnect();
          const merged = new Float32Array(target);
          let off = 0;
          for (const c of chunks) {
            merged.set(c.subarray(0, Math.min(c.length, target - off)), off);
            off += c.length;
            if (off >= target) break;
          }
          resolve(merged);
        }
      };
      source.connect(proc);
      proc.connect(ctx.destination);
    });
  }

  private cosineSim(a: Float32Array, b: Float32Array): number {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i];
    }
    const d = Math.sqrt(na) * Math.sqrt(nb);
    return d === 0 ? 0 : dot / d;
  }

  private addLog(msg: string): void {
    const time = new Date().toLocaleTimeString();
    this.log.update(l => [`[${time}] ${msg}`, ...l].slice(0, 50));
  }
}