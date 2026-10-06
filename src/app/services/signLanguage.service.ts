import { Injectable, signal } from '@angular/core';
import { FilesetResolver, HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { Landmark } from '../interfaces/sign-language.interface';

export const DEBUG_SIGN = true; // 👈 pon en false cuando termines de calibrar

@Injectable({ providedIn: 'root' })
export class SignLanguageService {
  private handLandmarker?: HandLandmarker;
  isModelReady = signal(false);

  /** Mensaje de error si el modelo no pudo cargarse. El componente lo muestra en pantalla. */
  errorModelo = signal<string | null>(null);

  /** Promesa de la carga en curso, para que el componente pueda esperarla
   *  en vez de arrancar el cronómetro a ciegas. */
  private cargaEnCurso?: Promise<void>;

  /** El modelo son varios MB desde un CDN externo. En una red escolar lenta o con
   *  filtros, el fetch puede quedarse colgado sin lanzar error nunca. */
  private static readonly TIMEOUT_CARGA_MS = 30_000;

  constructor() {
    this.cargaEnCurso = this.initModel();
  }

  private async initModel(): Promise<void> {
    this.errorModelo.set(null);

    const conTimeout = <T>(promesa: Promise<T>): Promise<T> =>
      Promise.race([
        promesa,
        new Promise<T>((_, reject) =>
          setTimeout(
            () => reject(new Error('timeout')),
            SignLanguageService.TIMEOUT_CARGA_MS,
          ),
        ),
      ]);

    try {
      // Todo se sirve desde la propia app, sin CDNs: las redes escolares suelen
      // bloquearlos y así funciona igual en la VPS.
      // - wasm: angular.json lo copia desde node_modules en cada build, así que
      //   siempre coincide con la versión instalada de @mediapipe/tasks-vision.
      // - modelo: public/mediapipe/hand_landmarker.task (float16, versión 1).
      const vision = await conTimeout(FilesetResolver.forVisionTasks('mediapipe/wasm'));

      this.handLandmarker = await conTimeout(
        HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'mediapipe/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 1,
          minHandDetectionConfidence: 0.6,
          minHandPresenceConfidence: 0.6,
          minTrackingConfidence: 0.6,
        }),
      );

      this.isModelReady.set(true);
    } catch (e) {
      console.error('Error cargando el modelo de manos', e);
      this.isModelReady.set(false);
      this.errorModelo.set(
        // El modelo y el wasm se sirven desde la propia app (public/mediapipe y
        // la copia de angular.json), así que no es un problema de internet.
        'No pudimos cargar el detector de manos. Recarga la página e inténtalo de nuevo.',
      );
    }
  }

  /** Espera a que termine la carga. Devuelve false si falló: el componente NO debe
   *  arrancar el cronómetro en ese caso. */
  async esperarModelo(): Promise<boolean> {
    await this.cargaEnCurso;
    return this.isModelReady();
  }

  /** Reintento manual, para el botón de la pantalla de error. */
  async reintentarCarga(): Promise<boolean> {
    this.cargaEnCurso = this.initModel();
    return this.esperarModelo();
  }

  detect(video: HTMLVideoElement): HandLandmarkerResult | null {
    if (!this.handLandmarker || video.readyState < 2) return null;
    return this.handLandmarker.detectForVideo(video, performance.now());
  }

  // ===========================================================
  // Índices de landmarks de MediaPipe (nombrados para no equivocarse)
  // ===========================================================
  private static readonly L = {
    MUNECA: 0,
    PULGAR_CMC: 1,
    PULGAR_MCP: 2,
    PULGAR_IP: 3,
    PULGAR_TIP: 4,
    INDICE_MCP: 5,
    INDICE_PIP: 6,
    INDICE_TIP: 8,
    MEDIO_MCP: 9,
    MEDIO_PIP: 10,
    MEDIO_TIP: 12,
    ANULAR_MCP: 13,
    ANULAR_PIP: 14,
    ANULAR_TIP: 16,
    MENIQUE_MCP: 17,
    MENIQUE_PIP: 18,
    MENIQUE_TIP: 20,
  } as const;

  // ===========================================================
  // Utilidades de escala: todo se mide relativo al tamaño de LA MANO,
  // no a la imagen completa. Así da igual si el niño está cerca o lejos.
  // ===========================================================

  private dist(a: Landmark, b: Landmark): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  /** Distancia muñeca -> nudillo medio: referencia estable del "tamaño" de la mano en pantalla */
  private escalaMano(landmarks: Landmark[]): number {
    const L = SignLanguageService.L;
    return this.dist(landmarks[L.MUNECA], landmarks[L.MEDIO_MCP]) || 0.001;
  }

  /** Distancia de la punta del dedo a su propio nudillo base. Mide qué tan recogido está
   *  contra la palma: alto = mano abierta o redonda (O), bajo = punta apretada contra la palma (E). */
  private profundidadPliegue(tip: Landmark, mcp: Landmark, escala: number): number {
    return this.dist(tip, mcp) / escala;
  }

  /** Convierte un valor crudo en un puntaje 0-1, con transición suave entre "malo" y "bueno" */
  private normalizar(valor: number, malo: number, bueno: number): number {
    if (bueno === malo) return valor >= bueno ? 1 : 0;
    const t = (valor - malo) / (bueno - malo);
    return Math.max(0, Math.min(1, t));
  }

  /** Igual que normalizar, pero para casos donde "menor valor = mejor" (ej. dedos juntos) */
  private normalizarInverso(valor: number, malo: number, bueno: number): number {
    return this.normalizar(-valor, -malo, -bueno);
  }

  // ===========================================================
  // Flexión de dedos, medida por ÁNGULO en el nudillo medio (PIP).
  //
  // Rango observado en la práctica:
  //   ~180°  dedo completamente recto
  //   ~100°  garra / doblado parcial (E, O)
  //   ~40°   o menos: puño cerrado a fondo (A)
  //
  // ⚠️ El bug de calibración anterior: se usaba una sola escala
  // normalizar(angulo, 90, 160) para todo. Eso mandaba a 0 todo lo
  // menor a 90°, así que un puño (7°) y una garra (95°) daban
  // "curvado" prácticamente idéntico -> A y E indistinguibles.
  // Ahora hay TRES bandas separadas y mutuamente excluyentes.
  // ===========================================================

  // ===========================================================
  // Flexión de dedos, medida por ÁNGULO 3D en el nudillo medio (PIP).
  //
  // ⚠️ Estos umbrales están calibrados con mediciones REALES del panel de debug,
  // no con la geometría teórica. El `z` de MediaPipe es una profundidad relativa
  // aproximada, así que los ángulos salen comprimidos hacia abajo: una garra que
  // "debería" dar ~95° en la vida real acá mide ~60°.
  //
  // Medido en cámara (los 4 dedos, valores mín-máx):
  //   puño (A)      ->  13 - 29°
  //   garra (E)     ->  54 - 69°
  //   mano abierta  -> 174 - 179°
  //
  // Los cortes van en el hueco entre grupos: 32/45 separa puño de garra.
  // Si cambia la cámara o el usuario, volvé a medir estas tres posturas
  // y movés los umbrales; no toques las fórmulas.
  // ===========================================================

  /** Ángulo (grados) en el nudillo medio, calculado en 3D.
   *
   *  ⚠️ Antes esto usaba solo x/y. Eso falla justo en la postura más común de este
   *  ejercicio: palma hacia la cámara con los dedos curvándose HACIA ADELANTE. En esa
   *  pose la flexión ocurre en el eje de profundidad, la punta del dedo se proyecta
   *  encima del nudillo, y el ángulo 2D colapsa a ~0° aunque el dedo esté a medio doblar
   *  (síntoma: garra leída como puño, E=0% y A=100%). Incluir z lo resuelve. */
  private anguloDedo(base: Landmark, medio: Landmark, punta: Landmark): number {
    const v1 = { x: base.x - medio.x, y: base.y - medio.y, z: base.z - medio.z };
    const v2 = { x: punta.x - medio.x, y: punta.y - medio.y, z: punta.z - medio.z };

    const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
    const mag1 = Math.hypot(v1.x, v1.y, v1.z);
    const mag2 = Math.hypot(v2.x, v2.y, v2.z);

    if (mag1 === 0 || mag2 === 0) return 180;

    const cos = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
    return (Math.acos(cos) * 180) / Math.PI;
  }

  /** 1 = dedo recto (>=150°), 0 = doblado (<=110°).
   *
   *  ⚠️ No aflojar este rango. Estuvo en 85-130 un momento y provocaba que un
   *  meñique a medio doblar (medido 112° en una O) puntuara 0.6 como "estirado",
   *  y la I aparecía con 59% compitiendo contra la O legítima. Los estirados
   *  reales miden 168-175°, así que 150 les sobra de holgura. */
  private extendido(base: Landmark, medio: Landmark, punta: Landmark): number {
    return this.normalizar(this.anguloDedo(base, medio, punta), 110, 150);
  }

  /** 1 = puño cerrado (<=32°), 0 = abierto (>=45°).
   *  El puño real llega hasta 29°, así que 32 le deja holgura.
   *  Usar SOLO en A, donde el cierre total es lo que define la seña. */
  private cerrado(base: Landmark, medio: Landmark, punta: Landmark): number {
    return this.normalizarInverso(this.anguloDedo(base, medio, punta), 45, 32);
  }

  /** 1 = dedo recogido (<=60°), 0 = estirado (>=95°).
   *
   *  Versión permisiva de cerrado(), para los dedos que solo tienen que estar
   *  FUERA DEL CAMINO (el medio y el anular en I y U). En esas señas el pulgar
   *  los sujeta y no llegan a enrollarse como en un puño: medidos 24-31°, o sea
   *  justo en el borde de cerrado(), y con la mano relajada se van a 35-45°.
   *  Exigirles cierre de puño hacía que la seña se cayera por nada. */
  private plegado(base: Landmark, medio: Landmark, punta: Landmark): number {
    return this.normalizarInverso(this.anguloDedo(base, medio, punta), 95, 60);
  }

  /** 1 = garra (44°-85°), 0 si se cierra a puño (<=32°) o se estira (>=110°).
   *  La entrada arranca en 32 (justo sobre el puño real de 29°) para tolerar
   *  garras poco marcadas sin dejar entrar un puño. */
  private garra(base: Landmark, medio: Landmark, punta: Landmark): number {
    const a = this.anguloDedo(base, medio, punta);
    return Math.min(this.normalizar(a, 32, 44), this.normalizarInverso(a, 110, 85));
  }

  // ===========================================================
  // Puntaje por vocal (0-100). Usa el mínimo de las sub-condiciones
  // (igual que un AND lógico, pero suave en vez de abrupto).
  // ===========================================================

  scoreVocal(landmarks: Landmark[], target: string): number {
    const L = SignLanguageService.L;
    const escala = this.escalaMano(landmarks);

    const thumbTip = landmarks[L.PULGAR_TIP];
    const thumbMcp = landmarks[L.PULGAR_MCP]; // 👈 base REAL del pulgar (antes se usaba el 5 por error)

    const indexTip = landmarks[L.INDICE_TIP];
    const middleTip = landmarks[L.MEDIO_TIP];
    const ringTip = landmarks[L.ANULAR_TIP];
    const pinkyTip = landmarks[L.MENIQUE_TIP];

    const indexPip = landmarks[L.INDICE_PIP];
    const middlePip = landmarks[L.MEDIO_PIP];
    const ringPip = landmarks[L.ANULAR_PIP];
    const pinkyPip = landmarks[L.MENIQUE_PIP];

    const mcpIndex = landmarks[L.INDICE_MCP];
    const mcpMiddle = landmarks[L.MEDIO_MCP];
    const mcpRing = landmarks[L.ANULAR_MCP];
    const mcpPinky = landmarks[L.MENIQUE_MCP];

    let puntaje = 0;

    switch (target) {
      case 'A': {
        // Puño cerrado a fondo, pulgar apoyado al costado (lejos de la punta del índice).
        const puñoCerrado = Math.min(
          this.cerrado(mcpIndex, indexPip, indexTip),
          this.cerrado(mcpMiddle, middlePip, middleTip),
          this.cerrado(mcpRing, ringPip, ringTip),
          this.cerrado(mcpPinky, pinkyPip, pinkyTip),
        );

        const distPulgarIndice = this.dist(thumbTip, indexTip) / escala;
        const pulgarLejos = this.normalizar(distPulgarIndice, 0.18, 0.4);

        puntaje = Math.min(puñoCerrado, pulgarLejos);
        break;
      }

      case 'E': {
        // Garra: dedos doblados a medias, NO cerrados a fondo. Es lo que la separa de A.
        const posicionGarra = Math.min(
          this.garra(mcpIndex, indexPip, indexTip),
          this.garra(mcpMiddle, middlePip, middleTip),
          this.garra(mcpRing, ringPip, ringTip),
        );

        // En LSCh el pulgar queda SEPARADO de la garra.
        //
        // ⚠️ Esto es una COMPUERTA, no una nota. Antes la rampa iba de 0.35 a 0.70,
        // y como el puntaje final es un Math.min, la letra entera terminaba siendo
        // un termómetro de cuánto estiraba el pulgar el usuario: 0.53 -> 51%,
        // 0.66 -> 89%, 0.70 -> 100%. La rampa corta de acá abajo solo distingue
        // "pulgar afuera" de "pulgar escondido" (medido escondido: 0.268) y deja
        // que el puntaje lo decidan los dedos, que es lo que define la seña.
        const distPulgar = this.dist(thumbTip, mcpIndex) / escala;
        const pulgarAfuera = this.normalizar(distPulgar, 0.3, 0.42);

        // 👇 Esto es lo que separa E de O. Las dos tienen los dedos doblados en un
        // rango parecido (E: 49-72°, O: 69-72°), así que el ángulo no alcanza.
        // La diferencia real es el pulgar: en O toca las puntas (medido: 0.178),
        // en E se queda afuera (medido: 0.819). También es compuerta, no nota.
        const pulgarNoTocaPuntas = this.normalizar(
          this.dist(thumbTip, indexTip) / escala,
          0.3,
          0.45,
        );

        puntaje = Math.min(posicionGarra, pulgarAfuera, pulgarNoTocaPuntas);
        break;
      }

      case 'I': {
        // Igual que en U: lo que define la seña es el meñique estirado. Los otros
        // tres solo tienen que estar recogidos.
        const distPulgar = this.dist(thumbTip, mcpIndex) / escala;
        const pulgarPegado = this.normalizarInverso(distPulgar, 0.8, 0.45);

        puntaje = Math.min(
          this.extendido(mcpPinky, pinkyPip, pinkyTip),
          this.plegado(mcpIndex, indexPip, indexTip),
          this.plegado(mcpMiddle, middlePip, middleTip),
          this.plegado(mcpRing, ringPip, ringTip),
          pulgarPegado,
        );
        break;
      }

      case 'O': {
        // Círculo: pulgar tocando las puntas del índice y del medio.
        const distIndice = this.dist(thumbTip, indexTip) / escala;
        const distMedio = this.dist(thumbTip, middleTip) / escala;

        // ⚠️ El meñique NO queda en garra. Medido en el círculo real: 105°, o sea
        // bastante más estirado que una garra (54-69°). Acá solo se exige que no
        // esté completamente recto; el peso de la letra lo llevan las distancias.
        const meñiqueCurvado = this.normalizarInverso(
          this.anguloDedo(mcpPinky, pinkyPip, pinkyTip),
          150,
          120,
        );

        puntaje = Math.min(
          this.normalizarInverso(distIndice, 0.38, 0.15),
          this.normalizarInverso(distMedio, 0.45, 0.18),
          meñiqueCurvado,
        );
        break;
      }

      case 'U': {
        // Lo que define la seña es el índice y el meñique estirados. El medio y el
        // anular solo tienen que estar recogidos, no cerrados como puño.
        puntaje = Math.min(
          this.extendido(mcpIndex, indexPip, indexTip),
          this.extendido(mcpPinky, pinkyPip, pinkyTip),
          this.plegado(mcpMiddle, middlePip, middleTip),
          this.plegado(mcpRing, ringPip, ringTip),
        );
        break;
      }
    }

    return Math.round(puntaje * 100);
  }

  /** Puntaje de las 5 vocales a la vez, útil para saber qué seña hizo realmente si falló la esperada */
  scoreTodasLasVocales(landmarks: Landmark[]): Record<string, number> {
    const vocales = ['A', 'E', 'I', 'O', 'U'];
    const resultado: Record<string, number> = {};
    for (const v of vocales) {
      resultado[v] = this.scoreVocal(landmarks, v);
    }
    return resultado;
  }

  /**
   * Medidas CRUDAS (sin normalizar) de la letra actual, para calibrar a ojo.
   * ⚠️ Regla: acá SOLO deben aparecer las medidas que scoreVocal usa de verdad
   * para esa letra. Si no, calibrás mirando números que no mueven el puntaje
   * (era el caso de los `pliegue*` en A y O).
   */
  medidasCrudas(landmarks: Landmark[], target: string): Record<string, number> {
    const L = SignLanguageService.L;
    const escala = this.escalaMano(landmarks);

    const thumbTip = landmarks[L.PULGAR_TIP];
    const indexTip = landmarks[L.INDICE_TIP];
    const middleTip = landmarks[L.MEDIO_TIP];
    const ringTip = landmarks[L.ANULAR_TIP];
    const pinkyTip = landmarks[L.MENIQUE_TIP];

    const indexPip = landmarks[L.INDICE_PIP];
    const middlePip = landmarks[L.MEDIO_PIP];
    const ringPip = landmarks[L.ANULAR_PIP];
    const pinkyPip = landmarks[L.MENIQUE_PIP];

    const mcpIndex = landmarks[L.INDICE_MCP];
    const mcpMiddle = landmarks[L.MEDIO_MCP];
    const mcpRing = landmarks[L.ANULAR_MCP];
    const mcpPinky = landmarks[L.MENIQUE_MCP];

    const round = (n: number) => Math.round(n * 1000) / 1000;
    const ang = (b: Landmark, m: Landmark, p: Landmark) => round(this.anguloDedo(b, m, p));

    // Los cuatro ángulos salen SIEMPRE, en cualquier letra. Así podés medir una
    // postura cualquiera sin importar qué letra te esté pidiendo el ejercicio.
    const angulos = {
      angIndice: ang(mcpIndex, indexPip, indexTip),
      angMedio: ang(mcpMiddle, middlePip, middleTip),
      angAnular: ang(mcpRing, ringPip, ringTip),
      angMeñique: ang(mcpPinky, pinkyPip, pinkyTip),
    };

    switch (target) {
      case 'A':
        return {
          ...angulos,
          distPulgarIndice: round(this.dist(thumbTip, indexTip) / escala),
        };

      case 'E':
        return {
          ...angulos,
          distPulgarMcpIndice: round(this.dist(thumbTip, mcpIndex) / escala),
          distPulgarIndice: round(this.dist(thumbTip, indexTip) / escala),
        };

      case 'I':
        return {
          ...angulos,
          distPulgarMcpIndice: round(this.dist(thumbTip, mcpIndex) / escala),
        };

      case 'O':
        return {
          ...angulos,
          distPulgarIndice: round(this.dist(thumbTip, indexTip) / escala),
          distPulgarMedio: round(this.dist(thumbTip, middleTip) / escala),
        };

      case 'U':
        return angulos;

      default:
        return angulos;
    }
  }
}
