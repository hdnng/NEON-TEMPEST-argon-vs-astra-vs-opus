/**
 * Training overlay: hurtboxes (blue), hitboxes (red), pushboxes (yellow outline), throwboxes
 * (green) and projectile boxes, drawn from the exact boxes the simulation uses this frame.
 */
import { curMove, hurtboxes, pushbox } from '../sim/fighter';
import { projDef } from '../sim/combat';
import type { Box } from '../data/schema';
import { FP, type MatchState } from '../sim/types';
import { sx, sy, type Camera } from './camera';

function box(ctx: CanvasRenderingContext2D, cam: Camera, x: number, y: number, facing: number, b: Box, fill: string, stroke: string): void {
  const l = facing > 0 ? x + b.x : x - b.x - b.w;
  const X = sx(cam, l), Y = sy(cam, y + b.y + b.h);
  const w = b.w * cam.zoom, h = b.h * cam.zoom;
  ctx.fillStyle = fill;
  ctx.fillRect(X, Y, w, h);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(X + 0.5, Y + 0.5, w - 1, h - 1);
}

export function drawHitboxes(ctx: CanvasRenderingContext2D, cam: Camera, s: MatchState): void {
  ctx.save();
  for (const f of s.fighters) {
    const x = f.x / FP, y = f.y / FP;
    const pb = pushbox(f);
    if (pb) {
      const l = f.facing > 0 ? x + pb.x : x - pb.x - pb.w;
      ctx.strokeStyle = 'rgba(255,230,80,0.9)';
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1;
      ctx.strokeRect(sx(cam, l), sy(cam, y + pb.y + pb.h), pb.w * cam.zoom, pb.h * cam.zoom);
      ctx.setLineDash([]);
    }
    for (const hb of hurtboxes(f)) box(ctx, cam, x, y, f.facing, hb, 'rgba(60,140,255,0.22)', 'rgba(90,170,255,0.95)');
    const m = curMove(f);
    if (f.state === 'attack' && m) {
      for (const h of m.hits) {
        if (f.mf < h.frames[0] || f.mf > h.frames[1]) continue;
        for (const b of h.boxes) box(ctx, cam, x, y, f.facing, b, 'rgba(255,40,70,0.3)', 'rgba(255,70,90,1)');
      }
      if (m.throw && f.mf >= m.startup && f.mf < m.startup + m.active && f.grabFrame < 0) {
        box(ctx, cam, x, y, f.facing, m.throw.box, 'rgba(60,255,140,0.22)', 'rgba(90,255,160,1)');
      }
    }
    // origin cross
    const ox = sx(cam, x), oy = sy(cam, y);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ox - 6, oy); ctx.lineTo(ox + 6, oy);
    ctx.moveTo(ox, oy - 6); ctx.lineTo(ox, oy + 6);
    ctx.stroke();
  }
  for (const p of s.projectiles) {
    const d = projDef(p);
    box(ctx, cam, p.x / FP, p.y / FP, p.facing, d.box, 'rgba(255,40,70,0.3)', 'rgba(255,120,60,1)');
  }
  ctx.restore();
}
