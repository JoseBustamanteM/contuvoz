import { Injectable, signal } from '@angular/core';
import { FilesetResolver, HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { Landmark } from '../interfaces/sign-language.interface';

@Injectable({ providedIn: 'root' })
export class SignLanguageService {
  private handLandmarker?: HandLandmarker;
  isModelReady = signal(false);

  constructor() { this.initModel(); }

  private async initModel() {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
    );
    this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
        delegate: "GPU"
      },
      runningMode: 'VIDEO',
      numHands: 1
    });
    this.isModelReady.set(true);
  }

  detect(video: HTMLVideoElement): HandLandmarkerResult | null {
    if (!this.handLandmarker || video.readyState < 2) return null;
    return this.handLandmarker.detectForVideo(video, performance.now());
  }

  checkVowelsLSCh(landmarks: Landmark[], target: string): boolean {
    // Puntas
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];

    // Nudillos intermedios (punto 6, 10, 14, 18)
    const indexPip = landmarks[6];
    const middlePip = landmarks[10];
    const ringPip = landmarks[14];
    const pinkyPip = landmarks[18];

    // Estados básicos
    const isIndexUp = indexTip.y < indexPip.y;
    const isMiddleUp = middleTip.y < middlePip.y;
    const isRingUp = ringTip.y < ringPip.y;
    const isPinkyUp = pinkyTip.y < pinkyPip.y;

    switch (target) {
      case 'A': // Puño cerrado
        return !isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp;

      case 'E':
  /**
   * AJUSTE SEGÚN TU FOTO:
   * 1. Los 4 dedos (índice a meñique) están curvos:
   * sus puntas están por debajo de sus nudillos medios (PIP).
   * 2. El pulgar (4) está extendido hacia afuera (coordenada X alejada).
   */
  const indexCurved = indexTip.y > landmarks[7].y;
  const middleCurved = middleTip.y > landmarks[11].y;
  const ringCurved = landmarks[16].y > landmarks[15].y;
  const pinkyCurved = pinkyTip.y > landmarks[19].y;

  // El pulgar está a una distancia considerable del índice en el eje X
  const thumbExtended = Math.abs(thumbTip.x - landmarks[5].x) > 0.1;

  return indexCurved && middleCurved && ringCurved && pinkyCurved && thumbExtended;

      case 'I': // Solo meñique
        return !isIndexUp && !isMiddleUp && !isRingUp && isPinkyUp;

      case 'O':
      /**
       * ESTRICTO PARA O:
       * 1. La punta del pulgar debe estar muy cerca de la punta del índice Y del medio.
       * 2. Debe haber una curvatura (no puede ser un puño plano).
       */
      const distThumbIndex = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
      const distThumbMiddle = Math.hypot(thumbTip.x - middleTip.x, thumbTip.y - middleTip.y);

      // En la 'O', los dedos se alejan un poco de la muñeca para formar el círculo
      const isNotFist = Math.hypot(indexTip.x - landmarks[0].x, indexTip.y - landmarks[0].y) > 0.2;

      return distThumbIndex < 0.06 && distThumbMiddle < 0.06 && isNotFist;

      case 'U':
        /**
         * CORRECCIÓN: "Cachos" (Índice y Meñique extendidos)
         */
        return isIndexUp && isPinkyUp && !isMiddleUp && !isRingUp;

      default: return false;
    }
  }
}
