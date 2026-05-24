export type FingerName = 'thumb' | 'index' | 'middle' | 'ring' | 'pinky';

export type Handedness = 'Left' | 'Right';

export type LschLetter =
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
  | 'G' | 'H' | 'I' | 'J' | 'K' | 'L'
  | 'LL' | 'M' | 'N' | 'Ñ' | 'O' | 'P'
  | 'Q' | 'R' | 'RR' | 'S' | 'T' | 'U'
  | 'V' | 'W' | 'X' | 'Y' | 'Z'
  | 'UNKNOWN';

export type DetectionStatus = 'idle' | 'detecting' | 'detected' | 'no_hand' | 'error';

export type FingerState = 'extended' | 'bent' | 'curled';
