/**
 * Collision and hit resolution: throws (with tech), strikes (with trades, armor, counter hits,
 * juggle limits, blocking incl. cross-ups and high/low/overhead), projectiles and clashes,
 * combo scaling, meter and stun.
 */
import type { HitDef, MoveDef } from '../data/schema';
import {
  curMove, hurtboxes, isCrouching, isProjInvuln, isStrikeInvuln, isThrowInvuln, pushbox, setState,
} from './fighter';
import { DOWN, LEFT, RIGHT, histAt, matchCombo } from './input';
import { getChar, getMove } from './registry';
import { FP, METER_MAX, STAGE_HALF, type FighterState, type MatchState, type ProjectileState } from './types';
import { contactPoint, ev, fx, inRange, lerpKeys, overlaps, worldBox } from './util';

/** Percent damage for the n-th hit of a combo (1-based). */
export function comboScale(n: number, isSuper: boolean): number {
  const pct = n <= 2 ? 100 : Math.max(20, 100 - 10 * (n - 1));
  return isSuper ? Math.max(pct, 50) : pct;
}

/** Final damage after scaling and modifiers (integer math). */
export function computeDamage(base: number, n: number, isSuper: boolean, counter: boolean, attDrive: boolean, vicDrive: boolean): number {
  let d = Math.floor((base * comboScale(n, isSuper)) / 100);
  if (counter) d = Math.floor((d * 120) / 100);
  if (attDrive) d = Math.floor((d * 110) / 100);
  if (vicDrive) d = Math.floor((d * 115) / 100);
  return Math.max(1, d);
}

export function addMeter(f: FighterState, amount: number): void {
  if (f.burnout > 0 || amount <= 0) return;
  f.meter = Math.min(METER_MAX, f.meter + amount);
}

const GUARD_STATES = new Set(['idle', 'walkF', 'walkB', 'crouch', 'guard', 'blockstun']);

/** Whether the victim blocks an attack coming from world x `srcX`. */
export function blocks(vic: FighterState, srcX: number, level: HitDef['level']): boolean {
  if (vic.air || !GUARD_STATES.has(vic.state)) return false;
  const bits = histAt(vic, 0);
  let back: boolean, fwd: boolean;
  if (srcX > vic.x) { back = (bits & LEFT) !== 0; fwd = (bits & RIGHT) !== 0; }
  else if (srcX < vic.x) { back = (bits & RIGHT) !== 0; fwd = (bits & LEFT) !== 0; }
  else { back = vic.facing > 0 ? (bits & LEFT) !== 0 : (bits & RIGHT) !== 0; fwd = !back && (bits & (LEFT | RIGHT)) !== 0; }
  let crouch = (bits & DOWN) !== 0;
  if (vic.state === 'blockstun' && !back && !fwd) {
    // guard is held through blockstun unless the player pushes forward; stance is kept too
    back = true;
    if (!(bits & DOWN)) crouch = vic.crouchHit && (bits & 1) === 0;
  }
  if (!back) return false;
  if (level === 'low' && !crouch) return false;
  if (level === 'overhead' && crouch) return false;
  return true;
}

function inStartupOrActive(f: FighterState): boolean {
  if (f.state !== 'attack') return false;
  const m = curMove(f);
  if (!m) return false;
  let last = m.startup + m.active - 1;
  for (const h of m.hits) if (h.frames[1] > last) last = h.frames[1];
  if (m.projectile && m.projectile.frame > last) last = m.projectile.frame;
  return f.mf <= last;
}

function pushAway(vic: FighterState, srcX: number, dist: number, vacuum: boolean): void {
  if (dist <= 0) return;
  const n = 10;
  let dir = vic.x >= srcX ? 1 : -1;
  if (vic.x === srcX) dir = -vic.facing;
  if (vacuum) { dir = -dir; dist = Math.min(dist, 14); }
  const v0 = Math.round((2 * dist * FP) / n);
  vic.pushV = v0 * dir;
  vic.pushDecel = Math.max(1, Math.round(v0 / n));
}

export interface HitContext {
  proj: ProjectileState | null;
  move: MoveDef | null;
  hitIndex: number;
  cx: number;
  cy: number;
}

/** Applies a hit (or block / armor absorb). Returns the result kind. */
export function connect(s: MatchState, att: FighterState, vic: FighterState, hit: HitDef, ctx: HitContext): 'hit' | 'block' | 'armor' {
  const srcX = ctx.proj ? ctx.proj.x - ctx.proj.vx : att.x;
  const isSuper = hit.power === 'super';
  const training = s.config.training;
  // ---- armor
  if (vic.state === 'attack' && vic.armorLeft > 0 && !isSuper) {
    const vm = curMove(vic);
    if (vm?.armor && inRange(vic.mf, vm.armor.frames)) {
      vic.armorLeft--;
      const dmg = Math.max(1, Math.floor(hit.damage * 0.8));
      vic.hp -= dmg;
      if (!(training && s.config.trainingOpts.noStun)) vic.stun += Math.floor(hit.stun / 2);
      vic.stunDelay = 60;
      const hs = hit.hitstop + 2;
      vic.hitstop = hs;
      vic.shake = hs;
      if (ctx.proj) ctx.proj.hitstop = hs;
      else { att.hitstop = hs; att.contact = 3; att.moveHits |= 1 << ctx.hitIndex; }
      ev(s, 'armor', vic.idx, ctx.cx, ctx.cy, hit.power, dmg);
      return 'armor';
    }
  }
  // ---- block
  if (blocks(vic, srcX, hit.level)) {
    const wasBlockstun = vic.state === 'blockstun';
    const crouch = isCrouching(vic) || (histAt(vic, 0) & DOWN) !== 0;
    if (!wasBlockstun) setState(vic, 'blockstun');
    vic.move = '';
    vic.vx = 0;
    vic.blockstun = hit.blockstun;
    vic.crouchHit = crouch;
    let chip = hit.chip;
    if (att.drive > 0) chip *= 2;
    if (chip > 0) {
      if (isSuper) vic.hp -= chip;
      else vic.hp = Math.max(1, vic.hp - chip);
    }
    pushAway(vic, srcX, hit.pushBlock, false);
    addMeter(att, hit.meterBlock);
    addMeter(vic, 3);
    vic.hitstop = hit.hitstop;
    vic.shake = Math.floor(hit.hitstop / 2);
    if (ctx.proj) ctx.proj.hitstop = hit.hitstop;
    else {
      att.hitstop = hit.hitstop;
      att.contact = att.contact === 1 ? 1 : 2;
      att.moveHits |= 1 << ctx.hitIndex;
      trackAdvantage(s, att, true);
    }
    vic.stats.blocks++;
    ev(s, 'block', att.idx, ctx.cx, ctx.cy, hit.power, chip);
    return 'block';
  }
  // ---- hit
  const counter = inStartupOrActive(vic);
  const punish = !counter && vic.state === 'attack';
  const inCombo = vic.state === 'hitstun' || vic.state === 'juggle';
  if (!inCombo) { vic.combo = 0; vic.comboDmg = 0; vic.juggle = 0; }
  vic.combo++;
  const dmg = computeDamage(hit.damage, vic.combo, isSuper, counter && vic.combo === 1, att.drive > 0, vic.drive > 0);
  vic.hp = Math.max(0, vic.hp - dmg);
  vic.comboDmg += dmg;
  att.stats.damage += dmg;
  att.stats.hits++;
  if (vic.combo > att.stats.maxCombo) att.stats.maxCombo = vic.combo;
  if (vic.comboDmg > att.stats.maxComboDmg) att.stats.maxComboDmg = vic.comboDmg;
  // stun
  const c = getChar(vic.char);
  if (vic.state === 'dizzy') {
    vic.stun = 0;
  } else if (!(training && s.config.trainingOpts.noStun)) {
    const st = vic.burnout > 0 ? Math.floor(hit.stun * 1.25) : hit.stun;
    vic.stun += Math.floor(st * comboScale(vic.combo, false) / 100);
    vic.stunDelay = 70;
    if (vic.stun >= c.maxStun && !vic.dizzyPending) {
      vic.stun = c.maxStun;
      vic.dizzyPending = true;
    }
  }
  // meter
  addMeter(att, hit.meterHit);
  addMeter(vic, Math.max(2, Math.floor(dmg / 12)));
  // hitstop
  const hs = hit.hitstop + (counter ? 3 : 0);
  vic.hitstop = hs;
  vic.shake = hs;
  if (ctx.proj) ctx.proj.hitstop = hs;
  else {
    att.hitstop = hs;
    att.contact = 1;
    att.moveHits |= 1 << ctx.hitIndex;
  }
  vic.counter = counter;
  vic.hitY = Math.round((ctx.cy - vic.y) / FP);
  vic.move = '';
  vic.mf = 0;
  vic.grabFrame = -1;
  const dir = vic.x >= srcX ? 1 : -1;
  if (vic.air || hit.knockdown || vic.state === 'juggle') {
    const wasJuggle = vic.state === 'juggle';
    const launch = hit.launch ?? { vx: 3, vy: vic.air ? 6 : 5 };
    setState(vic, 'juggle');
    vic.air = true;
    if (vic.y <= 0) vic.y = 1;
    vic.vx = hit.vacuum ? -fx(1) * dir : fx(launch.vx) * dir;
    vic.vy = fx(launch.vy);
    vic.g = fx(0.72);
    const kd = hit.knockdown === 'hard' ? 2 : hit.knockdown === 'soft' ? 1 : 0;
    vic.kd = wasJuggle ? Math.max(vic.kd, kd) : kd;
    vic.juggle = (wasJuggle ? vic.juggle : 0) + (hit.juggleAdd ?? 1);
    vic.hitstun = hit.hitstun;
    vic.pushV = 0;
  } else {
    const crouch = isCrouching(vic);
    setState(vic, 'hitstun');
    vic.hitstun = hit.hitstun + (counter ? 2 : 0);
    if (counter && hit.crumpleOnCounter) vic.hitstun += 18;
    vic.crouchHit = crouch;
    vic.vx = 0;
    pushAway(vic, srcX, hit.pushHit, !!hit.vacuum);
  }
  vic.facing = -dir;
  if (!ctx.proj) trackAdvantage(s, att, false);
  ev(s, 'hit', att.idx, ctx.cx, ctx.cy, hit.power, dmg);
  ev(s, 'hitMove', att.idx, 0, 0, ctx.move ? ctx.move.id : ctx.proj ? ctx.proj.move : '', vic.combo);
  if (counter && vic.combo === 1) ev(s, 'counter', att.idx, ctx.cx, ctx.cy);
  else if (punish && vic.combo === 1) ev(s, 'punish', att.idx, ctx.cx, ctx.cy);
  if (vic.combo >= 2) ev(s, 'combo', att.idx, 0, 0, '', vic.combo);
  return 'hit';
}

function trackAdvantage(s: MatchState, att: FighterState, blocked: boolean): void {
  s.adv.active = true;
  s.adv.attacker = att.idx;
  s.adv.af = -1;
  s.adv.vf = -1;
  s.adv.move = att.move;
  s.adv.blocked = blocked;
}

// ---------------------------------------------------------------------------------------------
// Throws

function throwAttempt(a: FighterState, b: FighterState): MoveDef | null {
  if (a.state !== 'attack' || a.grabFrame >= 0 || a.hitstop > 0) return null;
  const m = curMove(a);
  if (!m?.throw) return null;
  if (a.mf < m.startup || a.mf > m.startup + m.active - 1) return null;
  if (isThrowInvuln(b)) return null;
  if (!!m.throw.air !== b.air) return null;
  if (b.air && b.state !== 'air' && b.state !== 'attack') return null;
  const pb = pushbox(b);
  if (!pb) return null;
  const tb = worldBox(a.x, a.y, a.facing, m.throw.box);
  return overlaps(tb, worldBox(b.x, b.y, b.facing, pb)) ? m : null;
}

function grab(s: MatchState, a: FighterState, b: FighterState, m: MoveDef): void {
  a.grabFrame = 0;
  a.contact = 1;
  a.vx = 0;
  b.pushV = 0;
  setState(b, 'thrown');
  b.grabbedBy = a.idx;
  b.move = '';
  b.vx = 0;
  b.vy = 0;
  b.techWindow = m.throw!.techable ? 8 : 0;
  b.combo = 0;
  b.comboDmg = 0;
  a.stats.throws++;
  ev(s, 'grab', a.idx, (a.x + b.x) >> 1, fx(120), m.type === 'throw' ? 'throw' : 'cmd');
}

function tech(s: MatchState, a: FighterState, b: FighterState): void {
  for (const f of [a, b]) {
    f.move = '';
    f.grabFrame = -1;
    f.grabbedBy = -1;
    f.air = false;
    f.y = 0;
    f.vy = 0;
    f.vx = 0;
    setState(f, 'tech');
    f.timer = 20;
    f.throwInv = 24;
    const other = f === a ? b : a;
    const dir = f.x < other.x ? -1 : f.x > other.x ? 1 : -f.facing;
    const v0 = Math.round((2 * 70 * FP) / 12);
    f.pushV = v0 * dir;
    f.pushDecel = Math.round(v0 / 12);
  }
  ev(s, 'tech', a.idx, (a.x + b.x) >> 1, fx(130));
}

export function resolveThrows(s: MatchState): void {
  const [a, b] = s.fighters;
  const ta = throwAttempt(a, b);
  const tb = throwAttempt(b, a);
  if (ta && tb) {
    if (ta.throw!.techable && tb.throw!.techable) tech(s, a, b);
    else if (!ta.throw!.techable) grab(s, a, b, ta);
    else grab(s, b, a, tb);
  } else if (ta) grab(s, a, b, ta);
  else if (tb) grab(s, b, a, tb);
}

/** Positions thrown victims, handles tech input and the release. */
export function updateThrowHolds(s: MatchState): void {
  // safety: a victim whose thrower let go (round end, KO...) falls free
  for (const b of s.fighters) {
    if (b.state !== 'thrown') continue;
    const a = s.fighters[1 - b.idx];
    if (b.grabbedBy >= 0 && a.state === 'attack' && a.grabFrame >= 0) continue;
    b.grabbedBy = -1;
    setState(b, 'juggle');
    b.air = true;
    if (b.y <= 0) b.y = 1;
    b.vx = 0;
    b.vy = fx(3);
    b.g = fx(0.72);
    b.kd = 1;
    b.hitstun = 0;
  }
  for (const a of s.fighters) {
    if (a.state !== 'attack' || a.grabFrame < 0) continue;
    const b = s.fighters[1 - a.idx];
    const m = curMove(a);
    if (!m?.throw || b.grabbedBy !== a.idx) continue;
    const t = m.throw;
    // tech
    if (t.techable && a.grabFrame <= 8 && matchCombo(b, ['LP', 'LK'], 10)) {
      tech(s, a, b);
      continue;
    }
    const gf = Math.min(a.grabFrame, t.release);
    const rx = lerpKeys(t.victim, gf, (k) => k.x);
    const ry = lerpKeys(t.victim, gf, (k) => k.y);
    b.x = a.x + fx(rx) * a.facing;
    b.y = a.y + fx(ry);
    b.facing = -a.facing;
    if (a.grabFrame === t.release) {
      b.grabbedBy = -1;
      b.combo = 1;
      const dmg = computeDamage(t.damage, 1, false, false, a.drive > 0, b.drive > 0);
      b.hp = Math.max(0, b.hp - dmg);
      b.comboDmg = dmg;
      a.stats.damage += dmg;
      a.stats.hits++;
      if (!(s.config.training && s.config.trainingOpts.noStun)) {
        b.stun += t.stun;
        b.stunDelay = 70;
        const c = getChar(b.char);
        if (b.stun >= c.maxStun) { b.stun = c.maxStun; b.dizzyPending = true; }
      }
      addMeter(a, 15);
      addMeter(b, 8);
      setState(b, 'juggle');
      b.air = true;
      if (b.y <= 0) b.y = 1;
      const side = t.swap ? -1 : 1;
      b.vx = fx(t.releaseVel.vx) * a.facing * side;
      b.vy = fx(t.releaseVel.vy);
      b.g = fx(0.72);
      b.kd = t.knockdown === 'hard' ? 2 : 1;
      b.juggle = 3;
      b.hitstun = 0;
      b.facing = -a.facing * side;
      a.hitstop = 8;
      b.hitstop = 8;
      b.shake = 8;
      ev(s, 'throw', a.idx, b.x, b.y + fx(80), t.power, dmg);
      ev(s, 'hit', a.idx, b.x, b.y + fx(80), t.power === 'super' ? 'super' : 'heavy', dmg);
      ev(s, 'hitMove', a.idx, 0, 0, a.move, 1);
      if (t.swap) {
        // attacker turns to face the new side
        a.facing = -a.facing;
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Strikes

interface StrikeHit { hi: number; hit: HitDef; cx: number; cy: number; m: MoveDef }

function strikeCheck(a: FighterState, b: FighterState): StrikeHit | null {
  if (a.state !== 'attack' || a.grabFrame >= 0 || a.hitstop > 0) return null;
  const m = curMove(a);
  if (!m || !m.hits.length) return null;
  if (isStrikeInvuln(b) || b.grabbedBy >= 0) return null;
  const hurts = hurtboxes(b);
  if (!hurts.length) return null;
  const crouching = isCrouching(b);
  for (let i = 0; i < m.hits.length; i++) {
    const h = m.hits[i];
    if (a.moveHits & (1 << i)) continue;
    if (a.mf < h.frames[0] || a.mf > h.frames[1]) continue;
    if (h.level === 'high' && crouching) continue;
    if (b.state === 'juggle' && (h.juggleMax === undefined || b.juggle >= h.juggleMax)) continue;
    for (const hb of h.boxes) {
      const W = worldBox(a.x, a.y, a.facing, hb);
      for (const ub of hurts) {
        const U = worldBox(b.x, b.y, b.facing, ub);
        if (overlaps(W, U)) {
          const c = contactPoint(W, U);
          return { hi: i, hit: h, cx: c.x, cy: c.y, m };
        }
      }
    }
  }
  return null;
}

export function resolveStrikes(s: MatchState): void {
  const [a, b] = s.fighters;
  const ha = strikeCheck(a, b);
  const hb = strikeCheck(b, a);
  if (ha) connect(s, a, b, ha.hit, { proj: null, move: ha.m, hitIndex: ha.hi, cx: ha.cx, cy: ha.cy });
  if (hb) connect(s, b, a, hb.hit, { proj: null, move: hb.m, hitIndex: hb.hi, cx: hb.cx, cy: hb.cy });
  if (ha && hb) ev(s, 'trade', 0, (a.x + b.x) >> 1, fx(150));
}

// ---------------------------------------------------------------------------------------------
// Projectiles

export function projDef(p: ProjectileState) {
  return getMove(p.char, p.move)!.projectile!.def;
}

export function updateProjectiles(s: MatchState): void {
  const list = s.projectiles;
  for (const p of list) {
    if (p.dead) continue;
    if (p.hitstop > 0) { p.hitstop--; continue; }
    p.age++;
    p.vy += p.ay;
    p.x += p.vx;
    p.y += p.vy;
    if (p.cooldown > 0) p.cooldown--;
    if (--p.life <= 0 || Math.abs(p.x) > fx(STAGE_HALF + 60) || p.y < -fx(40)) p.dead = true;
  }
  // clashes
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (p.dead) continue;
    for (let j = i + 1; j < list.length; j++) {
      const q = list[j];
      if (q.dead || q.owner === p.owner) continue;
      const bp = worldBox(p.x, p.y, p.facing, projDef(p).box);
      const bq = worldBox(q.x, q.y, q.facing, projDef(q).box);
      if (overlaps(bp, bq)) {
        const dp = p.durability, dq = q.durability;
        p.durability -= dq;
        q.durability -= dp;
        if (p.durability <= 0) p.dead = true;
        if (q.durability <= 0) q.dead = true;
        const c = contactPoint(bp, bq);
        ev(s, 'clash', p.owner, c.x, c.y);
      }
    }
  }
  // hits
  for (const p of list) {
    if (p.dead || p.cooldown > 0 || p.hitstop > 0) continue;
    const vic = s.fighters[1 - p.owner];
    const att = s.fighters[p.owner];
    if (isProjInvuln(vic) || vic.grabbedBy >= 0) continue;
    const def = projDef(p);
    if (vic.state === 'juggle' && (def.hit.juggleMax === undefined || vic.juggle >= def.hit.juggleMax)) continue;
    const pb = worldBox(p.x, p.y, p.facing, def.box);
    for (const ub of hurtboxes(vic)) {
      const U = worldBox(vic.x, vic.y, vic.facing, ub);
      if (!overlaps(pb, U)) continue;
      const c = contactPoint(pb, U);
      const hit: HitDef = { ...def.hit, frames: [0, 0], boxes: [] };
      connect(s, att, vic, hit, { proj: p, move: null, hitIndex: 0, cx: c.x, cy: c.y });
      p.hitsLeft--;
      p.cooldown = def.hitInterval;
      if (p.hitsLeft <= 0) p.dead = true;
      break;
    }
  }
  // compact
  let w = 0;
  for (let r = 0; r < list.length; r++) {
    const p = list[r];
    if (p.dead) {
      s.fighters[p.owner].proj = Math.max(0, s.fighters[p.owner].proj - 1);
      ev(s, 'projEnd', p.owner, p.x, p.y, projDef(p).style);
      continue;
    }
    list[w++] = p;
  }
  list.length = w;
}

