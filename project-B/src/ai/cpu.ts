import {
  type RawInput,
  type SimState,
  NEUTRAL,
  bit,
  type FighterId,
} from "../core/types";
import { random } from "../utils/math";
import { CHARACTERS } from "../characters/data";
export interface Brain {
  seed: number;
  queue: RawInput[];
  wait: number;
  held: RawInput;
  difficulty: number;
  decisions: number;
}
export function createBrain(seed = 123, difficulty = 1): Brain {
  return {
    seed,
    queue: [],
    wait: 0,
    held: { ...NEUTRAL },
    difficulty,
    decisions: 0,
  };
}
function put(b: Brain, x: number, y: number, buttons = 0, frames = 1) {
  for (let i = 0; i < frames; i++) b.queue.push({ x, y, buttons });
}
export function queueMotion(
  b: Brain,
  id: FighterId,
  n: number,
  facing: number,
  strength = 1,
  ex = false,
) {
  const m = CHARACTERS[id].moves[`special${n}_0`].motion,
    f = facing;
  const dirs: Record<string, number[]> = {
    QCF: [2, 3, 6],
    QCB: [2, 1, 4],
    DP: [6, 2, 3],
    HCF: [4, 1, 2, 3, 6],
    HCB: [6, 3, 2, 1, 4],
    "360": [6, 2, 4, 8],
    BF: [4, 6],
    DU: [2, 8],
  };
  const ds = m === "BF" ? [1, 6] : (dirs[m] ?? [2, 3, 6]);
  ds.forEach((d, k) => {
    put(
      b,
      ([1, 4, 7].includes(d) ? -1 : [3, 6, 9].includes(d) ? 1 : 0) * f,
      d < 4 ? 1 : d > 6 ? -1 : 0,
      0,
      (m === "BF" || m === "DU") && k === 0 ? 43 : 2,
    );
  });
  const d = ds[ds.length - 1],
    key = (n === 2 ? ["LK", "MK", "HK"] : ["LP", "MP", "HP"])[strength] as "LP";
  put(
    b,
    ([1, 4, 7].includes(d) ? -1 : [3, 6, 9].includes(d) ? 1 : 0) * f,
    d < 4 ? 1 : d > 6 ? -1 : 0,
    bit(key) | (ex ? bit("EX") : 0),
  );
  put(b, 0, 0, 0, 8);
}
export function cpu(s: SimState, i: number, b: Brain): RawInput {
  const p = s.fighters[i],
    o = s.fighters[1 - i],
    dist = Math.abs(p.x - o.x),
    f = p.facing;
  if (s.phase !== "fight") {
    b.queue.length = 0;
    b.wait = 0;
    return NEUTRAL;
  }
  if (b.queue.length) return b.queue.shift()!;
  if (b.wait > 0) {
    b.wait--;
    return b.held;
  }
  b.decisions++;
  const r = random(b),
    r2 = random(b),
    reaction = [17, 11, 7][b.difficulty];
  b.wait = reaction;
  b.held = { ...NEUTRAL };
  if (p.downFrames) {
    b.held = { x: 0, y: 1, buttons: bit("LK") };
    return b.held;
  }
  if (p.stunFrames > 0) {
    b.held = {
      x: -f,
      y: 1,
      buttons: p.pose === "block" && p.meter > 180 && r < 0.35 ? bit("EX") : 0,
    };
    return b.held;
  }
  if (p.move) return NEUTRAL;
  const threat = s.projectiles.find(
    (q) =>
      q.active &&
      q.owner !== i &&
      (p.x - q.x) * q.vx > 0 &&
      Math.abs(p.x - q.x) < 280 &&
      Math.abs(p.x - q.x) > 65,
  );
  if (threat && r < [0.25, 0.6, 0.85][b.difficulty]) {
    if (r2 < 0.5 && p.grounded) {
      put(b, f, -1, 0, 5);
      put(b, f, 0, 0, 14);
      put(b, 0, 0, bit("HK"));
      return b.queue.shift()!;
    }
    b.held = { x: -f, y: 1, buttons: r2 > 0.8 ? bit("PARRY") : 0 };
    return b.held;
  }
  if (o.move && dist < 190 && r < [0.32, 0.58, 0.76][b.difficulty]) {
    const m = CHARACTERS[o.id].moves[o.move];
    if (o.moveFrame < m.startup + m.active) {
      b.held = { x: -f, y: m.level === "overhead" ? 0 : 1, buttons: 0 };
      return b.held;
    }
  }
  if (!o.grounded && dist < 180 && r < 0.7) {
    if (p.id === "hayate" || p.id === "sable")
      queueMotion(b, p.id, p.id === "hayate" ? 1 : 2, f, 1);
    else put(b, 0, 1, bit("HP"));
    return b.queue.shift()!;
  }
  if (
    p.hp < CHARACTERS[p.id].hp * 0.3 &&
    !p.ultimateUsed &&
    dist < 190 &&
    r < 0.2
  ) {
    put(b, 0, 0, bit("ULT"));
    return b.queue.shift()!;
  }
  if (p.meter >= 100 && dist < 140 && r < 0.18) {
    put(b, 0, 0, bit("SUPER"));
    return b.queue.shift()!;
  }
  if (p.meter > 230 && r < 0.1) {
    put(b, 0, 0, bit("DRIVE"));
    return b.queue.shift()!;
  }
  if (p.id === "sable" && dist > 150 && dist < 420 && r < 0.25) {
    queueMotion(b, p.id, 1, f, 1);
    return b.queue.shift()!;
  }
  if (dist < 85) {
    if (p.id === "magnus" && r < 0.38) {
      queueMotion(
        b,
        p.id,
        r2 < 0.5 ? 0 : 1,
        f,
        Math.floor(random(b) * 3),
        p.meter >= 100 && r2 > 0.7,
      );
    } else if (r < 0.13) {
      put(b, 0, 0, bit("THROW"));
    } else if (r < 0.65) {
      put(b, 0, r2 < 0.4 ? 1 : 0, bit("LP"));
      put(b, 0, 0, 0, 8);
      put(b, 0, 0, bit("MP"));
      put(b, 0, 0, 0, 10);
      queueMotion(
        b,
        p.id,
        p.id === "warden" ? 2 : 0,
        f,
        1,
        p.meter >= 100 && r2 > 0.5,
      );
      if (b.difficulty === 2 && p.meter >= 100) {
        put(b, 0, 0, 0, 18);
        put(b, 0, 0, bit("SUPER"));
      }
    } else {
      put(b, r2 < 0.3 ? f : 0, r2 < 0.5 ? 1 : 0, bit(r2 < 0.5 ? "MK" : "HP"));
    }
    b.wait = 8;
  } else if (dist < (p.id === "sable" ? 115 : p.id === "magnus" ? 130 : 145)) {
    if (r < 0.5) put(b, 0, r2 < 0.5 ? 1 : 0, bit(r2 < 0.5 ? "HK" : "MK"));
    else if (r < 0.75)
      queueMotion(
        b,
        p.id,
        p.id === "magnus" ? 2 : p.id === "sable" ? 0 : 2,
        f,
        1,
      );
    else {
      b.held = { x: f, y: 0, buttons: 0 };
      return b.held;
    }
  } else if (
    (p.id === "warden" || p.id === "hayate") &&
    dist > 220 &&
    r < (p.id === "warden" ? 0.6 : 0.35)
  ) {
    queueMotion(b, p.id, 0, f, Math.floor(r2 * 3), p.meter >= 160 && r2 > 0.65);
  } else if (p.id === "sable" && r < 0.18 && dist < 350) {
    queueMotion(b, p.id, 1, f, 2);
  } else if (r < 0.1 && dist < 400) {
    put(b, f, -1, 0, 16);
    put(b, f, 0, bit("HK"), 1);
  } else {
    b.held = { x: f, y: 0, buttons: 0 };
    return b.held;
  }
  return b.queue.shift() ?? NEUTRAL;
}
