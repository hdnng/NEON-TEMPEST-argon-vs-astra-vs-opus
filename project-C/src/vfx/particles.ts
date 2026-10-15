/**
 * Pooled particle system (typed arrays, no per-frame allocation) for hit sparks, glows, rings,
 * dust, splashes and shards. World coordinates (px, +y up); drawn under the camera transform.
 */
import { sx, sy, type Camera } from '../render/camera';

const MAX = 1400;

export const K_SPARK = 0, K_GLOW = 1, K_RING = 2, K_DUST = 3, K_SHARD = 4, K_DROP = 5, K_STREAK = 6;

const glowCache = new Map<string, HTMLCanvasElement>();

/** Pre-rendered radial glow sprite (white core -> color -> transparent). */
export function glowSprite(color: string): HTMLCanvasElement {
  let c = glowCache.get(color);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.18, color);
  grd.addColorStop(0.45, hexA(color, 0.35));
  grd.addColorStop(1, hexA(color, 0));
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  glowCache.set(color, c);
  return c;
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export class Particles {
  private x = new Float32Array(MAX);
  private y = new Float32Array(MAX);
  private vx = new Float32Array(MAX);
  private vy = new Float32Array(MAX);
  private life = new Float32Array(MAX);
  private max = new Float32Array(MAX);
  private size = new Float32Array(MAX);
  private grow = new Float32Array(MAX);
  private rot = new Float32Array(MAX);
  private grav = new Float32Array(MAX);
  private drag = new Float32Array(MAX);
  private kind = new Uint8Array(MAX);
  private col = new Uint8Array(MAX);
  private colors: string[] = [];
  private colorIdx = new Map<string, number>();
  private count = 0;
  private seed = 1;
  quality = 2;

  private rnd(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  private ci(color: string): number {
    let i = this.colorIdx.get(color);
    if (i === undefined) {
      i = this.colors.length;
      if (i >= 250) return 0;
      this.colors.push(color);
      this.colorIdx.set(color, i);
    }
    return i;
  }

  clear(): void { this.count = 0; }

  spawn(kind: number, x: number, y: number, vx: number, vy: number, life: number, size: number, color: string, grow = 0, grav = 0, drag = 1): void {
    if (this.count >= MAX) return;
    const i = this.count++;
    this.kind[i] = kind; this.x[i] = x; this.y[i] = y; this.vx[i] = vx; this.vy[i] = vy;
    this.life[i] = life; this.max[i] = life; this.size[i] = size; this.grow[i] = grow;
    this.grav[i] = grav; this.drag[i] = drag; this.col[i] = this.ci(color); this.rot[i] = this.rnd() * 6.28;
  }

  update(): void {
    let w = 0;
    for (let i = 0; i < this.count; i++) {
      const l = this.life[i] - 1;
      if (l <= 0) continue;
      this.life[i] = l;
      this.vx[i] *= this.drag[i];
      this.vy[i] = this.vy[i] * this.drag[i] - this.grav[i];
      this.x[i] += this.vx[i];
      this.y[i] += this.vy[i];
      this.size[i] += this.grow[i];
      this.rot[i] += 0.2;
      if (this.kind[i] === K_DROP && this.y[i] < 0) { this.life[i] = 0; continue; }
      if (w !== i) this.copy(i, w);
      w++;
    }
    this.count = w;
  }

  private copy(i: number, w: number): void {
    this.x[w] = this.x[i]; this.y[w] = this.y[i]; this.vx[w] = this.vx[i]; this.vy[w] = this.vy[i];
    this.life[w] = this.life[i]; this.max[w] = this.max[i]; this.size[w] = this.size[i]; this.grow[w] = this.grow[i];
    this.rot[w] = this.rot[i]; this.grav[w] = this.grav[i]; this.drag[w] = this.drag[i]; this.kind[w] = this.kind[i]; this.col[w] = this.col[i];
  }

  draw(ctx: CanvasRenderingContext2D, cam: Camera, additiveOnly: boolean | null = null): void {
    if (!this.count) return;
    const z = cam.zoom;
    ctx.save();
    for (let i = 0; i < this.count; i++) {
      const k = this.kind[i];
      const add = k !== K_DUST && k !== K_SHARD;
      if (additiveOnly !== null && add !== additiveOnly) continue;
      const t = this.life[i] / this.max[i];
      const px = sx(cam, this.x[i]), py = sy(cam, this.y[i]);
      const color = this.colors[this.col[i]];
      ctx.globalCompositeOperation = add ? 'lighter' : 'source-over';
      switch (k) {
        case K_SPARK: case K_STREAK: {
          const len = (k === K_STREAK ? 3.2 : 2.2) * z;
          ctx.strokeStyle = color;
          ctx.globalAlpha = Math.min(1, t * 1.6);
          ctx.lineWidth = this.size[i] * z * (0.4 + t * 0.6);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px - this.vx[i] * len, py + this.vy[i] * len);
          ctx.stroke();
          break;
        }
        case K_GLOW: {
          const s = this.size[i] * z * (0.6 + 0.4 * t);
          ctx.globalAlpha = Math.min(1, t * 1.4);
          ctx.drawImage(glowSprite(color), px - s, py - s, s * 2, s * 2);
          break;
        }
        case K_RING: {
          ctx.strokeStyle = color;
          ctx.globalAlpha = t * 0.9;
          ctx.lineWidth = Math.max(1, 6 * t * z);
          ctx.beginPath();
          ctx.ellipse(px, py, this.size[i] * z, this.size[i] * z * 0.85, 0, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        case K_DUST: {
          ctx.fillStyle = color;
          ctx.globalAlpha = t * 0.35;
          ctx.beginPath();
          ctx.arc(px, py, this.size[i] * z, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case K_SHARD: {
          const s = this.size[i] * z;
          ctx.fillStyle = color;
          ctx.globalAlpha = Math.min(1, t * 2);
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(this.rot[i]);
          ctx.fillRect(-s, -s * 0.35, s * 2, s * 0.7);
          ctx.restore();
          break;
        }
        case K_DROP: {
          ctx.fillStyle = color;
          ctx.globalAlpha = t * 0.8;
          ctx.fillRect(px - 1, py - 2, 2 * z, 3 * z);
          break;
        }
      }
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ emitters

  hit(x: number, y: number, power: string, color: string, dir: number, scale = 1): void {
    const P: Record<string, [number, number, number, number]> = {
      // sparks, speed, glow size, ring size
      light: [7, 7, 34, 26],
      medium: [11, 9, 48, 40],
      heavy: [16, 11, 64, 58],
      special: [20, 12, 72, 66],
      super: [26, 14, 90, 84],
    };
    const [n0, sp, gs, rs] = P[power] ?? P.medium;
    const n = Math.round(n0 * (this.quality >= 1 ? 1 : 0.5) * scale);
    this.spawn(K_GLOW, x, y, 0, 0, 10, gs * scale, color);
    this.spawn(K_GLOW, x, y, 0, 0, 6, gs * 0.55 * scale, '#ffffff');
    this.spawn(K_RING, x, y, 0, 0, 14, rs * 0.25 * scale, color, rs * 0.06 * scale);
    if (power === 'heavy' || power === 'special' || power === 'super') {
      this.spawn(K_RING, x, y, 0, 0, 18, rs * 0.2 * scale, '#ffffff', rs * 0.09 * scale);
    }
    for (let i = 0; i < n; i++) {
      const a = (this.rnd() - 0.5) * Math.PI * 1.5 + (dir > 0 ? 0 : Math.PI);
      const s = sp * (0.4 + this.rnd() * 0.9) * scale;
      this.spawn(K_SPARK, x, y, Math.cos(a) * s, Math.sin(a) * s, 8 + this.rnd() * 10, 2.5 + this.rnd() * 2.5, i % 3 === 0 ? '#ffffff' : color, 0, 0.25, 0.86);
    }
  }

  block(x: number, y: number, power: string, color: string, dir: number): void {
    const big = power === 'heavy' || power === 'special' || power === 'super';
    this.spawn(K_GLOW, x, y, 0, 0, 8, big ? 50 : 34, color);
    this.spawn(K_RING, x, y, 0, 0, 12, 14, color, big ? 3.2 : 2.2);
    const n = big ? 9 : 5;
    for (let i = 0; i < n; i++) {
      const a = (this.rnd() - 0.5) * Math.PI * 0.9 + (dir > 0 ? Math.PI : 0);
      const s = 3 + this.rnd() * 4;
      this.spawn(K_SHARD, x, y, Math.cos(a) * s, Math.sin(a) * s, 14 + this.rnd() * 8, 3 + this.rnd() * 2, color, 0, 0.18, 0.9);
    }
  }

  dust(x: number, y: number, amount: number, color = '#9aa3c8'): void {
    const n = Math.round(amount * (this.quality >= 1 ? 1 : 0.5));
    for (let i = 0; i < n; i++) {
      this.spawn(K_DUST, x + (this.rnd() - 0.5) * 40, y + 4, (this.rnd() - 0.5) * 3, 0.5 + this.rnd() * 1.2, 22 + this.rnd() * 18, 6 + this.rnd() * 10, color, 0.35, -0.01, 0.94);
    }
  }

  splash(x: number, y: number, amount: number, color = '#9ad8ff'): void {
    for (let i = 0; i < amount; i++) {
      const a = Math.PI * (0.15 + this.rnd() * 0.7);
      const s = 2 + this.rnd() * 4;
      this.spawn(K_DROP, x + (this.rnd() - 0.5) * 30, y + 2, Math.cos(a) * s * (this.rnd() < 0.5 ? -1 : 1), Math.sin(a) * s, 30, 2, color, 0, 0.35, 0.98);
    }
  }

  burst(x: number, y: number, color: string, n: number, speed: number): void {
    for (let i = 0; i < n; i++) {
      const a = this.rnd() * Math.PI * 2;
      const s = speed * (0.3 + this.rnd());
      this.spawn(K_STREAK, x, y, Math.cos(a) * s, Math.sin(a) * s, 14 + this.rnd() * 16, 2 + this.rnd() * 2, i % 2 ? color : '#ffffff', 0, 0, 0.9);
    }
    this.spawn(K_GLOW, x, y, 0, 0, 16, 110, color);
    this.spawn(K_RING, x, y, 0, 0, 22, 20, color, 7);
  }

  trail(x: number, y: number, color: string, size: number): void {
    this.spawn(K_GLOW, x + (this.rnd() - 0.5) * 6, y + (this.rnd() - 0.5) * 6, (this.rnd() - 0.5) * 0.6, (this.rnd() - 0.5) * 0.6, 12, size, color, -size / 14);
  }

  rising(x: number, y: number, color: string): void {
    this.spawn(K_STREAK, x + (this.rnd() - 0.5) * 70, y + this.rnd() * 30, 0, 3 + this.rnd() * 3, 16, 2, color, 0, -0.1, 0.97);
  }

  get active(): number { return this.count; }
}
