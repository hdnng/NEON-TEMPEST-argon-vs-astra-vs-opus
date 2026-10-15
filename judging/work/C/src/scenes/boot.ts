/**
 * Boot / studio logo: the NULLSTATE mark draws itself as a neon tube with glitch slices.
 */
import { app } from '../core/app';
import { H, W } from '../core/view';
import { text } from '../ui/draw';
import { t } from '../ui/strings';
import { drawStrokeText } from '../ui/strokeFont';
import { C, clamp01, ease } from '../ui/theme';
import * as flow from './flow';
import { Scene } from './scene';

export class BootScene extends Scene {
  readonly id = 'BootScene';
  private done = false;

  update(): void {
    const ev = app().input.menuEvents();
    if (!this.done && (this.frames > 170 || (this.frames > 20 && (ev.length || app().input.pointer.clicked)))) {
      this.done = true;
      flow.toTitle();
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const f = this.frames;
    ctx.fillStyle = '#020208';
    ctx.fillRect(0, 0, W, H);
    const a = clamp01(f / 20) * clamp01((170 - f) / 25);
    const draw = clamp01((f - 8) / 50);
    // logo mark: hexagonal ring
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(W / 2, H / 2 - 50);
    ctx.strokeStyle = C.cyan;
    ctx.lineWidth = 3;
    ctx.beginPath();
    const n = 6;
    const seg = draw * n;
    for (let i = 0; i <= Math.floor(seg) && i <= n; i++) {
      const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(ang) * 46, y = Math.sin(ang) * 46;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(39,232,255,0.2)';
    ctx.lineWidth = 12;
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = C.magenta;
    const k = ease.outBack(clamp01((f - 40) / 16));
    ctx.fillRect(-14 * k, -14 * k, 28 * k, 28 * k);
    ctx.restore();
    const glitch = f > 60 && f < 70 ? (f % 2 ? 8 : -6) : 0;
    drawStrokeText(ctx, t('boot.studio'), W / 2 + glitch, H / 2 + 30, {
      size: 44, color: C.cyan, align: 'center', tracking: 2.2, alpha: a,
      letter: (i) => { const k2 = clamp01((f - 30 - i * 3) / 10); return [0, (1 - ease.outCubic(k2)) * 20, 1, k2]; },
    });
    text(ctx, t('boot.presents'), W / 2, H / 2 + 120, { size: 14, weight: 700, font: 'display', tracking: 10, align: 'center', color: C.dim, alpha: a * clamp01((f - 70) / 20) });
  }
}
