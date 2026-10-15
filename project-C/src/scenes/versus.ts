/**
 * VS splash / loading screen: both fighters slam in on diagonal panels, VS lightning, stage
 * banner, quotes and a loading bar while the match scene pre-warms (stage caches).
 */
import { app, type MatchSetup } from '../core/app';
import { H, W } from '../core/view';
import type { DrawOpts } from '../render/bodyDraw';
import { FighterView } from '../render/fighterView';
import { STAGE_INFOS } from '../render/stages/index';
import { getChar } from '../sim/registry';
import { text } from '../ui/draw';
import { t } from '../ui/strings';
import { drawStrokeText } from '../ui/strokeFont';
import { C, clamp01, ease, rgba } from '../ui/theme';
import * as flow from './flow';
import { Scene } from './scene';

export class VersusScene extends Scene {
  readonly id = 'VersusScene';
  private views: FighterView[];
  private opts: DrawOpts = { flat: null, rimA: C.cyan, rimB: C.magenta, glow: true, t: 0, energy: 0.5 };
  private quotes: string[];
  private started = false;
  private bolt: number[] = [];

  constructor(private setup: MatchSetup) {
    super();
    this.views = setup.chars.map((c, i) => {
      const v = new FighterView(c, setup.palettes[i]);
      v.facing = i === 0 ? 1 : -1;
      return v;
    });
    this.quotes = setup.chars.map((c) => {
      const q = getChar(c).quotes.intro;
      return q[Math.floor(Math.random() * q.length)];
    });
  }

  enter(): void {
    app().audio.music('versus', 0.3);
    app().sfx('announce_round');
  }

  update(): void {
    for (const v of this.views) v.animateMenu('idle', this.time);
    if (this.frames % 4 === 0) {
      this.bolt = [];
      for (let i = 0; i <= 10; i++) this.bolt.push((Math.random() - 0.5) * 40);
    }
    if (this.frames === 26) app().sfx('hit_super');
    const skip = this.frames > 60 && app().input.menuEvents().some((e) => e.k === 'confirm' || e.k === 'start');
    if (!this.started && (this.frames >= 200 || skip)) {
      this.started = true;
      flow.startMatch(this.setup);
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const f = this.frames;
    ctx.fillStyle = '#030309';
    ctx.fillRect(0, 0, W, H);
    for (let side = 0; side < 2; side++) {
      const ch = getChar(this.setup.chars[side]);
      const left = side === 0;
      const k = ease.outExpo(clamp01((f - side * 6) / 22));
      const slide = (1 - k) * (left ? -W * 0.6 : W * 0.6);
      ctx.save();
      ctx.translate(slide, 0);
      // diagonal panel
      ctx.beginPath();
      if (left) { ctx.moveTo(0, 0); ctx.lineTo(W / 2 + 90, 0); ctx.lineTo(W / 2 - 90, H); ctx.lineTo(0, H); }
      else { ctx.moveTo(W / 2 + 90, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H); ctx.lineTo(W / 2 - 90, H); }
      ctx.closePath();
      const g = ctx.createLinearGradient(left ? 0 : W, 0, W / 2, H);
      g.addColorStop(0, rgba(ch.themeColor, 0.55));
      g.addColorStop(0.6, 'rgba(10,8,30,0.95)');
      g.addColorStop(1, '#05040e');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.save();
      ctx.clip();
      // kanji
      ctx.font = `900 360px "Yu Gothic UI", "Yu Gothic", "Meiryo", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = rgba(ch.themeColor, 0.1);
      ctx.fillText(ch.kanji[0], left ? 300 : W - 300, H * 0.62);
      // speed streaks
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = rgba(ch.themeColor, 0.12);
      for (let i = 0; i < 16; i++) {
        const y = (i * 53 + f * (left ? 9 : -9) * 0.3) % H;
        const x = ((i * 197 + f * 14) % (W / 2 + 200)) - 100;
        ctx.fillRect(left ? x : W - x - 200, y, 200, 2);
      }
      ctx.globalCompositeOperation = 'source-over';
      // fighter
      this.opts.rimA = ch.themeColor; this.opts.t = this.time;
      const v = this.views[side];
      const drift = Math.sin(this.time * 0.6) * 10;
      v.drawPortrait(ctx, (left ? 360 : W - 360) + drift * (left ? 1 : -1), H + 170, 2.45 / ch.body.scale, left ? 1 : -1, this.opts);
      ctx.restore();
      ctx.restore();
      // names
      const nk = clamp01((f - 20 - side * 6) / 14);
      const nx = left ? 60 : W - 60;
      drawStrokeText(ctx, ch.name, nx, H - 210, {
        size: 64, color: ch.themeColor, style: 'neon', align: left ? 'left' : 'right', tracking: 1, weight: 1.3,
        letter: (i) => { const kk = clamp01((f - 20 - side * 6 - i * 2) / 10); return [(1 - ease.outCubic(kk)) * (left ? -60 : 60), 0, 1, kk]; },
      });
      text(ctx, ch.epithet.toUpperCase(), nx, H - 112, { size: 16, weight: 800, font: 'display', tracking: 6, align: left ? 'left' : 'right', color: C.white, alpha: nk });
      text(ctx, `"${this.quotes[side]}"`, nx, H - 84, { size: 15, weight: 500, italic: true, align: left ? 'left' : 'right', color: rgba(C.text, 0.85), alpha: clamp01((f - 50) / 20), maxWidth: 520 });
    }
    // VS
    const vk = clamp01((f - 22) / 10);
    if (vk > 0) {
      const sc = 1 + (1 - ease.outBack(vk)) * 2;
      ctx.save();
      ctx.translate(W / 2, H / 2 - 40);
      ctx.scale(sc, sc);
      // lightning bolt
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(C.white, 0.9 * vk);
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i <= 10; i++) {
        const y = -H / 2 + (i / 10) * H;
        const x = (this.bolt[i] ?? 0) - (y / H) * 180;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.strokeStyle = rgba(C.cyan, 0.25 * vk);
      ctx.lineWidth = 16;
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      drawStrokeText(ctx, t('arcade.vs'), 0, -60, { size: 120, color: C.gold, style: 'solid', align: 'center', weight: 1.2, outline: '#1b1004' });
      drawStrokeText(ctx, t('arcade.vs'), 0, -60, { size: 120, color: '#fff3c0', style: 'neon', align: 'center', weight: 0.4, glow: 0.8 });
      ctx.restore();
    }
    if (f >= 26 && f < 32) {
      ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - (f - 26) / 6)})`;
      ctx.fillRect(0, 0, W, H);
    }
    // stage banner + loading
    const st = STAGE_INFOS.find((s) => s.id === this.setup.stage);
    const bk = clamp01((f - 40) / 20);
    ctx.save();
    ctx.globalAlpha = bk;
    ctx.fillStyle = 'rgba(3,4,12,0.85)';
    ctx.fillRect(0, 26, W, 52);
    ctx.fillStyle = rgba(st?.accent ?? C.cyan, 0.8);
    ctx.fillRect(0, 78, W, 1);
    ctx.restore();
    if (this.setup.mode === 'arcade' && this.setup.arcadeIndex !== undefined) {
      const last = this.setup.arcadeIndex === 3;
      text(ctx, last ? t('arcade.final') : `${t('arcade.stage')} ${this.setup.arcadeIndex + 1} / 4`, 40, 60, { size: 18, weight: 800, font: 'display', tracking: 5, color: last ? C.gold : C.white, alpha: bk });
    }
    text(ctx, `${st?.name ?? ''}  ·  ${st?.location.toUpperCase() ?? ''}`, W - 40, 60, { size: 15, weight: 800, font: 'display', tracking: 4, align: 'right', color: C.white, alpha: bk });
    const lp = clamp01(f / 190);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(W / 2 - 160, H - 30, 320, 3);
    ctx.fillStyle = C.cyan;
    ctx.fillRect(W / 2 - 160, H - 30, 320 * ease.inOutCubic(lp), 3);
    text(ctx, t('vs.loading'), W / 2, H - 40, { size: 10, weight: 800, font: 'display', tracking: 5, align: 'center', color: C.dim });
  }
}
