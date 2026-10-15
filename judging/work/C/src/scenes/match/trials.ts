/**
 * Combo trials: step-by-step validation of a combo route from hit events. A step is satisfied
 * when the listed move (id or id prefix, e.g. 'orb' matches every strength) hits as the next
 * hit of one continuous combo. Dropping the combo resets progress.
 */
import { app } from '../../core/app';
import { W } from '../../core/view';
import type { TrialDef } from '../../data/schema';
import { getChar, idMatches } from '../../sim/registry';
import type { SimEvent } from '../../sim/types';
import { chamferPath, text } from '../../ui/draw';
import { t } from '../../ui/strings';
import { drawStrokeText } from '../../ui/strokeFont';
import { C, clamp01, ease, rgba } from '../../ui/theme';
import type { MatchScene } from './matchScene';

const STORE = 'neon-tempest-trials-v1';

export function loadTrialProgress(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(STORE) ?? '{}'); } catch { return {}; }
}

function saveTrial(key: string): void {
  try {
    const p = loadTrialProgress();
    p[key] = true;
    localStorage.setItem(STORE, JSON.stringify(p));
  } catch { /* ignore */ }
}

export class TrialMode {
  index: number;
  progress = 0;
  private done = false;
  private doneT = 0;
  private dropT = 0;
  private stepFlash: number[] = [];
  private trials: TrialDef[];
  private charId: string;

  constructor(private scene: MatchScene, index: number) {
    this.charId = scene.s.config.chars[0];
    this.trials = getChar(this.charId).trials;
    this.index = Math.min(index, this.trials.length - 1);
    scene.s.config.trainingOpts.infiniteMeter = true;
  }

  get trial(): TrialDef { return this.trials[this.index]; }

  next(): void { this.index = (this.index + 1) % this.trials.length; this.reset(); }
  prev(): void { this.index = (this.index - 1 + this.trials.length) % this.trials.length; this.reset(); }

  private reset(): void {
    this.progress = 0;
    this.done = false;
    this.doneT = 0;
    this.stepFlash = [];
  }

  onEvents(evs: SimEvent[]): void {
    if (this.done) return;
    const steps = this.trial.steps;
    for (const e of evs) {
      if (e.t === 'hitMove' && e.p === 0) {
        const want = steps[this.progress];
        const hitInCombo = e.v; // victim combo count after this hit
        if (want && idMatches(e.k, want.move) && (this.progress === 0 || hitInCombo > 1)) {
          this.stepFlash[this.progress] = 20;
          this.progress++;
          app().sfx('ui_select_char', { pitch: 1 + this.progress * 0.08 });
          if (this.progress >= steps.length) {
            this.done = true;
            this.doneT = 0;
            saveTrial(`${this.charId}:${this.index}`);
            app().sfx('victory_sting');
          }
        } else if (this.progress > 0 && !(this.progress > 0 && idMatches(e.k, steps[this.progress - 1].move) && hitInCombo > 1)) {
          // wrong move: restart, possibly counting this hit as the first step
          this.drop();
          if (idMatches(e.k, steps[0].move)) { this.progress = 1; this.stepFlash[0] = 20; }
        }
      }
      if (e.t === 'comboEnd' && e.p === 0 && this.progress > 0 && !this.done) this.drop();
    }
  }

  private drop(): void {
    if (this.progress > 0) { this.dropT = 70; app().sfx('ui_error'); }
    this.progress = 0;
  }

  postTick(): void {
    // combo ended without a comboEnd event (single hit then recovery)
    const vic = this.scene.s.fighters[1];
    if (!this.done && this.progress > 0 && vic.combo === 0 && (vic.state === 'idle' || vic.state === 'crouch')) this.drop();
    if (this.dropT > 0) this.dropT--;
    for (let i = 0; i < this.stepFlash.length; i++) if (this.stepFlash[i] > 0) this.stepFlash[i]--;
    if (this.done) {
      this.doneT++;
      if (this.doneT === 150) { this.next(); this.scene.restart(); }
    }
  }

  onRestart(): void {
    this.progress = 0;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const tr = this.trial;
    const x = W - 380, y = 150;
    const h = 90 + tr.steps.length * 40;
    chamferPath(ctx, x, y, 350, h, 14);
    ctx.fillStyle = 'rgba(4,6,18,0.85)';
    ctx.fill();
    ctx.strokeStyle = rgba(C.violet, 0.7);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    const done = loadTrialProgress()[`${this.charId}:${this.index}`];
    text(ctx, `${t('trials.title')} ${this.index + 1}/${this.trials.length}${done ? '  ✓' : ''}`, x + 18, y + 26, { size: 12, weight: 800, font: 'display', tracking: 3, color: done ? C.lime : C.violet });
    text(ctx, tr.name.toUpperCase(), x + 18, y + 52, { size: 20, weight: 800, font: 'display', italic: true, tracking: 2, color: C.white });
    text(ctx, tr.hint, x + 18, y + 72, { size: 11, weight: 500, color: C.dim, maxWidth: 320 });
    tr.steps.forEach((st, i) => {
      const yy = y + 100 + i * 40;
      const ok = i < this.progress;
      const cur = i === this.progress && !this.done;
      const fl = (this.stepFlash[i] ?? 0) / 20;
      chamferPath(ctx, x + 14, yy - 16, 322, 32, 8);
      ctx.fillStyle = ok ? rgba(C.lime, 0.16 + fl * 0.4) : cur ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.02)';
      ctx.fill();
      if (cur) { ctx.strokeStyle = rgba(C.cyan, 0.7); ctx.lineWidth = 1; ctx.stroke(); }
      text(ctx, `${i + 1}`, x + 32, yy + 6, { size: 14, weight: 800, font: 'mono', align: 'center', color: ok ? C.lime : C.dim });
      text(ctx, st.label, x + 52, yy + 6, { size: 15, weight: 700, font: 'display', tracking: 1, color: ok ? C.lime : cur ? C.white : C.dim });
      if (ok) text(ctx, '✓', x + 318, yy + 6, { size: 16, weight: 800, align: 'center', color: C.lime });
    });
    if (this.dropT > 0) {
      text(ctx, t('trials.retry'), x + 175, y + h + 26, { size: 13, weight: 700, font: 'display', align: 'center', color: C.red, tracking: 2, alpha: clamp01(this.dropT / 20) });
    }
    if (this.done) {
      const k = ease.outBack(clamp01(this.doneT / 18));
      ctx.save();
      ctx.translate(W / 2, 300);
      ctx.scale(k, k);
      drawStrokeText(ctx, t('trials.complete'), 0, -40, { size: 64, color: C.lime, style: 'neon', align: 'center', weight: 1.3, tracking: 1 });
      ctx.restore();
    }
  }
}
