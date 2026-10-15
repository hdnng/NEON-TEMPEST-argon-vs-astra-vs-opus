/**
 * Settings panel with tabs (audio, video, gameplay, controls, accessibility) and live key /
 * gamepad remapping. Changes apply immediately and persist to localStorage.
 */
import { app } from '../core/app';
import { ACTIONS, defaultBindings, resetSettings, saveSettings, settings, type Action } from '../core/settings';
import type { MenuEvent } from '../input/input';
import { chamferPath, panel, text } from './draw';
import { MenuList, type MenuItem } from './menu';
import { t, type StringKey } from './strings';
import { drawStrokeText } from './strokeFont';
import { C, ease, rgba } from './theme';

const TABS: StringKey[] = ['settings.audio', 'settings.video', 'settings.gameplay', 'settings.controls', 'settings.access'];


const PAD_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Select', 'Start', 'L3', 'R3', 'D-Up', 'D-Down', 'D-Left', 'D-Right', 'Home'];

function keyName(code: string): string {
  return code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Arrow/, '').replace('Numpad', 'Num ');
}

const onOff = (v: boolean) => (v ? t('settings.on') : t('settings.off'));
const pct = (v: number) => `${Math.round(v * 100)}%`;

export class SettingsPanel {
  tab = 0;
  private lists: MenuList[] = [];
  private controlsTarget: 'k0' | 'k1' | 'pad' = 'k0';
  private capture: { action: Action; kind: 'key' | 'pad'; player: number } | null = null;
  private captureT = 0;
  private open = 0;
  onClose: (() => void) | null = null;

  constructor() {
    this.build();
  }

  private adj(get: () => number, set: (v: number) => void, step: number, min: number, max: number) {
    return (d: -1 | 1) => {
      set(Math.round(Math.max(min, Math.min(max, get() + d * step)) * 100) / 100);
      saveSettings();
    };
  }

  private toggle(key: 'muted' | 'screenShake' | 'flashReduction' | 'colorblind' | 'showHud' | 'showInputHistory' | 'showDamage' | 'showFps') {
    return () => { settings[key] = !settings[key]; saveSettings(); };
  }

  private build(): void {
    const style = { x: 300, y: 214, w: 680, itemH: 50, size: 21, accent: C.cyan, valueX: 430 };
    const audio: MenuItem[] = [
      { id: 'master', label: t('settings.master'), value: () => pct(settings.master), onAdjust: this.adj(() => settings.master, (v) => (settings.master = v), 0.05, 0, 1) },
      { id: 'music', label: t('settings.music'), value: () => pct(settings.music), onAdjust: this.adj(() => settings.music, (v) => (settings.music = v), 0.05, 0, 1) },
      { id: 'sfx', label: t('settings.sfx'), value: () => pct(settings.sfx), onAdjust: this.adj(() => settings.sfx, (v) => (settings.sfx = v), 0.05, 0, 1) },
      { id: 'mute', label: t('settings.mute'), value: () => onOff(settings.muted), onAdjust: this.toggle('muted'), onSelect: this.toggle('muted') },
    ];
    const video: MenuItem[] = [
      { id: 'fs', label: t('settings.fullscreen'), value: () => onOff(!!document.fullscreenElement), onSelect: () => app().toggleFullscreen(), onAdjust: () => app().toggleFullscreen() },
      {
        id: 'res', label: t('settings.resolution'),
        value: () => (settings.resolutionScale === 0 ? `AUTO (${Math.round(app().view.resScale * 100)}%)` : `${Math.round(settings.resolutionScale * 100)}%`),
        onAdjust: (d) => {
          const steps = [0, 0.5, 0.75, 1, 1.25, 1.5];
          const i = steps.indexOf(settings.resolutionScale);
          settings.resolutionScale = steps[Math.max(0, Math.min(steps.length - 1, (i < 0 ? 0 : i) + d))];
          if (settings.resolutionScale === 0) app().view.setResolutionScale(1);
          saveSettings();
        },
      },
      { id: 'fps', label: t('settings.fps'), value: () => onOff(settings.showFps), onAdjust: this.toggle('showFps'), onSelect: this.toggle('showFps') },
      { id: 'hud', label: t('settings.hud'), value: () => onOff(settings.showHud), onAdjust: this.toggle('showHud'), onSelect: this.toggle('showHud') },
    ];
    const gameplay: MenuItem[] = [
      { id: 'diff', label: t('settings.difficulty'), value: () => t(`diff.${settings.difficulty}` as StringKey), onAdjust: this.adj(() => settings.difficulty, (v) => (settings.difficulty = v), 1, 0, 3) },
      { id: 'inputs', label: t('settings.inputs'), value: () => onOff(settings.showInputHistory), onAdjust: this.toggle('showInputHistory'), onSelect: this.toggle('showInputHistory') },
      { id: 'dmg', label: t('settings.damage'), value: () => onOff(settings.showDamage), onAdjust: this.toggle('showDamage'), onSelect: this.toggle('showDamage') },
      { id: 'reset', label: t('settings.reset'), onSelect: () => { resetSettings(); app().view.setResolutionScale(1); } },
    ];
    const access: MenuItem[] = [
      { id: 'shake', label: t('settings.shake'), value: () => onOff(settings.screenShake), onAdjust: this.toggle('screenShake'), onSelect: this.toggle('screenShake') },
      { id: 'flash', label: t('settings.flash'), value: () => onOff(settings.flashReduction), onAdjust: this.toggle('flashReduction'), onSelect: this.toggle('flashReduction') },
      { id: 'cb', label: t('settings.colorblind'), value: () => onOff(settings.colorblind), onAdjust: this.toggle('colorblind'), onSelect: this.toggle('colorblind') },
    ];
    this.lists = [audio, video, gameplay, [], access].map((items) => new MenuList(items, { ...style }));
    this.lists[3] = this.buildControls();
    for (const l of this.lists) l.onBack = () => this.onClose?.();
  }

  private buildControls(): MenuList {
    const target = this.controlsTarget;
    const items: MenuItem[] = [
      {
        id: 'device', label: t('settings.device'),
        value: () => (this.controlsTarget === 'k0' ? t('settings.p1keys') : this.controlsTarget === 'k1' ? t('settings.p2keys') : t('settings.pad')),
        onAdjust: (d) => {
          const order: ('k0' | 'k1' | 'pad')[] = ['k0', 'k1', 'pad'];
          this.controlsTarget = order[(order.indexOf(this.controlsTarget) + d + 3) % 3];
          const idx = this.lists[3].index;
          this.lists[3] = this.buildControls();
          this.lists[3].setIndex(idx);
        },
      },
    ];
    for (const a of ACTIONS) {
      items.push({
        id: a,
        label: t(`action.${a}` as StringKey),
        value: () => {
          if (this.capture && this.capture.action === a) return this.capture.kind === 'key' ? t('settings.press') : t('settings.pressPad');
          if (this.controlsTarget === 'pad') return settings.bindings[0].pad[a].map((i) => PAD_NAMES[i] ?? `B${i}`).join(' / ') || '-';
          const p = this.controlsTarget === 'k0' ? 0 : 1;
          return settings.bindings[p].keys[a].map(keyName).join(' / ') || '-';
        },
        onSelect: () => {
          this.capture = { action: a, kind: this.controlsTarget === 'pad' ? 'pad' : 'key', player: this.controlsTarget === 'k1' ? 1 : 0 };
          this.captureT = 0;
          app().input.capture = true;
          app().input.lastKeyCode = null;
          app().input.lastPadButton = null;
        },
      });
    }
    items.push({
      id: 'resetc', label: t('settings.resetControls'), onSelect: () => {
        settings.bindings = [defaultBindings(0), defaultBindings(1)];
        saveSettings();
      },
    });
    const l = new MenuList(items, { x: 300, y: 214, w: 680, itemH: 30, size: 15, accent: C.cyan, valueX: 360 });
    l.maxVisible = 14;
    l.onBack = () => this.onClose?.();
    void target;
    return l;
  }

  update(events: MenuEvent[]): void {
    this.open = Math.min(1, this.open + 0.08);
    const a = app();
    if (this.capture) {
      this.captureT++;
      const c = this.capture;
      if (c.kind === 'key' && a.input.lastKeyCode && this.captureT > 2) {
        const code = a.input.lastKeyCode;
        if (code !== 'Escape') {
          const b = settings.bindings[c.player].keys;
          // remove the key from other actions of this player to avoid conflicts
          for (const act of ACTIONS) b[act] = b[act].filter((k) => k !== code);
          b[c.action] = [code];
          saveSettings();
          a.sfx('ui_confirm');
        }
        this.endCapture();
      } else if (c.kind === 'pad' && a.input.lastPadButton && this.captureT > 2) {
        const btn = a.input.lastPadButton.button;
        for (const p of [0, 1]) {
          const b = settings.bindings[p].pad;
          for (const act of ACTIONS) b[act] = b[act].filter((k) => k !== btn);
          b[c.action] = [btn];
        }
        saveSettings();
        a.sfx('ui_confirm');
        this.endCapture();
      } else if (this.captureT > 600) this.endCapture();
      return;
    }
    const list = this.lists[this.tab];
    const rest: MenuEvent[] = [];
    for (const e of events) {
      if (e.k === 'tabL' || e.k === 'tabR') {
        this.tab = (this.tab + (e.k === 'tabL' ? -1 : 1) + TABS.length) % TABS.length;
        a.sfx('ui_tab');
      } else if (e.k === 'pause') { a.sfx('ui_back'); this.onClose?.(); return; }
      else rest.push(e);
    }
    // left/right on a non-adjustable row switches tabs
    const filtered = rest.filter((e) => {
      if ((e.k === 'left' || e.k === 'right') && !list.current.onAdjust) {
        this.tab = (this.tab + (e.k === 'left' ? -1 : 1) + TABS.length) % TABS.length;
        a.sfx('ui_tab');
        return false;
      }
      return true;
    });
    // pointer on tabs
    const p = a.input.pointer;
    if (p.clicked && p.y > 140 && p.y < 182) {
      const i = Math.floor((p.x - 300) / 136);
      if (i >= 0 && i < TABS.length && p.x >= 300) { this.tab = i; a.input.takeClick(); a.sfx('ui_tab'); }
    }
    this.lists[this.tab].update(filtered);
  }

  private endCapture(): void {
    this.capture = null;
    setTimeout(() => { app().input.capture = false; }, 0);
    app().input.clearMenu();
  }

  render(ctx: CanvasRenderingContext2D): void {
    const k = ease.outCubic(this.open);
    ctx.save();
    ctx.globalAlpha = k;
    panel(ctx, 250, 60, 780, 610, { fill: 'rgba(6,8,22,0.95)', edge: rgba(C.cyan, 0.5), glow: 1, cut: 18 });
    drawStrokeText(ctx, t('settings.title'), 280, 84, { size: 26, color: C.cyan, align: 'left', tracking: 0.8 });
    TABS.forEach((tk, i) => {
      const x = 300 + i * 136, y = 142;
      const sel = i === this.tab;
      chamferPath(ctx, x, y, 128, 38, 8);
      ctx.fillStyle = sel ? rgba(C.cyan, 0.25) : 'rgba(255,255,255,0.04)';
      ctx.fill();
      ctx.strokeStyle = sel ? C.cyan : 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      text(ctx, t(tk), x + 64, y + 25, { size: 14, weight: 800, font: 'display', tracking: 2, align: 'center', color: sel ? C.white : C.dim });
    });
    ctx.fillStyle = rgba(C.cyan, 0.25);
    ctx.fillRect(300, 190, 680, 1);
    this.lists[this.tab].render(ctx, k);
    const hint = this.capture ? t('hint.capture') : t('hint.settings');
    text(ctx, hint, 640, 650, { size: 12, weight: 700, font: 'display', tracking: 2, align: 'center', color: this.capture ? C.amber : C.dim });
    ctx.restore();
  }
}
