import { createFighter } from '../src/sim/fighter';
import { DOWN, LEFT, RIGHT, UP, pushInput } from '../src/sim/input';
import { createMatch, defaultConfig, stepMatch } from '../src/sim/match';
import type { FighterState, MatchConfig, MatchState, SimEvent } from '../src/sim/types';
import { FP } from '../src/sim/types';

export const N = 0;
export const U = UP, D = DOWN, L = LEFT, R = RIGHT;
export const DR = DOWN | RIGHT, DL = DOWN | LEFT, UR = UP | RIGHT, UL = UP | LEFT;

export function fighter(char = 'hayate'): FighterState {
  return createFighter(0, char, 0);
}

export function feed(f: FighterState, seq: number[]): void {
  for (const b of seq) pushInput(f, b);
}

export function rep(bits: number, n: number): number[] {
  return new Array(n).fill(bits);
}

/** Training-like match with no intro, no timer, configurable characters. */
export function match(chars: [string, string] = ['hayate', 'hayate'], extra: Partial<MatchConfig> = {}): MatchState {
  return createMatch(defaultConfig({ chars, skipIntro: true, roundTime: 99, ...extra }));
}

/** Steps until the fight phase begins. */
export function toFight(s: MatchState): void {
  let guard = 0;
  while (s.phase !== 'fight' && guard++ < 400) stepMatch(s, [0, 0]);
}

/** Runs input frames for both players; returns all events. */
export function run(s: MatchState, p1: number[], p2: number[] = []): SimEvent[] {
  const evs: SimEvent[] = [];
  const n = Math.max(p1.length, p2.length);
  for (let i = 0; i < n; i++) {
    stepMatch(s, [p1[i] ?? 0, p2[i] ?? 0]);
    evs.push(...s.events.map((e) => ({ ...e })));
  }
  return evs;
}

export function setPos(s: MatchState, x0: number, x1: number): void {
  s.fighters[0].x = x0 * FP;
  s.fighters[1].x = x1 * FP;
  s.fighters[0].facing = x0 < x1 ? 1 : -1;
  s.fighters[1].facing = x0 < x1 ? -1 : 1;
}
