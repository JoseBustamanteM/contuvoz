import {
  Component, ElementRef, ViewChild, AfterViewInit, OnDestroy,
  signal, computed, Output, EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SignLanguageService, DEBUG_SIGN } from '../../../services/signLanguage.service';
import { DrawingUtils, HandLandmarker } from '@mediapipe/tasks-vision';
import { Landmark, VowelLevel, ResultadoSign } from '../../../interfaces/sign-language.interface';

const VOCALES = ['A', 'E', 'I', 'O', 'U'];
const SEGUNDOS_POR_LETRA = 5;
const UMBRAL_APROBADO = 70;

/** Diferencia mínima entre la letra objetivo y la rival más parecida, EN EL MISMO FRAME.
 *  Sin esto, una postura ambigua que puntúa 72 en la objetivo y 71 en otra se acepta
 *  como acierto. */
const MARGEN_MINIMO = 15;

/** Frames consecutivos válidos para dar la seña por buena. MediaPipe tiene ruido
 *  cuadro a cuadro: con 1 solo frame, un parpadeo de la detección aprueba la letra. */
const FRAMES_CONSECUTIVOS = 60;

/** Puntaje mínimo para atribuir el fallo a otra letra en vez de a 'NINGUNA'. */
const UMBRAL_ATRIBUCION = 50;

/** Pausa tras acertar, para que el niño alcance a ver el esqueleto verde. */
const MS_CELEBRACION = 900;

/** Pausa entre letras, mostrando el resultado. */
const MS_ENTRE_LETRAS = 1500;

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

  @Output() resultadoListo = new EventEmitter<ResultadoSign>();
  @Output() testTerminado = new EventEmitter<void>();

  readonly LEVELS: VowelLevel[] = [
    { letter: 'A', image: '../../images/lsh-a.png', description: 'Cierra el puño con el pulgar al lado.' },
    { letter: 'E', image: '../../images/lsh-e.png', description: 'Encoge tus dedos como una garra.' },
    { letter: 'I', image: '../../images/lsh-i.png', description: 'Levanta solo el dedo meñique.' },
    { letter: 'O', image: '../../images/lsh-o.png', description: 'Forma un círculo con tus dedos.' },
    { letter: 'U', image: '../../images/lsh-u.png', description: 'Levanta el índice y el meñique (cachos).' },
  ];

  isModelReady = computed(() => this.signService.isModelReady());

  indiceActual = signal(0);
  tiempoRestante = signal(SEGUNDOS_POR_LETRA);
  isCorrect = signal(false);
  testFinalizado = signal(false);

  /** Mensaje de error de cámara, para mostrarlo en el HTML en vez de dejar el recuadro vacío. */
  errorCamara = signal<string | null>(null);

  currentLevel = computed(() => this.LEVELS[this.indiceActual()]);
  debug = DEBUG_SIGN;
  puntajesDebug = signal<Record<string, number>>({});
  medidasCrudasDebug = signal<Record<string, number>>({});

  private animationId?: number;
  private smoothed?: Landmark[];
  private intervaloTimer?: ReturnType<typeof setInterval>;
  private timeoutAvance?: ReturnType<typeof setTimeout>;

  private loopIniciado = false;
  private letraCerrada = false;
  private framesValidos = 0;

  private mejorConfianza = 0;
  /** Rival más parecida EN EL FRAME donde la objetivo puntuó mejor. Guardarla acá
   *  (y no como máximo global independiente) es lo que hace que la comparación
   *  tenga sentido: las dos cifras vienen de la misma postura. */
  private rivalEnMejorFrame: { letra: string; puntaje: number } | null = null;

  constructor(private signService: SignLanguageService) {}

  async ngAfterViewInit() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      });

      this.videoRef.nativeElement.srcObject = stream;

      this.videoRef.nativeElement.onloadedmetadata = () => {
        // onloadedmetadata puede dispararse más de una vez en algunos navegadores.
        // Sin este guard quedarían dos bucles de rAF corriendo en paralelo.
        if (this.loopIniciado) return;
        this.loopIniciado = true;

        this.videoRef.nativeElement.play();
        this.startLoop();
        this.iniciarLetraActual();
      };
    } catch (e) {
      console.error('Error cámara', e);
      this.errorCamara.set(
        'No pudimos usar la cámara. Revisa que le hayas dado permiso al navegador.',
      );
    }
  }

  private iniciarLetraActual() {
    this.tiempoRestante.set(SEGUNDOS_POR_LETRA);
    this.mejorConfianza = 0;
    this.rivalEnMejorFrame = null;
    this.framesValidos = 0;
    this.letraCerrada = false;
    this.isCorrect.set(false);

    if (this.intervaloTimer) clearInterval(this.intervaloTimer);

    this.intervaloTimer = setInterval(() => {
      this.tiempoRestante.update((t) => t - 1);
      if (this.tiempoRestante() <= 0) {
        this.finalizarLetraActual(false);
      }
    }, 1000);
  }

  /** @param acerto true si se cierra por detección correcta, false si se acabó el tiempo. */
  private finalizarLetraActual(acerto: boolean) {
    // Puede llegar por dos caminos (acierto y cronómetro). Sin este guard, la letra
    // se emitiría dos veces y se guardarían filas duplicadas en resultado_sign.
    if (this.letraCerrada) return;
    this.letraCerrada = true;

    if (this.intervaloTimer) clearInterval(this.intervaloTimer);

    const letraEsperada = VOCALES[this.indiceActual()];

    const letraDetectada = acerto
      ? letraEsperada
      : this.rivalEnMejorFrame && this.rivalEnMejorFrame.puntaje >= UMBRAL_ATRIBUCION
        ? this.rivalEnMejorFrame.letra
        : 'NINGUNA';

    this.isCorrect.set(acerto);

    this.resultadoListo.emit({
      letraEsperada,
      letraDetectada,
      porcConfianza: this.mejorConfianza,
    });

    // Si acertó, se le da un momento extra con el esqueleto en verde antes de avanzar.
    const pausa = acerto ? MS_CELEBRACION + MS_ENTRE_LETRAS : MS_ENTRE_LETRAS;

    this.timeoutAvance = setTimeout(() => {
      const siguiente = this.indiceActual() + 1;
      if (siguiente >= VOCALES.length) {
        this.testFinalizado.set(true);
        this.detenerLoop();
        this.testTerminado.emit();
      } else {
        this.indiceActual.set(siguiente);
        this.iniciarLetraActual();
      }
    }, pausa);
  }

  /** Evalúa un frame y decide si cuenta como acierto. */
  private evaluarFrame(hand: Landmark[]) {
    const letraEsperada = VOCALES[this.indiceActual()];
    const todos = this.signService.scoreTodasLasVocales(hand);

    if (this.debug) {
      this.puntajesDebug.set(todos);
      this.medidasCrudasDebug.set(this.signService.medidasCrudas(hand, letraEsperada));
    }

    const puntajeObjetivo = todos[letraEsperada];

    // Rival más alta de ESTE frame.
    let rival: { letra: string; puntaje: number } | null = null;
    for (const [letra, puntaje] of Object.entries(todos)) {
      if (letra === letraEsperada) continue;
      if (!rival || puntaje > rival.puntaje) rival = { letra, puntaje };
    }

    if (puntajeObjetivo > this.mejorConfianza) {
      this.mejorConfianza = puntajeObjetivo;
      this.rivalEnMejorFrame = rival;
    }

    const superaUmbral = puntajeObjetivo >= UMBRAL_APROBADO;
    const superaMargen = !rival || puntajeObjetivo - rival.puntaje >= MARGEN_MINIMO;

    if (superaUmbral && superaMargen) {
      this.framesValidos++;
      if (this.framesValidos >= FRAMES_CONSECUTIVOS) {
        // Verde inmediato: el niño ve la recompensa mientras todavía tiene la mano puesta.
        this.isCorrect.set(true);
        this.finalizarLetraActual(true);
      }
    } else {
      this.framesValidos = 0;
    }
  }

  private startLoop() {
    const video = this.videoRef.nativeElement;
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;
    const drawingUtils = new DrawingUtils(ctx);

    const render = () => {
      if (canvas.width !== video.videoWidth && video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const results = this.signService.detect(video);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (results?.landmarks?.length && !this.testFinalizado()) {
        const raw = results.landmarks[0] as unknown as Landmark[];
        const hand = this.smooth(raw);

        // El trazo del esqueleto: SIN CAMBIOS, mismo grosor y color
        drawingUtils.drawConnectors(hand as any, HandLandmarker.HAND_CONNECTIONS, {
          color: this.isCorrect() ? '#00FF00' : '#00ACC1',
          lineWidth: 5,
        });

        // Durante la pausa entre letras se sigue dibujando la mano, pero no se puntúa.
        if (!this.letraCerrada) this.evaluarFrame(hand);
      } else {
        this.smoothed = undefined;
        this.framesValidos = 0;
      }

      this.animationId = requestAnimationFrame(render);
    };

    render();
  }

  private detenerLoop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = undefined;
    }
  }

  private smooth(hand: Landmark[]): Landmark[] {
    const alpha = 0.5;
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

  ngOnDestroy() {
    this.detenerLoop();
    if (this.intervaloTimer) clearInterval(this.intervaloTimer);
    // Sin esto, si el niño sale durante la pausa de 1.5s el callback igual se ejecuta
    // sobre un componente destruido y emite testTerminado.
    if (this.timeoutAvance) clearTimeout(this.timeoutAvance);

    const stream = this.videoRef?.nativeElement?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
  }
}
