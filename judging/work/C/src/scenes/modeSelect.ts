/**
 * Mode select: five animated cards (Arcade, Versus, Versus CPU, Training, Trials).
 */
import { app } from '../core/app';
import { H, W } from '../core/view';
import { chamferPath, text, wrap } from '../ui/draw';
import { t, type StringKey } from '../ui/strings';
import { drawStrokeText, strokeTextWidth } from '../ui/strokeFont';
import { C, clamp01, ease, rgba } from '../ui/theme';
import type { SelectMode } from './charSelect';
import * as flow from './flow';
import { drawFrame, drawMenuBg } from './menuBg';
import { Scene } from './scene';

interface Card { mode: SelectMode; key: StringKey; desc: StringKey; color: string; icon: (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number) => void }

const icon = {
  arcade: (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => {
    // ladder of 4 steps leading to a crown
    ctx.beginPath();
    for (let i = 0; i < 4; i++) { ctx.rect(x - s * 0.5 + i * s * 0.25, y + s * 0.4 - i * s * 0.22, s * 0.22, s * 0.12); }
    ctx.moveTo(x + s * 0.35, y - s * 0.45); ctx.lineTo(x + s * 0.42, y - s * 0.62); ctx.lineTo(x + s * 0.5, y - s * 0.5); ctx.lineTo(x + s * 0.58, y - s * 0.62); ctx.lineTo(x + s * 0.65, y - s * 0.45); ctx.closePath();
    ctx.stroke();
  },
  versus: (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => {
    ctx.beginPath();
    ctx.moveTo(x - s * 0.6, y - s * 0.3); ctx.lineTo(x - s * 0.1, y); ctx.lineTo(x - s * 0.6, y + s * 0.3);
    ctx.moveTo(x + s * 0.6, y - s * 0.3); ctx.lineTo(x + s * 0.1, y); ctx.lineTo(x + s * 0.6, y + s * 0.3);
    ctx.stroke();
  },
  cpu: (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => {
    ctx.beginPath();
    ctx.rect(x - s * 0.32, y - s * 0.32, s * 0.64, s * 0.64);
    ctx.rect(x - s * 0.14, y - s * 0.14, s * 0.28, s * 0.28);
    for (let i = -1; i <= 1; i++) {
      ctx.moveTo(x + i * s * 0.18, y - s * 0.32); ctx.lineTo(x + i * s * 0.18, y - s * 0.5);
      ctx.moveTo(x + i * s * 0.18, y + s * 0.32); ctx.lineTo(x + i * s * 0.18, y + s * 0.5);
      ctx.moveTo(x - s * 0.32, y + i * s * 0.18); ctx.lineTo(x - s * 0.5, y + i * s * 0.18);
      ctx.moveTo(x + s * 0.32, y + i * s * 0.18); ctx.lineTo(x + s * 0.5, y + i * s * 0.18);
    }
    ctx.stroke();
  },
  training: (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number) => {
    ctx.beginPath();
    ctx.arc(x, y, s * 0.5, 0, Math.PI * 2);
    ctx.moveTo(x + s * 0.3, y); ctx.arc(x, y, s * 0.3, 0, Math.PI * 2);
    ctx.moveTo(x - s * 0.7, y); ctx.lineTo(x - s * 0.08, y);
    ctx.moveTo(x + s * 0.08, y); ctx.lineTo(x + s * 0.7, y);
    ctx.moveTo(x, y - s * 0.7); ctx.lineTo(x, y - s * 0.08);
    ctx.moveTo(x, y + s * 0.08); ctx.lineTo(x, y + s * 0.7);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, s * (0.1 + 0.04 * Math.sin(t * 5)), 0, Math.PI * 2); ctx.fill();
  },
  trials: (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => {
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const yy = y - s * 0.4 + i * s * 0.4;
      ctx.rect(x - s * 0.55, yy - s * 0.12, s * 0.24, s * 0.24);
      ctx.moveTo(x - s * 0.2, yy); ctx.lineTo(x + s * 0.55, yy);
    }
    ctx.moveTo(x - s * 0.52, y - s * 0.4); ctx.lineTo(x - s * 0.44, y - s * 0.32); ctx.lineTo(x - s * 0.3, y - s * 0.52);
    ctx.stroke();
  },
};

export class ModeSelectScene extends Scene {
  readonly id = 'ModeSelectScene';
  private sel = 0;
  private cards: Card[] = [
    { mode: 'arcade', key: 'mode.arcade', desc: 'mode.arcade.d', color: C.magenta, icon: icon.arcade },
    { mode: 'versus', key: 'mode.versus', desc: 'mode.versus.d', color: C.cyan, icon: icon.versus },
    { mode: 'cpu', key: 'mode.cpu', desc: 'mode.cpu.d', color: C.violet, icon: icon.cpu },
    { mode: 'training', key: 'mode.training', desc: 'mode.training.d', color: C.lime, icon: icon.training },
    { mode: 'trials', key: 'mode.trials', desc: 'mode.trials.d', color: C.amber, icon: icon.trials },
  ];
  private expand: number[] = [1, 0, 0, 0, 0];
  private chosen = -1;
  private chosenT = 0;

  enter(): void { app().audio.music('menu'); }

  update(): void {
    const a = app();
    if (this.chosen >= 0) {
      this.chosenT++;
      if (this.chosenT === 14) flow.toCharSelect(this.cards[this.chosen].mode);
      return;
    }
    for (const e of a.input.menuEvents()) {
      if (e.k === 'left' || e.k === 'up') { this.sel = (this.sel + this.cards.length - 1) % this.cards.length; a.sfx('ui_move'); }
      if (e.k === 'right' || e.k === 'down') { this.sel = (this.sel + 1) % this.cards.length; a.sfx('ui_move'); }
      if (e.k === 'confirm' || e.k === 'start') { this.choose(); }
      if (e.k === 'back') { a.sfx('ui_back'); flow.toMainMenu(); return; }
    }
    const p = a.input.pointer;
    for (let i = 0; i < this.cards.length; i++) {
      const r = this.cardRect(i);
      if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
        if (p.moved && this.sel !== i) { this.sel = i; a.sfx('ui_move'); }
        if (p.clicked) { a.input.takeClick(); this.sel = i; this.choose(); }
      }
    }
    for (let i = 0; i < this.cards.length; i++) this.expand[i] += ((i === this.sel ? 1 : 0) - this.expand[i]) * 0.2;
  }

  private choose(): void {
    app().sfx('ui_confirm');
    this.chosen = this.sel;
  }

  private cardRect(i: number): { x: number; y: number; w: number; h: number } {
    const base = 196, big = 292, gap = 14;
    let x = (W - (base * 4 + big + gap * 4)) / 2;
    for (let k = 0; k < i; k++) x += base + (big - base) * this.expand[k] + gap;
    const w = base + (big - base) * this.expand[i];
    return { x, y: 150, w, h: 430 };
  }

  render(ctx: CanvasRenderingContext2D): void {
    const card = this.cards[this.sel];
    drawMenuBg(ctx, this.time, card.color, '闘');
    drawFrame(ctx, this.time, card.color, t('mode.title'), 'NEON TEMPEST');
    const intro = clamp01(this.frames / 24);
    for (let i = 0; i < this.cards.length; i++) {
      const c = this.cards[i];
      const r = this.cardRect(i);
      const e = this.expand[i];
      const k = ease.outCubic(clamp01(intro * 2 - i * 0.15));
      const yo = (1 - k) * 60;
      const flash = this.chosen === i ? 1 - clamp01(this.chosenT / 14) : 0;
      ctx.save();
      ctx.globalAlpha = k;
      chamferPath(ctx, r.x, r.y + yo, r.w, r.h, 18);
      const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
      g.addColorStop(0, rgba(c.color, 0.12 + e * 0.22));
      g.addColorStop(0.6, 'rgba(8,10,28,0.92)');
      g.addColorStop(1, 'rgba(4,5,14,0.96)');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = rgba(c.color, 0.35 + e * 0.65);
      ctx.lineWidth = 1 + e;
      ctx.stroke();
      if (e > 0.5) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = rgba(c.color, 0.15 * e);
        ctx.lineWidth = 9;
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }
      // icon
      ctx.strokeStyle = rgba(c.color, 0.6 + e * 0.4);
      ctx.fillStyle = c.color;
      ctx.lineWidth = 2.5;
      c.icon(ctx, r.x + r.w / 2, r.y + yo + 130, 70 + e * 20, this.time);
      ctx.restore();
      const label = t(c.key);
      const fit = Math.min(22 + e * 8, ((r.w - 28) / strokeTextWidth(label, 10, 0.6)) * 10);
      drawStrokeText(ctx, label, r.x + r.w / 2, r.y + yo + 250, { size: fit, color: c.color, align: 'center', tracking: 0.6, alpha: k, glow: 0.4 + e * 0.6 });
      if (e > 0.3) {
        const lines = wrap(ctx, t(c.desc), r.w - 40, { size: 14, weight: 500 });
        lines.forEach((ln, li) => text(ctx, ln, r.x + r.w / 2, r.y + yo + 320 + li * 20, { size: 14, weight: 500, align: 'center', color: C.text, alpha: k * clamp01((e - 0.3) / 0.5) }));
      }
      text(ctx, `0${i + 1}`, r.x + 18, r.y + yo + 34, { size: 14, weight: 800, font: 'mono', color: rgba(c.color, 0.8), alpha: k });
      if (flash > 0) {
        chamferPath(ctx, r.x, r.y + yo, r.w, r.h, 18);
        ctx.fillStyle = `rgba(255,255,255,${0.5 * flash})`;
        ctx.fill();
      }
    }
    text(ctx, t('hint.modes'), W / 2, H - 58, { size: 12, weight: 700, font: 'display', tracking: 2, color: C.dim, align: 'center' });
  }
}
