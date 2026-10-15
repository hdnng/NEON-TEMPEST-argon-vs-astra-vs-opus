import { CpuDifficulty } from '../ai/cpuController';

export interface GameSettings {
  masterVolume: number;      // 0..100
  musicVolume: number;       // 0..100
  sfxVolume: number;         // 0..100
  muted: boolean;
  screenShake: boolean;
  reduceFlashes: boolean;
  colorblindMode: boolean;
  showHud: boolean;
  showInputHistory: boolean;
  resolutionScale: number;   // 0.75 | 1.0 | 1.25
  cpuDifficulty: CpuDifficulty;
}

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 80,
  musicVolume: 65,
  sfxVolume: 85,
  muted: false,
  screenShake: true,
  reduceFlashes: false,
  colorblindMode: false,
  showHud: true,
  showInputHistory: false,
  resolutionScale: 1.0,
  cpuDifficulty: 'medium'
};

const STORAGE_KEY_SETTINGS = 'neon_tempest_settings_v1';

export class SettingsManager {
  public values: GameSettings = { ...DEFAULT_SETTINGS };

  constructor() {
    this.load();
  }

  public load(): void {
    try {
      const raw =
        typeof localStorage !== 'undefined'
          ? localStorage.getItem(STORAGE_KEY_SETTINGS)
          : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        this.values = { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch {
      // Ignore storage errors
    }
  }

  public save(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(this.values));
      }
    } catch {
      // Ignore storage errors
    }
  }

  public reset(): void {
    this.values = { ...DEFAULT_SETTINGS };
    this.save();
  }
}
