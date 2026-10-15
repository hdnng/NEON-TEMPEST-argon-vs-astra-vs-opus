/**
 * In-match HUD: health bars with damage trail ("white life"), timer, round pips, stun gauges,
 * 3-stock super meters with Storm Drive / Burnout states, portraits, combo counters, popups,
 * kinetic announcer text, input history and low-health warnings.
 */
import { settings } from '../core/settings';
import { W } from '../core/view';
import { DOWN, HK, HP, LEFT, LK, LP, MK, MP, RIGHT, UP } from '../sim/input';
import { getChar, getMove } from '../sim/registry';
import { METER_MAX, METER_STOCK, type MatchState, type SimEvent } from '../sim/types';
import { arrowIcon, buttonIcon, chamferPath, text } from '../ui/draw';
import { t } from '../ui/strings';
import { drawStrokeText } from '../ui/strokeFont';
import { C, PLAYER_COLORS, clamp01, ease, rgba } from '../ui/theme';
import type { DrawOpts } from './bodyDraw';
import { FighterView } from './fighterView';

interface Popup { text: string; color: string; p: number; t: number; life: number }
interface ComboShow { hits: number; dmg: number; t: number; fade: number; done: boolean }
interface Ann { text: string; sub: string; t: number; life: number; kind: 'round' | 'fight' | 'ko' | 'perfect' | 'time' | 'wins' | 'super' }
interface HistEntry { bits: number; frames: number }

const BAR_X0 = 92, BAR_X1 = 574, BAR_Y = 28, BAR_H = 24, SLANT = 14;

export class Hud {
  trail = [1, 1];
  trailDelay = [0, 0];
  shown = [1, 1];
  meterShown = [0, 0];
  combos: ComboShow[] = [{ hits: 0, dmg: 0, t: 0, fade: 0, done: true }, { hits: 0, dmg: 0, t: 0, fade: 0, done: true }];
  popups: Popup[] = [];
  ann: Ann | null = null;
  hist: HistEntry[][] = [[], []];
  portraits: FighterView[];
  time = 0;
  hitShake = [0, 0];
  stockFlash = [0, 0];
  showInputs = false;
  trainingMode = false;
  private portraitOpts: DrawOpts = { flat: null, rimA: '#9ff', rimB: '#f6c', glow: true, t: 0, energy: 0 };
  private names: string[];

  constructor(s: MatchState) {
    this.portraits = s.fighters.map((f, i) => {
      const v = new FighterView(f.char, f.palette);
      v.facing = i === 0 ? 1 : -1;
      return v;
    });
    this.names = s.fighters.map((f) => getChar(f.char).name);
    this.showInputs = settings.showInputHistory;
  }

  private pcache: { c: HTMLCanvasElement; t: number }[] = [];
  /** Renders the fighter bust into a masked offscreen canvas (GPU-sized), at most every 4 frames. */
  private portraitCanvas(i: number, col: string, charId: string): HTMLCanvasElement {
    let pc = this.pcache[i];
    if (!pc) {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      pc = this.pcache[i] = { c, t: -99 };
    }
    if (this.frame - pc.t < 4) return pc.c;
    pc.t = this.frame;
    const g = pc.c.getContext('2d')!;
    const k = 256 / 66;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#060818';
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = rgba(col, 0.18);
    g.fillRect(0, 0, 256, 256);
    g.setTransform(k, 0, 0, k, 0, 0);
    const pv = this.portraits[i];
    this.portraitOpts.rimA = col;
    this.portraitOpts.rimB = getChar(charId).themeColor;
    this.portraitOpts.t = this.time;
    const head = pv.skel.head;
    const sc = 1.25 / getChar(charId).body.scale;
    pv.drawPortrait(g, 33 - head.x * sc, 33 + head.y * sc + 6, sc, 1, this.portraitOpts);
    // chamfer mask
    g.setTransform(k, 0, 0, k, 0, 0);
    g.globalCompositeOperation = 'destination-in';
    chamferPath(g, 0, 0, 66, 66, 10);
    g.fillStyle = '#000';
    g.fill();
    g.globalCompositeOperation = 'source-over';
    return pc.c;
  }
  private frame = 0;

  private grads = new Map<string, CanvasGradient>();
  /** Cached vertical bar gradient (white highlight -> color -> darker). */
  private grad(ctx: CanvasRenderingContext2D, color: string, y: number, h: number, hi: string): CanvasGradient {
    const key = `${color}|${y}|${h}|${hi}`;
    let g = this.grads.get(key);
    if (!g) {
      g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, hi);
      g.addColorStop(0.2, color);
      g.addColorStop(1, mixc(color, '#000000', 0.45));
      this.grads.set(key, g);
    }
    return g;
  }

  private pcol(i: number): string {
    return (settings.colorblind ? PLAYER_COLORS.colorblind : PLAYER_COLORS.normal)[i];
  }

  /** Feed events produced by the last simulation step. */
  onEvents(s: MatchState, evs: SimEvent[]): void {
    for (const e of evs) {
      switch (e.t) {
        case 'hit': {
          const vic = 1 - e.p;
          this.hitShake[vic] = 10;
          this.trailDelay[vic] = 40;
          break;
        }
        case 'combo': {
          const c = this.combos[e.p];
          c.hits = e.v; c.dmg = s.fighters[1 - e.p].comboDmg; c.t = 0; c.fade = 90; c.done = false;
          break;
        }
        case 'comboEnd': {
          const c = this.combos[e.p];
          c.done = true; c.fade = 70;
          break;
        }
        case 'counter': this.popup(t('hud.counter'), C.gold, e.p); break;
        case 'punish': this.popup(t('hud.punish'), C.red, e.p); break;
        case 'tech': this.popup(t('hud.tech'), C.cyan, 0); this.popup(t('hud.tech'), C.cyan, 1); break;
        case 'armor': this.popup(t('hud.armor'), C.amber, e.p); break;
        case 'drive': this.popup(t('hud.drive'), C.cyan, e.p); this.stockFlash[e.p] = 30; break;
        case 'burnout': this.popup(t('hud.burnout'), C.red, e.p); break;
        case 'guardcancel': this.popup(t('hud.guardcancel'), C.violet, e.p); break;
        case 'pushblock': this.popup(t('hud.repel'), C.lime, e.p); break;
        case 'dizzy': this.popup(t('hud.dizzy'), C.amber, 1 - e.p); break;
        case 'quickRise': this.popup(t('hud.quickrise'), C.dim, e.p); break;
        case 'airRecover': this.popup(t('hud.recover'), C.dim, e.p); break;
        case 'roundStart':
          this.announce(e.k === 'final' ? t('ann.final') : `${t('ann.round')} ${e.v}`, '', 'round', 110);
          break;
        case 'fight': this.announce(t('ann.fight'), '', 'fight', 60); break;
        case 'ko': this.announce(e.k === 'double' ? t('ann.doubleko') : t('ann.ko'), '', 'ko', 130); break;
        case 'timeover': this.announce(t('ann.time'), '', 'time', 110); break;
        case 'roundEnd': {
          if (e.k === 'perfect') this.announce(t('ann.perfect'), '', 'perfect', 150);
          else if (e.v < 0) this.announce(t('ann.draw'), '', 'time', 150);
          else this.announce(`${this.names[e.v]}`, t('ann.wins'), 'wins', 150);
          break;
        }
        case 'super': case 'ult': {
          const m = getMove(s.fighters[e.p].char, e.k);
          this.announce(m ? m.name.toUpperCase() : '', t(e.t === 'super' ? 'hud.super' : 'hud.ultimate'), 'super', 70);
          break;
        }
      }
    }
  }

  private popup(text: string, color: string, p: number): void {
    this.popups.push({ text, color, p, t: 0, life: 70 });
    if (this.popups.length > 6) this.popups.shift();
  }

  private announce(text: string, sub: string, kind: Ann['kind'], life: number): void {
    this.ann = { text, sub, t: 0, life, kind };
  }

  /** Per sim frame bookkeeping. */
  update(s: MatchState, inputs: [number, number]): void {
    this.time += 1 / 60;
    this.frame++;
    for (let i = 0; i < 2; i++) {
      const f = s.fighters[i];
      const max = getChar(f.char).maxHp;
      const r = Math.max(0, f.hp / max);
      this.shown[i] += (r - this.shown[i]) * 0.5;
      if (this.trailDelay[i] > 0) this.trailDelay[i]--;
      else if (this.trail[i] > r) this.trail[i] = Math.max(r, this.trail[i] - 0.006);
      if (this.trail[i] < r) this.trail[i] = r;
      if (this.hitShake[i] > 0) this.hitShake[i]--;
      const prevStocks = Math.floor(this.meterShown[i] / METER_STOCK);
      this.meterShown[i] += (f.meter - this.meterShown[i]) * 0.35;
      if (Math.floor(f.meter / METER_STOCK) > prevStocks && f.meter > this.meterShown[i] - 1) this.stockFlash[i] = 24;
      if (this.stockFlash[i] > 0) this.stockFlash[i]--;
      const c = this.combos[i];
      c.t++;
      if (c.done && c.fade > 0) c.fade--;
      // input history
      const h = this.hist[i];
      const b = inputs[i];
      if (h.length && h[0].bits === b) h[0].frames++;
      else { h.unshift({ bits: b, frames: 1 }); if (h.length > 16) h.pop(); }
    }
    for (const p of this.popups) p.t++;
    this.popups = this.popups.filter((p) => p.t < p.life);
    if (this.ann) { this.ann.t++; if (this.ann.t > this.ann.life) this.ann = null; }
    for (let i = 0; i < 2; i++) this.portraits[i].animateMenu('idle', this.time + i);
  }

  private band: CanvasGradient | null = null;

  draw(ctx: CanvasRenderingContext2D, s: MatchState): void {
    if (settings.showHud) {
      if (!this.band) {
        this.band = ctx.createLinearGradient(0, 0, 0, 132);
        this.band.addColorStop(0, 'rgba(2,3,10,0.82)');
        this.band.addColorStop(0.6, 'rgba(2,3,10,0.45)');
        this.band.addColorStop(1, 'rgba(2,3,10,0)');
      }
      ctx.fillStyle = this.band;
      ctx.fillRect(0, 0, W, 132);
      for (let i = 0; i < 2; i++) this.drawSide(ctx, s, i);
      this.drawTimer(ctx, s);
    }
    for (let i = 0; i < 2; i++) this.drawCombo(ctx, i);
    this.drawPopups(ctx);
    if (this.showInputs) for (let i = 0; i < 2; i++) this.drawHistory(ctx, i, s);
    this.drawLowHp(ctx, s);
  }

  /** Drawn on top of everything (announcer). */
  drawAnnouncer(ctx: CanvasRenderingContext2D): void {
    if (this.ann) this.drawAnn(ctx, this.ann);
  }

  private drawSide(ctx: CanvasRenderingContext2D, s: MatchState, i: number): void {
    const f = s.fighters[i];
    const col = this.pcol(i);
    const mirror = i === 1;
    const shake = this.hitShake[i] > 0 ? (this.hitShake[i] % 2 ? 2 : -2) : 0;
    ctx.save();
    if (mirror) { ctx.translate(W, 0); ctx.scale(-1, 1); }
    ctx.translate(shake, 0);
    const x0 = BAR_X0, x1 = BAR_X1, y = BAR_Y, h = BAR_H;
    const w = x1 - x0;
    const bar = (a: number, b: number) => {
      // slanted bar segment from fraction a..b (0 = outer edge, 1 = center side)
      const xa = x0 + w * a, xb = x0 + w * b;
      ctx.beginPath();
      ctx.moveTo(xa + SLANT, y);
      ctx.lineTo(xb, y);
      ctx.lineTo(xb - SLANT * 0.0, y + h);
      ctx.lineTo(xa, y + h);
      ctx.closePath();
    };
    // frame
    ctx.fillStyle = 'rgba(4,6,16,0.85)';
    ctx.beginPath();
    ctx.moveTo(x0 + SLANT - 6, y - 5); ctx.lineTo(x1 + 6, y - 5); ctx.lineTo(x1 + 6, y + h + 5); ctx.lineTo(x0 - 6, y + h + 5);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = rgba(col, 0.55); ctx.lineWidth = 1.2; ctx.stroke();
    // trail (white life)
    const r = clamp01(this.shown[i]);
    const tr = clamp01(this.trail[i]);
    bar(1 - tr, 1);
    ctx.fillStyle = 'rgba(255,240,245,0.85)';
    ctx.fill();
    // fill
    const low = r < 0.25;
    const pulse = low ? 0.5 + 0.5 * Math.sin(this.time * 9) : 0;
    bar(1 - r, 1);
    const base = low ? mixc(col, '#ff3050', Math.round((0.55 + pulse * 0.45) * 8) / 8) : col;
    ctx.fillStyle = this.grad(ctx, base, y, h, '#ffffff');
    ctx.fill();
    // ticks
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 1; k < 10; k++) { const xx = x0 + (w * k) / 10; ctx.moveTo(xx + SLANT * 0.5, y + 2); ctx.lineTo(xx, y + h - 2); }
    ctx.stroke();
    // glossy edge
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x0 + SLANT, y + 2, w - SLANT, 3);
    // stun gauge (fills from the center outward)
    const maxStun = getChar(f.char).maxStun;
    const sr = clamp01(f.stun / maxStun);
    const sy0 = y + h + 9, sw = 250;
    ctx.fillStyle = 'rgba(4,6,16,0.8)';
    ctx.fillRect(x1 - sw - 2, sy0 - 1, sw + 4, 7);
    const dz = f.state === 'dizzy' || f.dizzyPending;
    ctx.fillStyle = dz ? (Math.floor(this.time * 10) % 2 ? C.amber : '#fff') : sr > 0.7 ? C.amber : '#d98b2b';
    ctx.fillRect(x1 - sw * sr, sy0, sw * sr, 5);
    // portrait (cached canvas, refreshed at 15 Hz)
    ctx.drawImage(this.portraitCanvas(i, col, f.char), 14, 14, 66, 66);
    chamferPath(ctx, 14, 14, 66, 66, 10);
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
    // name + pips (unmirrored text)
    const nameX = mirror ? W - BAR_X0 + 2 : BAR_X0 - 2;
    text(ctx, this.names[i], nameX, y + h + 34, { size: 19, weight: 700, font: 'display', italic: true, align: mirror ? 'right' : 'left', color: C.white, tracking: 2, shadow: 'rgba(0,0,0,0.6)' });
    if (f.drive > 0 || f.burnout > 0) {
      const lbl = f.drive > 0 ? t('hud.drive') : t('hud.burnout');
      text(ctx, lbl, mirror ? W - 240 : 240, y + h + 34, { size: 13, weight: 800, font: 'display', align: mirror ? 'right' : 'left', color: f.drive > 0 ? C.cyan : C.red, tracking: 2 });
    }
    // round pips near timer
    for (let k = 0; k < s.config.roundsToWin; k++) {
      const px = mirror ? W / 2 + 70 + k * 22 : W / 2 - 70 - k * 22;
      const py = 104;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.PI / 4);
      const won = s.wins[i] > k;
      ctx.fillStyle = won ? col : 'rgba(10,14,30,0.9)';
      ctx.strokeStyle = won ? '#ffffff' : rgba(col, 0.6);
      ctx.lineWidth = 1.5;
      ctx.fillRect(-6, -6, 12, 12);
      ctx.strokeRect(-6, -6, 12, 12);
      ctx.restore();
    }
    this.drawMeter(ctx, s, i);
  }

  private drawMeter(ctx: CanvasRenderingContext2D, s: MatchState, i: number): void {
    const f = s.fighters[i];
    const col = this.pcol(i);
    const mirror = i === 1;
    const x = 74, y = 666, w = 336, h = 18, skew = 8;
    const seg = w / 3;
    const m = this.meterShown[i];
    const burn = f.burnout > 0, drive = f.drive > 0;
    const stocks = Math.floor(f.meter / METER_STOCK);
    const flash = this.stockFlash[i] / 24;
    ctx.save();
    if (mirror) { ctx.translate(W, 0); ctx.scale(-1, 1); }
    // hexagonal stock counter
    const hx = 40, hy = y + 9;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = Math.PI / 6 + (k * Math.PI) / 3;
      ctx.lineTo(hx + Math.cos(a) * 24, hy + Math.sin(a) * 24);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(4,6,16,0.92)';
    ctx.fill();
    ctx.strokeStyle = flash > 0 ? '#ffffff' : stocks > 0 ? col : rgba(col, 0.4);
    ctx.lineWidth = 1.6;
    ctx.stroke();
    if (stocks > 0 && !burn) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(col, 0.18 + flash * 0.5);
      ctx.lineWidth = 7;
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    // segments: slanted cells
    const cell = (k: number, v: number) => {
      const x0 = x + k * seg + 3, x1 = x0 + (seg - 6) * v;
      ctx.beginPath();
      ctx.moveTo(x0 + skew, y);
      ctx.lineTo(x1 + skew, y);
      ctx.lineTo(x1, y + h);
      ctx.lineTo(x0, y + h);
      ctx.closePath();
    };
    for (let k = 0; k < 3; k++) {
      cell(k, 1);
      ctx.fillStyle = 'rgba(4,6,16,0.88)';
      ctx.fill();
      ctx.strokeStyle = rgba(col, 0.32);
      ctx.lineWidth = 1;
      ctx.stroke();
      const v = clamp01((m - k * METER_STOCK) / METER_STOCK);
      if (v <= 0.002) continue;
      const full = v >= 1;
      const c0 = burn ? '#555a70' : drive ? C.cyan : full ? col : mixc(col, '#10142e', 0.4);
      cell(k, v);
      ctx.fillStyle = this.grad(ctx, c0, y, h, burn ? '#888888' : '#ffffff');
      ctx.fill();
      if (burn) continue;
      ctx.globalCompositeOperation = 'lighter';
      if (full) {
        // traveling shine + glow edge
        const sh = (this.time * 0.7 + k * 0.33) % 1;
        const sx = x + k * seg + 3 + (seg - 30) * sh;
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.beginPath();
        ctx.moveTo(sx + skew + 8, y); ctx.lineTo(sx + skew + 20, y); ctx.lineTo(sx + 12, y + h); ctx.lineTo(sx, y + h);
        ctx.fill();
        cell(k, 1);
        ctx.strokeStyle = rgba(col, 0.35 + 0.25 * Math.sin(this.time * 6 + k));
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        // bright leading edge while filling
        const ex = x + k * seg + 3 + (seg - 6) * v;
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        ctx.moveTo(ex + skew - 2, y); ctx.lineTo(ex + skew, y); ctx.lineTo(ex, y + h); ctx.lineTo(ex - 2, y + h);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    // Storm Drive / Burnout timer
    if (drive || burn) {
      const r = drive ? f.drive / 360 : f.burnout / 180;
      ctx.fillStyle = 'rgba(4,6,16,0.8)';
      ctx.fillRect(x, y + h + 5, w, 4);
      ctx.fillStyle = drive ? C.cyan : C.red;
      ctx.fillRect(x, y + h + 5, w * r, 4);
    }
    ctx.restore();
    const bx = mirror ? W - 40 : 40;
    drawStrokeText(ctx, String(stocks), bx, hy - 11, { size: 22, color: stocks > 0 ? col : C.faint, style: 'neon', align: 'center', weight: 1.2, italic: false });
    const lbl = f.meter >= METER_MAX ? t('hud.max') : t('hud.storm');
    text(ctx, lbl, mirror ? W - x - 6 : x + 6, y - 7, { size: 11, weight: 800, font: 'display', tracking: 3, color: f.meter >= METER_MAX ? C.gold : C.dim, align: mirror ? 'right' : 'left' });
  }

  private drawTimer(ctx: CanvasRenderingContext2D, s: MatchState): void {
    const cx = W / 2, y = 14;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - 44, y); ctx.lineTo(cx + 44, y); ctx.lineTo(cx + 52, y + 36); ctx.lineTo(cx + 34, y + 76); ctx.lineTo(cx - 34, y + 76); ctx.lineTo(cx - 52, y + 36);
    ctx.closePath();
    ctx.fillStyle = 'rgba(4,6,16,0.9)';
    ctx.fill();
    ctx.strokeStyle = rgba(C.violet, 0.8);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
    const infinite = s.config.training || s.config.roundTime <= 0;
    const low = !infinite && s.timer <= 10;
    const col = low ? (Math.floor(this.time * 4) % 2 ? C.red : '#ffffff') : '#ffffff';
    if (infinite) {
      text(ctx, '∞', cx, y + 58, { size: 50, weight: 700, align: 'center', color: C.white });
    } else {
      drawStrokeText(ctx, String(Math.max(0, s.timer)).padStart(2, '0'), cx, y + 14, { size: 40, color: low ? C.red : C.cyan, core: col, style: 'neon', align: 'center', weight: 1.25, tracking: 0.8, italic: false });
    }
    text(ctx, t('hud.round', s.round), cx, y + 92, { size: 11, weight: 800, font: 'display', align: 'center', color: C.dim, tracking: 3 });
  }

  private drawCombo(ctx: CanvasRenderingContext2D, i: number): void {
    const c = this.combos[i];
    if (c.hits < 2 || (c.done && c.fade <= 0)) return;
    const a = c.done ? clamp01(c.fade / 30) : 1;
    const mirror = i === 1;
    const x = mirror ? W - 70 : 70;
    const y = 196;
    const pop = 1 + 0.45 * (1 - ease.outCubic(clamp01(c.t / 10)));
    const col = this.pcol(i);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(x, y);
    ctx.scale(pop, pop);
    drawStrokeText(ctx, String(c.hits), 0, -36, { size: 64, color: c.done ? C.gold : col, style: 'solid', align: mirror ? 'right' : 'left', weight: 1.1 });
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = a;
    text(ctx, t('hud.hits'), x + (mirror ? -4 : 4), y + 52, { size: 22, weight: 800, font: 'display', italic: true, align: mirror ? 'right' : 'left', color: C.white, tracking: 4, shadow: 'rgba(0,0,0,0.7)' });
    if (settings.showDamage) {
      text(ctx, `${c.dmg} ${t('hud.damage')}`, x + (mirror ? -4 : 4), y + 76, { size: 16, weight: 700, font: 'display', align: mirror ? 'right' : 'left', color: c.done ? C.gold : C.dim, tracking: 2, shadow: 'rgba(0,0,0,0.7)' });
    }
    ctx.restore();
  }

  private drawPopups(ctx: CanvasRenderingContext2D): void {
    const counts = [0, 0];
    for (const p of this.popups) {
      const k = counts[p.p]++;
      const mirror = p.p === 1;
      const inT = ease.outBack(clamp01(p.t / 10));
      const outA = clamp01((p.life - p.t) / 15);
      const x = mirror ? W - 70 + (1 - inT) * 120 : 70 - (1 - inT) * 120;
      const y = 318 + k * 30;
      ctx.save();
      ctx.globalAlpha = outA;
      ctx.fillStyle = rgba(p.color, 0.18);
      const w = 190;
      ctx.beginPath();
      if (mirror) { ctx.moveTo(x, y - 20); ctx.lineTo(x - w, y - 20); ctx.lineTo(x - w - 10, y + 4); ctx.lineTo(x, y + 4); }
      else { ctx.moveTo(x, y - 20); ctx.lineTo(x + w + 10, y - 20); ctx.lineTo(x + w, y + 4); ctx.lineTo(x, y + 4); }
      ctx.fill();
      ctx.fillStyle = p.color;
      ctx.fillRect(mirror ? x - 3 : x, y - 20, 3, 24);
      ctx.restore();
      text(ctx, p.text, x + (mirror ? -12 : 12), y - 1, { size: 17, weight: 800, font: 'display', italic: true, align: mirror ? 'right' : 'left', color: p.color, tracking: 3, alpha: outA });
    }
  }

  private drawHistory(ctx: CanvasRenderingContext2D, i: number, s: MatchState): void {
    const h = this.hist[i];
    const mirror = i === 1;
    const x = mirror ? W - 24 : 24;
    const rows = 9;
    let y = 420;
    ctx.save();
    ctx.fillStyle = 'rgba(4,6,16,0.55)';
    ctx.fillRect(mirror ? W - 150 : 6, 406, 144, rows * 24 + 8);
    ctx.restore();
    const facing = s.fighters[i].facing;
    for (let k = 0; k < Math.min(h.length, rows); k++) {
      const e = h[k];
      const a = 1 - k / 11;
      ctx.globalAlpha = a;
      text(ctx, String(Math.min(99, e.frames)), mirror ? x : x, y + 5, { size: 11, weight: 700, font: 'mono', align: mirror ? 'right' : 'left', color: C.dim, alpha: a });
      const dir = dirOf(e.bits, facing);
      const ax = mirror ? x - 34 : x + 34;
      arrowIcon(ctx, dir, ax, y, 9);
      let bx = mirror ? ax - 24 : ax + 24;
      for (const [bit, lbl] of BTN_LIST) {
        if (e.bits & bit) {
          buttonIcon(ctx, lbl, bx, y, 9);
          bx += mirror ? -21 : 21;
        }
      }
      ctx.globalAlpha = 1;
      y += 24;
    }
  }

  private drawLowHp(ctx: CanvasRenderingContext2D, s: MatchState): void {
    if (settings.flashReduction) return;
    for (let i = 0; i < 2; i++) {
      const f = s.fighters[i];
      const r = f.hp / getChar(f.char).maxHp;
      if (r >= 0.25 || f.hp <= 0 || s.phase !== 'fight') continue;
      const beat = Math.pow(Math.max(0, Math.sin(this.time * 5)), 6);
      const a = 0.12 + beat * 0.18;
      const x0 = i === 0 ? 0 : W - 160;
      const g = ctx.createLinearGradient(i === 0 ? 0 : W, 0, i === 0 ? 160 : W - 160, 0);
      g.addColorStop(0, `rgba(255,30,60,${a})`);
      g.addColorStop(1, 'rgba(255,30,60,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x0, 0, 160, 720);
    }
  }

  private drawAnn(ctx: CanvasRenderingContext2D, a: Ann): void {
    const tt = a.t;
    const cx = W / 2, cy = 300;
    const outA = clamp01((a.life - tt) / 18);
    ctx.save();
    switch (a.kind) {
      case 'round': {
        const n = a.text.length;
        drawStrokeText(ctx, a.text, cx, cy - 40, {
          size: 76, color: C.cyan, style: 'neon', align: 'center', weight: 1.3, tracking: 1.2,
          letter: (i) => {
            const k = clamp01((tt - i * 3) / 14);
            const e = ease.outExpo(k);
            return [(1 - e) * 260, 0, 1, k * outA];
          },
        });
        const lineW = 520 * ease.outCubic(clamp01(tt / 30));
        ctx.globalAlpha = outA;
        ctx.fillStyle = rgba(C.cyan, 0.8);
        ctx.fillRect(cx - lineW / 2, cy + 52, lineW, 2);
        ctx.fillStyle = rgba(C.magenta, 0.8);
        ctx.fillRect(cx - lineW / 2 + 30, cy + 58, lineW - 60, 1);
        void n;
        break;
      }
      case 'fight': {
        const k = clamp01(tt / 8);
        const sc = 1 + (1 - ease.outBack(k)) * 1.6;
        ctx.globalAlpha = outA;
        ctx.translate(cx, cy);
        ctx.scale(sc, sc);
        if (tt < 6 && !settings.flashReduction) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = rgba(C.magenta, 0.25 * (1 - tt / 6));
          ctx.fillRect(-W, -400, W * 2, 800);
          ctx.globalCompositeOperation = 'source-over';
        }
        drawStrokeText(ctx, a.text, 0, -56, { size: 112, color: C.magenta, style: 'solid', align: 'center', weight: 1.15, tracking: 0.8, outline: '#14020c' });
        drawStrokeText(ctx, a.text, 0, -56, { size: 112, color: '#ffd1ef', style: 'neon', align: 'center', weight: 0.5, tracking: 0.8, glow: 0.8 });
        break;
      }
      case 'ko': {
        const k = clamp01(tt / 10);
        const sc = 1 + (1 - ease.outCubic(k)) * 2.2;
        ctx.globalAlpha = outA;
        ctx.translate(cx, cy);
        ctx.scale(sc, sc);
        ctx.rotate(-0.04);
        drawStrokeText(ctx, a.text, 0, -70, { size: 140, color: C.red, style: 'solid', align: 'center', weight: 1.2, tracking: 1, outline: '#1a0206' });
        drawStrokeText(ctx, a.text, 0, -70, { size: 140, color: '#ffd0d6', style: 'neon', align: 'center', weight: 0.45, tracking: 1, glow: 0.7 });
        break;
      }
      case 'perfect': case 'time': {
        const col = a.kind === 'perfect' ? C.gold : C.white;
        drawStrokeText(ctx, a.text, cx, cy - 46, {
          size: 92, color: col, style: 'neon', align: 'center', weight: 1.4, tracking: 1,
          letter: (i) => { const k = clamp01((tt - i * 4) / 12); return [0, (1 - ease.outBack(k)) * -60, 1, k * outA]; },
        });
        break;
      }
      case 'wins': {
        drawStrokeText(ctx, a.text, cx, cy - 70, {
          size: 70, color: C.cyan, style: 'neon', align: 'center', weight: 1.3, tracking: 1,
          letter: (i) => { const k = clamp01((tt - i * 3) / 12); return [(1 - ease.outExpo(k)) * -200, 0, 1, k * outA]; },
        });
        drawStrokeText(ctx, a.sub, cx, cy + 20, {
          size: 46, color: C.magenta, style: 'solid', align: 'center', weight: 1.1, tracking: 2,
          letter: (i) => { const k = clamp01((tt - 12 - i * 3) / 10); return [0, (1 - ease.outBack(k)) * 30, 1, k * outA]; },
        });
        break;
      }
      case 'super': {
        // handled by the cut-in renderer; keep a compact name banner here
        break;
      }
    }
    ctx.restore();
  }
}

const BTN_LIST: [number, string][] = [[LP, 'LP'], [MP, 'MP'], [HP, 'HP'], [LK, 'LK'], [MK, 'MK'], [HK, 'HK']];

function dirOf(bits: number, facing: number): number {
  const up = bits & UP, down = bits & DOWN;
  let fwd = facing > 0 ? bits & RIGHT : bits & LEFT;
  let back = facing > 0 ? bits & LEFT : bits & RIGHT;
  if (fwd && back) { fwd = 0; back = 0; }
  const col = back ? 0 : fwd ? 2 : 1;
  const row = up ? 2 : down ? 0 : 1;
  return row * 3 + col + 1;
}

function mixc(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
  const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
}
