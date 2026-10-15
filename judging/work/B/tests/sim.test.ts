import { describe, it, expect } from "vitest";
import {
  createInput,
  poll,
  motion,
  trigger,
  sequence,
} from "../src/input/motions";
import {
  createMatch,
  step,
  startMove,
  resolveHit,
  scaledDamage,
  addMeter,
  serialize,
  restore,
} from "../src/core/sim";
import { bit, NEUTRAL, IDS, type RawInput } from "../src/core/types";
import { CHARACTERS } from "../src/characters/data";
import { hash } from "../src/utils/math";
import { createBrain, cpu } from "../src/ai/cpu";
function input(d: number, buttons = 0): RawInput {
  return {
    x: [1, 4, 7].includes(d) ? -1 : [3, 6, 9].includes(d) ? 1 : 0,
    y: d < 4 ? 1 : d > 6 ? -1 : 0,
    buttons,
  };
}
describe("directional motion recognizer", () => {
  it("rejects out-of-order cardinals but accepts counterclockwise rotations", () => {
    const invalid = createInput();
    [2, 8, 4, 6].forEach((d, i) => poll(invalid, input(d), 1, i));
    expect(motion(invalid, "360")).toBe(false);
    const reverse = createInput();
    [4, 2, 6, 8].forEach((d, i) => poll(reverse, input(d), 1, i));
    expect(motion(reverse, "360")).toBe(true);
  });
  for (const [name, dirs] of Object.entries({
    QCF: [2, 3, 6],
    QCB: [2, 1, 4],
    DP: [6, 2, 3],
    HCF: [4, 1, 2, 3, 6],
    HCB: [6, 3, 2, 1, 4],
    "360": [6, 2, 4, 8],
    "2QCF": [2, 3, 6, 2, 3, 6],
  }))
    it(name, () => {
      const s = createInput();
      dirs.forEach((d, i) => poll(s, input(d), 1, i * 2));
      expect(motion(s, name)).toBe(true);
    });
  it.each(["BF", "DU"])(
    "charge %s requires 40 ticks and retains release for 8",
    (name) => {
      const s = createInput(),
        d = name === "BF" ? 4 : 2,
        to = name === "BF" ? 6 : 8;
      for (let i = 0; i < 39; i++) poll(s, input(d), 1, i);
      poll(s, input(to), 1, 39);
      expect(motion(s, name)).toBe(false);
      for (let i = 40; i < 81; i++) poll(s, input(d), 1, i);
      poll(s, input(to), 1, 81);
      expect(motion(s, name)).toBe(true);
      poll(s, input(to), 1, 90);
      expect(motion(s, name)).toBe(false);
    },
  );
  it("expires motion, buffers 6 frames, consumes and handles negative edge", () => {
    const s = createInput();
    [2, 3, 6].forEach((d, i) => poll(s, input(d), 1, i));
    poll(s, input(5, bit("LP")), 1, 3);
    expect(trigger(s, "LP")).toBe(true);
    poll(s, input(5), 1, 4);
    s.used = 3;
    expect(trigger(s, "LP")).toBe(false);
    expect(trigger(s, "LP", true)).toBe(true);
    poll(s, input(5), 1, 40);
    expect(motion(s, "QCF")).toBe(false);
    expect(trigger(s, "LP", true)).toBe(false);
  });
  it("mirrors direction and cleans neutral", () => {
    const s = createInput();
    poll(s, { x: -1, y: 0, buttons: 0 }, -1, 0);
    expect(s.history[0].dir).toBe(6);
    poll(s, NEUTRAL, 1, 1);
    expect(s.history[1].dir).toBe(5);
  });
});
describe("combat and rounds", () => {
  it("has complete frame data and every normal for all fighters", () => {
    for (const id of IDS) {
      const c = CHARACTERS[id];
      expect(Object.keys(c.moves).length).toBe(36);
      for (const m of Object.values(c.moves)) {
        expect(m.startup).toBeGreaterThan(0);
        expect(m.recovery).toBeGreaterThan(0);
        expect(m.hurtboxes.length).toBeGreaterThan(0);
      }
    }
  });
  it("startup cannot hit and active frames do, then recovers", () => {
    const s = createMatch("hayate", "warden");
    s.phase = "fight";
    s.fighters[1].x = 610;
    const m = CHARACTERS.hayate.moves.stand_LP;
    startMove(s, 0, m);
    for (let n = 0; n < m.startup - 1; n++) step(s, [NEUTRAL, NEUTRAL]);
    expect(s.fighters[1].hp).toBe(1000);
    step(s, [NEUTRAL, NEUTRAL]);
    expect(s.fighters[1].hp).toBeLessThan(1000);
    for (let i = 0; i < 60; i++) step(s, [NEUTRAL, NEUTRAL]);
    expect(s.fighters[0].move).toBe(null);
  });
  it("blocks mids, lows need crouch and overhead beats crouch", () => {
    const s = createMatch("hayate", "warden"),
      d = s.fighters[1];
    poll(d.input, { x: 1, y: 0, buttons: 0 }, -1, 1);
    resolveHit(s, 0, CHARACTERS.hayate.moves.stand_MP);
    expect(d.hp).toBe(1000);
    d.stunFrames = 0;
    d.pose = "idle";
    resolveHit(s, 0, CHARACTERS.hayate.moves.crouch_MK);
    expect(d.hp).toBeLessThan(1000);
  });
  it("throw tech separates fighters without damage", () => {
    const s = createMatch("hayate", "magnus");
    poll(s.fighters[1].input, input(5, bit("THROW")), -1, 1);
    expect(resolveHit(s, 0, CHARACTERS.hayate.moves.throw)).toBe(true);
    expect(s.fighters[1].hp).toBe(1160);
    expect(s.events.at(-1)?.type).toBe("tech");
  });
  it("combo scaling has a floor and meter clamps", () => {
    expect(scaledDamage(100, 2)).toBe(82);
    expect(scaledDamage(100, 20)).toBe(25);
    const p = createMatch("hayate", "sable").fighters[0];
    addMeter(p, 500);
    expect(p.meter).toBe(300);
    addMeter(p, -800);
    expect(p.meter).toBe(0);
  });
  it("EX cost and low-life ultimate requirements are enforced", () => {
    const s = createMatch("hayate", "sable");
    expect(startMove(s, 0, CHARACTERS.hayate.moves.special0_3)).toBe(false);
    s.fighters[0].meter = 150;
    expect(startMove(s, 0, CHARACTERS.hayate.moves.special0_3)).toBe(true);
    expect(s.fighters[0].meter).toBe(50);
    expect(startMove(s, 0, CHARACTERS.hayate.moves.ultimate)).toBe(false);
  });
  it("time over compares life percentage; equal scores draw", () => {
    const s = createMatch("hayate", "magnus");
    s.phase = "fight";
    s.timer = 1;
    step(s, [NEUTRAL, NEUTRAL]);
    expect(s.phase).toBe("ko");
    expect(s.roundWinner).toBe(-1);
    expect(s.fighters.map((f) => f.wins)).toEqual([1, 1]);
  });
  it("best of three completes after two wins", () => {
    const s = createMatch("hayate", "sable");
    for (let r = 0; r < 2; r++) {
      s.phase = "fight";
      s.fighters[1].hp = 0;
      step(s, [NEUTRAL, NEUTRAL]);
      for (let n = 0; n < 161; n++) step(s, [NEUTRAL, NEUTRAL]);
    }
    expect(s.phase).toBe("complete");
    expect(s.winner).toBe(0);
  });
  it("deterministic inputs and serialized continuation produce identical hashes", () => {
    const a = createMatch("hayate", "magnus", 91),
      b = restore(serialize(a)),
      brains = [createBrain(123, 2), createBrain(456, 2)];
    for (let i = 0; i < 3500; i++) {
      const inputs: [RawInput, RawInput] = [
        cpu(a, 0, brains[0]),
        cpu(a, 1, brains[1]),
      ];
      step(a, inputs);
      step(b, inputs);
    }
    expect(hash(a)).toBe(hash(b));
    expect(a.fighters.some((f) => f.damageDealt > 0)).toBe(true);
  });
});
