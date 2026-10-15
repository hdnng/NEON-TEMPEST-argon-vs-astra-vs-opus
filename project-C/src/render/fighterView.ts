/**
 * Presentation state for one fighter: pose evaluation from the simulation state (move animation
 * keys, procedural walk/idle/dizzy), smoothing between states, cloth, afterimages, hit flashes,
 * and the full draw (shadow, reflection, aura, body).
 */
import type { CharacterDef, Palette } from '../data/schema';
import { POSES, blendPose, copyPose, getPose, newPose, type Pose } from '../data/poses';
import { getChar, getMove } from '../sim/registry';
import { FP, type FighterState } from '../sim/types';
import { STYLES, palSet, type ChainSet, type DrawOpts, type PalSet, type StyleDrawer } from './bodyDraw';
import { drawRig, getRig, type Rig, type RigSet } from './rig';
import { sx, sy, type Camera } from './camera';
import { newSkel, solveSkeleton, type Pt, type Skel } from './skeleton';

const PREFIX: Record<string, string> = { hayate: 'hay', magnus: 'mag', sable: 'sab', warden: 'war' };
const FLIPS: Record<string, boolean> = { hayate: true, magnus: false, sable: true, warden: false };

/** Character-specific pose override (e.g. 'mag_stance') or the generic pose. */
export function charPose(charId: string, name: string): Pose {
  const p = PREFIX[charId];
  if (p) {
    const own = POSES[`${p}_${name}`];
    if (own) return own;
  }
  return getPose(name);
}

const smooth = (t: number) => t * t * (3 - 2 * t);

interface After { x: number; y: number; facing: number; pose: Pose; life: number }

export class FighterView {
  readonly char: CharacterDef;
  readonly pal: Palette;
  readonly ps: PalSet;
  readonly style: StyleDrawer;
  readonly chains: ChainSet;
  pose = newPose();
  target = newPose();
  skel: Skel = newSkel();
  x = 0; y = 0; px = 0; py = 0;
  facing = 1;
  flash = 0;
  flashColor = '#ffffff';
  spinScale = 1;
  energy = 0;
  private afters: After[] = [];
  /** World positions of hands/feet for the last SMEAR_N frames (ring), for attack smears. */
  private fx = new Float32Array(4 * SMEAR_N);
  private fy = new Float32Array(4 * SMEAR_N);
  private fHead = 0;
  private smearLimb = -1;
  private smearLife = 0;
  private afterTick = 0;
  private lastState = '';
  private t = 0;
  private toWorldFn: (p: Pt, out: Pt) => Pt;
  private scratch = newPose();

  constructor(charId: string, palette: number) {
    this.char = getChar(charId);
    this.pal = this.char.palettes[palette] ?? this.char.palettes[0];
    this.ps = palSet(this.pal);
    this.style = STYLES[this.char.body.style];
    this.chains = this.style.chains();
    for (let i = 0; i < 6; i++) this.afters.push({ x: 0, y: 0, facing: 1, pose: newPose(), life: 0 });
    copyPose(getPose('stance'), this.pose);
    this.toWorldFn = (p, out) => {
      out.x = this.x + p.x * this.facing * this.spinScale;
      out.y = this.y + p.y;
      return out;
    };
  }

  /** Called once per simulation frame. */
  update(f: FighterState, wind: number): void {
    this.t += 1 / 60;
    this.px = this.x; this.py = this.y;
    this.x = f.x / FP;
    this.y = f.y / FP;
    if (Math.abs(this.x - this.px) > 150) { this.px = this.x; this.py = this.y; }
    this.facing = f.facing;
    if (f.hitstop > 0 && f.shake > 0 && f.state !== this.lastState && (f.state === 'hitstun' || f.state === 'juggle')) {
      this.flash = 4;
      this.flashColor = f.counter ? '#ffd23a' : '#ffffff';
    } else if (this.flash > 0 && f.hitstop === 0) this.flash--;
    this.lastState = f.state;
    this.energy = f.drive > 0 ? 1 : f.state === 'attack' && isSuperMove(f) ? 1 : Math.max(0, this.energy - 0.05);

    this.evalTarget(f);
    const k = this.instant(f) ? 1 : 0.42;
    if (Math.abs((this.pose.rot ?? 0) - (this.target.rot ?? 0)) > 90) copyPose(this.target, this.pose);
    else blendPose(this.pose, this.target, k, this.pose);

    // spin moves: fake rotation around the vertical axis
    this.spinScale = 1;
    if (f.state === 'attack') {
      const m = getMove(f.char, f.move);
      if (m && m.anim.some((a) => a.pose === 'spin' || a.pose === 'mag_spin') && f.mf >= m.startup && f.mf < m.startup + m.active) {
        const c = Math.cos((f.mf - m.startup) * 0.55);
        this.spinScale = Math.sign(c) * Math.max(0.3, Math.abs(c));
      }
    }

    solveSkeleton(this.pose, this.char.body, this.skel);
    const moving = Math.min(1.5, Math.abs(f.vx / FP) / 6);
    this.style.stepChains(this.chains, this.skel, this.toWorldFn, this.facing, wind, moving);

    // effector history + active-strike smear limb
    const ends = [this.skel.haF, this.skel.haB, this.skel.ftF, this.skel.ftB];
    this.fHead = (this.fHead + 1) % SMEAR_N;
    for (let k = 0; k < 4; k++) {
      this.fx[k * SMEAR_N + this.fHead] = this.x + ends[k].x * this.facing * this.spinScale;
      this.fy[k * SMEAR_N + this.fHead] = this.y + ends[k].y;
    }
    this.smearLife = Math.max(0, this.smearLife - 1);
    if (f.state === 'attack' && f.hitstop === 0) {
      const m = getMove(f.char, f.move);
      const h = m?.hits.find((hh) => f.mf >= hh.frames[0] - 1 && f.mf <= hh.frames[1]);
      if (m && h && h.boxes.length && m.type !== 'throw') {
        const b = h.boxes[0];
        const bx = (b.x + b.w * 0.75) * this.char.body.scale, by = (b.y + b.h / 2);
        let best = -1, bd = 1e9;
        for (let k = 0; k < 4; k++) {
          const d = (ends[k].x - bx) ** 2 + (ends[k].y - by) ** 2;
          if (d < bd) { bd = d; best = k; }
        }
        if (bd < 90 * 90) { this.smearLimb = best; this.smearLife = 6; }
      }
    }
    // afterimages
    const wantAfter = f.state === 'dashF' || f.state === 'airdash' || f.state === 'airRecover' ||
      (f.state === 'attack' && (isSuperMove(f) || moveHasPose(f, 'rise') || moveHasPose(f, 'spin'))) || f.drive > 0 && Math.abs(f.vx) > 300;
    for (const a of this.afters) if (a.life > 0) a.life--;
    if (wantAfter && ++this.afterTick % 2 === 0) {
      const slot = this.afters.reduce((m, a) => (a.life < m.life ? a : m), this.afters[0]);
      slot.x = this.x; slot.y = this.y; slot.facing = this.facing * this.spinScale; slot.life = 12;
      copyPose(this.pose, slot.pose);
    }
  }

  private instant(f: FighterState): boolean {
    return f.state === 'attack' || f.state === 'hitstun' || f.state === 'blockstun' || f.state === 'thrown' || f.state === 'juggle';
  }

  private evalTarget(f: FighterState): void {
    const out = this.target;
    const cp = (n: string) => charPose(f.char, n);
    const t = this.t;
    switch (f.state) {
      case 'intro': {
        copyPose(cp(f.sf < 40 ? 'intro' : 'stance'), out);
        break;
      }
      case 'idle': case 'guard': {
        if (f.state === 'guard') { copyPose(getPose(isDownHeld(f) ? 'cblock' : 'block'), out); break; }
        const b = 0.5 + 0.5 * Math.sin(t * 3.6 + f.idx);
        blendPose(cp('stance'), cp('stance2'), b, out);
        break;
      }
      case 'walkF': case 'walkB': {
        const dir = f.state === 'walkF' ? 1 : -1;
        const ph = f.sf * 0.2 * dir;
        blendPose(cp('stance'), cp('stance2'), 0.3, out);
        out.hip[1] -= Math.abs(Math.sin(ph)) * 4;
        out.hip[0] += Math.sin(ph * 2) * 1.5;
        out.ff[0] += Math.sin(ph) * 14;
        out.ff[1] = Math.max(0, Math.cos(ph) * 10);
        out.bf[0] += Math.sin(ph + Math.PI) * 14;
        out.bf[1] = Math.max(0, Math.cos(ph + Math.PI) * 10);
        out.fh[1] += Math.sin(ph) * 3;
        out.bh[1] += Math.sin(ph + 1) * 3;
        break;
      }
      case 'crouch': {
        const b = 0.5 + 0.5 * Math.sin(t * 3.6 + f.idx);
        blendPose(cp('crouch'), cp('crouch2'), b, out);
        break;
      }
      case 'prejump': copyPose(cp('prejump'), out); break;
      case 'land': copyPose(cp('land'), out); break;
      case 'dashF': copyPose(cp('dash_f'), out); break;
      case 'dashB': copyPose(cp('dash_b'), out); break;
      case 'airdash': copyPose(cp('airdash'), out); break;
      case 'air': {
        const vy = f.vy / FP;
        const c = getChar(f.char);
        const k = Math.max(0, Math.min(1, (c.jump.vy - vy) / (2 * c.jump.vy)));
        blendPose(cp('jump'), cp('jumpfall'), smooth(k), out);
        if (FLIPS[f.char] && (f.jumpDir === 9 || f.jumpDir === 7) && k > 0.12 && k < 0.82) {
          const p = (k - 0.12) / 0.7;
          out.rot = (f.jumpDir === 9 ? 360 : -360) * smooth(p);
          blendPose(out, cp('jump'), 0.6, out);
          out.ff[1] += 30; out.bf[1] += 30;
        } else out.rot = 0;
        break;
      }
      case 'attack': this.evalAttack(f, out); break;
      case 'hitstun': {
        const pose = f.crouchHit ? 'hit_crouch' : f.hitY > 150 ? 'hit_high' : f.hitY < 70 ? 'hit_low' : 'hit_body';
        const k = Math.min(1, f.hitstun / 8 + (f.hitstop > 0 ? 1 : 0));
        blendPose(cp(f.crouchHit ? 'crouch' : 'stance'), getPose(pose), smooth(k), out);
        break;
      }
      case 'blockstun': copyPose(getPose(f.crouchHit || isDownHeld(f) ? 'cblock' : 'block'), out); break;
      case 'juggle': {
        const vy = f.vy / FP;
        const k = Math.max(0, Math.min(1, 0.5 - vy / 16));
        blendPose(getPose('juggle'), getPose('fall'), k, out);
        out.rot = f.kd > 0 || f.koed ? -Math.min(300, f.sf * 9) : -Math.min(40, f.sf * 4);
        if (f.y < 30 * FP && vy < 0) out.rot = Math.max(out.rot ?? 0, -30);
        break;
      }
      case 'airRecover': {
        copyPose(getPose('airRecover'), out);
        out.rot = Math.min(360, f.sf * 24);
        break;
      }
      case 'down': copyPose(getPose('down'), out); break;
      case 'ko': copyPose(getPose('ko'), out); break;
      case 'wakeup': {
        const p = 1 - f.timer / 16;
        if (p < 0.5) blendPose(getPose('wakeup1'), getPose('wakeup2'), smooth(p * 2), out);
        else blendPose(getPose('wakeup2'), cp('stance'), smooth((p - 0.5) * 2), out);
        break;
      }
      case 'thrown': {
        copyPose(getPose('thrown'), out);
        out.rot = -Math.min(200, f.sf * 10);
        break;
      }
      case 'tech': copyPose(getPose('tech'), out); break;
      case 'dizzy': {
        copyPose(getPose('dizzy'), out);
        out.hip[0] += Math.sin(t * 4) * 7;
        out.lean += Math.sin(t * 4 + 0.5) * 8;
        out.head += Math.sin(t * 3) * 14;
        break;
      }
      case 'win': {
        const b = 0.5 + 0.5 * Math.sin(t * 2.5);
        blendPose(cp('win'), cp('win'), 0, out);
        out.hip[1] += b * 2;
        break;
      }
      case 'lose': copyPose(getPose('lose'), out); break;
      default: copyPose(cp('stance'), out);
    }
  }

  private evalAttack(f: FighterState, out: Pose): void {
    const m = getMove(f.char, f.move);
    if (!m) { copyPose(getPose('stance'), out); return; }
    let keys = m.anim;
    let frame = f.mf;
    if (f.grabFrame >= 0 && m.throw) { keys = m.throw.anim; frame = f.grabFrame; }
    if (!keys.length) { copyPose(getPose('stance'), out); return; }
    let i = 0;
    while (i < keys.length - 1 && keys[i + 1].f <= frame) i++;
    const k0 = keys[i];
    const k1 = keys[Math.min(i + 1, keys.length - 1)];
    const p0 = charPose(f.char, k0.pose), p1 = charPose(f.char, k1.pose);
    if (k1 === k0 || k1.f <= k0.f) { copyPose(p0, out); return; }
    const tt = Math.max(0, Math.min(1, (frame - k0.f) / (k1.f - k0.f)));
    blendPose(p0, p1, smooth(tt), out);
    // airborne specials: keep legs tucked when rising
    if (m.stance === 'air' && f.vy > 0) { out.ff[1] += 6; }
  }

  /** Interpolated render position. */
  rx(alpha: number): number { return this.px + (this.x - this.px) * alpha; }
  ry(alpha: number): number { return this.py + (this.y - this.py) * alpha; }

  /** Rim colors used when baking this view's rig (stage light). */
  setLight(rimA: string, rimB: string): void {
    this.rimA = rimA;
    this.rimB = rimB;
  }

  private rimA = '';
  private rimB = '#ff2e9a';

  get rig(): Rig {
    return getRig(this.char, this.pal, this.rimA || this.pal.rim, this.rimB);
  }

  /** Full draw at the camera. */
  draw(ctx: CanvasRenderingContext2D, cam: Camera, f: FighterState, alpha: number, o: DrawOpts, reflection: number): void {
    const wx = this.rx(alpha), wy = this.ry(alpha);
    const shake = f.shake > 0 && f.hitstop > 0 ? (f.shake % 2 === 0 ? 3 : -3) : 0;
    const rig = this.rig;
    const fz = this.facing * this.spinScale;
    // afterimages
    for (const a of this.afters) {
      if (a.life <= 0) continue;
      solveSkeleton(a.pose, this.char.body, this.skel);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.04 + a.life * 0.022;
      this.drawRigAt(ctx, cam, a.x, a.y, a.facing, rig.glow, this.pal.glow);
      ctx.restore();
    }
    solveSkeleton(this.pose, this.char.body, this.skel);
    // wet-floor reflection
    if (reflection > 0 && wy < 160) {
      ctx.save();
      ctx.globalAlpha = reflection * Math.max(0, 1 - wy / 160) * 0.32;
      const gy = sy(cam, 0);
      ctx.translate(0, gy * 2);
      ctx.scale(1, -1);
      this.drawRigAt(ctx, cam, wx + shake, wy, fz, rig.color, null);
      ctx.restore();
    }
    // Storm Drive / super aura
    if ((f.drive > 0 || this.energy > 0.3) && o.glow) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 10);
      ctx.globalAlpha = 0.28 + pulse * 0.22;
      this.drawRigAt(ctx, cam, wx + shake, wy, fz, rig.glow, this.pal.glow);
      ctx.restore();
    }
    this.drawRigAt(ctx, cam, wx + shake, wy, fz, rig.color, null);
    if (this.smearLife > 0 && this.smearLimb >= 0) this.drawSmear(ctx, cam, wx - this.x + shake, wy - this.y);
    // hit flash
    if (this.flash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(0.5, this.flash * 0.12);
      this.drawRigAt(ctx, cam, wx + shake, wy, fz, this.flashColor === '#ffffff' ? rig.white : rig.glow, '#ffffff');
      ctx.restore();
    }
    // burnout: washed-out overlay
    if (f.burnout > 0 && (this.t * 4) % 2 < 1) {
      ctx.save();
      ctx.globalAlpha = 0.12;
      this.drawRigAt(ctx, cam, wx + shake, wy, fz, rig.white, '#ffffff');
      ctx.restore();
    }
  }

  /** Additive tapered trail along the recent path of the striking hand / foot. */
  private drawSmear(ctx: CanvasRenderingContext2D, cam: Camera, ox: number, oy: number): void {
    const k = this.smearLimb;
    const n = SMEAR_N;
    let len = 0;
    for (let i = 1; i < n; i++) {
      const a = (this.fHead - i + 1 + n) % n, b = (this.fHead - i + n) % n;
      len += Math.hypot(this.fx[k * n + a] - this.fx[k * n + b], this.fy[k * n + a] - this.fy[k * n + b]);
    }
    if (len < 18) return;
    const life = this.smearLife / 6;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let pass = 0; pass < 2; pass++) {
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const idx = (this.fHead - i + n) % n;
        const X = sx(cam, this.fx[k * n + idx] + ox), Y = sy(cam, this.fy[k * n + idx] + oy);
        if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
      }
      ctx.strokeStyle = pass === 0 ? smearColor(this.pal.glow, 0.22 * life) : smearColor('#ffffff', 0.5 * life);
      ctx.lineWidth = (pass === 0 ? 16 : 5) * cam.zoom;
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Draws the rig at a world position with the current skeleton. */
  private drawRigAt(ctx: CanvasRenderingContext2D, cam: Camera, wx: number, wy: number, facing: number, set: RigSet, chainFlat: string | null): void {
    ctx.save();
    ctx.translate(sx(cam, wx), sy(cam, wy));
    ctx.scale(cam.zoom * facing, -cam.zoom);
    const inv = 1 / (Math.sign(facing || 1) * Math.max(0.3, Math.abs(facing)));
    drawRig(ctx, this.skel, set, (layer) => {
      // chain points are world coordinates anchored at the sim position (this.x, this.y)
      ctx.save();
      ctx.scale(inv, 1);
      ctx.translate(-this.x, -this.y);
      CHAIN_OPTS.flat = chainFlat;
      this.style.drawChains(ctx, this.chains, layer, this.ps, CHAIN_OPTS);
      ctx.restore();
    });
    ctx.restore();
  }

  /** Draws the fighter at an arbitrary screen position/scale (menus, portraits). */
  drawPortrait(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, facing: number, o: DrawOpts): void {
    solveSkeleton(this.pose, this.char.body, this.skel);
    const rig = this.rig;
    const draw = (set: RigSet, flat: string | null) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale * facing, -scale);
      drawRig(ctx, this.skel, set, (layer) => {
        ctx.save();
        ctx.scale(1 / (this.facing || 1), 1);
        ctx.translate(-this.x, -this.y);
        CHAIN_OPTS.flat = flat;
        this.style.drawChains(ctx, this.chains, layer, this.ps, CHAIN_OPTS);
        ctx.restore();
      });
      ctx.restore();
    };
    if (o.energy > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35 * o.energy;
      draw(rig.glow, this.pal.glow);
      ctx.restore();
    }
    if (o.flat) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      draw(rig.white, '#ffffff');
      ctx.restore();
    } else draw(rig.color, null);
  }

  /** Menu animation: drive the pose from a named state without a simulation. */
  animateMenu(state: 'idle' | 'win' | 'intro' | 'select', t: number, wind = 0.15): void {
    this.t = t;
    const out = this.target;
    const cp = (n: string) => charPose(this.char.id, n);
    if (state === 'idle') blendPose(cp('stance'), cp('stance2'), 0.5 + 0.5 * Math.sin(t * 3.6), out);
    else if (state === 'win') copyPose(cp('win'), out);
    else if (state === 'intro') copyPose(cp('intro'), out);
    else blendPose(cp('stance'), cp('win'), 0.5 + 0.5 * Math.sin(t * 2), out);
    blendPose(this.pose, out, 0.25, this.pose);
    solveSkeleton(this.pose, this.char.body, this.skel);
    this.px = this.x; this.py = this.y;
    this.style.stepChains(this.chains, this.skel, this.toWorldFn, this.facing, wind, 0.1);
  }

  /** Lets cloth settle for a static pose (menus, cut-ins, gallery). */
  settle(n = 40, wind = 0.15): void {
    solveSkeleton(this.pose, this.char.body, this.skel);
    for (let i = 0; i < n; i++) this.style.stepChains(this.chains, this.skel, this.toWorldFn, this.facing, wind, 0.1);
  }

  setMenuPose(name: string): void {
    copyPose(charPose(this.char.id, name), this.pose);
    copyPose(this.pose, this.scratch);
  }
}

const SMEAR_N = 5;
const smearCache = new Map<string, string>();
function smearColor(hex: string, a: number): string {
  const key = hex + Math.round(a * 20);
  let v = smearCache.get(key);
  if (!v) {
    const n = parseInt(hex.slice(1), 16);
    v = `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.round(a * 20) / 20})`;
    smearCache.set(key, v);
  }
  return v;
}

const CHAIN_OPTS: DrawOpts = { flat: null, rimA: '#fff', rimB: '#fff', glow: false, t: 0, energy: 0 };

function isSuperMove(f: FighterState): boolean {
  const m = getMove(f.char, f.move);
  return !!m && (m.type === 'super' || m.type === 'ultimate');
}

function moveHasPose(f: FighterState, pose: string): boolean {
  const m = getMove(f.char, f.move);
  return !!m && m.anim.some((a) => a.pose === pose) && f.mf >= m.startup && f.mf <= m.startup + m.active;
}

function isDownHeld(f: FighterState): boolean {
  const bits = f.hist[f.frame % f.hist.length] ?? 0;
  return (bits & 2) !== 0;
}
