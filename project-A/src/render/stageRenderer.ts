import { STAGES } from '../data/stages';
import { StageId } from '../core/types';

interface RainDrop {
  x: number;
  y: number;
  length: number;
  speed: number;
}

export const STAGE_FLOOR_SCREEN_Y = 600;

export class StageRenderer {
  private rainDrops: RainDrop[] = [];

  constructor() {
    for (let i = 0; i < 140; i++) {
      this.rainDrops.push({
        x: Math.random() * 1600 - 160,
        y: Math.random() * 720,
        length: 16 + Math.random() * 22,
        speed: 14 + Math.random() * 10
      });
    }
  }

  public renderStage(
    ctx: CanvasRenderingContext2D,
    stageId: StageId,
    cameraX: number,
    cameraY: number,
    cameraZoom: number,
    frame: number
  ): void {
    const stage = STAGES[stageId];

    // 1. Sky / Background Gradient (Screen Space)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 720);
    skyGrad.addColorStop(0, stage.skyTop);
    skyGrad.addColorStop(0.75, stage.skyBottom);
    skyGrad.addColorStop(1, stage.floorColor);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, 1280, 720);

    // 2. Far Parallax Layer (0.2x camera movement)
    ctx.save();
    ctx.translate(640 - cameraX * 0.2, 0 - cameraY * 0.15);
    this.renderFarSkyline(ctx, stageId, frame);
    ctx.restore();

    // 3. Mid Parallax Layer (0.48x camera movement): Buildings, Holographic Billboards, Reactor/Torii
    ctx.save();
    ctx.translate(640 - cameraX * 0.48, 0 - cameraY * 0.35);
    if (stageId === 'rooftop') {
      this.renderRooftopMidground(ctx, frame);
    } else if (stageId === 'alley') {
      this.renderAlleyMidground(ctx, frame);
    } else {
      this.renderShrineMidground(ctx, frame);
    }
    ctx.restore();

    // 4. World-Space Arena Floor, Crowd Silhouettes, and Stage Bounds (1.0x camera movement + zoom)
    ctx.save();
    ctx.translate(640, STAGE_FLOOR_SCREEN_Y);
    ctx.scale(cameraZoom, cameraZoom);
    ctx.translate(-cameraX, -cameraY);

    if (stage.hasCrowd) {
      this.renderCrowdSilhouettes(ctx, stage.neonPrimary, stage.neonSecondary, frame);
    }

    this.renderArenaFloor(ctx, stage.floorColor, stage.floorGridColor, stage.neonSecondary, frame);
    ctx.restore();

    // 5. Atmospheric Rain & Data Particles (Screen Space overlay)
    if (stage.rainIntensity > 0) {
      this.renderRainAndParticles(ctx, stageId, stage.rainIntensity, stage.neonPrimary, frame);
    }
  }

  private renderFarSkyline(
    ctx: CanvasRenderingContext2D,
    stageId: StageId,
    frame: number
  ): void {
    const stage = STAGES[stageId];

    // Huge cyberpunk moon / orbital ring in background
    ctx.save();
    const orbColor = stage.neonPrimary;
    ctx.strokeStyle = orbColor;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 185, 135, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 185, 155, 0.3, Math.PI - 0.3);
    ctx.stroke();
    ctx.restore();

    // Far megastructure silhouettes
    const towers = [
      { x: -680, w: 110, h: 380 },
      { x: -540, w: 95, h: 430 },
      { x: -410, w: 130, h: 350 },
      { x: -240, w: 105, h: 460 },
      { x: -90, w: 140, h: 320 },
      { x: 90, w: 115, h: 450 },
      { x: 240, w: 125, h: 390 },
      { x: 400, w: 100, h: 420 },
      { x: 530, w: 130, h: 360 }
    ];

    for (let i = 0; i < towers.length; i++) {
      const t = towers[i];
      const topY = 560 - t.h;
      ctx.fillStyle = '#050a18';
      ctx.fillRect(t.x, topY, t.w, t.h);

      ctx.strokeStyle = i % 2 === 0 ? stage.neonPrimary : stage.neonSecondary;
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(t.x, topY, t.w, t.h);

      // Vertical neon window strips
      ctx.fillStyle = i % 2 === 0 ? stage.neonPrimary : stage.neonSecondary;
      ctx.globalAlpha = 0.16;
      for (let wy = topY + 24; wy < 520; wy += 28) {
        if ((wy + i * 17) % 3 !== 0) {
          ctx.fillRect(t.x + 14, wy, t.w - 28, 6);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  private renderRooftopMidground(ctx: CanvasRenderingContext2D, frame: number): void {
    const stage = STAGES.rooftop;
    // Holographic billboards
    this.drawHoloBillboard(
      ctx,
      -420,
      170,
      220,
      85,
      'NEO-KYOTO // 2099',
      'SHIN-GION SKY CIRCUIT',
      stage.neonPrimary,
      frame
    );
    this.drawHoloBillboard(
      ctx,
      200,
      150,
      230,
      85,
      'ZAIBATSU CORP',
      'NEURAL AUGMENTATION',
      stage.neonSecondary,
      frame + 35
    );

    // Rooftop antenna spires & laser beams
    ctx.save();
    ctx.strokeStyle = stage.neonPrimary;
    ctx.globalAlpha = 0.18 + Math.sin(frame * 0.05) * 0.06;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-480, 560);
    ctx.lineTo(-180, 0);
    ctx.moveTo(480, 560);
    ctx.lineTo(180, 0);
    ctx.stroke();
    ctx.restore();
  }

  private renderAlleyMidground(ctx: CanvasRenderingContext2D, frame: number): void {
    const stage = STAGES.alley;
    // Underground concrete pillars & hanging power cables
    ctx.save();
    ctx.strokeStyle = '#180d2c';
    ctx.lineWidth = 5;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 260 - 140, 80);
      ctx.quadraticCurveTo(i * 260, 210, i * 260 + 140, 90);
      ctx.stroke();
    }
    ctx.restore();

    this.drawHoloBillboard(
      ctx,
      -460,
      195,
      200,
      80,
      'BLACKNET ARENA',
      'NO RULES // HIGH VOLTAGE',
      stage.neonPrimary,
      frame
    );
    this.drawHoloBillboard(
      ctx,
      -95,
      125,
      190,
      70,
      'NEON TEMPEST',
      'UNDERGROUND FINALS',
      stage.neonSecondary,
      frame + 20
    );
    this.drawHoloBillboard(
      ctx,
      250,
      190,
      210,
      80,
      'SYNTH RAMEN 24H',
      'SECTOR 4 BACK-ALLEY',
      stage.neonAccent,
      frame + 50
    );
  }

  private renderShrineMidground(ctx: CanvasRenderingContext2D, frame: number): void {
    const stage = STAGES.shrine;
    // Central Quantum Reactor Core
    ctx.save();
    const pulse = 1 + Math.sin(frame * 0.06) * 0.06;
    ctx.translate(0, 290);
    ctx.scale(pulse, pulse);

    ctx.strokeStyle = stage.neonPrimary;
    ctx.shadowColor = stage.neonPrimary;
    ctx.shadowBlur = 22;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 95, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = stage.neonSecondary;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i + frame * 0.015;
      const hx = Math.cos(a) * 70;
      const hy = Math.sin(a) * 70;
      if (i === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // Cyber Torii Gates flanking the reactor
    for (const tx of [-340, 340]) {
      this.drawCyberTorii(ctx, tx, 240, stage.neonSecondary, stage.neonPrimary);
    }
  }

  private drawCyberTorii(
    ctx: CanvasRenderingContext2D,
    cx: number,
    topY: number,
    primary: string,
    accent: string
  ): void {
    ctx.save();
    ctx.fillStyle = '#14081c';
    ctx.strokeStyle = primary;
    ctx.lineWidth = 3;
    ctx.shadowColor = primary;
    ctx.shadowBlur = 14;

    // Two vertical pillars
    ctx.fillRect(cx - 75, topY + 25, 22, 310);
    ctx.strokeRect(cx - 75, topY + 25, 22, 310);
    ctx.fillRect(cx + 53, topY + 25, 22, 310);
    ctx.strokeRect(cx + 53, topY + 25, 22, 310);

    // Top crossbeams
    ctx.fillRect(cx - 115, topY, 230, 22);
    ctx.strokeRect(cx - 115, topY, 230, 22);

    ctx.strokeStyle = accent;
    ctx.fillRect(cx - 95, topY + 48, 190, 14);
    ctx.strokeRect(cx - 95, topY + 48, 190, 14);
    ctx.restore();
  }

  private drawHoloBillboard(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    title: string,
    sub: string,
    color: string,
    frame: number
  ): void {
    const flicker = (frame % 97 === 0 || frame % 113 === 0) ? 0.45 : 0.92;
    ctx.save();
    ctx.globalAlpha = flicker;
    ctx.fillStyle = 'rgba(4, 10, 26, 0.82)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;

    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = color;
    ctx.font = 'bold 17px "Segoe UI", "Orbitron", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, x + w * 0.5, y + 34);

    ctx.fillStyle = '#e0f4ff';
    ctx.font = '11px "Segoe UI", "Consolas", monospace';
    ctx.fillText(sub, x + w * 0.5, y + 58);
    ctx.restore();
  }

  private renderCrowdSilhouettes(
    ctx: CanvasRenderingContext2D,
    neon1: string,
    neon2: string,
    frame: number
  ): void {
    ctx.save();
    for (let i = -14; i <= 14; i++) {
      const cx = i * 42;
      const bounce = Math.abs(Math.sin(frame * 0.11 + i * 0.9)) * 8;
      const h = 58 + (Math.abs(i * 13) % 18);

      // Spectator body & head silhouette
      ctx.fillStyle = '#050916';
      ctx.beginPath();
      ctx.arc(cx, -h - bounce, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(cx - 13, -h + 10 - bounce, 26, h);

      // Glowing cyber visor or cheer stick on every 3rd spectator
      if (Math.abs(i) % 3 === 0) {
        ctx.fillStyle = i % 2 === 0 ? neon1 : neon2;
        ctx.fillRect(cx - 6, -h - 2 - bounce, 12, 3);
      }
    }
    ctx.restore();
  }

  private renderArenaFloor(
    ctx: CanvasRenderingContext2D,
    floorColor: string,
    gridColor: string,
    secondaryColor: string,
    frame: number
  ): void {
    // Base floor slab with wet-pavement depth gradient
    const floorGrad = ctx.createLinearGradient(0, 0, 0, 180);
    floorGrad.addColorStop(0, floorColor);
    floorGrad.addColorStop(0.5, '#030612');
    floorGrad.addColorStop(1, '#010308');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(-900, 0, 1800, 220);

    // Wet-pavement neon reflection pools under background holograms/gates
    ctx.save();
    for (const rx of [-340, 0, 340]) {
      const reflColor = rx === 0 ? gridColor : secondaryColor;
      const rGrad = ctx.createRadialGradient(rx, 42, 6, rx, 48, 175);
      rGrad.addColorStop(0, reflColor + '40');
      rGrad.addColorStop(0.55, reflColor + '16');
      rGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rGrad;
      ctx.fillRect(rx - 180, 2, 360, 140);
    }
    ctx.restore();

    // Glowing horizon rail at y = 0
    ctx.save();
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 3;
    ctx.shadowColor = gridColor;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(-800, 0);
    ctx.lineTo(800, 0);
    ctx.stroke();

    // Reset shadowBlur so perspective grid lines render with zero Gaussian blur overhead
    ctx.shadowBlur = 0;

    // Perspective grid lines (batched into a single path stroke!)
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = -16; i <= 16; i++) {
      const topX = i * 48;
      const botX = i * 115;
      ctx.moveTo(topX, 0);
      ctx.lineTo(botX, 180);
    }
    for (const rowY of [16, 38, 68, 108, 158]) {
      ctx.moveTo(-900, rowY);
      ctx.lineTo(900, rowY);
    }
    ctx.stroke();

    // Center arena calibration marker at x = 0
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 26, 56, 12, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Stage Corner Boundary Holo-Pylons at -540 and +540 (batched)
    ctx.globalAlpha = 0.8 + Math.sin(frame * 0.08) * 0.18;
    ctx.strokeStyle = secondaryColor;
    ctx.fillStyle = secondaryColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (const bx of [-540, 540]) {
      ctx.moveTo(bx, 0);
      ctx.lineTo(bx, -230);
      for (let cy = -45; cy >= -205; cy -= 40) {
        ctx.moveTo(bx - 8, cy + 8);
        ctx.lineTo(bx, cy);
        ctx.lineTo(bx + 8, cy + 8);
      }
    }
    ctx.stroke();
    ctx.fillRect(-548, -10, 16, 10);
    ctx.fillRect(532, -10, 16, 10);
    ctx.restore();
  }

  private renderRainAndParticles(
    ctx: CanvasRenderingContext2D,
    stageId: StageId,
    intensity: number,
    color: string,
    frame: number
  ): void {
    ctx.save();
    const count = Math.floor(this.rainDrops.length * intensity);
    ctx.strokeStyle = stageId === 'shrine' ? 'rgba(0, 255, 170, 0.35)' : 'rgba(140, 225, 255, 0.28)';
    ctx.lineWidth = 1.2;

    // Batch all rain streaks into a single path stroke
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const d = this.rainDrops[i];
      const rx = ((d.x - frame * 3.2) % 1440 + 1440) % 1440 - 80;
      const ry = (d.y + frame * d.speed) % 720;
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 4, ry + d.length);
    }
    ctx.stroke();

    // Batch floor rain splash ripples
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    for (let i = 0; i < count; i += 4) {
      const d = this.rainDrops[i];
      const ry = (d.y + frame * d.speed) % 720;
      if (ry > 590) {
        const rx = ((d.x - frame * 3.2) % 1440 + 1440) % 1440 - 80;
        const rippleProgress = (ry - 590) / 130;
        const radX = 4 + rippleProgress * 18;
        const radY = 1.5 + rippleProgress * 4;
        const cy = 604 + (i % 5) * 14;
        ctx.moveTo(rx + radX, cy);
        ctx.ellipse(rx, cy, radX, radY, 0, 0, Math.PI * 2);
      }
    }
    ctx.stroke();
    ctx.restore();
  }
}
