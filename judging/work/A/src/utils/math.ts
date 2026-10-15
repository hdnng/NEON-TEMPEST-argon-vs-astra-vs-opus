/**
 * Math and geometry helpers for 2D combat simulation and rendering.
 */

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function clamp(val: number, min: number, max: number): number {
  return val < min ? min : val > max ? max : val;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Converts a fighter-relative box (where x is offset in facing direction from fighter.x,
 * and y is offset from ground/fighter.y where negative y is UP) into world-space AABB.
 */
export function toWorldBox(
  fighterX: number,
  fighterY: number,
  facing: 1 | -1,
  relBox: Box
): Box {
  const worldX = facing === 1 ? fighterX + relBox.x : fighterX - relBox.x - relBox.w;
  const worldY = fighterY + relBox.y;
  return {
    x: worldX,
    y: worldY,
    w: relBox.w,
    h: relBox.h
  };
}

export function boxesOverlap(a: Box, b: Box): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

export function boxIntersectionCenter(a: Box, b: Box): { x: number; y: number } {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  return {
    x: (x1 + x2) * 0.5,
    y: (y1 + y2) * 0.5
  };
}
