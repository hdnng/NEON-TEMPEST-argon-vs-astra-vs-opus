/**
 * Simulation-side input interpretation: button bits, SOCD cleaning, numpad directions,
 * press/release detection with buffering, motion inputs (incl. charge and 360) and dashes.
 *
 * Each fighter keeps a ring buffer of the absolute input bits of the last HISTORY frames.
 * Directions are converted to numpad notation relative to the fighter's CURRENT facing.
 */
import type { Btn, BtnGroup, MotionId } from '../data/schema';
import { HISTORY, type FighterState } from './types';

export const UP = 1, DOWN = 2, LEFT = 4, RIGHT = 8;
export const LP = 16, MP = 32, HP = 64, LK = 128, MK = 256, HK = 512;
export const DIR_MASK = 15;
export const BTN_MASK = 1008;
export const BTN_BITS: Record<Btn, number> = { LP, MP, HP, LK, MK, HK };
export const BTN_ORDER: Btn[] = ['LP', 'MP', 'HP', 'LK', 'MK', 'HK'];
export const GROUP_BTNS: Record<BtnGroup, Btn[]> = { P: ['LP', 'MP', 'HP'], K: ['LK', 'MK', 'HK'] };

/** Frames a button press stays buffered for specials / supers. */
export const BUFFER_SPECIAL = 6;
/** Frames a button press stays buffered for normals. */
export const BUFFER_NORMAL = 4;
/** Max frames between the presses of a multi-button input. */
export const SIMUL_WINDOW = 3;
/** Max frames between the final direction of a motion and the button press. */
export const MOTION_FINAL_LENIENCY = 8;
/** Frames a charge must be held. */
export const CHARGE_TIME = 40;
/** Frames after releasing a charge during which the forward/up input is accepted. */
export const CHARGE_RELEASE_WINDOW = 10;
/** Window between the two taps of a dash. */
export const DASH_WINDOW = 12;

/** SOCD cleaning: left+right = neutral, up+down = up. */
export function socd(bits: number): number {
  if ((bits & LEFT) && (bits & RIGHT)) bits &= ~(LEFT | RIGHT);
  if ((bits & UP) && (bits & DOWN)) bits &= ~DOWN;
  return bits;
}

/** Numpad direction (1-9) of absolute bits relative to facing (+1 = facing right). */
export function numpad(bits: number, facing: number): number {
  const up = (bits & UP) !== 0;
  const down = (bits & DOWN) !== 0;
  let fwd = false, back = false;
  if (facing > 0) { fwd = (bits & RIGHT) !== 0; back = (bits & LEFT) !== 0; }
  else { fwd = (bits & LEFT) !== 0; back = (bits & RIGHT) !== 0; }
  if (fwd && back) { fwd = false; back = false; }
  const col = back ? 0 : fwd ? 2 : 1;
  const row = up ? 2 : down ? 0 : 1;
  return row * 3 + col + 1;
}

export const isBack = (d: number) => d === 1 || d === 4 || d === 7;
export const isFwd = (d: number) => d === 3 || d === 6 || d === 9;
export const isDown = (d: number) => d === 1 || d === 2 || d === 3;
export const isUp = (d: number) => d === 7 || d === 8 || d === 9;

/** Bits `age` frames ago (0 = this frame). */
export function histAt(f: FighterState, age: number): number {
  if (age >= HISTORY - 1 || age > f.frame) return 0;
  return f.hist[(f.frame - age + HISTORY * 4) % HISTORY];
}

export function dirAt(f: FighterState, age: number): number {
  return numpad(histAt(f, age), f.facing);
}

/** Whether the fighter was frozen (hitstop / super freeze) `age` frames ago. */
export function frozenAt(f: FighterState, age: number): boolean {
  if (age >= HISTORY - 1 || age > f.frame) return false;
  return f.fz[(f.frame - age + HISTORY * 4) % HISTORY] === 1;
}

/**
 * Records this frame's bits and updates charge counters. Call once per sim frame.
 * Frames spent frozen don't count against buffers or motion windows.
 */
export function pushInput(f: FighterState, bits: number, frozen = false): void {
  f.frame++;
  f.hist[f.frame % HISTORY] = socd(bits);
  f.fz[f.frame % HISTORY] = frozen ? 1 : 0;
  const d = numpad(f.hist[f.frame % HISTORY], f.facing);
  // Charge counters. `*Rel` counts frames since the last release; a recent longer charge is
  // kept when a short re-charge is released (needed for back-forward-back-forward supers).
  f.chargeBRel = Math.min(f.chargeBRel + 1, 999);
  f.chargeDRel = Math.min(f.chargeDRel + 1, 999);
  if (isBack(d)) f.chargeB++;
  else if (f.chargeB > 0) {
    if (f.chargeB >= f.chargeBAmt || f.chargeBRel > 24) f.chargeBAmt = f.chargeB;
    f.chargeBRel = 0;
    f.chargeB = 0;
  }
  if (isDown(d)) f.chargeD++;
  else if (f.chargeD > 0) {
    if (f.chargeD >= f.chargeDAmt || f.chargeDRel > 24) f.chargeDAmt = f.chargeD;
    f.chargeDRel = 0;
    f.chargeD = 0;
  }
}

/** Resets the input-related part of a fighter (round start). */
export function resetInput(f: FighterState): void {
  f.hist = new Array(HISTORY).fill(0);
  f.fz = new Array(HISTORY).fill(0);
  f.frame = 0;
  f.consumed = [-1, -1, -1, -1, -1, -1];
  f.chargeB = f.chargeD = 0;
  f.chargeBRel = f.chargeDRel = 999;
  f.chargeBAmt = f.chargeDAmt = 0;
}

/**
 * Age of the most recent unconsumed press (or release when negativeEdge) of a button within
 * `buffer` frames, or -1.
 */
export function pressAge(f: FighterState, btn: Btn, buffer: number, negativeEdge = false): number {
  const bit = BTN_BITS[btn];
  const bi = BTN_ORDER.indexOf(btn);
  // `eff` = unfrozen frames elapsed since age a (frozen frames don't age the buffer)
  let eff = 0;
  for (let a = 0; a < HISTORY - 2 && eff <= buffer; a++) {
    if (a > 0 && !frozenAt(f, a - 1)) eff++;
    if (eff > buffer) break;
    const now = histAt(f, a) & bit;
    const prev = histAt(f, a + 1) & bit;
    const pressed = now && !prev;
    const released = negativeEdge && !now && prev;
    if (pressed) {
      if (f.consumed[bi] === f.frame - a) return -1;
      return a;
    }
    if (released) {
      // a release only counts if the press that started this hold wasn't already used
      let p = a + 1;
      while (p < HISTORY - 2 && (histAt(f, p + 1) & bit)) p++;
      if (f.consumed[bi] === f.frame - p) return -1;
      return a;
    }
  }
  return -1;
}

/** Whether a button is currently held. */
export function held(f: FighterState, btn: Btn): boolean {
  return (histAt(f, 0) & BTN_BITS[btn]) !== 0;
}

export function consume(f: FighterState, btn: Btn, age: number): void {
  f.consumed[BTN_ORDER.indexOf(btn)] = f.frame - age;
}

/** Result of matching a button requirement: which buttons and the latest press age. */
export interface BtnMatch { btns: Btn[]; age: number }

/**
 * Finds `count` distinct buttons from `pool` pressed within the buffer and within
 * SIMUL_WINDOW frames of each other. Prefers the strongest buttons for single presses.
 */
export function matchButtons(
  f: FighterState, pool: Btn[], count: number, buffer: number, negativeEdge: boolean,
): BtnMatch | null {
  const ages: { b: Btn; a: number }[] = [];
  for (let i = pool.length - 1; i >= 0; i--) {
    const a = pressAge(f, pool[i], buffer, negativeEdge && count === 1);
    if (a >= 0) ages.push({ b: pool[i], a });
  }
  if (ages.length < count) return null;
  if (count === 1) {
    // strongest button wins ties; most recent otherwise
    let best = ages[0];
    for (const e of ages) if (e.a < best.a) best = e;
    return { btns: [best.b], age: best.a };
  }
  // need `count` presses within SIMUL_WINDOW of each other
  ages.sort((p, q) => p.a - q.a);
  for (let i = 0; i + count <= ages.length; i++) {
    if (ages[i + count - 1].a - ages[i].a <= SIMUL_WINDOW) {
      const pick = ages.slice(i, i + count);
      return { btns: pick.map((e) => e.b), age: pick[0].a };
    }
  }
  return null;
}

/** Exact simultaneous set (e.g. LP+LK). Allows one of them to already be held if pressed within window. */
export function matchCombo(f: FighterState, btns: Btn[], buffer: number): BtnMatch | null {
  let minA = 999, maxA = -1;
  for (const b of btns) {
    const a = pressAge(f, b, buffer + SIMUL_WINDOW);
    if (a < 0) return null;
    if (a < minA) minA = a;
    if (a > maxA) maxA = a;
  }
  if (minA > buffer) return null;
  if (maxA - minA > SIMUL_WINDOW) return null;
  // all must still be held at the moment of the latest press
  for (const b of btns) if (!(histAt(f, minA) & BTN_BITS[b])) return null;
  return { btns: btns.slice(), age: minA };
}

type Step = number[];
const SEQ: Partial<Record<MotionId, { steps: Step[]; window: number }>> = {
  qcf: { steps: [[2], [3], [6]], window: 16 },
  qcb: { steps: [[2], [1], [4]], window: 16 },
  dp: { steps: [[6], [2], [3]], window: 16 },
  rdp: { steps: [[4], [2], [1]], window: 16 },
  hcf: { steps: [[4], [1, 2], [2, 3], [6]], window: 22 },
  hcb: { steps: [[6], [3, 2], [2, 1], [4]], window: 22 },
  qcf2: { steps: [[2], [3], [6], [2], [3], [6]], window: 30 },
  qcb2: { steps: [[2], [1], [4], [2], [1], [4]], window: 30 },
  hcf2: { steps: [[4], [2], [6], [4], [2], [6]], window: 36 },
};

/** Alternate shortcut sequences accepted for some motions. */
const ALT: Partial<Record<MotionId, Step[][]>> = {
  dp: [[[3], [2], [3]]],
  rdp: [[[1], [2], [1]]],
};

function matchSeq(f: FighterState, steps: Step[], window: number, pressA: number): number {
  let s = steps.length - 1;
  let completeAge = -1;
  let eff = 0; // unfrozen frames between the press and age a
  for (let a = pressA; a < HISTORY - 2; a++) {
    if (a > pressA && !frozenAt(f, a - 1)) eff++;
    if (eff > window) break;
    const d = dirAt(f, a);
    if (steps[s].includes(d)) {
      if (s === steps.length - 1) completeAge = a;
      s--;
      if (s < 0) return completeAge;
    } else if (s === steps.length - 1 && eff > MOTION_FINAL_LENIENCY) {
      return -1;
    }
  }
  return -1;
}

/**
 * Checks whether `motion` was performed for a button pressed `pressA` frames ago.
 * Returns the age at which the motion completed (smaller = more recent) or -1.
 */
export function matchMotion(f: FighterState, motion: MotionId, pressA: number): number {
  const seq = SEQ[motion];
  if (seq) {
    let best = matchSeq(f, seq.steps, seq.window, pressA);
    const alts = ALT[motion];
    if (alts) {
      for (const alt of alts) {
        const r = matchSeq(f, alt, seq.window, pressA);
        if (r >= 0 && (best < 0 || r < best)) best = r;
      }
    }
    return best;
  }
  switch (motion) {
    case '360': return match360(f, pressA);
    case 'chargeBF': return matchCharge(f, 'B', pressA);
    case 'chargeDU': return matchCharge(f, 'D', pressA);
    case 'chargeBFBF': return matchChargeSuper(f, pressA);
  }
  return -1;
}

/** 360: pure back, down and forward plus any up-direction within 36 frames, any order. */
function match360(f: FighterState, pressA: number): number {
  let gotB = false, gotD = false, gotF = false, gotU = false;
  const maxAge = Math.min(pressA + 36, HISTORY - 2);
  for (let a = pressA; a <= maxAge; a++) {
    const d = dirAt(f, a);
    if (d === 4) gotB = true;
    if (d === 2) gotD = true;
    if (d === 6) gotF = true;
    if (isUp(d)) gotU = true;
    if (gotB && gotD && gotF && gotU) return pressA;
  }
  return -1;
}

/**
 * Charge motions: the charge must have been held CHARGE_TIME frames and released at most
 * CHARGE_RELEASE_WINDOW frames before the press, with the release direction seen since.
 */
function matchCharge(f: FighterState, kind: 'B' | 'D', pressA: number): number {
  const rel = kind === 'B' ? f.chargeBRel : f.chargeDRel;
  const amt = kind === 'B' ? f.chargeBAmt : f.chargeDAmt;
  // `rel` counts frames since release up to now; the press happened `pressA` frames ago.
  if (amt < CHARGE_TIME) return -1;
  if (rel < pressA - 1 || rel - pressA > CHARGE_RELEASE_WINDOW) return -1;
  // The release direction must be present between release and press.
  for (let a = pressA; a <= rel + 1 && a < HISTORY - 2; a++) {
    const d = dirAt(f, a);
    if (kind === 'B' ? isFwd(d) : isUp(d)) return a;
  }
  return -1;
}

/** Charge back, forward, back, forward + button (charge supers). */
function matchChargeSuper(f: FighterState, pressA: number): number {
  if (f.chargeBAmt < CHARGE_TIME) return -1;
  const rel = f.chargeBRel;
  if (rel < pressA - 1 || rel - pressA > CHARGE_RELEASE_WINDOW) return -1;
  return matchSeq(f, [[6, 3, 9], [4, 1, 7], [6, 3, 9]], 30, pressA);
}

/**
 * Dash detection: a fresh press of forward (or back) whose previous press was released and
 * re-pressed within DASH_WINDOW frames. Returns 1 forward, -1 back, 0 none.
 */
export function detectDash(f: FighterState): number {
  const d0 = dirAt(f, 0);
  const d1 = dirAt(f, 1);
  if (d0 === 6 && d1 !== 6) return tapBefore(f, 6) ? 1 : 0;
  if (d0 === 4 && d1 !== 4) return tapBefore(f, 4) ? -1 : 0;
  return 0;
}

function tapBefore(f: FighterState, dir: number): boolean {
  let sawNeutral = false;
  for (let a = 1; a <= DASH_WINDOW; a++) {
    const d = dirAt(f, a);
    if (d === dir) return sawNeutral;
    if (d === 5) sawNeutral = true;
    else return false;
  }
  return false;
}

/** Fresh press of an up direction this frame (for double jumps). */
export function upPressed(f: FighterState): boolean {
  return isUp(dirAt(f, 0)) && !isUp(dirAt(f, 1));
}

/** Count of fresh button presses this frame (dizzy mash). */
export function freshInputs(f: FighterState): number {
  const now = histAt(f, 0), prev = histAt(f, 1);
  let n = 0;
  const pressed = now & ~prev & BTN_MASK;
  for (let b = LP; b <= HK; b <<= 1) if (pressed & b) n++;
  if ((now & DIR_MASK) !== (prev & DIR_MASK)) n++;
  return n;
}
