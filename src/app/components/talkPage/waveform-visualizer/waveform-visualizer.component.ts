import { Component, ElementRef, effect, inject, viewChild, OnDestroy } from '@angular/core';
import { VowelDetectorService } from '../../../services/vowel-detector.service';

@Component({
  selector: 'app-waveform-visualizer',
  standalone: true,
  template: `<canvas #canvas class="wave-canvas" width="600" height="140"></canvas>`,
  styleUrl: './waveform-visualizer.component.scss',
})
export class WaveformVisualizerComponent implements OnDestroy {
  private detector = inject(VowelDetectorService);
  private canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private rafId: number | null = null;

  constructor() {
    // Cuando el servicio empieza/termina de escuchar, arranca/detiene el dibujo.
    effect(() => {
      const node = this.detector.analyser();
      this.stop();
      if (node) this.start(node);
      else this.clear();
    });
  }

  private start(node: AnalyserNode): void {
    const ref = this.canvasRef();
    if (!ref) return;
    const canvas = ref.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const buffer = new Uint8Array(node.fftSize);

    const draw = () => {
      this.rafId = requestAnimationFrame(draw);
      try {
        node.getByteTimeDomainData(buffer);
      } catch {
        this.stop();
        return;
      }

      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#EEF4FF';
      ctx.fillRect(0, 0, width, height);

      ctx.lineWidth = 3;
      ctx.strokeStyle = '#4C6EF5';
      ctx.beginPath();
      const slice = width / buffer.length;
      let x = 0;
      for (let i = 0; i < buffer.length; i++) {
        const v = buffer[i] / 128;        // 0..2 (centrado en 1 = silencio)
        const y = (v * height) / 2;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        x += slice;
      }
      ctx.lineTo(width, height / 2);
      ctx.stroke();
    };
    draw();
  }

  private stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private clear(): void {
    const ref = this.canvasRef();
    if (!ref) return;
    const canvas = ref.nativeElement;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  }

  ngOnDestroy(): void {
    this.stop();
  }
}