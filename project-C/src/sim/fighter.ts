/**
 * Fighter state machine: creation, per-frame state advance, input-driven actions (movement,
 * normals, specials, cancels, system mechanics) and physics.
 */
import type { Box, Btn, MoveDef, MoveType } from '../data/schema';
import {
  BUFFER_NORMAL, BUFFER_SPECIAL, GROUP_BTNS, consume, detectDash, dirAt, freshInputs, isBack, isDown,
  isUp, matchButtons, matchCombo, matchMotion, resetInput, upPressed, type BtnMatch,
} from './input';
import { TYPE_RANK, candidates, getChar, getMove, idMatches, moveTotal } from './registry';
import {
  BURNOUT_FRAMES, DRIVE_FRAMES, FP, HISTORY, MAX_SEP, METER_MAX, STAGE_HALF, ULT_HP_PCT,
  type FState, type FighterState, type MatchState,
} from './types';
import { ev, fx, inRange } from './util';

export function createFighter(idx: number, charId: string, palette: number): FighterState {
  const c = getChar(charId);
  const f: FighterState = {
    idx, char: charId, palette,
    x: 0, y: 0, vx: 0, vy: 0, g: 0, facing: idx === 0 ? 1 : -1,
    hp: c.maxHp, meter: 0, stun: 0, stunDelay: 0, dizzyPending: false,
    state: 'idle', sf: 0, move: '', mf: 0, moveHits: 0, contact: 0, armorLeft: 0,
    hitstun: 0, blockstun: 0, hitstop: 0, shake: 0, pushV: 0, pushDecel: 0,
    air: false, airAttacked: false, airJumps: 0, airDashes: 0, jumpDir: 8, juggle: 0, kd: 0, timer: 0,
    crouchHit: false, hitY: 120, counter: false, combo: 0, comboDmg: 0, throwInv: 0, grabbedBy: -1, grabFrame: -1,
    techWindow: 0, pushblockCd: 0, invuln: 0, drive: 0, burnout: 0,
    hist: new Array(HISTORY).fill(0), fz: new Array(HISTORY).fill(0), frame: 0, consumed: [-1, -1, -1, -1, -1, -1],
    chargeB: 0, chargeD: 0, chargeBRel: 999, chargeBAmt: 0, chargeDRel: 999, chargeDAmt: 0,
    proj: 0, koed: false, lastMove: '',
    stats: { damage: 0, maxCombo: 0, maxComboDmg: 0, specials: 0, supers: 0, throws: 0, blocks: 0, drives: 0, hits: 0 },
  };
  resetInput(f);
  return f;
}

/** Reset for a new round. Meter carries over between rounds. */
export function resetFighterForRound(f: FighterState, x: number, facing: number, intro: boolean): void {
  const c = getChar(f.char);
  Object.assign(f, {
    x: fx(x), y: 0, vx: 0, vy: 0, g: 0, facing, hp: c.maxHp, stun: 0, stunDelay: 0, dizzyPending: false,
    state: intro ? 'intro' : 'idle', sf: 0, move: '', mf: 0, moveHits: 0, contact: 0, armorLeft: 0,
    hitstun: 0, blockstun: 0, hitstop: 0, shake: 0, pushV: 0, pushDecel: 0, air: false, airAttacked: false,
    airJumps: 0, airDashes: 0, juggle: 0, kd: 0, timer: 0, crouchHit: false, counter: false, combo: 0,
    comboDmg: 0, throwInv: 0, grabbedBy: -1, grabFrame: -1, techWindow: 0, pushblockCd: 0, invuln: 0,
    drive: 0, burnout: 0, proj: 0, koed: false,
  });
}

export function curMove(f: FighterState): MoveDef | undefined {
  return f.move ? getMove(f.char, f.move) : undefined;
}

// ---------------------------------------------------------------------------------------------
// Queries

export function isCrouching(f: FighterState): boolean {
  switch (f.state) {
    case 'crouch': return true;
    case 'guard': case 'blockstun': return isDown(dirAt(f, 0));
    case 'hitstun': return f.crouchHit;
    case 'attack': return curMove(f)?.stance === 'crouch';
    case 'land': return isDown(dirAt(f, 0));
    default: return false;
  }
}

/** Neutral ground states where the fighter can freely act. */
export function isGroundNeutral(f: FighterState): boolean {
  return f.state === 'idle' || f.state === 'walkF' || f.state === 'walkB' || f.state === 'crouch' || f.state === 'guard';
}

/** "Actionable" for frame-advantage tracking. */
export function isActionable(f: FighterState): boolean {
  return isGroundNeutral(f) || f.state === 'prejump' || (f.state === 'air' && !f.airAttacked);
}

export function hurtboxes(f: FighterState): Box[] {
  const c = getChar(f.char);
  switch (f.state) {
    case 'attack': {
      const m = curMove(f);
      if (!m) break;
      if (f.grabFrame >= 0) return c.hurt.stand;
      let boxes = m.hurt[0].boxes;
      for (const k of m.hurt) if (k.f <= f.mf) boxes = k.boxes;
      return boxes;
    }
    case 'air': case 'juggle': case 'airdash': case 'airRecover': return c.hurt.air;
    case 'down': case 'ko': case 'thrown': return [];
  }
  if (f.air) return c.hurt.air;
  return isCrouching(f) ? c.hurt.crouch : c.hurt.stand;
}

export function pushbox(f: FighterState): Box | null {
  const c = getChar(f.char);
  if (f.state === 'down' || f.state === 'ko' || f.state === 'thrown' || f.grabbedBy >= 0) return null;
  if (f.state === 'attack') {
    const m = curMove(f);
    if (m?.push) return m.push;
    if (f.grabFrame >= 0) return null;
  }
  if (f.air) return c.push.air;
  return isCrouching(f) ? c.push.crouch : c.push.stand;
}

function moveInvuln(f: FighterState, kind: 'strike' | 'throw' | 'proj'): boolean {
  if (f.state !== 'attack') return false;
  const m = curMove(f);
  return !!m?.invuln && inRange(f.mf, m.invuln[kind]);
}

export function isStrikeInvuln(f: FighterState): boolean {
  if (f.invuln > 0) return true;
  if (f.state === 'attack' && f.grabFrame >= 0) return true; // throws can't be interrupted
  switch (f.state) {
    case 'down': case 'wakeup': case 'thrown': case 'ko': case 'intro': case 'win': case 'lose': return true;
    case 'dashB': return f.sf <= getChar(f.char).dashB.invuln;
  }
  return moveInvuln(f, 'strike');
}

export function isProjInvuln(f: FighterState): boolean {
  return isStrikeInvuln(f) || moveInvuln(f, 'proj');
}

export function isThrowInvuln(f: FighterState): boolean {
  if (f.throwInv > 0 || f.invuln > 0) return true;
  switch (f.state) {
    case 'hitstun': case 'blockstun': case 'juggle': case 'down': case 'wakeup': case 'thrown':
    case 'tech': case 'ko': case 'intro': case 'win': case 'lose':
      return true;
    case 'dashB': return f.sf <= getChar(f.char).dashB.invuln + 4;
  }
  return moveInvuln(f, 'throw');
}

// ---------------------------------------------------------------------------------------------
// Transitions

export function setState(f: FighterState, st: FState): void {
  f.state = st;
  f.sf = 0;
}

function endCombo(s: MatchState, f: FighterState): void {
  if (f.combo > 0) {
    if (f.combo >= 2) ev(s, 'comboEnd', 1 - f.idx, 0, 0, '', f.combo);
    f.combo = 0;
    f.comboDmg = 0;
  }
  f.juggle = 0;
  f.counter = false;
}

/** Return to a neutral grounded state. */
export function toNeutral(s: MatchState, f: FighterState): void {
  f.move = '';
  f.mf = 0;
  f.grabFrame = -1;
  f.vx = 0;
  f.air = false;
  f.y = 0;
  f.vy = 0;
  f.airAttacked = false;
  endCombo(s, f);
  if (f.dizzyPending) {
    f.dizzyPending = false;
    setState(f, 'dizzy');
    f.timer = 170;
    ev(s, 'dizzy', f.idx, f.x, f.y + fx(200));
    return;
  }
  setState(f, isDown(dirAt(f, 0)) ? 'crouch' : 'idle');
}

export function faceOpponent(f: FighterState, opp: FighterState): void {
  if (opp.x > f.x) f.facing = 1;
  else if (opp.x < f.x) f.facing = -1;
}

// ---------------------------------------------------------------------------------------------
// Move selection

const TYPES_NEUTRAL: MoveType[] = ['normal', 'command', 'throw', 'special', 'ex', 'super', 'ultimate', 'drive'];
const TYPES_PREJUMP: MoveType[] = ['special', 'ex', 'super', 'ultimate'];
const TYPES_AIR: MoveType[] = ['normal', 'command', 'special', 'ex', 'super'];
const TYPES_BLOCK: MoveType[] = ['guardcancel', 'pushblock'];

interface Ctx {
  types: MoveType[];
  stances: ('stand' | 'crouch' | 'air')[];
  /** Restrict normals to this set (chains). */
  normals?: string[];
  from?: MoveDef;
}

interface Choice { m: MoveDef; bm: BtnMatch; score: number }

const STRENGTH: Record<string, number> = { L: 1, M: 2, H: 3, EX: 4 };

function inputMatch(f: FighterState, m: MoveDef): { bm: BtnMatch; mAge: number } | null {
  const req = m.input;
  const buffer = req.motion || m.type === 'guardcancel' || m.type === 'pushblock' ? BUFFER_SPECIAL : BUFFER_NORMAL;
  let bm: BtnMatch | null = null;
  if (req.combo) bm = matchCombo(f, req.combo, buffer);
  else if (req.two) bm = matchButtons(f, GROUP_BTNS[req.two], 2, buffer, false);
  else if (req.anyOf) bm = matchButtons(f, GROUP_BTNS[req.anyOf], 1, buffer, true);
  else if (req.btn) bm = matchButtons(f, [req.btn], 1, buffer, !!req.motion);
  if (!bm) return null;
  if (req.dirs && !req.dirs.includes(dirAt(f, bm.age))) return null;
  let mAge = bm.age;
  if (req.motion) {
    mAge = matchMotion(f, req.motion, bm.age);
    if (mAge < 0) return null;
  }
  return { bm, mAge };
}

function eligible(s: MatchState, f: FighterState, m: MoveDef, ctx: Ctx): boolean {
  if (!ctx.types.includes(m.type)) return false;
  if (!ctx.stances.includes(m.stance)) return false;
  if (m.meterCost && f.meter < m.meterCost) return false;
  if (m.lowHp && f.hp * 100 > getChar(f.char).maxHp * ULT_HP_PCT) return false;
  if (m.oneProjectile && f.proj > 0) return false;
  if ((m.type === 'normal' || m.type === 'command') && ctx.normals && !ctx.normals.includes(m.id)) return false;
  if (m.followFrom) {
    if (!ctx.from) return false;
    const fromId = ctx.from.id;
    if (!m.followFrom.some((p) => idMatches(fromId, p))) return false;
  }
  if (m.type === 'pushblock' && f.pushblockCd > 0) return false;
  if (m.type === 'drive' && (f.drive > 0)) return false;
  void s;
  return true;
}

function selectMove(s: MatchState, f: FighterState, ctx: Ctx): Choice | null {
  let best: Choice | null = null;
  for (const m of candidates(f.char)) {
    if (best && TYPE_RANK[m.type] * 10000 + 9999 < best.score) break;
    if (!eligible(s, f, m, ctx)) continue;
    const r = inputMatch(f, m);
    if (!r) continue;
    const st = m.id.slice(m.id.lastIndexOf('_') + 1);
    const score = TYPE_RANK[m.type] * 10000 - r.mAge * 100 + (m.priority ?? 0) * 10 + (STRENGTH[st] ?? 0);
    if (!best || score > best.score) best = { m, bm: r.bm, score };
  }
  return best;
}

/** Context of allowed cancels from the current move, or null if no cancel is possible now. */
function cancelCtx(f: FighterState, m: MoveDef): Ctx | null {
  const types: MoveType[] = [];
  let normals: string[] | undefined;
  const c = m.cancel;
  const contactOk = (on: 'hit' | 'contact' | 'any') =>
    on === 'any' || (on === 'hit' ? f.contact === 1 || f.contact === 3 : f.contact > 0);
  if (c && f.mf >= c.window[0] && f.mf <= c.window[1] && contactOk(c.on)) {
    for (const k of c.into) {
      if (k === 'chain') { types.push('normal', 'command'); normals = m.chainTo ?? []; }
      if (k === 'special') types.push('special', 'ex');
      if (k === 'super') types.push('super', 'ultimate');
      if (k === 'drive') types.push('drive');
    }
  }
  // Storm Drive: any normal or special cancels into any normal / special on contact.
  if (f.drive > 0 && f.contact > 0 && f.mf >= 3 && (m.type === 'normal' || m.type === 'command' || m.type === 'special' || m.type === 'ex')) {
    if (!types.includes('normal')) { types.push('normal', 'command'); normals = undefined; }
    else normals = undefined;
    if (!types.includes('special')) types.push('special', 'ex');
    if (!types.includes('super')) types.push('super', 'ultimate');
  }
  // Rekka-style follow-ups are allowed after the move regardless of contact within its window.
  const followOk = c && f.mf >= c.window[0] && f.mf <= c.window[1] + 6;
  if (followOk && !types.includes('special')) types.push('special', 'ex');
  if (!types.length) return null;
  const stances: ('stand' | 'crouch' | 'air')[] = m.stance === 'air' ? ['air'] : ['stand', 'crouch'];
  const ctx: Ctx = { types, stances, normals, from: m };
  // When only follow-ups unlocked specials (no regular special cancel), limit to follow-ups.
  if (followOk && !(c && contactOk(c.on) && c.into.includes('special')) && !(f.drive > 0 && f.contact > 0)) {
    (ctx as Ctx & { followOnly?: boolean }).followOnly = true;
  }
  return ctx;
}

// ---------------------------------------------------------------------------------------------
// Starting moves

export function startMove(s: MatchState, f: FighterState, opp: FighterState, m: MoveDef, bm: BtnMatch | null, isCancel: boolean): void {
  if (bm) for (const b of bm.btns) consume(f, b as Btn, bm.age);
  const wasAir = f.air;
  if (!isCancel && m.stance !== 'air') faceOpponent(f, opp);
  setState(f, 'attack');
  f.move = m.id;
  f.mf = 1;
  f.moveHits = 0;
  f.contact = 0;
  f.grabFrame = -1;
  f.armorLeft = m.armor ? m.armor.hits : 0;
  f.lastMove = m.id;
  if (m.meterCost) f.meter = Math.max(0, f.meter - m.meterCost);
  if (m.stance === 'air') {
    f.airAttacked = true;
  } else if (!wasAir) {
    f.vx = 0;
  }
  applyMoveKeys(f, m);
  if (m.superFreeze) {
    s.freeze = m.superFreeze;
    s.freezeOwner = f.idx;
    s.freezeKind = m.type;
  }
  const isSpecial = m.type === 'special' || m.type === 'ex';
  if (isSpecial) f.stats.specials++;
  if (m.type === 'super' || m.type === 'ultimate') f.stats.supers++;
  if (m.type === 'drive') {
    f.drive = DRIVE_FRAMES;
    f.burnout = 0;
    f.stats.drives++;
    // Drive cancel: recovery of the previous move is skipped; opponent stays in stun.
  }
  if (m.meterWhiff && !m.meterCost && f.burnout <= 0) f.meter = Math.min(METER_MAX, f.meter + m.meterWhiff);
  const evType = m.type === 'super' ? 'super' : m.type === 'ultimate' ? 'ult' : m.type === 'drive' ? 'drive'
    : m.type === 'guardcancel' ? 'guardcancel' : isSpecial ? 'special' : m.type === 'throw' ? 'throwStart' : 'attack';
  const power = m.hits.length ? m.hits[0].power : 'light';
  ev(s, evType, f.idx, f.x, f.y, m.id, power === 'light' ? 0 : power === 'medium' ? 1 : 2);
}

function applyMoveKeys(f: FighterState, m: MoveDef): void {
  if (!m.move) return;
  for (const k of m.move) {
    if (k.f !== f.mf) continue;
    if (k.vx !== undefined) f.vx = fx(k.vx) * f.facing;
    if (k.vy !== undefined) {
      f.vy = fx(k.vy);
      if (f.vy > 0) f.air = true;
    }
    if (k.g !== undefined) f.g = fx(k.g);
  }
}

// ---------------------------------------------------------------------------------------------
// Per-frame update

/**
 * Advances timers/state for one frame (when not in hitstop) and processes actions.
 * `canAct` is false during intros / round end.
 */
export function updateFighter(s: MatchState, f: FighterState, opp: FighterState, canAct: boolean): void {
  if (f.throwInv > 0) f.throwInv--;
  if (f.invuln > 0) f.invuln--;
  if (f.pushblockCd > 0) f.pushblockCd--;
  if (f.techWindow > 0) f.techWindow--;
  if (f.drive > 0) {
    f.drive--;
    if (f.drive === 0) { f.burnout = BURNOUT_FRAMES; ev(s, 'burnout', f.idx, f.x, f.y); }
  } else if (f.burnout > 0) f.burnout--;
  // Stun recovery
  if (f.stunDelay > 0) f.stunDelay--;
  else if (f.stun > 0 && !f.dizzyPending && f.state !== 'dizzy') f.stun = Math.max(0, f.stun - 3);

  f.sf++;
  advanceState(s, f, opp);
  if (canAct) act(s, f, opp);
  else if (isGroundNeutral(f)) {
    if (f.state !== 'idle') setState(f, 'idle');
    f.vx = 0;
  }
}

function advanceState(s: MatchState, f: FighterState, opp: FighterState): void {
  const c = getChar(f.char);
  switch (f.state) {
    case 'prejump':
      if (--f.timer <= 0) launchJump(s, f);
      break;
    case 'land':
    case 'tech':
      if (--f.timer <= 0) toNeutral(s, f);
      break;
    case 'dashF': case 'dashB': {
      const d = f.state === 'dashF' ? c.dashF : c.dashB;
      if (f.sf > d.frames) { toNeutral(s, f); break; }
      // decelerating curve whose sum equals the dash distance
      const n = d.frames, i = f.sf;
      const v = Math.round((2 * d.dist * FP * (n - i + 0.5)) / (n * n));
      f.vx = (f.state === 'dashF' ? v : -v) * f.facing;
      break;
    }
    case 'airdash':
      if (f.sf > 18) { setState(f, 'air'); f.vx = Math.round(f.vx / 2); f.g = fx(c.jump.g); }
      break;
    case 'attack': advanceAttack(s, f, opp); break;
    // N frames of stun = N full frames after hitstop; actionable on the following frame.
    case 'hitstun':
      if (f.hitstun-- <= 0) { f.hitstun = 0; toNeutral(s, f); f.throwInv = 5; }
      break;
    case 'blockstun':
      if (f.blockstun-- <= 0) { f.blockstun = 0; toNeutral(s, f); f.throwInv = 4; }
      break;
    case 'juggle':
      if (f.hitstun > 0) f.hitstun--;
      else if (f.kd === 0 && !f.koed && f.sf > 6 && anyPress(f)) {
        setState(f, 'airRecover');
        f.invuln = 12;
        f.vx = -fx(2) * f.facing;
        f.vy = Math.max(f.vy, fx(4));
        f.g = fx(c.jump.g);
        endCombo(s, f);
        ev(s, 'airRecover', f.idx, f.x, f.y + fx(100));
      }
      break;
    case 'down':
      if (f.kd === 1 && f.sf > 4 && f.sf < 18 && f.timer > 8 && anyPress(f) && !f.koed) {
        f.timer = 8;
        ev(s, 'quickRise', f.idx, f.x, f.y);
      }
      if (--f.timer <= 0) {
        if (f.koed) break;
        setState(f, 'wakeup');
        f.timer = 16;
      }
      break;
    case 'wakeup':
      if (--f.timer <= 0) { toNeutral(s, f); f.throwInv = 4; ev(s, 'wakeup', f.idx, f.x, f.y); }
      break;
    case 'dizzy':
      f.timer -= 1 + freshInputs(f) * 3;
      if (f.timer <= 0) { f.stun = 0; toNeutral(s, f); }
      break;
    default:
      break;
  }
}

function anyPress(f: FighterState): boolean {
  return matchButtons(f, ['LP', 'MP', 'HP', 'LK', 'MK', 'HK'], 1, 0, false) !== null;
}

function launchJump(s: MatchState, f: FighterState): void {
  const c = getChar(f.char);
  const d = dirAt(f, 0);
  const dir = isUp(d) ? d : f.jumpDir;
  f.jumpDir = dir;
  setState(f, 'air');
  f.air = true;
  f.airAttacked = false;
  f.airJumps = c.airJumps;
  f.airDashes = c.airDashes;
  f.vy = fx(c.jump.vy);
  f.g = fx(c.jump.g);
  f.vx = dir === 9 ? fx(c.jump.vxF) * f.facing : dir === 7 ? -fx(c.jump.vxB) * f.facing : 0;
  f.y = 1;
  ev(s, 'jump', f.idx, f.x, f.y);
}

function advanceAttack(s: MatchState, f: FighterState, opp: FighterState): void {
  const m = curMove(f);
  if (!m) { toNeutral(s, f); return; }
  // Throw hold in progress
  if (f.grabFrame >= 0 && m.throw) {
    f.grabFrame++;
    if (f.grabFrame > m.throw.duration) toNeutral(s, f);
    return;
  }
  f.mf++;
  applyMoveKeys(f, m);
  if (m.projectile && f.mf === m.projectile.frame) spawnProjectile(s, f, m);
  if (m.teleport && f.mf === m.teleport.f) teleport(s, f, opp, m);
  const total = moveTotal(m);
  if (m.stance === 'air') {
    if (f.mf > total) { f.move = ''; setState(f, 'air'); }
    return;
  }
  if (m.airborne && f.air) return; // ends on landing
  if (f.mf > total) {
    // after an aerial teleport the fighter may still attack on the way down
    if (f.air) { f.move = ''; setState(f, 'air'); f.airAttacked = !m.teleport; }
    else toNeutral(s, f);
  }
}

function teleport(s: MatchState, f: FighterState, opp: FighterState, m: MoveDef): void {
  const t = m.teleport!;
  const side = opp.x >= f.x ? 1 : -1;
  let nx = opp.x;
  if (t.rel === 'behind') nx = opp.x + side * fx(t.dist);
  else if (t.rel === 'front') nx = opp.x - side * fx(t.dist);
  else nx = opp.x + side * fx(t.dist);
  const lim = fx(STAGE_HALF - 30);
  if (nx > lim || nx < -lim) nx = opp.x - side * fx(t.dist); // can't go behind a cornered opponent
  ev(s, 'teleportOut', f.idx, f.x, f.y + fx(120));
  f.x = Math.max(-lim, Math.min(lim, nx));
  if (t.height) { f.y = fx(t.height); f.air = true; f.vy = 0; f.vx = 0; f.g = fx(getChar(f.char).jump.g); }
  faceOpponent(f, opp);
  ev(s, 'teleportIn', f.idx, f.x, f.y + fx(120));
}

function spawnProjectile(s: MatchState, f: FighterState, m: MoveDef): void {
  const p = m.projectile!;
  const d = p.def;
  s.projectiles.push({
    id: s.nextProjId++, owner: f.idx, char: f.char, move: m.id,
    x: f.x + fx(p.x) * f.facing, y: f.y + fx(p.y), vx: fx(d.vx) * f.facing, vy: fx(d.vy), ay: fx(d.ay ?? 0),
    facing: f.facing, life: d.life, hitsLeft: d.hits, cooldown: 0, durability: d.durability, hitstop: 0, age: 0, dead: false,
  });
  f.proj++;
  ev(s, 'proj', f.idx, f.x + fx(p.x) * f.facing, f.y + fx(p.y), d.style);
}

/** Danger check for proximity guard: opponent attacking nearby or a projectile approaching. */
function threatened(s: MatchState, f: FighterState, opp: FighterState): boolean {
  if (opp.state === 'attack') {
    const m = curMove(opp);
    if (m && m.hits.length && Math.abs(opp.x - f.x) < fx(320)) {
      const lastActive = m.hits[m.hits.length - 1].frames[1];
      if (opp.mf <= lastActive) return true;
    }
  }
  for (const p of s.projectiles) {
    if (p.owner === f.idx || p.dead) continue;
    const dx = f.x - p.x;
    if (Math.abs(dx) < fx(360) && Math.sign(dx) === Math.sign(p.vx)) return true;
  }
  return false;
}

function act(s: MatchState, f: FighterState, opp: FighterState): void {
  // Blockstun: guard cancel / pushblock
  if (f.state === 'blockstun') {
    const ch = selectMove(s, f, { types: TYPES_BLOCK, stances: ['stand', 'crouch'] });
    if (ch) {
      if (ch.m.type === 'pushblock') doPushblock(s, f, opp, ch);
      else {
        f.blockstun = 0;
        startMove(s, f, opp, ch.m, ch.bm, false);
      }
    }
    return;
  }
  if (f.state === 'attack') {
    const m = curMove(f);
    if (!m || f.grabFrame >= 0) return;
    const ctx = cancelCtx(f, m);
    if (!ctx) return;
    const ch = selectMove(s, f, ctx);
    if (!ch) return;
    if ((ctx as Ctx & { followOnly?: boolean }).followOnly && !ch.m.followFrom) return;
    if (ch.m.id === m.id && ch.m.type !== 'normal') return;
    if (ch.m.type === 'drive') ev(s, 'driveCancel', f.idx, f.x, f.y);
    startMove(s, f, opp, ch.m, ch.bm, true);
    return;
  }
  if (f.state === 'prejump') {
    const ch = selectMove(s, f, { types: TYPES_PREJUMP, stances: ['stand', 'crouch'] });
    if (ch) startMove(s, f, opp, ch.m, ch.bm, false);
    return;
  }
  if (f.state === 'air') {
    airAct(s, f, opp);
    return;
  }
  if (!isGroundNeutral(f)) return;

  faceOpponent(f, opp);
  const ch = selectMove(s, f, { types: TYPES_NEUTRAL, stances: ['stand', 'crouch'] });
  if (ch) { startMove(s, f, opp, ch.m, ch.bm, false); return; }

  const c = getChar(f.char);
  const dash = detectDash(f);
  if (dash !== 0) {
    setState(f, dash > 0 ? 'dashF' : 'dashB');
    f.sf = 1;
    ev(s, 'dash', f.idx, f.x, f.y, dash > 0 ? 'f' : 'b');
    advanceState(s, f, opp);
    return;
  }
  const d = dirAt(f, 0);
  if (isUp(d)) {
    setState(f, 'prejump');
    f.timer = c.jump.prejump;
    f.jumpDir = d;
    f.vx = 0;
    return;
  }
  const threat = isBack(d) && threatened(s, f, opp);
  if (isDown(d)) {
    if (f.state !== 'crouch') setState(f, 'crouch');
    f.vx = 0;
    return;
  }
  if (d === 6) {
    if (f.state !== 'walkF') setState(f, 'walkF');
    f.vx = fx(c.walkF) * f.facing;
  } else if (d === 4) {
    if (threat) {
      if (f.state !== 'guard') setState(f, 'guard');
      f.vx = 0;
    } else {
      if (f.state !== 'walkB') setState(f, 'walkB');
      f.vx = -fx(c.walkB) * f.facing;
    }
  } else {
    if (f.state !== 'idle') setState(f, 'idle');
    f.vx = 0;
  }
}

function airAct(s: MatchState, f: FighterState, opp: FighterState): void {
  const c = getChar(f.char);
  if (!f.airAttacked) {
    const ch = selectMove(s, f, { types: TYPES_AIR, stances: ['air'] });
    if (ch) { startMove(s, f, opp, ch.m, ch.bm, false); return; }
  }
  // Double jump
  if (f.airJumps > 0 && f.sf > 6 && upPressed(f)) {
    f.airJumps--;
    const d = dirAt(f, 0);
    f.vy = fx(c.jump.vy * 0.85);
    f.vx = d === 9 ? fx(c.jump.vxF) * f.facing : d === 7 ? -fx(c.jump.vxB) * f.facing : 0;
    f.airAttacked = false;
    setState(f, 'air');
    ev(s, 'doubleJump', f.idx, f.x, f.y);
    return;
  }
  // Air dash
  if (f.airDashes > 0 && f.y > fx(70) && f.sf > 3) {
    const dash = detectDash(f);
    if (dash !== 0) {
      f.airDashes--;
      setState(f, 'airdash');
      f.vx = fx(dash > 0 ? 9 : -7) * f.facing;
      f.vy = 0;
      f.g = 0;
      ev(s, 'dash', f.idx, f.x, f.y, dash > 0 ? 'af' : 'ab');
    }
  }
}

function doPushblock(s: MatchState, f: FighterState, opp: FighterState, ch: Choice): void {
  for (const b of ch.bm.btns) consume(f, b as Btn, ch.bm.age);
  f.pushblockCd = 30;
  f.blockstun += 2;
  const dir = opp.x >= f.x ? 1 : -1;
  if (!opp.air) {
    const n = 12, dist = 150;
    opp.pushV = Math.round((2 * dist * FP) / n) * dir;
    opp.pushDecel = Math.round(Math.abs(opp.pushV) / n);
  }
  f.lastMove = 'pushblock';
  ev(s, 'pushblock', f.idx, f.x, f.y + fx(110));
}

// ---------------------------------------------------------------------------------------------
// Physics

export function physics(s: MatchState, f: FighterState, opp: FighterState): void {
  if (f.state === 'thrown') return;
  if (f.air) {
    f.x += f.vx;
    f.y += f.vy;
    f.vy -= f.g;
    if (f.y <= 0 && f.vy <= 0) land(s, f, opp);
  } else {
    f.x += f.vx;
  }
  // pushback with wall transfer
  if (f.pushV !== 0) {
    const want = f.pushV;
    const before = f.x;
    f.x += want;
    clampToStage(f);
    const blocked = want - (f.x - before);
    if (blocked !== 0 && !opp.air && opp.state !== 'thrown') {
      opp.x -= blocked;
      clampToStage(opp);
    }
    const dec = f.pushDecel || 1;
    if (f.pushV > 0) f.pushV = Math.max(0, f.pushV - dec);
    else f.pushV = Math.min(0, f.pushV + dec);
  }
  clampToStage(f);
}

export function clampToStage(f: FighterState): void {
  const lim = fx(STAGE_HALF - 26);
  if (f.x > lim) f.x = lim;
  if (f.x < -lim) f.x = -lim;
}

function land(s: MatchState, f: FighterState, opp: FighterState): void {
  f.y = 0;
  f.vy = 0;
  f.air = false;
  f.airAttacked = false;
  const c = getChar(f.char);
  switch (f.state) {
    case 'attack': {
      const m = curMove(f);
      f.vx = 0;
      if (m && (m.stance === 'air' || m.airborne)) {
        f.move = '';
        setState(f, 'land');
        f.timer = m.landingLag ?? 3;
      }
      break;
    }
    case 'juggle':
      f.vx = 0;
      if (f.koed) { setState(f, 'ko'); ev(s, 'land', f.idx, f.x, 0, 'heavy'); break; }
      if (f.kd > 0) {
        setState(f, 'down');
        f.timer = f.kd === 2 ? 48 : 34;
        ev(s, 'knockdown', f.idx, f.x, 0, f.kd === 2 ? 'hard' : 'soft');
        endCombo(s, f);
      } else {
        setState(f, 'land');
        f.timer = 6;
        endCombo(s, f);
      }
      break;
    case 'air': case 'airdash': case 'airRecover':
      setState(f, 'land');
      f.timer = 3;
      f.vx = 0;
      ev(s, 'land', f.idx, f.x, 0, 'light');
      break;
    default:
      f.vx = 0;
  }
  void c;
  faceOpponentIfGrounded(f, opp);
}

function faceOpponentIfGrounded(f: FighterState, opp: FighterState): void {
  if (f.state === 'land' || f.state === 'down') faceOpponent(f, opp);
}

/** Pushbox separation and the camera distance limit. */
export function resolvePush(s: MatchState, prevX: [number, number]): void {
  const [a, b] = s.fighters;
  const pa = pushbox(a), pb = pushbox(b);
  if (pa && pb) {
    const la = a.facing > 0 ? a.x + fx(pa.x) : a.x - fx(pa.x + pa.w);
    const ra = la + fx(pa.w);
    const lb = b.facing > 0 ? b.x + fx(pb.x) : b.x - fx(pb.x + pb.w);
    const rb = lb + fx(pb.w);
    const ba = a.y + fx(pa.y), ta = ba + fx(pa.h);
    const bb = b.y + fx(pb.y), tb = bb + fx(pb.h);
    if (la < rb && lb < ra && ba < tb && bb < ta) {
      // a is left of b?
      let aLeft = a.x < b.x || (a.x === b.x && a.facing > 0);
      if (a.x === b.x && prevX[0] !== prevX[1]) aLeft = prevX[0] < prevX[1];
      const overlap = aLeft ? ra - lb : rb - la;
      let da = -(overlap >> 1), db = overlap - (overlap >> 1);
      if (!aLeft) { da = -da; db = -db; }
      a.x += da;
      b.x += db;
      // walls: if one is stuck, move the other
      const lim = fx(STAGE_HALF - 26);
      for (const [f, o] of [[a, b], [b, a]] as const) {
        if (f.x > lim) { o.x -= f.x - lim; f.x = lim; }
        if (f.x < -lim) { o.x += -lim - f.x; f.x = -lim; }
      }
    }
  }
  // Camera limit: the fighter moving away is held back.
  const dist = Math.abs(a.x - b.x);
  const max = fx(MAX_SEP);
  if (dist > max) {
    const excess = dist - max;
    const left = a.x < b.x ? a : b, right = left === a ? b : a;
    const li = left.idx, ri = right.idx;
    const lOut = Math.max(0, prevX[li] - left.x);
    const rOut = Math.max(0, right.x - prevX[ri]);
    const tot = lOut + rOut;
    if (tot > 0) {
      const lFix = Math.round((excess * lOut) / tot);
      left.x += lFix;
      right.x -= excess - lFix;
    } else {
      left.x += excess >> 1;
      right.x -= excess - (excess >> 1);
    }
  }
}
