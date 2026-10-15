// Dev harness for stage art + perf: /dev/stages.html?stage=rooftop&camx=0&zoom=1&camy=0&t=3&freeze=1
import { createStage } from '../src/render/stages';
import { GROUND_Y, clampCamera, makeCamera, sx, sy } from '../src/render/camera';

const W = 1280, H = 720;
const qs = new URLSearchParams(location.search);
const id = qs.get('stage') ?? 'rooftop';
const freeze = qs.has('freeze');
const quality = Number(qs.get('q') ?? 2);
const canvas = document.getElementById('c') as HTMLCanvasElement;
const ctx = canvas.getContext('2d', { alpha: false })!;
const hud = document.getElementById('hud')!;
let scale = 1, offX = 0, offY = 0;
function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  canvas.style.width = innerWidth + 'px';
  canvas.style.height = innerHeight + 'px';
  scale = Math.min(canvas.width / W, canvas.height / H);
  offX = (canvas.width - W * scale) / 2;
  offY = (canvas.height - H * scale) / 2;
}
resize();
addEventListener('resize', resize);

const stage = createStage(id, { flashReduction: qs.has('nf') });
const t0 = performance.now();
stage.init(scale, quality);
const initMs = performance.now() - t0;
const cam = makeCamera();
let t = Number(qs.get('t') ?? 0);
const samples: number[] = [];
(window as any).__stage = { samples, initMs, obj: stage };

function fighter(x: number, color: string) {
  const X = sx(cam, x), Y = sy(cam, 0);
  const z = cam.zoom;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath(); ctx.ellipse(X, Y, 50 * z, 9 * z, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#12142a';
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(X - 26 * z, Y - 200 * z, 52 * z, 200 * z, 20 * z);
  ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(X, Y - 222 * z, 20 * z, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
}

function frame() {
  requestAnimationFrame(frame);
  t += 1 / 60;
  if (freeze) {
    cam.x = Number(qs.get('camx') ?? 0);
    cam.zoom = Number(qs.get('zoom') ?? 1);
    cam.y = Number(qs.get('camy') ?? 0);
  } else {
    cam.x = Math.sin(t * 0.21) * 420;
    cam.zoom = 1 + Math.sin(t * 0.13) * 0.14;
    cam.y = Math.max(0, Math.sin(t * 0.47)) * 90;
  }
  clampCamera(cam);
  stage.update(t, cam);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, offX, offY);
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  const a = performance.now();
  stage.drawBack(ctx, cam, t);
  const b = performance.now();
  fighter(-200, '#2ee8ff');
  fighter(200, '#ff2fa0');
  const c = performance.now();
  stage.drawFront(ctx, cam, t);
  const d = performance.now();
  ctx.restore();
  const ms = (b - a) + (d - c);
  samples.push(ms);
  if (samples.length > 600) samples.shift();
  if ((Math.floor(t * 60) % 30) === 0) {
    const avg = samples.reduce((x, y) => x + y, 0) / samples.length;
    hud.textContent = `${id} q${quality} stage ${avg.toFixed(2)} ms/frame  init ${initMs.toFixed(0)} ms  ground ${GROUND_Y}`;
  }
}
requestAnimationFrame(frame);
(window as any).__fire = (k: string) => stage.onEvent(k, 1);
