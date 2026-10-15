/**
 * UI drawing primitives shared by every screen: text, chamfered neon panels, buttons, bars,
 * input notation icons (arrows, motions, buttons), decorative scanlines and grids.
 */
import { t } from './strings';
import { C, FONT, rgba } from './theme';

export interface TextOpts {
  size?: number;
  weight?: number | string;
  font?: keyof typeof FONT;
  color?: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  tracking?: number;
  alpha?: number;
  shadow?: string;
  italic?: boolean;
  maxWidth?: number;
}

const fontCache = new Map<string, string>();
function fontStr(size: number, weight: number | string, family: keyof typeof FONT, italic: boolean): string {
  const k = `${size}|${weight}|${family}|${italic}`;
  let f = fontCache.get(k);
  if (!f) { f = `${italic ? 'italic ' : ''}${weight} ${size}px ${FONT[family]}`; fontCache.set(k, f); }
  return f;
}

export function setFont(ctx: CanvasRenderingContext2D, o: TextOpts): void {
  ctx.font = fontStr(o.size ?? 16, o.weight ?? 600, o.font ?? 'body', !!o.italic);
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${o.tracking ?? 0}px`;
}

export function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, o: TextOpts = {}): number {
  setFont(ctx, o);
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = o.baseline ?? 'alphabetic';
  const a = o.alpha ?? 1;
  if (a <= 0) return 0;
  ctx.globalAlpha = a;
  if (o.shadow) {
    ctx.fillStyle = o.shadow;
    ctx.fillText(s, x + 2, y + 2, o.maxWidth);
  }
  ctx.fillStyle = o.color ?? C.text;
  ctx.fillText(s, x, y, o.maxWidth);
  ctx.globalAlpha = 1;
  const w = ctx.measureText(s).width;
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '0px';
  return w;
}

export function measure(ctx: CanvasRenderingContext2D, s: string, o: TextOpts = {}): number {
  setFont(ctx, o);
  const w = ctx.measureText(s).width;
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '0px';
  return w;
}

/** Word-wraps text into lines that fit maxWidth. */
export function wrap(ctx: CanvasRenderingContext2D, s: string, maxWidth: number, o: TextOpts = {}): string[] {
  setFont(ctx, o);
  const words = s.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '0px';
  return lines;
}

/** Chamfered rectangle path (cut corners top-left and bottom-right). */
export function chamferPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cut: number, all = false): void {
  ctx.beginPath();
  ctx.moveTo(x + cut, y);
  ctx.lineTo(x + w - (all ? cut : 0), y);
  if (all) ctx.lineTo(x + w, y + cut);
  ctx.lineTo(x + w, y + h - cut);
  ctx.lineTo(x + w - cut, y + h);
  ctx.lineTo(x + (all ? cut : 0), y + h);
  if (all) ctx.lineTo(x, y + h - cut);
  ctx.lineTo(x, y + cut);
  ctx.closePath();
}

export interface PanelOpts {
  cut?: number;
  fill?: string;
  edge?: string;
  glow?: number;
  edgeWidth?: number;
  all?: boolean;
  alpha?: number;
}

export function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, o: PanelOpts = {}): void {
  const cut = o.cut ?? 12;
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  chamferPath(ctx, x, y, w, h, cut, o.all);
  ctx.fillStyle = o.fill ?? C.panel;
  ctx.fill();
  if (o.glow && o.edge) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(o.edge.startsWith('#') ? o.edge : '#8fd8ff', 0.18 * o.glow);
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.strokeStyle = o.edge ?? C.edge;
  ctx.lineWidth = o.edgeWidth ?? 1.2;
  ctx.stroke();
  ctx.restore();
}

/** Corner brackets decoration around a rect. */
export function brackets(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, len: number, color: string, width = 2): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x, y + len); ctx.lineTo(x, y); ctx.lineTo(x + len, y);
  ctx.moveTo(x + w - len, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + len);
  ctx.moveTo(x + w, y + h - len); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - len, y + h);
  ctx.moveTo(x + len, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - len);
  ctx.stroke();
  ctx.restore();
}

/** Glow line helper (additive bloom + core). */
export function glowLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, w = 2, glow = 1): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(color, 0.2 * glow);
  ctx.lineWidth = w * 4;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// Input notation icons

export const BTN_COLORS: Record<string, string> = {
  LP: '#4fd8ff', MP: '#5c8dff', HP: '#b16bff',
  LK: '#5dffb0', MK: '#ffd34f', HK: '#ff5f7a',
  P: '#6fb2ff', K: '#ff9a5c', PP: '#6fb2ff', KK: '#ff9a5c',
};

/** Draws an arrow for a numpad direction (relative to facing right) centered at x,y. */
export function arrowIcon(ctx: CanvasRenderingContext2D, dir: number, x: number, y: number, r: number, color = C.text, charge = false): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = charge ? 'rgba(255,190,60,0.22)' : 'rgba(255,255,255,0.07)';
  ctx.fill();
  ctx.strokeStyle = charge ? C.amber : rgba('#ffffff', 0.25);
  ctx.lineWidth = 1;
  ctx.stroke();
  if (dir === 5) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  const dx = [-1, 0, 1, -1, 0, 1, -1, 0, 1][dir - 1];
  const dy = [1, 1, 1, 0, 0, 0, -1, -1, -1][dir - 1];
  const ang = Math.atan2(dy, dx);
  ctx.rotate(ang);
  ctx.fillStyle = color;
  const s = r * 0.62;
  ctx.beginPath();
  ctx.moveTo(s, 0);
  ctx.lineTo(-s * 0.15, -s * 0.72);
  ctx.lineTo(-s * 0.15, -s * 0.28);
  ctx.lineTo(-s, -s * 0.28);
  ctx.lineTo(-s, s * 0.28);
  ctx.lineTo(-s * 0.15, s * 0.28);
  ctx.lineTo(-s * 0.15, s * 0.72);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Button icon: colored disc with label. */
export function buttonIcon(ctx: CanvasRenderingContext2D, label: string, x: number, y: number, r: number): void {
  const col = BTN_COLORS[label] ?? C.cyan;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = rgba(col, 0.2);
  ctx.fill();
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.restore();
  text(ctx, label, x, y + r * 0.36, { size: Math.round(r * (label.length > 1 ? 0.82 : 1.05)), weight: 800, align: 'center', color: '#ffffff', font: 'display' });
}

/** Motion sequences in numpad notation for icons. */
export const MOTION_DIRS: Record<string, number[]> = {
  qcf: [2, 3, 6], qcb: [2, 1, 4], dp: [6, 2, 3], rdp: [4, 2, 1], hcf: [4, 1, 2, 3, 6], hcb: [6, 3, 2, 1, 4],
  '360': [6, 3, 2, 1, 4, 7, 8, 9], qcf2: [2, 3, 6, 2, 3, 6], qcb2: [2, 1, 4, 2, 1, 4], hcf2: [4, 2, 6, 4, 2, 6],
  chargeBF: [4, 6], chargeDU: [2, 8], chargeBFBF: [4, 6, 4, 6],
};

export interface InputDesc { motion?: string; dirs?: number[]; buttons: string[]; }

/** Draws a full command (motion arrows + buttons). Returns the width used. */
export function commandIcons(ctx: CanvasRenderingContext2D, d: InputDesc, x: number, y: number, r: number): number {
  let cx = x + r;
  const step = r * 2.15;
  const seq = d.motion ? MOTION_DIRS[d.motion] ?? [] : d.dirs ?? [];
  const charge = !!d.motion && d.motion.startsWith('charge');
  seq.forEach((dir, i) => {
    arrowIcon(ctx, dir, cx, y, r, C.text, charge && i === 0);
    if (charge && i === 0) text(ctx, t('input.hold'), cx, y + r + 11, { size: 9, weight: 800, align: 'center', color: C.amber, font: 'display' });
    cx += step * (d.motion === '360' ? 0.78 : 1);
  });
  if (seq.length) {
    text(ctx, '+', cx - r * 0.35, y + r * 0.4, { size: Math.round(r * 1.2), weight: 800, align: 'center', color: C.dim });
    cx += r * 0.9;
  }
  d.buttons.forEach((b, i) => {
    if (i > 0) { text(ctx, '+', cx - r * 0.4, y + r * 0.4, { size: Math.round(r * 1.1), weight: 800, align: 'center', color: C.dim }); cx += r * 0.7; }
    buttonIcon(ctx, b, cx, y, r);
    cx += step;
  });
  return cx - x - r;
}

/** Horizontal scanline overlay for CRT/hologram feel (cheap: few wide rects). */
export function scanlines(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, alpha = 0.06, gap = 4): void {
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  for (let yy = y; yy < y + h; yy += gap) ctx.fillRect(x, yy, w, 1);
  ctx.restore();
}

/** Perspective neon floor grid for menu backgrounds. */
export function neonGrid(ctx: CanvasRenderingContext2D, w: number, h: number, horizon: number, t: number, color: string, alpha = 0.35): void {
  ctx.save();
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = 1;
  ctx.beginPath();
  const cx = w / 2;
  for (let i = -14; i <= 14; i++) {
    ctx.moveTo(cx + i * 20, horizon);
    ctx.lineTo(cx + i * 160, h);
  }
  const off = (t * 0.6) % 1;
  for (let i = 0; i < 12; i++) {
    const p = (i + off) / 12;
    const yy = horizon + (h - horizon) * p * p;
    ctx.moveTo(0, yy);
    ctx.lineTo(w, yy);
  }
  ctx.stroke();
  ctx.restore();
}
