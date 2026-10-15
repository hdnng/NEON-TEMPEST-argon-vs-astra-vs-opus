// Dev-only QA sheet: every fighter in a set of poses (?poses=a,b,c&pal=1&scale=0.8).
import { CHARACTER_LIST } from '../src/data/characters';
import { FighterView } from '../src/render/fighterView';
import type { DrawOpts } from '../src/render/bodyDraw';

const qs = new URLSearchParams(location.search);
const poses = (qs.get('poses') ?? 'stance,crouch,jab,straight,kick_high,sweep,hit_high,block,jump,palm,win').split(',');
const pal = Number(qs.get('pal') ?? 0);
const sc = Number(qs.get('scale') ?? 0.62);
const c = document.getElementById('c') as HTMLCanvasElement;
const ctx = c.getContext('2d')!;
const g = ctx.createLinearGradient(0, 0, 0, 1000);
g.addColorStop(0, '#0a0b22'); g.addColorStop(1, '#1a0b26');
ctx.fillStyle = g; ctx.fillRect(0, 0, 1600, 1000);
const opts: DrawOpts = { flat: null, rimA: '#27e8ff', rimB: '#ff2e9a', glow: true, t: 0, energy: 0 };
CHARACTER_LIST.forEach((ch, row) => {
  const v = new FighterView(ch.id, pal);
  v.facing = 1;
  for (let k = 0; k < 30; k++) v.animateMenu('idle', k / 60);
  poses.forEach((p, col) => {
    v.setMenuPose(p);
    v.settle(50);
    const x = 80 + col * 140, y = 210 + row * 245;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(x - 64, y - 230 * sc - 40, 128, 230 * sc + 50);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath(); ctx.moveTo(x - 60, y); ctx.lineTo(x + 60, y); ctx.stroke();
    v.drawPortrait(ctx, x, y, sc, 1, opts);
    ctx.fillStyle = '#aab'; ctx.font = '11px sans-serif'; ctx.fillText(p, x - 60, y + 14);
  });
});
(window as unknown as { __ready: boolean }).__ready = true;
