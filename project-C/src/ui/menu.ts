/**
 * Reusable animated menu list (keyboard / gamepad / mouse / touch) with option rows.
 */
import { app } from '../core/app';
import type { MenuEvent } from '../input/input';
import { chamferPath, text } from './draw';
import { C, clamp01, ease, rgba } from './theme';

export interface MenuItem {
  id: string;
  label: string | (() => string);
  desc?: string | (() => string);
  /** Option rows show a value with left/right adjust. */
  value?: () => string;
  onSelect?: () => void;
  onAdjust?: (dir: -1 | 1) => void;
  disabled?: () => boolean;
  /** Section header (non-selectable). */
  header?: boolean;
}

export interface MenuStyle {
  x: number;
  y: number;
  w: number;
  itemH: number;
  size: number;
  accent: string;
  align?: 'left' | 'center';
  valueX?: number;
}

export class MenuList {
  index = 0;
  private barY = 0;
  private offs: number[] = [];
  private t = 0;
  enabled = true;
  onBack: (() => void) | null = null;
  onChange: ((i: number) => void) | null = null;
  scroll = 0;
  maxVisible = 99;

  constructor(public items: MenuItem[], public style: MenuStyle) {
    this.index = this.firstSelectable(0, 1);
    this.barY = this.rowY(this.index);
    this.offs = items.map(() => 0);
  }

  private selectable(i: number): boolean {
    const it = this.items[i];
    return !!it && !it.header && !(it.disabled?.() ?? false);
  }

  private firstSelectable(from: number, dir: 1 | -1): number {
    const n = this.items.length;
    for (let k = 0; k < n; k++) {
      const i = (from + dir * k + n * 4) % n;
      if (this.selectable(i)) return i;
    }
    return 0;
  }

  private rowY(i: number): number {
    return this.style.y + (i - this.scroll) * this.style.itemH;
  }

  get current(): MenuItem { return this.items[this.index]; }

  setIndex(i: number): void {
    this.index = i;
    this.ensureVisible();
  }

  private ensureVisible(): void {
    if (this.index < this.scroll) this.scroll = this.index;
    if (this.index >= this.scroll + this.maxVisible) this.scroll = this.index - this.maxVisible + 1;
  }

  update(events: MenuEvent[]): void {
    this.t++;
    if (!this.enabled) return;
    const a = app();
    for (const e of events) {
      if (e.k === 'up' || e.k === 'down') {
        const dir = e.k === 'up' ? -1 : 1;
        const ni = this.firstSelectable(this.index + dir, dir);
        if (ni !== this.index) {
          this.index = ni;
          this.ensureVisible();
          a.sfx('ui_move');
          this.onChange?.(ni);
        }
      } else if ((e.k === 'left' || e.k === 'right') && this.current.onAdjust) {
        this.current.onAdjust(e.k === 'left' ? -1 : 1);
        a.sfx('ui_slide');
      } else if (e.k === 'confirm' || e.k === 'start') {
        const it = this.current;
        if (it.onSelect) { a.sfx('ui_confirm'); it.onSelect(); return; }
        else if (it.onAdjust) { it.onAdjust(1); a.sfx('ui_slide'); }
      } else if (e.k === 'back' && this.onBack) {
        a.sfx('ui_back');
        this.onBack();
      }
    }
    // pointer
    const p = a.input.pointer;
    const st = this.style;
    if (p.x >= st.x - 10 && p.x <= st.x + st.w + 10) {
      for (let i = this.scroll; i < Math.min(this.items.length, this.scroll + this.maxVisible); i++) {
        const y = this.rowY(i);
        if (p.y >= y - st.itemH / 2 && p.y < y + st.itemH / 2 && this.selectable(i)) {
          if (p.moved && i !== this.index) { this.index = i; a.sfx('ui_move'); this.onChange?.(i); }
          if (p.clicked) {
            a.input.takeClick();
            this.index = i;
            const it = this.items[i];
            if (it.onAdjust && st.valueX !== undefined) {
              const right = p.x > st.x + (st.valueX ?? st.w * 0.6);
              it.onAdjust(right ? 1 : -1);
              a.sfx('ui_slide');
            } else if (it.onSelect) { a.sfx('ui_confirm'); it.onSelect(); }
          }
        }
      }
    }
    if (p.wheel !== 0 && this.items.length > this.maxVisible) {
      this.scroll = Math.max(0, Math.min(this.items.length - this.maxVisible, this.scroll + p.wheel));
    }
  }

  render(ctx: CanvasRenderingContext2D, alpha = 1, introT = 1): void {
    const st = this.style;
    const target = this.rowY(this.index);
    this.barY += (target - this.barY) * 0.3;
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 0.12);
    // selection bar
    const bh = st.itemH - 8;
    ctx.save();
    ctx.globalAlpha = alpha;
    chamferPath(ctx, st.x - 14, this.barY - bh / 2, st.w + 28, bh, 10);
    const g = ctx.createLinearGradient(st.x, 0, st.x + st.w, 0);
    g.addColorStop(0, rgba(st.accent, 0.42));
    g.addColorStop(0.7, rgba(st.accent, 0.08));
    g.addColorStop(1, rgba(st.accent, 0));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.fillStyle = st.accent;
    ctx.fillRect(st.x - 14, this.barY - bh / 2 + 4, 3, bh - 8);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgba(st.accent, 0.15 + pulse * 0.15);
    ctx.fillRect(st.x - 16, this.barY - bh / 2 + 2, 7, bh - 4);
    ctx.restore();
    const end = Math.min(this.items.length, this.scroll + this.maxVisible);
    for (let i = this.scroll; i < end; i++) {
      const it = this.items[i];
      const y = this.rowY(i);
      const sel = i === this.index;
      this.offs[i] = (this.offs[i] ?? 0) + ((sel ? 1 : 0) - (this.offs[i] ?? 0)) * 0.25;
      const o = this.offs[i];
      const k = ease.outCubic(clamp01(introT * 1.6 - i * 0.08));
      const a2 = alpha * k;
      const label = typeof it.label === 'function' ? it.label() : it.label;
      if (it.header) {
        text(ctx, label, st.x, y + 5, { size: 13, weight: 800, font: 'display', tracking: 4, color: st.accent, alpha: a2 * 0.9 });
        ctx.fillStyle = rgba(st.accent, 0.3 * a2);
        ctx.fillRect(st.x, y + 12, st.w, 1);
        continue;
      }
      const dis = it.disabled?.() ?? false;
      const col = dis ? C.faint : sel ? C.white : C.dim;
      const xo = st.x + o * 12 + (1 - k) * -40;
      text(ctx, label, st.align === 'center' ? st.x + st.w / 2 : xo, y + st.size * 0.36, {
        size: st.size, weight: 700, font: 'display', tracking: 2, color: col, alpha: a2, italic: sel, align: st.align === 'center' ? 'center' : 'left',
      });
      if (it.value) {
        const v = it.value();
        const vx = st.x + (st.valueX ?? st.w * 0.62);
        const vw = st.w - (st.valueX ?? st.w * 0.62);
        text(ctx, v, vx + vw / 2, y + st.size * 0.34, { size: st.size * 0.82, weight: 700, font: 'display', tracking: 1, color: sel ? st.accent : C.text, alpha: a2, align: 'center' });
        if (sel && it.onAdjust) {
          text(ctx, '◄', vx + 6, y + st.size * 0.3, { size: st.size * 0.6, color: st.accent, alpha: a2, align: 'center' });
          text(ctx, '►', vx + vw - 6, y + st.size * 0.3, { size: st.size * 0.6, color: st.accent, alpha: a2, align: 'center' });
        }
      }
    }
  }
}

/** A dimmed full-screen backdrop + centered panel used by overlays (pause, training). */
export function overlayBackdrop(ctx: CanvasRenderingContext2D, alpha: number): void {
  ctx.save();
  ctx.fillStyle = `rgba(2,3,10,${0.7 * alpha})`;
  ctx.fillRect(0, 0, 1280, 720);
  ctx.restore();
}
