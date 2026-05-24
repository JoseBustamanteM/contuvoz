import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  computed,
  effect,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { WavlmService } from '../../../services/wavlm.service';
import {
  REFERENCE_EMBEDDINGS,
  SUGGESTED_THRESHOLD,
  EMBEDDING_DIMS,
} from './reference-embeddings';

import {EmbeddingExporterComponent} from './exporter-component'


// ── Tipos ────────────────────────────────────────────────────────────────────
type Vowel = 'A' | 'E' | 'I' | 'O' | 'U';
type RecordingState = 'idle' | 'recording' | 'processing' | 'done';

// ── Embeddings de referencia (placeholder de 512 dimensiones — wavlm-base-plus-sv) ────────────────
// En producción estos embeddings deben generarse offline usando audios reales
// de niños oyentes pronunciando cada vocal y guardarse como JSON o TypeScript.
// Aquí se generan valores de ejemplo con distribuciones ligeramente distintas
// para que la lógica funcione en desarrollo sin el modelo.




// ── Configuración ─────────────────────────────────────────────────────────────
const SIMILARITY_THRESHOLD = SUGGESTED_THRESHOLD;   // Umbral ajustable
const RECORDING_DURATION_MS = 1000;  // 1 segundo de grabación
const VOWELS: Vowel[] = ['A', 'E', 'I', 'O', 'U'];

// Colores y emojis por vocal
const VOWEL_META: Record<Vowel, { color: string; emoji: string; bg: string }> = {
  A: { color: '#FF6B6B', emoji: '🍎', bg: '#FFF0F0' },
  E: { color: '#FFB347', emoji: '⭐', bg: '#FFF8F0' },
  I: { color: '#7EC8E3', emoji: '🌈', bg: '#F0F8FF' },
  O: { color: '#98D8A8', emoji: '🌿', bg: '#F0FFF4' },
  U: { color: '#C3A4FF', emoji: '🦄', bg: '#F8F0FF' },
};

@Component({
  selector: 'app-vowel-validator',
  standalone: true,
  imports: [CommonModule, EmbeddingExporterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: 'vowelValidator.component.html',
  styleUrl: 'vowelValidator.component.scss',
})
export class VowelValidatorComponent implements OnInit, OnDestroy {
  // ── DI ───────────────────────────────────────────────────────────────────
  readonly wavlm = inject(WavlmService);

  // ── Signals de estado ────────────────────────────────────────────────────
  readonly targetVowel   = signal<Vowel>('A');
  readonly confidenceScore = signal<number>(0);
  readonly recordingState  = signal<RecordingState>('idle');
  readonly showCelebration = signal<boolean>(false);
  readonly feedbackMessage = signal<string>('');

  // ── Constantes públicas para la plantilla ────────────────────────────────
  readonly vowelList  = VOWELS;
  readonly vowelMeta  = VOWEL_META;
  readonly threshold  = SIMILARITY_THRESHOLD;
  readonly confettiItems = Array.from({ length: 11 }, (_, i) => i);
  readonly vuBars = Array.from({ length: 20 }, (_, i) => i);

  // ── Estado interno ───────────────────────────────────────────────────────
  successMap: Record<Vowel, boolean> = { A: false, E: false, I: false, O: false, U: false };

  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private vuAnimationId: number | null = null;
  private vuData = new Uint8Array(20);
  private workletReady = false; // evitar re-registrar el módulo

  // ── Computed ─────────────────────────────────────────────────────────────
  readonly currentVowelMeta = computed(() => VOWEL_META[this.targetVowel()]);

  readonly confidenceColor = computed(() => {
    const s = this.confidenceScore();
    if (s >= this.threshold) return '#22C55E';
    if (s >= 0.65) return '#F59E0B';
    return '#EF4444';
  });

  // ── Effect: celebrar cuando el score supera el umbral ───────────────────
  constructor() {
    effect(() => {
      if (this.confidenceScore() >= SIMILARITY_THRESHOLD && this.recordingState() === 'done') {
        this.celebrate();
      }
    });
  }

  // ── Ciclo de vida ────────────────────────────────────────────────────────
  ngOnInit(): void {
    // Cargar fuentes de Google Fonts para la estética infantil
    this.loadGoogleFonts();
    // Auto-cargar el modelo al inicio
    this.wavlm.loadModel();
  }

  ngOnDestroy(): void {
    this.stopAudioResources();
  }

  // ── Acciones de usuario ──────────────────────────────────────────────────
  selectVowel(vowel: Vowel): void {
    this.targetVowel.set(vowel);
    this.confidenceScore.set(0);
    this.recordingState.set('idle');
    this.feedbackMessage.set('');
  }

  async startRecording(): Promise<void> {
    if (this.wavlm.modelStatus() !== 'ready') return;

    try {
      // 1. Solicitar acceso al micrófono
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 48_000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      this.audioContext = new AudioContext({ sampleRate: 48_000 });
      const ctx    = this.audioContext;
      const source = ctx.createMediaStreamSource(this.mediaStream);

      // 2. Nodo analizador para el VU meter (sigue igual)
      this.analyserNode        = ctx.createAnalyser();
      this.analyserNode.fftSize = 64;
      source.connect(this.analyserNode);

      // 3. Registrar el AudioWorklet (solo la primera vez)
      if (!this.workletReady) {
        await ctx.audioWorklet.addModule('/worklets/recorder.worklet.js');
        this.workletReady = true;
      }

      // 4. Crear el WorkletNode con la cantidad de muestras objetivo
      const targetSamples = Math.ceil((RECORDING_DURATION_MS / 1000) * ctx.sampleRate);
      this.workletNode = new AudioWorkletNode(ctx, 'recorder-processor', {
        processorOptions: { targetSamples },
        numberOfInputs:   1,
        numberOfOutputs:  0, // no necesitamos salida de audio
        channelCount:     1,
      });

      // 5. Escuchar el mensaje 'done' que envía el worklet cuando termina
      const pcmPromise = new Promise<Float32Array>((resolve, reject) => {
        this.workletNode!.port.onmessage = (evt) => {
          if (evt.data?.type === 'done') resolve(evt.data.pcm as Float32Array);
        };
        this.workletNode!.port.onmessageerror = reject;
      });

      // 6. Conectar: source → analyser → worklet
      source.connect(this.workletNode);

      // 7. Iniciar UI de grabación
      this.recordingState.set('recording');
      this.feedbackMessage.set('');
      this.confidenceScore.set(0);
      this.animateVU();

      // 8. Esperar a que el worklet capture el segundo de audio
      const rawPcm = await pcmPromise;

      // 9. Limpiar recursos de audio
      this.stopAudioResources();
      this.recordingState.set('processing');

      // 10. Construir AudioBuffer para poder remuestrear con OfflineAudioContext
      const audioBuffer = ctx.createBuffer(1, rawPcm.length, ctx.sampleRate);
      audioBuffer.getChannelData(0).set(rawPcm);

      // 11. Remuestrear a 16 kHz
      const pcm16k = await this.wavlm.resampleTo16kHz(audioBuffer);

      // 12. Extraer embedding y comparar
      const embedding  = await this.wavlm.extractEmbedding(pcm16k);
      const reference  = REFERENCE_EMBEDDINGS[this.targetVowel()];
      const similarity = this.wavlm.cosineSimilarity(embedding, reference);

      // 13. Actualizar signals
      this.confidenceScore.set(Math.max(0, Math.min(1, similarity)));
      this.recordingState.set('done');

      // 14. Feedback textual
      if (similarity >= SIMILARITY_THRESHOLD) {
        this.feedbackMessage.set(`¡Muy bien! 🎉 Pronunciaste la ${this.targetVowel()} correctamente.`);
        this.successMap[this.targetVowel()] = true;
      } else if (similarity >= 0.65) {
        this.feedbackMessage.set(`¡Casi! Intenta de nuevo con más energía.`);
      } else {
        this.feedbackMessage.set(`Sigue practicando. ¡Tú puedes! 💪`);
      }

    } catch (err: any) {
      console.error('[VowelValidator] Error en grabación:', err);
      this.recordingState.set('idle');
      this.feedbackMessage.set('No se pudo acceder al micrófono. Verifica los permisos.');
      this.stopAudioResources();
    }
  }

  celebrate(): void {
    this.showCelebration.set(true);
    // Auto-cerrar la celebración tras 5 segundos
    setTimeout(() => this.showCelebration.set(false), 5000);
  }

  dismissCelebration(): void {
    this.showCelebration.set(false);
  }

  nextVowel(): void {
    this.showCelebration.set(false);
    const idx = VOWELS.indexOf(this.targetVowel());
    const next = VOWELS[(idx + 1) % VOWELS.length];
    this.selectVowel(next as Vowel);
  }

  // ── VU Meter ─────────────────────────────────────────────────────────────
  getBarHeight(index: number): number {
    const raw = this.vuData[index] ?? 0;
    // Escalar de 0-255 a 4-48 px
    return 4 + (raw / 255) * 44;
  }

  private animateVU(): void {
    if (!this.analyserNode) return;
    const data = new Uint8Array(this.analyserNode.frequencyBinCount);

    const tick = () => {
      if (this.recordingState() !== 'recording') return;
      this.analyserNode!.getByteFrequencyData(data);
      // Distribuir las frecuencias en los 20 slots del VU meter
      for (let i = 0; i < this.vuData.length; i++) {
        const srcIdx = Math.floor(i * (data.length / this.vuData.length));
        this.vuData[i] = data[srcIdx];
      }
      this.vuAnimationId = requestAnimationFrame(tick);
    };
    this.vuAnimationId = requestAnimationFrame(tick);
  }

  // ── Helpers de audio ─────────────────────────────────────────────────────
  // recordAudioBuffer eliminado: la captura se hace con AudioWorkletNode
  // (recorder.worklet.js) que no bloquea el hilo principal.

  private stopAudioResources(): void {
    if (this.vuAnimationId) {
      cancelAnimationFrame(this.vuAnimationId);
      this.vuAnimationId = null;
    }
    if (this.workletNode) {
      this.workletNode.port.postMessage({ type: 'stop' });
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
      // El AudioContext nuevo no hereda los worklets del anterior,
      // hay que volver a registrar el módulo en la siguiente grabación.
      this.workletReady = false;
    }
    this.analyserNode = null;
    // Reset VU bars
    this.vuData = new Uint8Array(20);
  }

  private loadGoogleFonts(): void {
    if (document.getElementById('vocalKidsFonts')) return;
    const link = document.createElement('link');
    link.id = 'vocalKidsFonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;600;700;800&display=swap';
    document.head.appendChild(link);
  }
}
