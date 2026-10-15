/**
 * Deterministic seeded RNG (mulberry32). The generator state is a single uint32 stored in the
 * match state, so cloning the state also clones the RNG.
 */
import type { MatchState } from './types';

export function nextRandom(s: { rng: number }): number {
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Integer in [0, n). */
export function randInt(s: MatchState | { rng: number }, n: number): number {
  return Math.floor(nextRandom(s) * n);
}

/** Standalone generator for non-simulation consumers (AI, VFX) that need their own stream. */
export class Rng {
  rng: number;
  constructor(seed: number) { this.rng = seed | 0; }
  next(): number { return nextRandom(this); }
  int(n: number): number { return Math.floor(this.next() * n); }
  range(a: number, b: number): number { return a + (b - a) * this.next(); }
  chance(p: number): boolean { return this.next() < p; }
  pick<T>(arr: readonly T[]): T { return arr[this.int(arr.length)]; }
}
