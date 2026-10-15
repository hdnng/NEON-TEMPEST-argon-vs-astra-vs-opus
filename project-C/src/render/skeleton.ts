/**
 * Skeleton solver: turns a Pose (IK targets) into joint positions using two-bone IK for arms
 * and legs. Local space: facing right, +y up, origin between the feet. Allocation-free when the
 * output skeleton object is reused.
 */
import type { BodyDef } from '../data/schema';
import type { Pose } from '../data/poses';

export interface Pt { x: number; y: number }

export interface Skel {
  hip: Pt; neck: Pt; head: Pt; headAng: number; lean: number;
  chest: Pt;
  shF: Pt; shB: Pt; elF: Pt; elB: Pt; haF: Pt; haB: Pt;
  hpF: Pt; hpB: Pt; knF: Pt; knB: Pt; ftF: Pt; ftB: Pt;
  open: boolean;
  /** Torso frame (unit up and forward vectors). */
  ux: number; uy: number; fx: number; fy: number;
}

const pt = (): Pt => ({ x: 0, y: 0 });

export function newSkel(): Skel {
  return {
    hip: pt(), neck: pt(), head: pt(), headAng: 0, lean: 0, chest: pt(),
    shF: pt(), shB: pt(), elF: pt(), elB: pt(), haF: pt(), haB: pt(),
    hpF: pt(), hpB: pt(), knF: pt(), knB: pt(), ftF: pt(), ftB: pt(),
    open: false, ux: 0, uy: 1, fx: 1, fy: 0,
  };
}

const D2R = Math.PI / 180;

/** Two-bone IK. Writes the middle joint into `mid` and the (reachable) end into `end`. */
function ik(ax: number, ay: number, tx: number, ty: number, l1: number, l2: number, bend: number, mid: Pt, end: Pt): void {
  let dx = tx - ax, dy = ty - ay;
  let d = Math.sqrt(dx * dx + dy * dy);
  const maxD = (l1 + l2) * 0.998;
  const minD = Math.abs(l1 - l2) + 1;
  if (d < 1e-4) { dx = 0; dy = -1; d = 1e-4; }
  if (d > maxD) { dx *= maxD / d; dy *= maxD / d; d = maxD; }
  else if (d < minD) { dx *= minD / d; dy *= minD / d; d = minD; }
  end.x = ax + dx;
  end.y = ay + dy;
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const ux = dx / d, uy = dy / d;
  mid.x = ax + ux * a - uy * h * bend;
  mid.y = ay + uy * a + ux * h * bend;
}

function rotAround(p: Pt, cx: number, cy: number, c: number, s: number): void {
  const x = p.x - cx, y = p.y - cy;
  p.x = cx + x * c - y * s;
  p.y = cy + x * s + y * c;
}

export function solveSkeleton(pose: Pose, body: BodyDef, out: Skel): Skel {
  const k = body.scale;
  const hx = pose.hip[0] * k, hy = pose.hip[1] * k;
  out.hip.x = hx; out.hip.y = hy;
  const lr = pose.lean * D2R;
  const ux = Math.sin(lr), uy = Math.cos(lr); // spine up
  const fxv = uy, fyv = -ux; // forward perpendicular
  out.ux = ux; out.uy = uy; out.fx = fxv; out.fy = fyv;
  out.lean = pose.lean;
  const T = body.torso;
  out.neck.x = hx + ux * T; out.neck.y = hy + uy * T;
  out.chest.x = hx + ux * T * 0.62 + fxv * body.torsoWidth * 0.12;
  out.chest.y = hy + uy * T * 0.62 + fyv * body.torsoWidth * 0.12;
  const ha = (pose.lean + pose.head) * D2R;
  const hux = Math.sin(ha), huy = Math.cos(ha);
  out.headAng = pose.lean + pose.head;
  out.head.x = out.neck.x + ux * body.neck + hux * body.head * 0.95;
  out.head.y = out.neck.y + uy * body.neck + huy * body.head * 0.95;
  // shoulders slightly below the neck base; near shoulder a bit back, far shoulder a bit forward
  const sb = T - body.head * 0.35;
  const so = body.shoulder * 0.35;
  out.shF.x = hx + ux * sb - fxv * so; out.shF.y = hy + uy * sb - fyv * so;
  out.shB.x = hx + ux * (sb + 2) + fxv * so; out.shB.y = hy + uy * (sb + 2) + fyv * so;
  const ho = body.hipWidth * 0.3;
  out.hpF.x = hx - fxv * ho; out.hpF.y = hy - fyv * ho;
  out.hpB.x = hx + fxv * ho + ux * 2; out.hpB.y = hy + fyv * ho + uy * 2;
  ik(out.shF.x, out.shF.y, pose.fh[0] * k, pose.fh[1] * k, body.upperArm, body.foreArm, -1, out.elF, out.haF);
  ik(out.shB.x, out.shB.y, pose.bh[0] * k, pose.bh[1] * k, body.upperArm, body.foreArm, -1, out.elB, out.haB);
  ik(out.hpF.x, out.hpF.y, pose.ff[0] * k, pose.ff[1] * k, body.thigh, body.shin, 1, out.knF, out.ftF);
  ik(out.hpB.x, out.hpB.y, pose.bf[0] * k, pose.bf[1] * k, body.thigh, body.shin, 1, out.knB, out.ftB);
  out.open = !!pose.open;
  const rot = pose.rot ?? 0;
  if (rot) {
    const r = -rot * D2R; // positive rot = forward flip (clockwise when facing right)
    const c = Math.cos(r), s = Math.sin(r);
    const cx = hx, cy = hy + 20 * k;
    for (const p of [out.hip, out.neck, out.head, out.chest, out.shF, out.shB, out.elF, out.elB, out.haF, out.haB, out.hpF, out.hpB, out.knF, out.knB, out.ftF, out.ftB]) {
      rotAround(p, cx, cy, c, s);
    }
    out.headAng -= rot;
    out.lean -= rot;
    const lr2 = out.lean * D2R;
    out.ux = Math.sin(lr2); out.uy = Math.cos(lr2); out.fx = out.uy; out.fy = -out.ux;
  }
  return out;
}

/** Bounding-ish height of the skeleton top (for HUD / camera). */
export function skelTop(s: Skel, headR: number): number {
  return Math.max(s.head.y + headR, s.haF.y, s.haB.y);
}
