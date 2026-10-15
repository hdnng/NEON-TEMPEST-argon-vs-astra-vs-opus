/**
 * Arcade story cards: intro (before the ladder) and ending (after the final battle), with a
 * typewriter reveal over the fighter's portrait.
 */
import { app } from '../core/app';
import { H, W } from '../core/view';
import type { DrawOpts } from '../render/bodyDraw';
import { FighterView } from '../render/fighterView';
import { getChar } from '../sim/registry';
import { text, wrap } from '../ui/draw';
import { t } from '../ui/strings';
import { drawStrokeText } from '../ui/strokeFont';
import { C, clamp01, ease, rgba } from '../ui/theme';
import * as flow from './flow';
import { drawMenuBg } from './menuBg';
import { Scene } from './scene';

export class StoryScene extends Scene {
  readonly id = 'StoryScene';
  private view: FighterView;
  private chars = 0;
  private body: string;
  private opts: DrawOpts = { flat: null, rimA: C.cyan, rimB: C.magenta, glow: true, t: 0, energy: 0 };

  constructor(private kind: 'intro' | 'ending', private charId: string) {
    super();
    const c = getChar(charId);
    this.view = new FighterView(charId, app().arcade?.palette ?? 0);
    this.view.facing = 1;
    this.body = kind === 'intro' ? c.arcade.intro : c.arcade.ending;
  }

  enter(): void {
    app().audio.music(this.kind === 'intro' ? 'select' : 'victory');
  }

  update(): void {
    this.view.animateMenu(this.kind === 'ending' ? 'win' : 'idle', this.time);
    this.chars = Math.min(this.body.length, this.chars + 1.2);
    for (const e of app().input.menuEvents()) {
      if (e.k === 'confirm' || e.k === 'start' || e.k === 'back') {
        if (this.chars < this.body.length) { this.chars = this.body.length; continue; }
        app().sfx('ui_confirm');
        if (this.kind === 'intro') flow.arcadeNextFight();
        else { app().arcade = null; flow.toCredits(); }
        return;
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const c = getChar(this.charId);
    drawMenuBg(ctx, this.time, c.themeColor, c.kanji[0]);
    const k = ease.outCubic(clamp01(this.frames / 40));
    ctx.save();
    ctx.globalAlpha = k;
    this.opts.rimA = c.themeColor; this.opts.t = this.time;
    this.view.drawPortrait(ctx, 300, 700, 2.1 / c.body.scale, 1, this.opts);
    ctx.restore();
    const title = this.kind === 'intro' ? `${c.name}` : t('arcade.clear');
    drawStrokeText(ctx, title, 620, 110, { size: 50, color: this.kind === 'intro' ? c.themeColor : C.gold, align: 'left', tracking: 1, alpha: k });
    text(ctx, this.kind === 'intro' ? `${c.epithet.toUpperCase()}  ·  ${c.archetype.toUpperCase()}` : t('story.ending', c.name), 622, 196, { size: 14, weight: 800, font: 'display', tracking: 5, color: C.white, alpha: k });
    ctx.fillStyle = rgba(c.themeColor, 0.5 * k);
    ctx.fillRect(622, 212, 560, 1);
    const shown = this.body.slice(0, Math.floor(this.chars));
    const lines = wrap(ctx, shown, 560, { size: 19, weight: 500 });
    lines.forEach((ln, i) => text(ctx, ln, 622, 260 + i * 32, { size: 19, weight: 500, color: C.text }));
    if (this.chars >= this.body.length && Math.floor(this.time * 2) % 2 === 0) {
      text(ctx, t('story.continue'), 1180, H - 70, { size: 13, weight: 800, font: 'display', tracking: 3, align: 'right', color: c.themeColor });
    }
    if (this.kind === 'intro') {
      const ar = app().arcade;
      if (ar) {
        ar.ladder.forEach((id, i) => {
          const ch = getChar(id);
          const x = 640 + i * 140, y = 560;
          ctx.fillStyle = 'rgba(6,8,22,0.8)';
          ctx.fillRect(x, y, 128, 60);
          ctx.strokeStyle = i === ar.ladder.length - 1 ? C.gold : rgba(ch.themeColor, 0.6);
          ctx.strokeRect(x + 0.5, y + 0.5, 127, 59);
          text(ctx, `${t('arcade.stage')} ${i + 1}`, x + 10, y + 20, { size: 10, weight: 800, font: 'display', tracking: 2, color: C.dim });
          text(ctx, ch.name, x + 10, y + 45, { size: 17, weight: 800, font: 'display', italic: true, color: i === ar.ladder.length - 1 ? C.gold : C.white });
        });
      }
    }
    void W;
  }
}
