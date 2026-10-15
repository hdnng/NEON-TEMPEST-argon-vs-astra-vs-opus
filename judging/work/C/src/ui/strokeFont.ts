/**
 * Original geometric stroke font used for the logo, headings and announcer text.
 * Glyphs are polylines on a 4x6 grid (y down) with chamfered corners; rendered as neon tubes
 * (layered additive strokes) or as heavy solid letters. Supports per-letter kinetic animation.
 */
import { rgba } from './theme';

type Glyph = number[][];

const O = [1, 0, 3, 0, 4, 1, 4, 5, 3, 6, 1, 6, 0, 5, 0, 1, 1, 0];
const P_ = [0, 6, 0, 0, 3, 0, 4, 1, 4, 2, 3, 3, 0, 3];

const G: Record<string, Glyph> = {
  A: [[0, 6, 0, 1.5, 1.5, 0, 2.5, 0, 4, 1.5, 4, 6], [0, 3.6, 4, 3.6]],
  B: [[0, 3, 3, 3, 4, 2, 4, 1, 3, 0, 0, 0, 0, 6, 3, 6, 4, 5, 4, 4, 3, 3]],
  C: [[4, 0, 1, 0, 0, 1, 0, 5, 1, 6, 4, 6]],
  D: [[0, 0, 3, 0, 4, 1, 4, 5, 3, 6, 0, 6, 0, 0]],
  E: [[4, 0, 0, 0, 0, 6, 4, 6], [0, 3, 3, 3]],
  F: [[4, 0, 0, 0, 0, 6], [0, 3, 3, 3]],
  G: [[4, 1, 3, 0, 1, 0, 0, 1, 0, 5, 1, 6, 3, 6, 4, 5, 4, 3.2, 2.2, 3.2]],
  H: [[0, 0, 0, 6], [4, 0, 4, 6], [0, 3, 4, 3]],
  I: [[1, 0, 3, 0], [2, 0, 2, 6], [1, 6, 3, 6]],
  J: [[4, 0, 4, 5, 3, 6, 1, 6, 0, 5]],
  K: [[0, 0, 0, 6], [4, 0, 1.2, 3, 0, 3], [1.2, 3, 4, 6]],
  L: [[0, 0, 0, 6, 4, 6]],
  M: [[0, 6, 0, 0, 2, 3, 4, 0, 4, 6]],
  N: [[0, 6, 0, 0, 4, 6, 4, 0]],
  O: [O],
  P: [P_],
  Q: [O, [2.6, 4.6, 4, 6]],
  R: [P_, [2, 3, 4, 6]],
  S: [[4, 1, 3, 0, 1, 0, 0, 1, 0, 2, 1, 3, 3, 3, 4, 4, 4, 5, 3, 6, 1, 6, 0, 5]],
  T: [[0, 0, 4, 0], [2, 0, 2, 6]],
  U: [[0, 0, 0, 5, 1, 6, 3, 6, 4, 5, 4, 0]],
  V: [[0, 0, 2, 6, 4, 0]],
  W: [[0, 0, 1, 6, 2, 3, 3, 6, 4, 0]],
  X: [[0, 0, 4, 6], [4, 0, 0, 6]],
  Y: [[0, 0, 2, 3, 4, 0], [2, 3, 2, 6]],
  Z: [[0, 0, 4, 0, 0, 6, 4, 6]],
  '0': [O, [1.2, 4.8, 2.8, 1.2]],
  '1': [[1, 1, 2, 0, 2, 6], [1, 6, 3, 6]],
  '2': [[0, 1, 1, 0, 3, 0, 4, 1, 4, 2, 0, 6, 4, 6]],
  '3': [[0, 0, 4, 0, 2, 2.5, 3, 2.5, 4, 3.5, 4, 5, 3, 6, 1, 6, 0, 5]],
  '4': [[3, 6, 3, 0, 0, 4, 4, 4]],
  '5': [[4, 0, 0, 0, 0, 2.6, 3, 2.6, 4, 3.6, 4, 5, 3, 6, 0, 6]],
  '6': [[3.5, 0, 1, 0, 0, 1, 0, 5, 1, 6, 3, 6, 4, 5, 4, 3.6, 3, 2.8, 0, 2.8]],
  '7': [[0, 0, 4, 0, 1.5, 6]],
  '8': [[1, 0, 3, 0, 4, 1, 4, 2, 3, 3, 1, 3, 0, 2, 0, 1, 1, 0], [1, 3, 0, 4, 0, 5, 1, 6, 3, 6, 4, 5, 4, 4, 3, 3]],
  '9': [[4, 3.2, 1, 3.2, 0, 2.4, 0, 1, 1, 0, 3, 0, 4, 1, 4, 5, 3, 6, 0.5, 6]],
  '.': [[1.7, 5.5, 2.3, 5.5, 2.3, 6, 1.7, 6, 1.7, 5.5]],
  '!': [[2, 0, 2, 4.2], [2, 5.5, 2, 6]],
  '-': [[0.8, 3, 3.2, 3]],
  ':': [[2, 1.5, 2, 2], [2, 4.5, 2, 5]],
  '/': [[4, 0, 0, 6]],
  '?': [[0, 1, 1, 0, 3, 0, 4, 1, 4, 2, 2, 3.5, 2, 4.2], [2, 5.5, 2, 6]],
  "'": [[2, 0, 1.6, 1.4]],
  '+': [[2, 1.5, 2, 4.5], [0.5, 3, 3.5, 3]],
  '%': [[0, 6, 4, 0], [0.4, 0.4, 1.2, 0.4], [2.8, 5.6, 3.6, 5.6]],
  '#': [[1.3, 0, 0.7, 6], [3.3, 0, 2.7, 6], [0, 2, 4, 2], [0, 4, 4, 4]],
  '&': [[4, 6, 1, 2, 1, 1, 2, 0, 3, 1, 3, 2, 0, 4, 0, 5, 1, 6, 2.5, 6, 4, 4]],
  '(': [[2.6, 0, 1.6, 1.5, 1.6, 4.5, 2.6, 6]],
  ')': [[1.4, 0, 2.4, 1.5, 2.4, 4.5, 1.4, 6]],
};

export const GLYPH_W = 4;
export const GLYPH_ADV = 5.4;
const SLANT = 0.2;

export interface StrokeTextOpts {
  /** Cap height in px. */
  size: number;
  color: string;
  /** 'neon' tube or 'solid' heavy letters. */
  style?: 'neon' | 'solid';
  align?: 'left' | 'center' | 'right';
  /** Extra tracking in glyph units. */
  tracking?: number;
  /** Line thickness multiplier. */
  weight?: number;
  alpha?: number;
  /** Flicker / glow amount 0..1. */
  glow?: number;
  /** Per-letter transform: index -> [dx, dy, scale, alpha]. */
  letter?: (i: number, n: number) => [number, number, number, number];
  italic?: boolean;
  /** Core color for neon (defaults to near-white tint). */
  core?: string;
  outline?: string;
}

export function strokeTextWidth(text: string, size: number, tracking = 0): number {
  const u = size / 6;
  const n = text.length;
  if (!n) return 0;
  return ((n - 1) * (GLYPH_ADV + tracking) + GLYPH_W) * u;
}

function glyphPath(ctx: CanvasRenderingContext2D, g: Glyph, x: number, y: number, u: number, italic: boolean): void {
  for (const line of g) {
    for (let i = 0; i < line.length; i += 2) {
      const gy = line[i + 1];
      const px = x + (line[i] + (italic ? (6 - gy) * SLANT : 0)) * u;
      const py = y + gy * u;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
  }
}

/**
 * Direct (uncached) rendering: multi-pass strokes. Used to rasterize glyphs into the atlas.
 * (x, y) is the top of the cap-height box at the left/center/right of the string.
 */
export function drawStrokeTextDirect(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, o: StrokeTextOpts): void {
  const u = o.size / 6;
  const tracking = o.tracking ?? 0;
  const w = strokeTextWidth(text, o.size, tracking);
  let x0 = x;
  if (o.align === 'center' || o.align === undefined) x0 = x - w / 2;
  else if (o.align === 'right') x0 = x - w;
  const italic = o.italic ?? true;
  const weight = o.weight ?? 1;
  const alpha = o.alpha ?? 1;
  const style = o.style ?? 'neon';
  const glow = o.glow ?? 1;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = style === 'solid' ? 'miter' : 'round';
  ctx.miterLimit = 3;
  const up = text.toUpperCase();
  const n = up.length;
  // neon: a real blurred glow (affordable because glyphs are rasterized once into the atlas),
  // a colored tube and a hot white core
  const m = ctx.getTransform();
  const devScale = Math.sqrt(m.a * m.a + m.b * m.b);
  const passes: { w: number; c: string; a: number; add: boolean; blur?: number }[] = style === 'neon'
    ? [
      { w: u * 1.0 * weight, c: o.color, a: 0.85 * glow, add: true, blur: u * 2.2 * devScale },
      { w: u * 1.05 * weight, c: o.color, a: 0.55 * glow, add: true },
      { w: u * 0.5 * weight, c: o.core ?? '#ffffff', a: 0.95, add: false },
    ]
    : [
      { w: u * 2.3 * weight, c: o.outline ?? '#04050c', a: 1, add: false },
      { w: u * 1.3 * weight, c: o.color, a: 1, add: false },
    ];
  for (const p of passes) {
    ctx.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
    ctx.shadowColor = p.blur ? p.c : 'transparent';
    ctx.shadowBlur = p.blur ?? 0;
    ctx.strokeStyle = p.c;
    ctx.lineWidth = p.w;
    for (let i = 0; i < n; i++) {
      const g = G[up[i]];
      if (!g) continue;
      let gx = x0 + i * (GLYPH_ADV + tracking) * u;
      let gy = y;
      let la = alpha * p.a;
      let ls = 1;
      if (o.letter) {
        const [dx, dy, sc, a] = o.letter(i, n);
        gx += dx; gy += dy; ls = sc; la *= a;
      }
      if (la <= 0.003) continue;
      ctx.globalAlpha = Math.min(1, la);
      ctx.beginPath();
      if (ls !== 1) {
        const cx = gx + GLYPH_W * u / 2, cy = gy + 3 * u;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(ls, ls);
        glyphPath(ctx, g, -GLYPH_W * u / 2, -3 * u, u, italic);
        ctx.restore();
      } else glyphPath(ctx, g, gx, gy, u, italic);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Convenience: neon heading with a soft dark backing for legibility. */
export function neonHeading(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, align: 'left' | 'center' | 'right' = 'left', flicker = 1): void {
  drawStrokeText(ctx, text, x, y, { size, color, style: 'neon', align, tracking: 0.6, glow: flicker });
}

export { rgba };

// ---------------------------------------------------------------------------------------------
// Glyph atlas cache: each (style, size, color, ...) gets an atlas canvas; every glyph is
// rasterized once and drawn afterwards with a single drawImage (wide additive strokes are very
// expensive on integrated GPUs).

interface Cell { x: number; y: number; w: number; h: number }
interface Atlas { c: HTMLCanvasElement; g: CanvasRenderingContext2D; x: number; y: number; rowH: number; cells: Map<string, Cell> }

const atlases = new Map<string, Atlas>();
const PR_BUCKETS = [1, 1.5, 2, 3, 4];

function padFor(o: StrokeTextOpts, u: number): number {
  const weight = o.weight ?? 1;
  return (o.style ?? 'neon') === 'neon' ? u * (1.4 + 2.4 * (o.glow ?? 1)) * Math.max(1, weight * 0.8) + 3 : 2.3 * weight * u * 0.5 + 2;
}

function newAtlas(w: number, h: number): Atlas {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return { c, g: c.getContext('2d')!, x: 0, y: 0, rowH: 0, cells: new Map() };
}

function glyphCell(key: string, ch: string, o: StrokeTextOpts, pr: number): { a: Atlas; cell: Cell } | null {
  let a = atlases.get(key);
  if (!a) { a = newAtlas(512, 256); atlases.set(key, a); }
  let cell = a.cells.get(ch);
  if (cell) return { a, cell };
  if (!G[ch]) return null;
  const u = o.size / 6;
  const pad = padFor(o, u);
  const lw = (GLYPH_W + ((o.italic ?? true) ? 6 * SLANT : 0)) * u + pad * 2;
  const lh = 6 * u + pad * 2;
  const w = Math.ceil(lw * pr), h = Math.ceil(lh * pr);
  if (a.x + w + 2 > a.c.width) { a.x = 0; a.y += a.rowH + 2; a.rowH = 0; }
  if (a.y + h + 2 > a.c.height) {
    // grow (double height, then width), copying existing glyphs
    const nw = a.y + h + 2 > a.c.height * 2 && a.c.width < 2048 ? a.c.width * 2 : a.c.width;
    const nh = Math.min(4096, Math.max(a.c.height * 2, a.y + h + 4));
    const b = newAtlas(nw, nh);
    b.g.drawImage(a.c, 0, 0);
    b.x = a.x; b.y = a.y; b.rowH = a.rowH; b.cells = a.cells;
    atlases.set(key, b);
    a = b;
    if (a.x + w + 2 > a.c.width) { a.x = 0; a.y += a.rowH + 2; a.rowH = 0; }
  }
  cell = { x: a.x, y: a.y, w, h };
  a.x += w + 2;
  a.rowH = Math.max(a.rowH, h);
  const g = a.g;
  g.save();
  g.setTransform(pr, 0, 0, pr, cell.x, cell.y);
  drawStrokeTextDirect(g, ch, pad, pad, { ...o, align: 'left', letter: undefined, alpha: 1, tracking: 0 });
  g.restore();
  a.cells.set(ch, cell);
  return { a, cell };
}

/** Draws text with (x, y) at the top of the cap-height box (cached glyph sprites). */
export function drawStrokeText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, o: StrokeTextOpts): void {
  const alpha = o.alpha ?? 1;
  if (alpha <= 0.003 || !text) return;
  const size = Math.max(4, Math.round(o.size));
  const u = size / 6;
  const tracking = o.tracking ?? 0;
  const w = strokeTextWidth(text, size, tracking);
  let x0 = x;
  if (o.align === 'center' || o.align === undefined) x0 = x - w / 2;
  else if (o.align === 'right') x0 = x - w;
  const m = ctx.getTransform();
  const scale = Math.sqrt(m.a * m.a + m.b * m.b);
  let pr = PR_BUCKETS[PR_BUCKETS.length - 1];
  for (const b of PR_BUCKETS) if (b >= scale * 0.98) { pr = b; break; }
  // keep atlas cells reasonably small
  while (pr > 1 && size * pr > 260) pr = PR_BUCKETS[Math.max(0, PR_BUCKETS.indexOf(pr) - 1)];
  const glow = Math.round((o.glow ?? 1) * 10) / 10;
  const opts: StrokeTextOpts = { ...o, size, glow };
  const key = `${o.style ?? 'neon'}|${size}|${o.color}|${o.core ?? ''}|${o.outline ?? ''}|${o.weight ?? 1}|${o.italic ?? true}|${glow}|${pr}`;
  const pad = padFor(opts, u);
  const up = text.toUpperCase();
  const n = up.length;
  const prevA = ctx.globalAlpha;
  for (let i = 0; i < n; i++) {
    const ch = up[i];
    if (ch === ' ') continue;
    const r = glyphCell(key, ch, opts, pr);
    if (!r) continue;
    let gx = x0 + i * (GLYPH_ADV + tracking) * u;
    let gy = y;
    let la = alpha;
    let ls = 1;
    if (o.letter) {
      const [dx, dy, sc, a] = o.letter(i, n);
      gx += dx; gy += dy; ls = sc; la *= a;
    }
    if (la <= 0.003) continue;
    const { a, cell } = r;
    const dw = cell.w / pr, dh = cell.h / pr;
    ctx.globalAlpha = prevA * Math.min(1, la);
    if (ls !== 1) {
      const cx = gx + (GLYPH_W * u) / 2, cy = gy + 3 * u;
      ctx.drawImage(a.c, cell.x, cell.y, cell.w, cell.h, cx + (gx - pad - cx) * ls, cy + (gy - pad - cy) * ls, dw * ls, dh * ls);
    } else {
      ctx.drawImage(a.c, cell.x, cell.y, cell.w, cell.h, gx - pad, gy - pad, dw, dh);
    }
  }
  ctx.globalAlpha = prevA;
}
