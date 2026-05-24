import { FingerName, FingerState, Handedness, LschLetter, DetectionStatus } from '../types/hand-tracking.types';

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export interface FingerData {
  name: FingerName;
  state: FingerState;
  tipLandmarkIndex: number;
  pipLandmarkIndex: number;
  mcpLandmarkIndex: number;
}

export interface HandData {
  landmarks: Landmark[];
  handedness: Handedness;
  score: number;
  fingers: Record<FingerName, FingerData>;
}

export interface DetectionResult {
  letter: LschLetter;
  confidence: number;
  hands: HandData[];
  timestamp: number;
}

export interface HandTrackerState {
  status: DetectionStatus;
  result: DetectionResult | null;
  error: string | null;
  cameraActive: boolean;
  debugMode: boolean;
}

export interface LschLetterRule {
  letter: LschLetter;
  description: string;
  detect: (hand: HandData) => number; // returns confidence 0-1
}

export interface CameraConfig {
  width: number;
  height: number;
  facingMode: 'user' | 'environment';
}
