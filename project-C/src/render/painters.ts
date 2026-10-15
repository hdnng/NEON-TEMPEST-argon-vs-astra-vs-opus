/**
 * Part painters: draw each body part of each fighter style in the part's LOCAL frame
 * (y-up). They run only at bake time (rig.ts), so they can afford gradients and real blur glows.
 *
 * Frames:
 *  - limbs (upperArm, foreArm, thigh, shin): joint A at (0,0), joint B at (L,0).
 *    For a limb hanging down, +y is the FRONT of the limb and -y the back.
 *  - hands: wrist at (0,0), pointing +x (knuckles toward +y)
 *  - foot: ankle at (0,0), toes toward +x, sole toward -y
 *  - torso: hip center at (0,0), spine toward +y, chest/front toward +x
 *  - head: skull center at (0,0), up +y, face toward +x (includes the neck below)
 *
 * Lighting: every part is lit by two neon rim lights baked into a cross-section gradient
 * (rimA from behind/above, rimB from the front), over a dark base, with an ink outline.
 */
import type { BodyDef, Palette } from '../data/schema';
import { mix, rgba } from '../ui/theme';

export interface PaintCtx {
  ctx: CanvasRenderingContext2D;
  pal: Palette;
  body: BodyDef;
  near: boolean;
  rimA: string;
  rimB: string;
  /** Flat silhouette color, or null for full color. */
  flat: string | null;
}

export interface StylePainter {
  upperArm(p: PaintCtx, L: number): void;
  foreArm(p: PaintCtx, L: number): void;
  thigh(p: PaintCtx, L: number): void;
  shin(p: PaintCtx, L: number): void;
  fist(p: PaintCtx): void;
  palm(p: PaintCtx): void;
  foot(p: PaintCtx): void;
  torso(p: PaintCtx): void;
  head(p: PaintCtx): void;
  /** Max limb radius for canvas bounds. */
  radius: number;
}

const INK = '#03040a';

// ------------------------------------------------------------------------------- primitives

interface Bulge { at: number; top: number; bot: number }

/** Organic limb outline: tapered with muscle bulges on the front (+y) and back (-y) sides. */
function limbPath(ctx: CanvasRenderingContext2D, L: number, ra: number, rb: number, b: Bulge): void {
  ctx.beginPath();
  ctx.moveTo(0, ra);
  ctx.bezierCurveTo(L * b.at * 0.6, ra * (1 + b.top), L * (b.at + (1 - b.at) * 0.4), rb * (1 + b.top * 0.6) + (ra - rb) * 0.2, L, rb);
  ctx.arc(L, 0, rb, Math.PI / 2, -Math.PI / 2, true);
  ctx.bezierCurveTo(L * (b.at + (1 - b.at) * 0.4), -rb * (1 + b.bot * 0.6) - (ra - rb) * 0.2, L * b.at * 0.6, -ra * (1 + b.bot), 0, -ra);
  ctx.arc(0, 0, ra, -Math.PI / 2, -Math.PI * 1.5, true);
  ctx.closePath();
}

/** Cross-section gradient with baked rim lights: rimA on the back edge, rimB on the front edge. */
function rimGradient(p: PaintCtx, R: number, fill: string, strength = 1): CanvasGradient {
  const g = p.ctx.createLinearGradient(0, -R, 0, R);
  const k = p.near ? 1 : 0.65;
  g.addColorStop(0, mix(fill, p.rimA, 0.85 * k * strength));
  g.addColorStop(0.14, mix(fill, p.rimA, 0.38 * k * strength));
  g.addColorStop(0.3, mix(fill, '#000000', 0.25));
  g.addColorStop(0.55, fill);
  g.addColorStop(0.78, mix(fill, '#ffffff', 0.07));
  g.addColorStop(0.92, mix(fill, p.rimB, 0.28 * k * strength));
  g.addColorStop(1, mix(fill, p.rimB, 0.55 * k * strength));
  return g;
}

function limb(p: PaintCtx, L: number, ra: number, rb: number, fill: string, b: Bulge = { at: 0.4, top: 0.08, bot: 0.08 }): void {
  const { ctx } = p;
  limbPath(ctx, L, ra, rb, b);
  if (p.flat) { ctx.fillStyle = p.flat; ctx.fill(); return; }
  const R = Math.max(ra, rb) * (1 + Math.max(b.top, b.bot));
  ctx.fillStyle = rimGradient(p, R, fill);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.stroke();
}

function poly(p: PaintCtx, pts: number[], fill: string, outline = true): void {
  const { ctx } = p;
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fillStyle = p.flat ?? fill;
  ctx.fill();
  if (outline && !p.flat) { ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke(); }
}

/** Smooth closed shape through points (quadratic midpoint spline). */
function blob(p: PaintCtx, pts: number[], fill: string | CanvasGradient, outline = true): void {
  const { ctx } = p;
  const n = pts.length / 2;
  ctx.beginPath();
  const mx = (i: number) => (pts[(i % n) * 2] + pts[((i + 1) % n) * 2]) / 2;
  const my = (i: number) => (pts[(i % n) * 2 + 1] + pts[((i + 1) % n) * 2 + 1]) / 2;
  ctx.moveTo(mx(n - 1), my(n - 1));
  for (let i = 0; i < n; i++) ctx.quadraticCurveTo(pts[i * 2], pts[i * 2 + 1], mx(i), my(i));
  ctx.closePath();
  ctx.fillStyle = p.flat ?? fill;
  ctx.fill();
  if (outline && !p.flat) { ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke(); }
}

function circle(p: PaintCtx, x: number, y: number, r: number, fill: string, outline = true): void {
  const { ctx } = p;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = p.flat ?? fill;
  ctx.fill();
  if (outline && !p.flat) { ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke(); }
}

/** Emissive neon line with a real blur glow (bake-time only). */
function neon(p: PaintCtx, pts: number[], color: string, w: number, blur = 8): void {
  if (p.flat) return;
  const { ctx } = p;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.stroke();
  if (blur > 0) {
    ctx.shadowBlur = 0;
    ctx.strokeStyle = mix(color, '#ffffff', 0.55);
    ctx.lineWidth = Math.max(0.6, w * 0.4);
    ctx.stroke();
  }
  ctx.restore();
}

/** Plain dark detail line (seams, folds). */
function seam(p: PaintCtx, pts: number[], w = 1.2, a = 0.5): void {
  if (p.flat) return;
  const { ctx } = p;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = rgba('#000000', a);
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.stroke();
  ctx.restore();
}

function glowDot(p: PaintCtx, x: number, y: number, r: number, color: string): void {
  if (p.flat) return;
  const { ctx } = p;
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = r * 4;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Clenched fist: knuckles toward +x, finger rolls on +y. */
function fistShape(p: PaintCtx, r: number, fill: string): void {
  const { ctx } = p;
  const g = p.flat ? p.flat : rimGradient(p, r * 1.1, fill);
  blob(p, [-r * 0.6, -r * 0.85, r * 0.9, -r * 1.05, r * 1.55, -r * 0.4, r * 1.55, r * 0.5, r * 0.9, r * 1.1, -r * 0.6, r * 0.85], g);
  if (p.flat) return;
  ctx.save();
  ctx.strokeStyle = rgba('#000000', 0.45);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const yy of [-0.35, 0.1, 0.55]) { ctx.moveTo(r * 0.75, yy * r); ctx.lineTo(r * 1.45, yy * r); }
  ctx.stroke();
  // thumb
  ctx.fillStyle = mix(fill, '#000000', 0.15);
  ctx.beginPath();
  ctx.ellipse(r * 0.45, -r * 0.75, r * 0.65, r * 0.32, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.restore();
}

/** Open hand (palm strike): fingers along +x. */
function palmShape(p: PaintCtx, r: number, fill: string): void {
  const g = p.flat ? p.flat : rimGradient(p, r, fill);
  blob(p, [-r * 0.5, -r * 0.7, r * 1.0, -r * 0.8, r * 2.3, -r * 0.45, r * 2.4, r * 0.35, r * 1.1, r * 0.7, r * 0.7, r * 1.5, r * 0.2, r * 1.2, -r * 0.5, r * 0.7], g);
  if (p.flat) return;
  seam(p, [r * 1.2, -r * 0.15, r * 2.2, -r * 0.1], 0.9, 0.45);
  seam(p, [r * 1.2, r * 0.3, r * 2.1, r * 0.3], 0.9, 0.45);
}

function footShape(p: PaintCtx, len: number, h: number, fill: string, sole?: string, boot = 0): void {
  const g = p.flat ? p.flat : rimGradient(p, h, fill);
  blob(p, [-len * 0.32, -2, -len * 0.3, h * 1.1 + boot, len * 0.18, h * 1.05 + boot * 0.6, len * 0.62, h * 0.55, len * 0.95, h * 0.2, len * 0.98, -2], g);
  if (p.flat) return;
  seam(p, [-len * 0.3, 1.5, len * 0.95, 1.5], 1.4, 0.55);
  if (sole) neon(p, [-len * 0.25, -0.5, len * 0.9, -0.5], sole, 1.4, 6);
}

/** Smooth torso profile from hip (y=0) to shoulders (y=L): spine +y, front +x. */
function torsoShape(p: PaintCtx, L: number, back: number, belly: number, chest: number, shoulderBack: number, waist: number, fill: string): void {
  const { ctx } = p;
  ctx.beginPath();
  ctx.moveTo(-back, -6);
  ctx.lineTo(belly * 0.95, -6);
  ctx.quadraticCurveTo(waist * 1.08, L * 0.18, waist, L * 0.38);
  ctx.quadraticCurveTo(chest * 1.12, L * 0.6, chest * 0.92, L * 0.8);
  ctx.quadraticCurveTo(chest * 0.6, L * 1.02, chest * 0.1, L * 1.04);
  ctx.quadraticCurveTo(-shoulderBack * 0.6, L * 1.08, -shoulderBack, L * 0.92);
  ctx.quadraticCurveTo(-back * 1.15, L * 0.6, -back * 0.95, L * 0.4);
  ctx.quadraticCurveTo(-back * 1.08, L * 0.15, -back, -6);
  ctx.closePath();
  if (p.flat) { ctx.fillStyle = p.flat; ctx.fill(); return; }
  // horizontal cross-section lighting (back = rimA, front = rimB)
  const g = ctx.createLinearGradient(-back * 1.2, 0, chest * 1.15, 0);
  g.addColorStop(0, mix(fill, p.rimA, 0.7));
  g.addColorStop(0.1, mix(fill, p.rimA, 0.25));
  g.addColorStop(0.32, mix(fill, '#000000', 0.3));
  g.addColorStop(0.62, fill);
  g.addColorStop(0.86, mix(fill, '#ffffff', 0.06));
  g.addColorStop(1, mix(fill, p.rimB, 0.45));
  ctx.fillStyle = g;
  ctx.fill();
  // vertical occlusion: darker toward the waist
  const v = ctx.createLinearGradient(0, -6, 0, L);
  v.addColorStop(0, 'rgba(0,0,0,0.35)');
  v.addColorStop(0.4, 'rgba(0,0,0,0)');
  ctx.fillStyle = v;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.stroke();
}

/** Skull, jaw, ear, nose and neck; face toward +x. */
function skull(p: PaintCtx, r: number, skin: string, o: { jaw?: number; neck?: number; nose?: boolean; brow?: string } = {}): void {
  const { ctx } = p;
  const jaw = o.jaw ?? 1;
  const neckW = o.neck ?? 0.44;
  // neck
  ctx.beginPath();
  ctx.moveTo(-r * neckW, -r * 2.1);
  ctx.lineTo(-r * neckW * 1.05, -r * 0.4);
  ctx.lineTo(r * neckW * 1.1, -r * 0.5);
  ctx.lineTo(r * neckW * 1.25, -r * 2.1);
  ctx.closePath();
  ctx.fillStyle = p.flat ?? mix(skin, '#000000', 0.35);
  ctx.fill();
  // head shape
  ctx.beginPath();
  ctx.moveTo(-r * 0.95, r * 0.2);
  ctx.bezierCurveTo(-r * 1.05, r * 1.15, r * 0.75, r * 1.25, r * 0.98, r * 0.35);
  ctx.lineTo(r * 1.12 * jaw, -r * 0.05); // nose
  ctx.lineTo(r * 0.98 * jaw, -r * 0.22);
  ctx.quadraticCurveTo(r * 1.0 * jaw, -r * 0.6, r * 0.75 * jaw, -r * 0.82);
  ctx.quadraticCurveTo(r * 0.2, -r * 0.95, -r * 0.35, -r * 0.62);
  ctx.quadraticCurveTo(-r * 0.95, -r * 0.4, -r * 0.95, r * 0.2);
  ctx.closePath();
  if (p.flat) { ctx.fillStyle = p.flat; ctx.fill(); return; }
  const g = ctx.createLinearGradient(-r * 1.1, 0, r * 1.1, 0);
  g.addColorStop(0, mix(skin, p.rimA, 0.65));
  g.addColorStop(0.15, mix(skin, '#000000', 0.25));
  g.addColorStop(0.55, skin);
  g.addColorStop(0.85, mix(skin, '#ffffff', 0.08));
  g.addColorStop(1, mix(skin, p.rimB, 0.35));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // ear
  ctx.fillStyle = mix(skin, '#000000', 0.2);
  ctx.beginPath();
  ctx.ellipse(-r * 0.15, 0, r * 0.18, r * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgba('#000000', 0.5);
  ctx.lineWidth = 1;
  ctx.stroke();
  // brow shadow + eye socket
  ctx.fillStyle = rgba('#000000', 0.35);
  ctx.beginPath();
  ctx.ellipse(r * 0.62, r * 0.12, r * 0.3, r * 0.14, -0.1, 0, Math.PI * 2);
  ctx.fill();
  // mouth line
  seam(p, [r * 0.72 * jaw, -r * 0.48, r * 0.92 * jaw, -r * 0.46], 1, 0.5);
}

const pts = (arr: [number, number][], r: number): number[] => arr.flatMap(([f, u]) => [f * r, u * r]);

function eye(p: PaintCtx, r: number, color: string, w = 1.6): void {
  neon(p, pts([[0.58, 0.12], [0.86, 0.1]], r), color, w, 8);
}

// ------------------------------------------------------------------------------- HAYATE

const ARM = { at: 0.38, top: 0.16, bot: 0.1 };
const FORE = { at: 0.3, top: 0.12, bot: 0.12 };
const THIGH = { at: 0.35, top: 0.12, bot: 0.06 };
const CALF = { at: 0.3, top: 0.02, bot: 0.16 };

const hayate: StylePainter = {
  radius: 15,
  upperArm(p, L) {
    limb(p, L, 9.5, 7.5, p.pal.skin, ARM);
    if (p.near) neon(p, [L * 0.2, 2, L * 0.42, -2, L * 0.56, 2.5, L * 0.8, -1], p.pal.accent, 1.3, 7);
  },
  foreArm(p, L) {
    limb(p, L, 8, 6.4, p.pal.skin, FORE);
    if (p.flat) return;
    // hand wraps
    p.ctx.save();
    limbPath(p.ctx, L, 8, 6.4, FORE);
    p.ctx.clip();
    p.ctx.fillStyle = rgba('#e8eef8', 0.85);
    p.ctx.fillRect(L * 0.55, -12, L * 0.5, 24);
    p.ctx.restore();
    for (let i = 0; i < 3; i++) { const x = L * (0.6 + i * 0.13); seam(p, [x, -7, x - 3, 7], 1, 0.35); }
    if (p.near) neon(p, [L * 0.57, -7.2, L * 0.57, 7.2], p.pal.glow, 1.3, 6);
  },
  thigh(p, L) { limb(p, L, 14, 11, p.pal.body, THIGH); seam(p, [L * 0.2, 4, L * 0.9, 3], 1, 0.35); },
  shin(p, L) {
    limb(p, L, 11, 12.5, p.pal.body, { at: 0.4, top: 0.04, bot: 0.06 });
    if (p.flat) return;
    seam(p, [L * 0.15, -4, L * 0.85, -6], 1, 0.35);
    // ankle wraps
    poly(p, [L * 0.86, -9, L * 1.0, -8, L * 1.0, 8, L * 0.86, 9], '#d9dfe9', false);
    if (p.near) neon(p, [L * 0.84, -11, L * 0.84, 11], rgba(p.pal.accent, 0.8), 1.6, 6);
  },
  fist(p) { fistShape(p, 8.5, p.pal.skin); },
  palm(p) { palmShape(p, 7.2, p.pal.skin); },
  foot(p) { footShape(p, 22, 8, p.pal.skin); },
  torso(p) {
    const L = p.body.torso;
    torsoShape(p, L, 18, 16, 21, 19, 15, p.pal.body);
    if (p.flat) return;
    // open V-neck showing the chest
    blob(p, [4, L * 1.0, 14, L * 1.0, 19, L * 0.72, 11, L * 0.45], mix(p.pal.skin, '#000000', 0.1), false);
    seam(p, [12, L * 0.82, 17, L * 0.7], 1, 0.4);
    neon(p, [3, L * 1.0, 10.5, L * 0.46, 19, L * 0.74], p.pal.accent, 1.6, 8);
    // gi fold lines
    seam(p, [-10, L * 0.75, 2, L * 0.4], 1.2, 0.35);
    seam(p, [-14, L * 0.5, -6, L * 0.2], 1.2, 0.3);
    // belt
    blob(p, [-19, -1, 17, -2, 18, 13, -19, 14], p.pal.cloth);
    neon(p, [-16, 6.5, 15, 6], rgba('#ffffff', 0.18), 0.8, 0);
    // pelvis / pants top
    blob(p, [-18, -16, 16, -16, 17, -2, -19, -1], mix(p.pal.body, '#000000', 0.15));
  },
  head(p) {
    const r = p.body.head;
    skull(p, r, p.pal.skin);
    if (p.flat) return;
    // spiky hair
    blob(p, pts([[0.95, 0.42], [0.5, 1.05], [0.2, 1.5], [-0.2, 1.15], [-0.55, 1.55], [-0.85, 1.0], [-1.45, 1.2], [-1.15, 0.5], [-1.7, 0.25], [-1.05, -0.05], [-1.0, -0.5], [-0.55, 0.3], [0.35, 0.62]], r), p.pal.hair);
    neon(p, pts([[0.15, 1.38], [-0.5, 1.45], [-1.35, 1.1]], r), rgba(p.pal.accent, 0.55), 1.1, 5);
    // headband on the forehead
    blob(p, pts([[1.0, 0.66], [0.2, 0.8], [-0.98, 0.72], [-0.98, 0.46], [0.2, 0.5], [1.02, 0.44]], r), p.pal.cloth, true);
    eye(p, r, p.pal.glow);
  },
};

// ------------------------------------------------------------------------------- MAGNUS

const magnus: StylePainter = {
  radius: 20,
  upperArm(p, L) {
    if (p.near) {
      limb(p, L, 16, 13, p.pal.body, { at: 0.4, top: 0.1, bot: 0.1 });
      if (p.flat) return;
      // armor plates
      for (const x of [0.32, 0.62]) seam(p, [L * x, -14, L * x + 2, 14], 2, 0.6);
      neon(p, [L * 0.12, 4, L * 0.88, 4], rgba(p.pal.accent, 0.8), 1.5, 7);
      glowDot(p, 0, 0, 4.5, p.pal.accent);
    } else {
      limb(p, L, 15, 12, p.pal.skin, { at: 0.4, top: 0.2, bot: 0.12 });
      if (!p.flat) neon(p, [L * 0.3, -6, L * 0.45, 5, L * 0.6, -5, L * 0.75, 5], rgba('#000000', 0.4), 2.2, 0);
    }
  },
  foreArm(p, L) {
    if (p.near) {
      limb(p, L, 14, 12.5, p.pal.body, { at: 0.35, top: 0.12, bot: 0.12 });
      if (p.flat) return;
      for (const x of [0.3, 0.55, 0.78]) seam(p, [L * x, -13, L * x + 2, 13], 2, 0.6);
      neon(p, [L * 0.12, 3, L * 0.85, 3], rgba(p.pal.accent, 0.85), 1.5, 7);
      glowDot(p, 0, 0, 3.8, p.pal.accent);
    } else limb(p, L, 12.5, 10.5, p.pal.skin, { at: 0.3, top: 0.18, bot: 0.12 });
  },
  thigh(p, L) { limb(p, L, 18, 14, p.pal.bodyDark, { at: 0.35, top: 0.12, bot: 0.08 }); seam(p, [L * 0.2, -8, L * 0.85, -6], 1.4, 0.4); },
  shin(p, L) {
    limb(p, L, 14, 13, p.pal.bodyDark, CALF);
    if (p.flat) return;
    // boot top
    blob(p, [L * 0.55, -15, L * 1.02, -14, L * 1.02, 14, L * 0.55, 15], mix(p.pal.body, '#000000', 0.2));
    if (p.near) neon(p, [L * 0.6, 0, L * 0.95, 0], rgba(p.pal.accent, 0.7), 2.2, 7);
  },
  fist(p) { fistShape(p, p.near ? 12.5 : 11.5, p.near ? p.pal.bodyDark : p.pal.skin); if (p.near) glowDot(p, 4, 0, 2.2, p.pal.accent); },
  palm(p) { palmShape(p, p.near ? 10.5 : 9.5, p.near ? p.pal.bodyDark : p.pal.skin); },
  foot(p) { footShape(p, 30, 13, p.pal.body, undefined, 2); },
  torso(p) {
    const L = p.body.torso;
    torsoShape(p, L, 27, 26, 36, 30, 26, p.pal.skin);
    if (p.flat) return;
    const { ctx } = p;
    // pecs and abs
    ctx.save();
    ctx.strokeStyle = rgba('#000000', 0.45);
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(34, L * 0.66); ctx.quadraticCurveTo(10, L * 0.58, 20, L * 0.4); ctx.stroke();
    ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(18, L * 0.36); ctx.lineTo(22, L * 0.12); ctx.moveTo(10, L * 0.3); ctx.lineTo(24, L * 0.28); ctx.moveTo(10, L * 0.18); ctx.lineTo(24, L * 0.16); ctx.stroke();
    ctx.restore();
    // harness straps
    neon(p, [-27, L * 0.95, 28, L * 0.33], p.pal.bodyDark, 7, 0);
    neon(p, [20, L * 1.0, -25, L * 0.3], p.pal.bodyDark, 6, 0);
    glowDot(p, 16, L * 0.62, 6, p.pal.accent);
    circle(p, 16, L * 0.62, 3, '#ffffff', false);
    // belt + pants top
    blob(p, [-28, -1, 26, -2, 27, 17, -29, 17], p.pal.bodyDark);
    neon(p, [-26, 8, 24, 8], p.pal.accent, 2, 8);
    blob(p, [-28, -18, 26, -18, 27, -2, -29, -1], mix(p.pal.bodyDark, '#000000', 0.2));
  },
  head(p) {
    const r = p.body.head;
    skull(p, r, p.pal.skin, { jaw: 1.12, neck: 0.72 });
    if (p.flat) return;
    // beard
    blob(p, pts([[1.08, -0.15], [0.95, -0.75], [0.35, -1.05], [-0.25, -0.75], [-0.35, -0.15], [0.3, -0.3]], r), p.pal.hair, false);
    // cyber eyepiece
    blob(p, pts([[0.45, 0.35], [0.95, 0.32], [1.0, -0.08], [0.45, -0.1]], r), '#1a1c24', true);
    glowDot(p, 0.75 * r, 0.12 * r, 2.8, p.pal.accent);
    seam(p, pts([[-0.3, 0.85], [0.55, 0.7]], r), 2, 0.2);
  },
};

// ------------------------------------------------------------------------------- SABLE

const sable: StylePainter = {
  radius: 13,
  upperArm(p, L) {
    limb(p, L, 7.5, 6, p.pal.body, { at: 0.38, top: 0.12, bot: 0.08 });
    if (p.near) neon(p, [L * 0.1, 0, L * 0.9, 0], rgba(p.pal.accent, 0.8), 1.2, 6);
  },
  foreArm(p, L) {
    limb(p, L, 6.5, 5.5, p.pal.body, FORE);
    if (p.flat) return;
    // armored bracer
    blob(p, [L * 0.45, -7.5, L * 1.02, -6.5, L * 1.02, 6.5, L * 0.45, 7.5], p.pal.bodyDark);
    neon(p, [L * 0.48, 0, L * 0.98, 0], rgba(p.pal.accent, 0.8), 1.1, 5);
    // wrist blade sweeping back along the forearm
    neon(p, [L * 0.92, 6, L * 0.92 - 36, 12], rgba(p.pal.glow, p.near ? 0.95 : 0.7), 2.4, 10);
  },
  thigh(p, L) {
    limb(p, L, 10, 7.5, p.pal.body, THIGH);
    if (p.near) neon(p, [L * 0.12, 0, L * 0.9, -1], rgba(p.pal.accent, 0.75), 1.2, 6);
  },
  shin(p, L) {
    // knee-high boot
    limb(p, L, 8.5, 7, p.pal.bodyDark, CALF);
    if (p.flat) return;
    neon(p, [L * 0.02, 8, L * 0.25, 8.5], p.pal.accent, 1.5, 6);
    seam(p, [L * 0.3, -6, L * 0.9, -5], 1, 0.4);
  },
  fist(p) { fistShape(p, 7, p.pal.bodyDark); },
  palm(p) { palmShape(p, 6.2, p.pal.bodyDark); },
  foot(p) { footShape(p, 21, 7, p.pal.bodyDark, p.near ? p.pal.accent : undefined, 1); },
  torso(p) {
    const L = p.body.torso;
    torsoShape(p, L, 13, 12, 16, 14, 10, p.pal.body);
    if (p.flat) return;
    // chest plate
    blob(p, [-2, L * 1.0, 15, L * 0.92, 17, L * 0.6, 4, L * 0.5], p.pal.bodyDark);
    neon(p, [13, L * 0.95, 9.5, L * 0.45, 12, L * 0.05], p.pal.accent, 1.5, 8);
    neon(p, [-12, L * 0.8, 3, L * 0.55], rgba(p.pal.accent, 0.55), 1.1, 5);
    blob(p, [-14, -1, 13, -1, 13, 9, -14, 9], p.pal.bodyDark);
    blob(p, [-14, -14, 12, -14, 13, -1, -14, -1], mix(p.pal.body, '#000000', 0.2));
  },
  head(p) {
    const r = p.body.head;
    skull(p, r, p.pal.skin, { jaw: 0.92, neck: 0.38 });
    if (p.flat) return;
    // sleek bob with side sweep
    blob(p, pts([[0.95, 0.5], [0.55, 1.18], [-0.35, 1.2], [-1.12, 0.7], [-1.15, -0.2], [-0.8, -0.85], [-0.45, -0.3], [-0.5, 0.3], [0.2, 0.55], [0.75, 0.25]], r), p.pal.hair);
    neon(p, pts([[0.4, 1.12], [-0.6, 1.1], [-1.1, 0.6]], r), rgba(p.pal.accent, 0.4), 1, 4);
    // visor
    blob(p, pts([[1.12, 0.32], [0.3, 0.38], [-0.25, 0.3], [-0.25, 0.02], [0.3, -0.02], [1.12, 0.0]], r), '#0a0612', true);
    neon(p, pts([[1.05, 0.15], [0.15, 0.2]], r), p.pal.glow, 2.2, 10);
  },
};

// ------------------------------------------------------------------------------- WARDEN

const warden: StylePainter = {
  radius: 16,
  upperArm(p, L) {
    // coat sleeve
    limb(p, L, 10.5, 9, p.pal.body, { at: 0.4, top: 0.08, bot: 0.08 });
    if (p.flat) {
      if (p.near) circle(p, 0, 2, 14, p.flat, false);
      return;
    }
    seam(p, [L * 0.2, -6, L * 0.85, -7], 1.2, 0.35);
    if (p.near) {
      // armored pauldron
      blob(p, [-12, -10, 4, -14, 16, -6, 18, 8, 6, 16, -12, 12], p.pal.bodyDark);
      neon(p, [-8, 13, 6, 15, 16, 7], p.pal.accent, 1.4, 6);
    }
  },
  foreArm(p, L) {
    limb(p, L, 10, 9.5, p.pal.bodyDark, { at: 0.5, top: 0.06, bot: 0.06 });
    if (p.flat) return;
    // gauntlet emitter
    for (const x of [0.4, 0.6]) seam(p, [L * x, -9, L * x, 9], 1.6, 0.5);
    if (p.near) neon(p, [L * 0.3, 1, L * 0.9, 1], rgba(p.pal.accent, 0.9), 1.6, 7);
  },
  thigh(p, L) { limb(p, L, 12, 9.5, p.pal.bodyDark, THIGH); },
  shin(p, L) {
    limb(p, L, 10, 10, p.pal.bodyDark, CALF);
    if (p.flat) return;
    blob(p, [L * 0.05, 6, L * 0.6, 8, L * 0.6, 12, L * 0.05, 11], p.pal.body, false);
    if (p.near) neon(p, [L * 0.15, 9, L * 0.55, 10], rgba(p.pal.accent, 0.8), 1.4, 6);
  },
  fist(p) { fistShape(p, 9.5, p.pal.bodyDark); glowDot(p, 4, 0, 3, p.pal.accent); },
  palm(p) { palmShape(p, 8.2, p.pal.bodyDark); glowDot(p, 6, 0, 3.4, p.pal.accent); },
  foot(p) { footShape(p, 25, 9, p.pal.body, undefined, 3); },
  torso(p) {
    const L = p.body.torso;
    torsoShape(p, L, 20, 18, 22, 22, 17, p.pal.body);
    if (p.flat) return;
    // coat lapel + trim
    blob(p, [10, L * 1.02, 18, L * 0.96, 21, L * 0.6, 14, L * 0.4], mix(p.pal.body, '#000000', 0.25), false);
    neon(p, [17, L * 1.0, 11, L * 0.55, 17, -4], p.pal.accent, 1.5, 7);
    // high collar
    blob(p, [-8, L * 0.9, 14, L * 0.93, 18, L * 1.2, -10, L * 1.18], p.pal.bodyDark);
    neon(p, [-8, L * 1.17, 17, L * 1.19], rgba(p.pal.accent, 0.6), 1, 5);
    // belt + buckle
    blob(p, [-21, 3, 19, 3, 19, 14, -21, 14], p.pal.bodyDark);
    glowDot(p, 15, 8.5, 2.6, p.pal.accent);
    seam(p, [-14, L * 0.7, -4, L * 0.3], 1.2, 0.3);
    blob(p, [-21, -14, 19, -14, 19, 3, -21, 3], p.pal.bodyDark);
  },
  head(p) {
    const r = p.body.head;
    skull(p, r, p.pal.skin, { jaw: 0.96, neck: 0.48 });
    if (p.flat) return;
    // riot helmet
    blob(p, pts([[1.15, 0.4], [0.9, 1.08], [0.05, 1.32], [-0.95, 1.05], [-1.25, 0.15], [-1.05, -0.65], [-0.35, -0.75], [-0.25, 0.0], [1.15, 0.02]], r), p.pal.bodyDark);
    // visor
    blob(p, pts([[1.16, 0.36], [0.15, 0.42], [0.15, 0.12], [1.16, 0.08]], r), '#05140f', false);
    neon(p, pts([[1.1, 0.24], [0.2, 0.28]], r), p.pal.glow, 2.4, 10);
    neon(p, pts([[-0.7, 1.05], [-1.35, 1.7]], r), rgba(p.pal.accent, 0.8), 1.2, 5);
    // respirator mask
    blob(p, pts([[1.08, -0.12], [0.9, -0.85], [0.15, -0.9], [0.1, -0.15]], r), p.pal.bodyDark, true);
    seam(p, pts([[0.5, -0.35], [0.95, -0.35]], r), 1, 0.5);
  },
};

export const PAINTERS: Record<BodyDef['style'], StylePainter> = { hayate, magnus, sable, warden };
