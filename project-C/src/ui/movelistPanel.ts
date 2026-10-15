/**
 * Move list panel: per-character commands with input icons and descriptions, plus a frame data
 * view (startup / active / recovery / on hit / on block / damage / level). Used as a scene and as
 * a pause overlay.
 */
import { app } from '../core/app';
import type { MenuEvent } from '../input/input';
import type { MoveDef } from '../data/schema';
import { CHARACTER_LIST } from '../data/characters';
import { moveTotal } from '../sim/registry';
import { chamferPath, commandIcons, panel, text, type InputDesc } from './draw';
import { t } from './strings';
import { drawStrokeText } from './strokeFont';
import { C, clamp01, ease, rgba } from './theme';

interface Row {
  header?: string;
  name?: string;
  input?: InputDesc;
  desc?: string;
  frames?: string[];
  tag?: string;
}

function advText(m: MoveDef): [string, string] {
  if (!m.hits.length) return m.projectile ? ['proj', 'proj'] : ['-', '-'];
  if (m.airborne || m.stance === 'air') {
    const last = m.hits[m.hits.length - 1];
    return [last.knockdown ? 'KD' : `${last.hitstun}*`, `${last.blockstun}*`];
  }
  const last = m.hits[m.hits.length - 1];
  const left = moveTotal(m) - last.frames[0];
  const h = last.knockdown ? 'KD' : signed(last.hitstun - left);
  return [h, signed(last.blockstun - left)];
}

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export function frameRow(m: MoveDef): string[] {
  const [oh, ob] = advText(m);
  const dmg = m.throw ? m.throw.damage : m.projectile ? m.projectile.def.hit.damage * m.projectile.def.hits : m.hits.reduce((a, h) => a + h.damage, 0);
  const lvl = m.throw ? 'throw' : m.projectile ? 'mid' : m.hits.length ? m.hits[0].level : '-';
  return [String(m.projectile ? m.projectile.frame : m.startup), m.projectile ? '-' : String(m.active), String(m.recovery), oh, ob, String(dmg), lvl];
}

function inputDesc(m: MoveDef): InputDesc {
  const r = m.input;
  const buttons: string[] = [];
  if (r.btn) buttons.push(r.btn);
  if (r.anyOf) buttons.push(r.anyOf);
  if (r.two) buttons.push(r.two + r.two);
  if (r.combo) buttons.push(...r.combo);
  let dirs: number[] | undefined;
  if (r.dirs && !r.motion) {
    if (r.dirs.length === 1) dirs = r.dirs;
    else if (r.dirs.every((d) => d <= 3)) dirs = [2];
    else if (r.dirs.includes(4) && !r.dirs.includes(5)) dirs = [4];
  }
  return { motion: r.motion, dirs, buttons };
}

export function buildRows(charId: string): Row[] {
  const c = CHARACTER_LIST.find((x) => x.id === charId)!;
  const rows: Row[] = [];
  const byType = (types: string[]) => c.moves.filter((m) => types.includes(m.type));
  const normals = byType(['normal']);
  const cmd = byType(['command', 'throw']);
  const specials = byType(['special', 'ex']);
  const supers = byType(['super', 'ultimate']);
  const system = byType(['drive', 'guardcancel', 'pushblock']);
  const air = (m: MoveDef) => m.stance === 'air';
  rows.push({ header: t('movelist.specials') });
  const seen = new Set<string>();
  for (const m of specials) {
    const base = m.id.replace(/_(L|M|H|EX)$/, '');
    if (seen.has(base) && !m.id.endsWith('_EX')) {
      rows.push({ name: t('movelist.version', m.id.slice(base.length + 1)), input: inputDesc(m), frames: frameRow(m), tag: 'var' });
      continue;
    }
    seen.add(base);
    if (m.id.endsWith('_EX')) {
      rows.push({ name: t('movelist.ex'), input: inputDesc(m), desc: '', frames: frameRow(m), tag: 'ex' });
    } else {
      const group = m.input.anyOf ?? m.input.two ?? (m.input.btn?.endsWith('P') ? 'P' : 'K');
      rows.push({ name: m.name.toUpperCase(), input: { ...inputDesc(m), buttons: [group] }, desc: m.desc, frames: frameRow(m) });
    }
  }
  rows.push({ header: t('movelist.supers') });
  for (const m of supers) rows.push({ name: m.name.toUpperCase(), input: inputDesc(m), desc: m.desc, frames: frameRow(m), tag: m.type });
  rows.push({ header: t('movelist.command') });
  for (const m of cmd) {
    const d = inputDesc(m);
    if (air(m)) d.buttons = ['(air) ' + d.buttons[0]];
    rows.push({ name: m.name.toUpperCase(), input: d, desc: m.desc, frames: frameRow(m) });
  }
  rows.push({ header: t('movelist.normals') });
  for (const m of normals) {
    const d = inputDesc(m);
    const prefix = air(m) ? 'j.' : m.stance === 'crouch' ? '2' : '5';
    rows.push({ name: `${prefix}${m.input.btn}  ${m.name}`, input: air(m) ? { buttons: [m.input.btn!], dirs: [8] } : d, desc: m.desc, frames: frameRow(m) });
  }
  rows.push({ header: t('movelist.system') });
  for (const m of system) rows.push({ name: m.name.toUpperCase(), input: inputDesc(m), desc: m.desc, frames: frameRow(m) });
  rows.push({ name: t('movelist.tech'), input: { buttons: ['LP', 'LK'] }, desc: t('movelist.tech.d') });
  rows.push({ name: t('movelist.quickrise'), input: { buttons: ['P'] }, desc: t('movelist.quickrise.d') });
  rows.push({ name: t('movelist.airrecover'), input: { buttons: ['P'] }, desc: t('movelist.airrecover.d') });
  rows.push({ name: t('movelist.dash'), input: { dirs: [6, 6], buttons: [] }, desc: t('movelist.dash.d') });
  if (c.airJumps) rows.push({ name: t('movelist.doublejump'), input: { dirs: [8, 8], buttons: [] }, desc: t('movelist.doublejump.d') });
  if (c.airDashes) rows.push({ name: t('movelist.airdash'), input: { dirs: [6, 6], buttons: [] }, desc: t('movelist.airdash.d') });
  return rows;
}

export class MoveListPanel {
  charIndex: number;
  showFrames: boolean;
  private rows: Row[] = [];
  private sel = 0;
  private scroll = 0;
  private t = 0;
  private open = 0;
  onClose: (() => void) | null = null;
  readonly visible = 10;

  constructor(charId: string, showFrames = false) {
    this.charIndex = Math.max(0, CHARACTER_LIST.findIndex((c) => c.id === charId));
    this.showFrames = showFrames;
    this.load();
  }

  private load(): void {
    this.rows = buildRows(CHARACTER_LIST[this.charIndex].id);
    this.sel = this.rows.findIndex((r) => !r.header);
    this.scroll = 0;
  }

  update(events: MenuEvent[]): void {
    this.t++;
    this.open = Math.min(1, this.open + 0.08);
    const a = app();
    for (const e of events) {
      if (e.k === 'back' || e.k === 'pause') { a.sfx('ui_back'); this.onClose?.(); return; }
      if (e.k === 'left' || e.k === 'tabL' || e.k === 'right' || e.k === 'tabR') {
        const d = e.k === 'left' || e.k === 'tabL' ? -1 : 1;
        this.charIndex = (this.charIndex + d + CHARACTER_LIST.length) % CHARACTER_LIST.length;
        this.load();
        a.sfx('ui_tab');
      }
      if (e.k === 'up' || e.k === 'down') {
        const d = e.k === 'up' ? -1 : 1;
        let i = this.sel;
        do { i += d; } while (i >= 0 && i < this.rows.length && this.rows[i].header);
        if (i >= 0 && i < this.rows.length) { this.sel = i; a.sfx('ui_move'); }
      }
      if (e.k === 'alt' || e.k === 'confirm') { this.showFrames = !this.showFrames; a.sfx('ui_slide'); }
    }
    const p = a.input.pointer;
    if (p.wheel) {
      let i = this.sel;
      do { i += p.wheel > 0 ? 1 : -1; } while (i >= 0 && i < this.rows.length && this.rows[i].header);
      if (i >= 0 && i < this.rows.length) this.sel = i;
    }
    if (p.clicked) {
      if (p.x > 60 && p.x < 380 && p.y > 74 && p.y < 128) {
        a.input.takeClick();
        const idx = Math.floor((p.x - 60) / 80);
        if (idx >= 0 && idx < CHARACTER_LIST.length) { this.charIndex = idx; this.load(); a.sfx('ui_tab'); }
      }
    }
    if (this.sel < this.scroll + 1) this.scroll = Math.max(0, this.sel - 1);
    if (this.sel >= this.scroll + this.visible) this.scroll = this.sel - this.visible + 1;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const k = ease.outCubic(this.open);
    const c = CHARACTER_LIST[this.charIndex];
    ctx.save();
    ctx.globalAlpha = k;
    panel(ctx, 40, 30, 1200, 660, { fill: 'rgba(6,8,22,0.94)', edge: rgba(c.themeColor, 0.6), glow: 1, cut: 18 });
    drawStrokeText(ctx, t('movelist.title'), 64, 46, { size: 22, color: c.themeColor, align: 'left', tracking: 0.8 });
    // character tabs
    CHARACTER_LIST.forEach((ch, i) => {
      const x = 60 + i * 80, y = 82;
      const sel = i === this.charIndex;
      chamferPath(ctx, x, y, 74, 40, 8);
      ctx.fillStyle = sel ? rgba(ch.themeColor, 0.3) : 'rgba(255,255,255,0.04)';
      ctx.fill();
      ctx.strokeStyle = sel ? ch.themeColor : rgba('#ffffff', 0.15);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      text(ctx, ch.name, x + 37, y + 25, { size: 13, weight: 800, font: 'display', align: 'center', tracking: 1, color: sel ? C.white : C.dim });
    });
    text(ctx, `${c.name}  ·  ${c.archetype.toUpperCase()}`, 400, 108, { size: 18, weight: 700, font: 'display', tracking: 3, color: C.white });
    text(ctx, this.showFrames ? t('frame.hide') : t('frame.show'), 1216, 108, { size: 12, weight: 700, font: 'display', tracking: 2, color: C.dim, align: 'right' });
    if (this.showFrames) {
      const hx = [800, 852, 904, 956, 1014, 1074, 1136];
      [t('frame.startup'), t('frame.active'), t('frame.recov'), t('frame.onhit'), t('frame.onblock'), t('frame.damage'), t('frame.level')].forEach((h, i) => text(ctx, h, hx[i], 146, { size: 10, weight: 800, font: 'display', tracking: 1, color: C.dim, align: 'center' }));
    }
    // rows
    const y0 = 166, rh = 50;
    const end = Math.min(this.rows.length, this.scroll + this.visible);
    for (let i = this.scroll; i < end; i++) {
      const r = this.rows[i];
      const y = y0 + (i - this.scroll) * rh;
      const rowA = clamp01(this.open * 2 - (i - this.scroll) * 0.06);
      ctx.globalAlpha = k * rowA;
      if (r.header) {
        text(ctx, r.header, 64, y + 30, { size: 14, weight: 800, font: 'display', tracking: 5, color: c.themeColor });
        ctx.fillStyle = rgba(c.themeColor, 0.35);
        ctx.fillRect(64, y + 38, 1150, 1);
        continue;
      }
      const sel = i === this.sel;
      if (sel) {
        chamferPath(ctx, 54, y + 2, 1172, rh - 4, 10);
        ctx.fillStyle = rgba(c.themeColor, 0.14);
        ctx.fill();
        ctx.fillStyle = c.themeColor;
        ctx.fillRect(54, y + 8, 3, rh - 16);
      }
      const sub = r.tag === 'var' || r.tag === 'ex';
      text(ctx, r.name ?? '', 72, y + 23, { size: sub ? 14 : 17, weight: 700, font: 'display', tracking: 1, color: sub ? C.dim : sel ? C.white : C.text, italic: !sub });
      if (r.input) commandIcons(ctx, r.input, this.showFrames ? 380 : 420, y + 25, 11);
      if (this.showFrames && r.frames) {
        const hx = [800, 852, 904, 956, 1014, 1074, 1136];
        r.frames.forEach((v, j) => {
          const col = j === 3 || j === 4 ? (v.startsWith('+') ? C.lime : v.startsWith('-') ? (parseInt(v, 10) <= -7 ? C.red : C.amber) : C.text) : C.text;
          text(ctx, v, hx[j], y + 30, { size: 14, weight: 700, font: 'mono', align: 'center', color: col });
        });
      } else if (r.desc) {
        text(ctx, r.desc, 720, y + 30, { size: 13, weight: 500, color: C.dim, maxWidth: 500 });
      }
      if (r.tag === 'super' || r.tag === 'ultimate') {
        text(ctx, r.tag === 'super' ? t('movelist.cost.super') : t('movelist.cost.ult'), 72, y + 42, { size: 10, weight: 800, font: 'display', tracking: 2, color: r.tag === 'super' ? C.cyan : C.gold });
      }
    }
    ctx.globalAlpha = k;
    // scrollbar
    const total = this.rows.length;
    if (total > this.visible) {
      const h = 500 * (this.visible / total);
      const y = 166 + 500 * (this.scroll / total);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(1228, 166, 3, 500);
      ctx.fillStyle = c.themeColor;
      ctx.fillRect(1228, y, 3, h);
    }
    text(ctx, t('hint.movelist'), 640, 676, { size: 12, weight: 700, font: 'display', tracking: 2, color: C.dim, align: 'center' });
    ctx.restore();
  }
}
