/**
 * Audio API contract. Everything is synthesized with the Web Audio API at runtime
 * (oscillators, noise buffers, filters, envelopes) - there are no audio files.
 */

export type SfxName =
  // UI
  | 'ui_move' | 'ui_confirm' | 'ui_back' | 'ui_error' | 'ui_tab' | 'ui_start' | 'ui_select_char' | 'ui_slide'
  // movement
  | 'jump' | 'land' | 'dash' | 'step'
  // attacks
  | 'whiff_light' | 'whiff_medium' | 'whiff_heavy'
  | 'hit_light' | 'hit_medium' | 'hit_heavy' | 'hit_special' | 'hit_super' | 'counter'
  | 'block' | 'block_heavy' | 'armor' | 'parry'
  | 'grab' | 'throw_slam' | 'tech'
  // specials / projectiles
  | 'proj_orb' | 'proj_lance' | 'proj_disc' | 'proj_wave' | 'clash' | 'rise' | 'spin' | 'teleport' | 'charge_rush'
  // meter / systems
  | 'super_flash' | 'ult_flash' | 'drive' | 'burnout' | 'guardcancel' | 'pushblock' | 'meter_stock'
  | 'dizzy' | 'knockdown' | 'quickrise'
  // round flow
  | 'announce_round' | 'announce_fight' | 'ko' | 'perfect' | 'timeover' | 'timer_tick' | 'crowd_cheer' | 'victory_sting';

export type TrackId =
  | 'title' | 'menu' | 'select' | 'versus'
  | 'stage_rooftop' | 'stage_shrine' | 'stage_pit'
  | 'training' | 'victory' | 'results';

export type Ambience = 'none' | 'rain' | 'storm' | 'crowd';

export interface SfxOptions {
  /** Stereo pan -1..1. */
  pan?: number;
  /** Volume multiplier 0..2. */
  vol?: number;
  /** Pitch multiplier (1 = normal). */
  pitch?: number;
}

export interface AudioAPI {
  /** Must be called from a user gesture before audio can play (autoplay policy). */
  unlock(): void;
  readonly unlocked: boolean;
  setVolumes(master: number, music: number, sfx: number, muted: boolean): void;
  sfx(name: SfxName, opts?: SfxOptions): void;
  /** Crossfades to a music track (null = stop). Re-requesting the current track is a no-op. */
  music(track: TrackId | null, fadeSeconds?: number): void;
  ambience(kind: Ambience): void;
  /** Temporarily lowers music (e.g. during super cut-ins). */
  duck(amount: number, seconds: number): void;
  /** Low-pass "muffled" music while paused. */
  setMuffled(on: boolean): void;
  /** Suspends / resumes the AudioContext (tab hidden). */
  suspend(): void;
  resume(): void;
  /** Current music beat phase 0..1 and beat counter, for UI pulses. */
  beat(): { phase: number; count: number; bpm: number };
}
