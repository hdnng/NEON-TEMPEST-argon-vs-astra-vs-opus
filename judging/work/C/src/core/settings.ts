/**
 * Persistent user settings (localStorage). All access goes through `settings` + `saveSettings`.
 */

export type Action =
  | 'up' | 'down' | 'left' | 'right'
  | 'LP' | 'MP' | 'HP' | 'LK' | 'MK' | 'HK'
  | 'throw' | 'drive' | 'PPP' | 'KKK' | 'start';

export const ACTIONS: Action[] = ['up', 'down', 'left', 'right', 'LP', 'MP', 'HP', 'LK', 'MK', 'HK', 'throw', 'drive', 'PPP', 'KKK', 'start'];

export interface Bindings {
  /** KeyboardEvent.code values per action (several allowed). */
  keys: Record<Action, string[]>;
  /** Standard-mapping gamepad button indices per action. */
  pad: Record<Action, number[]>;
}

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
  screenShake: boolean;
  flashReduction: boolean;
  colorblind: boolean;
  showInputHistory: boolean;
  showDamage: boolean;
  showHud: boolean;
  showFps: boolean;
  /** Render resolution multiplier; 0 = automatic (dynamic resolution). */
  resolutionScale: number;
  difficulty: number; // 0 easy .. 3 hard
  bindings: [Bindings, Bindings];
  language: string;
}

export function defaultBindings(player: 0 | 1): Bindings {
  if (player === 0) {
    return {
      keys: {
        up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'],
        LP: ['KeyU'], MP: ['KeyI'], HP: ['KeyO'], LK: ['KeyJ'], MK: ['KeyK'], HK: ['KeyL'],
        throw: ['KeyH'], drive: ['KeyP'], PPP: ['KeyY'], KKK: ['KeyN'], start: ['Enter'],
      },
      pad: defaultPad(),
    };
  }
  return {
    keys: {
      up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
      LP: ['Numpad4', 'Insert'], MP: ['Numpad5', 'Home'], HP: ['Numpad6', 'PageUp'],
      LK: ['Numpad1', 'Delete'], MK: ['Numpad2', 'End'], HK: ['Numpad3', 'PageDown'],
      throw: ['Numpad7'], drive: ['Numpad8'], PPP: ['Numpad9'], KKK: ['Numpad0'], start: ['NumpadEnter'],
    },
    pad: defaultPad(),
  };
}

function defaultPad(): Record<Action, number[]> {
  return {
    up: [12], down: [13], left: [14], right: [15],
    LP: [2], MP: [3], HP: [5], LK: [0], MK: [1], HK: [7],
    throw: [4], drive: [6], PPP: [10], KKK: [11], start: [9],
  };
}

export function defaultSettings(): Settings {
  return {
    master: 0.8,
    music: 0.6,
    sfx: 0.85,
    muted: false,
    screenShake: true,
    flashReduction: false,
    colorblind: false,
    showInputHistory: false,
    showDamage: true,
    showHud: true,
    showFps: false,
    resolutionScale: 0,
    difficulty: 1,
    bindings: [defaultBindings(0), defaultBindings(1)],
    language: 'en',
  };
}

const KEY = 'neon-tempest-settings-v1';

function load(): Settings {
  const d = defaultSettings();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return d;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    const s = { ...d, ...parsed } as Settings;
    // ensure every action exists in bindings (forward compatibility)
    for (let p = 0; p < 2; p++) {
      const def = defaultBindings(p as 0 | 1);
      const b = s.bindings?.[p];
      if (!b) { s.bindings[p] = def; continue; }
      b.keys = { ...def.keys, ...b.keys };
      b.pad = { ...def.pad, ...b.pad };
    }
    return s;
  } catch {
    return d;
  }
}

export const settings: Settings = typeof localStorage !== 'undefined' ? load() : defaultSettings();

const listeners: (() => void)[] = [];
export function onSettingsChange(fn: () => void): void { listeners.push(fn); }

export function saveSettings(): void {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* storage unavailable */ }
  for (const l of listeners) l();
}

export function resetSettings(): void {
  Object.assign(settings, defaultSettings());
  saveSettings();
}
