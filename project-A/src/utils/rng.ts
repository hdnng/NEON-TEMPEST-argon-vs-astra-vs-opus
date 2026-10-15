/**
 * Deterministic seeded PRNG (Mulberry32 / Xorshift32 hybrid) and state hashing utilities.
 * Ensures identical input sequences produce bit-identical simulation states.
 */

export function nextRandom(seed: number): { value: number; nextSeed: number } {
  let t = (seed + 0x6d2b79f5) | 0;
  const nextSeed = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, nextSeed };
}

export class SeededRNG {
  public seed: number;

  constructor(seed = 0x1337beef) {
    this.seed = seed | 0;
  }

  next(): number {
    const res = nextRandom(this.seed);
    this.seed = res.nextSeed;
    return res.value;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  int(min: number, maxInclusive: number): number {
    return Math.floor(this.range(min, maxInclusive + 0.999999));
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }
}

/**
 * FNV-1a 32-bit hash over JSON-serialized deterministic game state.
 */
export function hashString(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function hashState(state: unknown): string {
  const json = JSON.stringify(state);
  return hashString(json).toString(16).padStart(8, '0');
}
