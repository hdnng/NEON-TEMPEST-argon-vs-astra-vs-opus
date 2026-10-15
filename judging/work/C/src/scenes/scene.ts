/**
 * Scene base + manager with animated transitions (neon wipe / glitch slice / fade).
 * Scenes tick at the fixed 60 Hz rate and render with an interpolation alpha.
 */
import { H, W } from '../core/view';
import { C, clamp01, ease, rgba } from '../ui/theme';

export abstract class Scene {
  /** Stable scene identifier (class names are minified in production builds). */
  abstract readonly id: string;
  /** Seconds since enter (advanced by the manager at 60 Hz). */
  time = 0;
  frames = 0;
  enter(): void {}
  exit(): void {}
  abstract update(): void;
  abstract render(ctx: CanvasRenderingContext2D, alpha: number): void;
  /** Scenes that should not be auto-paused (e.g. menus) return false. */
  onHidden(): void {}
}

export type TransitionKind = 'wipe' | 'slice' | 'fade' | 'none';

export class SceneManager {
  current: Scene | null = null;
  private next: Scene | null = null;
  private kind: TransitionKind = 'none';
  private t = 0;
  private dur = 0;
  private swapped = false;
  private colorA = C.cyan;
  private colorB = C.magenta;

  get transitioning(): boolean { return this.next !== null || (this.dur > 0 && this.t < this.dur); }

  go(scene: Scene, kind: TransitionKind = 'wipe', frames = 36): void {
    if (this.next) return; // ignore while transitioning
    if (!this.current || kind === 'none') {
      this.current?.exit();
      this.current = scene;
      scene.enter();
      this.dur = 0;
      return;
    }
    this.next = scene;
    this.kind = kind;
    this.t = 0;
    this.dur = frames;
    this.swapped = false;
  }

  update(): void {
    if (this.next || (this.dur > 0 && this.t < this.dur)) {
      this.t++;
      if (!this.swapped && this.t >= this.dur / 2) {
        this.swapped = true;
        this.current?.exit();
        this.current = this.next;
        this.next = null;
        this.current?.enter();
      }
    }
    const s = this.current;
    if (s && (this.dur === 0 || this.t >= this.dur / 2 || !this.next)) {
      s.time += 1 / 60;
      s.frames++;
      s.update();
    }
  }

  render(ctx: CanvasRenderingContext2D, alpha: number): void {
    this.current?.render(ctx, alpha);
    if (this.dur > 0 && this.t < this.dur) this.drawTransition(ctx);
  }

  private drawTransition(ctx: CanvasRenderingContext2D): void {
    const p = this.t / this.dur; // 0..1, swap at 0.5
    const cover = p < 0.5 ? ease.inOutCubic(p * 2) : 1 - ease.inOutCubic((p - 0.5) * 2);
    ctx.save();
    if (this.kind === 'fade') {
      ctx.fillStyle = `rgba(2,3,8,${cover})`;
      ctx.fillRect(0, 0, W, H);
    } else if (this.kind === 'wipe') {
      // diagonal neon wipe
      const skew = 260;
      const span = W + skew;
      const lead = p < 0.5 ? -skew + span * ease.inOutCubic(p * 2) : -skew + span * ease.inOutCubic((p - 0.5) * 2);
      const from = p < 0.5 ? -skew : lead;
      const to = p < 0.5 ? lead + skew : W + skew;
      ctx.fillStyle = '#04050c';
      ctx.beginPath();
      ctx.moveTo(from, 0); ctx.lineTo(to, 0); ctx.lineTo(to - skew, H); ctx.lineTo(from - skew, H);
      ctx.closePath();
      ctx.fill();
      const edge = p < 0.5 ? to : from;
      ctx.globalCompositeOperation = 'lighter';
      for (const [off, col, wdt] of [[0, this.colorA, 3], [-14, this.colorB, 2], [-30, this.colorA, 1]] as [number, string, number][]) {
        ctx.strokeStyle = col;
        ctx.lineWidth = wdt;
        ctx.beginPath();
        ctx.moveTo(edge + off, 0);
        ctx.lineTo(edge + off - skew, H);
        ctx.stroke();
        ctx.strokeStyle = rgba(col, 0.15);
        ctx.lineWidth = wdt * 8;
        ctx.stroke();
      }
    } else if (this.kind === 'slice') {
      const n = 9;
      const hh = H / n;
      for (let i = 0; i < n; i++) {
        const d = (i % 2 ? 1 : -1);
        const k = clamp01(cover * 1.3 - (i / n) * 0.3);
        const w = W * ease.outCubic(k);
        ctx.fillStyle = '#04050c';
        ctx.fillRect(d > 0 ? 0 : W - w, i * hh, w, hh + 1);
        if (k > 0 && k < 1) {
          ctx.fillStyle = i % 3 === 0 ? this.colorB : this.colorA;
          ctx.fillRect(d > 0 ? w - 3 : W - w, i * hh, 3, hh + 1);
        }
      }
    }
    ctx.restore();
  }
}
