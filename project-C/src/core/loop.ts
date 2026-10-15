/**
 * Fixed-timestep game loop: the simulation and all scene logic tick at exactly 60 Hz,
 * decoupled from the display refresh. Rendering receives an interpolation alpha.
 * Small rAF jitter around the 60/120/144 Hz periods is snapped to avoid double/zero steps.
 */
export const STEP_MS = 1000 / 60;

export interface LoopHooks {
  update(): void;
  render(alpha: number, frameMs: number): void;
  beforeUpdate?(): void;
}

export class Loop {
  private acc = 0;
  private last = 0;
  private raf = 0;
  private running = false;
  /** Multiplier for debug / replays (2 = double speed). */
  speed = 1;
  /** Frame time samples for the FPS overlay / benchmark. */
  lastFrameMs = 16.7;

  constructor(private hooks: LoopHooks) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.acc = 0;
    const tick = (now: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(tick);
      this.frame(now);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** Resets timing after the tab becomes visible again (no catch-up burst). */
  resetClock(): void {
    this.last = performance.now();
    this.acc = 0;
  }

  private frame(now: number): void {
    let dt = now - this.last;
    this.last = now;
    this.lastFrameMs = dt;
    if (dt > 250) dt = STEP_MS; // tab was hidden or a long stall: don't spiral
    // vsync snapping for common refresh rates
    for (const div of [1, 2, 2.4]) {
      const target = STEP_MS / div;
      if (Math.abs(dt - target) < 0.75) { dt = target; break; }
    }
    this.acc += dt * this.speed;
    this.hooks.beforeUpdate?.();
    let steps = 0;
    while (this.acc >= STEP_MS && steps < 6) {
      this.hooks.update();
      this.acc -= STEP_MS;
      steps++;
    }
    if (steps >= 6) this.acc = 0;
    this.hooks.render(this.acc / STEP_MS, dt);
  }
}
