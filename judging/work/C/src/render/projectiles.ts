/**
 * Projectile visuals per style (orb, lance, disc, beam, wave, grid). Drawn additively with
 * pre-rendered glow sprites and procedural electric arcs.
 */
import { projDef } from '../sim/combat';
import { FP, type MatchState } from '../sim/types';
import { rgba } from '../ui/theme';
import { glowSprite, type Particles } from '../vfx/particles';
import { sx, sy, type Camera } from './camera';

let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

export function updateProjectileFx(s: MatchState, vfx: Particles): void {
  for (const p of s.projectiles) {
    const d = projDef(p);
    const x = p.x / FP, y = p.y / FP;
    if (p.age % 2 === 0) vfx.trail(x - Math.sign(p.vx) * 10, y, d.color, d.size * 0.9);
  }
}

export function drawProjectiles(ctx: CanvasRenderingContext2D, cam: Camera, s: MatchState, t: number): void {
  if (!s.projectiles.length) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of s.projectiles) {
    const d = projDef(p);
    const x = sx(cam, p.x / FP), y = sy(cam, p.y / FP);
    const z = cam.zoom;
    const r = d.size * z;
    const dir = Math.sign(p.vx) || p.facing;
    switch (d.style) {
      case 'orb': case 'orbEX': {
        const ex = d.style === 'orbEX';
        const pulse = 1 + Math.sin(t * 30 + p.id) * 0.08;
        ctx.globalAlpha = 0.9;
        ctx.drawImage(glowSprite(d.color), x - r * 2.6 * pulse, y - r * 2.6 * pulse, r * 5.2 * pulse, r * 5.2 * pulse);
        if (ex) ctx.drawImage(glowSprite('#ff2e9a'), x - r * 1.8, y - r * 1.8, r * 3.6, r * 3.6);
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(x, y, r * 0.42, 0, Math.PI * 2); ctx.fill();
        // electric arcs
        ctx.strokeStyle = rgba(d.color, 0.95);
        ctx.lineWidth = 1.6 * z;
        for (let k = 0; k < (ex ? 5 : 3); k++) {
          let a = rnd() * Math.PI * 2;
          let rr = r * 0.4;
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
          for (let j = 0; j < 4; j++) {
            a += (rnd() - 0.5) * 1.2;
            rr += r * 0.28;
            ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
          }
          ctx.stroke();
        }
        // trailing tail
        const tail = ctx.createLinearGradient(x, y, x - dir * r * 4, y);
        tail.addColorStop(0, rgba(d.color, 0.6));
        tail.addColorStop(1, rgba(d.color, 0));
        ctx.fillStyle = tail;
        ctx.beginPath();
        ctx.moveTo(x, y - r * 0.7);
        ctx.lineTo(x - dir * r * 4, y);
        ctx.lineTo(x, y + r * 0.7);
        ctx.fill();
        break;
      }
      case 'lance': case 'lanceEX': {
        const len = r * (d.style === 'lanceEX' ? 4.5 : 3.6);
        ctx.globalAlpha = 0.85;
        ctx.drawImage(glowSprite(d.color), x - len, y - r * 1.4, len * 2, r * 2.8);
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(x + dir * len * 0.7, y);
        ctx.lineTo(x - dir * len * 0.6, y - r * 0.28);
        ctx.lineTo(x - dir * len * 0.9, y);
        ctx.lineTo(x - dir * len * 0.6, y + r * 0.28);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = d.color;
        ctx.lineWidth = 2 * z;
        for (const o of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(x + dir * len * 0.4, y + o * r * 0.15);
          ctx.lineTo(x - dir * len * 1.4, y + o * r * (0.5 + Math.sin(t * 40 + o) * 0.2));
          ctx.stroke();
        }
        if (d.style === 'lanceEX') {
          ctx.strokeStyle = rgba('#ffffff', 0.7);
          ctx.beginPath();
          for (let k = 0; k <= 12; k++) {
            const xx = x - dir * len * (k / 12) * 1.3;
            const yy = y + Math.sin(k * 1.4 + t * 50) * r * 0.5;
            if (k === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
          }
          ctx.stroke();
        }
        break;
      }
      case 'disc': {
        const spin = t * 18 + p.id;
        ctx.globalAlpha = 0.8;
        ctx.drawImage(glowSprite(d.color), x - r * 2.4, y - r * 2.4, r * 4.8, r * 4.8);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3 * z;
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.38, Math.sin(spin) * 0.3 - 0.4 * dir, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = d.color;
        ctx.lineWidth = 1.5 * z;
        for (let k = 0; k < 3; k++) {
          const a = spin + (k * Math.PI * 2) / 3;
          ctx.beginPath();
          ctx.arc(x, y, r * 0.72, a, a + 1.1);
          ctx.stroke();
        }
        break;
      }
      case 'beam': case 'wave': case 'grid': {
        const h = r * (d.style === 'grid' ? 3.2 : 1.6);
        const len = r * 3;
        ctx.globalAlpha = 0.75;
        ctx.drawImage(glowSprite(d.color), x - len * 1.4, y - h * 1.3, len * 2.8, h * 2.6);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5 * z;
        if (d.style === 'grid') {
          ctx.beginPath();
          for (let k = -3; k <= 3; k++) {
            ctx.moveTo(x - len * 0.6, y + (k * h) / 3.5);
            ctx.lineTo(x + len * 0.6, y + (k * h) / 3.5);
            ctx.moveTo(x + (k * len) / 5, y - h);
            ctx.lineTo(x + (k * len) / 5, y + h);
          }
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.ellipse(x - dir * r * 0.4, y, r * 0.9, h, 0, dir > 0 ? -1.2 : Math.PI - 1.2, dir > 0 ? 1.2 : Math.PI + 1.2);
          ctx.stroke();
        }
        break;
      }
    }
  }
  ctx.restore();
}
