import { Injectable, signal, computed, OnDestroy } from '@angular/core';
import { FilesetResolver, HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { HandData, DetectionResult, HandTrackerState, CameraConfig } from '../interfaces/hand-tracking.interface';
import { Handedness } from '../types/hand-tracking.types';
import { classifyLetter } from '../rules/lsch-letter-rules';

const DEFAULT_CAMERA_CONFIG: CameraConfig = {
  width: 640,
  height: 480,
  facingMode: 'user',
};

@Injectable({ providedIn: 'root' })
export class HandTrackerService implements OnDestroy {
  // ─── State signals ───────────────────────────────────────────────────────

  private readonly _state = signal<HandTrackerState>({
    status: 'idle',
    result: null,
    error: null,
    cameraActive: false,
    debugMode: false,
  });

  readonly state   = this._state.asReadonly();
  readonly status  = computed(() => this._state().status);
  readonly result  = computed(() => this._state().result);
  readonly letter  = computed(() => this._state().result?.letter ?? null);


  readonly error   = computed(() => this._state().error);
  readonly isActive = computed(() => this._state().cameraActive);
  readonly debugMode = computed(() => this._state().debugMode);

  // ─── Private internals ──────────────────────────────────────────────────

  private handLandmarker: HandLandmarker | null = null;
  private stream: MediaStream | null = null;
  private animationFrameId: number | null = null;
  private videoEl: HTMLVideoElement | null = null;
  private lastFrameTime = -1;
  private initialized = false;

  // ─── Public API ─────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.patchState({ status: 'detecting', error: null });

      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm'
      );

      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.6,
        minHandPresenceConfidence: 0.6,
        minTrackingConfidence: 0.5,
      });

      this.initialized = true;
      this.patchState({ status: 'idle' });
    } catch (err) {
      this.patchState({ status: 'error', error: 'No se pudo cargar el modelo de MediaPipe.' });
      console.error('[HandTrackerService] init error', err);
    }
  }

  async startCamera(
    videoEl: HTMLVideoElement,
    config: CameraConfig = DEFAULT_CAMERA_CONFIG
  ): Promise<void> {
    if (!this.initialized) await this.initialize();

    try {
      this.videoEl = videoEl;
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: config.width, height: config.height, facingMode: config.facingMode },
      });

      videoEl.srcObject = this.stream;
      await new Promise<void>((resolve) => { videoEl.onloadeddata = () => resolve(); });
      await videoEl.play();

      this.patchState({ cameraActive: true, status: 'detecting' });
      this.startDetectionLoop();
    } catch (err) {
      this.patchState({ status: 'error', error: 'No se pudo acceder a la cámara.', cameraActive: false });
      console.error('[HandTrackerService] camera error', err);
    }
  }

  stopCamera(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.videoEl) {
      this.videoEl.srcObject = null;
      this.videoEl = null;
    }
    this.patchState({ cameraActive: false, status: 'idle', result: null });
  }

  toggleDebug(): void {
    this.patchState({ debugMode: !this._state().debugMode });
  }

  // ─── Detection loop ──────────────────────────────────────────────────────

  private startDetectionLoop(): void {
    const detect = (timestamp: number) => {
      if (!this.videoEl || !this.handLandmarker) return;
      if (timestamp === this.lastFrameTime) {
        this.animationFrameId = requestAnimationFrame(detect);
        return;
      }
      this.lastFrameTime = timestamp;

      try {
        const mpResult: HandLandmarkerResult = this.handLandmarker.detectForVideo(
          this.videoEl,
          timestamp
        );
        this.processResult(mpResult, timestamp);
      } catch (e) {
        console.warn('[HandTrackerService] frame detection error', e);
      }

      this.animationFrameId = requestAnimationFrame(detect);
    };

    this.animationFrameId = requestAnimationFrame(detect);
  }

  private processResult(mpResult: HandLandmarkerResult, timestamp: number): void {
    if (!mpResult.landmarks?.length) {
      this.patchState({ status: 'no_hand', result: null });
      return;
    }

    const hands: HandData[] = mpResult.landmarks.map((lmList, i) => {
      const handedness: Handedness =
        (mpResult.handedness?.[i]?.[0]?.categoryName as Handedness) ?? 'Right';

      return {
        landmarks: lmList.map((lm) => ({ x: lm.x, y: lm.y, z: lm.z })),
        handedness,
        score: mpResult.handedness?.[i]?.[0]?.score ?? 1,
        fingers: {} as HandData['fingers'], // filled by classifier internally
      };
    });

    const primaryHand = hands[0];
    const { letter, confidence } = classifyLetter(primaryHand);

    const result: DetectionResult = { letter, confidence, hands, timestamp };
    this.patchState({ status: 'detected', result });


  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  private patchState(partial: Partial<HandTrackerState>): void {
    this._state.update((s) => ({ ...s, ...partial }));
  }

  ngOnDestroy(): void {
    this.stopCamera();
    this.handLandmarker?.close();
  }
}
