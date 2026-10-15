/**
 * Title screen: animated neon logo that flickers on letter by letter, rain-soaked skyline,
 * pulsing PRESS START. Idling starts a CPU-vs-CPU attract demo.
 */
import { app } from '../core/app';
import { H, W } from '../core/view';
import { text } from '../ui/draw';
import { t } from '../ui/strings';
import { drawStrokeText } from '../ui/strokeFont';
import { C, clamp01, ease, rgba } from '../ui/theme';
import * as flow from './flow';
import { drawMenuBg } from './menuBg';
import { Scene } from './scene';

export class TitleScene extends Scene {
  readonly id = 'TitleScene';
  private leaving = 0;
  private idle = 0;
  private flick: number[] = [];

  enter(): void {
    app().audio.music('title');
    app().audio.ambience('rain');
    for (let i = 0; i < 12; i++) this.flick.push(18 + i * 5 + Math.floor(Math.random() * 10));
  }

  update(): void {
    const inp = app().input;
    const ev = inp.menuEvents();
    if (this.leaving > 0) {
      this.leaving++;
      if (this.leaving === 30) flow.toMainMenu();
      return;
    }
    if (this.frames > 30 && (ev.some((e) => e.k === 'start' || e.k === 'confirm' || e.k === 'pause') || inp.takeClick())) {
      app().audio.unlock();
      app().sfx('ui_start');
      this.leaving = 1;
      return;
    }
    if (ev.length || inp.anyInputThisFrame) this.idle = 0;
    if (++this.idle > 60 * 30) flow.startAttract();
  }

  /** Letter flicker-on: off, flicker, then steady with rare buzzes. */
  private letterOn(i: number): number {
    const f = this.frames;
    const on = this.flick[i % this.flick.length];
    if (f < on) return 0;
    if (f < on + 8) return (f + i) % 3 === 0 ? 0.25 : 1;
    const buzz = (Math.floor(this.time * 7) + i * 13) % 97 === 0 ? 0.35 : 1;
    return buzz;
  }

  render(ctx: CanvasRenderingContext2D): void {
    drawMenuBg(ctx, this.time, C.magenta, '嵐');
    const cy = 250;
    const float = Math.sin(this.time * 1.2) * 4;
    // logo backing glow
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(W / 2, cy + 40, 20, W / 2, cy + 40, 520);
    g.addColorStop(0, 'rgba(255,46,154,0.16)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    drawStrokeText(ctx, 'NEON', W / 2, cy - 80 + float, {
      size: 96, color: C.cyan, style: 'neon', align: 'center', weight: 1.35, tracking: 1.6,
      letter: (i) => [0, 0, 1, this.letterOn(i)],
    });
    drawStrokeText(ctx, 'TEMPEST', W / 2, cy + 40 + float, {
      size: 118, color: C.magenta, style: 'neon', align: 'center', weight: 1.45, tracking: 1.3,
      letter: (i) => [0, 0, 1, this.letterOn(i + 4)],
    });
    // lightning underline
    const la = clamp01((this.frames - 70) / 20);
    if (la > 0) {
      ctx.save();
      ctx.globalAlpha = la;
      ctx.strokeStyle = C.cyan;
      ctx.lineWidth = 2;
      ctx.beginPath();
      const y = cy + 185 + float;
      const w = 560 * ease.outExpo(la);
      ctx.moveTo(W / 2 - w / 2, y);
      for (let x = -w / 2; x <= w / 2; x += 24) ctx.lineTo(W / 2 + x, y + ((x / 24) % 2 ? 4 : -4) * Math.sin(this.time * 9 + x));
      ctx.stroke();
      ctx.restore();
    }
    text(ctx, t('title.sub'), W / 2, cy + 222, { size: 15, weight: 700, font: 'display', tracking: 9, align: 'center', color: rgba(C.white, 0.85), alpha: clamp01((this.frames - 80) / 30) });
    // press start
    const pa = clamp01((this.frames - 100) / 20);
    if (pa > 0) {
      const blink = this.leaving > 0 ? (this.leaving % 4 < 2 ? 1 : 0.2) : 0.55 + 0.45 * Math.sin(this.time * 4);
      drawStrokeText(ctx, t('title.press'), W / 2, 520, { size: 26, color: C.white, style: 'neon', align: 'center', tracking: 2.4, alpha: pa * blink, glow: 0.7 });
    }
    text(ctx, t('title.copy'), W / 2, H - 22, { size: 11, weight: 600, font: 'display', tracking: 3, align: 'center', color: C.faint });
    if (this.leaving > 0) {
      ctx.fillStyle = `rgba(255,255,255,${0.4 * (1 - this.leaving / 30)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
}
