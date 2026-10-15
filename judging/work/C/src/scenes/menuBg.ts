/**
 * Shared animated menu backdrop: neon-noir skyline silhouettes (pre-rendered), atmospheric
 * glow, drifting fog, rain (typed-array pool), floating kanji watermark and vignette.
 */
import { H, W } from '../core/view';
import { C, rgba } from '../ui/theme';

let sky: HTMLCanvasElement | null = null;
let vignette: HTMLCanvasElement | null = null;
const RAIN = 220;
const rx = new Float32Array(RAIN), ry = new Float32Array(RAIN), rs = new Float32Array(RAIN), rl = new Float32Array(RAIN);
let rainInit = false;

function rng(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

function buildSky(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#04040d');
  grd.addColorStop(0.45, '#0a0a26');
  grd.addColorStop(0.72, '#2a0b3a');
  grd.addColorStop(1, '#07060f');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  // horizon glow
  const hg = g.createRadialGradient(W * 0.5, H * 0.74, 10, W * 0.5, H * 0.74, W * 0.7);
  hg.addColorStop(0, 'rgba(255,46,154,0.35)');
  hg.addColorStop(0.4, 'rgba(139,92,255,0.12)');
  hg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = hg;
  g.fillRect(0, 0, W, H);
  // skyline layers
  const r = rng(42);
  const layers = [
    { base: H * 0.74, hMin: 60, hMax: 240, wMin: 30, wMax: 90, col: '#120f2c', win: 0.25, winCol: ['#ff2e9a', '#27e8ff', '#8b5cff', '#ffd27a'] },
    { base: H * 0.8, hMin: 90, hMax: 330, wMin: 50, wMax: 130, col: '#08081a', win: 0.18, winCol: ['#27e8ff', '#ff2e9a', '#6dff9e'] },
  ];
  for (const L of layers) {
    let x = -20;
    while (x < W + 20) {
      const w = L.wMin + r() * (L.wMax - L.wMin);
      const h = L.hMin + r() * (L.hMax - L.hMin);
      const top = L.base - h;
      g.fillStyle = L.col;
      g.fillRect(x, top, w, H - top);
      if (r() < 0.3) { g.fillRect(x + w * 0.4, top - 30 - r() * 40, 2, 40); }
      // windows
      for (let wy = top + 8; wy < L.base - 4; wy += 7) {
        for (let wx = x + 4; wx < x + w - 4; wx += 6) {
          if (r() < L.win) {
            g.fillStyle = rgba(L.winCol[Math.floor(r() * L.winCol.length)], 0.25 + r() * 0.5);
            g.fillRect(wx, wy, 3, 2);
          }
        }
      }
      // neon strip
      if (r() < 0.35) {
        const col = L.winCol[Math.floor(r() * L.winCol.length)];
        g.fillStyle = rgba(col, 0.8);
        const sy = top + 10 + r() * Math.min(80, h - 20);
        g.fillRect(x + 3, sy, w - 6, 2);
        g.fillStyle = rgba(col, 0.12);
        g.fillRect(x - 4, sy - 5, w + 8, 12);
      }
      x += w + r() * 8;
    }
  }
  // ground haze
  const fg = g.createLinearGradient(0, H * 0.78, 0, H);
  fg.addColorStop(0, 'rgba(10,8,30,0)');
  fg.addColorStop(1, 'rgba(4,4,12,0.95)');
  g.fillStyle = fg;
  g.fillRect(0, H * 0.7, W, H * 0.3);
  return c;
}

function buildVignette(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const v = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.75)');
  g.fillStyle = v;
  g.fillRect(0, 0, W, H);
  return c;
}

export function drawMenuBg(ctx: CanvasRenderingContext2D, t: number, accent: string = C.cyan, kanji = '嵐'): void {
  if (!sky) sky = buildSky();
  if (!vignette) vignette = buildVignette();
  if (!rainInit) {
    const r = rng(7);
    for (let i = 0; i < RAIN; i++) { rx[i] = r() * W; ry[i] = r() * H; rs[i] = 9 + r() * 10; rl[i] = 8 + r() * 18; }
    rainInit = true;
  }
  ctx.drawImage(sky, 0, 0, W, H);
  // drifting light beams
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    const x = ((t * (14 + i * 6) + i * 420) % (W + 600)) - 300;
    const g = ctx.createLinearGradient(x, 0, x + 220, H);
    g.addColorStop(0, rgba(i === 1 ? C.magenta : accent, 0));
    g.addColorStop(0.5, rgba(i === 1 ? C.magenta : accent, 0.05));
    g.addColorStop(1, rgba(i === 1 ? C.magenta : accent, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, 0); ctx.lineTo(x + 120, 0); ctx.lineTo(x + 420, H); ctx.lineTo(x + 260, H);
    ctx.fill();
  }
  ctx.restore();
  // kanji watermark
  ctx.save();
  ctx.font = `900 520px "Yu Gothic UI", "Yu Gothic", "Meiryo", "Noto Sans JP", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = rgba(accent, 0.035 + 0.01 * Math.sin(t * 0.8));
  ctx.fillText(kanji, W * 0.74, H * 0.46);
  ctx.restore();
  // rain
  ctx.save();
  ctx.strokeStyle = 'rgba(170,200,255,0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const dt = 1 / 60;
  for (let i = 0; i < RAIN; i++) {
    ry[i] += rs[i] * dt * 60;
    rx[i] -= rs[i] * 0.18 * dt * 60;
    if (ry[i] > H) { ry[i] = -20; rx[i] = Math.random() * (W + 100); }
    if (rx[i] < -20) rx[i] += W + 40;
    ctx.moveTo(rx[i], ry[i]);
    ctx.lineTo(rx[i] + rl[i] * 0.18, ry[i] - rl[i]);
  }
  ctx.stroke();
  ctx.restore();
  ctx.drawImage(vignette, 0, 0, W, H);
}

/** Thin animated frame lines and corner HUD decorations used by menu screens. */
export function drawFrame(ctx: CanvasRenderingContext2D, t: number, accent: string, title: string, subtitle = ''): void {
  ctx.save();
  ctx.fillStyle = 'rgba(4,5,14,0.65)';
  ctx.fillRect(0, 0, W, 64);
  ctx.fillRect(0, H - 44, W, 44);
  ctx.fillStyle = rgba(accent, 0.7);
  ctx.fillRect(0, 64, W * 0.35, 1);
  ctx.fillStyle = rgba(C.magenta, 0.5);
  ctx.fillRect(W * 0.35, 64, W * 0.65, 1);
  ctx.fillStyle = rgba(accent, 0.4);
  ctx.fillRect(0, H - 44, W, 1);
  // ticker
  ctx.font = '600 11px "Cascadia Mono", Consolas, monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = rgba(accent, 0.55);
  const ticker = 'NEON TEMPEST // UNDERGROUND CIRCUIT // NEO-KYOTO SECTOR 7 // RAIN 97% // STORM WARNING ACTIVE // ';
  const off = (t * 40) % 700;
  for (let x = -off; x < W; x += 700) ctx.fillText(ticker, x, H - 18);
  ctx.restore();
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `italic 800 30px ${'"Bahnschrift", "DIN Alternate", "Roboto Condensed", "Arial Narrow", sans-serif'}`;
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '6px';
  ctx.fillStyle = C.white;
  ctx.fillText(title, 40, 44);
  if (subtitle) {
    ctx.font = '700 12px "Bahnschrift", "Segoe UI", sans-serif';
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '3px';
    ctx.fillStyle = rgba(accent, 0.9);
    ctx.textAlign = 'right';
    ctx.fillText(subtitle, W - 40, 40);
  }
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '0px';
  ctx.restore();
}
