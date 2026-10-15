import { CHARACTERS } from '../data/characters';
import { CharacterId, MatchState, SimEvent } from '../core/types';
import { ObjectPool } from '../utils/pool';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  length: number;
  angle: number;
  color: string;
  coreColor: string;
  alpha: number;
  life: number;
  maxLife: number;
  gravity: number;
  kind: 'spark' | 'slash' | 'ember' | 'dust' | 'electric';
}

export interface ShockwaveRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  lineWidth: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  isHexagon: boolean;
}

export interface FloatingCallout {
  text: string;
  subtext: string;
  playerIndex: 0 | 1;
  x: number;
  y: number;
  color: string;
  life: number;
  maxLife: number;
}

export class VfxManager {
  private particles: ObjectPool<Particle>;
  private rings: ObjectPool<ShockwaveRing>;
  private callouts: FloatingCallout[] = [];
  public hitFlashAlpha = 0;
  public hitFlashColor = '#00f0ff';

  constructor() {
    this.particles = new ObjectPool<Particle>(
      400,
      () => ({
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        size: 4,
        length: 12,
        angle: 0,
        color: '#00f0ff',
        coreColor: '#ffffff',
        alpha: 1,
        life: 0,
        maxLife: 20,
        gravity: 0.2,
        kind: 'spark'
      }),
      (p) => {
        p.life = 0;
        p.alpha = 1;
      }
    );

    this.rings = new ObjectPool<ShockwaveRing>(
      64,
      () => ({
        x: 0,
        y: 0,
        radius: 10,
        maxRadius: 90,
        lineWidth: 4,
        color: '#00f0ff',
        alpha: 1,
        life: 0,
        maxLife: 16,
        isHexagon: false
      }),
      (r) => {
        r.life = 0;
        r.alpha = 1;
      }
    );
  }

  public clear(): void {
    this.particles.clear();
    this.rings.clear();
    this.callouts.length = 0;
    this.hitFlashAlpha = 0;
  }

  private addCallout(
    playerIndex: 0 | 1,
    text: string,
    subtext: string,
    color: string
  ): void {
    // Keep max 4 callouts on screen
    if (this.callouts.length >= 4) {
      this.callouts.shift();
    }
    this.callouts.push({
      text,
      subtext,
      playerIndex,
      x: playerIndex === 0 ? 180 : 1100,
      y: 205 + (this.callouts.filter((c) => c.playerIndex === playerIndex).length * 34),
      color,
      life: 0,
      maxLife: 52
    });
  }

  public processSimEvents(events: SimEvent[], reduceFlashes = false): void {
    for (const ev of events) {
      switch (ev.type) {
        case 'hit': {
          const str = ev.strength ?? 'medium';
          this.spawnHitSparks(ev.x, ev.y, str);
          if (ev.isCounter) {
            this.addCallout(ev.playerIndex, 'COUNTER HIT!', '+15% DAMAGE', '#ffbe00');
            if (!reduceFlashes) {
              this.hitFlashAlpha = 0.22;
              this.hitFlashColor = '#ffbe00';
            }
          }
          if (ev.isCrossUp) {
            this.addCallout(ev.playerIndex, 'CROSS-UP!', 'AMBIGUOUS ANGLE', '#ff00aa');
          }
          if (ev.text) {
            this.addCallout(ev.playerIndex, ev.text, '', '#00ffcc');
          }
          if (str === 'super' && !reduceFlashes) {
            this.hitFlashAlpha = 0.35;
            this.hitFlashColor = '#00f0ff';
          }
          break;
        }
        case 'block': {
          this.spawnBlockShield(ev.x, ev.y);
          break;
        }
        case 'pushblock': {
          this.spawnShockwave(ev.x, ev.y, 140, '#00f0ff', 18, true);
          this.addCallout(ev.playerIndex, 'PUSHBLOCK!', 'ADVANCING GUARD', '#00f0ff');
          break;
        }
        case 'parry': {
          this.spawnShockwave(ev.x, ev.y, 175, '#00ffaa', 22, true);
          this.spawnHitSparks(ev.x, ev.y, 'ex');
          this.addCallout(ev.playerIndex, 'CYBER PARRY!', '+45 METER // ADVANTAGE', '#00ffaa');
          if (!reduceFlashes) {
            this.hitFlashAlpha = 0.3;
            this.hitFlashColor = '#00ffaa';
          }
          break;
        }
        case 'throw_tech': {
          this.spawnShockwave(ev.x, ev.y, 150, '#ffbe00', 18, false);
          this.addCallout(ev.playerIndex, 'THROW TECH!', 'GRAPPLE BROKEN', '#ffbe00');
          break;
        }
        case 'throw_slam':
        case 'knockdown': {
          this.spawnGroundDust(ev.x, 0, 14);
          this.spawnShockwave(ev.x, -8, 95, '#ff007f', 14, false);
          break;
        }
        case 'quick_rise': {
          this.spawnShockwave(ev.x, -40, 85, '#00f0ff', 14, false);
          this.addCallout(ev.playerIndex, 'QUICK RISE', 'TACTICAL RECOVERY', '#00f0ff');
          break;
        }
        case 'dizzy': {
          this.spawnShockwave(ev.x, ev.y, 130, '#ff0055', 22, false);
          this.addCallout(ev.playerIndex, 'NEURAL STUN!', 'GUARD COMPROMISED', '#ff0055');
          break;
        }
        case 'overdrive_burst': {
          this.spawnShockwave(ev.x, ev.y, 240, '#ffbe00', 24, false);
          this.spawnHitSparks(ev.x, ev.y, 'super');
          if (ev.text) {
            this.addCallout(ev.playerIndex, ev.text, 'SYSTEM OVERCLOCK', '#ffbe00');
          }
          if (!reduceFlashes) {
            this.hitFlashAlpha = 0.32;
            this.hitFlashColor = '#ffbe00';
          }
          break;
        }
        case 'super_freeze':
        case 'ultimate_freeze': {
          this.spawnShockwave(ev.x, ev.y, 260, '#00f0ff', 28, false);
          this.spawnHitSparks(ev.x, ev.y, 'super');
          break;
        }
        case 'projectile_clash': {
          this.spawnShockwave(ev.x, ev.y, 120, '#ffffff', 16, true);
          this.spawnHitSparks(ev.x, ev.y, 'special');
          break;
        }
        case 'dash':
        case 'jump':
        case 'land': {
          this.spawnGroundDust(ev.x, ev.y, 6);
          break;
        }
      }
    }
  }

  public spawnHitSparks(
    x: number,
    y: number,
    strength: 'light' | 'medium' | 'heavy' | 'special' | 'ex' | 'super' | 'throw'
  ): void {
    const count =
      strength === 'light'
        ? 10
        : strength === 'medium'
        ? 18
        : strength === 'heavy' || strength === 'special'
        ? 26
        : 40;

    const primaryColor =
      strength === 'light'
        ? '#00f0ff'
        : strength === 'medium'
        ? '#ff00aa'
        : strength === 'heavy'
        ? '#ffbe00'
        : strength === 'ex'
        ? '#00ffaa'
        : '#ff0055';

    // Shockwave ring on impact
    const ringRadius =
      strength === 'light'
        ? 48
        : strength === 'medium'
        ? 78
        : strength === 'heavy' || strength === 'special'
        ? 115
        : 170;
    this.spawnShockwave(x, y, ringRadius, primaryColor, 14, false);

    // Directional slash beams + sparks
    for (let i = 0; i < count; i++) {
      const p = this.particles.acquire();
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.35;
      const speed = 3 + Math.random() * (strength === 'super' ? 16 : 11);
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.angle = angle;
      p.size = strength === 'light' ? 3 : 4.5;
      p.length = (strength === 'light' ? 14 : 26) + Math.random() * 18;
      p.color = i % 3 === 0 ? '#ffffff' : primaryColor;
      p.coreColor = '#ffffff';
      p.maxLife = 12 + Math.floor(Math.random() * 12);
      p.gravity = i % 2 === 0 ? 0.05 : 0.35;
      p.kind = i < 4 ? 'slash' : 'spark';
    }
  }

  public spawnBlockShield(x: number, y: number): void {
    this.spawnShockwave(x, y, 75, '#00f0ff', 14, true);
    for (let i = 0; i < 12; i++) {
      const p = this.particles.acquire();
      const angle = (Math.PI * 2 * i) / 12;
      const speed = 2.5 + Math.random() * 6;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.angle = angle;
      p.size = 3;
      p.length = 12;
      p.color = '#00f0ff';
      p.coreColor = '#ffffff';
      p.maxLife = 12;
      p.gravity = 0;
      p.kind = 'spark';
    }
  }

  public spawnShockwave(
    x: number,
    y: number,
    maxRadius: number,
    color: string,
    maxLife: number,
    isHexagon: boolean
  ): void {
    const r = this.rings.acquire();
    r.x = x;
    r.y = y;
    r.radius = 12;
    r.maxRadius = maxRadius;
    r.lineWidth = isHexagon ? 4 : 5;
    r.color = color;
    r.maxLife = maxLife;
    r.isHexagon = isHexagon;
  }

  public spawnGroundDust(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const p = this.particles.acquire();
      p.x = x + (Math.random() - 0.5) * 36;
      p.y = y - 2;
      p.vx = (Math.random() - 0.5) * 5.5;
      p.vy = -1.2 - Math.random() * 2.8;
      p.size = 4 + Math.random() * 5;
      p.length = 8;
      p.angle = 0;
      p.color = 'rgba(0, 240, 255, 0.55)';
      p.coreColor = '#ffffff';
      p.maxLife = 16 + Math.floor(Math.random() * 8);
      p.gravity = -0.02;
      p.kind = 'dust';
    }
  }

  public update(): void {
    if (this.hitFlashAlpha > 0) {
      this.hitFlashAlpha = Math.max(0, this.hitFlashAlpha - 0.03);
    }

    for (let i = this.particles.count - 1; i >= 0; i--) {
      const p = this.particles.getAt(i);
      p.life++;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= 0.92;
      p.alpha = 1 - p.life / p.maxLife;
      if (p.life >= p.maxLife) {
        this.particles.releaseAt(i);
      }
    }

    for (let i = this.rings.count - 1; i >= 0; i--) {
      const r = this.rings.getAt(i);
      r.life++;
      const t = r.life / r.maxLife;
      r.radius = 12 + (r.maxRadius - 12) * (1 - (1 - t) * (1 - t));
      r.alpha = 1 - t;
      if (r.life >= r.maxLife) {
        this.rings.releaseAt(i);
      }
    }

    for (let i = this.callouts.length - 1; i >= 0; i--) {
      const c = this.callouts[i];
      c.life++;
      if (c.life >= c.maxLife) {
        this.callouts.splice(i, 1);
      }
    }
  }

  /**
   * Renders world-space particles and shockwaves inside the camera transform.
   */
  public renderWorldVfx(ctx: CanvasRenderingContext2D, floorY: number): void {
    ctx.save();

    // Shockwave rings
    for (let i = 0; i < this.rings.count; i++) {
      const r = this.rings.getAt(i);
      ctx.save();
      ctx.globalAlpha = Math.max(0, r.alpha);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.lineWidth * r.alpha;
      ctx.shadowColor = r.color;
      ctx.shadowBlur = 14;

      const cx = r.x;
      const cy = floorY + r.y;

      ctx.beginPath();
      if (r.isHexagon) {
        for (let s = 0; s < 6; s++) {
          const a = (Math.PI / 3) * s;
          const hx = cx + Math.cos(a) * r.radius;
          const hy = cy + Math.sin(a) * r.radius;
          if (s === 0) ctx.moveTo(hx, hy);
          else ctx.lineTo(hx, hy);
        }
        ctx.closePath();
      } else {
        ctx.arc(cx, cy, r.radius, 0, Math.PI * 2);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Particles & Slashes
    for (let i = 0; i < this.particles.count; i++) {
      const p = this.particles.getAt(i);
      const px = p.x;
      const py = floorY + p.y;

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);

      if (p.kind === 'slash') {
        ctx.translate(px, py);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(-p.length, 0);
        ctx.lineTo(0, -p.size);
        ctx.lineTo(p.length, 0);
        ctx.lineTo(0, p.size);
        ctx.closePath();
        ctx.fill();
      } else if (p.kind === 'dust') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(px, py, p.size * p.alpha, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size * p.alpha;
        ctx.lineCap = 'round';
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px - p.vx * 2.2, py - p.vy * 2.2);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * Renders screen-space callouts, hit flashes, speed lines, and cinematic Super Art cut-in banners.
   */
  public renderScreenVfx(
    ctx: CanvasRenderingContext2D,
    state: MatchState,
    reduceFlashes = false
  ): void {
    // 1. Screen impact flash
    if (this.hitFlashAlpha > 0 && !reduceFlashes) {
      ctx.save();
      ctx.globalAlpha = this.hitFlashAlpha;
      ctx.fillStyle = this.hitFlashColor;
      ctx.fillRect(0, 0, 1280, 720);
      ctx.restore();
    }

    // 2. Cinematic Super / Ultimate Cut-In Overlay
    if (state.screenFreezeFrames > 0 && state.superFreezeOwner !== null) {
      this.renderSuperCutIn(
        ctx,
        state.fighters[state.superFreezeOwner].charId,
        state.superFreezeOwner,
        state.superFreezeMoveName,
        state.superFreezeIsUltimate,
        state.screenFreezeFrames
      );
    }

    // 3. Floating Combat Callout Popups (COUNTER HIT, PARRY, THROW TECH, etc.)
    for (const c of this.callouts) {
      const progress = c.life / c.maxLife;
      const alpha = progress < 0.15 ? progress / 0.15 : progress > 0.75 ? (1 - progress) / 0.25 : 1;
      const slideX = c.playerIndex === 0 ? (1 - Math.min(1, c.life / 6)) * -40 : (1 - Math.min(1, c.life / 6)) * 40;

      ctx.save();
      ctx.globalAlpha = clampAlpha(alpha);
      ctx.translate(c.x + slideX, c.y);

      // Cyber badge backing
      ctx.fillStyle = 'rgba(4, 9, 24, 0.88)';
      ctx.strokeStyle = c.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-110, -16);
      ctx.lineTo(100, -16);
      ctx.lineTo(112, 14);
      ctx.lineTo(-98, 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = c.color;
      ctx.font = 'bold 16px "Segoe UI", "Orbitron", sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = c.color;
      ctx.shadowBlur = 10;
      ctx.fillText(c.text, 0, 4);
      ctx.restore();
    }
  }

  public renderSuperCutIn(
    ctx: CanvasRenderingContext2D,
    charId: CharacterId,
    ownerIndex: 0 | 1,
    moveName: string,
    isUltimate: boolean,
    remainingFrames: number
  ): void {
    const charDef = CHARACTERS[charId];
    const color = isUltimate ? '#ff0055' : charDef.palette.primary;

    ctx.save();
    // Darken background + speed lines
    ctx.fillStyle = isUltimate ? 'rgba(15, 0, 18, 0.75)' : 'rgba(2, 6, 20, 0.65)';
    ctx.fillRect(0, 0, 1280, 720);

    // Diagonal speed lines across the diagonal banner
    const bannerY = 235;
    const bannerH = 190;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, bannerY - 25);
    ctx.lineTo(1280, bannerY + 15);
    ctx.lineTo(1280, bannerY + bannerH + 15);
    ctx.lineTo(0, bannerY + bannerH - 25);
    ctx.closePath();
    ctx.clip();

    const grad = ctx.createLinearGradient(0, bannerY, 1280, bannerY + bannerH);
    grad.addColorStop(0, '#040818');
    grad.addColorStop(0.5, charDef.palette.secondary);
    grad.addColorStop(1, '#040818');
    ctx.fillStyle = grad;
    ctx.fillRect(0, bannerY - 40, 1280, bannerH + 80);

    // Speed lines
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    for (let i = 0; i < 28; i++) {
      const ly = bannerY - 20 + ((i * 37 + remainingFrames * 19) % (bannerH + 40));
      const lx = ((i * 173 + remainingFrames * 65) % 1400) - 100;
      ctx.globalAlpha = 0.25 + (i % 3) * 0.2;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx + 260, ly + 8);
      ctx.stroke();
    }

    // Stylized Cyberpunk Character Cut-In Bust & Targeting Reticle
    const px = ownerIndex === 0 ? 290 : 990;
    const py = bannerY + 95;
    ctx.save();
    ctx.translate(px, py);
    ctx.globalAlpha = 1;

    // Outer Holographic Targeting Ring
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(0, -10, 68, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, -10, 58, -0.6, 0.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -10, 58, 2.2, 3.6);
    ctx.stroke();

    // Armored Shoulders & High Cyber Collar
    ctx.fillStyle = charDef.palette.clothDark;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-64, 52);
    ctx.lineTo(-42, 6);
    ctx.lineTo(-18, -4);
    ctx.lineTo(18, -4);
    ctx.lineTo(42, 6);
    ctx.lineTo(64, 52);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Sculpted Helmet / Cowl Silhouette
    ctx.fillStyle = charDef.palette.secondary;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-28, -36);
    ctx.lineTo(0, -54);
    ctx.lineTo(28, -36);
    ctx.lineTo(30, -8);
    ctx.lineTo(16, 12);
    ctx.lineTo(-16, 12);
    ctx.lineTo(-30, -8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Oni Mask / Jawplate
    ctx.fillStyle = '#070b18';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-22, -8);
    ctx.lineTo(0, -3);
    ctx.lineTo(22, -8);
    ctx.lineTo(15, 12);
    ctx.lineTo(0, 17);
    ctx.lineTo(-15, 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Glowing Cyber Visor / Optic Flare
    ctx.fillStyle = isUltimate ? '#ffbe00' : '#00f0ff';
    ctx.shadowColor = isUltimate ? '#ffbe00' : '#00f0ff';
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.moveTo(-24, -22);
    ctx.lineTo(0, -13);
    ctx.lineTo(26, -22);
    ctx.lineTo(22, -29);
    ctx.lineTo(0, -20);
    ctx.lineTo(-20, -29);
    ctx.closePath();
    ctx.fill();

    // Eye flare crossbar
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-42, -20);
    ctx.lineTo(46, -16);
    ctx.stroke();
    ctx.restore();

    // Cut-in Title & Move Name with high-contrast backing plate
    const textX = ownerIndex === 0 ? 740 : 540;
    ctx.fillStyle = 'rgba(3, 6, 18, 0.78)';
    ctx.fillRect(textX - 380, bannerY + 40, 760, 100);
    ctx.strokeStyle = isUltimate ? '#ffbe00' : '#00f0ff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(textX - 380, bannerY + 40, 760, 100);

    ctx.fillStyle = isUltimate ? '#ffbe00' : '#00f0ff';
    ctx.font = 'italic 900 19px "Segoe UI", "Orbitron", sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = isUltimate ? '#ffbe00' : '#00f0ff';
    ctx.shadowBlur = 12;
    ctx.fillText(
      isUltimate
        ? `★ ${charDef.name} // ULTIMATE OVERLOAD ★`
        : `⚡ ${charDef.name} // HYPER PROTOCOL ⚡`,
      textX,
      bannerY + 68
    );

    ctx.font = 'italic 900 44px "Segoe UI", "Orbitron", sans-serif';
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.shadowColor = color;
    ctx.shadowBlur = 24;
    ctx.strokeText(moveName.toUpperCase(), textX, bannerY + 122);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(moveName.toUpperCase(), textX, bannerY + 122);

    ctx.restore();

    // Top and bottom glowing border rails
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(0, bannerY - 25);
    ctx.lineTo(1280, bannerY + 15);
    ctx.moveTo(0, bannerY + bannerH - 25);
    ctx.lineTo(1280, bannerY + bannerH + 15);
    ctx.stroke();

    ctx.restore();
  }
}

function clampAlpha(a: number): number {
  return a < 0 ? 0 : a > 1 ? 1 : a;
}
