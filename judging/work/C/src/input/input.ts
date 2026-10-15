/**
 * Device layer: keyboard + Gamepad API + pointer. Produces
 *  - per-player game input bits (with macros and SOCD cleaning) sampled once per sim frame,
 *  - menu navigation events (with key repeat) aggregated from every device,
 *  - pointer events in logical coordinates for mouse / touch.
 */
import { settings, type Action } from '../core/settings';
import type { View } from '../core/view';
import { DOWN, HK, HP, LEFT, LK, LP, MK, MP, RIGHT, UP, socd } from '../sim/input';

export type MenuKey = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back' | 'start' | 'pause' | 'select' | 'tabL' | 'tabR' | 'alt';

const ACTION_BITS: Partial<Record<Action, number>> = {
  up: UP, down: DOWN, left: LEFT, right: RIGHT,
  LP, MP, HP, LK, MK, HK,
  throw: LP | LK, drive: MP | MK, PPP: LP | MP | HP, KKK: LK | MK | HK,
};

const MENU_KEYS: Record<string, MenuKey> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
  Space: 'confirm', KeyU: 'confirm', KeyJ: 'confirm',
  Escape: 'back', Backspace: 'back', KeyI: 'back', KeyK: 'back',
  KeyQ: 'tabL', KeyE: 'tabR', PageUp: 'tabL', PageDown: 'tabR', Tab: 'tabR',
  KeyF: 'alt', KeyO: 'alt',
};

export interface MenuEvent { k: MenuKey; p: number }

export interface PointerState { x: number; y: number; down: boolean; clicked: boolean; moved: boolean; wheel: number }

export class Input {
  private keys = new Set<string>();
  private pressedQueue: MenuEvent[] = [];
  private repeatTimers: Record<string, number> = {};
  private padPrev: boolean[][] = [[], [], [], []];
  private padMenuPrev: Record<string, boolean> = {};
  /** Last key code pressed (for remapping UI). */
  lastKeyCode: string | null = null;
  lastPadButton: { pad: number; button: number } | null = null;
  pointer: PointerState = { x: -1, y: -1, down: false, clicked: false, moved: false, wheel: 0 };
  /** When true, all devices drive player 1 (single-player modes). */
  singlePlayer = true;
  /** Disable game bindings while remapping. */
  capture = false;
  anyInputThisFrame = false;
  private pads: Gamepad[] = [];

  constructor(private view: View) {
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => this.keys.clear());
    const c = view.canvas;
    c.addEventListener('pointermove', (e) => this.onPointer(e, 'move'));
    c.addEventListener('pointerdown', (e) => this.onPointer(e, 'down'));
    window.addEventListener('pointerup', (e) => this.onPointer(e, 'up'));
    c.addEventListener('wheel', (e) => { this.pointer.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    const code = e.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'Backspace'].includes(code)) e.preventDefault();
    if (down) {
      if (!e.repeat) {
        this.lastKeyCode = code;
        this.anyInputThisFrame = true;
        const mk = MENU_KEYS[code];
        const pl = this.keyPlayer(code);
        if (mk) this.pushMenu(mk, pl);
        if (code === 'Escape') this.pushMenu('pause', 0);
        if (code === 'F1' || code === 'F2' || code === 'F4') e.preventDefault();
        // start keys (Enter by default) emit a single 'start' event: confirm in menus, pause in matches
        let started = false;
        settings.bindings.forEach((b, i) => {
          if (!started && b.keys.start.includes(code)) { this.pushMenu('start', i); started = true; }
        });
        if (!started && (code === 'Enter' || code === 'NumpadEnter')) this.pushMenu('start', pl);
      }
      this.keys.add(code);
    } else {
      this.keys.delete(code);
    }
  }

  private onPointer(e: PointerEvent, kind: 'move' | 'down' | 'up'): void {
    const p = this.view.toLogical(e.clientX, e.clientY);
    this.pointer.x = p.x;
    this.pointer.y = p.y;
    if (kind === 'move') this.pointer.moved = true;
    if (kind === 'down') { this.pointer.down = true; this.anyInputThisFrame = true; }
    if (kind === 'up') {
      if (this.pointer.down) this.pointer.clicked = true;
      this.pointer.down = false;
    }
  }

  private pushMenu(k: MenuKey, p: number): void {
    this.pressedQueue.push({ k, p });
  }

  /** Which player a keyboard key belongs to (for 2-player menus such as character select). */
  private keyPlayer(code: string): number {
    const b1 = settings.bindings[1].keys;
    for (const a in b1) if (b1[a as Action].includes(code)) return 1;
    if (code.startsWith('Arrow') || code.startsWith('Numpad')) return 1;
    return 0;
  }

  /** Polls gamepads; call once per rendered frame before updates. */
  poll(): void {
    const list = navigator.getGamepads ? navigator.getGamepads() : [];
    this.pads = [];
    for (const p of list) if (p && p.connected) this.pads.push(p);
    // menu events from gamepads (edge-triggered + repeat on directions)
    const now = performance.now();
    const held: Partial<Record<string, boolean>> = {};
    this.pads.forEach((p, pi) => {
      const b = (i: number) => !!p.buttons[i]?.pressed;
      const ax = p.axes[0] ?? 0, ay = p.axes[1] ?? 0;
      const pl = Math.min(pi, 1);
      held[pl + 'up'] = held[pl + 'up'] || b(12) || ay < -0.6;
      held[pl + 'down'] = held[pl + 'down'] || b(13) || ay > 0.6;
      held[pl + 'left'] = held[pl + 'left'] || b(14) || ax < -0.6;
      held[pl + 'right'] = held[pl + 'right'] || b(15) || ax > 0.6;
      const edge = (name: string, on: boolean, mk: MenuKey) => {
        const key = pi + name;
        if (on && !this.padMenuPrev[key]) { this.pushMenu(mk, Math.min(pi, 1)); this.anyInputThisFrame = true; }
        this.padMenuPrev[key] = on;
      };
      edge('a', b(0), 'confirm');
      edge('b', b(1), 'back');
      edge('start', b(9), 'start');
      edge('select', b(8), 'select');
      edge('lb', b(4), 'tabL');
      edge('rb', b(5), 'tabR');
      edge('y', b(3), 'alt');
      // raw button capture for remapping
      p.buttons.forEach((btn, i) => {
        const prev = this.padPrev[pi][i];
        if (btn.pressed && !prev) this.lastPadButton = { pad: pi, button: i };
        this.padPrev[pi][i] = btn.pressed;
      });
    });
    for (const pl of [0, 1]) {
      for (const k of ['up', 'down', 'left', 'right'] as MenuKey[]) {
        const id = pl + k;
        if (held[id]) {
          const t = this.repeatTimers[id];
          if (t === undefined) { this.pushMenu(k, pl); this.repeatTimers[id] = now + 380; this.anyInputThisFrame = true; }
          else if (now >= t) { this.pushMenu(k, pl); this.repeatTimers[id] = now + 110; }
        } else delete this.repeatTimers[id];
      }
    }
  }

  /** Consumes and returns menu events since the last call. */
  menuEvents(): MenuEvent[] {
    return this.menuEventsTagged();
  }

  /** Consumes menu events with the player they came from (0 / 1). */
  menuEventsTagged(): MenuEvent[] {
    const q = this.pressedQueue;
    this.pressedQueue = [];
    return q;
  }

  clearMenu(): void { this.pressedQueue = []; }

  /** Pointer click consumed by UI. */
  takeClick(): boolean {
    const c = this.pointer.clicked;
    this.pointer.clicked = false;
    return c;
  }

  endFrame(): void {
    this.pointer.clicked = false;
    this.pointer.moved = false;
    this.pointer.wheel = 0;
    this.anyInputThisFrame = false;
  }

  /** Whether a raw key is held. */
  keyDown(code: string): boolean { return this.keys.has(code); }

  private padBits(pad: Gamepad, player: 0 | 1): number {
    let bits = 0;
    const map = settings.bindings[player].pad;
    for (const a in map) {
      const act = a as Action;
      const v = ACTION_BITS[act];
      if (!v) continue;
      for (const i of map[act]) if (pad.buttons[i]?.pressed) bits |= v;
    }
    const ax = pad.axes[0] ?? 0, ay = pad.axes[1] ?? 0;
    if (ax < -0.5) bits |= LEFT;
    if (ax > 0.5) bits |= RIGHT;
    if (ay < -0.5) bits |= UP;
    if (ay > 0.5) bits |= DOWN;
    return bits;
  }

  private keyBits(player: 0 | 1): number {
    let bits = 0;
    const map = settings.bindings[player].keys;
    for (const a in map) {
      const act = a as Action;
      const v = ACTION_BITS[act];
      if (!v) continue;
      for (const code of map[act]) if (this.keys.has(code)) { bits |= v; break; }
    }
    return bits;
  }

  /** Game input bits for a player this frame (SOCD-cleaned). */
  playerBits(player: 0 | 1): number {
    if (this.capture) return 0;
    let bits = 0;
    if (this.singlePlayer) {
      if (player !== 0) return 0;
      bits = this.keyBits(0) | this.keyBits(1);
      for (const p of this.pads) bits |= this.padBits(p, 0);
    } else {
      bits = this.keyBits(player);
      const pad = this.pads[player];
      if (pad) bits |= this.padBits(pad, player);
    }
    return socd(bits);
  }

  get padCount(): number { return this.pads.length; }
  padName(i: number): string { return this.pads[i]?.id ?? ''; }
}
