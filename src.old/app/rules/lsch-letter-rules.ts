import { HandData, LschLetterRule } from '../interfaces/hand-tracking.interface';
import { LschLetter } from '../types/hand-tracking.types';
import {
  isFingerExtended, isFingerCurled, isFingerBent,
  isThumbExtended, isThumbCurled,
  tipsAreTouching, handScale, distance2D
} from '../utils/landmark-geometry.utils';

// ─── Helpers ───────────────────────────────────────────────────────────────

function ext(hand: HandData, finger: 'index' | 'middle' | 'ring' | 'pinky'): boolean {
  const lm = hand.landmarks;
  const map = { index: [8,7,5], middle: [12,11,9], ring: [16,15,13], pinky: [20,19,17] };
  const [tip, pip, mcp] = map[finger];
  return isFingerExtended(lm[tip], lm[pip], lm[mcp]);
}

function curl(hand: HandData, finger: 'index' | 'middle' | 'ring' | 'pinky'): boolean {
  const lm = hand.landmarks;
  const map = { index: [8,5], middle: [12,9], ring: [16,13], pinky: [20,17] };
  const [tip, mcp] = map[finger];
  return isFingerCurled(lm[tip], lm[mcp]);
}

function bent(hand: HandData, finger: 'index' | 'middle' | 'ring' | 'pinky'): boolean {
  const lm = hand.landmarks;
  const map = { index: [8,7,5], middle: [12,11,9], ring: [16,15,13], pinky: [20,19,17] };
  const [tip, pip, mcp] = map[finger];
  return isFingerBent(lm[tip], lm[pip], lm[mcp]);
}

function thumbExt(hand: HandData): boolean {
  return isThumbExtended(hand.landmarks, hand.handedness === 'Right');
}

function thumbCurl(hand: HandData): boolean {
  return isThumbCurled(hand.landmarks);
}

function scale(hand: HandData): number {
  return handScale(hand.landmarks);
}

function touching(hand: HandData, tipA: number, tipB: number, threshold = 0.18): boolean {
  return tipsAreTouching(hand.landmarks[tipA], hand.landmarks[tipB], scale(hand), threshold);
}

// ─── Rules ─────────────────────────────────────────────────────────────────

export const LSCH_RULES: LschLetterRule[] = [
  {
    letter: 'A',
    description: 'Puño cerrado, pulgar al costado',
    detect: (h) => {
      const score =
        (curl(h, 'index')  ? 1 : 0) +
        (curl(h, 'middle') ? 1 : 0) +
        (curl(h, 'ring')   ? 1 : 0) +
        (curl(h, 'pinky')  ? 1 : 0) +
        (!thumbExt(h)      ? 0.5 : 0);
      return score / 4.5;
    }
  },
  {
    letter: 'B',
    description: 'Cuatro dedos extendidos, pulgar doblado',
    detect: (h) => {
      const score =
        (ext(h, 'index')  ? 1 : 0) +
        (ext(h, 'middle') ? 1 : 0) +
        (ext(h, 'ring')   ? 1 : 0) +
        (ext(h, 'pinky')  ? 1 : 0) +
        (thumbCurl(h)     ? 1 : 0);
      return score / 5;
    }
  },
  {
    letter: 'C',
    description: 'Mano curvada en forma de C',
    detect: (h) => {
      const lm = h.landmarks;
      const sc = scale(h);
      // All fingertips bend at medium level, not fully extended nor curled
      const allBent =
        (bent(h, 'index')  ? 1 : 0) +
        (bent(h, 'middle') ? 1 : 0) +
        (bent(h, 'ring')   ? 1 : 0) +
        (bent(h, 'pinky')  ? 1 : 0);
      // Thumb and index tip not touching
      const gap = distance2D(lm[4], lm[8]) > sc * 0.2 ? 1 : 0;
      return (allBent / 4 * 0.8 + gap * 0.2);
    }
  },
  {
    letter: 'D',
    description: 'Índice extendido, otros hacen círculo con pulgar',
    detect: (h) => {
      const score =
        (ext(h, 'index')   ? 1 : 0) +
        (curl(h, 'middle') ? 1 : 0) +
        (curl(h, 'ring')   ? 1 : 0) +
        (curl(h, 'pinky')  ? 1 : 0) +
        (touching(h, 4, 12, 0.22) ? 1 : 0);
      return score / 5;
    }
  },
  {
    letter: 'E',
    description: 'Todos los dedos doblados hacia palma',
    detect: (h) => {
      const score =
        (bent(h, 'index')  ? 1 : 0) +
        (bent(h, 'middle') ? 1 : 0) +
        (bent(h, 'ring')   ? 1 : 0) +
        (bent(h, 'pinky')  ? 1 : 0) +
        (thumbCurl(h)      ? 1 : 0);
      return score / 5;
    }
  },
  {
    letter: 'F',
    description: 'Índice y pulgar se tocan, otros extendidos',
    detect: (h) => {
      const score =
        (touching(h, 4, 8, 0.18) ? 1 : 0) +
        (ext(h, 'middle')         ? 1 : 0) +
        (ext(h, 'ring')           ? 1 : 0) +
        (ext(h, 'pinky')          ? 1 : 0);
      return score / 4;
    }
  },
  {
    letter: 'G',
    description: 'Índice apunta al costado, pulgar paralelo',
    detect: (h) => {
      const lm = h.landmarks;
      const indexPointsSide = Math.abs(lm[8].x - lm[5].x) > Math.abs(lm[8].y - lm[5].y);
      const score =
        (ext(h, 'index')   ? 1 : 0) +
        (curl(h, 'middle') ? 1 : 0) +
        (curl(h, 'ring')   ? 1 : 0) +
        (curl(h, 'pinky')  ? 1 : 0) +
        (indexPointsSide   ? 1 : 0);
      return score / 5;
    }
  },
  {
    letter: 'H',
    description: 'Índice y medio extendidos horizontalmente',
    detect: (h) => {
      const lm = h.landmarks;
      const horizontal =
        Math.abs(lm[8].x - lm[5].x) > Math.abs(lm[8].y - lm[5].y);
      const score =
        (ext(h, 'index')  ? 1 : 0) +
        (ext(h, 'middle') ? 1 : 0) +
        (curl(h, 'ring')  ? 1 : 0) +
        (curl(h, 'pinky') ? 1 : 0) +
        (horizontal       ? 1 : 0);
      return score / 5;
    }
  },
  {
    letter: 'I',
    description: 'Solo meñique extendido',
    detect: (h) => {
      const score =
        (curl(h, 'index')  ? 1 : 0) +
        (curl(h, 'middle') ? 1 : 0) +
        (curl(h, 'ring')   ? 1 : 0) +
        (ext(h, 'pinky')   ? 1 : 0) +
        (thumbCurl(h)      ? 0.5 : 0);
      return score / 4.5;
    }
  },
  {
    letter: 'J',
    description: 'Meñique extendido (con movimiento en J)',
    detect: (h) => {
      // Static shape igual que I; el movimiento se detecta en el servicio
      const score =
        (curl(h, 'index')  ? 1 : 0) +
        (curl(h, 'middle') ? 1 : 0) +
        (curl(h, 'ring')   ? 1 : 0) +
        (ext(h, 'pinky')   ? 1 : 0);
      return score / 4 * 0.7; // lower confidence since J==I without motion
    }
  },
  {
    letter: 'K',
    description: 'Índice y medio extendidos en V hacia arriba, pulgar entre ellos',
    detect: (h) => {
      const score =
        (ext(h, 'index')   ? 1 : 0) +
        (ext(h, 'middle')  ? 1 : 0) +
        (curl(h, 'ring')   ? 1 : 0) +
        (curl(h, 'pinky')  ? 1 : 0) +
        (!thumbCurl(h)     ? 1 : 0);
      return score / 5;
    }
  },
  {
    letter: 'L',
    description: 'Índice hacia arriba, pulgar extendido en L',
    detect: (h) => {
      const score =
        (ext(h, 'index')   ? 1 : 0) +
        (curl(h, 'middle') ? 1 : 0) +
        (curl(h, 'ring')   ? 1 : 0) +
        (curl(h, 'pinky')  ? 1 : 0) +
        (thumbExt(h)       ? 1 : 0);
      return score / 5;
    }
  },
  {
    letter: 'LL',
    description: 'L con meñique también extendido',
    detect: (h) => {
      const score =
        (ext(h, 'index')   ? 1 : 0) +
        (curl(h, 'middle') ? 1 : 0) +
        (curl(h, 'ring')   ? 1 : 0) +
        (ext(h, 'pinky')   ? 1 : 0) +
        (thumbExt(h)       ? 1 : 0);
      return score / 5;
    }
  },
  {
    letter: 'M',
    description: 'Tres dedos sobre el pulgar doblado',
    detect: (h) => {
      const lm = h.landmarks;
      const sc = scale(h);
      // Index, middle, ring bent and close to palm
      const threeBent =
        (bent(h, 'index')  ? 1 : 0) +
        (bent(h, 'middle') ? 1 : 0) +
        (bent(h, 'ring')   ? 1 : 0);
      const pinkyDown = curl(h, 'pinky') ? 1 : 0;
      // Thumb under fingers (tip near palm center)
      const thumbUnder = distance2D(lm[4], lm[9]) < sc * 0.4 ? 1 : 0;
      return (threeBent / 3 * 0.6 + pinkyDown * 0.2 + thumbUnder * 0.2);
    }
  },
  {
    letter: 'N',
    description: 'Dos dedos sobre el pulgar',
    detect: (h) => {
      const lm = h.landmarks;
      const sc = scale(h);
      const twoBent =
        (bent(h, 'index')  ? 1 : 0) +
        (bent(h, 'middle') ? 1 : 0);
      const othersDown =
        (curl(h, 'ring')   ? 1 : 0) +
        (curl(h, 'pinky')  ? 1 : 0);
      const thumbUnder = distance2D(lm[4], lm[9]) < sc * 0.4 ? 1 : 0;
      return (twoBent / 2 * 0.5 + othersDown / 2 * 0.3 + thumbUnder * 0.2);
    }
  },
  {
    letter: 'Ñ',
    description: 'N con meñique levantado',
    detect: (h) => {
      const lm = h.landmarks;
      const sc = scale(h);
      const twoBent =
        (bent(h, 'index')  ? 1 : 0) +
        (bent(h, 'middle') ? 1 : 0);
      const ringDown  = curl(h, 'ring')   ? 1 : 0;
      const pinkyUp   = ext(h, 'pinky')   ? 1 : 0;
      const thumbUnder = distance2D(lm[4], lm[9]) < sc * 0.4 ? 1 : 0;
      return (twoBent / 2 * 0.4 + ringDown * 0.2 + pinkyUp * 0.2 + thumbUnder * 0.2);
    }
  },
  {
    letter: 'O',
    description: 'Todos los dedos forman un círculo con el pulgar',
    detect: (h) => {
      const allTouching =
        (touching(h, 4, 8,  0.22) ? 1 : 0) +
        (touching(h, 4, 12, 0.22) ? 1 : 0) +
        (touching(h, 4, 16, 0.22) ? 1 : 0) +
        (touching(h, 4, 20, 0.22) ? 1 : 0);
      return allTouching / 4;
    }
  },
  {
    letter: 'P',
    description: 'Índice y medio apuntan hacia abajo, pulgar extendido',
    detect: (h) => {
      const lm = h.landmarks;
      const indexDown = lm[8].y > lm[5].y;
      const middleDown = lm[12].y > lm[9].y;
      const score =
        (indexDown  ? 1 : 0) +
        (middleDown ? 1 : 0) +
        (curl(h, 'ring')  ? 1 : 0) +
        (curl(h, 'pinky') ? 1 : 0) +
        (thumbExt(h)      ? 1 : 0);
      return score / 5;
    }
  },
  {
    letter: 'Q',
    description: 'Índice y pulgar apuntan hacia abajo formando círculo',
    detect: (h) => {
      const lm = h.landmarks;
      const indexDown = lm[8].y > lm[5].y;
      const touching04 = touching(h, 4, 8, 0.22);
      const score =
        (indexDown        ? 1 : 0) +
        (touching04       ? 1 : 0) +
        (curl(h, 'middle') ? 1 : 0) +
        (curl(h, 'ring')   ? 1 : 0) +
        (curl(h, 'pinky')  ? 1 : 0);
      return score / 5;
    }
  },
  {
    letter: 'R',
    description: 'Índice y medio cruzados',
    detect: (h) => {
      const lm = h.landmarks;
      // When crossed, index tip x is closer to middle base than its own base
      const crossed = Math.abs(lm[8].x - lm[9].x) < Math.abs(lm[8].x - lm[5].x) * 0.5;
      const score =
        (ext(h, 'index')   ? 1 : 0) +
        (ext(h, 'middle')  ? 1 : 0) +
        (curl(h, 'ring')   ? 1 : 0) +
        (curl(h, 'pinky')  ? 1 : 0) +
        (crossed           ? 1 : 0);
      return score / 5;
    }
  },
  {
    letter: 'RR',
    description: 'R con más separación / movimiento',
    detect: (h) => {
      const lm = h.landmarks;
      const separated = Math.abs(lm[8].x - lm[12].x) > handScale(h.landmarks) * 0.15;
      const score =
        (ext(h, 'index')  ? 1 : 0) +
        (ext(h, 'middle') ? 1 : 0) +
        (curl(h, 'ring')  ? 1 : 0) +
        (curl(h, 'pinky') ? 1 : 0) +
        (separated        ? 1 : 0);
      return score / 5 * 0.8;
    }
  },
  {
    letter: 'S',
    description: 'Puño cerrado con pulgar sobre dedos',
    detect: (h) => {
      const lm = h.landmarks;
      const fist =
        (curl(h, 'index')  ? 1 : 0) +
        (curl(h, 'middle') ? 1 : 0) +
        (curl(h, 'ring')   ? 1 : 0) +
        (curl(h, 'pinky')  ? 1 : 0);
      // Thumb tip over index middle phalanx
      const thumbOver = lm[4].y < lm[7].y && lm[4].x > lm[6].x && lm[4].x < lm[10].x;
      return (fist / 4 * 0.7 + (thumbOver ? 0.3 : 0));
    }
  },
  {
    letter: 'T',
    description: 'Pulgar entre índice y medio doblados',
    detect: (h) => {
      const lm = h.landmarks;
      const sc = scale(h);
      const indexBent  = bent(h, 'index');
      const middleBent = bent(h, 'middle');
      // Thumb tip between index and middle
      const thumbBetween =
        lm[4].x > lm[8].x && lm[4].x < lm[12].x &&
        distance2D(lm[4], lm[6]) < sc * 0.25;
      const score =
        (indexBent        ? 1 : 0) +
        (middleBent       ? 1 : 0) +
        (curl(h, 'ring')  ? 1 : 0) +
        (curl(h, 'pinky') ? 1 : 0) +
        (thumbBetween     ? 1 : 0);
      return score / 5;
    }
  },
  {
    letter: 'U',
    description: 'Índice y medio extendidos juntos hacia arriba',
    detect: (h) => {
      const lm = h.landmarks;
      const sc = scale(h);
      const together = distance2D(lm[8], lm[12]) < sc * 0.2;
      const score =
        (ext(h, 'index')   ? 1 : 0) +
        (ext(h, 'middle')  ? 1 : 0) +
        (curl(h, 'ring')   ? 1 : 0) +
        (curl(h, 'pinky')  ? 1 : 0) +
        (together          ? 1 : 0) +
        (thumbCurl(h)      ? 0.5 : 0);
      return score / 5.5;
    }
  },
  {
    letter: 'V',
    description: 'Índice y medio extendidos en V separados',
    detect: (h) => {
      const lm = h.landmarks;
      const sc = scale(h);
      const spread = distance2D(lm[8], lm[12]) > sc * 0.25;
      const score =
        (ext(h, 'index')   ? 1 : 0) +
        (ext(h, 'middle')  ? 1 : 0) +
        (curl(h, 'ring')   ? 1 : 0) +
        (curl(h, 'pinky')  ? 1 : 0) +
        (spread            ? 1 : 0);
      return score / 5;
    }
  },
  {
    letter: 'W',
    description: 'Índice, medio y anular extendidos separados',
    detect: (h) => {
      const lm = h.landmarks;
      const sc = scale(h);
      const spread = distance2D(lm[8], lm[16]) > sc * 0.35;
      const score =
        (ext(h, 'index')   ? 1 : 0) +
        (ext(h, 'middle')  ? 1 : 0) +
        (ext(h, 'ring')    ? 1 : 0) +
        (curl(h, 'pinky')  ? 1 : 0) +
        (spread            ? 1 : 0);
      return score / 5;
    }
  },
  {
    letter: 'X',
    description: 'Índice doblado en gancho',
    detect: (h) => {
      const score =
        (bent(h, 'index')  ? 1 : 0) +
        (curl(h, 'middle') ? 1 : 0) +
        (curl(h, 'ring')   ? 1 : 0) +
        (curl(h, 'pinky')  ? 1 : 0) +
        (thumbCurl(h)      ? 0.5 : 0);
      return score / 4.5;
    }
  },
  {
    letter: 'Y',
    description: 'Pulgar y meñique extendidos (cuernos)',
    detect: (h) => {
      const score =
        (thumbExt(h)       ? 1 : 0) +
        (curl(h, 'index')  ? 1 : 0) +
        (curl(h, 'middle') ? 1 : 0) +
        (curl(h, 'ring')   ? 1 : 0) +
        (ext(h, 'pinky')   ? 1 : 0);
      return score / 5;
    }
  },
  {
    letter: 'Z',
    description: 'Índice extendido (con movimiento en Z)',
    detect: (h) => {
      const score =
        (ext(h, 'index')   ? 1 : 0) +
        (curl(h, 'middle') ? 1 : 0) +
        (curl(h, 'ring')   ? 1 : 0) +
        (curl(h, 'pinky')  ? 1 : 0) +
        (thumbCurl(h)      ? 0.5 : 0);
      return score / 4.5 * 0.75;
    }
  },
];

// ─── Classifier ────────────────────────────────────────────────────────────

export function classifyLetter(hand: HandData): { letter: LschLetter; confidence: number } {
  let best: { letter: LschLetter; confidence: number } = { letter: 'UNKNOWN', confidence: 0 };

  for (const rule of LSCH_RULES) {
    const confidence = rule.detect(hand);
    if (confidence > best.confidence) {
      best = { letter: rule.letter, confidence };
    }
  }

  return best.confidence > 0.6 ? best : { letter: 'UNKNOWN', confidence: 0 };
}
