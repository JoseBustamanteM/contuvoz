import {
  Component, ElementRef, ViewChild, AfterViewInit, OnDestroy,
  signal, computed, Output, EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SignLanguageService, DEBUG_SIGN } from '../../../services/signLanguage.service';
import { DrawingUtils, HandLandmarker } from '@mediapipe/tasks-vision';
import { Landmark, VowelLevel, ResultadoSign } from '../../../interfaces/sign-language.interface';

const VOCALES = ['A', 'E', 'I', 'O', 'U'];
const SEGUNDOS_POR_LETRA = 7;
const UMBRAL_APROBADO = 70;

/** Diferencia mínima entre la letra objetivo y la rival más parecida, EN EL MISMO FRAME.
 *  Sin esto, una postura ambigua que puntúa 72 en la objetivo y 71 en otra se acepta
 *  como acierto. */
const MARGEN_MINIMO = 15;

/** Cuánto hay que SOSTENER la seña correcta para darla por buena.
 *
 *  ⚠️ Medido en milisegundos, no en frames. El bucle corre con requestAnimationFrame,
 *  así que contar frames ata la dificultad al hardware: 60 frames son 1 segundo en un
 *  equipo de 60fps y 2 segundos en uno de 30fps. En un notebook escolar lento el niño
 *  podía no alcanzar nunca dentro de los 7 segundos de la letra. */
const MS_RETENCION = 800;

/** Puntaje mínimo para atribuir el fallo a otra letra en vez de a 'NINGUNA'. */
const UMBRAL_ATRIBUCION = 50;

/** Cuánto debe sostenerse una letra rival para atribuirle el fallo.
 *
 *  ⚠️ Sin esto, la atribución se queda con frames de TRANSICIÓN. Al mover la mano
 *  hacia una O, los dedos pasan un instante por ángulo de garra con el pulgar
 *  todavía afuera: eso es una E perfecta durante dos o tres cuadros. Ese pico
 *  suelto le ganaba a la O realmente sostenida, y en pantalla salía "vimos una E".
 *  Es más corto que MS_RETENCION porque acá solo se describe lo que pasó, no se
 *  aprueba nada. */
const MS_ATRIBUCION = 400;

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

  /** Los templates de Angular solo ven miembros de la clase: la constante VOCALES
   *  de nivel de módulo no es visible desde el HTML sin esta línea. */
  readonly VOCALES = VOCALES;

  isModelReady = computed(() => this.signService.isModelReady());

  /** Mientras esto sea true, el HTML debe mostrar "Preparando la cámara…" y NO
   *  el cronómetro: el modelo todavía se está descargando del CDN. */
  cargandoModelo = computed(
    () => !this.signService.isModelReady() && !this.signService.errorModelo(),
  );

  /** Error de carga del modelo (red del colegio, CDN caído). Separado del de cámara. */
  errorModelo = computed(() => this.signService.errorModelo());

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
  private destruido = false;

  /** Momento en que empezó la racha actual de frames válidos. null = no hay racha. */
  private inicioRetencion: number | null = null;

  /** Rival que se está sosteniendo ahora mismo. Solo pasa a `mejorRival` si aguanta
   *  MS_ATRIBUCION; así se descartan las poses de paso. */
  private rivalCandidata: { letra: string; puntaje: number; inicio: number } | null = null;

  private mejorConfianza = 0;

  /** Mejor puntaje alcanzado por CUALQUIER otra vocal durante la ventana, para
   *  poder decir qué seña hizo el niño en realidad cuando falla la pedida.
   *
   *  ⚠️ Se lleva como máximo GLOBAL, independiente del mejor frame de la letra
   *  objetivo. Estuvo atado a ese frame y provocaba un bug: si la objetivo
   *  puntuaba 0 en toda la ventana (lo normal cuando el niño hace otra letra,
   *  ahora que las vocales son mutuamente excluyentes), la condición
   *  `puntaje > mejorConfianza` nunca se cumplía, la rival no se registraba
   *  jamás y en la BD quedaba 'NINGUNA' aunque la seña fuera clarísima.
   *
   *  El margen mínimo NO usa este campo: compara contra la rival del frame en
   *  curso, que es una variable local de evaluarFrame(). */
  private mejorRival: { letra: string; puntaje: number } | null = null;

  constructor(private signService: SignLanguageService) {}

  async ngAfterViewInit() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      });

      if (this.destruido) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      this.videoRef.nativeElement.srcObject = stream;

      this.videoRef.nativeElement.onloadedmetadata = async () => {
        // onloadedmetadata puede dispararse más de una vez en algunos navegadores.
        // Sin este guard quedarían dos bucles de rAF corriendo en paralelo.
        if (this.loopIniciado) return;
        this.loopIniciado = true;

        this.videoRef.nativeElement.play();

        // El loop arranca ya: mientras el modelo no esté, detect() devuelve null y
        // solo se ve el video. Lo que NO puede arrancar es el cronómetro.
        this.startLoop();

        // ⚠️ Antes el cronómetro partía acá mismo. Como el modelo se descarga de un
        // CDN externo (varios MB), en una red lenta el niño perdía la letra A entera
        // sin que se evaluara un solo frame.
        const modeloOk = await this.signService.esperarModelo();
        if (this.destruido || !modeloOk) return;

        this.iniciarLetraActual();
      };
    } catch (e) {
      console.error('Error cámara', e);
      this.errorCamara.set(
        'No pudimos usar la cámara. Revisa que le hayas dado permiso al navegador.',
      );
    }
  }

  /** Reintento manual de la carga del modelo, para el botón de la pantalla de error. */
  async reintentarModelo() {
    const ok = await this.signService.reintentarCarga();
    if (ok && !this.destruido && !this.letraCerrada && this.tiempoRestante() === SEGUNDOS_POR_LETRA) {
      this.iniciarLetraActual();
    }
  }

  private iniciarLetraActual() {
    this.tiempoRestante.set(SEGUNDOS_POR_LETRA);
    this.mejorConfianza = 0;
    this.mejorRival = null;
    this.rivalCandidata = null;
    this.inicioRetencion = null;
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

    // Criterio único: la letra vale solo si se sostuvo MS_RETENCION. El mismo
    // veredicto rige el verde en pantalla y el registro en la BD.
    const letraDetectada = acerto
      ? letraEsperada
      : this.mejorRival && this.mejorRival.puntaje >= UMBRAL_ATRIBUCION
        ? this.mejorRival.letra
        : 'NINGUNA';

    this.isCorrect.set(acerto);

    this.resultadoListo.emit({
      letraEsperada,
      letraDetectada,
      porcConfianza: this.mejorConfianza,
      // El servidor no puede observar la duración: se la reportamos para que
      // aplique la regla completa (umbral Y sostenida) al calcular aprobado_sign.
      // Sin esto, un pico de 100 que duró 3 frames se guardaba como aprobado.
      sostenida: acerto,
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

    const superaUmbral = puntajeObjetivo >= UMBRAL_APROBADO;
    const superaMargen = !rival || puntajeObjetivo - rival.puntaje >= MARGEN_MINIMO;

    // ⚠️ Solo cuentan los frames que pasan el margen. Antes se guardaba el máximo
    // sin filtrar, y una postura ambigua (I en 100, E en 90) dejaba mejorConfianza
    // en 100 aunque el tracker hubiera rechazado la seña por falta de margen. El
    // servidor veía ese 100, aplicaba `>= 70` y guardaba aprobado=1 junto a
    // letra_detectada='E': una fila que se contradecía sola.
    if (superaMargen && puntajeObjetivo > this.mejorConfianza) {
      this.mejorConfianza = puntajeObjetivo;
    }

    // Se actualiza por separado: si la objetivo puntúa 0 en toda la ventana, la
    // rival igual queda registrada y la BD guarda la letra que el niño sí hizo.
    this.actualizarRival(rival);

    if (superaUmbral && superaMargen) {
      this.inicioRetencion ??= performance.now();

      if (performance.now() - this.inicioRetencion >= MS_RETENCION) {
        // Verde inmediato: el niño ve la recompensa mientras todavía tiene la mano puesta.
        this.isCorrect.set(true);
        this.finalizarLetraActual(true);
      }
    } else {
      // Un solo frame malo reinicia la racha. Con el suavizado EMA de smooth() los
      // temblores ya vienen filtrados, así que esto no debería dispararse por ruido.
      this.inicioRetencion = null;
    }
  }

  /** Acumula la rival actual y la promueve solo si se mantuvo MS_ATRIBUCION. */
  private actualizarRival(rival: { letra: string; puntaje: number } | null) {
    const ahora = performance.now();

    if (!rival || rival.puntaje < UMBRAL_ATRIBUCION) {
      this.rivalCandidata = null;
      return;
    }

    // Cambió la letra que va puntera: arranca una racha nueva.
    if (!this.rivalCandidata || this.rivalCandidata.letra !== rival.letra) {
      this.rivalCandidata = { letra: rival.letra, puntaje: rival.puntaje, inicio: ahora };
      return;
    }

    this.rivalCandidata.puntaje = Math.max(this.rivalCandidata.puntaje, rival.puntaje);

    if (ahora - this.rivalCandidata.inicio < MS_ATRIBUCION) return;

    if (!this.mejorRival || this.rivalCandidata.puntaje > this.mejorRival.puntaje) {
      this.mejorRival = {
        letra: this.rivalCandidata.letra,
        puntaje: this.rivalCandidata.puntaje,
      };
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
        this.inicioRetencion = null;
        this.rivalCandidata = null;
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
    this.destruido = true;
    this.detenerLoop();
    if (this.intervaloTimer) clearInterval(this.intervaloTimer);
    // Sin esto, si el niño sale durante la pausa de 1.5s el callback igual se ejecuta
    // sobre un componente destruido y emite testTerminado.
    if (this.timeoutAvance) clearTimeout(this.timeoutAvance);

    const stream = this.videoRef?.nativeElement?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
  }
}
