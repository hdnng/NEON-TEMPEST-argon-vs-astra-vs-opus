/**
 * Stage select: live animated preview of the highlighted stage plus selectable cards.
 */
import { app, type MatchSetup } from '../core/app';
import { H, W } from '../core/view';
import { makeCamera } from '../render/camera';
import { STAGE_INFOS, createStage } from '../render/stages/index';
import type { Stage } from '../render/stages/types';
import { settings } from '../core/settings';
import { chamferPath, text } from '../ui/draw';
import { t } from '../ui/strings';
import { drawStrokeText } from '../ui/strokeFont';
import { C, clamp01, ease, rgba } from '../ui/theme';
import * as flow from './flow';
import { drawFrame, drawMenuBg } from './menuBg';
import { Scene } from './scene';

export class StageSelectScene extends Scene {
  readonly id = 'StageSelectScene';
  private sel = 0;
  private stages: (Stage | null)[] = [];
  private cam = makeCamera();
  private chosen = false;
  private chosenT = 0;
  private selT = 0;
  private stageT = 0;

  constructor(private setup: MatchSetup) {
    super();
    const idx = STAGE_INFOS.findIndex((s) => s.id === setup.stage);
    this.sel = Math.max(0, idx);
  }

  private count(): number { return STAGE_INFOS.length + 1; }

  private stageFor(i: number): Stage | null {
    if (i >= STAGE_INFOS.length) return null;
    if (!this.stages[i]) {
      const st = createStage(STAGE_INFOS[i].id, { flashReduction: settings.flashReduction });
      st.init(Math.min(1, app().view.pixelRatio), 1);
      this.stages[i] = st;
    }
    return this.stages[i];
  }

  exit(): void {
    for (const s of this.stages) s?.dispose();
    this.stages = [];
  }

  update(): void {
    const a = app();
    this.selT++;
    this.stageT += 1 / 60;
    if (this.chosen) {
      this.chosenT++;
      if (this.chosenT === 18) {
        let id = this.sel < STAGE_INFOS.length ? STAGE_INFOS[this.sel].id : STAGE_INFOS[Math.floor(Math.random() * STAGE_INFOS.length)].id;
        if (!id) id = 'rooftop';
        const setup = { ...this.setup, stage: id };
        if (setup.mode === 'training') flow.startMatch(setup);
        else flow.toVersus(setup);
      }
      return;
    }
    for (const e of a.input.menuEvents()) {
      if (e.k === 'left' || e.k === 'up') { this.sel = (this.sel + this.count() - 1) % this.count(); this.selT = 0; a.sfx('ui_move'); }
      if (e.k === 'right' || e.k === 'down') { this.sel = (this.sel + 1) % this.count(); this.selT = 0; a.sfx('ui_move'); }
      if (e.k === 'confirm' || e.k === 'start') { this.chosen = true; a.sfx('ui_confirm'); }
      if (e.k === 'back') { a.sfx('ui_back'); flow.toCharSelect(this.setup.mode === 'versus' ? 'versus' : this.setup.mode === 'training' ? 'training' : 'cpu'); return; }
    }
    const p = a.input.pointer;
    for (let i = 0; i < this.count(); i++) {
      const r = this.cardRect(i);
      if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
        if (p.moved && i !== this.sel) { this.sel = i; this.selT = 0; a.sfx('ui_move'); }
        if (p.clicked) { a.input.takeClick(); this.sel = i; this.chosen = true; a.sfx('ui_confirm'); }
      }
    }
    // animate the preview camera
    this.cam.x = Math.sin(this.stageT * 0.25) * 380;
    this.cam.zoom = 0.95 + Math.sin(this.stageT * 0.31) * 0.05;
    const st = this.stageFor(this.sel);
    st?.update(this.stageT, this.cam);
  }

  private cardRect(i: number): { x: number; y: number; w: number; h: number } {
    const w = 270, h = 92, gap = 16;
    const n = this.count();
    const x0 = W / 2 - (n * w + (n - 1) * gap) / 2;
    return { x: x0 + i * (w + gap), y: 558, w, h };
  }

  render(ctx: CanvasRenderingContext2D): void {
    const info = STAGE_INFOS[this.sel];
    const accent = info?.accent ?? C.violet;
    drawMenuBg(ctx, this.time, accent, '舞');
    // preview window
    const px = 160, py = 92, pw = 960, ph = 440;
    const k = ease.outCubic(clamp01(this.selT / 16));
    ctx.save();
    chamferPath(ctx, px, py, pw, ph, 22);
    ctx.fillStyle = '#05060f';
    ctx.fill();
    ctx.clip();
    const st = this.stageFor(this.sel);
    if (st) {
      ctx.save();
      ctx.translate(px, py);
      ctx.scale(pw / W, ph / H);
      ctx.translate(W / 2, H / 2);
      ctx.scale(1.08 - 0.08 * k, 1.08 - 0.08 * k);
      ctx.translate(-W / 2, -H / 2);
      st.drawBack(ctx, this.cam, this.stageT);
      st.drawFront(ctx, this.cam, this.stageT);
      ctx.restore();
    } else {
      // random: cycling static
      ctx.fillStyle = '#0a0b1c';
      ctx.fillRect(px, py, pw, ph);
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = rgba(i % 2 ? C.cyan : C.magenta, 0.05 + Math.random() * 0.08);
        ctx.fillRect(px, py + Math.random() * ph, pw, 2 + Math.random() * 8);
      }
      text(ctx, '?', px + pw / 2, py + ph / 2 + 50, { size: 150, weight: 900, align: 'center', color: rgba(C.white, 0.6), font: 'display' });
    }
    // caption gradient
    const g = ctx.createLinearGradient(0, py + ph - 150, 0, py + ph);
    g.addColorStop(0, 'rgba(3,4,12,0)');
    g.addColorStop(1, 'rgba(3,4,12,0.92)');
    ctx.fillStyle = g;
    ctx.fillRect(px, py + ph - 150, pw, 150);
    ctx.restore();
    chamferPath(ctx, px, py, pw, ph, 22);
    ctx.strokeStyle = rgba(accent, 0.8);
    ctx.lineWidth = 2;
    ctx.stroke();
    const name = info ? info.name : t('stage.random');
    drawStrokeText(ctx, name, px + 34, py + ph - 108 + (1 - k) * 20, { size: 40, color: accent, align: 'left', tracking: 1, alpha: k });
    if (info) {
      text(ctx, info.location.toUpperCase(), px + 36, py + ph - 42, { size: 14, weight: 800, font: 'display', tracking: 4, color: C.white, alpha: k });
      text(ctx, info.description, px + 36, py + ph - 18, { size: 13, weight: 500, color: C.dim, alpha: k, maxWidth: pw - 70 });
    }
    drawFrame(ctx, this.time, accent, t('stage.title'), `${this.setup.chars[0].toUpperCase()}  VS  ${this.setup.chars[1].toUpperCase()}`);
    for (let i = 0; i < this.count(); i++) {
      const r = this.cardRect(i);
      const si = STAGE_INFOS[i];
      const sel = i === this.sel;
      chamferPath(ctx, r.x, r.y, r.w, r.h, 12);
      ctx.fillStyle = sel ? rgba(si?.accent ?? C.violet, 0.3) : 'rgba(8,10,26,0.85)';
      ctx.fill();
      ctx.strokeStyle = sel ? si?.accent ?? C.violet : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = sel ? 2 : 1;
      ctx.stroke();
      text(ctx, si ? si.name : t('stage.random'), r.x + 18, r.y + 40, { size: 18, weight: 800, font: 'display', italic: true, tracking: 2, color: sel ? C.white : C.text });
      text(ctx, si ? si.location.toUpperCase() : t('stage.random.d'), r.x + 18, r.y + 64, { size: 10, weight: 700, font: 'display', tracking: 2, color: C.dim });
      if (sel) {
        ctx.fillStyle = si?.accent ?? C.violet;
        ctx.fillRect(r.x + 18, r.y + 76, 50, 2);
      }
    }
    if (this.chosen) {
      ctx.fillStyle = `rgba(255,255,255,${0.3 * (1 - this.chosenT / 18)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
}
