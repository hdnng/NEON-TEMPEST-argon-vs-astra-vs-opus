/**
 * Captures the gallery in screenshots/ from a production build (npm run screenshots).
 * Drives the game through the window.__NT automation API so every shot is reproducible.
 */
import { execSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const PORT = 4181;
const BASE = `http://localhost:${PORT}/`;
const OUT = 'screenshots';
mkdirSync(OUT, { recursive: true });

if (!process.argv.includes('--no-build')) execSync('npx vite build --logLevel warn', { stdio: 'inherit' });
const server = spawn(`npx vite preview --port ${PORT} --strictPort`, { shell: true, stdio: 'ignore' });
for (let i = 0; i < 80; i++) {
  try { if ((await fetch(BASE)).ok) break; } catch { /* starting */ }
  await new Promise((r) => setTimeout(r, 250));
}

const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const problems = [];
page.on('pageerror', (e) => problems.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(m.text()); });

const nt = (fn, arg) => page.evaluate(fn, arg);
const shot = async (name) => { await page.screenshot({ path: `${OUT}/${name}.png` }); console.log('  saved', name); };
const open = async (q, wait) => { await page.goto(BASE + q); await page.waitForTimeout(wait); };
const waitFor = async (fn, timeout = 30000, arg) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await page.evaluate(fn, arg).catch(() => false)) return true;
    await page.waitForTimeout(50);
  }
  return false;
};

// Input bits (absolute, facing right)
const UP = 1, DOWN = 2, RIGHT = 8, LP = 16, HP = 64;
const qcf2 = (btn) => [DOWN, DOWN, DOWN | RIGHT, DOWN | RIGHT, RIGHT, RIGHT, DOWN, DOWN, DOWN | RIGHT, DOWN | RIGHT, RIGHT | btn, RIGHT | btn, 0];

console.log('[screenshots] capturing...');
await open('?scene=title', 3200); await shot('01-title');
await open('?scene=menu', 2600); await shot('02-main-menu');
await open('?scene=modes', 2000); await shot('03-mode-select');
await open('?scene=select&mode=versus', 2600); await shot('04-character-select');
await open('?scene=stage&p1=hayate&p2=magnus', 3200); await shot('05-stage-select');
await open('?scene=versus&p1=sable&p2=warden', 2700); await shot('06-versus-splash');

await open('?scene=match&mode=cpu&cpu=both&p1=hayate&p2=sable&stage=rooftop&diff=2', 11000); await shot('07-match-rooftop');
await open('?scene=match&mode=cpu&cpu=both&p1=magnus&p2=warden&stage=shrine&diff=2', 12500); await shot('08-match-shrine');
await open('?scene=match&mode=cpu&cpu=both&p1=sable&p2=hayate&stage=pit&diff=2', 13000); await shot('09-match-pit');

// Super Art cut-in, then the combo counter as the hits land (training: the dummy stands still)
await open('?scene=match&mode=training&p1=hayate&p2=magnus&stage=rooftop', 2500);
await nt(() => { window.__NT.setFighter(0, { x: -90, meter: 300 }); window.__NT.setFighter(1, { x: 60 }); });
await page.waitForTimeout(300);
await nt((b) => window.__NT.queue(0, b), qcf2(HP));
await waitFor(() => { const m = window.__NT.match(); return m && m.freeze > 0 && m.freeze < 26; });
await shot('10-super-cutin');
await waitFor(() => (window.__NT.hud()?.combos?.[0]?.hits ?? 0) >= 5, 6000);
await page.waitForTimeout(120);
await shot('11-combo-counter');

// Training mode with hitbox overlay and frame data
await open('?scene=match&mode=training&p1=warden&p2=sable&stage=pit', 2500);
await nt(() => { window.__NT.setFighter(0, { x: -70 }); window.__NT.setFighter(1, { x: 50 }); window.__NT.showHitboxes(true); });
await page.waitForTimeout(200);
await nt((b) => window.__NT.queue(0, b), [0, HP, HP, 0, 0, 0, 0, 0, 0]);
await page.waitForTimeout(170);
await shot('12-training-hitboxes');

// K.O. slow motion
await open('?scene=match&mode=cpu&cpu=both&p1=magnus&p2=hayate&stage=shrine&diff=3', 6000);
await nt(() => { window.__NT.setFighter(0, { hp: 1 }); window.__NT.setFighter(1, { hp: 1 }); });
await waitFor(() => window.__NT.match()?.phase === 'ko', 25000);
await page.waitForTimeout(700);
await shot('13-ko-slowmo');

// Results: finish a match quickly
await open('?scene=title', 800);
await nt(() => window.__NT.startMatch({ mode: 'cpu', chars: ['warden', 'hayate'], palettes: [0, 0], stage: 'pit', cpu: [true, true], difficulty: 3 }));
await waitFor(() => window.__NT.match()?.phase === 'fight', 20000);
await nt(() => { window.__NT.setWins(1, 0); window.__NT.setFighter(1, { hp: 1 }); });
await waitFor(() => window.__NT.sceneName() === 'ResultsScene', 40000);
await page.waitForTimeout(2200);
await shot('14-results');

// Pause menu and in-match move list
await open('?scene=match&mode=training&p1=sable&p2=hayate&stage=shrine', 2500);
await page.keyboard.press('Escape');
await page.waitForTimeout(700);
await shot('15-pause-menu');
await page.keyboard.press('ArrowDown'); await page.waitForTimeout(80);
await page.keyboard.press('ArrowDown'); await page.waitForTimeout(80);
await page.keyboard.press('Enter');
await page.waitForTimeout(900);
await shot('16-movelist-framedata');

await browser.close();
if (process.platform === 'win32') { try { execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: 'ignore' }); } catch { /* gone */ } }
else server.kill();
console.log(problems.length ? `[screenshots] console problems:\n${problems.join('\n')}` : '[screenshots] no console errors');
void UP; void LP;
