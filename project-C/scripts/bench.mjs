/**
 * Performance benchmark: builds the game, serves the production bundle, runs 60 seconds of a
 * CPU-vs-CPU match in Chromium and records average FPS, 1% low FPS, frame times, CPU render
 * time and JS heap memory into bench-results.json.
 *
 *   npm run bench                 (headless Chromium with GPU acceleration)
 *   npm run bench -- --headed     (real window, vsync)
 *   npm run bench -- --seconds=30 --stage=pit
 */
import { execSync, spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const SECONDS = Number(args.seconds ?? 60);
const STAGE = args.stage ?? 'rooftop';
const headed = !!args.headed;

console.log('[bench] building production bundle...');
execSync('npx vite build --logLevel warn', { stdio: 'inherit' });
const server = spawn('npx vite preview --port 4179 --strictPort', { shell: true, stdio: 'ignore' });
for (let i = 0; i < 60; i++) {
  try { const r = await fetch('http://localhost:4179/'); if (r.ok) break; } catch { /* not up yet */ }
  await new Promise((r) => setTimeout(r, 250));
}
const url = `http://localhost:4179/?scene=match&mode=cpu&cpu=both&p1=hayate&p2=sable&stage=${STAGE}&diff=2`;

const browser = await chromium.launch(headed
  ? { headless: false, args: ['--enable-precise-memory-info'] }
  : { args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--enable-precise-memory-info'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
// Environment baseline: an empty canvas that only clears every frame, same browser + viewport.
await page.setContent('<canvas id="c" width="1280" height="720"></canvas>');
const baseline = await page.evaluate(() => new Promise((res) => {
  const ctx = document.getElementById('c').getContext('2d', { alpha: false });
  const dts = []; let last = performance.now(); const t0 = last;
  const f = (now) => {
    dts.push(now - last); last = now;
    ctx.fillStyle = dts.length % 2 ? '#05060f' : '#06070f';
    ctx.fillRect(0, 0, 1280, 720);
    if (now - t0 < 8000) requestAnimationFrame(f);
    else { dts.shift(); const m = dts.reduce((a, b) => a + b, 0) / dts.length; const s = [...dts].sort((a, b) => a - b); const w = s.slice(Math.floor(s.length * 0.99)); res({ averageFps: +(1000 / m).toFixed(1), onePercentLowFps: +(1000 / (w.reduce((a, b) => a + b, 0) / w.length)).toFixed(1) }); }
  };
  requestAnimationFrame(f);
}));
console.log('[bench] environment baseline (empty canvas):', baseline);
await page.goto(url);
await page.waitForFunction(() => window.__NT?.sceneName() === 'MatchScene', null, { timeout: 30000, polling: 500 }).catch(async (e) => { console.log('[bench] page state:', await page.evaluate(() => [location.href, typeof window.__NT, window.__NT?.sceneName?.()]).catch((x) => String(x)), errors); throw e; });
await page.waitForTimeout(2000); // warm-up (rig + glyph caches)

const env = await page.evaluate(() => {
  const c = document.createElement('canvas');
  const gl = c.getContext('webgl');
  const dbg = gl && gl.getExtension('WEBGL_debug_renderer_info');
  return {
    gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown',
    userAgent: navigator.userAgent,
    devicePixelRatio: devicePixelRatio,
    cores: navigator.hardwareConcurrency,
  };
});

await page.evaluate(() => window.__NT.recordFrames(true));
const memSamples = [];
const setup = { mode: 'cpu', chars: ['hayate', 'sable'], palettes: [0, 0], stage: 'rooftop', cpu: [true, true], difficulty: 2 };
for (let s = 0; s < SECONDS; s++) {
  await page.waitForTimeout(1000);
  const st = await page.evaluate((setup) => {
    const nt = window.__NT;
    if (nt.sceneName() !== 'MatchScene' && nt.sceneName() !== '') nt.startMatch(setup);
    const m = performance.memory;
    return { mem: m ? m.usedJSHeapSize : 0, scale: nt.app.view.resScale, scene: nt.sceneName() };
  }, { ...setup, stage: STAGE });
  memSamples.push(st);
  if (s % 10 === 9) console.log(`[bench] ${s + 1}s  scene=${st.scene}  heap=${(st.mem / 1048576).toFixed(1)}MB  resScale=${st.scale}`);
}
const raw = await page.evaluate(() => { window.__NT.recordFrames(false); return window.__NT.frameTimes(); });
await browser.close();
if (process.platform === 'win32') { try { execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: 'ignore' }); } catch { /* already gone */ } }
else server.kill();

// raw = [frameIntervalMs, renderCpuMs, ...]
const dts = [], cpu = [];
for (let i = 0; i < raw.length; i += 2) { dts.push(raw[i]); cpu.push(raw[i + 1]); }
dts.shift(); cpu.shift();
const mean = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
const sorted = [...dts].sort((a, b) => a - b);
const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
const worst1 = sorted.slice(Math.floor(sorted.length * 0.99));
const mems = memSamples.map((m) => m.mem).filter((m) => m > 0);
const result = {
  date: new Date().toISOString(),
  durationSeconds: SECONDS,
  mode: headed ? 'headed (vsync)' : 'headless + GPU (ANGLE D3D11)',
  scene: `CPU vs CPU (HAYATE vs SABLE, hard), stage ${STAGE}, 1280x720 viewport`,
  frames: dts.length,
  averageFps: +(1000 / mean(dts)).toFixed(1),
  onePercentLowFps: +(1000 / mean(worst1)).toFixed(1),
  frameTimeMs: { avg: +mean(dts).toFixed(2), p50: +pct(0.5).toFixed(2), p95: +pct(0.95).toFixed(2), p99: +pct(0.99).toFixed(2), max: +sorted[sorted.length - 1].toFixed(2) },
  cpuRenderTimeMs: { avg: +mean(cpu).toFixed(2), p99: +[...cpu].sort((a, b) => a - b)[Math.floor(cpu.length * 0.99)].toFixed(2) },
  framesOver20ms: dts.filter((d) => d > 20).length,
  memoryMB: mems.length ? {
    start: +(mems[0] / 1048576).toFixed(1), end: +(mems[mems.length - 1] / 1048576).toFixed(1),
    max: +(Math.max(...mems) / 1048576).toFixed(1), min: +(Math.min(...mems) / 1048576).toFixed(1),
  } : 'unavailable',
  resolutionScaleEnd: memSamples[memSamples.length - 1]?.scale,
  environment: { ...env, emptyCanvasBaseline: baseline },
  errors,
};
writeFileSync('bench-results.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
