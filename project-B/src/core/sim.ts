import { CHARACTERS } from "../characters/data";
import {
  createInput,
  poll,
  motion,
  trigger,
  simultaneous,
  dash,
} from "../input/motions";
import {
  type FighterId,
  type Fighter,
  type Move,
  type SimState,
  type RawInput,
  type Rules,
  type Box,
  bit,
  NEUTRAL,
} from "./types";
import { clamp } from "../utils/math";
export const STAGE_WIDTH = 1480,
  GROUND = 570;
export const defaultRules: Rules = {
  mode: "versus",
  infiniteHealth: false,
  infiniteMeter: false,
  dummy: "stand",
  timer: 99,
};
export function fighter(id: FighterId, x: number, facing: 1 | -1): Fighter {
  return {
    id,
    x,
    y: 0,
    vx: 0,
    vy: 0,
    facing,
    hp: CHARACTERS[id].hp,
    white: CHARACTERS[id].hp,
    meter: 0,
    stun: CHARACTERS[id].stun,
    pose: "idle",
    move: null,
    moveFrame: 0,
    moveSerial: 0,
    hitTargets: 0,
    projectileSpawned: false,
    stunFrames: 0,
    downFrames: 0,
    invincible: 0,
    armorHits: 0,
    jumps: 0,
    jumpSquat: 0,
    airDash: false,
    grounded: true,
    combo: 0,
    comboDamage: 0,
    comboTimer: 0,
    comboScale: 1,
    juggle: 0,
    lastHitBy: -1,
    drive: 0,
    driveCooldown: 0,
    parry: 0,
    parryCooldown: 0,
    throwTech: 0,
    dashFrames: 0,
    input: createInput(),
    wins: 0,
    damageDealt: 0,
    lastMove: "",
    confirm: 0,
    ultimateUsed: false,
  };
}
export function createMatch(
  a: FighterId,
  b: FighterId,
  seed = 73421,
  rules: Partial<Rules> = {},
): SimState {
  return {
    version: 1,
    seed,
    frame: 0,
    round: 1,
    timer: (rules.timer ?? 99) * 60,
    phase: "intro",
    phaseFrames: 130,
    hitstop: 0,
    winner: -1,
    roundWinner: -1,
    fighters: [fighter(a, 540, 1), fighter(b, 940, -1)],
    projectiles: Array.from({ length: 32 }, () => ({
      active: false,
      owner: 0,
      x: 0,
      y: 0,
      vx: 0,
      life: 0,
      size: 0,
      move: "",
      serial: 0,
    })),
    events: [],
    rules: { ...defaultRules, ...rules },
    rounds: 0,
    slow: 0,
  };
}
export function serialize(s: SimState) {
  return JSON.stringify(s);
}
export function restore(json: string): SimState {
  const s = JSON.parse(json);
  if (s.version !== 1) throw new Error("Unsupported replay version");
  return s;
}
function event(
  s: SimState,
  type: SimState["events"][number]["type"],
  i: number,
  strength = 0,
  text?: string,
) {
  const p = s.fighters[i];
  s.events.push({ type, x: p.x, y: p.y - 80, player: i, strength, text });
}
export function addMeter(p: Fighter, amount: number) {
  p.meter = clamp(p.meter + amount, 0, 300);
}
export function scaledDamage(base: number, combo: number, drive = false) {
  return Math.max(
    1,
    Math.round(
      base * Math.max(0.25, 1 - Math.max(0, combo) * 0.09) * (drive ? 1.18 : 1),
    ),
  );
}
export function startMove(s: SimState, i: number, m: Move) {
  const p = s.fighters[i];
  if (p.meter < m.cost || (m.level === "throw" && !p.grounded)) return false;
  if (
    m.kind === "ultimate" &&
    (p.hp > CHARACTERS[p.id].hp * 0.3 || p.ultimateUsed)
  )
    return false;
  addMeter(p, -m.cost);
  addMeter(p, m.attackMeter);
  p.move = m.id;
  p.lastMove = m.id;
  p.moveFrame = 0;
  p.moveSerial++;
  p.hitTargets = 0;
  p.projectileSpawned = false;
  p.armorHits = 0;
  p.jumpSquat = 0;
  p.pose = "move";
  p.input.used = s.frame;
  p.confirm = 0;
  p.vx = 0;
  if (m.kind === "ultimate") p.ultimateUsed = true;
  event(
    s,
    m.kind === "super" || m.kind === "ultimate" ? "super" : "move",
    i,
    m.strength,
    m.name,
  );
  if (m.kind === "super" || m.kind === "ultimate") {
    s.hitstop = 32;
  }
  return true;
}
function canCancel(p: Fighter, old: Move, next: Move) {
  if (p.moveFrame < old.cancel[0] || p.moveFrame > old.cancel[1] || !p.confirm)
    return false;
  if (next.kind === "super" || next.kind === "ultimate") return true;
  if (next.kind === "special")
    return old.kind === "normal" || old.kind === "command";
  return (
    old.kind === "normal" &&
    old.strength === 0 &&
    next.kind === "normal" &&
    next.strength <= 1
  );
}
export function selectMove(p: Fighter): Move | undefined {
  const c = CHARACTERS[p.id],
    latest = p.input.history.at(-1);
  if (!latest) return;
  // Retain the direction and EX modifier attached to a buffered button edge,
  // even if the player releases both during hitstop before the cancel executes.
  let h = latest;
  const attacks =
    bit("LP") | bit("MP") | bit("HP") | bit("LK") | bit("MK") | bit("HK");
  for (let k = p.input.history.length - 1; k >= 0; k--) {
    const edge = p.input.history[k];
    if (latest.frame - edge.frame > 5 || edge.frame <= p.input.used) break;
    if (edge.pressed & attacks) {
      h = edge;
      break;
    }
  }
  const threeP =
    (h.held & (bit("LP") | bit("MP") | bit("HP"))) ===
    (bit("LP") | bit("MP") | bit("HP"));
  const threeK =
    (h.held & (bit("LK") | bit("MK") | bit("HK"))) ===
    (bit("LK") | bit("MK") | bit("HK"));
  if (
    trigger(p.input, "ULT") ||
    (motion(p.input, "2QCF") &&
      ["HK", "MK", "LK"].some((b) => trigger(p.input, b as "HK", true)))
  )
    return c.moves.ultimate;
  if (
    trigger(p.input, "SUPER") ||
    threeP ||
    threeK ||
    (motion(p.input, "2QCF") &&
      ["HP", "MP", "LP"].some((b) => trigger(p.input, b as "HP", true)))
  )
    return c.moves.super;
  if (trigger(p.input, "THROW") || simultaneous(p.input, "LP", "LK"))
    return c.moves[[1, 4, 7].includes(h.dir) ? "backThrow" : "throw"];
  // Test more specific motions first so a dragon-punch ending cannot become a quarter-circle.
  const order = c.motionPriority;
  for (const n of order) {
    const ref = c.moves[`special${n}_0`];
    if (!motion(p.input, ref.motion)) continue;
    const keys =
      ref.button === "LK"
        ? (["HK", "MK", "LK"] as const)
        : (["HP", "MP", "LP"] as const);
    for (let k = 0; k < 3; k++)
      if (trigger(p.input, keys[k], true)) {
        const ex =
          !!(h.context & bit("EX")) ||
          keys.filter((b) => !!(h.context & bit(b))).length >= 2;
        return c.moves[`special${n}_${ex ? 3 : 2 - k}`];
      }
  }
  if (p.grounded && h.dir === 6 && trigger(p.input, "MP"))
    return c.moves.command;
  if (p.grounded && h.dir === 6 && trigger(p.input, "HK"))
    return c.moves.command2;
  const stance = !p.grounded
    ? "air"
    : [1, 2, 3].includes(h.dir)
      ? "crouch"
      : "stand";
  for (const key of ["HK", "HP", "MK", "MP", "LK", "LP"] as const)
    if (trigger(p.input, key)) return c.moves[`${stance}_${key}`];
}
function worldBox(p: Fighter, b: Box): Box {
  return {
    x: p.x + (p.facing === 1 ? b.x : -b.x - b.w),
    y: p.y + b.y,
    w: b.w,
    h: b.h,
  };
}
export function overlap(a: Box, b: Box) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}
export function activeBoxes(
  p: Fighter,
  kind: "hitboxes" | "hurtboxes" | "throwboxes" | "pushboxes",
): Box[] {
  const m = p.move ? CHARACTERS[p.id].moves[p.move] : null;
  if (m) {
    const frames = m[kind].filter(
      (f) => p.moveFrame >= f.from && p.moveFrame <= f.to,
    );
    if (frames.length) return frames.map((f) => worldBox(p, f.box));
  }
  if (kind === "pushboxes")
    return [worldBox(p, CHARACTERS[p.id].moves.stand_LP.pushbox)];
  if (kind === "hurtboxes")
    return [
      worldBox(p, {
        x: -23,
        y: p.pose === "crouch" ? -108 : -171,
        w: 46,
        h: p.pose === "crouch" ? 108 : 171,
      }),
    ];
  return [];
}
function invulnerable(p: Fighter) {
  const m = p.move ? CHARACTERS[p.id].moves[p.move] : null;
  return (
    p.invincible > 0 ||
    (p.downFrames > 0 && p.grounded) ||
    (!!m && p.moveFrame >= m.invuln[0] && p.moveFrame <= m.invuln[1])
  );
}
function isBlocking(d: Fighter, m: Move, sourceX: number) {
  if (
    d.move ||
    d.downFrames ||
    d.pose === "hit" ||
    d.pose === "dizzy" ||
    !d.grounded
  )
    return false;
  const dir = d.input.history.at(-1)?.dir ?? 5;
  const worldBack = sourceX > d.x ? -1 : 1;
  // Facing may change after polling on a cross-up frame. Guard must use the
  // actual held world direction, not reinterpret the old relative direction.
  const x = d.input.history.at(-1)?.worldX ?? 0;
  const low = [1, 2, 3].includes(dir);
  return (
    x === worldBack &&
    (m.level === "low" ? low : m.level === "overhead" ? !low : true)
  );
}
function knockback(a: Fighter, d: Fighter, amount: number) {
  const dir = d.x >= a.x ? 1 : -1;
  const before = d.x;
  d.x = clamp(d.x + dir * amount, 45, STAGE_WIDTH - 45);
  const absorbed = amount - Math.abs(d.x - before);
  if (absorbed > 0)
    a.x = clamp(a.x - dir * absorbed * 0.8, 45, STAGE_WIDTH - 45);
}
export function resolveHit(s: SimState, i: number, m: Move, sourceX?: number) {
  const a = s.fighters[i],
    d = s.fighters[1 - i];
  if (invulnerable(d)) return false;
  if (m.level === "throw") {
    if (!d.grounded || d.stunFrames > 0 || d.throwTech > 0) return false;
    if (
      m.kind === "throw" &&
      (trigger(d.input, "THROW") || simultaneous(d.input, "LP", "LK"))
    ) {
      d.throwTech = 22;
      a.throwTech = 22;
      knockback(a, d, 55);
      event(s, "tech", i, 0, "THROW TECH");
      return true;
    }
  } else {
    if (d.parry > 0) {
      d.parry = 0;
      d.invincible = 12;
      addMeter(d, 30);
      a.stunFrames = 15;
      a.pose = "hit";
      a.move = null;
      event(s, "parry", 1 - i, 2, "PERFECT PARRY");
      s.hitstop = 10;
      return true;
    }
    const dm = d.move ? CHARACTERS[d.id].moves[d.move] : null;
    if (
      dm &&
      d.moveFrame >= dm.armor[0] &&
      d.moveFrame <= dm.armor[1] &&
      d.armorHits < 1
    ) {
      d.armorHits++;
      d.hp = Math.max(0, d.hp - Math.round(m.damage * 0.3));
      event(s, "block", 1 - i, 2, "ARMOR");
      s.hitstop = 5;
      return true;
    }
  }
  if (m.level !== "throw" && isBlocking(d, m, sourceX ?? a.x)) {
    // Chip cannot kill; clean hits and throws must close a round.
    d.hp = Math.max(1, d.hp - m.chip);
    d.stunFrames = m.blockstun;
    d.pose = "block";
    d.move = null;
    addMeter(d, 8);
    addMeter(a, m.meter / 2);
    a.confirm = 12;
    knockback(a, d, m.push * 0.55);
    event(s, "block", 1 - i, m.strength);
    s.hitstop = m.hitstop - 2;
    if (trigger(d.input, "EX") && d.meter >= 50) {
      addMeter(d, -50);
      knockback(d, a, 110);
      d.stunFrames = 3;
      event(s, "tech", 1 - i, 1, "PUSHBLOCK");
    }
    return true;
  }
  if (!d.grounded && d.juggle + m.juggle > 6) return false;
  if (
    (d.stunFrames === 0 &&
      d.downFrames === 0 &&
      d.juggle === 0 &&
      d.pose !== "hit") ||
    d.pose === "block"
  ) {
    a.combo = 0;
    a.comboDamage = 0;
  }
  const damage =
    scaledDamage(m.damage, a.combo, a.drive > 0) * (d.drive > 0 ? 1.12 : 1);
  const dealt = Math.round(damage);
  d.hp = Math.max(0, d.hp - dealt);
  // A clean hit breaks a dizzy state; it must not restart the same empty gauge.
  if (d.pose === "dizzy") d.stun = CHARACTERS[d.id].stun;
  d.stun = Math.max(0, d.stun - dealt * 0.8);
  d.lastHitBy = i;
  a.damageDealt += dealt;
  a.combo++;
  a.comboDamage += dealt;
  a.comboTimer = 130;
  a.comboScale = Math.max(0.25, 1 - (a.combo - 1) * 0.09);
  a.confirm = 16;
  addMeter(a, m.meter);
  addMeter(d, dealt * 0.16);
  d.stunFrames = m.hitstun;
  d.pose = "hit";
  d.move = null;
  d.dashFrames = 0;
  d.vx = 0;
  if (m.launch > 0) {
    d.vy = -m.launch;
    d.grounded = false;
    d.juggle += m.juggle;
  }
  if (m.knockdown || m.level === "throw") {
    d.downFrames = 48;
    d.vy = -Math.max(6, m.launch);
    d.grounded = false;
  }
  if (m.back) {
    const ox = a.x;
    a.x = d.x;
    d.x = ox;
    a.facing = a.facing === 1 ? -1 : 1;
  }
  knockback(a, d, m.push);
  event(s, m.level === "throw" ? "throw" : "hit", 1 - i, m.strength);
  s.hitstop = m.hitstop;
  if (d.stun === 0 && d.hp > 0) {
    d.downFrames = 0;
    d.stunFrames = 150;
    d.pose = "dizzy";
    d.vy = 0;
    event(s, "dizzy", 1 - i, 2, "SYSTEM BREAK");
  }
  return true;
}
function updateFighter(s: SimState, i: number, raw: RawInput) {
  const p = s.fighters[i],
    o = s.fighters[1 - i],
    c = CHARACTERS[p.id];
  const wasStunned = p.stunFrames > 0;
  p.white = Math.max(p.hp, p.white - 1.7);
  for (const key of [
    "invincible",
    "throwTech",
    "drive",
    "driveCooldown",
    "parry",
    "parryCooldown",
    "confirm",
    "comboTimer",
  ] as const)
    if (p[key] > 0) p[key]--;
  if (p.comboTimer === 0) {
    p.combo = 0;
    p.comboDamage = 0;
  }
  if (s.rules.infiniteMeter) p.meter = 300;
  if (p.grounded && !p.move && !p.stunFrames) p.facing = o.x >= p.x ? 1 : -1;
  if (p.stunFrames > 0) {
    p.stunFrames--;
    p.vx *= 0.8;
    if (p.pose === "dizzy" && p.stunFrames === 0) p.stun = c.stun;
    if (p.pose === "block" && trigger(p.input, "EX") && p.meter >= 50) {
      addMeter(p, -50);
      knockback(p, o, 110);
      p.stunFrames = 2;
      p.input.used = s.frame;
      event(s, "tech", i, 1, "PUSHBLOCK");
    }
  } else if (p.downFrames > 0 && p.grounded) {
    p.downFrames -= trigger(p.input, "LK") || raw.y > 0 ? 3 : 1;
    p.pose = "down";
    if (p.downFrames <= 0) {
      p.downFrames = 0;
      p.invincible = 12;
      p.juggle = 0;
      p.pose = "idle";
    }
  } else {
    if (
      !p.move &&
      p.grounded &&
      trigger(p.input, "DRIVE") &&
      p.meter >= 100 &&
      !p.driveCooldown
    ) {
      addMeter(p, -100);
      p.drive = 420;
      p.driveCooldown = 600;
      p.input.used = s.frame;
      event(s, "drive", i, 3, "OVERDRIVE");
    }
    if (!p.move && trigger(p.input, "PARRY") && !p.parryCooldown) {
      p.parry = 7;
      p.parryCooldown = 38;
      p.pose = "parry";
      p.input.used = s.frame;
    }
    const next = selectMove(p),
      old = p.move ? c.moves[p.move] : null;
    if (
      next &&
      (!old || canCancel(p, old, next)) &&
      (!p.parry || next.kind === "super")
    )
      startMove(s, i, next);
    if (!p.move && !p.parry && !p.downFrames) {
      const h = p.input.history.at(-1),
        dir = h?.dir ?? 5;
      const jumpEdge =
        raw.y < 0 && ![7, 8, 9].includes(p.input.history.at(-2)?.dir ?? 5);
      if (jumpEdge && p.grounded) p.jumpSquat = 4;
      if (p.jumpSquat > 0) p.jumpSquat--;
      if (
        p.jumpSquat === 1 ||
        (jumpEdge && !p.grounded && p.jumps < c.maxJumps)
      ) {
        p.jumpSquat = 0;
        p.vy = -c.jump;
        p.vx = raw.x * c.speed * 0.95;
        p.grounded = false;
        p.jumps++;
        p.pose = "air";
        p.input.used = s.frame;
        event(s, "jump", i);
      }
      if (p.grounded && (dash(p.input, 6) || dash(p.input, 4))) {
        p.dashFrames = dir === 6 ? 15 : 12;
        p.vx = p.facing * (dir === 6 ? 7 : -6);
        p.input.lastDash = s.frame;
        if (dir === 4) p.invincible = 4;
        event(s, "dash", i);
      }
      if (!p.grounded && c.canAirDash && !p.airDash && dash(p.input, 6)) {
        p.vx = 10 * p.facing;
        p.vy = 0;
        p.dashFrames = 12;
        p.airDash = true;
        p.input.lastDash = s.frame;
        event(s, "dash", i);
      }
      if (p.dashFrames > 0) {
        p.dashFrames--;
        p.pose = "dash";
      } else if (p.grounded) {
        p.vx = raw.y > 0 ? 0 : raw.x * c.speed * (p.drive ? 1.12 : 1);
        p.pose = raw.y > 0 ? "crouch" : raw.x ? "walk" : "idle";
      }
    }
  }
  if (p.move) {
    const m = c.moves[p.move];
    p.moveFrame++;
    if (m.teleport && p.moveFrame === m.startup - 2) {
      p.x = clamp(o.x - o.facing * 85, 55, STAGE_WIDTH - 55);
      p.facing = o.x >= p.x ? 1 : -1;
      event(s, "dash", i, 3);
    }
    if (p.moveFrame >= m.startup - 3 && p.moveFrame < m.startup + m.active)
      p.vx = m.velocity * p.facing;
    else if (p.grounded) p.vx = 0;
    if (m.launch && m.kind === "special" && p.moveFrame === m.startup) {
      p.vy = -11;
      p.grounded = false;
    }
    if (m.projectile && p.moveFrame >= m.startup && !p.projectileSpawned) {
      const b = s.projectiles.find((b) => !b.active);
      if (b) {
        Object.assign(b, {
          active: true,
          owner: i,
          x: p.x + p.facing * 50,
          y: p.y - 75,
          vx: m.projectile.speed * p.facing,
          life: m.projectile.life,
          size: m.projectile.size,
          move: m.id,
          serial: p.moveSerial,
        });
        event(s, "projectile", i, m.strength);
      }
      p.projectileSpawned = true;
    }
    if (p.moveFrame >= m.startup + m.active + m.recovery) {
      p.move = null;
      p.pose = p.grounded ? "idle" : "air";
      p.vx = 0;
    }
  }
  p.x = clamp(p.x + p.vx, 45, STAGE_WIDTH - 45);
  if (!p.grounded) {
    p.y += p.vy;
    p.vy += 0.64 * c.weight;
    if (p.y >= 0) {
      p.y = 0;
      p.vy = 0;
      p.grounded = true;
      p.jumps = 0;
      p.airDash = false;
      if (!p.stunFrames && !p.downFrames) {
        p.juggle = 0;
        p.invincible = Math.max(p.invincible, 3);
      }
    }
    if (
      p.stunFrames === 0 &&
      p.downFrames === 0 &&
      p.juggle > 0 &&
      raw.buttons
    ) {
      p.vy = -4;
      p.invincible = 12;
      p.juggle = 0;
      p.pose = "air";
      event(s, "tech", i, 0, "AIR RECOVERY");
    }
  }
  if (!p.stunFrames && !p.downFrames) {
    p.stun = Math.min(c.stun, p.stun + 0.45);
    if (
      !wasStunned &&
      (p.pose === "hit" || p.pose === "block" || p.pose === "dizzy")
    )
      p.pose = p.grounded ? "idle" : "air";
  }
  if (
    s.rules.infiniteHealth &&
    p.hp < c.hp &&
    !p.stunFrames &&
    !p.downFrames &&
    o.comboTimer < 90
  ) {
    p.hp = c.hp;
    p.white = c.hp;
    p.stun = c.stun;
  }
}
function finishRound(s: SimState) {
  const [a, b] = s.fighters;
  const ar = a.hp / CHARACTERS[a.id].hp,
    br = b.hp / CHARACTERS[b.id].hp;
  s.roundWinner = ar === br ? -1 : ar > br ? 0 : 1;
  s.phase = "ko";
  s.phaseFrames = 160;
  s.slow = 42;
  s.rounds++;
  if (s.roundWinner >= 0) s.fighters[s.roundWinner].wins++;
  else {
    a.wins++;
    b.wins++;
  }
  const text =
    a.hp === 0 && b.hp === 0
      ? "DOUBLE K.O."
      : s.timer === 0
        ? s.roundWinner < 0
          ? "DRAW"
          : "TIME OVER"
        : "K.O.";
  event(s, "ko", Math.max(0, s.roundWinner), 3, text);
}
export function step(s: SimState, inputs: [RawInput, RawInput]) {
  s.events.length = 0;
  s.frame++;
  for (let i = 0; i < 2; i++) {
    const input = s.fighters[i].input;
    if (s.hitstop > 0) {
      for (const f of input.history) f.frame++;
      input.used++;
      input.backReleased++;
      input.downReleased++;
    }
    poll(input, inputs[i], s.fighters[i].facing, s.frame);
  }
  if (s.phase === "complete") return;
  if (s.hitstop > 0) {
    s.hitstop--;
    return;
  }
  if (s.phase === "intro") {
    s.phaseFrames--;
    if (s.phaseFrames === 129) event(s, "round", 0, 0, `ROUND ${s.round}`);
    if (s.phaseFrames === 35) event(s, "fight", 0, 0, "FIGHT");
    if (s.phaseFrames <= 0) s.phase = "fight";
    return;
  }
  if (s.phase === "ko" || s.phase === "outro") {
    s.phaseFrames--;
    if (s.slow > 0) s.slow--;
    const rate = s.slow > 0 ? 0.22 : 1;
    for (let i = 0; i < 2; i++) {
      const p = s.fighters[i];
      if (p.hp === 0) {
        if (s.phaseFrames === 159) {
          p.vy = -5;
          p.grounded = false;
        }
        if (!p.grounded) {
          p.y += p.vy * rate;
          p.vy += 0.55 * rate;
          if (p.y >= 0) {
            p.y = 0;
            p.grounded = true;
            p.pose = "down";
          }
        }
      } else if (s.roundWinner === i) p.pose = "win";
    }
    if (s.phaseFrames === 90 && s.roundWinner >= 0) {
      const p = s.fighters[s.roundWinner];
      if (p.hp === CHARACTERS[p.id].hp)
        event(s, "round", s.roundWinner, 2, "PERFECT");
    }
    if (s.phaseFrames <= 0) {
      if (s.fighters.some((f) => f.wins >= 2) || s.round >= 5) {
        s.phase = "complete";
        const [a, b] = s.fighters;
        s.winner = a.wins === b.wins ? -1 : a.wins > b.wins ? 0 : 1;
        event(s, "win", Math.max(0, s.winner));
      } else {
        const old = s.fighters;
        s.fighters = [fighter(old[0].id, 540, 1), fighter(old[1].id, 940, -1)];
        for (let i = 0; i < 2; i++) {
          s.fighters[i].wins = old[i].wins;
          s.fighters[i].meter = old[i].meter;
          s.fighters[i].damageDealt = old[i].damageDealt;
        }
        s.round++;
        s.timer = s.rules.timer * 60;
        s.phase = "intro";
        s.phaseFrames = 130;
        for (const p of s.projectiles) p.active = false;
      }
    }
    return;
  }
  if (s.rules.mode !== "training" && s.rules.mode !== "trials")
    s.timer = Math.max(0, s.timer - 1);
  for (let i = 0; i < 2; i++) updateFighter(s, i, inputs[i]);
  const [a, b] = s.fighters,
    ab = activeBoxes(a, "pushboxes")[0],
    bb = activeBoxes(b, "pushboxes")[0],
    separation = (ab.w + bb.w) / 2,
    height = Math.min(ab.h, bb.h);
  if (Math.abs(a.x - b.x) < separation && Math.abs(a.y - b.y) < height) {
    const sign = a.x <= b.x ? 1 : -1,
      amount = (separation - Math.abs(a.x - b.x)) / 2;
    a.x = clamp(a.x - sign * amount, 45, STAGE_WIDTH - 45);
    b.x = clamp(b.x + sign * amount, 45, STAGE_WIDTH - 45);
  }
  // Collect both contacts before resolving either to allow genuine trades and double KOs.
  const contacts: { i: number; m: Move }[] = [];
  for (let i = 0; i < 2; i++) {
    const p = s.fighters[i],
      d = s.fighters[1 - i];
    if (!p.move) continue;
    const m = CHARACTERS[p.id].moves[p.move];
    if (p.hitTargets >= (m.multi ?? 1)) continue;
    if (p.hitTargets > 0 && p.moveFrame < m.startup + 9) continue;
    const hb = activeBoxes(p, m.level === "throw" ? "throwboxes" : "hitboxes"),
      hurt = activeBoxes(d, "hurtboxes");
    if (hb.some((h) => hurt.some((b) => overlap(h, b))))
      contacts.push({ i, m });
  }
  for (const { i, m } of contacts)
    if (resolveHit(s, i, m)) s.fighters[i].hitTargets++;
  for (const p of s.projectiles) {
    if (!p.active) continue;
    p.x += p.vx;
    p.life--;
    if (p.life <= 0 || p.x < 0 || p.x > STAGE_WIDTH) {
      p.active = false;
      continue;
    }
    const d = s.fighters[1 - p.owner];
    if (
      activeBoxes(d, "hurtboxes").some((b) =>
        overlap(
          { x: p.x - p.size, y: p.y - p.size, w: p.size * 2, h: p.size * 2 },
          b,
        ),
      )
    ) {
      if (
        resolveHit(
          s,
          p.owner,
          CHARACTERS[s.fighters[p.owner].id].moves[p.move],
          p.x,
        )
      )
        p.active = false;
    }
  }
  for (let i = 0; i < s.projectiles.length; i++)
    for (let j = i + 1; j < s.projectiles.length; j++) {
      const p = s.projectiles[i],
        q = s.projectiles[j];
      if (
        p.active &&
        q.active &&
        p.owner !== q.owner &&
        Math.abs(p.x - q.x) < p.size + q.size &&
        Math.abs(p.y - q.y) < 35
      ) {
        p.active = false;
        q.active = false;
      }
    }
  if (s.rules.mode === "training" || s.rules.mode === "trials") {
    for (const p of s.fighters)
      if (p.hp === 0) {
        p.hp = CHARACTERS[p.id].hp;
        p.stun = CHARACTERS[p.id].stun;
      }
    return;
  }
  if (a.hp === 0 || b.hp === 0 || s.timer === 0) finishRound(s);
}
