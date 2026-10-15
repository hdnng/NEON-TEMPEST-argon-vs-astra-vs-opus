import * as fs from 'node:fs';
import * as path from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

async function captureAllScreenshots(): Promise<void> {
  const outDir = path.resolve(process.cwd(), 'screenshots');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log('Starting Vite server for screenshot capture...');
  const server = await createServer({
    server: { port: 5179, strictPort: false }
  });
  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === 'object' && address ? address.port : 5179;
  const url = `http://localhost:${port}`;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto(url);
  await page.waitForSelector('#game-canvas');
  await page.waitForTimeout(200);

  // Freeze background rAF fixedUpdate so each screenshot captures the exact deterministic simulation frame
  await page.evaluate(() => {
    const app = window.__NEON_TEMPEST__.app as unknown as { fixedUpdate: () => void };
    app.fixedUpdate = () => {};
  });

  // 1. Title Screen
  await page.evaluate(() => {
    const app = window.__NEON_TEMPEST__.app;
    app.changeScene('title');
    app.transitionAlpha = 0;
    app.sceneFrame = 45;
    app.render(1);
  });
  await page.screenshot({ path: path.join(outDir, '01-title.png') });
  console.log('Captured 01-title.png');

  // 2. Main Menu
  await page.evaluate(() => {
    const app = window.__NEON_TEMPEST__.app;
    app.changeScene('menu');
    app.transitionAlpha = 0;
    app.menuIndex = 0;
    app.sceneFrame = 60;
    app.render(1);
  });
  await page.screenshot({ path: path.join(outDir, '02-menu.png') });
  console.log('Captured 02-menu.png');

  // 3. Character Select
  await page.evaluate(() => {
    const app = window.__NEON_TEMPEST__.app;
    app.changeScene('char_select');
    app.transitionAlpha = 0;
    app.p1Cursor = 0; // Hayate
    app.p2Cursor = 2; // Sable
    app.p1Locked = true;
    app.sceneFrame = 80;
    app.render(1);
  });
  await page.screenshot({ path: path.join(outDir, '03-char-select.png') });
  console.log('Captured 03-char-select.png');

  // 4. Versus Splash Screen
  await page.evaluate(() => {
    const app = window.__NEON_TEMPEST__.app;
    app.mode = 'arcade';
    app.p1Cursor = 0;
    app.arcadeStageIndex = 0;
    app.changeScene('versus_splash');
    app.transitionAlpha = 0;
    app.sceneFrame = 50;
    app.render(1);
  });
  await page.screenshot({ path: path.join(outDir, '04-versus-splash.png') });
  console.log('Captured 04-versus-splash.png');

  // 5. Stage 1: Shin-Gion Sky Dojo (Rooftop) in Match
  await page.evaluate(() => {
    const { app, stepMatch, buildMotionSequence, buildRawInputFromNumpad } =
      window.__NEON_TEMPEST__;
    app.launchMatch({
      p1Char: 'hayate',
      p2Char: 'sable',
      stageId: 'rooftop',
      mode: 'versus_cpu',
      skipIntro: true
    });
    app.transitionAlpha = 0;
    const state = app.matchState!;
    state.fighters[0].x = -120;
    state.fighters[1].x = 120;
    state.fighters[0].meter = 180;
    state.fighters[1].meter = 120;
    // Hayate fires Arc Shuriken
    const seq = buildMotionSequence('QCF', 1, { hp: true });
    for (const f of seq) stepMatch(state, f, buildRawInputFromNumpad(5, -1));
    for (let i = 0; i < 16; i++) {
      stepMatch(state, buildRawInputFromNumpad(5, 1), buildRawInputFromNumpad(5, -1));
      app.vfx.processSimEvents(state.events);
      app.vfx.update();
    }
    app.render(1);
  });
  await page.screenshot({ path: path.join(outDir, '05-stage-rooftop.png') });
  console.log('Captured 05-stage-rooftop.png');

  // 6. Stage 2: Kuro-Machi Underground (Alley) in Match
  await page.evaluate(() => {
    const { app, stepMatch, buildMotionSequence, buildRawInputFromNumpad } =
      window.__NEON_TEMPEST__;
    app.launchMatch({
      p1Char: 'magnus',
      p2Char: 'warden',
      stageId: 'alley',
      mode: 'versus_cpu',
      skipIntro: true
    });
    app.transitionAlpha = 0;
    const state = app.matchState!;
    state.fighters[0].x = -75;
    state.fighters[1].x = 70;
    state.fighters[0].meter = 220;
    state.fighters[1].meter = 140;
    const seq = buildMotionSequence('HCF', 1, { hp: true });
    for (const f of seq) stepMatch(state, f, buildRawInputFromNumpad(5, -1));
    for (let i = 0; i < 14; i++) {
      stepMatch(state, buildRawInputFromNumpad(5, 1), buildRawInputFromNumpad(5, -1));
      app.vfx.processSimEvents(state.events);
      app.vfx.update();
    }
    app.render(1);
  });
  await page.screenshot({ path: path.join(outDir, '06-stage-alley.png') });
  console.log('Captured 06-stage-alley.png');

  // 7. Stage 3: Amaterasu Cyber-Shrine (Shrine) in Match
  await page.evaluate(() => {
    const { app, stepMatch, buildMotionSequence, buildRawInputFromNumpad } =
      window.__NEON_TEMPEST__;
    app.launchMatch({
      p1Char: 'sable',
      p2Char: 'hayate',
      stageId: 'shrine',
      mode: 'versus_cpu',
      skipIntro: true
    });
    app.transitionAlpha = 0;
    const state = app.matchState!;
    state.fighters[0].x = -65;
    state.fighters[1].x = 65;
    state.fighters[0].meter = 250;
    state.fighters[0].overdriveTimer = 360;
    const seq = buildMotionSequence('QCF', 1, { hp: true });
    for (const f of seq) stepMatch(state, f, buildRawInputFromNumpad(5, -1));
    for (let i = 0; i < 11; i++) {
      stepMatch(state, buildRawInputFromNumpad(5, 1), buildRawInputFromNumpad(5, -1));
      app.vfx.processSimEvents(state.events);
      app.vfx.update();
    }
    app.render(1);
  });
  await page.screenshot({ path: path.join(outDir, '07-stage-shrine.png') });
  console.log('Captured 07-stage-shrine.png');

  // 8. Cinematic Super Art Cut-In
  await page.evaluate(() => {
    const { app, stepMatch, buildMotionSequence, buildRawInputFromNumpad } =
      window.__NEON_TEMPEST__;
    app.launchMatch({
      p1Char: 'hayate',
      p2Char: 'magnus',
      stageId: 'rooftop',
      mode: 'versus_cpu',
      skipIntro: true
    });
    app.transitionAlpha = 0;
    const state = app.matchState!;
    state.fighters[0].x = -60;
    state.fighters[1].x = 60;
    state.fighters[0].meter = 300;
    state.fighters[0].hp = 280; // Low HP for Ultimate Art!
    const seq = buildMotionSequence('DQCF', 1, { lp: true, mp: true });
    for (const f of seq) {
      stepMatch(state, f, buildRawInputFromNumpad(5, -1));
      app.vfx.processSimEvents(state.events);
      app.vfx.update();
    }
    app.render(1);
  });
  await page.screenshot({ path: path.join(outDir, '08-super-cutin.png') });
  console.log('Captured 08-super-cutin.png');

  // 9. Multi-Hit Combo Counter + Hit Sparks
  await page.evaluate(() => {
    const { app, stepMatch, buildMotionSequence, buildRawInputFromNumpad } =
      window.__NEON_TEMPEST__;
    app.launchMatch({
      p1Char: 'sable',
      p2Char: 'magnus',
      stageId: 'alley',
      mode: 'versus_cpu',
      skipIntro: true
    });
    app.transitionAlpha = 0;
    const state = app.matchState!;
    state.fighters[0].x = -35;
    state.fighters[1].x = 30;
    state.fighters[0].meter = 200;

    // Land 2LK -> 2LP -> EX Viper Twin-Fang for a 5-hit combo with sparks!
    stepMatch(state, buildRawInputFromNumpad(2, 1, { lk: true }), buildRawInputFromNumpad(5, -1));
    for (let i = 0; i < 4; i++) {
      stepMatch(state, buildRawInputFromNumpad(2, 1), buildRawInputFromNumpad(5, -1));
      app.vfx.processSimEvents(state.events);
      app.vfx.update();
    }
    stepMatch(state, buildRawInputFromNumpad(2, 1, { lp: true }), buildRawInputFromNumpad(5, -1));
    for (let i = 0; i < 4; i++) {
      stepMatch(state, buildRawInputFromNumpad(2, 1), buildRawInputFromNumpad(5, -1));
      app.vfx.processSimEvents(state.events);
      app.vfx.update();
    }
    const seq = buildMotionSequence('QCF', 1, { lp: true, mp: true });
    for (const f of seq) {
      stepMatch(state, f, buildRawInputFromNumpad(5, -1));
      app.vfx.processSimEvents(state.events);
      app.vfx.update();
    }
    for (let i = 0; i < 16; i++) {
      stepMatch(state, buildRawInputFromNumpad(5, 1), buildRawInputFromNumpad(5, -1));
      app.vfx.processSimEvents(state.events);
      app.vfx.update();
    }
    app.render(1);
  });
  await page.screenshot({ path: path.join(outDir, '09-combo-counter.png') });
  console.log('Captured 09-combo-counter.png');

  // 10. Training Mode with Hitboxes, Frame Data Telemetry & Input History
  await page.evaluate(() => {
    const { app, stepMatch, buildRawInputFromNumpad } = window.__NEON_TEMPEST__;
    app.launchMatch({
      p1Char: 'warden',
      p2Char: 'hayate',
      stageId: 'rooftop',
      mode: 'training',
      skipIntro: true
    });
    app.transitionAlpha = 0;
    app.training.showHitboxes = true;
    app.training.showFrameData = true;
    app.training.showInputHistory = true;
    const state = app.matchState!;
    state.fighters[0].x = -45;
    state.fighters[1].x = 45;
    // Warden performs 5HP so active hitbox (red), hurtboxes (blue), and pushboxes (green) are all visible!
    stepMatch(state, buildRawInputFromNumpad(5, 1, { hp: true }), buildRawInputFromNumpad(5, -1));
    for (let i = 0; i < 9; i++) {
      stepMatch(state, buildRawInputFromNumpad(5, 1), buildRawInputFromNumpad(5, -1));
      app.vfx.processSimEvents(state.events);
      app.vfx.update();
    }
    app.render(1);
  });
  await page.screenshot({ path: path.join(outDir, '10-training-hitboxes.png') });
  console.log('Captured 10-training-hitboxes.png');

  // 11. Command Archive / Move List Screen
  await page.evaluate(() => {
    const app = window.__NEON_TEMPEST__.app;
    app.changeScene('movelist');
    app.transitionAlpha = 0;
    app.moveListCharIndex = 0;
    app.render(1);
  });
  await page.screenshot({ path: path.join(outDir, '11-movelist.png') });
  console.log('Captured 11-movelist.png');

  // 12. Results Screen
  await page.evaluate(() => {
    const app = window.__NEON_TEMPEST__.app;
    app.launchMatch({
      p1Char: 'hayate',
      p2Char: 'magnus',
      stageId: 'rooftop',
      mode: 'arcade',
      skipIntro: true
    });
    app.matchState!.p1RoundsWon = 2;
    app.matchState!.p2RoundsWon = 1;
    app.matchState!.finishType = 'ULTIMATE_KO';
    app.matchState!.fighters[1].lastComboTotalDamage = 385;
    app.matchState!.fighters[1].lastComboTotalHits = 7;
    app.changeScene('results');
    app.transitionAlpha = 0;
    app.sceneFrame = 40;
    app.render(1);
  });
  await page.screenshot({ path: path.join(outDir, '12-results.png') });
  console.log('Captured 12-results.png');

  await browser.close();
  await server.close();

  if (consoleErrors.length > 0) {
    console.error('Console errors during screenshots:', consoleErrors);
    process.exit(1);
  }
  console.log('All 12 screenshots captured cleanly with 0 console errors.');
}

captureAllScreenshots();
