export interface Particle {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  kind: number;
}
export class Particles {
  pool: Particle[] = Array.from({ length: 520 }, () => ({
    alive: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    max: 0,
    size: 0,
    color: "",
    kind: 0,
  }));
  cursor = 0;
  emit(x: number, y: number, color: string, count = 18, power = 1, kind = 0) {
    for (let n = 0; n < count; n++) {
      const p = this.pool[this.cursor++ % this.pool.length],
        angle = Math.random() * Math.PI * 2,
        speed = (2 + Math.random() * 8) * power;
      Object.assign(p, {
        alive: true,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 18 + Math.random() * 20,
        max: 40,
        size: 1 + Math.random() * 3 * power,
        color,
        kind,
      });
    }
  }
  update(dt: number) {
    for (const p of this.pool)
      if (p.alive) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= Math.pow(0.94, dt);
        p.vy += 0.14 * dt;
        if (p.life <= 0) p.alive = false;
      }
  }
  draw(c: CanvasRenderingContext2D) {
    c.save();
    c.globalCompositeOperation = "lighter";
    for (const p of this.pool)
      if (p.alive) {
        c.globalAlpha = Math.min(1, p.life / 12);
        c.strokeStyle = p.color;
        c.fillStyle = p.color;
        c.lineWidth = p.size;
        if (p.kind === 1) {
          c.beginPath();
          c.arc(p.x, p.y, (p.max - p.life) * 1.8, 0, Math.PI * 2);
          c.stroke();
        } else {
          c.beginPath();
          c.moveTo(p.x, p.y);
          c.lineTo(p.x - p.vx * 2.5, p.y - p.vy * 2.5);
          c.stroke();
        }
      }
    c.restore();
  }
  clear() {
    for (const p of this.pool) p.alive = false;
  }
}
