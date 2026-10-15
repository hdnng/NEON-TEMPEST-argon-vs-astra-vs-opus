/**
 * CPU opponent. It plays through the SAME input system as humans: every decision is turned into
 * per-frame input bits (motions are actually rolled, charges actually held). It perceives the
 * opponent through a delay line (reaction time per difficulty), confirms hits with a delay,
 * makes execution errors and adds timing jitter, so it never acts frame-perfectly.
 *
 * Behaviour layers (highest priority first): defensive reactions (block, tech, wakeup reversal,
 * anti-air, projectile answers), combo continuation (hit-confirm), punishes, then a per-character
 * personality driving neutral (zoning, footsies, approach, jump-ins, throws, meter use).
 */
import type { AIPersonality, MoveDef } from '../data/schema';
import { curMove } from '../sim/fighter';
import { DOWN, HK, HP, LEFT, LK, LP, MK, MP, RIGHT, UP } from '../sim/input';
import { candidates, getChar, getMove, moveTotal } from '../sim/registry';
import { Rng } from '../sim/rng';
import { FP, ULT_HP_PCT, type FighterState, type MatchState } from '../sim/types';
import type { Controller } from '../scenes/match/controllers';

export interface Difficulty {
  reaction: number;
  block: number;
  antiAir: number;
  punish: number;
  confirm: number;
  error: number;
  tech: number;
  reversal: number;
  aggression: number;
  jitter: number;
}

export const DIFFICULTIES: Difficulty[] = [
  { reaction: 26, block: 0.35, antiAir: 0.22, punish: 0.25, confirm: 0.35, error: 0.16, tech: 0.12, reversal: 0.1, aggression: 0.7, jitter: 3 },
  { reaction: 18, block: 0.62, antiAir: 0.5, punish: 0.55, confirm: 0.65, error: 0.07, tech: 0.32, reversal: 0.25, aggression: 0.9, jitter: 2 },
  { reaction: 13, block: 0.82, antiAir: 0.75, punish: 0.8, confirm: 0.85, error: 0.03, tech: 0.5, reversal: 0.4, aggression: 1, jitter: 1 },
  { reaction: 10, block: 0.9, antiAir: 0.88, punish: 0.9, confirm: 0.94, error: 0.01, tech: 0.62, reversal: 0.5, aggression: 1.1, jitter: 1 },
];

interface Snap {
  x: number; y: number; vx: number; vy: number; air: boolean; state: string; move: string; mf: number;
  hp: number; projX: number; projVx: number; projOwner: number;
}

const BTN: Record<string, number> = { LP, MP, HP, LK, MK, HK };

/** Precomputed per-move facts used by the AI. */
interface MoveInfo {
  m: MoveDef;
  reach: number;
  low: boolean;
  overhead: boolean;
  antiAir: boolean;
  invuln: boolean;
  startup: number;
  onBlock: number;
  kd: boolean;
}

const infoCache = new Map<string, Map<string, MoveInfo>>();

function moveInfos(charId: string): Map<string, MoveInfo> {
  let map = infoCache.get(charId);
  if (map) return map;
  map = new Map();
  for (const m of candidates(charId)) {
    let reach = 0, low = false, overhead = false, antiAir = false, kd = false;
    for (const h of m.hits) {
      for (const b of h.boxes) {
        reach = Math.max(reach, b.x + b.w);
        if (b.y + b.h > 200 && b.y > 90) antiAir = true;
      }
      if (h.level === 'low') low = true;
      if (h.level === 'overhead') overhead = true;
      if (h.knockdown) kd = true;
    }
    if (m.projectile) reach = 900;
    if (m.throw) reach = m.throw.box.x + m.throw.box.w;
    const last = m.hits[m.hits.length - 1];
    const total = moveTotal(m);
    const onBlock = last ? last.blockstun - (total - last.frames[0]) : -30;
    const invuln = !!m.invuln?.strike && m.invuln.strike[0] <= 1 && m.invuln.strike[1] >= 4;
    map.set(m.id, { m, reach, low, overhead, antiAir, invuln, startup: m.startup, onBlock, kd });
  }
  infoCache.set(charId, map);
  return map;
}

export class CpuController implements Controller {
  readonly kind = 'cpu';
  private rng: Rng;
  private d: Difficulty;
  private plan: number[] = [];
  private hold = 0;
  private holdFrames = 0;
  private snaps: Snap[] = [];
  private snapI = 0;
  private route: string[] | null = null;
  private routeStep = 0;
  private confirmT = 0;
  private lastContactMove = '';
  private neutralCooldown = 0;
  private walkDir = 0;
  private techRoll = -1;
  private wakeRoll = -1;
  private lastState = '';
  private personality: AIPersonality;
  private infos: Map<string, MoveInfo>;
  private charId = '';
  private blockStick = 0;
  private aaCooldown = 0;

  constructor(private idx: number, difficulty: number, seed: number) {
    this.rng = new Rng(seed);
    this.d = DIFFICULTIES[Math.max(0, Math.min(3, difficulty))];
    for (let i = 0; i < 40; i++) this.snaps.push({ x: 0, y: 0, vx: 0, vy: 0, air: false, state: 'idle', move: '', mf: 0, hp: 0, projX: 0, projVx: 0, projOwner: -1 });
    this.personality = { aggression: 0.5, zoning: 0.5, jumpiness: 0.2, grabby: 0.2, antiAirMove: '', pokes: [], combos: [], blockstrings: [], preferredRange: 220, meterUse: 0.5 };
    this.infos = new Map();
  }

  // ------------------------------------------------------------------ helpers

  private perceive(s: MatchState): void {
    const o = s.fighters[1 - this.idx];
    const sn = this.snaps[this.snapI % this.snaps.length];
    sn.x = o.x / FP; sn.y = o.y / FP; sn.vx = o.vx / FP; sn.vy = o.vy / FP; sn.air = o.air;
    sn.state = o.state; sn.move = o.move; sn.mf = o.mf; sn.hp = o.hp;
    sn.projX = 0; sn.projVx = 0; sn.projOwner = -1;
    for (const p of s.projectiles) {
      if (p.owner !== this.idx) { sn.projX = p.x / FP; sn.projVx = p.vx / FP; sn.projOwner = p.owner; break; }
    }
    this.snapI++;
  }

  /** Opponent as seen `reaction` frames ago. */
  private seen(): Snap {
    const lag = Math.min(this.snaps.length - 1, Math.min(this.snapI - 1, this.d.reaction));
    return this.snaps[(this.snapI - 1 - lag + this.snaps.length * 100) % this.snaps.length];
  }

  /** Converts a numpad direction to absolute bits for this fighter's facing. */
  private dir(n: number, facing: number): number {
    let b = 0;
    if (n >= 7) b |= UP;
    if (n <= 3) b |= DOWN;
    const col = (n - 1) % 3;
    if (col === 0) b |= facing > 0 ? LEFT : RIGHT;
    if (col === 2) b |= facing > 0 ? RIGHT : LEFT;
    return b;
  }

  private has(id: string): boolean {
    return this.infos.has(id);
  }

  private canUse(me: FighterState, id: string): boolean {
    const m = getMove(me.char, id);
    if (!m) return false;
    if (m.meterCost && me.meter < m.meterCost) return false;
    if (m.lowHp && me.hp * 100 > getChar(me.char).maxHp * ULT_HP_PCT) return false;
    if (m.oneProjectile && me.proj > 0) return false;
    const mo = m.input.motion;
    if (mo === 'chargeBF' || mo === 'chargeBFBF') return me.chargeB >= 42;
    if (mo === 'chargeDU') return me.chargeD >= 42;
    return true;
  }

  /** Builds the input frames for a move, with optional execution error. */
  private inputsFor(me: FighterState, m: MoveDef): number[] {
    const f = me.facing;
    const req = m.input;
    let btn = 0;
    if (req.btn) btn = BTN[req.btn];
    else if (req.combo) for (const b of req.combo) btn |= BTN[b];
    else if (req.two) btn = req.two === 'P' ? LP | MP : LK | MK;
    else if (req.anyOf) btn = req.anyOf === 'P' ? HP : HK;
    const seqs: Record<string, number[]> = {
      qcf: [2, 3, 6], qcb: [2, 1, 4], dp: [6, 2, 3], rdp: [4, 2, 1], hcf: [4, 1, 2, 3, 6], hcb: [6, 3, 2, 1, 4],
      '360': [6, 3, 2, 1, 4, 7, 8], qcf2: [2, 3, 6, 2, 3, 6], qcb2: [2, 1, 4, 2, 1, 4], hcf2: [4, 1, 2, 3, 6, 4, 1, 2, 3, 6],
      chargeBF: [6], chargeDU: [8], chargeBFBF: [6, 4, 6],
    };
    const out: number[] = [];
    const mo = req.motion;
    if (mo) {
      let seq = seqs[mo].slice();
      if (this.rng.chance(this.d.error) && seq.length > 1) seq.splice(this.rng.int(seq.length - 1), 1);
      if (mo === 'chargeBFBF') {
        for (let i = 0; i < seq.length - 1; i++) out.push(this.dir(seq[i], f), this.dir(seq[i], f));
      } else {
        for (let i = 0; i < seq.length - 1; i++) { out.push(this.dir(seq[i], f)); if (seq.length <= 4) out.push(this.dir(seq[i], f)); }
      }
      const last = seq[seq.length - 1];
      out.push(this.dir(last, f) | btn, this.dir(last, f) | btn, this.dir(last, f));
    } else {
      const dirs = req.dirs;
      // charge characters keep holding back / down-back during normals to retain their charge
      const keepCharge = this.chargeChar && me.state !== 'air';
      let d = dirs ? (dirs.includes(5) ? 5 : dirs.includes(2) ? 2 : dirs[0]) : 5;
      if (keepCharge && dirs) d = dirs.includes(1) ? 1 : dirs.includes(4) ? 4 : d;
      out.push(this.dir(d, f) | btn, this.dir(d, f) | btn, this.dir(d, f));
    }
    return out;
  }

  private doMove(me: FighterState, id: string, delay = 0): boolean {
    const m = getMove(me.char, id);
    if (!m || !this.canUse(me, id)) return false;
    const seq = this.inputsFor(me, m);
    const holdDir = m.input.motion === 'chargeBF' || m.input.motion === 'chargeBFBF' ? this.dir(4, me.facing)
      : m.input.motion === 'chargeDU' ? this.dir(2, me.facing) : 0;
    this.plan = [];
    for (let i = 0; i < delay; i++) this.plan.push(holdDir);
    this.plan.push(...seq);
    return true;
  }

  /** First usable move among ids/prefixes (e.g. 'rise' -> rise_H, rise_M, rise_L). */
  private pick(me: FighterState, ids: string[], prefer: ('H' | 'M' | 'L' | 'EX')[] = ['H', 'M', 'L']): string | null {
    for (const id of ids) {
      if (this.has(id) && this.canUse(me, id)) return id;
      for (const st of prefer) {
        const v = `${id}_${st}`;
        if (this.has(v) && this.canUse(me, v)) return v;
      }
    }
    return null;
  }

  private specialsWith(pred: (i: MoveInfo) => boolean): string[] {
    const out: string[] = [];
    for (const [id, i] of this.infos) if ((i.m.type === 'special' || i.m.type === 'ex') && pred(i)) out.push(id);
    return out;
  }

  // ------------------------------------------------------------------ main

  next(s: MatchState, idx: number): number {
    const me = s.fighters[idx];
    if (this.charId !== me.char) {
      this.charId = me.char;
      this.infos = moveInfos(me.char);
      this.personality = getChar(me.char).ai;
      this.chargeChar = getChar(me.char).moves.some((m) => m.input.motion?.startsWith('charge'));
    }
    this.oppCharId = s.fighters[1 - idx].char;
    this.perceive(s);
    if (s.phase !== 'fight') { this.plan = []; this.route = null; return 0; }
    const opp = s.fighters[1 - idx];
    const o = this.seen();
    const dist = Math.abs(o.x - me.x / FP);
    const stateChanged = me.state !== this.lastState;
    this.lastState = me.state;
    if (this.aaCooldown > 0) this.aaCooldown--;

    // Being hit / thrown cancels the current plan
    if (me.state === 'hitstun' || me.state === 'juggle' || me.state === 'thrown' || me.state === 'down') {
      if (this.plan.length && !this.wakePlan) { this.plan = []; this.route = null; }
    }

    // --- throw tech (decided once per grab: humans tech on anticipation, not reaction)
    if (me.state === 'thrown') {
      if (stateChanged) this.techRoll = this.rng.chance(this.d.tech) ? 2 + this.rng.int(4) : -1;
      if (this.techRoll >= 0 && me.sf === this.techRoll) return LP | LK;
      return 0;
    }
    // --- air recovery / dizzy mash
    if (me.state === 'juggle') return me.sf % 6 === 0 && this.rng.chance(0.5) ? LP : 0;
    if (me.state === 'dizzy') return me.sf % 3 === 0 ? (this.rng.chance(0.5) ? LP | LK : this.dir(this.rng.pick([4, 6, 2, 8]), me.facing)) : 0;

    // --- wakeup options
    if (me.state === 'down' || me.state === 'wakeup') {
      if (me.state === 'down' && stateChanged) {
        this.wakeRoll = this.rng.next();
        this.wakePlan = false;
        if (me.kd === 1 && this.rng.chance(0.4)) return LP; // quick rise attempt
      }
      const remaining = me.state === 'down' ? me.timer + 16 : me.timer;
      if (remaining <= 4 && !this.wakePlan && dist < 200) {
        const rev = this.specialsWith((i) => i.invuln && i.m.hits.length > 0).filter((id) => this.canUse(me, id));
        if (rev.length && this.wakeRoll < this.d.reversal) {
          this.doMove(me, rev[rev.length - 1]);
          this.wakePlan = true;
        } else {
          this.blockStick = 20;
        }
      }
      if (this.plan.length) return this.plan.shift()!;
      return this.blockBits(me, o);
    }
    this.wakePlan = false;

    // --- blockstun: hold guard, maybe guard cancel / pushblock
    if (me.state === 'blockstun') {
      this.plan = [];
      if (me.meter >= 100 && me.sf === 2 && this.rng.chance(0.07 * this.d.aggression) && this.has('guardcancel')) return MP | MK | this.blockBits(me, o);
      if (me.sf === 3 && this.rng.chance(0.06) && dist < 120) return LP | MP | this.blockBits(me, o);
      return this.blockBits(me, o);
    }

    // --- combo continuation (hit confirm)
    if (me.state === 'attack') {
      return this.continueCombo(me, opp);
    }
    if (me.state === 'land' || me.state === 'dashF' || me.state === 'dashB' || me.state === 'tech' || me.state === 'hitstun') {
      return this.plan.length ? this.plan.shift()! : this.rest(me);
    }
    if (this.route && this.routeStep < this.route.length && (opp.state === 'hitstun' || opp.state === 'juggle' || opp.state === 'blockstun') && this.plan.length === 0) {
      // link into the next step once recovered (with timing jitter)
      const nextId = this.route[this.routeStep];
      if (this.rng.chance(0.85)) {
        const ok = this.doMove(me, this.resolveId(me, nextId), this.rng.int(this.d.jitter + 1));
        if (ok) this.routeStep++;
        else this.route = null;
      } else this.route = null;
    }

    // --- execute an existing plan
    if (this.plan.length) return this.plan.shift()!;

    if (!(me.state === 'idle' || me.state === 'walkF' || me.state === 'walkB' || me.state === 'crouch' || me.state === 'guard' || me.state === 'air' || me.state === 'prejump')) {
      return this.rest(me);
    }
    if (me.state === 'air') return this.airLogic(me, o, dist);

    // --- reactive defense / anti-air / punish (based on delayed perception)
    const oppAttacking = o.state === 'attack';
    const om = oppAttacking ? getMove(opp.char, o.move) : undefined;
    // anti-air
    if (o.air && o.state === 'air' && dist < 230 && o.y > 40 && o.vy < 2 && this.aaCooldown === 0) {
      this.aaCooldown = 30;
      if (this.rng.chance(this.d.antiAir)) {
        const aa = this.antiAir(me);
        if (aa && this.doMove(me, aa)) return this.plan.shift()!;
      }
      if (this.rng.chance(this.d.block)) { this.blockStick = 24; }
    }
    // incoming attack: block
    if (oppAttacking && om && om.hits.length && dist < 260) {
      const lastActive = om.hits[om.hits.length - 1].frames[1];
      if (o.mf <= lastActive && this.rng.chance(this.d.block)) this.blockStick = Math.max(this.blockStick, 14);
      // punish recovery
      if (o.mf > lastActive && o.mf < moveTotal(om) - 4 && this.rng.chance(this.d.punish * 0.25)) {
        const p = this.punish(me, dist);
        if (p) return p;
      }
    }
    // projectile answers
    if (o.projOwner >= 0) {
      const pd = Math.abs(o.projX - me.x / FP);
      const toward = Math.sign(me.x / FP - o.projX) === Math.sign(o.projVx);
      if (toward && pd < 340) {
        const r = this.rng.next();
        const jumpP = (0.18 + this.personality.aggression * 0.3) * this.d.aggression;
        if (r < jumpP && dist < 460 && pd > 120) { this.plan = this.jumpPlan(me, 9); return this.plan.shift()!; }
        // projectile-invulnerable specials go through
        const thru = this.specialsWith((i) => (!!i.m.invuln?.proj || !!i.m.armor) && !i.m.projectile && i.m.hits.length > 0).filter((id) => this.canUse(me, id) && !id.endsWith('_EX'));
        if (thru.length && r < jumpP + 0.15 && pd < 260) { this.doMove(me, this.rng.pick(thru)); return this.plan.shift()!; }
        const pr = this.pick(me, this.specialsWith((i) => !!i.m.projectile).map((id) => id.replace(/_(L|M|H|EX)$/, '')));
        if (r < 0.45 && pr) { this.doMove(me, pr); return this.plan.shift()!; }
        this.blockStick = Math.max(this.blockStick, 18);
      }
    }
    if (this.blockStick > 0) {
      this.blockStick--;
      return this.blockBits(me, o);
    }

    // --- neutral game
    return this.neutral(s, me, opp, o, dist);
  }

  private wakePlan = false;
  private chargeChar = false;

  private resolveId(me: FighterState, id: string): string {
    if (this.has(id)) return id;
    return this.pick(me, [id], ['H', 'M', 'L']) ?? id;
  }

  private blockBits(me: FighterState, o: Snap): number {
    const away = o.x > me.x / FP ? LEFT : RIGHT;
    let crouch = true;
    if (o.air) crouch = false;
    if (o.state === 'attack' && o.move) {
      const info = moveInfos(this.oppChar(o)).get(o.move);
      if (info?.overhead && this.rng.chance(this.d.block)) crouch = false;
      else if (info?.low) crouch = true;
    }
    return away | (crouch ? DOWN : 0);
  }

  private oppCharId = '';
  private grabCache = new Map<string, boolean>();
  private oppGrabs(charId: string): boolean {
    let v = this.grabCache.get(charId);
    if (v === undefined) {
      v = getChar(charId).moves.some((m) => !!m.throw && (m.type === 'special' || m.type === 'ex'));
      this.grabCache.set(charId, v);
    }
    return v;
  }
  private oppChar(_o: Snap): string { return this.oppCharId; }

  private antiAir(me: FighterState): string | null {
    const pers = this.personality.antiAirMove;
    if (pers) {
      const id = this.pick(me, [pers], ['H', 'M', 'L']);
      if (id) return id;
    }
    for (const [id, i] of this.infos) if (i.m.type === 'normal' && i.antiAir && i.startup <= 7) return id;
    return null;
  }

  private punish(me: FighterState, dist: number): number | null {
    const routes = this.personality.combos.filter((r) => {
      const first = this.infos.get(this.resolveId(me, r[0]));
      return first && first.reach + 30 >= dist && first.startup <= 8;
    });
    if (!routes.length) return null;
    const r = this.rng.pick(routes);
    this.startRoute(me, r);
    return this.plan.length ? this.plan.shift()! : null;
  }

  private startRoute(me: FighterState, r: string[]): void {
    this.route = r.map((id) => this.resolveId(me, id));
    this.routeStep = 1;
    this.confirmT = 0;
    this.doMove(me, this.route[0]);
  }

  private continueCombo(me: FighterState, opp: FighterState): number {
    if (this.plan.length) return this.plan.shift()!;
    if (!this.route || this.routeStep >= this.route.length) return this.rest(me);
    const m = curMove(me);
    if (!m) return this.rest(me);
    if (me.contact === 0) return this.rest(me);
    if (this.lastContactMove !== me.move) { this.lastContactMove = me.move; this.confirmT = 0; }
    this.confirmT++;
    const nextId = this.route[this.routeStep];
    const next = getMove(me.char, nextId);
    if (!next) { this.route = null; return this.rest(me); }
    const hit = me.contact === 1 || me.contact === 3;
    // confirm delay grows on easier difficulties
    const confirmDelay = Math.max(1, Math.round(this.d.reaction / 3));
    if (this.confirmT < confirmDelay) return this.rest(me);
    if (!hit) {
      // blocked: finish a safe blockstring or stop
      if (this.rng.chance(0.5) && (next.type === 'normal' || next.type === 'command')) { /* continue string */ }
      else { this.route = null; return this.rest(me); }
    } else if (!this.rng.chance(this.d.confirm)) { this.route = null; return this.rest(me); }
    const cancelable = m.cancel && me.mf <= m.cancel.window[1];
    const isCancel = next.type !== 'normal' || (m.chainTo?.includes(next.id) ?? false);
    if (isCancel && cancelable) {
      if (this.doMove(me, nextId)) this.routeStep++;
      else this.route = null;
      return this.plan.length ? this.plan.shift()! : 0;
    }
    if (!isCancel) {
      // link: press during the last recovery frames (buffered), with human-like timing jitter
      const rem = moveTotal(m) - me.mf;
      if (hit && me.hitstop === 0 && rem <= 1 + this.rng.int(this.d.jitter + 2)) {
        if (this.doMove(me, nextId)) this.routeStep++;
        else this.route = null;
        return this.plan.length ? this.plan.shift()! : this.rest(me);
      }
      return this.rest(me);
    }
    this.route = null;
    void opp;
    return this.rest(me);
  }

  private jumpPlan(me: FighterState, dir: number): number[] {
    const b = this.dir(dir, me.facing);
    return [b, b, b, b, b, 0];
  }

  private airLogic(me: FighterState, o: Snap, dist: number): number {
    if (me.airAttacked) return this.hold && this.holdFrames-- > 0 ? this.hold : 0;
    const dy = me.y / FP - o.y;
    // jump-in attack timing: when descending near the opponent
    if (me.vy < 0 && dist < 150 && dy > 30 && dy < 170) {
      const ids = ['j.HK', 'j.HP', 'j.MK', 'j.MP', 'j.LK'].filter((id) => this.has(id));
      const id = ids.length ? (dist < 70 && this.has('j.LK') && this.rng.chance(0.3) ? 'j.LK' : ids[this.rng.int(Math.min(2, ids.length))]) : null;
      if (id && this.doMove(me, id)) return this.plan.shift()!;
    }
    // air-to-air
    if (o.air && Math.abs(dy) < 60 && dist < 140 && this.has('j.MP')) {
      if (this.doMove(me, 'j.MP')) return this.plan.shift()!;
    }
    const c = getChar(me.char);
    // double jump / air dash for mobile characters
    if (c.airJumps > 0 && me.airJumps > 0 && me.sf > 10 && me.vy < 2 && this.rng.chance(0.03)) return this.dir(this.rng.chance(0.5) ? 9 : 8, me.facing);
    if (c.airDashes > 0 && me.airDashes > 0 && me.y > 100 * FP && dist > 160 && this.rng.chance(0.04)) {
      const f = this.dir(6, me.facing);
      this.plan = [0, f, 0, f];
      return this.plan.shift()!;
    }
    return 0;
  }

  private neutral(s: MatchState, me: FighterState, opp: FighterState, o: Snap, dist: number): number {
    const P = this.personality;
    const D = this.d;
    if (this.neutralCooldown > 0) {
      this.neutralCooldown--;
      return this.walkBits(me);
    }
    const r = this.rng.next();
    const charge = P.zoning > 0.6 && (me.chargeB < 45 || me.chargeD < 45);
    // Ultimate / super as a finisher when the opponent is low and close
    if (dist < 160 && opp.hp < 260 && me.meter >= 100 && this.rng.chance(0.04 * P.meterUse)) {
      const sup = this.pick(me, ['ult', 'super']);
      if (sup && this.doMove(me, sup)) return this.plan.shift()!;
    }
    // Storm Drive
    if (me.meter >= 200 && me.drive === 0 && this.rng.chance(0.004 * P.meterUse * D.aggression) && dist < 260) {
      this.plan = [MP | MK, MP | MK, 0];
      return this.plan.shift()!;
    }
    // Respect command grabs: up close against a grappler, sometimes jump, back off or mash a jab
    if (dist < 135 && this.oppGrabs(opp.char) && r < 0.05 * D.block + 0.01) {
      const pick = this.rng.int(3);
      if (pick === 0) { this.plan = this.jumpPlan(me, this.rng.chance(0.5) ? 7 : 8); return this.plan.shift()!; }
      if (pick === 1) { const b = this.dir(4, me.facing); this.plan = [b, 0, b, b, b]; return this.plan.shift()!; }
      if (this.doMove(me, this.has('5LP') ? '5LP' : '2LP')) return this.plan.shift()!;
    }
    // Zoning
    const proj = this.specialsWith((i) => !!i.m.projectile && i.m.type === 'special');
    if (dist > 300 && proj.length && me.proj === 0 && r < 0.05 + P.zoning * 0.06) {
      const id = this.rng.pick(proj);
      if (this.canUse(me, id) && this.doMove(me, id, charge ? 0 : 0)) { this.neutralCooldown = 6; return this.plan.shift()!; }
    }
    // Throws / command grabs up close
    if (dist < 90 && opp.state !== 'air' && r < 0.04 + P.grabby * 0.08) {
      const grabs = this.specialsWith((i) => !!i.m.throw).filter((id) => this.canUse(me, id));
      if (grabs.length && this.rng.chance(P.grabby)) {
        if (this.doMove(me, this.rng.pick(grabs))) return this.plan.shift()!;
      }
      if (this.doMove(me, this.rng.chance(0.3) ? 'throwB' : 'throwF')) return this.plan.shift()!;
    }
    // Pokes / combo starters in range
    const inRange = P.pokes.filter((id) => { const i = this.infos.get(id); return i && i.reach + 10 >= dist && i.reach - 70 <= dist; });
    if (inRange.length && r < 0.06 + P.aggression * 0.08 * D.aggression) {
      const routes = P.combos.filter((rt) => inRange.includes(rt[0]));
      if (routes.length && this.rng.chance(0.55)) { this.startRoute(me, this.rng.pick(routes)); }
      else {
        const strings = P.blockstrings.filter((bs) => inRange.includes(bs[0]));
        if (strings.length && this.rng.chance(0.5)) this.startRoute(me, this.rng.pick(strings));
        else this.doMove(me, this.rng.pick(inRange));
      }
      if (this.plan.length) return this.plan.shift()!;
    }
    // Close-range pressure: lights and mixups
    if (dist < 110 && r < 0.12 * D.aggression) {
      const ov = [...this.infos.values()].filter((i) => i.overhead && i.m.type === 'command').map((i) => i.m.id);
      if (ov.length && this.rng.chance(0.18)) { if (this.doMove(me, this.rng.pick(ov))) return this.plan.shift()!; }
      const routes = P.combos.filter((rt) => { const i = this.infos.get(rt[0]); return i && i.reach >= dist && i.startup <= 5; });
      if (routes.length) { this.startRoute(me, this.rng.pick(routes)); if (this.plan.length) return this.plan.shift()!; }
    }
    // Jump-ins
    if (dist > 150 && dist < 330 && r < 0.012 + P.jumpiness * 0.02 * D.aggression) {
      this.plan = this.jumpPlan(me, 9);
      return this.plan.shift()!;
    }
    // Movement
    const pref = P.preferredRange;
    const wantCloser = dist > pref + 40;
    const wantFarther = dist < pref - 90 && P.zoning > 0.55;
    if (this.rng.chance(0.08)) {
      if (wantCloser) this.walkDir = this.rng.chance(0.15 + P.aggression * 0.3) ? 2 : 1;
      else if (wantFarther) this.walkDir = this.rng.chance(0.2) ? -2 : -1;
      else this.walkDir = this.rng.pick([0, 0, 1, -1, charge ? -3 : 0]);
      this.neutralCooldown = 8 + this.rng.int(18);
    }
    if (this.walkDir === 2 && dist > 200) {
      const f = this.dir(6, me.facing);
      this.plan = [f, 0, f, f, f];
      this.walkDir = 1;
      return this.plan.shift()!;
    }
    if (this.walkDir === -2) {
      const b = this.dir(4, me.facing);
      this.plan = [b, 0, b, b];
      this.walkDir = -1;
      return this.plan.shift()!;
    }
    void s; void o;
    return this.walkBits(me);
  }

  /** Bits held while otherwise idle: charge characters keep holding down-back. */
  private rest(me: FighterState): number {
    return this.chargeChar ? this.dir(1, me.facing) : 0;
  }

  private walkBits(me: FighterState): number {
    if (this.walkDir === 1) return this.dir(6, me.facing);
    if (this.walkDir === -1) return this.dir(4, me.facing);
    if (this.walkDir === -3) return this.dir(1, me.facing); // charging zoner: crouch back
    return this.personality.zoning > 0.6 ? this.dir(1, me.facing) : 0;
  }
}

