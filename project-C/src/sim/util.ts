import type { Box } from '../data/schema';
import { FP, type FighterState, type MatchState } from './types';

/** Pixels (data units) to fixed-point. */
export const fx = (px: number): number => Math.round(px * FP);

export function ev(s: MatchState, t: string, p: number, x = 0, y = 0, k = '', v = 0): void {
  s.events.push({ t, p, x, y, k, v });
}

/** Axis-aligned box in world fixed-point coordinates. */
export interface WBox { l: number; r: number; b: number; t: number }

export function worldBox(x: number, y: number, facing: number, b: Box): WBox {
  const l = facing > 0 ? x + fx(b.x) : x - fx(b.x + b.w);
  const by = y + fx(b.y);
  return { l, r: l + fx(b.w), b: by, t: by + fx(b.h) };
}

export function overlaps(a: WBox, b: WBox): boolean {
  return a.l < b.r && b.l < a.r && a.b < b.t && b.b < a.t;
}

/** Center of the intersection of two overlapping boxes. */
export function contactPoint(a: WBox, b: WBox): { x: number; y: number } {
  const l = Math.max(a.l, b.l), r = Math.min(a.r, b.r);
  const bt = Math.max(a.b, b.b), t = Math.min(a.t, b.t);
  return { x: (l + r) >> 1, y: (bt + t) >> 1 };
}

export function inRange(v: number, r: [number, number] | undefined): boolean {
  return !!r && v >= r[0] && v <= r[1];
}

export function opponentOf(s: MatchState, f: FighterState): FighterState {
  return s.fighters[1 - f.idx];
}

/** Linear interpolation of keyframes {f, ...} by frame, for victim throw offsets. */
export function lerpKeys<T extends { f: number }>(keys: T[], frame: number, pick: (k: T) => number): number {
  if (frame <= keys[0].f) return pick(keys[0]);
  for (let i = 1; i < keys.length; i++) {
    if (frame <= keys[i].f) {
      const a = keys[i - 1], b = keys[i];
      const t = (frame - a.f) / (b.f - a.f);
      return pick(a) + (pick(b) - pick(a)) * t;
    }
  }
  return pick(keys[keys.length - 1]);
}
