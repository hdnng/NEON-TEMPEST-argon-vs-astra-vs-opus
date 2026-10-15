import { describe, expect, it } from 'vitest';
import {
  BUFFER_SPECIAL, CHARGE_TIME, HP, LK, LP, MP, consume, detectDash, matchButtons, matchCombo, matchMotion, numpad,
  pressAge, socd,
} from '../src/sim/input';
import { D, DL, DR, L, N, R, U, UL, UR, feed, fighter, rep } from './helpers';

describe('SOCD cleaning and numpad', () => {
  it('cleans left+right to neutral and up+down to up', () => {
    expect(socd(L | R)).toBe(0);
    expect(socd(U | D)).toBe(U);
    expect(socd(U | D | L | R)).toBe(U);
    expect(socd(D | R | LP)).toBe(D | R | LP);
  });
  it('maps directions relative to facing', () => {
    expect(numpad(R, 1)).toBe(6);
    expect(numpad(R, -1)).toBe(4);
    expect(numpad(DR, 1)).toBe(3);
    expect(numpad(DR, -1)).toBe(1);
    expect(numpad(UL, 1)).toBe(7);
    expect(numpad(0, 1)).toBe(5);
    expect(numpad(L | R, 1)).toBe(5);
  });
});

describe('button presses and buffer', () => {
  it('detects a press and keeps it buffered for exactly BUFFER_SPECIAL frames', () => {
    const f = fighter();
    feed(f, [N, LP]);
    expect(pressAge(f, 'LP', BUFFER_SPECIAL)).toBe(0);
    feed(f, rep(N, BUFFER_SPECIAL));
    expect(pressAge(f, 'LP', BUFFER_SPECIAL)).toBe(BUFFER_SPECIAL);
    feed(f, [N]);
    expect(pressAge(f, 'LP', BUFFER_SPECIAL)).toBe(-1);
  });
  it('holding a button is not a new press', () => {
    const f = fighter();
    feed(f, [N, LP, LP, LP, LP, LP, LP, LP, LP]);
    expect(pressAge(f, 'LP', 4)).toBe(-1);
  });
  it('a consumed press cannot trigger again', () => {
    const f = fighter();
    feed(f, [N, LP, N]);
    const a = pressAge(f, 'LP', 6);
    expect(a).toBe(1);
    consume(f, 'LP', a);
    expect(pressAge(f, 'LP', 6)).toBe(-1);
  });
  it('negative edge counts releases only when requested', () => {
    const f = fighter();
    feed(f, [N, LP, LP, LP, LP, LP, LP, LP, LP, N]);
    expect(pressAge(f, 'LP', 3)).toBe(-1);
    expect(pressAge(f, 'LP', 3, true)).toBe(0);
  });
  it('matches two-button presses within the simultaneous window', () => {
    const f = fighter();
    feed(f, [N, LP, LP, LP | MP]);
    expect(matchButtons(f, ['LP', 'MP', 'HP'], 2, 6, false)?.btns.sort()).toEqual(['LP', 'MP']);
    const g = fighter();
    feed(g, [N, LP, LP, LP, LP, LP, LP | HP]);
    expect(matchButtons(g, ['LP', 'MP', 'HP'], 2, 6, false)).toBeNull();
  });
  it('matches exact combos (throw LP+LK) and rejects late partners', () => {
    const f = fighter();
    feed(f, [N, LP | LK]);
    expect(matchCombo(f, ['LP', 'LK'], 4)).not.toBeNull();
    const g = fighter();
    feed(g, [N, LP, LP, LP, LP, LP, LP | LK]);
    expect(matchCombo(g, ['LP', 'LK'], 4)).toBeNull();
  });
  it('prefers the strongest button when several are pressed on the same frame', () => {
    const f = fighter();
    feed(f, [N, LP | HP]);
    expect(matchButtons(f, ['LP', 'MP', 'HP'], 1, 4, false)?.btns).toEqual(['HP']);
  });
});

describe('motion inputs', () => {
  it('QCF facing right and left', () => {
    const f = fighter();
    feed(f, [N, D, DR, R | LP]);
    expect(matchMotion(f, 'qcf', 0)).toBe(0);
    const g = fighter();
    g.facing = -1;
    feed(g, [N, D, DL, L | LP]);
    expect(matchMotion(g, 'qcf', 0)).toBe(0);
  });
  it('QCF fails when performed too slowly', () => {
    const f = fighter();
    feed(f, [N, D, ...rep(N, 15), DR, R | LP]);
    expect(matchMotion(f, 'qcf', 0)).toBe(-1);
  });
  it('accepts the button shortly after the motion (leniency) but not too late', () => {
    const f = fighter();
    feed(f, [N, D, DR, R, ...rep(N, 6), LP]);
    expect(matchMotion(f, 'qcf', 0)).toBeGreaterThan(0);
    const g = fighter();
    feed(g, [N, D, DR, R, ...rep(N, 10), LP]);
    expect(matchMotion(g, 'qcf', 0)).toBe(-1);
  });
  it('QCB, DP and the 3-2-3 DP shortcut', () => {
    const f = fighter();
    feed(f, [N, D, DL, L | LK]);
    expect(matchMotion(f, 'qcb', 0)).toBe(0);
    const g = fighter();
    feed(g, [N, R, D, DR | LP]);
    expect(matchMotion(g, 'dp', 0)).toBe(0);
    const h = fighter();
    feed(h, [N, DR, D, DR | LP]);
    expect(matchMotion(h, 'dp', 0)).toBe(0);
  });
  it('HCF / HCB', () => {
    const f = fighter();
    feed(f, [N, L, DL, D, DR, R | LP]);
    expect(matchMotion(f, 'hcf', 0)).toBe(0);
    const g = fighter();
    feed(g, [N, R, DR, D, DL, L | LP]);
    expect(matchMotion(g, 'hcb', 0)).toBe(0);
  });
  it('360 in either rotation, including the up-direction from prejump', () => {
    const f = fighter();
    feed(f, [N, R, DR, D, DL, L, UL, U | LP]);
    expect(matchMotion(f, '360', 0)).toBe(0);
    const g = fighter();
    feed(g, [N, L, DL, D, DR, R, UR | HP]);
    expect(matchMotion(g, '360', 0)).toBe(0);
    const h = fighter();
    feed(h, [N, R, DR, D, DL, L | LP]); // no up: not a 360
    expect(matchMotion(h, '360', 0)).toBe(-1);
  });
  it('double QCF for supers', () => {
    const f = fighter();
    feed(f, [N, D, DR, R, D, DR, R | LP]);
    expect(matchMotion(f, 'qcf2', 0)).toBe(0);
    const g = fighter();
    feed(g, [N, D, DR, R | LP]);
    expect(matchMotion(g, 'qcf2', 0)).toBe(-1);
  });
  it('charge back-forward requires a full charge', () => {
    const f = fighter();
    feed(f, [...rep(L, CHARGE_TIME + 2), R | LP]);
    expect(matchMotion(f, 'chargeBF', 0)).toBe(0);
    const g = fighter();
    feed(g, [...rep(L, CHARGE_TIME - 10), R | LP]);
    expect(matchMotion(g, 'chargeBF', 0)).toBe(-1);
  });
  it('down-back charges both back and down', () => {
    const f = fighter();
    feed(f, [...rep(DL, CHARGE_TIME + 2), R | LP]);
    expect(matchMotion(f, 'chargeBF', 0)).toBe(0);
    const g = fighter();
    feed(g, [...rep(DL, CHARGE_TIME + 2), U | LK]);
    expect(matchMotion(g, 'chargeDU', 0)).toBe(0);
  });
  it('charge release window expires', () => {
    const f = fighter();
    feed(f, [...rep(L, CHARGE_TIME + 2), ...rep(N, 12), R | LP]);
    expect(matchMotion(f, 'chargeBF', 0)).toBe(-1);
    const g = fighter();
    feed(g, [...rep(L, CHARGE_TIME + 2), R, R, R, R | LP]);
    expect(matchMotion(g, 'chargeBF', 0)).toBeGreaterThanOrEqual(0);
  });
  it('charge super back, forward, back, forward', () => {
    const f = fighter();
    feed(f, [...rep(L, CHARGE_TIME + 2), R, R, L, L, R | LP]);
    expect(matchMotion(f, 'chargeBFBF', 0)).toBe(0);
    const g = fighter();
    feed(g, [...rep(N, CHARGE_TIME + 2), R, R, L, L, R | LP]);
    expect(matchMotion(g, 'chargeBFBF', 0)).toBe(-1);
  });
});

describe('dash detection', () => {
  it('detects forward and back double taps', () => {
    const f = fighter();
    feed(f, [N, R, N, R]);
    expect(detectDash(f)).toBe(1);
    const g = fighter();
    feed(g, [N, L, L, N, N, L]);
    expect(detectDash(g)).toBe(-1);
  });
  it('rejects slow taps and held directions', () => {
    const f = fighter();
    feed(f, [N, R, ...rep(N, 14), R]);
    expect(detectDash(f)).toBe(0);
    const g = fighter();
    feed(g, [N, R, R, R, R]);
    expect(detectDash(g)).toBe(0);
  });
});
