/**
 * Cutout rig: every body part is painted once into a sprite at bake time (with gradients and
 * real blur glows), then posed every frame with a handful of rotated drawImage calls. This keeps
 * the per-frame GPU cost tiny while allowing rich, consistent art.
 *
 * Three sprite sets are baked per fighter: full color, white silhouette (hit flash) and a soft
 * glowing silhouette (afterimages, Storm Drive aura).
 */
import type { BodyDef, CharacterDef, Palette } from '../data/schema';
import { mix } from '../ui/theme';
import { PAINTERS, type PaintCtx, type StylePainter } from './painters';
import type { Pt, Skel } from './skeleton';

export type PartName =
  | 'upperArmN' | 'upperArmF' | 'foreArmN' | 'foreArmF' | 'thighN' | 'thighF' | 'shinN' | 'shinF'
  | 'fistN' | 'fistF' | 'palmN' | 'palmF' | 'footN' | 'footF' | 'torso' | 'head';

/** A sprite inside an atlas: source rect (px) and the logical origin within it. */
export interface Sprite { img: CanvasImageSource; sx: number; sy: number; sw: number; sh: number; ox: number; oy: number; s: number }
export type RigSet = Record<PartName, Sprite>;
export interface Rig { color: RigSet; white: RigSet; glow: RigSet; body: BodyDef }

function darkPalette(p: Palette): Palette {
  const d = (c: string) => mix(c, '#04050c', 0.36);
  return { ...p, skin: d(p.skin), body: d(p.body), bodyDark: d(p.bodyDark), cloth: d(p.cloth), hair: d(p.hair), accent: mix(p.accent, '#000000', 0.2) };
}

interface Bounds { x0: number; x1: number; y0: number; y1: number }

interface Pending { b: Bounds; paint: (ctx: CanvasRenderingContext2D) => void; glow: string | null; sprite: Sprite }

/**
 * Packs every part into one atlas canvas (shelf packing) so the per-frame cost is a few draws
 * from a single GPU texture. Once an ImageBitmap of the atlas is ready it replaces the canvas.
 */
function bakeAtlas(items: Pending[], s: number): void {
  const pad = 2;
  const maxW = 2048;
  let x = pad, y = pad, rowH = 0;
  for (const it of items) {
    const w = Math.max(2, Math.ceil((it.b.x1 - it.b.x0) * s));
    const h = Math.max(2, Math.ceil((it.b.y1 - it.b.y0) * s));
    if (x + w + pad > maxW) { x = pad; y += rowH + pad; rowH = 0; }
    it.sprite.sx = x; it.sprite.sy = y; it.sprite.sw = w; it.sprite.sh = h;
    x += w + pad;
    rowH = Math.max(rowH, h);
  }
  const c = document.createElement('canvas');
  c.width = maxW;
  c.height = y + rowH + pad;
  const ctx = c.getContext('2d')!;
  for (const it of items) {
    const sp = it.sprite;
    ctx.save();
    ctx.beginPath();
    ctx.rect(sp.sx, sp.sy, sp.sw, sp.sh);
    ctx.clip();
    ctx.setTransform(s, 0, 0, -s, sp.sx - it.b.x0 * s, sp.sy + it.b.y1 * s);
    if (it.glow) { ctx.shadowColor = it.glow; ctx.shadowBlur = 9 * s; }
    it.paint(ctx);
    ctx.restore();
    sp.img = c;
  }
  if (typeof createImageBitmap === 'function') {
    createImageBitmap(c).then((bmp) => { for (const it of items) it.sprite.img = bmp; }).catch(() => {});
  }
}

/** Bakes all part sprites for a character/palette under a stage's rim light colors. */
export function bakeRig(ch: CharacterDef, pal: Palette, rimA: string, rimB: string, scale: number): Rig {
  const P: StylePainter = PAINTERS[ch.body.style];
  const body = ch.body;
  const far = darkPalette(pal);
  const R = P.radius + 14;
  const limbB = (L: number): Bounds => ({ x0: -R, x1: L + R, y0: -R, y1: R });
  const handB: Bounds = { x0: -14, x1: 34, y0: -22, y1: 22 };
  const footB: Bounds = { x0: -14, x1: 36, y0: -14, y1: 24 };
  const tw = body.torsoWidth;
  const torsoB: Bounds = { x0: -(tw + 24), x1: tw + 26, y0: -18, y1: body.torso * 1.24 + 16 };
  const hr = body.head;
  const headB: Bounds = { x0: -hr * 1.9 - 14, x1: hr * 1.5 + 14, y0: -hr * 2.3 - 8, y1: hr * 1.9 + 14 };
  const parts: [PartName, Bounds, (p: PaintCtx) => void, boolean][] = [
    ['upperArmN', limbB(body.upperArm), (p) => P.upperArm(p, body.upperArm), true],
    ['upperArmF', limbB(body.upperArm), (p) => P.upperArm(p, body.upperArm), false],
    ['foreArmN', limbB(body.foreArm), (p) => P.foreArm(p, body.foreArm), true],
    ['foreArmF', limbB(body.foreArm), (p) => P.foreArm(p, body.foreArm), false],
    ['thighN', limbB(body.thigh), (p) => P.thigh(p, body.thigh), true],
    ['thighF', limbB(body.thigh), (p) => P.thigh(p, body.thigh), false],
    ['shinN', limbB(body.shin), (p) => P.shin(p, body.shin), true],
    ['shinF', limbB(body.shin), (p) => P.shin(p, body.shin), false],
    ['fistN', handB, (p) => P.fist(p), true],
    ['fistF', handB, (p) => P.fist(p), false],
    ['palmN', handB, (p) => P.palm(p), true],
    ['palmF', handB, (p) => P.palm(p), false],
    ['footN', footB, (p) => P.foot(p), true],
    ['footF', footB, (p) => P.foot(p), false],
    ['torso', torsoB, (p) => P.torso(p), true],
    ['head', headB, (p) => P.head(p), true],
  ];
  const pending: Pending[] = [];
  const mk = (flat: string | null, glow: string | null): RigSet => {
    const set = {} as RigSet;
    for (const [name, b, fn, near] of parts) {
      const sprite: Sprite = { img: null as unknown as CanvasImageSource, sx: 0, sy: 0, sw: 0, sh: 0, ox: -b.x0, oy: b.y1, s: scale };
      set[name] = sprite;
      pending.push({ b, glow, sprite, paint: (ctx) => fn({ ctx, pal: near ? pal : far, body, near, rimA, rimB, flat }) });
    }
    return set;
  };
  const rig: Rig = { color: mk(null, null), white: mk('#ffffff', null), glow: mk(pal.glow, pal.glow), body };
  bakeAtlas(pending, scale);
  return rig;
}

/** Base transform of the current rig draw (captured once per drawRig). */
let ba = 1, bb = 0, bc = 0, bd = 1, be = 0, bf = 0;

/**
 * Draws one part: base * translate(x, y) * rotate(ang) * scale(1/s, -1/s), applied with a
 * single setTransform (far fewer canvas ops than save/translate/rotate/scale/restore).
 */
function part(ctx: CanvasRenderingContext2D, sp: Sprite, x: number, y: number, ang: number): void {
  const cs = Math.cos(ang), sn = Math.sin(ang);
  const k = 1 / sp.s;
  // local matrix L = T(x,y) R(ang) S(k, -k)
  const la = cs * k, lb = sn * k, lc = sn * k, ld = -cs * k;
  // M = Base * L
  ctx.setTransform(
    ba * la + bc * lb, bb * la + bd * lb,
    ba * lc + bc * ld, bb * lc + bd * ld,
    ba * x + bc * y + be, bb * x + bd * y + bf,
  );
  ctx.drawImage(sp.img, sp.sx, sp.sy, sp.sw, sp.sh, -sp.ox * sp.s, -sp.oy * sp.s, sp.sw, sp.sh);
}

function captureBase(ctx: CanvasRenderingContext2D): void {
  const m = ctx.getTransform();
  ba = m.a; bb = m.b; bc = m.c; bd = m.d; be = m.e; bf = m.f;
}

function restoreBase(ctx: CanvasRenderingContext2D): void {
  ctx.setTransform(ba, bb, bc, bd, be, bf);
}

const ang = (a: Pt, b: Pt) => Math.atan2(b.y - a.y, b.x - a.x);
const D2R = Math.PI / 180;

function footAngle(kn: Pt, ft: Pt): number {
  let dx = ft.x - kn.x, dy = ft.y - kn.y;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  dx /= d; dy /= d;
  const lift = Math.min(1, Math.max(0, (ft.y - 4) / 30));
  let px = -dy, py = dx;
  if (px < 0) { px = -px; py = -py; }
  const fx = (1 - lift) + (dx * 0.5 + px * 0.5) * lift;
  const fy = (dx * 0 + (dy * 0.5 + py * 0.5)) * lift;
  return Math.atan2(fy, fx);
}

/**
 * Draws the rig in the current transform (fighter local space, y-up). `chains` is called for
 * the back and front cloth layers.
 */
export function drawRig(ctx: CanvasRenderingContext2D, s: Skel, set: RigSet, chains: ((layer: 'back' | 'front') => void) | null): void {
  captureBase(ctx);
  const hand = s.open ? (set.palmF) : set.fistF;
  // far arm
  part(ctx, set.upperArmF, s.shB.x, s.shB.y, ang(s.shB, s.elB));
  const fa = ang(s.elB, s.haB);
  part(ctx, set.foreArmF, s.elB.x, s.elB.y, fa);
  part(ctx, hand, s.haB.x, s.haB.y, fa);
  // far leg
  part(ctx, set.thighF, s.hpB.x, s.hpB.y, ang(s.hpB, s.knB));
  part(ctx, set.shinF, s.knB.x, s.knB.y, ang(s.knB, s.ftB));
  part(ctx, set.footF, s.ftB.x, s.ftB.y, footAngle(s.knB, s.ftB));
  if (chains) { restoreBase(ctx); chains('back'); captureBase(ctx); }
  // torso
  part(ctx, set.torso, s.hip.x, s.hip.y, -s.lean * D2R);
  // near leg
  part(ctx, set.thighN, s.hpF.x, s.hpF.y, ang(s.hpF, s.knF));
  part(ctx, set.shinN, s.knF.x, s.knF.y, ang(s.knF, s.ftF));
  part(ctx, set.footN, s.ftF.x, s.ftF.y, footAngle(s.knF, s.ftF));
  // head
  part(ctx, set.head, s.head.x, s.head.y, -s.headAng * D2R);
  if (chains) { restoreBase(ctx); chains('front'); captureBase(ctx); }
  // near arm
  part(ctx, set.upperArmN, s.shF.x, s.shF.y, ang(s.shF, s.elF));
  const fn = ang(s.elF, s.haF);
  part(ctx, set.foreArmN, s.elF.x, s.elF.y, fn);
  part(ctx, s.open ? set.palmN : set.fistN, s.haF.x, s.haF.y, fn);
  restoreBase(ctx);
}

/** Pixel scale used for baking sprites (crisp at max zoom on the current display). */
let rigPixelScale = 2;
const cache = new Map<string, Rig>();

export function setRigPixelRatio(pixelRatio: number): void {
  const s = Math.round(Math.min(3, Math.max(1.5, pixelRatio * 1.45)) * 4) / 4;
  if (s !== rigPixelScale) { rigPixelScale = s; cache.clear(); }
}

/** Cached rig for a character + palette + light combination. */
export function getRig(ch: CharacterDef, pal: Palette, rimA: string, rimB: string): Rig {
  const key = `${ch.id}|${pal.name}|${rimA}|${rimB}|${rigPixelScale}`;
  let r = cache.get(key);
  if (!r) {
    r = bakeRig(ch, pal, rimA, rimB, rigPixelScale);
    cache.set(key, r);
    if (cache.size > 40) cache.delete(cache.keys().next().value as string);
  }
  return r;
}
