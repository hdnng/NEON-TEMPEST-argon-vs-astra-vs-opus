/**
 * Results screen: winner showcase with quote, per-round results, match statistics for both
 * fighters, and next-step menu (rematch / next fight / continue / replay / select / menu).
 */
import { app } from '../core/app';
import { H, W } from '../core/view';
import type { DrawOpts } from '../render/bodyDraw';
import { FighterView } from '../render/fighterView';
import { getChar } from '../sim/registry';
import type { FighterStats } from '../sim/types';
import { chamferPath, panel, text } from '../ui/draw';
import { MenuList, type MenuItem } from '../ui/menu';
import { t, type StringKey } from '../ui/strings';
import { drawStrokeText } from '../ui/strokeFont';
import { C, clamp01, ease, rgba } from '../ui/theme';
import * as flow from './flow';
import type { MatchScene } from './match/matchScene';
import { drawMenuBg } from './menuBg';
import { Scene } from './scene';

export class ResultsScene extends Scene {
  readonly id = 'ResultsScene';
  private list: MenuList;
  private view: FighterView;
  private winner: number;
  private quote: string;
  private opts: DrawOpts = { flat: null, rimA: C.cyan, rimB: C.magenta, glow: true, t: 0, energy: 0 };
  private stats: FighterStats[];
  private names: string[];
  private chars: string[];
  private frames0: number;
  private results: { winner: number; kind: string }[];

  constructor(private m: MatchScene) {
    super();
    const s = m.s;
    this.winner = s.matchWinner;
    const wc = this.winner >= 0 ? s.fighters[this.winner].char : s.fighters[0].char;
    this.view = new FighterView(wc, this.winner >= 0 ? s.fighters[this.winner].palette : 0);
    this.view.facing = 1;
    const q = getChar(wc).quotes.win;
    this.quote = q[Math.floor(Math.random() * q.length)];
    this.stats = s.fighters.map((f) => ({ ...f.stats }));
    this.names = s.fighters.map((f) => getChar(f.char).name);
    this.chars = s.fighters.map((f) => f.char);
    this.frames0 = s.frame;
    this.results = s.results.map((r) => ({ ...r }));
    this.list = new MenuList(this.items(), { x: 820, y: 520, w: 380, itemH: 40, size: 20, accent: C.cyan });
  }

  private items(): MenuItem[] {
    const m = this.m;
    const mode = m.setup.mode;
    const items: MenuItem[] = [];
    if (mode === 'arcade') {
      const won = this.winner === 0;
      const ar = app().arcade;
      if (won && ar) items.push({ id: 'next', label: t('results.next'), onSelect: () => { ar.index++; flow.arcadeNextFight(); } });
      if (!won && ar) items.push({ id: 'cont', label: t('results.continue'), onSelect: () => { ar.continues++; flow.arcadeNextFight(); } });
    } else {
      items.push({ id: 'rematch', label: t('results.rematch'), onSelect: () => flow.toVersus({ ...m.setup }) });
    }
    items.push({ id: 'replay', label: t('results.replay'), onSelect: () => flow.startReplay() });
    if (mode !== 'arcade') items.push({ id: 'char', label: t('results.charselect'), onSelect: () => flow.toCharSelect(mode === 'versus' ? 'versus' : 'cpu') });
    items.push({ id: 'menu', label: t('results.menu'), onSelect: () => flow.toMainMenu() });
    return items;
  }

  enter(): void {
    app().audio.music('results', 2);
    app().input.singlePlayer = true;
  }

  update(): void {
    this.view.animateMenu(this.frames < 120 ? 'win' : 'idle', this.time);
    if (this.frames > 30) this.list.update(app().input.menuEvents());
    else app().input.menuEvents();
  }

  render(ctx: CanvasRenderingContext2D): void {
    const s = this.m.s;
    const wc = this.winner >= 0 ? getChar(this.chars[this.winner]) : null;
    const accent = wc?.themeColor ?? C.white;
    drawMenuBg(ctx, this.time, accent, wc?.kanji[0] ?? '引');
    const k = ease.outCubic(clamp01(this.frames / 30));
    // winner render
    ctx.save();
    ctx.globalAlpha = k;
    const g = ctx.createRadialGradient(330, 470, 10, 330, 470, 330);
    g.addColorStop(0, rgba(accent, 0.3));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 100, 700, 620);
    this.opts.rimA = accent; this.opts.t = this.time;
    this.view.drawPortrait(ctx, 330 - (1 - k) * 80, 690, 1.95 / (wc?.body.scale ?? 1), 1, this.opts);
    ctx.restore();
    // title
    const title = this.winner >= 0 ? `${this.names[this.winner]} ${t('ann.wins')}` : t('ann.draw');
    drawStrokeText(ctx, title, 60, 60, {
      size: 50, color: accent, align: 'left', tracking: 1, weight: 1.3,
      letter: (i) => { const kk = clamp01((this.frames - i * 2) / 12); return [(1 - ease.outExpo(kk)) * -80, 0, 1, kk]; },
    });
    if (this.winner >= 0) {
      text(ctx, `"${this.quote}"`, 62, 152, { size: 18, weight: 500, italic: true, color: C.text, alpha: clamp01((this.frames - 20) / 20), maxWidth: 640 });
    }
    // stats panel
    const px = 760, py = 90;
    panel(ctx, px, py, 480, 400, { fill: 'rgba(6,8,22,0.88)', edge: rgba(accent, 0.6), glow: 1, cut: 16, alpha: k });
    text(ctx, t('results.report'), px + 24, py + 36, { size: 14, weight: 800, font: 'display', tracking: 5, color: accent, alpha: k });
    // round results
    this.results.forEach((r, i) => {
      const x = px + 24 + i * 88;
      chamferPath(ctx, x, py + 52, 80, 40, 8);
      const col = r.winner === 0 ? C.cyan : r.winner === 1 ? C.magenta : C.dim;
      ctx.fillStyle = rgba(col, 0.2);
      ctx.fill();
      ctx.strokeStyle = col;
      ctx.lineWidth = 1;
      ctx.stroke();
      text(ctx, `R${i + 1}`, x + 8, py + 68, { size: 10, weight: 800, font: 'display', color: C.dim, alpha: k });
      const lbl = t(r.kind === 'perfect' ? 'kind.perfect' : r.kind === 'timeout' ? 'kind.time' : r.kind === 'double' ? 'kind.double' : r.kind === 'draw' ? 'kind.draw' : 'kind.ko');
      text(ctx, lbl, x + 40, py + 84, { size: 13, weight: 800, font: 'display', align: 'center', color: C.white, alpha: k });
    });
    const rows: [StringKey, keyof FighterStats][] = [
      ['results.damage', 'damage'], ['results.maxcombo', 'maxCombo'], ['results.specials', 'specials'],
      ['results.supers', 'supers'], ['results.throws', 'throws'], ['results.blocks', 'blocks'],
    ];
    text(ctx, this.names[0], px + 300, py + 128, { size: 13, weight: 800, font: 'display', tracking: 2, align: 'center', color: C.cyan, alpha: k });
    text(ctx, this.names[1], px + 410, py + 128, { size: 13, weight: 800, font: 'display', tracking: 2, align: 'center', color: C.magenta, alpha: k });
    rows.forEach(([key, field], i) => {
      const y = py + 164 + i * 34;
      const rk = clamp01((this.frames - 20 - i * 4) / 12);
      ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)';
      ctx.fillRect(px + 18, y - 22, 444, 30);
      text(ctx, t(key), px + 30, y, { size: 13, weight: 700, font: 'display', tracking: 2, color: C.dim, alpha: rk });
      const a0 = this.stats[0][field], a1 = this.stats[1][field];
      text(ctx, String(Math.round(a0 * rk)), px + 300, y, { size: 17, weight: 800, font: 'mono', align: 'center', color: a0 >= a1 ? C.white : C.dim, alpha: rk });
      text(ctx, String(Math.round(a1 * rk)), px + 410, y, { size: 17, weight: 800, font: 'mono', align: 'center', color: a1 >= a0 ? C.white : C.dim, alpha: rk });
    });
    const secs = Math.round(this.frames0 / 60);
    text(ctx, `${t('results.time')}  ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`, px + 24, py + 380, { size: 12, weight: 800, font: 'display', tracking: 3, color: C.dim, alpha: k });
    this.list.render(ctx, clamp01((this.frames - 30) / 15), clamp01((this.frames - 30) / 20));
    text(ctx, t('hint.results'), W - 40, H - 22, { size: 11, weight: 700, font: 'display', tracking: 2, align: 'right', color: C.dim });
    void s;
  }
}
