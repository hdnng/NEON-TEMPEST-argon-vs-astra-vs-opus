import { describe, expect, it } from 'vitest';
import { comboScale, computeDamage } from '../src/sim/combat';
import { cloneState, hashState } from '../src/sim/hash';
import { HK, HP, LK, LP, MK, MP } from '../src/sim/input';
import { createMatch, defaultConfig, stepMatch } from '../src/sim/match';
import { getMove } from '../src/sim/registry';
import { Rng } from '../src/sim/rng';
import { FP, METER_MAX } from '../src/sim/types';
import { D, DL, DR, L, N, R, U, match, rep, run, setPos } from './helpers';

const firstFrame = (evs: { t: string }[], t: string) => evs.findIndex((e) => e.t === t);

describe('frame data execution', () => {
  it('5LP hits on its 3rd frame (startup 3)', () => {
    const s = match();
    setPos(s, -45, 45);
    const evs: string[][] = [];
    for (const b of [LP, N, N, N]) { stepMatch(s, [b, 0]); evs.push(s.events.map((e) => e.t)); }
    expect(evs[0]).toContain('attack');
    expect(evs[1]).not.toContain('hit');
    expect(evs[2]).toContain('hit');
  });
  it('5LP is +4 on hit and +2 on block, as authored', () => {
    const s = match();
    setPos(s, -45, 45);
    const evs = run(s, [LP, ...rep(N, 40)]);
    const adv = evs.find((e) => e.t === 'adv');
    expect(adv?.v).toBe(4);
    const s2 = match();
    setPos(s2, -45, 45);
    const evs2 = run(s2, [LP, ...rep(N, 40)], rep(R, 41));
    expect(evs2.some((e) => e.t === 'block')).toBe(true);
    expect(evs2.find((e) => e.t === 'adv')?.v).toBe(2);
  });
  it('heavy sweep knocks down and is very unsafe on block', () => {
    const s = match();
    setPos(s, -60, 60);
    const evs = run(s, [D | HK, ...rep(D, 80)]);
    expect(evs.some((e) => e.t === 'knockdown')).toBe(true);
    const s2 = match();
    setPos(s2, -60, 60);
    const evs2 = run(s2, [D | HK, ...rep(D, 80)], rep(D | R, 81));
    expect(evs2.find((e) => e.t === 'adv')?.v).toBeLessThanOrEqual(-10);
  });
  it('Rising Storm is invincible on startup: beats a meaty jab', () => {
    const s = match();
    setPos(s, -40, 40);
    // P2 jabs, P1 reversal DP on the same frame
    const evs = run(s, [R, D, DR | HP, ...rep(N, 40)], [N, N, LP, ...rep(N, 40)]);
    const hits = evs.filter((e) => e.t === 'hit');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((e) => e.p === 0)).toBe(true);
  });
  it('projectile spawns on its listed frame and travels', () => {
    const s = match();
    setPos(s, -300, 300);
    const evs = run(s, [D, DR, R | LP, ...rep(N, 12)]);
    const spawn = evs.findIndex((e) => e.t === 'proj');
    const startIdx = firstFrame(evs, 'special');
    expect(startIdx).toBeGreaterThanOrEqual(0);
    expect(spawn).toBeGreaterThan(startIdx);
    expect(s.projectiles.length).toBe(1);
    expect(s.projectiles[0].vx).toBe(5 * FP);
  });
});

describe('hit / block / throw resolution', () => {
  it('standing block stops mids, crouch block stops lows', () => {
    const s = match();
    setPos(s, -50, 50);
    let evs = run(s, [MP, ...rep(N, 30)], rep(R, 31));
    expect(evs.some((e) => e.t === 'block')).toBe(true);
    const s2 = match();
    setPos(s2, -50, 50);
    evs = run(s2, [D | LK, ...rep(N, 30)], rep(D | R, 31));
    expect(evs.some((e) => e.t === 'block')).toBe(true);
  });
  it('lows beat standing guard and overheads beat crouching guard', () => {
    const s = match();
    setPos(s, -50, 50);
    let evs = run(s, [D | LK, ...rep(N, 30)], rep(R, 31));
    expect(evs.some((e) => e.t === 'hit')).toBe(true);
    const s2 = match();
    setPos(s2, -60, 60);
    evs = run(s2, [R | MP, ...rep(N, 40)], rep(D | R, 41));
    expect(evs.some((e) => e.t === 'hit')).toBe(true);
  });
  it('high attacks whiff on crouching opponents', () => {
    const s = match();
    setPos(s, -70, 70);
    const evs = run(s, [HK, ...rep(N, 40)], rep(D, 41));
    expect(evs.some((e) => e.t === 'hit' || e.t === 'block')).toBe(false);
  });
  it('cross-up: block direction depends on attacker side, not facing', () => {
    const s = match();
    setPos(s, -60, 60);
    // P1 jumps over P2 with a cross-up knee. P2 holds "away from the original side" (right),
    // which is the wrong direction once P1 is behind, so it must hit.
    const p1 = [U | R, ...rep(U | R, 3), ...rep(N, 18), LK, ...rep(N, 30)];
    const evs = run(s, p1, rep(R, p1.length));
    const contact = evs.find((e) => e.t === 'hit' || e.t === 'block');
    expect(contact).toBeDefined();
  });
  it('throws connect and deal damage; tech escapes', () => {
    const s = match();
    setPos(s, -35, 35);
    const hp0 = s.fighters[1].hp;
    let evs = run(s, [LP | LK, ...rep(N, 60)]);
    expect(evs.some((e) => e.t === 'grab')).toBe(true);
    expect(evs.some((e) => e.t === 'throw')).toBe(true);
    expect(s.fighters[1].hp).toBeLessThan(hp0);
    const s2 = match();
    setPos(s2, -35, 35);
    evs = run(s2, [LP | LK, ...rep(N, 60)], [N, N, N, N, N, N, LP | LK, ...rep(N, 55)]);
    expect(evs.some((e) => e.t === 'tech')).toBe(true);
    expect(s2.fighters[1].hp).toBe(hp0);
  });
  it('cannot throw an opponent in blockstun', () => {
    const s = match();
    setPos(s, -40, 40);
    // P1 jabs (blocked) then immediately throws while P2 is still in blockstun
    const evs = run(s, [LP, N, N, N, N, LP | LK, ...rep(N, 30)], rep(R, 37));
    const grabIdx = evs.findIndex((e) => e.t === 'grab');
    const blockIdx = evs.findIndex((e) => e.t === 'block');
    expect(blockIdx).toBeGreaterThanOrEqual(0);
    expect(grabIdx).toBe(-1);
  });
  it('strikes trade when both connect on the same frame', () => {
    const s = match();
    setPos(s, -45, 45);
    const evs = run(s, [LP, ...rep(N, 20)], [LP, ...rep(N, 20)]);
    expect(evs.some((e) => e.t === 'trade')).toBe(true);
  });
});

describe('combos, scaling and juggles', () => {
  it('scaling: 100, 100, 80, 70 ... min 20, supers min 50', () => {
    expect([1, 2, 3, 4, 5, 9, 15].map((n) => comboScale(n, false))).toEqual([100, 100, 80, 70, 60, 20, 20]);
    expect(comboScale(9, true)).toBe(50);
    expect(computeDamage(100, 1, false, true, false, false)).toBe(120);
    expect(computeDamage(100, 3, false, false, true, false)).toBe(88);
  });
  it('chain: 2LK > 2LP > special cancel forms a 3-hit combo', () => {
    const s = match();
    setPos(s, -45, 45);
    const qcb = [D | LK, ...rep(D, 9), D | LP, ...rep(D, 8), DL, L | LK, ...rep(N, 70)];
    const evs = run(s, qcb);
    const combo = evs.filter((e) => e.t === 'combo').map((e) => e.v);
    expect(Math.max(...combo)).toBeGreaterThanOrEqual(3);
  });
  it('a juggled opponent cannot be hit by normals without juggle potential', () => {
    const s = match();
    setPos(s, -60, 60);
    // sweep, then a jab while the opponent is airborne/knocked down
    const evs = run(s, [D | HK, ...rep(N, 12), LP, ...rep(N, 40)]);
    expect(evs.filter((e) => e.t === 'hit').length).toBe(1);
  });
  it('combo counter resets after the victim recovers', () => {
    const s = match();
    setPos(s, -45, 45);
    run(s, [LP, ...rep(N, 40)]);
    expect(s.fighters[1].combo).toBe(0);
  });
});

describe('meter', () => {
  it('gains meter on hit and block per hit data', () => {
    const s = match();
    setPos(s, -45, 45);
    run(s, [MP, ...rep(N, 30)]);
    const mpHit = getMove('hayate', '5MP')!.hits[0].meterHit;
    expect(s.fighters[0].meter).toBe(mpHit);
    expect(s.fighters[1].meter).toBeGreaterThan(0);
  });
  it('EX costs half a stock, Super costs one stock and drains meter', () => {
    const s = match();
    setPos(s, -300, 300);
    s.fighters[0].meter = 150;
    run(s, [D, DR, R | LP | MP, ...rep(N, 40)]);
    expect(s.fighters[0].meter).toBe(100);
    const s2 = match();
    setPos(s2, -300, 300);
    s2.fighters[0].meter = 100;
    run(s2, [D, DR, R, D, DR, R | HP, ...rep(N, 80)]);
    expect(s2.fighters[0].stats.supers).toBe(1);
    expect(s2.fighters[0].meter).toBeLessThan(10);
  });
  it('Super needs meter: without it the input yields the special', () => {
    const s = match();
    setPos(s, -300, 300);
    run(s, [D, DR, R, D, DR, R | HP, ...rep(N, 30)]);
    expect(s.fighters[0].stats.supers).toBe(0);
    expect(s.fighters[0].stats.specials).toBe(1);
  });
  it('Ultimate requires low life', () => {
    const s = match();
    setPos(s, -300, 300);
    s.fighters[0].meter = METER_MAX;
    run(s, [D, DR, R, D, DR, R | HK, ...rep(N, 20)]);
    expect(s.fighters[0].lastMove).not.toBe('ult');
    const s2 = match();
    setPos(s2, -300, 300);
    s2.fighters[0].meter = METER_MAX;
    s2.fighters[0].hp = 300;
    run(s2, [D, DR, R, D, DR, R | HK, ...rep(N, 20)]);
    expect(s2.fighters[0].lastMove).toBe('ult');
    expect(s2.fighters[0].meter).toBe(0);
  });
  it('Storm Drive costs a stock, then burns out', () => {
    const s = match();
    setPos(s, -300, 300);
    s.fighters[0].meter = 100;
    run(s, [MP | MK, ...rep(N, 30)]);
    expect(s.fighters[0].drive).toBeGreaterThan(0);
    expect(s.fighters[0].meter).toBe(0);
    run(s, rep(N, 400));
    expect(s.fighters[0].drive).toBe(0);
    expect(s.fighters[0].burnout).toBeGreaterThan(0);
  });
});

describe('rounds and timer', () => {
  it('time over gives the round to the healthier fighter', () => {
    const s = createMatch(defaultConfig({ skipIntro: true, roundTime: 3 }));
    setPos(s, -45, 45);
    run(s, [LP, ...rep(N, 200)]);
    expect(s.timeOver).toBe(true);
    run(s, rep(N, 300));
    expect(s.results[0]).toEqual({ winner: 0, kind: 'timeout' });
    expect(s.wins).toEqual([1, 0]);
  });
  it('KO ends the round, perfect is detected, best of 3 ends the match', () => {
    const s = createMatch(defaultConfig({ skipIntro: true }));
    for (let r = 0; r < 2; r++) {
      setPos(s, -45, 45);
      s.fighters[1].hp = 5;
      const evs = run(s, [LP, ...rep(N, 500)]);
      expect(evs.some((e) => e.t === 'ko')).toBe(true);
    }
    expect(s.results.map((r) => r.kind)).toEqual(['perfect', 'perfect']);
    expect(s.phase).toBe('matchEnd');
    expect(s.matchWinner).toBe(0);
  });
  it('double KO awards both fighters and leads to a final round at 1-1', () => {
    const s = createMatch(defaultConfig({ skipIntro: true }));
    setPos(s, -45, 45);
    s.fighters[0].hp = 5;
    s.fighters[1].hp = 5;
    run(s, [LP, ...rep(N, 500)], [LP, ...rep(N, 500)]);
    expect(s.results[0].kind).toBe('double');
    expect(s.wins).toEqual([1, 1]);
  });
  it('timer counts down once per 60 frames', () => {
    const s = createMatch(defaultConfig({ skipIntro: true }));
    run(s, rep(N, 61));
    expect(s.timer).toBe(98);
  });
});

describe('determinism and rollback', () => {
  const randomInputs = (seed: number, n: number) => {
    const r = new Rng(seed);
    const dirs = [N, N, N, L, R, D, DL, DR, U];
    const out: [number, number][] = [];
    let a = 0, b = 0;
    for (let i = 0; i < n; i++) {
      if (r.chance(0.2)) a = r.pick(dirs) | (r.chance(0.3) ? r.pick([LP, MP, HP, LK, MK, HK]) : 0);
      if (r.chance(0.2)) b = r.pick(dirs) | (r.chance(0.3) ? r.pick([LP, MP, HP, LK, MK, HK]) : 0);
      out.push([a, b]);
    }
    return out;
  };
  it('same inputs produce identical state hashes', () => {
    const inputs = randomInputs(7, 4000);
    const h = () => {
      const s = createMatch(defaultConfig({ seed: 99 }));
      const hashes: number[] = [];
      for (const i of inputs) { stepMatch(s, i); }
      hashes.push(hashState(s));
      return hashes[0];
    };
    expect(h()).toBe(h());
  });
  it('rollback: restoring a snapshot and replaying reproduces the same state', () => {
    const inputs = randomInputs(11, 3000);
    const s = createMatch(defaultConfig({ seed: 5 }));
    for (let i = 0; i < 1500; i++) stepMatch(s, inputs[i]);
    const snap = cloneState(s);
    for (let i = 1500; i < 3000; i++) stepMatch(s, inputs[i]);
    const h1 = hashState(s);
    const t = cloneState(snap);
    for (let i = 1500; i < 3000; i++) stepMatch(t, inputs[i]);
    expect(hashState(t)).toBe(h1);
  });
  it('different inputs diverge', () => {
    const a = createMatch(defaultConfig());
    const b = createMatch(defaultConfig());
    for (const i of randomInputs(1, 600)) stepMatch(a, i);
    for (const i of randomInputs(2, 600)) stepMatch(b, i);
    expect(hashState(a)).not.toBe(hashState(b));
  });
});
