/**
 * Main menu: big animated list on the left, rotating fighter showcase on the right.
 */
import { app } from '../core/app';
import { H, W } from '../core/view';
import { CHARACTER_LIST } from '../data/characters';
import type { DrawOpts } from '../render/bodyDraw';
import { FighterView } from '../render/fighterView';
import { panel, text } from '../ui/draw';
import { MenuList } from '../ui/menu';
import { t, type StringKey } from '../ui/strings';
import { drawStrokeText } from '../ui/strokeFont';
import { C, clamp01, ease, rgba } from '../ui/theme';
import * as flow from './flow';
import { drawFrame, drawMenuBg } from './menuBg';
import { Scene } from './scene';

export class MainMenuScene extends Scene {
  readonly id = 'MainMenuScene';
  private list: MenuList;
  private views: FighterView[];
  private show = 0;
  private showT = 0;
  private msg = '';
  private msgT = 0;
  private opts: DrawOpts = { flat: null, rimA: C.cyan, rimB: C.magenta, glow: true, t: 0, energy: 0 };

  constructor() {
    super();
    const item = (id: string, key: StringKey, desc: StringKey, fn: () => void) => ({ id, label: t(key), desc: t(desc), onSelect: fn });
    this.list = new MenuList([
      item('play', 'menu.play', 'menu.play.d', () => flow.toModeSelect()),
      item('replay', 'menu.replay', 'menu.replay.d', () => {
        if (app().lastReplay) flow.startReplay();
        else { this.msg = t('menu.replay.none'); this.msgT = 150; app().sfx('ui_error'); }
      }),
      item('moves', 'menu.movelist', 'menu.movelist.d', () => flow.toMoveList()),
      item('settings', 'menu.settings', 'menu.settings.d', () => flow.toSettings()),
      item('credits', 'menu.credits', 'menu.credits.d', () => flow.toCredits()),
    ], { x: 96, y: 250, w: 380, itemH: 64, size: 36, accent: C.cyan });
    this.list.onBack = () => flow.toTitle();
    this.views = CHARACTER_LIST.map((c, i) => {
      const v = new FighterView(c.id, i % 2);
      v.facing = -1;
      return v;
    });
  }

  enter(): void {
    app().audio.music('menu');
    app().audio.ambience('rain');
    app().input.singlePlayer = true;
  }

  update(): void {
    this.list.update(app().input.menuEvents());
    this.showT++;
    if (this.showT > 360) { this.showT = 0; this.show = (this.show + 1) % this.views.length; }
    for (const v of this.views) v.animateMenu('idle', this.time);
    if (this.msgT > 0) this.msgT--;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const ch = CHARACTER_LIST[this.show];
    drawMenuBg(ctx, this.time, ch.themeColor, ch.kanji[0]);
    // showcase fighter
    const sw = ease.outCubic(clamp01(this.showT / 30));
    const out = clamp01((this.showT - 330) / 30);
    const v = this.views[this.show];
    ctx.save();
    ctx.globalAlpha = sw * (1 - out);
    const gx = 790 + (1 - sw) * 120 - out * 120;
    const glow = ctx.createRadialGradient(gx, 470, 10, gx, 470, 340);
    glow.addColorStop(0, rgba(ch.themeColor, 0.22));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(gx - 400, 100, 800, 620);
    this.opts.rimA = ch.themeColor; this.opts.t = this.time;
    v.drawPortrait(ctx, gx, 680, 1.9 / ch.body.scale, -1, this.opts);
    ctx.restore();
    // showcase caption
    drawStrokeText(ctx, ch.name, 1230, 520, { size: 46, color: ch.themeColor, align: 'right', tracking: 1, alpha: sw * (1 - out) });
    text(ctx, ch.epithet.toUpperCase(), 1230, 598, { size: 14, weight: 700, font: 'display', tracking: 6, align: 'right', color: C.white, alpha: sw * (1 - out) });
    drawFrame(ctx, this.time, C.cyan, 'NEON TEMPEST', 'MAIN MENU');
    const intro = clamp01(this.frames / 30);
    this.list.render(ctx, 1, intro);
    // description
    const d = this.list.current.desc;
    panel(ctx, 70, 600, 520, 54, { fill: 'rgba(6,8,22,0.7)', edge: rgba(C.cyan, 0.35), cut: 10 });
    text(ctx, this.msgT > 0 ? this.msg : (typeof d === 'function' ? d() : d ?? ''), 90, 633, { size: 15, weight: 500, color: this.msgT > 0 ? C.amber : C.text });
    text(ctx, t('hint.menu'), 40, H - 52, { size: 11, weight: 700, font: 'display', tracking: 2, color: C.dim });
    void W;
  }
}
