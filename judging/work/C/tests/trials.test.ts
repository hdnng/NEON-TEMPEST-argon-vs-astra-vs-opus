/**
 * Every combo trial must be achievable: a scripted player performs each step through the real
 * input system (motions rolled frame by frame, charges held, cancels buffered during hitstop,
 * links pressed on recovery) and the resulting hit sequence must match the trial in one combo.
 */
import { describe, expect, it } from 'vitest';
import { CHARACTER_LIST } from '../src/data/characters';
import type { CharacterDef, MoveDef, TrialDef } from '../src/data/schema';
import { DOWN, HK, HP, LEFT, LK, LP, MK, MP, RIGHT, UP } from '../src/sim/input';
import { createMatch, defaultConfig, stepMatch } from '../src/sim/match';
import { getMove, idMatches, moveTotal } from '../src/sim/registry';
import { FP, type MatchState } from '../src/sim/types';

const BTN: Record<string, number> = { LP, MP, HP, LK, MK, HK };
const SEQ: Record<string, number[]> = {
  qcf: [2, 3, 6], qcb: [2, 1, 4], dp: [6, 2, 3], hcf: [4, 1, 2, 3, 6], hcb: [6, 3, 2, 1, 4],
  '360': [6, 3, 2, 1, 4, 7, 8], qcf2: [2, 3, 6, 2, 3, 6], qcb2: [2, 1, 4, 2, 1, 4],
  chargeBF: [6], chargeDU: [8], chargeBFBF: [6, 4, 6],
};

/** Absolute bits for a numpad direction when facing right. */
function dir(n: number): number {
  let b = 0;
  if (n >= 7) b |= UP;
  if (n <= 3) b |= DOWN;
  const c = (n - 1) % 3;
  if (c === 0) b |= LEFT;
  if (c === 2) b |= RIGHT;
  return b;
}

function resolve(ch: CharacterDef, id: string): MoveDef {
  for (const cand of [id, `${id}_M`, `${id}_L`, `${id}_H`]) {
    const m = ch.moves.find((x) => x.id === cand);
    if (m) return m;
  }
  throw new Error(`no move ${id}`);
}

function framesFor(m: MoveDef, charge: boolean): number[] {
  const r = m.input;
  let btn = 0;
  if (r.btn) btn = BTN[r.btn];
  else if (r.anyOf) btn = r.anyOf === 'P' ? HP : HK;
  else if (r.two) btn = r.two === 'P' ? LP | MP : LK | MK;
  if (r.motion) {
    const seq = SEQ[r.motion];
    const out: number[] = [];
    for (let i = 0; i < seq.length - 1; i++) out.push(dir(seq[i]), dir(seq[i]));
    const last = seq[seq.length - 1];
    out.push(dir(last) | btn, dir(last) | btn);
    return out;
  }
  let d = 5;
  if (r.dirs) d = r.dirs.includes(5) ? 5 : r.dirs.includes(2) ? 2 : r.dirs[0];
  if (charge && r.dirs) d = r.dirs.includes(1) ? 1 : r.dirs.includes(4) ? 4 : d;
  if (m.stance === 'air') d = r.dirs ? r.dirs[0] : 5;
  return [dir(d) | btn, dir(d) | btn];
}

function runTrial(ch: CharacterDef, trial: TrialDef): { hits: string[]; combo: number[]; done: boolean } {
  const s: MatchState = createMatch(defaultConfig({
    chars: [ch.id, 'hayate'], skipIntro: true, training: true, roundTime: 0,
    trainingOpts: { infiniteHp: true, infiniteMeter: true, noStun: true },
  }));
  const moves = trial.steps.map((st) => resolve(ch, st.move));
  const charge = moves.some((m) => m.input.motion?.startsWith('charge'));
  const jumpIn = moves[0].stance === 'air';
  s.fighters[0].x = (jumpIn ? -170 : -55) * FP;
  s.fighters[1].x = 45 * FP;
  const rest = charge ? dir(1) : 0;
  const hits: string[] = [];
  const combo: number[] = [];
  let step = 0;
  let pending: number[] = [];
  let waitContact = false;
  let lastHitStep = -1;
  const p = s.fighters[0];
  // pre-charge
  for (let i = 0; i < 50; i++) stepMatch(s, [charge ? dir(1) : 0, 0]);
  if (jumpIn) pending = [dir(9), dir(9), dir(9), dir(9), dir(9)];
  for (let f = 0; f < 600 && step <= moves.length; f++) {
    let bits = rest;
    if (pending.length) bits = pending.shift()!;
    else if (step < moves.length) {
      const m = moves[step];
      if (step === 0) {
        if (m.stance === 'air') {
          const dy = p.y / FP;
          if (p.state === 'air' && p.vy < 0 && dy < 40 + m.startup * 14) { pending = framesFor(m, charge); step++; waitContact = true; }
        } else { pending = framesFor(m, charge); step++; waitContact = true; }
      } else {
        const prev = moves[step - 1];
        const isCancel = m.type !== 'normal' || (prev.chainTo?.includes(m.id) ?? false);
        if (isCancel && lastHitStep === step - 1 && p.state === 'attack') { pending = framesFor(m, charge); step++; }
        else if (!isCancel && lastHitStep === step - 1 && (p.state === 'idle' || p.state === 'crouch' ||
          (p.state === 'attack' && p.move === prev.id && p.hitstop === 0 && moveTotal(prev) - p.mf <= 2))) {
          // links: press during the last recovery frames (the input buffer carries it)
          pending = framesFor(m, charge); step++;
        } else if (prev.stance === 'air' && lastHitStep === step - 1 && p.state === 'land') {
          // queue the follow-up slightly early (buffered through landing)
          pending = framesFor(m, charge); step++;
        }
      }
      if (pending.length) bits = pending.shift()!;
    }
    stepMatch(s, [bits, 0]);
    for (const e of s.events) {
      if (e.t === 'hitMove' && e.p === 0) {
        hits.push(e.k);
        combo.push(e.v);
        const idx = hits.length - 1;
        if (idx < moves.length && idMatches(e.k, trial.steps[idx].move)) lastHitStep = idx;
      }
    }
    if (step >= moves.length && !pending.length && hits.length >= moves.length) break;
    void waitContact;
  }
  // each step must hit, in order, as consecutive hits of ONE combo (victim combo count 1, 2, 3...)
  const done = hits.length >= trial.steps.length && trial.steps.every((st, i) => idMatches(hits[i], st.move) && (i === 0 || combo[i] > combo[i - 1]));
  return { hits, combo, done };
}

describe('combo trials are achievable', () => {
  for (const ch of CHARACTER_LIST) {
    for (const trial of ch.trials) {
      it(`${ch.name}: ${trial.name}`, () => {
        for (const st of trial.steps) expect(resolve(ch, st.move)).toBeTruthy();
        const r = runTrial(ch, trial);
        expect(r.hits.slice(0, trial.steps.length), `hits: ${r.hits.join(', ')}`).toHaveLength(trial.steps.length);
        expect(r.done, `hits: ${r.hits.join(', ')} combo: ${r.combo.join(',')}`).toBe(true);
      });
    }
  }
  it('every character has at least 3 trials', () => {
    for (const ch of CHARACTER_LIST) expect(ch.trials.length).toBeGreaterThanOrEqual(3);
  });
  void getMove;
});
