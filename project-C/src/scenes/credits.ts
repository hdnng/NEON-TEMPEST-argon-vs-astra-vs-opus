/**
 * Credits roll.
 */
import { app } from '../core/app';
import { H, W } from '../core/view';
import { text } from '../ui/draw';
import { t } from '../ui/strings';
import { drawStrokeText } from '../ui/strokeFont';
import { C } from '../ui/theme';
import * as flow from './flow';
import { drawMenuBg } from './menuBg';
import { Scene } from './scene';

const LINES = (): [string, string][] => [
  ['h', 'NEON TEMPEST'],
  ['s', t('credits.tagline')],
  ['', ''],
  ['h', t('credits.design')],
  ['n', 'NULLSTATE'],
  ['', ''],
  ['h', t('credits.art')],
  ['n', t('credits.art1')],
  ['n', t('credits.art2')],
  ['', ''],
  ['h', t('credits.audio')],
  ['n', t('credits.audio1')],
  ['', ''],
  ['h', t('credits.fighters')],
  ['n', 'HAYATE  ·  MAGNUS  ·  SABLE  ·  WARDEN'],
  ['', ''],
  ['h', t('credits.tech')],
  ['n', t('credits.tech1')],
  ['n', t('credits.tech2')],
  ['', ''],
  ['h', t('credits.thanks')],
];

export class CreditsScene extends Scene {
  readonly id = 'CreditsScene';
  enter(): void { app().audio.music('results'); }

  update(): void {
    if (app().input.menuEvents().some((e) => e.k === 'back' || e.k === 'confirm' || e.k === 'start' || e.k === 'pause') || this.frames > 60 * 34) {
      app().sfx('ui_back');
      flow.toMainMenu();
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    drawMenuBg(ctx, this.time, C.violet, '謝');
    let y = H + 40 - this.frames * 0.8;
    for (const [kind, s] of LINES()) {
      if (kind === 'h' && s === 'NEON TEMPEST') drawStrokeText(ctx, s, W / 2, y - 40, { size: 54, color: C.magenta, align: 'center', tracking: 1.4 });
      else if (kind === 'h') text(ctx, s, W / 2, y, { size: 15, weight: 800, font: 'display', tracking: 6, align: 'center', color: C.cyan });
      else if (kind === 'n') text(ctx, s, W / 2, y, { size: 20, weight: 600, align: 'center', color: C.white });
      else if (kind === 's') text(ctx, s, W / 2, y + 10, { size: 15, weight: 500, italic: true, align: 'center', color: C.dim });
      y += kind === 'h' ? 40 : 38;
    }
    text(ctx, t('common.back'), W - 40, H - 22, { size: 11, weight: 700, font: 'display', tracking: 3, align: 'right', color: C.dim });
  }
}
