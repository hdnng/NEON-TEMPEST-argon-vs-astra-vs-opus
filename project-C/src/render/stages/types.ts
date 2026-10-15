/**
 * Stage renderer contract. Stages are fully procedural: static parallax layers are pre-rendered
 * once into offscreen canvases in `init`, animated elements (rain, neon flicker, holograms,
 * crowd, vehicles) are drawn each frame from pooled data.
 *
 * All drawing happens in logical screen coordinates (1280x720) using the camera helpers in
 * ../camera.ts. The floor plane is world y = 0 and spans at least x in [-STAGE_HALF-200, STAGE_HALF+200].
 */
import type { Camera } from '../camera';

export interface StageInfo {
  id: string;
  name: string;
  /** Short location line, e.g. "Shinsei Tower, Rooftop 88F". */
  location: string;
  description: string;
  /** Music track id (see audio/types.ts). */
  music: string;
  ambience: 'rain' | 'storm' | 'crowd';
  /** Accent colors used by menus / VS screen for this stage. */
  accent: string;
  accent2: string;
}

export interface StageLight {
  /** Rim light color applied to fighters. */
  rim: string;
  /** Ambient color multiplied over fighters (subtle). */
  ambient: string;
  /** Strength (0..1) of the wet-floor reflection of fighters. */
  reflection: number;
  /** Floor color under fighters, used for contact shadows. */
  shadow: string;
}

export interface Stage {
  readonly info: StageInfo;
  readonly light: StageLight;
  /**
   * Pre-renders static layers. `pixelRatio` = device pixels per logical pixel (cap internal
   * caches at ~1.5x for far layers), `quality` 0 (low) .. 2 (high) scales particle counts.
   */
  init(pixelRatio: number, quality: number): void;
  /** Advances animation by one 60 Hz tick. `t` = seconds since the stage started. */
  update(t: number, cam: Camera): void;
  /** Everything behind the fighters, including the floor. */
  drawBack(ctx: CanvasRenderingContext2D, cam: Camera, t: number): void;
  /** Foreground elements in front of the fighters (rain sheets, fog, near props). */
  drawFront(ctx: CanvasRenderingContext2D, cam: Camera, t: number): void;
  /** Reacts to match moments: 'hit_heavy', 'super', 'ko', 'round_start', 'perfect'. */
  onEvent(kind: string, intensity: number): void;
  /** Releases offscreen canvases. */
  dispose(): void;
}

export interface StageOptions {
  flashReduction: boolean;
}

export type StageFactory = (opts: StageOptions) => Stage;
