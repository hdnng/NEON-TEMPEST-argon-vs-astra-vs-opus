/**
 * Lightweight verlet chains for presentation-only secondary motion (headband tails, ponytails,
 * scarves, coat tails, belts). Not part of the deterministic simulation.
 * Coordinates are world pixels with +y up.
 */

export class Chain {
  readonly n: number;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly px: Float32Array;
  readonly py: Float32Array;
  seg: number;
  gravity = 0.55;
  drag = 0.9;
  stiffness = 1;
  private initialized = false;

  constructor(n: number, seg: number) {
    this.n = n;
    this.seg = seg;
    this.x = new Float32Array(n);
    this.y = new Float32Array(n);
    this.px = new Float32Array(n);
    this.py = new Float32Array(n);
  }

  /** Places all points hanging from the anchor (used on first update / teleports). */
  reset(ax: number, ay: number, dirX: number, dirY: number): void {
    for (let i = 0; i < this.n; i++) {
      this.x[i] = this.px[i] = ax + dirX * this.seg * i;
      this.y[i] = this.py[i] = ay + dirY * this.seg * i;
    }
    this.initialized = true;
  }

  /**
   * One verlet step. `ax, ay` anchor; `restX, restY` preferred direction (e.g. backwards from the
   * head) applied as a soft force; `windX` adds sway.
   */
  step(ax: number, ay: number, restX: number, restY: number, windX: number, restForce = 0.12): void {
    if (!this.initialized) this.reset(ax, ay, restX, restY);
    const { x, y, px, py, n, seg } = this;
    // teleport detection
    if (Math.abs(x[0] - ax) > 180 || Math.abs(y[0] - ay) > 180) this.reset(ax, ay, restX, restY);
    x[0] = ax; y[0] = ay; px[0] = ax; py[0] = ay;
    for (let i = 1; i < n; i++) {
      const vx = (x[i] - px[i]) * this.drag;
      const vy = (y[i] - py[i]) * this.drag;
      px[i] = x[i];
      py[i] = y[i];
      x[i] += vx + windX + restX * restForce;
      y[i] += vy - this.gravity + restY * restForce;
    }
    for (let it = 0; it < 3; it++) {
      for (let i = 1; i < n; i++) {
        const dx = x[i] - x[i - 1], dy = y[i] - y[i - 1];
        const d = Math.sqrt(dx * dx + dy * dy) || 0.0001;
        const diff = (d - seg) / d;
        if (i === 1) {
          x[i] -= dx * diff;
          y[i] -= dy * diff;
        } else {
          x[i] -= dx * diff * 0.5 * this.stiffness;
          y[i] -= dy * diff * 0.5 * this.stiffness;
          x[i - 1] += dx * diff * 0.5 * this.stiffness;
          y[i - 1] += dy * diff * 0.5 * this.stiffness;
        }
      }
      x[0] = ax; y[0] = ay;
    }
    // floor
    for (let i = 1; i < n; i++) if (y[i] < 1) y[i] = 1;
  }
}

/**
 * Draws a chain as a tapered ribbon in the current transform (world coords, y up).
 * Allocation-free.
 */
export function drawRibbon(ctx: CanvasRenderingContext2D, c: Chain, w0: number, w1: number, fill: string): void {
  const n = c.n;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const w = (w0 + (w1 - w0) * t) * 0.5;
    const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
    let dx = c.x[i1] - c.x[i0], dy = c.y[i1] - c.y[i0];
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    dx /= d; dy /= d;
    const nx = -dy * w, ny = dx * w;
    if (i === 0) ctx.moveTo(c.x[i] + nx, c.y[i] + ny);
    else ctx.lineTo(c.x[i] + nx, c.y[i] + ny);
  }
  for (let i = n - 1; i >= 0; i--) {
    const t = i / (n - 1);
    const w = (w0 + (w1 - w0) * t) * 0.5;
    const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
    let dx = c.x[i1] - c.x[i0], dy = c.y[i1] - c.y[i0];
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    dx /= d; dy /= d;
    ctx.lineTo(c.x[i] + dy * w, c.y[i] - dx * w);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/** Strokes the chain's center line (glow edges). */
export function strokeChain(ctx: CanvasRenderingContext2D, c: Chain, color: string, width: number): void {
  ctx.beginPath();
  ctx.moveTo(c.x[0], c.y[0]);
  for (let i = 1; i < c.n; i++) ctx.lineTo(c.x[i], c.y[i]);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}
