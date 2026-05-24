import { Landmark } from '../interfaces/hand-tracking.interface';

export function distance(a: Landmark, b: Landmark): number {
  return Math.sqrt(
    Math.pow(a.x - b.x, 2) +
    Math.pow(a.y - b.y, 2) +
    Math.pow(a.z - b.z, 2)
  );
}

export function distance2D(a: Landmark, b: Landmark): number {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}

/** Finger extended: tip is above (lower Y) than the PIP joint */
export function isFingerExtended(tip: Landmark, pip: Landmark, mcp: Landmark): boolean {
  const handHeight = distance2D(mcp, tip);
  return tip.y < pip.y - handHeight * 0.05;
}

/** Finger fully curled: tip is below the MCP joint */
export function isFingerCurled(tip: Landmark, mcp: Landmark): boolean {
  return tip.y > mcp.y;
}

/** Finger bent (between extended and curled) */
export function isFingerBent(tip: Landmark, pip: Landmark, mcp: Landmark): boolean {
  return !isFingerExtended(tip, pip, mcp) && !isFingerCurled(tip, mcp);
}

/** Thumb extended: compares tip X relative to IP joint, accounts for handedness */
export function isThumbExtended(landmarks: Landmark[], isRightHand: boolean): boolean {
  const tip = landmarks[4];
  const ip  = landmarks[3];
  const mcp = landmarks[2];
  return isRightHand ? tip.x < ip.x - distance2D(ip, mcp) * 0.1
                     : tip.x > ip.x + distance2D(ip, mcp) * 0.1;
}

export function isThumbCurled(landmarks: Landmark[]): boolean {
  const tip = landmarks[4];
  const mcp = landmarks[2];
  return distance2D(tip, mcp) < distance2D(landmarks[3], mcp) * 0.7;
}

/** Normalized hand size (wrist to middle MCP) used to scale thresholds */
export function handScale(landmarks: Landmark[]): number {
  return distance2D(landmarks[0], landmarks[9]);
}

/** Angle in degrees between three landmarks (b is vertex) */
export function angleDeg(a: Landmark, b: Landmark, c: Landmark): number {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const mag = Math.sqrt((ab.x ** 2 + ab.y ** 2) * (cb.x ** 2 + cb.y ** 2));
  return mag === 0 ? 0 : Math.acos(Math.max(-1, Math.min(1, dot / mag))) * (180 / Math.PI);
}

/** Whether two fingertips are touching (distance < threshold * handScale) */
export function tipsAreTouching(a: Landmark, b: Landmark, scale: number, threshold = 0.18): boolean {
  return distance2D(a, b) < scale * threshold;
}
