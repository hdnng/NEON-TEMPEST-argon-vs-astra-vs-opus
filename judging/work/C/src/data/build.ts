/**
 * Helpers that expand compact move specifications into complete MoveDef records.
 * The output is plain data: per-hit frame windows, per-frame hurtbox keyframes, animation keys.
 *
 * Hitstun/blockstun may be given directly or derived from the familiar "advantage on hit /
 * on block" numbers: stun = (frames left in the move after the hit frame) + advantage.
 */
import type {
  AnimKey, Box, CancelClass, HitDef, HitLevel, InputReq, MoveDef, MoveKey, MoveType,
  ProjectileDef, Stance, ThrowDef,
} from './schema';

export type B4 = [number, number, number, number];
export const bx = (b: B4): Box => ({ x: b[0], y: b[1], w: b[2], h: b[3] });

type Power = HitDef['power'];

const POWER_DEFAULTS: Record<Power, {
  hitstop: number; stun: number; push: [number, number]; meter: [number, number]; chip: number;
}> = {
  light: { hitstop: 8, stun: 1.5, push: [16, 20], meter: [6, 3], chip: 0 },
  medium: { hitstop: 10, stun: 1.35, push: [20, 24], meter: [10, 5], chip: 0 },
  heavy: { hitstop: 12, stun: 1.25, push: [24, 30], meter: [14, 7], chip: 0 },
  special: { hitstop: 12, stun: 1.0, push: [24, 30], meter: [12, 6], chip: 0.25 },
  super: { hitstop: 5, stun: 0, push: [10, 12], meter: [0, 0], chip: 0.25 },
};

export interface HitSpec {
  dmg: number;
  box: B4 | B4[];
  /** Explicit frame window; defaults to the move's whole active window. */
  frames?: [number, number];
  onHit?: number;
  onBlock?: number;
  hitstun?: number;
  blockstun?: number;
  level?: HitLevel;
  power?: Power;
  chip?: number;
  stun?: number;
  hitstop?: number;
  push?: [number, number];
  meter?: [number, number];
  kd?: 'soft' | 'hard';
  launch?: [number, number];
  jug?: [number, number];
  vacuum?: boolean;
  crumple?: boolean;
}

export interface MoveSpec {
  id: string;
  name: string;
  desc: string;
  type?: MoveType;
  stance: Stance;
  input: InputReq;
  s: number;
  a: number;
  r: number;
  hits?: HitSpec[];
  /** Override hurtboxes (keyframes). Otherwise stance boxes + automatic limb extension. */
  hurt?: { f: number; boxes: B4[] }[];
  /** Disable the automatic extended-limb hurtbox. */
  noLimbHurt?: boolean;
  push?: B4;
  move?: MoveKey[];
  invuln?: MoveDef['invuln'];
  armor?: MoveDef['armor'];
  cancel?: 'chain' | 'special' | 'super' | 'none' | CancelClass[];
  cancelOn?: 'hit' | 'contact' | 'any';
  cancelWindow?: [number, number];
  chainTo?: string[];
  followFrom?: string[];
  projectile?: { frame: number; def: ProjectileDef; x: number; y: number };
  airborne?: boolean;
  landingLag?: number;
  throw?: ThrowDef;
  meterCost?: number;
  lowHp?: boolean;
  superFreeze?: number;
  oneProjectile?: boolean;
  teleport?: MoveDef['teleport'];
  /** Single pose name (auto windup/active/recover) or explicit keys. */
  pose?: string;
  windup?: string;
  anim?: AnimKey[];
  sfx?: string;
  meterWhiff?: number;
  priority?: number;
}

export interface StanceBoxes { stand: Box[]; crouch: Box[]; air: Box[] }

export function totalFrames(s: number, a: number, r: number): number {
  return s - 1 + a + r;
}

export function makeHit(spec: HitSpec, s: number, a: number, total: number): HitDef {
  const power: Power = spec.power ?? 'medium';
  const d = POWER_DEFAULTS[power];
  const frames: [number, number] = spec.frames ?? [s, s + a - 1];
  const left = total - frames[0];
  const hitstun = spec.hitstun ?? Math.max(1, left + (spec.onHit ?? 2));
  const blockstun = spec.blockstun ?? Math.max(1, left + (spec.onBlock ?? -2));
  const boxes = (Array.isArray(spec.box[0]) ? (spec.box as B4[]) : [spec.box as B4]).map(bx);
  const chip = spec.chip ?? Math.round(spec.dmg * d.chip);
  const out: HitDef = {
    frames,
    boxes,
    damage: spec.dmg,
    chip,
    stun: spec.stun ?? Math.round(spec.dmg * d.stun),
    hitstun,
    blockstun,
    hitstop: spec.hitstop ?? d.hitstop,
    level: spec.level ?? 'mid',
    pushHit: spec.push ? spec.push[0] : d.push[0],
    pushBlock: spec.push ? spec.push[1] : d.push[1],
    meterHit: spec.meter ? spec.meter[0] : d.meter[0],
    meterBlock: spec.meter ? spec.meter[1] : d.meter[1],
    power,
  };
  if (spec.kd) out.knockdown = spec.kd;
  if (spec.launch) out.launch = { vx: spec.launch[0], vy: spec.launch[1] };
  if (spec.jug) { out.juggleAdd = spec.jug[0]; out.juggleMax = spec.jug[1]; }
  if (spec.vacuum) out.vacuum = true;
  if (spec.crumple) out.crumpleOnCounter = true;
  return out;
}

/** Builds hurtbox keyframes: stance boxes, plus an extended-limb box around active frames. */
function autoHurt(spec: MoveSpec, hits: HitDef[], stanceBoxes: StanceBoxes, total: number) {
  const base = stanceBoxes[spec.stance];
  if (spec.hurt) return spec.hurt.map((k) => ({ f: k.f, boxes: k.boxes.map(bx) }));
  const keys: { f: number; boxes: Box[] }[] = [{ f: 1, boxes: base }];
  if (spec.noLimbHurt || hits.length === 0) return keys;
  const first = Math.max(1, hits[0].frames[0] - 1);
  const last = Math.min(total, hits[hits.length - 1].frames[1] + Math.min(8, Math.ceil(spec.r * 0.5)));
  const limbs: Box[] = [];
  for (const h of hits) {
    for (const b of h.boxes) {
      // Limb hurtbox: from the body to slightly short of the hitbox tip, a bit taller.
      if (b.x + b.w <= 20) continue;
      const x0 = Math.max(0, b.x - 10);
      limbs.push({ x: x0, y: b.y - 4, w: Math.max(10, b.x + b.w - 8 - x0), h: b.h + 8 });
    }
  }
  if (limbs.length) {
    keys.push({ f: first, boxes: base.concat(limbs) });
    if (last < total) keys.push({ f: last + 1, boxes: base });
  }
  return keys;
}

function autoAnim(spec: MoveSpec, total: number): AnimKey[] {
  if (spec.anim) return spec.anim;
  const base = spec.stance === 'crouch' ? 'crouch' : spec.stance === 'air' ? 'jump' : 'stance';
  const pose = spec.pose ?? base;
  const windup = spec.windup ?? pose + '_w';
  const s = spec.s, a = spec.a;
  const keys: AnimKey[] = [{ f: 1, pose: base }];
  if (s > 2) keys.push({ f: Math.max(2, Math.floor(s * 0.6)), pose: windup });
  keys.push({ f: s, pose });
  keys.push({ f: s + a - 1 + Math.min(3, Math.floor(spec.r / 4)), pose });
  keys.push({ f: total, pose: base });
  return keys;
}

function cancelClasses(spec: MoveSpec): CancelClass[] {
  const c = spec.cancel;
  if (!c || c === 'none') return [];
  if (Array.isArray(c)) return c;
  if (c === 'chain') return ['chain', 'special', 'super', 'drive'];
  if (c === 'special') return ['special', 'super', 'drive'];
  return ['super', 'drive'];
}

export function move(spec: MoveSpec, stanceBoxes: StanceBoxes): MoveDef {
  const total = totalFrames(spec.s, spec.a, spec.r);
  const hits = (spec.hits ?? []).map((h) => makeHit(h, spec.s, spec.a, total));
  const into = cancelClasses(spec);
  const type: MoveType = spec.type ?? 'normal';
  const def: MoveDef = {
    id: spec.id,
    name: spec.name,
    desc: spec.desc,
    type,
    stance: spec.stance,
    input: spec.input,
    startup: spec.s,
    active: spec.a,
    recovery: spec.r,
    hits,
    hurt: autoHurt(spec, hits, stanceBoxes, total),
    anim: autoAnim(spec, total),
  };
  if (spec.push) def.push = bx(spec.push);
  if (spec.move) def.move = spec.move;
  if (spec.invuln) def.invuln = spec.invuln;
  if (spec.armor) def.armor = spec.armor;
  if (into.length) {
    const firstHit = hits.length ? hits[0].frames[0] : spec.s;
    const lastHit = hits.length ? hits[hits.length - 1].frames[1] : spec.s + spec.a - 1;
    def.cancel = {
      window: spec.cancelWindow ?? [firstHit, Math.min(total, lastHit + 10)],
      into,
      on: spec.cancelOn ?? 'contact',
    };
  }
  if (spec.chainTo) def.chainTo = spec.chainTo;
  if (spec.followFrom) def.followFrom = spec.followFrom;
  if (spec.projectile) def.projectile = spec.projectile;
  if (spec.airborne) def.airborne = true;
  if (spec.landingLag !== undefined) def.landingLag = spec.landingLag;
  if (spec.throw) def.throw = spec.throw;
  if (spec.meterCost) def.meterCost = spec.meterCost;
  if (spec.lowHp) def.lowHp = true;
  if (spec.superFreeze) def.superFreeze = spec.superFreeze;
  if (spec.oneProjectile) def.oneProjectile = true;
  if (spec.teleport) def.teleport = spec.teleport;
  if (spec.sfx) def.sfx = spec.sfx;
  if (spec.meterWhiff) def.meterWhiff = spec.meterWhiff;
  if (spec.priority) def.priority = spec.priority;
  return def;
}

/** Builds the hit portion of a projectile definition. */
export function projHit(spec: Omit<HitSpec, 'box'>): ProjectileDef['hit'] {
  const h = makeHit({ ...spec, box: [0, 0, 1, 1] }, 1, 1, 1);
  const { frames: _f, boxes: _b, ...rest } = h;
  return rest;
}

/** Strength variants (L/M/H/EX) of a special sharing a base spec. */
export function variants(
  base: Omit<MoveSpec, 'id' | 'input'> & { id: string; motion: InputReq['motion']; group: 'P' | 'K' },
  per: Partial<Record<'L' | 'M' | 'H' | 'EX', Partial<MoveSpec>>>,
  stanceBoxes: StanceBoxes,
): MoveDef[] {
  const out: MoveDef[] = [];
  const btn = base.group === 'P' ? ['LP', 'MP', 'HP'] as const : ['LK', 'MK', 'HK'] as const;
  (['L', 'M', 'H', 'EX'] as const).forEach((st, i) => {
    const o = per[st];
    if (!o) return;
    const { motion, group, ...rest } = base;
    const input: InputReq = st === 'EX' ? { motion, two: group } : { motion, btn: btn[i] };
    const spec: MoveSpec = {
      ...rest,
      ...o,
      id: `${base.id}_${st}`,
      name: st === 'EX' ? `EX ${base.name}` : base.name,
      input,
      type: st === 'EX' ? 'ex' : 'special',
      meterCost: st === 'EX' ? 50 : undefined,
      cancel: o.cancel ?? rest.cancel ?? 'super',
    } as MoveSpec;
    if (o.hits) spec.hits = o.hits;
    out.push(move(spec, stanceBoxes));
  });
  return out;
}

/** Standard universal system moves (Storm Drive, Shock Guard, Repel) and throws. */
export function systemMoves(stanceBoxes: StanceBoxes, throwF: ThrowDef, throwB: ThrowDef, pose: { throwF: string; throwB: string }): MoveDef[] {
  return [
    move({
      id: 'throwF', name: 'Forward Throw', desc: 'Close range. Techable with LP+LK.', type: 'throw',
      stance: 'stand', input: { combo: ['LP', 'LK'] }, s: 5, a: 2, r: 20, throw: throwF,
      pose: pose.throwF, noLimbHurt: true,
      anim: [{ f: 1, pose: 'stance' }, { f: 4, pose: 'grab' }, { f: 26, pose: 'stance' }],
    }, stanceBoxes),
    move({
      id: 'throwB', name: 'Back Throw', desc: 'Throws the opponent behind you.', type: 'throw',
      stance: 'stand', input: { combo: ['LP', 'LK'], dirs: [4, 1, 7] }, s: 5, a: 2, r: 20, throw: throwB,
      pose: pose.throwB, noLimbHurt: true, priority: 1,
      anim: [{ f: 1, pose: 'stance' }, { f: 4, pose: 'grab' }, { f: 26, pose: 'stance' }],
    }, stanceBoxes),
    move({
      id: 'drive', name: 'Storm Drive', type: 'drive',
      desc: 'Costs 1 stock. 6s of +10% damage, free normal-to-normal and special-to-special cancels. Cancels recovery on contact. You take +15% damage, then burn out (no meter gain) for 3s.',
      stance: 'stand', input: { combo: ['MP', 'MK'] }, s: 1, a: 1, r: 14, meterCost: 100, superFreeze: 20,
      invuln: { strike: [1, 6], throw: [1, 6], proj: [1, 6] }, noLimbHurt: true,
      anim: [{ f: 1, pose: 'drive' }, { f: 10, pose: 'drive' }, { f: 15, pose: 'stance' }],
    }, stanceBoxes),
    move({
      id: 'guardcancel', name: 'Shock Guard', type: 'guardcancel',
      desc: 'While blocking: MP+MK. Costs 1 stock. Invincible counter-burst that knocks the attacker away.',
      stance: 'stand', input: { combo: ['MP', 'MK'] }, s: 6, a: 4, r: 24, meterCost: 100, superFreeze: 10,
      invuln: { strike: [1, 12], throw: [1, 12], proj: [1, 12] },
      hits: [{ dmg: 60, box: [0, 0, 130, 210], power: 'special', kd: 'soft', launch: [6, 9], hitstop: 14, stun: 0, onBlock: -6, push: [40, 60], chip: 0, meter: [0, 0] }],
      anim: [{ f: 1, pose: 'drive' }, { f: 6, pose: 'shockguard' }, { f: 12, pose: 'shockguard' }, { f: 33, pose: 'stance' }],
    }, stanceBoxes),
    move({
      id: 'pushblock', name: 'Repel', type: 'pushblock',
      desc: 'While blocking: any two punches. Free. Pushes the attacker far away; you keep guarding.',
      stance: 'stand', input: { two: 'P' }, s: 1, a: 1, r: 14, noLimbHurt: true,
      anim: [{ f: 1, pose: 'repel' }, { f: 10, pose: 'repel' }, { f: 15, pose: 'block' }],
    }, stanceBoxes),
  ];
}
