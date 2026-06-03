import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SignLanguageService } from '../../../services/signLanguage.service';
import { DrawingUtils, HandLandmarker } from '@mediapipe/tasks-vision';
import { Landmark } from '../../../interfaces/sign-language.interface';
import {VowelLevel} from '../../../interfaces/sign-language.interface'

@Component({
  selector: 'hand-tracker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hand-tracker.component.html',
  styleUrls: ['./hand-tracker.component.scss']
})
export class HandTrackerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('videoElement') videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly LEVELS: VowelLevel[] = [
    { letter: 'A', image: '../../images/lsh-a.png', description: 'Cierra el puño con el pulgar al lado.' },
    { letter: 'E', image: '../../images/lsh-e.png', description: 'Encoge tus dedos como una garra.' },
    { letter: 'I', image: '../../images/lsh-i.png', description: 'Levanta solo el dedo meñique.' },
    { letter: 'O', image: '../../images/lsh-o.png', description: 'Forma un círculo con tus dedos.' },
    { letter: 'U', image: '../../images/lsh-u.png', description: 'Levanta el índice y el meñique (cachos).' }
  ];




  readonly VOWELS = ['A', 'E', 'I', 'O', 'U'];
  currentIndex = signal(0);
  isCorrect = signal(false);
  isModelReady = computed(() => this.signService.isModelReady());
  currentLevel = computed(() => this.LEVELS[this.currentIndex()]);

  private validFrames = 0;
  private animationId?: number;

  constructor(private signService: SignLanguageService) {}

  async ngAfterViewInit() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      this.videoRef.nativeElement.srcObject = stream;
      this.videoRef.nativeElement.onloadedmetadata = () => {
        this.videoRef.nativeElement.play();
        this.startLoop();
      };
    } catch (e) { console.error("Error cámara", e); }
  }

  private startLoop() {
    const video = this.videoRef.nativeElement;
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;
    const drawingUtils = new DrawingUtils(ctx);

    const render = () => {
      const results = this.signService.detect(video);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (results?.landmarks?.length) {
        const hand = results.landmarks[0] as unknown as Landmark[];

        // Dibujamos el esqueleto en color turquesa (muy usado en salud/educación en Chile)
        drawingUtils.drawConnectors(hand as any, HandLandmarker.HAND_CONNECTIONS, {
          color: this.isCorrect() ? '#00FF00' : '#00ACC1',
          lineWidth: 5
        });

        if (this.signService.checkVowelsLSCh(hand, this.VOWELS[this.currentIndex()])) {
          this.validFrames++;
          if (this.validFrames > 15 && !this.isCorrect()) {
            this.onLevelComplete();
          }
        } else {
          this.validFrames = 0;
        }
      }
      this.animationId = requestAnimationFrame(render);
    };
    render();
  }

  private onLevelComplete() {
    this.isCorrect.set(true);
    // Aquí podrías disparar un sonido de éxito
    setTimeout(() => {
      this.isCorrect.set(false);
      this.validFrames = 0;
      this.currentIndex.update(i => (i + 1) % this.VOWELS.length);
    }, 2000);
  }

  ngOnDestroy() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    (this.videoRef.nativeElement.srcObject as MediaStream)?.getTracks().forEach(t => t.stop());
  }
}
