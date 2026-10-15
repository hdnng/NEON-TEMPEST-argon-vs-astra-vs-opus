/**
 * Per-style secondary motion: cloth chains (headband tails, ponytail, scarf, coat tails, tabards)
 * anchored to the skeleton and drawn as ribbons. Body parts themselves are sprite-baked (rig.ts).
 */
import type { BodyDef, Palette } from '../data/schema';
import { mix, rgba } from '../ui/theme';
import { Chain, drawRibbon, strokeChain } from './cloth';
import type { Pt, Skel } from './skeleton';

export interface DrawOpts {
  /** Flat silhouette color (afterimages, flashes); disables details. */
  flat: string | null;
  rimA: string;
  rimB: string;
  glow: boolean;
  t: number;
  /** Extra emissive intensity (drive / super). */
  energy: number;
}

export interface PalSet {
  n: Palette;
  f: Palette;
  ink: string;
}

const palCache = new Map<Palette, PalSet>();
export function palSet(p: Palette): PalSet {
  let s = palCache.get(p);
  if (s) return s;
  const dark = (c: string) => mix(c, '#04050c', 0.38);
  s = {
    n: p,
    f: {
      ...p, skin: dark(p.skin), body: dark(p.body), bodyDark: dark(p.bodyDark), cloth: dark(p.cloth),
      hair: dark(p.hair), accent: mix(p.accent, '#000000', 0.25), glow: p.glow, rim: p.rim,
    },
    ink: '#03040a',
  };
  palCache.set(p, s);
  return s;
}

// ---------------------------------------------------------------------------------------------
// Character styles

export interface ChainSet { [name: string]: Chain }

export interface StyleDrawer {
  /** Creates the cloth chains for this style. */
  chains(): ChainSet;
  /** Steps chain anchors from the skeleton. `toWorld` maps local -> world. */
  stepChains(c: ChainSet, s: Skel, toWorld: (p: Pt, out: Pt) => Pt, facing: number, wind: number, moving: number): void;
  /** Draws chains in world space; called by the view between passes. */
  drawChains(ctx: CanvasRenderingContext2D, c: ChainSet, layer: 'back' | 'front', ps: PalSet, o: DrawOpts): void;
}

const W: Pt = { x: 0, y: 0 }, W2: Pt = { x: 0, y: 0 };

/** Head-local point helper: f = forward, u = up (in head radii). */
function hp(s: Skel, r: number, f: number, u: number, out: Pt): Pt {
  const a = (s.headAng * Math.PI) / 180;
  const ux = Math.sin(a), uy = Math.cos(a);
  out.x = s.head.x + uy * f * r + ux * u * r;
  out.y = s.head.y - ux * f * r + uy * u * r;
  return out;
}

const H1: Pt = { x: 0, y: 0 }, H2: Pt = { x: 0, y: 0 };
const lerpPt = (a: Pt, b: Pt, t: number, out: Pt): Pt => { out.x = a.x + (b.x - a.x) * t; out.y = a.y + (b.y - a.y) * t; return out; };

// ---------------- HAYATE ----------------
const hayate: StyleDrawer = {
  chains() {
    const t1 = new Chain(9, 7); t1.gravity = 0.25; t1.drag = 0.88;
    const t2 = new Chain(8, 7); t2.gravity = 0.3; t2.drag = 0.88;
    const b1 = new Chain(5, 7); b1.gravity = 0.5;
    const b2 = new Chain(5, 6); b2.gravity = 0.5;
    return { band1: t1, band2: t2, belt1: b1, belt2: b2 };
  },
  stepChains(c, s, toWorld, facing, wind, moving) {
    hp(s, 19, -0.9, 0.35, H1);
    toWorld(H1, W);
    c.band1.step(W.x, W.y, -facing * (0.9 + moving), 0.15, wind);
    c.band2.step(W.x, W.y - 2, -facing * (0.8 + moving), -0.1, wind * 0.8);
    lerpPt(s.hpF, s.hpB, 0.5, H2);
    H2.x -= s.fx * 14; H2.y -= s.fy * 14;
    toWorld(H2, W2);
    c.belt1.step(W2.x, W2.y, -facing * 0.4, -0.6, wind * 0.5, 0.08);
    c.belt2.step(W2.x, W2.y, -facing * 0.2, -0.8, wind * 0.5, 0.08);
  },
  drawChains(ctx, c, layer, ps, o) {
    if (layer !== 'back') return;
    const col = o.flat ?? ps.n.cloth;
    drawRibbon(ctx, c.belt2, 5, 2.5, o.flat ?? ps.f.cloth);
    drawRibbon(ctx, c.belt1, 5, 2.5, col);
    drawRibbon(ctx, c.band2, 5, 2, o.flat ?? ps.f.cloth);
    drawRibbon(ctx, c.band1, 6, 2, col);
    if (!o.flat) strokeChain(ctx, c.band1, rgba(ps.n.accent, 0.5), 1);
  },
};

// ---------------- MAGNUS ----------------
const magnus: StyleDrawer = {
  chains() {
    const f = new Chain(4, 9); f.gravity = 0.7; f.drag = 0.85;
    const k = new Chain(4, 9); k.gravity = 0.7; k.drag = 0.85;
    return { tabF: f, tabB: k };
  },
  stepChains(c, s, toWorld, facing, wind) {
    H1.x = s.hip.x + s.fx * 14; H1.y = s.hip.y + s.fy * 14 - 4;
    toWorld(H1, W);
    c.tabF.step(W.x, W.y, facing * 0.05, -1, wind * 0.3, 0.15);
    H2.x = s.hip.x - s.fx * 18; H2.y = s.hip.y - s.fy * 18 - 2;
    toWorld(H2, W2);
    c.tabB.step(W2.x, W2.y, -facing * 0.1, -1, wind * 0.3, 0.15);
  },
  drawChains(ctx, c, layer, ps, o) {
    if (layer === 'back') drawRibbon(ctx, c.tabB, 16, 11, o.flat ?? ps.f.cloth);
    else {
      drawRibbon(ctx, c.tabF, 15, 10, o.flat ?? ps.n.cloth);
      if (!o.flat) strokeChain(ctx, c.tabF, rgba(ps.n.accent, 0.6), 1.4);
    }
  },
};

// ---------------- SABLE ----------------
const sable: StyleDrawer = {
  chains() {
    const p = new Chain(11, 8); p.gravity = 0.35; p.drag = 0.9;
    const s1 = new Chain(7, 7); s1.gravity = 0.2; s1.drag = 0.9;
    return { tail: p, scarf: s1 };
  },
  stepChains(c, s, toWorld, facing, wind, moving) {
    hp(s, 17, -0.75, 0.7, H1);
    toWorld(H1, W);
    c.tail.step(W.x, W.y, -facing * (0.5 + moving * 0.8), -0.2, wind);
    lerpPt(s.neck, s.head, 0.15, H2);
    H2.x -= s.fx * 6; H2.y -= s.fy * 6;
    toWorld(H2, W2);
    c.scarf.step(W2.x, W2.y, -facing * (1 + moving), 0.1, wind * 1.2);
  },
  drawChains(ctx, c, layer, ps, o) {
    if (layer !== 'back') return;
    drawRibbon(ctx, c.scarf, 9, 3, o.flat ?? ps.n.cloth);
    if (!o.flat) strokeChain(ctx, c.scarf, rgba(ps.n.accent, 0.7), 1.2);
    drawRibbon(ctx, c.tail, 11, 3, o.flat ?? ps.n.hair);
    if (!o.flat) strokeChain(ctx, c.tail, rgba(ps.n.accent, 0.35), 1);
  },
};

// ---------------- WARDEN ----------------
const warden: StyleDrawer = {
  chains() {
    const a = new Chain(7, 12); a.gravity = 0.6; a.drag = 0.86;
    const b2 = new Chain(6, 12); b2.gravity = 0.6; b2.drag = 0.86;
    return { coatB: a, coatF: b2 };
  },
  stepChains(c, s, toWorld, facing, wind, moving) {
    H1.x = s.hip.x - s.fx * 16 + s.ux * 8; H1.y = s.hip.y - s.fy * 16 + s.uy * 8;
    toWorld(H1, W);
    c.coatB.step(W.x, W.y, -facing * (0.35 + moving * 0.7), -1, wind, 0.1);
    H2.x = s.hip.x + s.fx * 6 + s.ux * 6; H2.y = s.hip.y + s.fy * 6 + s.uy * 6;
    toWorld(H2, W2);
    c.coatF.step(W2.x, W2.y, -facing * (0.15 + moving * 0.5), -1, wind * 0.8, 0.1);
  },
  drawChains(ctx, c, layer, ps, o) {
    if (layer === 'back') {
      drawRibbon(ctx, c.coatB, 22, 17, o.flat ?? ps.f.body);
      if (!o.flat) strokeChain(ctx, c.coatB, rgba(ps.n.accent, 0.25), 1);
    } else {
      drawRibbon(ctx, c.coatF, 17, 13, o.flat ?? ps.n.body);
      if (!o.flat) {
        ctx.save();
        strokeChain(ctx, c.coatF, rgba(ps.n.accent, 0.55), 1.3);
        ctx.restore();
      }
    }
  },
};

export const STYLES: Record<BodyDef['style'], StyleDrawer> = { hayate, magnus, sable, warden };
