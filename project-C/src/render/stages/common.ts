/**
 * Shared stage building blocks: offscreen layer painting + parallax drawing, a perspective
 * floor made of parallax strips, pooled rain/splash/ripple/steam/spark systems (typed arrays,
 * batched paths), pre-rendered neon text and glow sprites, skyline painters, crowd strips and
 * hologram helpers. Static art is painted once in init(); per-frame code only uses drawImage,
 * cached styles and batched paths so it stays cheap and allocation-free.
 */
import { H, W } from '../../core/view';
import { Rng } from '../../sim/rng';
import { rgba } from '../../ui/theme';
import { parallaxZoom, psx, psy, sy, type Camera } from '../camera';

export const hasDOM = typeof document !== 'undefined';
export const TAU = Math.PI * 2;
export const JP_FONT = '"Yu Gothic UI", "Yu Gothic", "Meiryo", "Hiragino Sans", "Noto Sans JP", sans-serif';
export const DISPLAY_FONT = '"Bahnschrift", "DIN Alternate", "Roboto Condensed", "Arial Narrow", "Segoe UI", sans-serif';

export { Rng };

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

export function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  return c.getContext('2d')!;
}

/** Releases the backing store of canvases (helps GPU memory when switching stages). */
export function freeCanvas(c: HTMLCanvasElement | null | undefined): void {
  if (!c) return;
  c.width = 1;
  c.height = 1;
}

// ---------------------------------------------------------------------------------------------
// Parallax layers

/** A pre-rendered parallax layer covering world x [x0, x0+w] and world y [top-h, top]. */
export interface Layer {
  c: HTMLCanvasElement;
  p: number;
  x0: number;
  top: number;
  w: number;
  h: number;
  r: number;
}

/** Paints in world units: x is world x, `Y(wy)` converts world y (up) to canvas y (down). */
export type Painter = (g: CanvasRenderingContext2D, Y: (wy: number) => number, L: Layer) => void;

export function paintLayer(p: number, x0: number, x1: number, bottom: number, top: number, ratio: number, paint: Painter): Layer {
  const w = x1 - x0, h = top - bottom;
  const c = makeCanvas(w * ratio, h * ratio);
  const L: Layer = { c, p, x0, top, w, h, r: ratio };
  const g = ctx2d(c);
  g.setTransform(ratio, 0, 0, ratio, -x0 * ratio, 0);
  paint(g, (wy) => top - wy, L);
  g.setTransform(1, 0, 0, 1, 0, 0);
  return L;
}

/** World x span a layer with depth p must cover for the full camera range (+ margin). */
export function layerSpan(p: number): [number, number] {
  const half = 583 * p + 780;
  return [-half, half];
}

export function drawLayer(ctx: CanvasRenderingContext2D, L: Layer, cam: Camera): void {
  const zp = parallaxZoom(cam, L.p);
  const dx = psx(cam, L.x0, L.p), dy = psy(cam, L.top, L.p);
  const dw = L.w * zp, dh = L.h * zp;
  const vx0 = Math.max(0, -dx), vy0 = Math.max(0, -dy);
  const vx1 = Math.min(dw, W - dx), vy1 = Math.min(dh, H - dy);
  if (vx1 <= vx0 || vy1 <= vy0) return;
  const k = L.r / zp;
  ctx.drawImage(L.c, vx0 * k, vy0 * k, (vx1 - vx0) * k, (vy1 - vy0) * k, dx + vx0, dy + vy0, vx1 - vx0, vy1 - vy0);
}

/** Screen-space helper for animated items living on a parallax layer. */
export function layerX(cam: Camera, wx: number, p: number): number { return psx(cam, wx, p); }
export function layerY(cam: Camera, wy: number, p: number): number { return psy(cam, wy, p); }

// ---------------------------------------------------------------------------------------------
// Perspective floor: a texture drawn as horizontal strips whose parallax factor grows with depth.

export interface Floor {
  c: HTMLCanvasElement;
  x0: number;
  w: number;
  /** Rows above the ground line (toward the back) and below it (toward the camera). */
  back: number;
  front: number;
  r: number;
  k: number;
  strips: number;
}

/** Texture rows: v = 0 is the back edge, v = back is the fighters' ground line. */
export function paintFloor(x0: number, x1: number, back: number, front: number, ratio: number, k: number,
  paint: (g: CanvasRenderingContext2D, F: Floor) => void): Floor {
  const w = x1 - x0;
  const c = makeCanvas(w * ratio, (back + front) * ratio);
  const F: Floor = { c, x0, w, back, front, r: ratio, k, strips: 44 };
  const g = ctx2d(c);
  g.setTransform(ratio, 0, 0, ratio, -x0 * ratio, 0);
  paint(g, F);
  g.setTransform(1, 0, 0, 1, 0, 0);
  return F;
}

export function floorP(F: Floor, v: number): number {
  return 1 + (F.k * (v - F.back)) / F.front;
}

export function drawFloor(ctx: CanvasRenderingContext2D, F: Floor, cam: Camera): void {
  const gy = sy(cam, 0);
  const total = F.back + F.front;
  const n = F.strips;
  for (let i = 0; i < n; i++) {
    const v0 = (total * i) / n, v1 = (total * (i + 1)) / n;
    const y0 = gy + (v0 - F.back) * cam.zoom;
    const y1 = gy + (v1 - F.back) * cam.zoom;
    if (y1 < 0 || y0 > H) continue;
    const p = floorP(F, (v0 + v1) * 0.5);
    const zp = parallaxZoom(cam, p);
    const dx = psx(cam, F.x0, p), dw = F.w * zp;
    const vx0 = Math.max(0, -dx), vx1 = Math.min(dw, W - dx);
    if (vx1 <= vx0) continue;
    const k = F.r / zp;
    ctx.drawImage(F.c, vx0 * k, v0 * F.r, (vx1 - vx0) * k, (v1 - v0) * F.r, dx + vx0, y0, vx1 - vx0, y1 - y0 + 0.8);
  }
}

/** Screen position of a floor texture point (world x, row v). */
export function floorToScreen(F: Floor, cam: Camera, x: number, v: number, out: { x: number; y: number }): void {
  const p = floorP(F, v);
  out.x = psx(cam, x, p);
  out.y = sy(cam, 0) + (v - F.back) * cam.zoom;
}

// ---------------------------------------------------------------------------------------------
// Sprites

/** Soft radial glow sprite. */
export function glowSprite(color: string, size = 128, falloff = 1): HTMLCanvasElement {
  const c = makeCanvas(size, size);
  const g = ctx2d(c);
  const r = size / 2;
  const gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, rgba(color, 0.9));
  gr.addColorStop(0.25 * falloff, rgba(color, 0.45));
  gr.addColorStop(0.6, rgba(color, 0.12));
  gr.addColorStop(1, rgba(color, 0));
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  return c;
}

/** Vertical fade strip (used for fog bands and floor reflections). */
export function fadeSprite(color: string, a0: number, a1: number, h = 256, soften = true): HTMLCanvasElement {
  const w = soften ? 64 : 4;
  const c = makeCanvas(w, h);
  const g = ctx2d(c);
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, rgba(color, a0));
  gr.addColorStop(1, rgba(color, a1));
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
  if (soften) {
    // soften horizontally so reflection streaks have no hard edges
    g.globalCompositeOperation = 'destination-in';
    const hz = g.createLinearGradient(0, 0, w, 0);
    hz.addColorStop(0, 'rgba(0,0,0,0)');
    hz.addColorStop(0.5, 'rgba(0,0,0,1)');
    hz.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = hz;
    g.fillRect(0, 0, w, h);
  }
  return c;
}

/** Neon tube text pre-rendered with layered glow. Returns canvas + metrics (canvas px at ratio). */
export function neonText(text: string, size: number, color: string, opts: {
  font?: string; weight?: string; ratio?: number; vertical?: boolean; glow?: number; core?: string; spacing?: number; stroke?: boolean;
} = {}): HTMLCanvasElement {
  const ratio = opts.ratio ?? 1.25;
  const font = `${opts.weight ?? '700'} ${size}px ${opts.font ?? JP_FONT}`;
  const glow = opts.glow ?? size * 0.45;
  const pad = glow * 1.6 + 6;
  const meas = makeCanvas(4, 4);
  const mg = ctx2d(meas);
  mg.font = font;
  const chars = Array.from(text);
  const spacing = opts.spacing ?? 0;
  let w: number, h: number;
  if (opts.vertical) {
    w = size * 1.15;
    h = chars.length * size * 1.08 + spacing * (chars.length - 1);
  } else {
    w = mg.measureText(text).width + spacing * Math.max(0, chars.length - 1);
    h = size * 1.2;
  }
  const c = makeCanvas((w + pad * 2) * ratio, (h + pad * 2) * ratio);
  const g = ctx2d(c);
  g.scale(ratio, ratio);
  g.font = font;
  g.textBaseline = 'middle';
  g.textAlign = opts.vertical ? 'center' : 'left';
  const drawAll = (fn: (ch: string, x: number, y: number) => void) => {
    if (opts.vertical) {
      chars.forEach((ch, i) => fn(ch, pad + w / 2, pad + size * 0.54 + i * (size * 1.08 + spacing)));
    } else if (spacing) {
      let x = pad;
      for (const ch of chars) { fn(ch, x, pad + h / 2); x += g.measureText(ch).width + spacing; }
    } else fn(text, pad, pad + h / 2);
  };
  // wide outer glow
  g.shadowColor = color;
  g.fillStyle = rgba(color, 0.55);
  g.shadowBlur = glow * 1.4;
  drawAll((ch, x, y) => g.fillText(ch, x, y));
  g.shadowBlur = glow * 0.6;
  g.fillStyle = color;
  drawAll((ch, x, y) => g.fillText(ch, x, y));
  // hot core
  g.shadowBlur = glow * 0.25;
  g.fillStyle = opts.core ?? mixWhite(color, 0.65);
  drawAll((ch, x, y) => g.fillText(ch, x, y));
  if (opts.stroke) {
    g.shadowBlur = 0;
    g.lineWidth = Math.max(1, size * 0.04);
    g.strokeStyle = rgba('#ffffff', 0.5);
    drawAll((ch, x, y) => g.strokeText(ch, x, y));
  }
  return c;
}

/** Simple neon shape: strokes a path builder with glow passes. */
export function neonStroke(g: CanvasRenderingContext2D, build: () => void, color: string, width: number, glow = 14): void {
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.shadowColor = color;
  g.shadowBlur = glow * 1.6;
  g.strokeStyle = rgba(color, 0.5);
  g.lineWidth = width * 2.4;
  build(); g.stroke();
  g.shadowBlur = glow * 0.7;
  g.strokeStyle = color;
  g.lineWidth = width;
  build(); g.stroke();
  g.shadowBlur = 0;
  g.strokeStyle = mixWhite(color, 0.7);
  g.lineWidth = Math.max(0.6, width * 0.35);
  build(); g.stroke();
  g.restore();
}

export function mixWhite(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) + (255 - ((n >> 16) & 255)) * t);
  const gg = Math.round(((n >> 8) & 255) + (255 - ((n >> 8) & 255)) * t);
  const b = Math.round((n & 255) + (255 - (n & 255)) * t);
  return '#' + ((1 << 24) | (r << 16) | (gg << 8) | b).toString(16).slice(1);
}

export function darken(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * (1 - t));
  const gg = Math.round(((n >> 8) & 255) * (1 - t));
  const b = Math.round((n & 255) * (1 - t));
  return '#' + ((1 << 24) | (r << 16) | (gg << 8) | b).toString(16).slice(1);
}

/** Vertical gradient fill helper for painters. */
export function vgrad(g: CanvasRenderingContext2D, y0: number, y1: number, stops: [number, string][]): CanvasGradient {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  return gr;
}

/** Soft haze band painted into a layer (world coords). */
export function hazeBand(g: CanvasRenderingContext2D, x0: number, x1: number, yTop: number, yBot: number, color: string, a: number): void {
  g.fillStyle = vgrad(g, yTop, yBot, [[0, rgba(color, 0)], [0.6, rgba(color, a * 0.7)], [1, rgba(color, a)]]);
  g.fillRect(x0, yTop, x1 - x0, yBot - yTop);
}

// ---------------------------------------------------------------------------------------------
// Skyline painter

export interface SkylineOpts {
  x0: number;
  x1: number;
  /** World y of the building bases. */
  base: number;
  minH: number;
  maxH: number;
  minW: number;
  maxW: number;
  gap: number;
  body: string;
  body2: string;
  edge?: string;
  windows: string[];
  windowDensity: number;
  win: number;
  rows?: number;
  antennaChance?: number;
  /** Return buildings for later decoration. */
  out?: { x: number; w: number; h: number }[];
  litFraction?: number;
}

export function paintSkyline(g: CanvasRenderingContext2D, Y: (wy: number) => number, rng: Rng, o: SkylineOpts): void {
  let x = o.x0 - rng.range(0, o.maxW);
  while (x < o.x1) {
    const w = rng.range(o.minW, o.maxW);
    const h = rng.range(o.minH, o.maxH) * (rng.chance(0.15) ? 1.35 : 1);
    const top = o.base + h;
    // body with subtle vertical gradient
    g.fillStyle = vgrad(g, Y(top), Y(o.base), [[0, o.body2], [1, o.body]]);
    const shape = rng.int(4);
    g.beginPath();
    if (shape === 0) {
      g.rect(x, Y(top), w, h);
    } else if (shape === 1) { // stepped top
      const s = w * rng.range(0.15, 0.3);
      g.moveTo(x, Y(o.base)); g.lineTo(x, Y(top - h * 0.08)); g.lineTo(x + s, Y(top - h * 0.08)); g.lineTo(x + s, Y(top));
      g.lineTo(x + w - s, Y(top)); g.lineTo(x + w - s, Y(top - h * 0.08)); g.lineTo(x + w, Y(top - h * 0.08)); g.lineTo(x + w, Y(o.base));
    } else if (shape === 2) { // slanted roof
      g.moveTo(x, Y(o.base)); g.lineTo(x, Y(top - w * 0.3)); g.lineTo(x + w, Y(top)); g.lineTo(x + w, Y(o.base));
    } else { // spire
      g.rect(x, Y(top), w, h);
      g.rect(x + w * 0.4, Y(top + h * 0.12), w * 0.2, h * 0.12);
    }
    g.fill();
    if (o.edge) {
      g.fillStyle = o.edge;
      g.fillRect(x + w - Math.max(1, w * 0.04), Y(top), Math.max(1, w * 0.04), h);
    }
    // windows
    const ww = o.win, wh = o.win * 1.3;
    const cols = Math.max(1, Math.floor((w - ww) / (ww * 2.1)));
    const rows = Math.floor((h - wh * 2) / (wh * 1.9));
    const lit = o.litFraction ?? 0.5;
    const bandLit = rng.chance(0.3);
    for (let r = 0; r < rows; r++) {
      const rowLit = bandLit && rng.chance(0.25);
      for (let cI = 0; cI < cols; cI++) {
        if (rng.next() > o.windowDensity) continue;
        if (!rowLit && rng.next() > lit) continue;
        const wx = x + ww + cI * ww * 2.1 + (w - ww - cols * ww * 2.1) / 2;
        const wy = o.base + wh * 1.5 + r * wh * 1.9;
        g.globalAlpha = rng.range(0.35, 1);
        g.fillStyle = rng.pick(o.windows);
        g.fillRect(wx, Y(wy + wh), ww, wh);
      }
    }
    g.globalAlpha = 1;
    if (o.antennaChance && rng.chance(o.antennaChance)) {
      g.fillStyle = o.body2;
      const ax = x + w * rng.range(0.3, 0.7);
      g.fillRect(ax, Y(top + h * 0.25), Math.max(1, w * 0.03), h * 0.25);
    }
    o.out?.push({ x, w, h });
    x += w + rng.range(0, o.gap);
  }
}

// ---------------------------------------------------------------------------------------------
// Rain

export interface RainLayerSpec {
  count: number;
  /** Parallax factor for camera drift. */
  p: number;
  speed: number;
  len: number;
  width: number;
  color: string;
  alpha: number;
}

interface RainLayer {
  n: number;
  x: Float32Array;
  y: Float32Array;
  v: Float32Array;
  spec: RainLayerSpec;
  style: string;
}

/** Screen-space rain with parallax drift, splashes and ripples. */
export class Rain {
  layers: RainLayer[] = [];
  wind: number;
  private rng: Rng;
  private lastCamX = 0;
  private init = false;
  // splashes
  private sx = new Float32Array(96);
  private sy = new Float32Array(96);
  private sa = new Float32Array(96);
  private ss = new Float32Array(96);
  private sHead = 0;
  splashRate: number;
  /** Screen y range where splashes may appear (floor band). */
  splashTop = 560;
  gust = 0;

  constructor(specs: RainLayerSpec[], wind: number, seed: number, splashRate: number) {
    this.rng = new Rng(seed);
    this.wind = wind;
    this.splashRate = splashRate;
    for (const spec of specs) {
      const n = spec.count;
      const L: RainLayer = { n, x: new Float32Array(n), y: new Float32Array(n), v: new Float32Array(n), spec, style: rgba(spec.color, spec.alpha) };
      for (let i = 0; i < n; i++) {
        L.x[i] = this.rng.range(-80, W + 80);
        L.y[i] = this.rng.range(-120, H);
        L.v[i] = spec.speed * this.rng.range(0.85, 1.15);
      }
      this.layers.push(L);
    }
    this.sa.fill(1);
  }

  update(cam: Camera, floorTop: number): void {
    if (!this.init) { this.lastCamX = cam.x; this.init = true; }
    const dCam = cam.x - this.lastCamX;
    this.lastCamX = cam.x;
    this.splashTop = floorTop;
    const wind = this.wind + this.gust;
    for (const L of this.layers) {
      const shift = -dCam * parallaxZoom(cam, L.spec.p) * L.spec.p;
      const n = L.n;
      for (let i = 0; i < n; i++) {
        const v = L.v[i];
        L.y[i] += v;
        L.x[i] += v * wind + shift;
        if (L.y[i] > H + 20) {
          L.y[i] = -L.spec.len - this.rng.next() * 120;
          L.x[i] = this.rng.range(-120, W + 120);
        }
        if (L.x[i] < -140) L.x[i] += W + 260;
        else if (L.x[i] > W + 140) L.x[i] -= W + 260;
      }
    }
    // splashes
    const spawn = floorTop < H - 6 ? this.splashRate : 0;
    let k = Math.floor(spawn) + (this.rng.next() < spawn % 1 ? 1 : 0);
    while (k-- > 0) {
      const i = this.sHead;
      this.sHead = (this.sHead + 1) % this.sx.length;
      const y = this.rng.range(floorTop, H + 10);
      this.sx[i] = this.rng.range(0, W);
      this.sy[i] = y;
      this.sa[i] = 0;
      this.ss[i] = Math.max(0.4, Math.min(1.4, 0.5 + ((y - floorTop) / Math.max(1, H - floorTop)) * 0.9));
    }
    for (let i = 0; i < this.sa.length; i++) if (this.sa[i] < 1) this.sa[i] += 0.07;
  }

  /** Draws rain layers [from, to). */
  draw(ctx: CanvasRenderingContext2D, from: number, to: number): void {
    const wind = this.wind + this.gust;
    ctx.lineCap = 'butt';
    for (let li = from; li < Math.min(to, this.layers.length); li++) {
      const L = this.layers[li];
      const len = L.spec.len;
      ctx.beginPath();
      for (let i = 0; i < L.n; i++) {
        const x = L.x[i], y = L.y[i];
        ctx.moveTo(x, y);
        ctx.lineTo(x + len * wind, y + len);
      }
      ctx.strokeStyle = L.style;
      ctx.lineWidth = L.spec.width;
      ctx.stroke();
    }
  }

  drawSplashes(ctx: CanvasRenderingContext2D, color: string): void {
    // two alpha buckets keep it batched
    for (let b = 0; b < 2; b++) {
      ctx.beginPath();
      let any = false;
      for (let i = 0; i < this.sa.length; i++) {
        const a = this.sa[i];
        if (a >= 1) continue;
        if ((a < 0.45 ? 0 : 1) !== b) continue;
        const s = this.ss[i];
        const r = (3 + a * 9) * s;
        const x = this.sx[i], y = this.sy[i];
        ctx.moveTo(x + r, y);
        ctx.ellipse(x, y, r, r * 0.28, 0, 0, TAU);
        if (a < 0.4) {
          const up = (1 - a * 2.2) * 6 * s;
          ctx.moveTo(x - 2 * s, y - 1);
          ctx.lineTo(x - 4 * s, y - up);
          ctx.moveTo(x + 2 * s, y - 1);
          ctx.lineTo(x + 4 * s, y - up);
        }
        any = true;
      }
      if (!any) continue;
      ctx.strokeStyle = b === 0 ? rgbaCached(color, 0.55) : rgbaCached(color, 0.22);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

const styleCache = new Map<string, string>();
/** rgba() with a dedicated cache key (hot paths). */
export function rgbaCached(hex: string, a: number): string {
  const k = hex + a;
  let s = styleCache.get(k);
  if (!s) { s = rgba(hex, a); styleCache.set(k, s); }
  return s;
}

// ---------------------------------------------------------------------------------------------
// Puff particles (steam / smoke), pooled

export class Puffs {
  private x: Float32Array;
  private y: Float32Array;
  private vx: Float32Array;
  private vy: Float32Array;
  private age: Float32Array;
  private life: Float32Array;
  private size: Float32Array;
  private head = 0;
  private rng: Rng;
  constructor(n: number, seed: number, private sprite: HTMLCanvasElement) {
    this.x = new Float32Array(n); this.y = new Float32Array(n);
    this.vx = new Float32Array(n); this.vy = new Float32Array(n);
    this.age = new Float32Array(n).fill(1); this.life = new Float32Array(n).fill(1);
    this.size = new Float32Array(n);
    this.rng = new Rng(seed);
  }
  /** Spawns a puff at world coords (layer-local), moving up. */
  emit(x: number, y: number, size: number, vx = 0, vy = 0.6): void {
    const i = this.head;
    this.head = (this.head + 1) % this.x.length;
    this.x[i] = x + this.rng.range(-6, 6);
    this.y[i] = y;
    this.vx[i] = vx + this.rng.range(-0.15, 0.15);
    this.vy[i] = vy * this.rng.range(0.7, 1.3);
    this.age[i] = 0;
    this.life[i] = this.rng.range(70, 120);
    this.size[i] = size * this.rng.range(0.8, 1.2);
  }
  update(wind: number): void {
    for (let i = 0; i < this.x.length; i++) {
      if (this.age[i] >= this.life[i]) continue;
      this.age[i]++;
      this.x[i] += this.vx[i] + wind;
      this.y[i] += this.vy[i];
    }
  }
  /** Draw on a layer with depth p. */
  draw(ctx: CanvasRenderingContext2D, cam: Camera, p: number, alpha: number): void {
    const zp = parallaxZoom(cam, p);
    for (let i = 0; i < this.x.length; i++) {
      const a = this.age[i], l = this.life[i];
      if (a >= l) continue;
      const t = a / l;
      const s = this.size[i] * (0.5 + t * 1.4) * zp;
      const X = psx(cam, this.x[i], p), Yv = psy(cam, this.y[i], p);
      if (X < -s || X > W + s || Yv < -s || Yv > H + s) continue;
      ctx.globalAlpha = alpha * Math.sin(t * Math.PI) * 0.9;
      ctx.drawImage(this.sprite, X - s / 2, Yv - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------------------------------------
// Sparks (screen-space, pooled)

export class Sparks {
  private x: Float32Array;
  private y: Float32Array;
  private vx: Float32Array;
  private vy: Float32Array;
  private age: Float32Array;
  private head = 0;
  private rng: Rng;
  constructor(n: number, seed: number) {
    this.x = new Float32Array(n); this.y = new Float32Array(n);
    this.vx = new Float32Array(n); this.vy = new Float32Array(n);
    this.age = new Float32Array(n).fill(99);
    this.rng = new Rng(seed);
  }
  /** World-space burst on layer p. */
  burst(x: number, y: number, n: number, power = 1): void {
    for (let k = 0; k < n; k++) {
      const i = this.head;
      this.head = (this.head + 1) % this.x.length;
      this.x[i] = x; this.y[i] = y;
      const a = this.rng.range(Math.PI * 0.05, Math.PI * 0.95);
      const v = this.rng.range(1.5, 5) * power;
      this.vx[i] = Math.cos(a) * v * (this.rng.chance(0.5) ? 1 : -1);
      this.vy[i] = -Math.sin(a) * v * 0.6 + this.rng.range(0, 1.5);
      this.age[i] = 0;
    }
  }
  update(): void {
    for (let i = 0; i < this.x.length; i++) {
      if (this.age[i] > 40) continue;
      this.age[i]++;
      this.vy[i] -= 0.22;
      this.x[i] += this.vx[i];
      this.y[i] += this.vy[i];
    }
  }
  draw(ctx: CanvasRenderingContext2D, cam: Camera, p: number, color: string): void {
    ctx.beginPath();
    let any = false;
    for (let i = 0; i < this.x.length; i++) {
      if (this.age[i] > 40) continue;
      const X = psx(cam, this.x[i], p), Yv = psy(cam, this.y[i], p);
      ctx.moveTo(X, Yv);
      ctx.lineTo(X - this.vx[i] * 2.2, Yv + this.vy[i] * 2.2);
      any = true;
    }
    if (!any) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------------------------
// Ripples on puddles (floor texture coords)

export class Ripples {
  private x: Float32Array;
  private v: Float32Array;
  private a: Float32Array;
  private s: Float32Array;
  private head = 0;
  private rng: Rng;
  private tmp = { x: 0, y: 0 };
  constructor(n: number, seed: number, private puddles: { x: number; v: number; rx: number; rv: number }[]) {
    this.x = new Float32Array(n); this.v = new Float32Array(n);
    this.a = new Float32Array(n).fill(1); this.s = new Float32Array(n);
    this.rng = new Rng(seed);
  }
  update(rate: number): void {
    if (this.puddles.length) {
      let k = Math.floor(rate) + (this.rng.next() < rate % 1 ? 1 : 0);
      while (k-- > 0) {
        const p = this.puddles[this.rng.int(this.puddles.length)];
        const i = this.head;
        this.head = (this.head + 1) % this.x.length;
        const ang = this.rng.next() * TAU, rr = Math.sqrt(this.rng.next()) * 0.8;
        this.x[i] = p.x + Math.cos(ang) * p.rx * rr;
        this.v[i] = p.v + Math.sin(ang) * p.rv * rr;
        this.a[i] = 0;
        this.s[i] = this.rng.range(0.7, 1.3);
      }
    }
    for (let i = 0; i < this.a.length; i++) if (this.a[i] < 1) this.a[i] += 0.025;
  }
  draw(ctx: CanvasRenderingContext2D, cam: Camera, F: Floor, color: string): void {
    for (let b = 0; b < 2; b++) {
      ctx.beginPath();
      let any = false;
      for (let i = 0; i < this.a.length; i++) {
        const a = this.a[i];
        if (a >= 1 || (a < 0.5 ? 0 : 1) !== b) continue;
        floorToScreen(F, cam, this.x[i], this.v[i], this.tmp);
        const depth = 0.55 + (this.v[i] / (F.back + F.front)) * 0.8;
        const r = Math.max(0.5, (2 + a * 16) * this.s[i] * depth * cam.zoom);
        ctx.moveTo(this.tmp.x + r, this.tmp.y);
        ctx.ellipse(this.tmp.x, this.tmp.y, r, r * 0.26, 0, 0, TAU);
        any = true;
      }
      if (any) {
        ctx.strokeStyle = rgbaCached(color, b === 0 ? 0.42 : 0.16);
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Crowd silhouettes

export interface CrowdRowSpec {
  p: number;
  /** World y of the bottom of the sprites (hidden below the next row / railing). */
  base: number;
  x0: number;
  x1: number;
  spacing: number;
  scale: number;
  body: string;
  rim: string;
  /** Chance of an umbrella (rain stages). */
  umbrella?: number;
  phone?: number;
  umbrellaColors?: string[];
  /** Skip members whose x is in these world-x ranges (gaps for props). */
  gaps?: [number, number][];
}

interface CrowdRow {
  spec: CrowdRowSpec;
  n: number;
  x: Float32Array;
  ph: Float32Array;
  fr: Float32Array;
  amp: Float32Array;
  variant: Uint8Array;
  eager: Float32Array;
  yo: Float32Array;
  sc: Float32Array;
  calm: HTMLCanvasElement[];
  cheer: HTMLCanvasElement[];
  w: number;
  h: number;
  ratio: number;
}

const PERSON_W = 64;
const PERSON_H = 150;

/** Paints one person silhouette (head, shoulders, torso, optional raised arms / umbrella / phone). */
function paintPerson(g: CanvasRenderingContext2D, rng: Rng, body: string, rim: string, arms: number,
  opts: { umbrella?: string | null; phone?: boolean; hood?: boolean; cap?: boolean; build: number }): void {
  // Two passes: the silhouette in the rim color shifted up-left, then the body color on top,
  // which leaves a crisp neon edge that separates heads and shoulders at small sizes.
  const seed = rng.rng;
  g.save();
  g.translate(-1.4, -1.3);
  paintPersonShape(g, new Rng(seed), rgba(rim, 0.62), arms, opts);
  g.restore();
  paintPersonShape(g, new Rng(seed), body, arms, opts);
  paintPersonDetails(g, body, rim, opts);
}

function paintPersonShape(g: CanvasRenderingContext2D, rng: Rng, body: string, arms: number,
  opts: { umbrella?: string | null; phone?: boolean; hood?: boolean; cap?: boolean; build: number }): void {
  const cx = PERSON_W / 2;
  const sh = 0.85 + opts.build * 0.3;
  const headR = 9.5 * (0.95 + rng.next() * 0.12);
  const neckY = 46;
  const shoulderW = 23 * sh;
  g.fillStyle = body;
  // arms raised behind the body
  const drawArm = (side: number, up: boolean) => {
    g.beginPath();
    g.lineCap = 'round';
    g.lineWidth = 8 * sh;
    g.strokeStyle = body;
    const sxp = cx + side * (shoulderW - 4);
    g.moveTo(sxp, neckY + 8);
    if (up) {
      g.lineTo(sxp + side * 7, neckY - 16);
      g.lineTo(sxp + side * 3 + rng.range(-4, 4), neckY - 38);
    } else {
      g.lineTo(sxp + side * 4, neckY + 40);
    }
    g.stroke();
    if (up) { g.beginPath(); g.arc(sxp + side * 3, neckY - 40, 5, 0, TAU); g.fill(); }
  };
  if (arms === 1) drawArm(1, true);
  if (arms === 2) { drawArm(1, true); drawArm(-1, true); }
  // torso with squared shoulders and a visible neck so heads read at small sizes
  g.beginPath();
  g.moveTo(cx - shoulderW, neckY + 16);
  g.quadraticCurveTo(cx - shoulderW, neckY + 5, cx - shoulderW + 8, neckY + 4);
  g.lineTo(cx - 5, neckY + 1);
  g.lineTo(cx + 5, neckY + 1);
  g.lineTo(cx + shoulderW - 8, neckY + 4);
  g.quadraticCurveTo(cx + shoulderW, neckY + 5, cx + shoulderW, neckY + 16);
  g.lineTo(cx + shoulderW * 0.86, PERSON_H);
  g.lineTo(cx - shoulderW * 0.86, PERSON_H);
  g.closePath();
  g.fill();
  // neck
  g.fillRect(cx - 4, neckY - 8, 8, 10);
  // head
  g.beginPath();
  g.ellipse(cx, neckY - 6 - headR * 0.85, headR * 0.82, headR, 0, 0, TAU);
  g.fill();
  if (opts.hood) {
    g.beginPath();
    g.ellipse(cx, neckY - 6 - headR * 0.85, headR * 1.12, headR * 1.18, 0, Math.PI * 0.95, Math.PI * 2.05);
    g.lineTo(cx + shoulderW * 0.55, neckY + 5);
    g.lineTo(cx - shoulderW * 0.55, neckY + 5);
    g.fill();
  }
  if (opts.cap) {
    g.fillRect(cx - headR * 0.9, neckY - 6 - headR * 1.95, headR * 1.8, headR * 0.6);
    g.fillRect(cx, neckY - 6 - headR * 1.45, headR * 1.3, headR * 0.25);
  }
}

function paintPersonDetails(g: CanvasRenderingContext2D, body: string, rim: string,
  opts: { umbrella?: string | null; phone?: boolean; hood?: boolean; cap?: boolean; build: number }): void {
  const cx = PERSON_W / 2;
  const neckY = 46;
  const headR = 10;
  const shoulderW = 21 * (0.85 + opts.build * 0.3);
  // soft rim light on the top-left contour
  g.save();
  g.globalCompositeOperation = 'source-atop';
  const rg = g.createLinearGradient(cx - shoulderW, 0, cx + shoulderW * 0.4, 0);
  rg.addColorStop(0, rgba(rim, 0.16));
  rg.addColorStop(0.35, rgba(rim, 0.03));
  rg.addColorStop(1, rgba(rim, 0));
  g.fillStyle = rg;
  g.fillRect(0, 0, PERSON_W, neckY + 30);
  // fade the lower body into darkness
  g.fillStyle = vgrad(g, neckY + 20, PERSON_H, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.55)']]);
  g.fillRect(0, neckY + 20, PERSON_W, PERSON_H);
  g.restore();
  if (opts.phone) {
    g.fillStyle = '#d8f4ff';
    g.shadowColor = '#9fe8ff';
    g.shadowBlur = 8;
    g.fillRect(cx + 9, neckY - 14, 5, 8);
    g.shadowBlur = 0;
  }
  if (opts.umbrella) {
    const uy = neckY - headR * 2 - 8;
    g.save();
    g.globalAlpha = 0.55;
    g.fillStyle = rgba(opts.umbrella, 0.25);
    g.beginPath();
    g.ellipse(cx, uy + 6, 30, 16, 0, Math.PI, 0);
    g.fill();
    g.globalAlpha = 1;
    g.strokeStyle = opts.umbrella;
    g.shadowColor = opts.umbrella;
    g.shadowBlur = 6;
    g.lineWidth = 1.6;
    g.beginPath();
    g.ellipse(cx, uy + 6, 30, 16, 0, Math.PI, 0);
    g.stroke();
    g.shadowBlur = 0;
    g.strokeStyle = body;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(cx, uy - 10);
    g.lineTo(cx + 2, neckY + 10);
    g.stroke();
    g.restore();
  }
}

export class Crowd {
  rows: CrowdRow[] = [];
  excitement = 0;
  private t = 0;
  private rng: Rng;

  constructor(specs: CrowdRowSpec[], seed: number, ratio: number) {
    this.rng = new Rng(seed);
    for (const spec of specs) {
      const r = ratio;
      const calm: HTMLCanvasElement[] = [];
      const cheer: HTMLCanvasElement[] = [];
      const VARIANTS = 6;
      for (let v = 0; v < VARIANTS; v++) {
        const seedV = this.rng.int(1e9);
        const opts = {
          umbrella: spec.umbrella && v % 3 === 0 ? (spec.umbrellaColors ?? ['#7af3ff'])[v % (spec.umbrellaColors?.length ?? 1)] : null,
          phone: !!spec.phone && v === 4,
          hood: v === 1 || v === 5,
          cap: v === 2,
          build: (v * 0.37) % 1,
        };
        for (const arr of [calm, cheer]) {
          const c = makeCanvas(PERSON_W * r, (PERSON_H + 50) * r);
          const g = ctx2d(c);
          g.scale(r, r);
          g.translate(0, 50);
          const prng = new Rng(seedV);
          const arms = arr === calm ? (v === 3 ? 1 : 0) : (opts.umbrella ? 1 : 1 + (v % 2));
          paintPerson(g, prng, spec.body, spec.rim, arms, opts);
          arr.push(c);
        }
      }
      const xs: number[] = [];
      for (let x = spec.x0; x < spec.x1; x += spec.spacing * this.rng.range(0.7, 1.25)) {
        if (spec.gaps && spec.gaps.some(([a, b]) => x > a && x < b)) continue;
        xs.push(x);
      }
      const n = xs.length;
      const row: CrowdRow = {
        spec, n, x: new Float32Array(xs), ph: new Float32Array(n), fr: new Float32Array(n), amp: new Float32Array(n),
        variant: new Uint8Array(n), eager: new Float32Array(n), yo: new Float32Array(n), sc: new Float32Array(n), calm, cheer, w: PERSON_W * spec.scale, h: (PERSON_H + 50) * spec.scale, ratio: r,
      };
      for (let i = 0; i < n; i++) {
        row.ph[i] = this.rng.next() * TAU;
        row.fr[i] = this.rng.range(2.2, 4.2);
        row.amp[i] = this.rng.range(1, 3.5);
        row.variant[i] = this.rng.int(VARIANTS);
        row.eager[i] = this.rng.next();
        row.x[i] += this.rng.range(-4, 4);
        row.yo[i] = this.rng.range(-9, 7);
        row.sc[i] = this.rng.range(0.9, 1.1);
      }
      this.rows.push(row);
    }
  }

  cheer(amount: number): void {
    this.excitement = Math.min(1.4, this.excitement + amount);
  }

  update(dt: number): void {
    this.t += dt;
    this.excitement = Math.max(0, this.excitement - dt * 0.35);
  }

  drawRow(ctx: CanvasRenderingContext2D, cam: Camera, ri: number): void {
    const row = this.rows[ri];
    const p = row.spec.p;
    const zp = parallaxZoom(cam, p);
    const w = row.w * zp, h = row.h * zp;
    const ex = this.excitement;
    const t = this.t;
    const baseY = psy(cam, row.spec.base, p) - h;
    for (let i = 0; i < row.n; i++) {
      const s = row.sc[i];
      const ws = w * s, hs = h * s;
      const X = psx(cam, row.x[i], p) - ws / 2;
      if (X < -ws || X > W) continue;
      const hyped = row.eager[i] < ex * 0.85;
      const bounce = hyped ? Math.abs(Math.sin(t * row.fr[i] * 1.6 + row.ph[i])) * (5 + ex * 9) : 0;
      const bob = Math.sin(t * row.fr[i] + row.ph[i]) * row.amp[i];
      const img = hyped ? row.cheer[row.variant[i]] : row.calm[row.variant[i]];
      ctx.drawImage(img, X, baseY + h - hs + (bob - bounce + row.yo[i]) * zp, ws, hs);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Holograms

/** Bakes scanlines + edge glow into a hologram sprite drawn by `paint` (local px). */
export function hologram(w: number, h: number, ratio: number, color: string, paint: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const pad = 24;
  const c = makeCanvas((w + pad * 2) * ratio, (h + pad * 2) * ratio);
  const g = ctx2d(c);
  g.scale(ratio, ratio);
  g.translate(pad, pad);
  paint(g);
  // scanlines: knock out every other line partially
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = 'rgba(0,0,0,0.38)';
  for (let y = -pad; y < h + pad; y += 3) g.fillRect(-pad, y, w + pad * 2, 1.2);
  g.globalCompositeOperation = 'source-over';
  void color;
  return c;
}

/** Simple flicker curve: mostly steady with occasional dips. */
export function flicker(t: number, seed: number, rate = 1): number {
  const a = Math.sin(t * 13.7 * rate + seed * 3.1) * Math.sin(t * 7.3 * rate + seed);
  const glitch = Math.sin(t * 1.3 * rate + seed * 11.0);
  if (glitch > 0.985) return 0.25 + 0.5 * Math.abs(a);
  return 0.9 + a * 0.1;
}

/** Full-screen overlay sprite (vertical gradient), drawn stretched. */
export function screenGradient(stops: [number, string][], h = 256): HTMLCanvasElement {
  const c = makeCanvas(4, h);
  const g = ctx2d(c);
  const gr = g.createLinearGradient(0, 0, 0, h);
  for (const [o, col] of stops) gr.addColorStop(o, col);
  g.fillStyle = gr;
  g.fillRect(0, 0, 4, h);
  return c;
}

/** Pre-rendered light cone (for lamps / searchlights), pointing down, apex at top center. */
export function coneSprite(color: string, w: number, h: number, a = 0.35): HTMLCanvasElement {
  const c = makeCanvas(w, h);
  const g = ctx2d(c);
  g.beginPath();
  g.moveTo(w / 2 - 3, 0);
  g.lineTo(w / 2 + 3, 0);
  g.lineTo(w, h);
  g.lineTo(0, h);
  g.closePath();
  g.fillStyle = vgrad(g, 0, h, [[0, rgba(color, a)], [0.5, rgba(color, a * 0.35)], [1, rgba(color, 0)]]);
  g.fill();
  // soften sides
  g.globalCompositeOperation = 'destination-in';
  const hz = g.createLinearGradient(0, 0, w, 0);
  hz.addColorStop(0, 'rgba(0,0,0,0)');
  hz.addColorStop(0.3, 'rgba(0,0,0,1)');
  hz.addColorStop(0.7, 'rgba(0,0,0,1)');
  hz.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = hz;
  g.fillRect(0, 0, w, h);
  return c;
}

/** Draws an image centered at (x, y), rotated and scaled, with optional composite. */
export function drawRotated(ctx: CanvasRenderingContext2D, img: HTMLCanvasElement, x: number, y: number, w: number, h: number,
  rot: number, ax = 0.5, ay = 0.5): void {
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.drawImage(img, -w * ax, -h * ay, w, h);
  ctx.rotate(-rot);
  ctx.translate(-x, -y);
}

/** Stretched full-screen draw of a vertical gradient sprite between screen y0..y1. */
export function drawBand(ctx: CanvasRenderingContext2D, img: HTMLCanvasElement, y0: number, y1: number, alpha = 1): void {
  if (y1 <= 0 || y0 >= H) return;
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, 0, 0, img.width, img.height, -4, y0, W + 8, y1 - y0);
  ctx.globalAlpha = 1;
}
