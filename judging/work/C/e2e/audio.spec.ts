/**
 * Audio is fully procedural, so verify it objectively: tap the master bus with an analyser and
 * check that every music track and every sound effect produces signal without hard clipping.
 */
import { expect, test } from '@playwright/test';

/* eslint-disable @typescript-eslint/no-explicit-any */
const SFX = [
  'ui_move', 'ui_confirm', 'ui_back', 'ui_error', 'ui_tab', 'ui_start', 'ui_select_char', 'ui_slide',
  'jump', 'land', 'dash', 'step', 'whiff_light', 'whiff_medium', 'whiff_heavy',
  'hit_light', 'hit_medium', 'hit_heavy', 'hit_special', 'hit_super', 'counter', 'block', 'block_heavy', 'armor', 'parry',
  'grab', 'throw_slam', 'tech', 'proj_orb', 'proj_lance', 'proj_disc', 'proj_wave', 'clash', 'rise', 'spin', 'teleport', 'charge_rush',
  'super_flash', 'ult_flash', 'drive', 'burnout', 'guardcancel', 'pushblock', 'meter_stock', 'dizzy', 'knockdown', 'quickrise',
  'announce_round', 'announce_fight', 'ko', 'perfect', 'timeover', 'timer_tick', 'crowd_cheer', 'victory_sting',
];
const TRACKS = ['title', 'menu', 'select', 'versus', 'stage_rooftop', 'stage_shrine', 'stage_pit', 'training', 'victory', 'results'];

test('every track and sound effect is audible and does not clip', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto('/?scene=title');
  await page.waitForTimeout(600);
  await page.mouse.click(640, 360); // user gesture -> audio unlock
  await page.waitForTimeout(800);
  const ok = await page.evaluate(() => {
    const a = (window as any).__NT.app.audio;
    const e = a.e;
    if (!e) return false;
    const an = e.ctx.createAnalyser();
    an.fftSize = 2048;
    e.comp.connect(an);
    (window as any).__an = an;
    return e.ctx.state === 'running';
  });
  expect(ok).toBe(true);
  const measure = (ms: number) => page.evaluate((ms) => new Promise<{ rms: number; peak: number }>((res) => {
    const an = (window as any).__an as AnalyserNode;
    const buf = new Float32Array(an.fftSize);
    let peak = 0, sum = 0, n = 0;
    const t0 = performance.now();
    const iv = setInterval(() => {
      an.getFloatTimeDomainData(buf);
      for (const v of buf) { const x = Math.abs(v); if (x > peak) peak = x; sum += v * v; n++; }
      if (performance.now() - t0 > ms) { clearInterval(iv); res({ rms: Math.sqrt(sum / Math.max(1, n)), peak }); }
    }, 20);
  }), ms);

  // music: each track audible
  await page.evaluate(() => (window as any).__NT.app.audio.ambience('none'));
  for (const tr of TRACKS) {
    await page.evaluate((tr) => (window as any).__NT.app.audio.music(tr, 0.05), tr);
    await page.waitForTimeout(400);
    const m = await measure(1600);
    expect(m.rms, `track ${tr} rms`).toBeGreaterThan(0.003);
    expect(m.peak, `track ${tr} peak`).toBeLessThan(1.0);
  }
  await page.evaluate(() => (window as any).__NT.app.audio.music(null, 0.05));
  await page.waitForTimeout(1500);

  // sfx: each one produces signal
  const quiet: string[] = [];
  for (const name of SFX) {
    const r = await page.evaluate((name) => new Promise<number>((res) => {
      const an = (window as any).__an as AnalyserNode;
      const buf = new Float32Array(an.fftSize);
      (window as any).__NT.app.audio.sfx(name);
      let peak = 0;
      const t0 = performance.now();
      const iv = setInterval(() => {
        an.getFloatTimeDomainData(buf);
        for (const v of buf) peak = Math.max(peak, Math.abs(v));
        if (performance.now() - t0 > 450) { clearInterval(iv); res(peak); }
      }, 15);
    }), name);
    if (r < 0.01) quiet.push(`${name}:${r.toFixed(4)}`);
    expect(r, `sfx ${name} clipping`).toBeLessThan(1.0);
    await page.waitForTimeout(120);
  }
  expect(quiet, `silent effects: ${quiet.join(', ')}`).toEqual([]);

  // ambience layers
  for (const amb of ['rain', 'storm', 'crowd']) {
    await page.evaluate((amb) => (window as any).__NT.app.audio.ambience(amb), amb);
    await page.waitForTimeout(1500);
    const m = await measure(1000);
    expect(m.rms, `ambience ${amb}`).toBeGreaterThan(0.002);
  }
});
