import { describe, it, expect } from "vitest";
import { CHARACTERS } from "../src/characters/data";
import {
  createMatch,
  step,
  resolveHit,
  startMove,
  activeBoxes,
  serialize,
  restore,
  selectMove,
} from "../src/core/sim";
import { NEUTRAL, IDS, bit, type RawInput } from "../src/core/types";
import { poll, createInput, trigger } from "../src/input/motions";
import { createBrain, cpu, queueMotion } from "../src/ai/cpu";
import { trialsFor } from "../src/scenes/trials";
import { hash } from "../src/utils/math";
describe("defense, movement and resource invariants", () => {
  it("Sable's teleport actually crosses the opponent and defeats the old guard direction", () => {
    const s = createMatch("sable", "hayate");
    s.phase = "fight";
    s.fighters[1].x = 650;
    startMove(s, 0, CHARACTERS.sable.moves.special1_0);
    for (let i = 0; i < 20; i++) step(s, [NEUTRAL, { x: 1, y: 1, buttons: 0 }]);
    expect(s.fighters[0].x).toBeGreaterThan(s.fighters[1].x);
    expect(s.fighters[1].hp).toBeLessThan(1000);
  });
  it("facing changes cannot reinterpret a held forward direction as guard", () => {
    const s = createMatch("sable", "hayate"),
      d = s.fighters[1];
    s.fighters[0].x = d.x + 60;
    poll(d.input, { x: 1, y: 0, buttons: 0 }, -1, 1);
    d.facing = 1;
    resolveHit(s, 0, CHARACTERS.sable.moves.stand_MP);
    expect(d.hp).toBeLessThan(1000);
  });
  it("links after full recovery into the final frame of hitstun", () => {
    const s = createMatch("hayate", "magnus");
    s.phase = "fight";
    s.fighters[1].x = 603;
    step(s, [{ ...NEUTRAL, buttons: bit("LP") }, NEUTRAL]);
    while (s.fighters[0].move) step(s, [NEUTRAL, NEUTRAL]);
    expect(s.fighters[0].combo).toBe(1);
    step(s, [{ ...NEUTRAL, buttons: bit("LP") }, NEUTRAL]);
    for (let i = 0; i < 5; i++) step(s, [NEUTRAL, NEUTRAL]);
    expect(s.fighters[0].combo).toBe(2);
  });
  it("generates the data-defined attack meter on a whiff", () => {
    const s = createMatch("hayate", "magnus");
    startMove(s, 0, CHARACTERS.hayate.moves.stand_LP);
    expect(s.fighters[0].meter).toBe(1);
  });
  it("cross-up block uses the attack origin rather than stale facing", () => {
    const s = createMatch("sable", "hayate"),
      d = s.fighters[1];
    s.fighters[0].x = d.x + 50;
    d.facing = -1;
    poll(d.input, { x: -1, y: 0, buttons: 0 }, d.facing, 1);
    resolveHit(s, 0, CHARACTERS.sable.moves.stand_MP);
    expect(d.hp).toBe(1000);
    expect(d.pose).toBe("block");
  });
  it("overhead breaks crouch guard and normal throws bypass guard", () => {
    const s = createMatch("hayate", "magnus"),
      d = s.fighters[1];
    poll(d.input, { x: 1, y: 1, buttons: 0 }, -1, 1);
    resolveHit(s, 0, CHARACTERS.hayate.moves.command);
    expect(d.hp).toBeLessThan(1160);
    const t = createMatch("hayate", "magnus");
    poll(t.fighters[1].input, { x: 1, y: 0, buttons: 0 }, -1, 1);
    resolveHit(t, 0, CHARACTERS.hayate.moves.throw);
    expect(t.fighters[1].downFrames).toBeGreaterThan(0);
  });
  it("command throws cannot be teched or started airborne", () => {
    const s = createMatch("magnus", "hayate"),
      d = s.fighters[1];
    poll(d.input, { x: 0, y: 0, buttons: bit("THROW") }, -1, 1);
    resolveHit(s, 0, CHARACTERS.magnus.moves.special0_0);
    expect(d.hp).toBeLessThan(1000);
    s.fighters[0].grounded = false;
    expect(startMove(s, 0, CHARACTERS.magnus.moves.special0_0)).toBe(false);
  });
  it("parry rewards timing and armor absorbs only one strike", () => {
    const s = createMatch("hayate", "magnus"),
      d = s.fighters[1];
    d.parry = 5;
    resolveHit(s, 0, CHARACTERS.hayate.moves.stand_HP);
    expect(d.hp).toBe(1160);
    expect(d.meter).toBe(30);
    d.invincible = 0;
    startMove(s, 1, CHARACTERS.magnus.moves.special2_0);
    d.moveFrame = 10;
    resolveHit(s, 0, CHARACTERS.hayate.moves.stand_HP);
    expect(d.armorHits).toBe(1);
    expect(d.move).toBe("special2_0");
    resolveHit(s, 0, CHARACTERS.hayate.moves.stand_HP);
    expect(d.move).toBe(null);
  });
  it("armor damage cannot create negative life or escape KO", () => {
    const s = createMatch("hayate", "magnus");
    s.phase = "fight";
    const d = s.fighters[1];
    startMove(s, 1, CHARACTERS.magnus.moves.special2_0);
    d.moveFrame = 10;
    d.hp = 1;
    resolveHit(s, 0, CHARACTERS.hayate.moves.stand_HP);
    expect(d.hp).toBe(0);
    s.hitstop = 0;
    step(s, [NEUTRAL, NEUTRAL]);
    expect(s.phase).toBe("ko");
  });
  it("pushblock spends half a stock and creates space", () => {
    const s = createMatch("hayate", "magnus"),
      d = s.fighters[1];
    d.meter = 100;
    d.x = 610;
    poll(d.input, { x: 1, y: 0, buttons: bit("EX") }, -1, 1);
    resolveHit(s, 0, CHARACTERS.hayate.moves.stand_MP);
    expect(d.meter).toBe(58);
    expect(s.fighters[0].x).toBeLessThan(450);
  });
  it("overdrive has an explicit cost, duration and damage risk", () => {
    const s = createMatch("hayate", "sable");
    s.phase = "fight";
    s.fighters[0].meter = 100;
    step(s, [{ ...NEUTRAL, buttons: bit("DRIVE") }, NEUTRAL]);
    expect(s.fighters[0].drive).toBe(420);
    expect(s.fighters[0].meter).toBe(0);
    expect(s.fighters[0].driveCooldown).toBe(600);
  });
  it("a recovered opponent starts a fresh combo rather than inheriting scaling", () => {
    const s = createMatch("hayate", "magnus");
    resolveHit(s, 0, CHARACTERS.hayate.moves.stand_LP);
    const first = s.fighters[0].comboDamage;
    s.fighters[1].stunFrames = 0;
    s.fighters[1].pose = "idle";
    resolveHit(s, 0, CHARACTERS.hayate.moves.stand_LP);
    expect(s.fighters[0].combo).toBe(1);
    expect(s.fighters[0].comboDamage).toBe(first);
  });
  it("juggle points cap repeated airborne hits", () => {
    const s = createMatch("hayate", "magnus"),
      d = s.fighters[1];
    d.grounded = false;
    d.juggle = 6;
    const hp = d.hp;
    expect(resolveHit(s, 0, CHARACTERS.hayate.moves.stand_MP)).toBe(false);
    expect(d.hp).toBe(hp);
  });
  it("dizzy breaks at zero stun and recovers on expiry", () => {
    const s = createMatch("hayate", "magnus");
    s.phase = "fight";
    s.fighters[1].stun = 1;
    resolveHit(s, 0, CHARACTERS.hayate.moves.stand_LP);
    expect(s.fighters[1].pose).toBe("dizzy");
    for (let n = 0; n < 170; n++) step(s, [NEUTRAL, NEUTRAL]);
    expect(s.fighters[1].stun).toBe(760);
  });
  it("hitting a dizzy fighter restores the gauge and enters ordinary hitstun", () => {
    const s = createMatch("hayate", "magnus");
    const d = s.fighters[1];
    d.pose = "dizzy";
    d.stun = 0;
    d.stunFrames = 140;
    const m = CHARACTERS.hayate.moves.stand_LP;
    resolveHit(s, 0, m);
    expect(d.pose).toBe("hit");
    expect(d.stunFrames).toBe(m.hitstun);
    expect(d.stun).toBeGreaterThan(0);
  });
  it("Sable double-jumps while other fighters remain limited to one jump", () => {
    for (const id of ["sable", "hayate"] as const) {
      const s = createMatch(id, "magnus");
      s.phase = "fight";
      for (let i = 0; i < 5; i++)
        step(s, [{ x: 0, y: -1, buttons: 0 }, NEUTRAL]);
      step(s, [NEUTRAL, NEUTRAL]);
      step(s, [{ x: 0, y: -1, buttons: 0 }, NEUTRAL]);
      expect(s.fighters[0].jumps).toBe(id === "sable" ? 2 : 1);
    }
  });
  it("pushboxes and wall transfer never move fighters beyond stage bounds", () => {
    const s = createMatch("hayate", "magnus");
    s.fighters[0].x = 1400;
    s.fighters[1].x = 1435;
    resolveHit(s, 0, CHARACTERS.hayate.moves.stand_HP);
    expect(s.fighters[1].x).toBe(1435);
    expect(s.fighters[0].x).toBeLessThan(1400);
  });
  it("buffers EX and crouch context through hitstop", () => {
    const s = createMatch("hayate", "magnus");
    s.phase = "fight";
    s.hitstop = 12;
    step(s, [{ x: 0, y: 1, buttons: bit("MP") }, NEUTRAL]);
    for (let i = 0; i < 12; i++) step(s, [NEUTRAL, NEUTRAL]);
    expect(s.fighters[0].lastMove).toBe("crouch_MP");
  });
  it("projectiles come from a bounded reusable pool", () => {
    const s = createMatch("hayate", "magnus");
    s.phase = "fight";
    const pool = s.projectiles;
    startMove(s, 0, CHARACTERS.hayate.moves.special0_0);
    for (let i = 0; i < 20; i++) step(s, [NEUTRAL, NEUTRAL]);
    expect(pool.filter((p) => p.active)).toHaveLength(1);
    expect(s.projectiles).toBe(pool);
    expect(pool).toHaveLength(32);
  });
  it("both life totals reaching zero resolves a double KO and eventual draw", () => {
    const s = createMatch("hayate", "magnus");
    s.phase = "fight";
    s.fighters.forEach((p) => (p.hp = 0));
    step(s, [NEUTRAL, NEUTRAL]);
    expect(s.roundWinner).toBe(-1);
    expect(s.events.at(-1)?.text).toBe("DOUBLE K.O.");
  });
  it("perfect is announced and timer freezes during hitstop", () => {
    const s = createMatch("hayate", "magnus");
    s.phase = "fight";
    s.hitstop = 10;
    const timer = s.timer;
    step(s, [NEUTRAL, NEUTRAL]);
    expect(s.timer).toBe(timer);
    s.hitstop = 0;
    s.fighters[1].hp = 0;
    step(s, [NEUTRAL, NEUTRAL]);
    let perfect = false;
    for (let n = 0; n < 75; n++) {
      step(s, [NEUTRAL, NEUTRAL]);
      if (s.events.some((e) => e.text === "PERFECT")) perfect = true;
    }
    expect(perfect).toBe(true);
  });
  it("complete recorded match reproduces state including rounds and events", () => {
    const a = createMatch("sable", "warden", 14, { timer: 4 }),
      b = restore(serialize(a)),
      brains = [createBrain(21, 2), createBrain(42, 2)];
    while (a.phase !== "complete") {
      const inputs: [RawInput, RawInput] = [
        cpu(a, 0, brains[0]),
        cpu(a, 1, brains[1]),
      ];
      step(a, inputs);
      step(b, inputs);
      expect(a.frame).toBeLessThan(5000);
    }
    expect(hash(a)).toBe(hash(b));
  });
});
describe("all twelve executable connected combo trials", () => {
  for (const id of IDS)
    for (const [index, trial] of trialsFor(id).entries())
      it(`${id} trial ${index + 1}`, () => {
        const s = createMatch(id, "hayate", 1, {
            mode: "trials",
            infiniteMeter: true,
          }),
          p = s.fighters[0],
          d = s.fighters[1];
        s.phase = "fight";
        p.x = 600;
        d.x = 663;
        p.meter = 300;
        let idx = 0,
          queue: RawInput[] = [],
          waiting = false;
        for (let frame = 0; frame < 500 && idx < trial.steps.length; frame++) {
          if (!waiting && !queue.length) {
            const m = CHARACTERS[id].moves[trial.steps[idx]];
            if (m.kind === "special") {
              const brain = createBrain();
              queueMotion(
                brain,
                id,
                Number(m.id[7]),
                1,
                m.strength === 3 ? 0 : m.strength,
                m.strength === 3,
              );
              queue = brain.queue;
            } else
              queue = [
                {
                  x: 0,
                  y: m.stance === "crouch" ? 1 : 0,
                  buttons: bit(m.button),
                },
                NEUTRAL,
              ];
            waiting = true;
          }
          step(s, [queue.shift() ?? NEUTRAL, NEUTRAL]);
          for (const e of s.events)
            if (
              e.type === "hit" &&
              e.player === 1 &&
              p.lastMove === trial.steps[idx]
            ) {
              idx++;
              expect(p.combo).toBeGreaterThanOrEqual(idx);
              waiting = false;
              queue = [];
            }
        }
        expect(idx).toBe(trial.steps.length);
      });
});
