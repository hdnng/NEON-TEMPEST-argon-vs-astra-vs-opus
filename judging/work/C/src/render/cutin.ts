/**
 * Super-freeze presentation: darkened world, radial speed lines and the cinematic cut-in band
 * with the fighter portrait and the move name.
 */
import { settings } from '../core/settings';
import { H, W } from '../core/view';
import { getChar, getMove } from '../sim/registry';
import { FP, type MatchState } from '../sim/types';
import { text } from '../ui/draw';
import { t } from '../ui/strings';
import { drawStrokeText } from '../ui/strokeFont';
import { C, clamp01, ease, rgba } from '../ui/theme';
import type { DrawOpts } from './bodyDraw';
import { sx, sy, type Camera } from './camera';
import type { FighterView } from './fighterView';

const OPTS: DrawOpts = { flat: null, rimA: '#fff', rimB: '#fff', glow: true, t: 0, energy: 1 };

export class CutIn {
  private active = false;
  private t = 0;
  private owner = 0;
  private kind = '';
  private name = '';
  private total = 1;

  start(s: MatchState): void {
    this.active = true;
    this.t = 0;
    this.owner = s.freezeOwner;
    this.kind = s.freezeKind;
    this.total = s.freeze;
    const f = s.fighters[this.owner];
    const m = getMove(f.char, f.move);
    this.name = m ? m.name.toUpperCase() : '';
  }

  update(s: MatchState): void {
    if (!this.active) return;
    this.t++;
    if (s.freeze <= 0 && this.t > 4) this.active = false;
  }

  get on(): boolean { return this.active; }

  /** Darkening + speed lines, drawn after the stage and before the fighters. */
  drawBackdrop(ctx: CanvasRenderingContext2D, cam: Camera, s: MatchState): void {
    if (!this.active) return;
    const k = clamp01(this.t / 6) * clamp01((this.total - this.t + 4) / 8);
    const big = this.kind === 'super' || this.kind === 'ultimate';
    ctx.save();
    ctx.fillStyle = `rgba(2,2,10,${(big ? 0.62 : 0.4) * k})`;
    ctx.fillRect(0, 0, W, H);
    if (big) {
      const f = s.fighters[this.owner];
      const cx = sx(cam, f.x / FP), cy = sy(cam, f.y / FP + 130);
      const col = getChar(f.char).themeColor;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(col, 0.35 * k);
      ctx.lineWidth = 2;
      ctx.beginPath();
      const n = 48;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + (i % 3) * 0.05;
        const r0 = 140 + ((this.t * 37 + i * 53) % 180);
        ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        ctx.lineTo(cx + Math.cos(a) * 1400, cy + Math.sin(a) * 1400);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  /** The cut-in band, drawn on top of the world (below the HUD). */
  drawBand(ctx: CanvasRenderingContext2D, s: MatchState, view: FighterView): void {
    if (!this.active || !(this.kind === 'super' || this.kind === 'ultimate')) return;
    const f = s.fighters[this.owner];
    const ch = getChar(f.char);
    const col = ch.themeColor;
    const dur = Math.min(this.total, 46);
    const tin = ease.outExpo(clamp01(this.t / 9));
    const tout = ease.inCubic(clamp01((this.t - (dur - 10)) / 10));
    const left = this.owner === 0;
    const bandH = 210;
    const y = H / 2 - bandH / 2 - 40;
    const slide = (1 - tin) * (left ? -W : W) + tout * (left ? W : -W);
    ctx.save();
    ctx.translate(slide, 0);
    // band
    ctx.beginPath();
    ctx.moveTo(0, y + 30); ctx.lineTo(W, y); ctx.lineTo(W, y + bandH - 30); ctx.lineTo(0, y + bandH);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, y, W, y + bandH);
    g.addColorStop(0, rgba(col, 0.85));
    g.addColorStop(0.45, 'rgba(10,8,30,0.95)');
    g.addColorStop(1, rgba(this.kind === 'ultimate' ? C.gold : C.magenta, 0.85));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ctx.clip();
    // streaks
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 14; i++) {
      const yy = y + ((i * 37 + this.t * 11) % bandH);
      const xx = ((i * 211 + this.t * 60) % (W + 400)) - 200;
      ctx.fillRect(left ? W - xx : xx, yy, 220, 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    // portrait
    OPTS.rimA = col; OPTS.rimB = C.magenta; OPTS.t = this.t / 60;
    view.setMenuPose(this.kind === 'ultimate' ? 'ult' : 'win');
    const px = left ? 300 : W - 300;
    view.drawPortrait(ctx, px, y + bandH + 380, 2.3, left ? 1 : -1, OPTS);
    ctx.restore();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, y + 30); ctx.lineTo(W, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, y + bandH); ctx.lineTo(W, y + bandH - 30); ctx.stroke();
    ctx.restore();
    // move name
    const ta = clamp01((this.t - 4) / 6) * (1 - tout);
    const nx = left ? W - 90 : 90;
    text(ctx, t(this.kind === 'ultimate' ? 'hud.ultimate' : 'hud.super'), nx, y + 70, { size: 18, weight: 800, font: 'display', tracking: 8, align: left ? 'right' : 'left', color: C.white, alpha: ta });
    drawStrokeText(ctx, this.name, nx, y + 86, {
      size: 50, color: this.kind === 'ultimate' ? C.gold : C.white, style: 'solid', align: left ? 'right' : 'left', weight: 1.1, tracking: 0.8,
      letter: (i) => { const k = clamp01((this.t - 5 - i * 1.2) / 6); return [(1 - ease.outCubic(k)) * (left ? 80 : -80), 0, 1, k * (1 - tout)]; },
    });
    if (!settings.flashReduction && this.t < 4) {
      ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - this.t / 4)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
}
