/**
 * Canvas view: a fixed logical resolution (1280x720) scaled uniformly to the window,
 * letterboxed, rendered at devicePixelRatio x resolution scale for crisp output.
 */
export const W = 1280;
export const H = 720;

export class View {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  /** Device pixels per logical pixel. */
  scale = 1;
  offX = 0;
  offY = 0;
  dpr = 1;
  resScale = 1;
  cssW = W;
  cssH = H;
  private listeners: (() => void)[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D not supported');
    this.ctx = ctx;
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  onResize(fn: () => void): void { this.listeners.push(fn); }

  setResolutionScale(s: number): void {
    this.resScale = s;
    this.resize();
  }

  resize(): void {
    this.cssW = Math.max(1, window.innerWidth);
    this.cssH = Math.max(1, window.innerHeight);
    this.dpr = Math.min(3, (window.devicePixelRatio || 1)) * this.resScale;
    const pw = Math.round(this.cssW * this.dpr);
    const ph = Math.round(this.cssH * this.dpr);
    if (this.canvas.width !== pw || this.canvas.height !== ph) {
      this.canvas.width = pw;
      this.canvas.height = ph;
    }
    this.canvas.style.width = this.cssW + 'px';
    this.canvas.style.height = this.cssH + 'px';
    const fit = Math.min(pw / W, ph / H);
    this.scale = fit;
    this.offX = Math.round((pw - W * fit) / 2);
    this.offY = Math.round((ph - H * fit) / 2);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'low';
    for (const l of this.listeners) l();
  }

  /** Clears the letterbox area and sets the logical transform + clip. */
  begin(): void {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (this.offX > 0 || this.offY > 0) {
      ctx.fillStyle = '#020309';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    ctx.save();
    ctx.setTransform(this.scale, 0, 0, this.scale, this.offX, this.offY);
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();
  }

  end(): void {
    this.ctx.restore();
  }

  /** Converts client (CSS) coordinates to logical coordinates. */
  toLogical(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const px = (clientX - rect.left) * (this.canvas.width / rect.width);
    const py = (clientY - rect.top) * (this.canvas.height / rect.height);
    return { x: (px - this.offX) / this.scale, y: (py - this.offY) / this.scale };
  }

  /** Backing-store pixels per logical pixel (for offscreen caches). */
  get pixelRatio(): number { return this.scale; }
}
