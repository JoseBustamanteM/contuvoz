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
          // Misma versión que @mediapipe/tasks-vision de tu package.json
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm'
        );
        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 1,
          // 👇 Umbrales más altos = detección más firme y menos falsos positivos
          minHandDetectionConfidence: 0.6,
          minHandPresenceConfidence: 0.6,
          minTrackingConfidence: 0.6,
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

        case 'E': {
          // GARRA CHILENA: Dedos curvos, pulgar afuera.
          const isPinkyCurved = pinkyTip.y > landmarks[18].y;
          const allCurved = indexTip.y > landmarks[7].y &&
                            middleTip.y > landmarks[11].y &&
                            ringTip.y > landmarks[15].y;
          const thumbOut = Math.abs(thumbTip.x - landmarks[5].x) > 0.08;
          return allCurved && isPinkyCurved && thumbOut;
        }

        case 'I': {
          // MEÑIQUE ARRIBA y los demás guardados.
          const isPinkyStrictlyUp = pinkyTip.y < landmarks[18].y && landmarks[19].y < landmarks[18].y;
          const isIndexDown = indexTip.y > landmarks[6].y;
          const isMiddleDown = middleTip.y > landmarks[10].y;
          const isRingDown = ringTip.y > landmarks[14].y;
          const isThumbTucked = Math.abs(thumbTip.x - landmarks[5].x) < 0.08;
          return isPinkyStrictlyUp && isIndexDown && isMiddleDown && isRingDown && isThumbTucked;
        }

        case 'O': {
          const distThumbIndex = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
          const distThumbMiddle = Math.hypot(thumbTip.x - middleTip.x, thumbTip.y - middleTip.y);
          const isNotFist = Math.hypot(indexTip.x - landmarks[0].x, indexTip.y - landmarks[0].y) > 0.2;
          return distThumbIndex < 0.06 && distThumbMiddle < 0.06 && isNotFist;
        }

        case 'U': // "Cachos": índice y meñique extendidos
          return isIndexUp && isPinkyUp && !isMiddleUp && !isRingUp;

        default:
          return false;
      }
    }
  }