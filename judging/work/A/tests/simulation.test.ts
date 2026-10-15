import { describe, expect, it } from 'vitest';
import {
  buildMotionSequence,
  buildRawInputFromNumpad,
  CpuController
} from '../src/ai/cpuController';
import {
  canBlockAttack,
  cloneMatchState,
  createMatchState,
  getFighterBoxes,
  stepMatch
} from '../src/core/simulation';
import { CHARACTERS } from '../src/data/characters';
import {
  checkButtonBuffered,
  checkDashInput,
  checkMotionInput,
  cleanSOCD,
  pushInputFrame
} from '../src/input/inputBuffer';
import { createEmptyInput } from '../src/input/inputManager';
import { hashState } from '../src/utils/rng';

describe('NEON TEMPEST — Core Simulation & Input Unit Tests', () => {
  it('cleans SOCD inputs properly (Left+Right=Neutral, Up+Down=Neutral)', () => {
    const cleaned = cleanSOCD({
      ...createEmptyInput(),
      left: true,
      right: true,
      up: true,
      down: true
    });
    expect(cleaned.dx).toBe(0);
    expect(cleaned.dy).toBe(0);
  });

  it('parses all motion inputs (QCF, QCB, DP, HCF, HCB, 360, DQCF, CHARGE_BF, CHARGE_DU) and negative edge', () => {
    const state = createMatchState({ p1Char: 'hayate', p2Char: 'magnus', skipIntro: true });
    const f = state.fighters[0];

    const testMotion = (
      motion: 'QCF' | 'QCB' | 'DP' | 'HCF' | 'HCB' | '360' | 'DQCF',
      seq: ReturnType<typeof buildMotionSequence>
    ) => {
      f.inputBuffer = [];
      let frame = 1;
      for (const raw of seq) {
        pushInputFrame(f, raw, frame++);
      }
      expect(checkMotionInput(f, motion)).toBe(true);
    };

    testMotion('QCF', buildMotionSequence('QCF', 1, { lp: true }));
    testMotion('QCB', buildMotionSequence('QCB', 1, { lk: true }));
    testMotion('DP', buildMotionSequence('DP', 1, { hp: true }));
    testMotion('HCF', buildMotionSequence('HCF', 1, { lp: true }));
    testMotion('HCB', buildMotionSequence('HCB', 1, { lk: true }));
    testMotion('360', buildMotionSequence('360', 1, { hp: true }));
    testMotion('DQCF', buildMotionSequence('DQCF', 1, { hp: true }));

    // Test Charge Back-Forward ([4]6) and Charge Down-Up ([2]8) with release grace
    f.inputBuffer = [];
    f.chargeBackFrames = 0;
    f.chargeDownFrames = 0;
    for (let i = 1; i <= 35; i++) {
      // Hold Down-Back (1) to charge both Back and Down simultaneously
      pushInputFrame(f, buildRawInputFromNumpad(1, 1), i);
    }
    // 3 frames of neutral within grace window
    pushInputFrame(f, buildRawInputFromNumpad(5, 1), 36);
    pushInputFrame(f, buildRawInputFromNumpad(5, 1), 37);
    // Press Forward (6)
    pushInputFrame(f, buildRawInputFromNumpad(6, 1, { lp: true }), 38);
    expect(checkMotionInput(f, 'CHARGE_BF')).toBe(true);

    // Press Up (8) within grace window
    pushInputFrame(f, buildRawInputFromNumpad(8, 1, { lk: true }), 39);
    expect(checkMotionInput(f, 'CHARGE_DU')).toBe(true);

    // Negative edge test: hold LP during motion, then release LP
    f.inputBuffer = [];
    pushInputFrame(f, buildRawInputFromNumpad(2, 1, { lp: true }), 1);
    pushInputFrame(f, buildRawInputFromNumpad(3, 1, { lp: true }), 2);
    pushInputFrame(f, buildRawInputFromNumpad(6, 1, { lp: false }), 3); // Released LP!
    expect(checkMotionInput(f, 'QCF')).toBe(true);
    expect(checkButtonBuffered(f.inputBuffer, 'LP', 6, true)).toBe(true);
  });

  it('detects forward and backward double-tap dash inputs', () => {
    const state = createMatchState({ p1Char: 'sable', p2Char: 'warden', skipIntro: true });
    const f = state.fighters[0];
    pushInputFrame(f, buildRawInputFromNumpad(6, 1), 1);
    pushInputFrame(f, buildRawInputFromNumpad(5, 1), 2);
    pushInputFrame(f, buildRawInputFromNumpad(6, 1), 3);
    expect(checkDashInput(f.inputBuffer)).toBe('forward');
  });

  it('executes move startup, active, and recovery frames accurately according to frame data', () => {
    const state = createMatchState({ p1Char: 'hayate', p2Char: 'magnus', skipIntro: true });
    const p1 = state.fighters[0];
    const moveDef = CHARACTERS.hayate.moves['5MP']; // startup 6, active 4, recovery 12 (total 22)

    // Trigger 5MP on frame 1
    stepMatch(state, buildRawInputFromNumpad(5, 1, { mp: true }), createEmptyInput());
    expect(p1.status).toBe('attack');
    expect(p1.currentMoveId).toBe('5MP');

    // Advance to active frames (moveFrame === 6)
    let activeFrameCount = 0;
    for (let i = 0; i < moveDef.totalFrames + 2; i++) {
      const boxes = getFighterBoxes(p1);
      if (boxes.hitboxes.length > 0) {
        activeFrameCount++;
      }
      stepMatch(state, createEmptyInput(), createEmptyInput());
    }
    expect(activeFrameCount).toBe(moveDef.active);
    expect(p1.status).toBe('idle');
    expect(p1.currentMoveId).toBeNull();
  });

  it('resolves hits, high/low/overhead blocking, cross-ups, and throws with throw tech', () => {
    const state = createMatchState({ p1Char: 'hayate', p2Char: 'magnus', skipIntro: true });
    state.fighters[0].x = -40;
    state.fighters[1].x = 30;

    // 1. Standing block blocks high/mid/overhead, but gets hit by low (2LK)
    state.fighters[1].inputBuffer = [];
    pushInputFrame(state.fighters[1], buildRawInputFromNumpad(4, -1), 1);
    expect(canBlockAttack(state.fighters[1], state.fighters[0].x, 'mid').blocked).toBe(true);
    expect(canBlockAttack(state.fighters[1], state.fighters[0].x, 'overhead').blocked).toBe(true);
    expect(canBlockAttack(state.fighters[1], state.fighters[0].x, 'low').blocked).toBe(false);

    // 2. Crouching block blocks low/mid, but gets hit by overhead (6MP)
    pushInputFrame(state.fighters[1], buildRawInputFromNumpad(1, -1), 2);
    expect(canBlockAttack(state.fighters[1], state.fighters[0].x, 'low').blocked).toBe(true);
    expect(canBlockAttack(state.fighters[1], state.fighters[0].x, 'overhead').blocked).toBe(false);

    // 3. Throw Tech resolution
    const throwState = createMatchState({ p1Char: 'hayate', p2Char: 'magnus', skipIntro: true });
    throwState.fighters[0].x = -25;
    throwState.fighters[1].x = 25;

    // P1 inputs Throw (LP+LK)
    stepMatch(
      throwState,
      buildRawInputFromNumpad(5, 1, { lp: true, lk: true, throwMacro: true }),
      createEmptyInput()
    );
    for (let i = 0; i < 5; i++) {
      stepMatch(throwState, createEmptyInput(), createEmptyInput());
    }
    expect(throwState.fighters[1].status).toBe('thrown');

    // P2 inputs Throw within 7-frame tech window -> Throw Tech!
    stepMatch(
      throwState,
      createEmptyInput(),
      buildRawInputFromNumpad(5, -1, { lp: true, lk: true, throwMacro: true })
    );
    expect(throwState.fighters[1].status).toBe('idle');
    expect(throwState.fighters[1].hp).toBe(throwState.fighters[1].maxHp);
  });

  it('applies combo damage scaling and super meter math accurately', () => {
    const state = createMatchState({ p1Char: 'sable', p2Char: 'magnus', skipIntro: true });
    state.fighters[0].x = -30;
    state.fighters[1].x = 25;

    // Chain 2LK -> 2LP -> Viper Flurry
    stepMatch(state, buildRawInputFromNumpad(2, 1, { lk: true }), createEmptyInput());
    for (let i = 0; i < 4; i++) stepMatch(state, buildRawInputFromNumpad(2, 1), createEmptyInput());
    expect(state.fighters[1].comboCounter).toBe(1);
    expect(state.fighters[0].meter).toBeGreaterThan(0);

    // Cancel into 2LP
    stepMatch(state, buildRawInputFromNumpad(2, 1, { lp: true }), createEmptyInput());
    for (let i = 0; i < 5; i++) stepMatch(state, buildRawInputFromNumpad(2, 1), createEmptyInput());
    expect(state.fighters[1].comboCounter).toBe(2);
    expect(state.fighters[1].comboScaling).toBeCloseTo(0.9, 2);
  });

  it('resolves round timer and time-over winner accurately', () => {
    const state = createMatchState({ p1Char: 'hayate', p2Char: 'warden', skipIntro: true });
    state.roundTimerFrames = 2;
    state.fighters[0].hp = 900;
    state.fighters[1].hp = 500;

    stepMatch(state, createEmptyInput(), createEmptyInput());
    stepMatch(state, createEmptyInput(), createEmptyInput());

    expect(state.finishType).toBe('TIME_OVER');
    expect(state.winnerIndex).toBe(0);
    expect(state.p1RoundsWon).toBe(1);
  });

  it('guarantees strict determinism: identical input streams produce identical state hashes', () => {
    const runSimulation = () => {
      const state = createMatchState({
        p1Char: 'hayate',
        p2Char: 'sable',
        stageId: 'rooftop',
        seed: 0x99887766,
        skipIntro: true
      });
      const cpu1 = new CpuController('hard');
      const cpu2 = new CpuController('hard');

      for (let i = 0; i < 600; i++) {
        const in1 = cpu1.getInput(state, 0);
        const in2 = cpu2.getInput(state, 1);
        stepMatch(state, in1, in2);
      }
      return {
        hash: hashState(state),
        cloneHash: hashState(cloneMatchState(state))
      };
    };

    const runA = runSimulation();
    const runB = runSimulation();
    expect(runA.hash).toBe(runB.hash);
    expect(runA.hash).toBe(runA.cloneHash);
  });
});
