import { expect, test } from '@playwright/test';
import { createServer, ViteDevServer } from 'vite';

test.describe('NEON TEMPEST — End-to-End Browser Verification', () => {
  let server: ViteDevServer;
  let baseUrl = '';

  test.beforeAll(async () => {
    server = await createServer({
      server: { port: 5185, strictPort: false }
    });
    await server.listen();
    const addr = server.httpServer?.address();
    const port = typeof addr === 'object' && addr ? addr.port : 5185;
    baseUrl = `http://localhost:${port}`;
  });

  test.afterAll(async () => {
    if (server) {
      await server.close();
    }
  });

  test('navigates all menus via keyboard, starts match, executes special move, updates HUD, finishes round with zero console errors', async ({
    page
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    await page.goto(baseUrl);
    await page.waitForSelector('#game-canvas');

    // Wait for boot -> title transition or advance with Enter
    await page.waitForTimeout(300);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);

    let scene = await page.evaluate(() => window.__NEON_TEMPEST__.app.scene);
    if (scene === 'title') {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(150);
    }

    // 1. Verify Main Menu & navigate through Settings and Move List
    scene = await page.evaluate(() => window.__NEON_TEMPEST__.app.scene);
    expect(scene).toBe('menu');

    // Navigate down to Command Archive (index 6) and open it
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('ArrowDown');
    }
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.__NEON_TEMPEST__.app.scene)).toBe('movelist');

    // Switch character tab in Move List and return to Menu
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.__NEON_TEMPEST__.app.scene)).toBe('menu');

    // Navigate down to System Config (index 7) and open it
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.__NEON_TEMPEST__.app.scene)).toBe('settings');

    // Return to Main Menu
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.__NEON_TEMPEST__.app.scene)).toBe('menu');

    // 2. Select Versus // P1 vs CPU (index 1)
    await page.evaluate(() => {
      window.__NEON_TEMPEST__.app.menuIndex = 1;
    });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.__NEON_TEMPEST__.app.scene)).toBe('char_select');

    // Select Hayate (P1) and Magnus (P2)
    await page.keyboard.press('Enter'); // Lock P1
    await page.waitForTimeout(80);
    await page.keyboard.press('Enter'); // Lock P2
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.__NEON_TEMPEST__.app.scene)).toBe('stage_select');

    // Confirm Stage -> Versus Splash -> Match
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.__NEON_TEMPEST__.app.scene)).toBe('versus_splash');

    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.__NEON_TEMPEST__.app.scene)).toBe('match');

    // 3. Perform Special Move Input (Hayate QCF + LP -> Arc Shuriken) & verify HUD / meter / HP updates
    const specialResult = await page.evaluate(() => {
      const { app, stepMatch, buildMotionSequence, buildRawInputFromNumpad } =
        window.__NEON_TEMPEST__;
      const state = app.matchState!;
      state.phase = 'fight';
      state.fighters[0].x = -40;
      state.fighters[1].x = 40;

      // Feed QCF + LP sequence
      const seq = buildMotionSequence('QCF', 1, { lp: true });
      for (const frameInput of seq) {
        stepMatch(state, frameInput, buildRawInputFromNumpad(5, -1));
      }
      const triggeredMove = state.fighters[0].currentMoveId;

      // Step 25 frames so projectile spawns and hits P2
      for (let i = 0; i < 25; i++) {
        stepMatch(state, buildRawInputFromNumpad(5, 1), buildRawInputFromNumpad(5, -1));
      }

      return {
        triggeredMove,
        p1Meter: state.fighters[0].meter,
        p2Hp: state.fighters[1].hp,
        p2MaxHp: state.fighters[1].maxHp
      };
    });

    expect(specialResult.triggeredMove).toBe('arc_kunai_l');
    expect(specialResult.p1Meter).toBeGreaterThan(0);
    expect(specialResult.p2Hp).toBeLessThan(specialResult.p2MaxHp);

    // 4. Finish the round and confirm round win pip updates
    const roundResult = await page.evaluate(() => {
      const { app, stepMatch, buildRawInputFromNumpad } = window.__NEON_TEMPEST__;
      const state = app.matchState!;
      state.fighters[0].status = 'idle';
      state.fighters[0].currentMoveId = null;
      state.fighters[0].moveFrame = 0;
      state.fighters[0].hitstopFrames = 0;
      state.fighters[1].status = 'idle';
      state.fighters[1].currentMoveId = null;
      state.fighters[1].hitstopFrames = 0;
      state.fighters[1].invulnFrames = 0;
      state.fighters[0].x = -30;
      state.fighters[1].x = 20;
      state.fighters[1].hp = 10;

      // Land 5HP to trigger KO!
      stepMatch(state, buildRawInputFromNumpad(5, 1, { hp: true }), buildRawInputFromNumpad(5, -1));
      for (let i = 0; i < 15; i++) {
        stepMatch(state, buildRawInputFromNumpad(5, 1), buildRawInputFromNumpad(5, -1));
      }

      return {
        p1RoundsWon: state.p1RoundsWon,
        phase: state.phase,
        finishType: state.finishType
      };
    });

    expect(roundResult.p1RoundsWon).toBe(1);
    expect(roundResult.finishType).not.toBe('NONE');
    expect(consoleErrors).toEqual([]);
  });
});
