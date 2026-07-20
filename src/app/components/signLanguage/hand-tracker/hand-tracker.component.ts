import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SignLanguageService } from '../../../services/signLanguage.service';
import { DrawingUtils, HandLandmarker } from '@mediapipe/tasks-vision';
import { Landmark } from '../../../interfaces/sign-language.interface';
import { VowelLevel } from '../../../interfaces/sign-language.interface';

@Component({
  selector: 'hand-tracker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hand-tracker.component.html',
  styleUrls: ['./hand-tracker.component.scss'],
})
export class HandTrackerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('videoElement') videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly LEVELS: VowelLevel[] = [
    { letter: 'A', image: '../../images/lsh-a.png', description: 'Cierra el puño con el pulgar al lado.' },
    { letter: 'E', image: '../../images/lsh-e.png', description: 'Encoge tus dedos como una garra.' },
    { letter: 'I', image: '../../images/lsh-i.png', description: 'Levanta solo el dedo meñique.' },
    { letter: 'O', image: '../../images/lsh-o.png', description: 'Forma un círculo con tus dedos.' },
    { letter: 'U', image: '../../images/lsh-u.png', description: 'Levanta el índice y el meñique (cachos).' },
  ];

  readonly VOWELS = ['A', 'E', 'I', 'O', 'U'];
  currentIndex = signal(0);
  isCorrect = signal(false);
  isModelReady = computed(() => this.signService.isModelReady());
  currentLevel = computed(() => this.LEVELS[this.currentIndex()]);

  private validFrames = 0;
  private animationId?: number;
  private smoothed?: Landmark[];

  constructor(private signService: SignLanguageService) {}

  async ngAfterViewInit() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      this.videoRef.nativeElement.srcObject = stream;
      this.videoRef.nativeElement.onloadedmetadata = () => {
        this.videoRef.nativeElement.play();
        this.startLoop();
      };
    } catch (e) {
      console.error('Error cámara', e);
    }
  }

  private startLoop() {
    const video = this.videoRef.nativeElement;
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;
    const drawingUtils = new DrawingUtils(ctx);

    const render = () => {
      // Ajusta el canvas al tamaño real del video (para que el esqueleto no se descuadre)
      if (canvas.width !== video.videoWidth && video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const results = this.signService.detect(video);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (results?.landmarks?.length) {
        const raw = results.landmarks[0] as unknown as Landmark[];
        const hand = this.smooth(raw); // mano suavizada (anti-jitter)

        drawingUtils.drawConnectors(hand as any, HandLandmarker.HAND_CONNECTIONS, {
          color: this.isCorrect() ? '#00FF00' : '#00ACC1',
          lineWidth: 5,
        });

        if (this.signService.checkVowelsLSCh(hand, this.VOWELS[this.currentIndex()])) {
          this.validFrames++;
          if (this.validFrames > 15 && !this.isCorrect()) {
            this.onLevelComplete();
          }
        } else {
          this.validFrames = 0;
        }
      } else {
        this.smoothed = undefined; // resetea el suavizado si se pierde la mano
      }

      this.animationId = requestAnimationFrame(render);
    };
    render();
  }

  /** Suavizado exponencial: reduce el temblor de los puntos para un tracking más estable. */
  private smooth(hand: Landmark[]): Landmark[] {
    const alpha = 0.5; // ↓ más suave (con lag), ↑ más reactivo
    if (!this.smoothed || this.smoothed.length !== hand.length) {
      this.smoothed = hand.map((p) => ({ ...p }));
      return this.smoothed;
    }
    for (let i = 0; i < hand.length; i++) {
      this.smoothed[i] = {
        x: this.smoothed[i].x + (hand[i].x - this.smoothed[i].x) * alpha,
        y: this.smoothed[i].y + (hand[i].y - this.smoothed[i].y) * alpha,
        z: (this.smoothed[i].z ?? 0) + ((hand[i].z ?? 0) - (this.smoothed[i].z ?? 0)) * alpha,
      } as Landmark;
    }
    return this.smoothed;
  }

  private onLevelComplete() {
    this.isCorrect.set(true);
    // Aquí podrías disparar un sonido de éxito
    setTimeout(() => {
      this.isCorrect.set(false);
      this.validFrames = 0;
      this.currentIndex.update((i) => (i + 1) % this.VOWELS.length);
    }, 2000);
  }

  ngOnDestroy() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    (this.videoRef.nativeElement.srcObject as MediaStream)?.getTracks().forEach((t) => t.stop());
  }
}