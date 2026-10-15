/**
 * Character select: animated portrait cards, 1P/2P (or CPU) cursors, live full-body previews,
 * archetype + stat bars, palette choice, and CPU difficulty selection where relevant.
 */
import { app, type MatchSetup } from '../core/app';
import { settings } from '../core/settings';
import { H, W } from '../core/view';
import { CHARACTER_LIST } from '../data/characters';
import type { DrawOpts } from '../render/bodyDraw';
import { FighterView } from '../render/fighterView';
import { chamferPath, panel, text, wrap } from '../ui/draw';
import { t, type StringKey } from '../ui/strings';
import { drawStrokeText } from '../ui/strokeFont';
import { C, PLAYER_COLORS, clamp01, ease, rgba } from '../ui/theme';
import * as flow from './flow';
import { drawFrame, drawMenuBg } from './menuBg';
import { Scene } from './scene';

export type SelectMode = 'arcade' | 'versus' | 'cpu' | 'training' | 'trials';

interface Side {
  cursor: number;
  locked: boolean;
  palette: number;
  human: boolean;
  lockT: number;
  moveT: number;
  view: FighterView;
  viewChar: number;
}

const STAT_KEYS: [keyof (typeof CHARACTER_LIST)[number]['stats'], StringKey][] = [
  ['power', 'select.stats.power'], ['speed', 'select.stats.speed'], ['range', 'select.stats.range'],
  ['defense', 'select.stats.defense'], ['difficulty', 'select.stats.difficulty'],
];

export class CharSelectScene extends Scene {
  readonly id = 'CharSelectScene';
  private sides: [Side, Side];
  private phase: 'pick' | 'pick2' | 'difficulty' | 'done' = 'pick';
  private difficulty = settings.difficulty;
  private doneT = 0;
  private cardViews: FighterView[];
  private opts: DrawOpts = { flat: null, rimA: C.cyan, rimB: C.magenta, glow: true, t: 0, energy: 0 };

  constructor(private mode: SelectMode) {
    super();
    const mk = (i: number, human: boolean): Side => {
      const v = new FighterView(CHARACTER_LIST[i % CHARACTER_LIST.length].id, 0);
      return { cursor: i % CHARACTER_LIST.length, locked: false, palette: 0, human, lockT: 0, moveT: 0, view: v, viewChar: i % CHARACTER_LIST.length };
    };
    this.sides = [mk(0, true), mk(1, mode === 'versus')];
    this.cardViews = CHARACTER_LIST.map((c) => new FighterView(c.id, 0));
  }

  enter(): void {
    app().audio.music('select');
    app().input.singlePlayer = this.mode !== 'versus';
  }

  exit(): void {
    app().input.singlePlayer = true;
  }

  private get twoSided(): boolean { return this.mode !== 'trials' && this.mode !== 'arcade'; }

  private sideColor(i: number): string {
    return (settings.colorblind ? PLAYER_COLORS.colorblind : PLAYER_COLORS.normal)[i];
  }

  /** Which side the given menu event controls right now. */
  private sideFor(player: number): number {
    if (this.mode === 'versus') return player;
    return this.phase === 'pick2' ? 1 : 0;
  }

  update(): void {
    const a = app();
    for (const s of this.sides) {
      s.lockT = s.locked ? s.lockT + 1 : 0;
      s.moveT++;
      if (s.viewChar !== s.cursor || s.view.pal !== CHARACTER_LIST[s.cursor].palettes[s.palette]) {
        s.view = new FighterView(CHARACTER_LIST[s.cursor].id, s.palette);
        s.viewChar = s.cursor;
      }
      s.view.facing = s === this.sides[0] ? 1 : -1;
      s.view.animateMenu(s.locked && s.lockT < 90 ? 'win' : 'idle', this.time);
    }
    this.cardViews.forEach((v) => v.animateMenu('idle', this.time));
    if (this.phase === 'done') {
      this.doneT++;
      if (this.doneT === 40) this.proceed();
      return;
    }
    const evs = a.input.menuEventsTagged();
    for (const e of evs) {
      if (this.phase === 'difficulty') {
        if (e.k === 'left' || e.k === 'up') { this.difficulty = Math.max(0, this.difficulty - 1); a.sfx('ui_move'); }
        if (e.k === 'right' || e.k === 'down') { this.difficulty = Math.min(3, this.difficulty + 1); a.sfx('ui_move'); }
        if (e.k === 'confirm' || e.k === 'start') { a.sfx('ui_confirm'); this.phase = 'done'; }
        if (e.k === 'back') { a.sfx('ui_back'); this.unlockLast(); }
        continue;
      }
      const si = this.sideFor(e.p);
      const s = this.sides[si];
      if (e.k === 'back') {
        a.sfx('ui_back');
        if (s.locked) { s.locked = false; continue; }
        if (this.phase === 'pick2') { this.phase = 'pick'; this.sides[0].locked = false; continue; }
        if (this.mode === 'versus' && si === 1 && this.sides[0].locked) { this.sides[0].locked = false; continue; }
        flow.toModeSelect();
        return;
      }
      if (s.locked) continue;
      if (e.k === 'left' || e.k === 'right') {
        const n = CHARACTER_LIST.length;
        s.cursor = (s.cursor + (e.k === 'left' ? n - 1 : 1)) % n;
        s.moveT = 0;
        a.sfx('ui_move', { pan: si === 0 ? -0.4 : 0.4 });
      }
      if (e.k === 'up' || e.k === 'down') { s.palette = 1 - s.palette; a.sfx('ui_slide'); }
      if (e.k === 'confirm' || e.k === 'start') this.lock(si);
    }
    // pointer: click a card to select / lock for the active side
    const p = a.input.pointer;
    if (p.clicked || p.moved) {
      for (let i = 0; i < CHARACTER_LIST.length; i++) {
        const r = this.cardRect(i);
        if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
          const si = this.mode === 'versus' ? 0 : this.sideFor(0);
          const s = this.sides[si];
          if (s.locked) break;
          if (s.cursor !== i) { s.cursor = i; s.moveT = 0; a.sfx('ui_move'); }
          if (p.clicked) { a.input.takeClick(); this.lock(si); }
        }
      }
    }
  }

  private unlockLast(): void {
    this.phase = this.twoSided && this.mode !== 'versus' ? 'pick2' : 'pick';
    if (this.mode === 'arcade' || this.mode === 'trials') { this.phase = 'pick'; this.sides[0].locked = false; }
    else this.sides[1].locked = false;
  }

  private lock(si: number): void {
    const a = app();
    const s = this.sides[si];
    // mirror match palette clash
    const o = this.sides[1 - si];
    if (o.locked && o.cursor === s.cursor && o.palette === s.palette) s.palette = 1 - s.palette;
    s.locked = true;
    s.lockT = 0;
    a.sfx('ui_select_char', { pan: si === 0 ? -0.5 : 0.5 });
    if (this.mode === 'versus') {
      if (this.sides[0].locked && this.sides[1].locked) this.phase = 'done';
      return;
    }
    if (this.mode === 'trials') { this.phase = 'done'; return; }
    if (this.mode === 'arcade') { this.phase = 'difficulty'; return; }
    if (this.phase === 'pick') { this.phase = 'pick2'; this.sides[1].cursor = (this.sides[0].cursor + 1) % CHARACTER_LIST.length; return; }
    if (this.phase === 'pick2') this.phase = this.mode === 'cpu' ? 'difficulty' : 'done';
  }

  private proceed(): void {
    const [a, b] = this.sides;
    const c0 = CHARACTER_LIST[a.cursor].id, c1 = CHARACTER_LIST[b.cursor].id;
    if (this.mode === 'arcade') { flow.startArcade(c0, a.palette, this.difficulty); return; }
    if (this.mode === 'trials') {
      flow.startMatch({ mode: 'trials', chars: [c0, c0 === 'magnus' ? 'hayate' : 'magnus'], palettes: [a.palette, 0], stage: 'pit', cpu: [false, false], difficulty: 1, trialIndex: 0 });
      return;
    }
    const setup: MatchSetup = {
      mode: this.mode, chars: [c0, c1], palettes: [a.palette, c0 === c1 && a.palette === b.palette ? 1 - b.palette : b.palette],
      stage: 'rooftop', cpu: [false, this.mode === 'cpu'], difficulty: this.difficulty,
    };
    flow.toStageSelect(setup);
  }

  private cardRect(i: number): { x: number; y: number; w: number; h: number } {
    const w = 138, h = 166, gap = 14;
    const n = CHARACTER_LIST.length;
    const x0 = W / 2 - (n * w + (n - 1) * gap) / 2;
    return { x: x0 + i * (w + gap), y: 482, w, h };
  }

  render(ctx: CanvasRenderingContext2D): void {
    const [s0, s1] = this.sides;
    const c0 = CHARACTER_LIST[s0.cursor];
    drawMenuBg(ctx, this.time, c0.themeColor, c0.kanji[0]);
    // split diagonal tint
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const gl = ctx.createLinearGradient(0, 0, W * 0.45, 0);
    gl.addColorStop(0, rgba(c0.themeColor, 0.14));
    gl.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(0, 0, W / 2, H);
    if (this.twoSided) {
      const c1 = CHARACTER_LIST[s1.cursor];
      const gr = ctx.createLinearGradient(W, 0, W * 0.55, 0);
      gr.addColorStop(0, rgba(c1.themeColor, 0.14));
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(W / 2, 0, W / 2, H);
    }
    ctx.restore();
    drawFrame(ctx, this.time, c0.themeColor, t('select.title'), t(`mode.${this.mode === 'cpu' ? 'cpu' : this.mode}` as StringKey));
    this.drawPreview(ctx, 0);
    if (this.twoSided) this.drawPreview(ctx, 1);
    else this.drawArcadeSide(ctx);
    this.drawCards(ctx);
    if (this.phase === 'difficulty') this.drawDifficulty(ctx);
    const hint = this.mode === 'versus' ? t('select.hint.versus')
      : this.phase === 'pick2' ? (this.mode === 'training' ? t('select.dummy') : t('select.opponent')) : t('select.hint');
    text(ctx, hint, W / 2, H - 52, { size: 12, weight: 700, font: 'display', tracking: 2, align: 'center', color: this.phase === 'pick2' ? C.amber : C.dim });
    if (this.phase === 'done') {
      const k = clamp01(this.doneT / 40);
      ctx.fillStyle = `rgba(255,255,255,${0.25 * (1 - k)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  private drawPreview(ctx: CanvasRenderingContext2D, i: number): void {
    const s = this.sides[i];
    const ch = CHARACTER_LIST[s.cursor];
    const left = i === 0;
    const col = this.sideColor(i);
    const enter = ease.outCubic(clamp01(s.moveT / 14));
    const baseX = left ? 420 : W - 420;
    const x = baseX + (1 - enter) * (left ? -60 : 60);
    // floor glow + platform
    ctx.save();
    ctx.globalAlpha = enter;
    const g = ctx.createRadialGradient(x, 455, 5, x, 455, 220);
    g.addColorStop(0, rgba(ch.themeColor, 0.35));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 240, 300, 480, 220);
    ctx.strokeStyle = rgba(ch.themeColor, 0.7);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, 458, 120, 16, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    // fighter
    this.opts.rimA = ch.themeColor; this.opts.rimB = col; this.opts.t = this.time; this.opts.energy = s.locked ? 1 : 0;
    ctx.save();
    ctx.globalAlpha = enter;
    s.view.drawPortrait(ctx, x, 458, 1.32 / ch.body.scale, left ? 1 : -1, this.opts);
    if (s.locked && s.lockT < 12) {
      ctx.globalCompositeOperation = 'lighter';
      const fo: DrawOpts = { ...this.opts, flat: rgba('#ffffff', 0.6 * (1 - s.lockT / 12)) };
      s.view.drawPortrait(ctx, x, 458, 1.32 / ch.body.scale, left ? 1 : -1, fo);
    }
    ctx.restore();
    // info
    const ix = left ? 36 : W - 36;
    const al = left ? 'left' : 'right';
    text(ctx, i === 0 ? t('select.p1') : this.sides[1].human ? t('select.p2') : t('select.cpu'), ix, 98, { size: 14, weight: 800, font: 'display', tracking: 4, color: col, align: al });
    drawStrokeText(ctx, ch.name, ix, 110, { size: 40, color: ch.themeColor, align: al, tracking: 0.9, alpha: enter });
    text(ctx, `${ch.kanji}  ·  ${ch.epithet.toUpperCase()}`, ix, 186, { size: 14, weight: 700, font: 'display', tracking: 3, color: C.white, align: al, alpha: enter });
    text(ctx, ch.archetype.toUpperCase(), ix, 208, { size: 12, weight: 800, font: 'display', tracking: 3, color: ch.themeColor, align: al, alpha: enter });
    // stats
    STAT_KEYS.forEach(([k, label], j) => {
      const y = 236 + j * 20;
      const v = ch.stats[k];
      const barX = left ? ix + 100 : ix - 110;
      text(ctx, t(label), left ? ix : ix - 118, y + 4, { size: 10, weight: 800, font: 'display', tracking: 2, color: C.dim, align: al });
      for (let b = 0; b < 5; b++) {
        const px = barX + b * 22;
        const on = left ? b < v : b >= 5 - v;
        ctx.fillStyle = on ? rgba(ch.themeColor, 0.95) : 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.moveTo(px + 4, y - 4); ctx.lineTo(px + 20, y - 4); ctx.lineTo(px + 16, y + 4); ctx.lineTo(px, y + 4);
        ctx.fill();
      }
    });
    const lines = wrap(ctx, ch.description, 250, { size: 12 });
    lines.slice(0, 4).forEach((ln, j) => text(ctx, ln, ix, 352 + j * 16, { size: 12, weight: 500, color: rgba(C.text, 0.85), align: al, alpha: enter }));
    // palette chip
    const py = 430;
    text(ctx, `${t('select.color')}: ${ch.palettes[s.palette].name.toUpperCase()}`, ix, py, { size: 11, weight: 800, font: 'display', tracking: 2, color: C.dim, align: al });
    if (s.locked) {
      const k = ease.outBack(clamp01(s.lockT / 12));
      ctx.save();
      ctx.translate(x, 300);
      ctx.scale(k, k);
      drawStrokeText(ctx, t('select.ready'), 0, -20, { size: 36, color: col, style: 'neon', align: 'center', tracking: 1.2 });
      ctx.restore();
    }
  }

  private drawArcadeSide(ctx: CanvasRenderingContext2D): void {
    const x = W - 250;
    const title = this.mode === 'trials' ? t('mode.trials') : t('mode.arcade');
    panel(ctx, x - 190, 120, 380, 300, { fill: 'rgba(6,8,22,0.75)', edge: rgba(C.magenta, 0.4), cut: 14 });
    drawStrokeText(ctx, title, x, 144, { size: 28, color: C.magenta, align: 'center', tracking: 1 });
    const desc = this.mode === 'trials' ? t('mode.trials.d') : t('mode.arcade.d');
    wrap(ctx, desc, 320, { size: 14 }).forEach((ln, j) => text(ctx, ln, x, 214 + j * 20, { size: 14, weight: 500, align: 'center', color: C.text }));
    if (this.mode === 'arcade') {
      // ladder silhouettes
      for (let i = 0; i < 4; i++) {
        const cx = x - 120 + i * 80;
        chamferPath(ctx, cx - 30, 290, 60, 90, 8);
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fill();
        ctx.strokeStyle = i === 3 ? C.gold : rgba(C.magenta, 0.5);
        ctx.lineWidth = 1;
        ctx.stroke();
        text(ctx, i === 3 ? '★' : '?', cx, 346, { size: 28, weight: 800, align: 'center', color: i === 3 ? C.gold : C.dim });
        text(ctx, `${t('arcade.stage')} ${i + 1}`, cx, 398, { size: 9, weight: 800, font: 'display', tracking: 1, align: 'center', color: C.dim });
      }
    }
  }

  private drawCards(ctx: CanvasRenderingContext2D): void {
    CHARACTER_LIST.forEach((ch, i) => {
      const r = this.cardRect(i);
      const intro = ease.outBack(clamp01(this.frames / 20 - i * 0.12));
      const yo = (1 - intro) * 80;
      ctx.save();
      ctx.globalAlpha = clamp01(intro);
      chamferPath(ctx, r.x, r.y + yo, r.w, r.h, 14);
      const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
      g.addColorStop(0, rgba(ch.themeColor, 0.32));
      g.addColorStop(1, 'rgba(6,6,18,0.95)');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.save();
      ctx.clip();
      const v = this.cardViews[i];
      this.opts.rimA = ch.themeColor; this.opts.t = this.time; this.opts.energy = 0;
      v.facing = 1;
      const head = v.skel.head;
      const sc = 1.25;
      v.drawPortrait(ctx, r.x + r.w / 2 - head.x * sc, r.y + yo + 70 + head.y * sc, sc, 1, this.opts);
      // name strip
      ctx.fillStyle = 'rgba(3,4,12,0.85)';
      ctx.fillRect(r.x, r.y + yo + r.h - 34, r.w, 34);
      ctx.restore();
      text(ctx, ch.name, r.x + r.w / 2, r.y + yo + r.h - 11, { size: 16, weight: 800, font: 'display', tracking: 2, align: 'center', color: C.white, italic: true });
      ctx.strokeStyle = rgba(ch.themeColor, 0.5);
      ctx.lineWidth = 1;
      chamferPath(ctx, r.x, r.y + yo, r.w, r.h, 14);
      ctx.stroke();
      ctx.restore();
    });
    // cursors
    for (let si = 0; si < 2; si++) {
      if (si === 1 && !this.twoSided) continue;
      if (si === 1 && this.mode !== 'versus' && this.phase === 'pick') continue;
      const s = this.sides[si];
      const r = this.cardRect(s.cursor);
      const col = this.sideColor(si);
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 8);
      const both = this.twoSided && this.sides[0].cursor === this.sides[1].cursor && (this.mode === 'versus' || this.phase !== 'pick');
      const inset = both && si === 1 ? 6 : 0;
      ctx.save();
      chamferPath(ctx, r.x - 4 + inset, r.y - 4 + inset, r.w + 8 - inset * 2, r.h + 8 - inset * 2, 16);
      ctx.strokeStyle = col;
      ctx.lineWidth = s.locked ? 4 : 2.5;
      ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(col, 0.2 + pulse * 0.2);
      ctx.lineWidth = 10;
      ctx.stroke();
      ctx.restore();
      const tagX = si === 0 ? r.x + 6 : r.x + r.w - 6;
      ctx.fillStyle = col;
      ctx.beginPath();
      if (si === 0) { ctx.moveTo(tagX - 10, r.y - 22); ctx.lineTo(tagX + 40, r.y - 22); ctx.lineTo(tagX + 32, r.y - 6); ctx.lineTo(tagX - 10, r.y - 6); }
      else { ctx.moveTo(tagX + 10, r.y - 22); ctx.lineTo(tagX - 40, r.y - 22); ctx.lineTo(tagX - 32, r.y - 6); ctx.lineTo(tagX + 10, r.y - 6); }
      ctx.fill();
      const lbl = si === 0 ? '1P' : this.sides[1].human ? '2P' : this.mode === 'training' ? t('select.dummyTag') : t('select.cpu');
      text(ctx, lbl, si === 0 ? tagX + 12 : tagX - 12, r.y - 9, { size: 12, weight: 900, font: 'display', align: 'center', color: '#05060f', tracking: 1 });
    }
  }

  private drawDifficulty(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(2,3,10,0.6)';
    ctx.fillRect(0, 0, W, H);
    panel(ctx, W / 2 - 260, 240, 520, 200, { fill: 'rgba(8,10,28,0.96)', edge: C.magenta, glow: 1, cut: 16 });
    drawStrokeText(ctx, t('select.difficulty'), W / 2, 262, { size: 26, color: C.magenta, align: 'center', tracking: 1 });
    for (let i = 0; i < 4; i++) {
      const x = W / 2 - 225 + i * 115;
      const sel = i === this.difficulty;
      chamferPath(ctx, x, 330, 105, 52, 10);
      ctx.fillStyle = sel ? rgba(C.magenta, 0.35) : 'rgba(255,255,255,0.05)';
      ctx.fill();
      ctx.strokeStyle = sel ? C.magenta : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = sel ? 2 : 1;
      ctx.stroke();
      text(ctx, t(`diff.${i}` as StringKey), x + 52, 362, { size: 15, weight: 800, font: 'display', tracking: 2, align: 'center', color: sel ? C.white : C.dim });
    }
    text(ctx, t('hint.difficulty'), W / 2, 420, { size: 12, weight: 700, font: 'display', tracking: 2, align: 'center', color: C.dim });
  }
}
