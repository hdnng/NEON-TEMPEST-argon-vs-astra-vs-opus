/**
 * Design system tokens: color, typography, spacing, glow and motion easing.
 * Every UI surface pulls from here so the whole game shares one visual language.
 */

export const C = {
  bg0: '#03040b',
  bg1: '#080b1c',
  bg2: '#10153a',
  panel: 'rgba(9, 12, 32, 0.84)',
  panelHi: 'rgba(22, 30, 72, 0.9)',
  edge: 'rgba(120, 170, 255, 0.28)',
  edgeHi: 'rgba(160, 230, 255, 0.8)',
  cyan: '#27e8ff',
  cyanDim: '#0f6f86',
  magenta: '#ff2e9a',
  magentaDim: '#7a1550',
  violet: '#8b5cff',
  amber: '#ffb238',
  lime: '#6dff9e',
  red: '#ff3b4f',
  gold: '#ffd84a',
  white: '#f2f6ff',
  text: '#e4ebff',
  dim: '#8a95c4',
  faint: '#4a5584',
  ink: '#05060f',
} as const;

/** Player colors (normal and colorblind-friendly variants). */
export const PLAYER_COLORS = {
  normal: [C.cyan, C.magenta],
  colorblind: ['#3aa0ff', '#ffa630'],
} as const;

export const FONT = {
  display: '"Bahnschrift", "DIN Alternate", "Roboto Condensed", "Arial Narrow", "Segoe UI", sans-serif',
  body: '"Segoe UI", "Inter", "Helvetica Neue", "Noto Sans", Arial, sans-serif',
  mono: '"Cascadia Mono", "Consolas", "SF Mono", "Menlo", monospace',
  jp: '"Yu Gothic UI", "Yu Gothic", "Meiryo", "Hiragino Sans", "Noto Sans JP", sans-serif',
} as const;

/** Spacing scale (logical px). */
export const S = { xs: 4, sm: 8, md: 16, lg: 24, xl: 40, xxl: 64 } as const;

export const ease = {
  linear: (t: number) => t,
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inCubic: (t: number) => t * t * t,
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outExpo: (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  outBack: (t: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outElastic: (t: number) => {
    if (t <= 0 || t >= 1) return Math.max(0, Math.min(1, t));
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
  },
  outQuart: (t: number) => 1 - Math.pow(1 - t, 4),
};

export const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Hex color with alpha (0..1) -> rgba string. Cached for hot paths. */
const rgbaCache = new Map<string, string>();
export function rgba(hex: string, a: number): string {
  const key = hex + '|' + Math.round(a * 100);
  let v = rgbaCache.get(key);
  if (v) return v;
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  v = `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.round(a * 100) / 100})`;
  rgbaCache.set(key, v);
  return v;
}

/** Mixes two hex colors. */
export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(lerp((pa >> 16) & 255, (pb >> 16) & 255, t));
  const g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, t));
  const bl = Math.round(lerp(pa & 255, pb & 255, t));
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
}
