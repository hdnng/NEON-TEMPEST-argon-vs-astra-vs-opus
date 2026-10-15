import { RawInputFrame } from '../core/types';

export interface KeyBindings {
  up: string;
  down: string;
  left: string;
  right: string;
  lp: string;
  mp: string;
  hp: string;
  lk: string;
  mk: string;
  hk: string;
  throwMacro: string;
  parryMacro: string;
  overdriveMacro: string;
}

export const DEFAULT_P1_KEYS: KeyBindings = {
  up: 'KeyW',
  down: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  lp: 'KeyU',
  mp: 'KeyI',
  hp: 'KeyO',
  lk: 'KeyJ',
  mk: 'KeyK',
  hk: 'KeyL',
  throwMacro: 'KeyY',
  parryMacro: 'KeyH',
  overdriveMacro: 'KeyP'
};

export const DEFAULT_P2_KEYS: KeyBindings = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  lp: 'Numpad4',
  mp: 'Numpad5',
  hp: 'Numpad6',
  lk: 'Numpad1',
  mk: 'Numpad2',
  hk: 'Numpad3',
  throwMacro: 'Numpad7',
  parryMacro: 'Numpad8',
  overdriveMacro: 'Numpad9'
};

export function createEmptyInput(): RawInputFrame {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    lp: false,
    mp: false,
    hp: false,
    lk: false,
    mk: false,
    hk: false,
    throwMacro: false,
    parryMacro: false,
    overdriveMacro: false,
    exMacro: false
  };
}

export function formatKeyCode(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'NUM ' + code.slice(6);
  if (code.startsWith('Arrow')) return code.slice(5).toUpperCase();
  if (code === 'Space') return 'SPACE';
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'SHIFT';
  if (code === 'Enter') return 'ENTER';
  return code;
}

const STORAGE_KEY_BINDS = 'neon_tempest_keybinds_v1';

export class InputManager {
  private keysDown = new Set<string>();
  private keysJustPressed = new Set<string>();
  public p1Keys: KeyBindings = { ...DEFAULT_P1_KEYS };
  public p2Keys: KeyBindings = { ...DEFAULT_P2_KEYS };
  private listeningCallback: ((code: string) => void) | null = null;
  private prevGamepadButtons: boolean[][] = [[], []];

  constructor() {
    this.loadBindings();
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (e) => {
        if (this.listeningCallback) {
          e.preventDefault();
          const cb = this.listeningCallback;
          this.listeningCallback = null;
          cb(e.code);
          return;
        }
        // Prevent browser scrolling on arrows / space
        if (
          ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)
        ) {
          e.preventDefault();
        }
        if (!this.keysDown.has(e.code)) {
          this.keysJustPressed.add(e.code);
        }
        this.keysDown.add(e.code);
      });

      window.addEventListener('keyup', (e) => {
        this.keysDown.delete(e.code);
      });

      window.addEventListener('blur', () => {
        this.keysDown.clear();
        this.keysJustPressed.clear();
      });
    }
  }

  public loadBindings(): void {
    try {
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_BINDS) : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.p1) this.p1Keys = { ...DEFAULT_P1_KEYS, ...parsed.p1 };
        if (parsed.p2) this.p2Keys = { ...DEFAULT_P2_KEYS, ...parsed.p2 };
      }
    } catch {
      // Ignore storage errors
    }
  }

  public saveBindings(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(
          STORAGE_KEY_BINDS,
          JSON.stringify({ p1: this.p1Keys, p2: this.p2Keys })
        );
      }
    } catch {
      // Ignore storage errors
    }
  }

  public resetBindings(): void {
    this.p1Keys = { ...DEFAULT_P1_KEYS };
    this.p2Keys = { ...DEFAULT_P2_KEYS };
    this.saveBindings();
  }

  public listenForNextKey(callback: (code: string) => void): void {
    this.listeningCallback = callback;
  }

  public cancelListen(): void {
    this.listeningCallback = null;
  }

  public isListening(): boolean {
    return this.listeningCallback !== null;
  }

  public isKeyDown(code: string): boolean {
    return this.keysDown.has(code);
  }

  public consumeJustPressed(code: string): boolean {
    if (this.keysJustPressed.has(code)) {
      this.keysJustPressed.delete(code);
      return true;
    }
    return false;
  }

  public clearJustPressed(): void {
    this.keysJustPressed.clear();
  }

  /**
   * Polls combined Keyboard + Gamepad input for Player 1 (index 0) or Player 2 (index 1).
   * In 1P modes (Arcade, Training, Trials, vs CPU), arrow keys also work as a fallback for P1 movement!
   */
  public pollPlayerInput(playerIndex: 0 | 1, allowP1ArrowFallback = false): RawInputFrame {
    const binds = playerIndex === 0 ? this.p1Keys : this.p2Keys;
    const raw: RawInputFrame = {
      up: this.keysDown.has(binds.up) || (allowP1ArrowFallback && playerIndex === 0 && this.keysDown.has('ArrowUp')),
      down: this.keysDown.has(binds.down) || (allowP1ArrowFallback && playerIndex === 0 && this.keysDown.has('ArrowDown')),
      left: this.keysDown.has(binds.left) || (allowP1ArrowFallback && playerIndex === 0 && this.keysDown.has('ArrowLeft')),
      right: this.keysDown.has(binds.right) || (allowP1ArrowFallback && playerIndex === 0 && this.keysDown.has('ArrowRight')),
      lp: this.keysDown.has(binds.lp) || (allowP1ArrowFallback && playerIndex === 0 && this.keysDown.has('KeyZ')),
      mp: this.keysDown.has(binds.mp) || (allowP1ArrowFallback && playerIndex === 0 && this.keysDown.has('KeyX')),
      hp: this.keysDown.has(binds.hp) || (allowP1ArrowFallback && playerIndex === 0 && this.keysDown.has('KeyC')),
      lk: this.keysDown.has(binds.lk) || (allowP1ArrowFallback && playerIndex === 0 && this.keysDown.has('KeyV')),
      mk: this.keysDown.has(binds.mk) || (allowP1ArrowFallback && playerIndex === 0 && this.keysDown.has('KeyB')),
      hk: this.keysDown.has(binds.hk) || (allowP1ArrowFallback && playerIndex === 0 && this.keysDown.has('KeyN')),
      throwMacro: this.keysDown.has(binds.throwMacro),
      parryMacro: this.keysDown.has(binds.parryMacro),
      overdriveMacro: this.keysDown.has(binds.overdriveMacro),
      exMacro: false
    };

    // Merge Gamepad API
    if (typeof navigator !== 'undefined' && navigator.getGamepads) {
      const pads = navigator.getGamepads();
      const pad = pads[playerIndex];
      if (pad && pad.connected) {
        const axX = pad.axes[0] ?? 0;
        const axY = pad.axes[1] ?? 0;
        if (axY < -0.45 || pad.buttons[12]?.pressed) raw.up = true;
        if (axY > 0.45 || pad.buttons[13]?.pressed) raw.down = true;
        if (axX < -0.45 || pad.buttons[14]?.pressed) raw.left = true;
        if (axX > 0.45 || pad.buttons[15]?.pressed) raw.right = true;

        // Standard 6-button pad mapping:
        // X (2) = LP, Y (3) = MP, RB (5) = HP
        // A (0) = LK, B (1) = MK, RT (7) = HK
        // LB (4) = Throw/Parry, LT (6) = Overdrive
        if (pad.buttons[2]?.pressed) raw.lp = true;
        if (pad.buttons[3]?.pressed) raw.mp = true;
        if (pad.buttons[5]?.pressed) raw.hp = true;
        if (pad.buttons[0]?.pressed) raw.lk = true;
        if (pad.buttons[1]?.pressed) raw.mk = true;
        if (pad.buttons[7]?.pressed) raw.hk = true;
        if (pad.buttons[4]?.pressed) raw.parryMacro = true;
        if (pad.buttons[6]?.pressed) raw.overdriveMacro = true;
      }
    }

    return raw;
  }

  /**
   * UI Menu navigation polling (consumes just-pressed events for crisp menu navigation).
   */
  public pollMenuNav(): {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
    confirm: boolean;
    back: boolean;
    pause: boolean;
    p2Up: boolean;
    p2Down: boolean;
    p2Left: boolean;
    p2Right: boolean;
    p2Confirm: boolean;
  } {
    let gUp = false;
    let gDown = false;
    let gLeft = false;
    let gRight = false;
    let gConfirm = false;
    let gBack = false;
    let gPause = false;

    if (typeof navigator !== 'undefined' && navigator.getGamepads) {
      const pads = navigator.getGamepads();
      const pad = pads[0];
      if (pad && pad.connected) {
        const prev = this.prevGamepadButtons[0];
        const curr = pad.buttons.map((b) => b.pressed);
        if (curr[12] && !prev[12]) gUp = true;
        if (curr[13] && !prev[13]) gDown = true;
        if (curr[14] && !prev[14]) gLeft = true;
        if (curr[15] && !prev[15]) gRight = true;
        if (curr[0] && !prev[0]) gConfirm = true;
        if (curr[1] && !prev[1]) gBack = true;
        if (curr[9] && !prev[9]) gPause = true;
        this.prevGamepadButtons[0] = curr;
      }
    }

    const up =
      this.consumeJustPressed(this.p1Keys.up) ||
      this.consumeJustPressed('ArrowUp') ||
      gUp;
    const down =
      this.consumeJustPressed(this.p1Keys.down) ||
      this.consumeJustPressed('ArrowDown') ||
      gDown;
    const left =
      this.consumeJustPressed(this.p1Keys.left) ||
      this.consumeJustPressed('ArrowLeft') ||
      gLeft;
    const right =
      this.consumeJustPressed(this.p1Keys.right) ||
      this.consumeJustPressed('ArrowRight') ||
      gRight;
    const confirm =
      this.consumeJustPressed('Enter') ||
      this.consumeJustPressed('Space') ||
      this.consumeJustPressed(this.p1Keys.lp) ||
      this.consumeJustPressed(this.p1Keys.lk) ||
      gConfirm;
    const back =
      this.consumeJustPressed('Escape') ||
      this.consumeJustPressed('Backspace') ||
      gBack;
    const pause =
      this.consumeJustPressed('Escape') ||
      this.consumeJustPressed('KeyP') ||
      gPause;

    const p2Up = this.consumeJustPressed(this.p2Keys.up);
    const p2Down = this.consumeJustPressed(this.p2Keys.down);
    const p2Left = this.consumeJustPressed(this.p2Keys.left);
    const p2Right = this.consumeJustPressed(this.p2Keys.right);
    const p2Confirm =
      this.consumeJustPressed(this.p2Keys.lp) ||
      this.consumeJustPressed(this.p2Keys.lk) ||
      this.consumeJustPressed('NumpadEnter');

    return {
      up,
      down,
      left,
      right,
      confirm,
      back,
      pause,
      p2Up,
      p2Down,
      p2Left,
      p2Right,
      p2Confirm
    };
  }
}
