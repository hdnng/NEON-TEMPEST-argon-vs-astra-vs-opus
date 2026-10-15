/**
 * End-to-end: boot -> title -> every main-menu entry -> mode select -> character select ->
 * stage select -> VS -> match; perform a special move with the keyboard, verify the HUD reacts,
 * finish a round, and make sure nothing was logged as an error or warning.
 */
import { expect, test, type Page } from '@playwright/test';

type NT = {
  sceneName(): string;
  match(): { phase: string; frame: number; timer: number; results: unknown[]; fighters: { hp: number; lastMove: string; stats: { specials: number } }[] } | null;
  hud(): { shown: number[] } | null;
  setFighter(i: number, v: { hp?: number; meter?: number; x?: number }): void;
};

const scene = (page: Page) => page.evaluate(() => (window as unknown as { __NT: NT }).__NT.sceneName());
const match = (page: Page) => page.evaluate(() => (window as unknown as { __NT: NT }).__NT.match());

async function waitScene(page: Page, name: string, timeout = 15000): Promise<void> {
  await expect.poll(() => scene(page), { timeout, intervals: [100] }).toBe(name);
  await page.waitForTimeout(450); // let the transition settle
}

async function press(page: Page, key: string, times = 1): Promise<void> {
  for (let i = 0; i < times; i++) {
    await page.keyboard.press(key);
    await page.waitForTimeout(90);
  }
}

/** Holds keys for a number of 60 Hz frames. */
async function hold(page: Page, keys: string[], frames: number): Promise<void> {
  for (const k of keys) await page.keyboard.down(k);
  await page.waitForTimeout(frames * 17);
  for (const k of keys) await page.keyboard.up(k);
}

test('full flow: menus, match, special move, HUD, round end, no console errors', async ({ page }) => {
  const problems: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));

  await page.goto('/');
  await waitScene(page, 'BootScene');
  await press(page, 'Enter');
  await waitScene(page, 'TitleScene');
  await page.waitForTimeout(700);
  await press(page, 'Enter');
  await waitScene(page, 'MainMenuScene');

  // Move list (2 down from PLAY)
  await press(page, 'ArrowDown', 2);
  await press(page, 'Enter');
  await waitScene(page, 'MoveListScene');
  await press(page, 'ArrowRight');
  await press(page, 'ArrowDown', 3);
  await press(page, 'KeyU'); // toggle frame data
  await press(page, 'Escape');
  await waitScene(page, 'MainMenuScene');

  // Settings: walk through all tabs
  await press(page, 'ArrowDown', 3);
  await press(page, 'Enter');
  await waitScene(page, 'SettingsScene');
  await press(page, 'KeyE', 4);
  await press(page, 'ArrowDown', 2);
  await press(page, 'Escape');
  await waitScene(page, 'MainMenuScene');

  // Credits
  await press(page, 'ArrowDown', 4);
  await press(page, 'Enter');
  await waitScene(page, 'CreditsScene');
  await press(page, 'Escape');
  await waitScene(page, 'MainMenuScene');

  // Replay without a recording shows a message and stays on the menu
  await press(page, 'ArrowDown');
  await press(page, 'Enter');
  await page.waitForTimeout(300);
  expect(await scene(page)).toBe('MainMenuScene');

  // PLAY -> mode select -> VERSUS CPU
  await press(page, 'ArrowUp');
  await press(page, 'Enter');
  await waitScene(page, 'ModeSelectScene');
  await press(page, 'ArrowRight', 4);
  await press(page, 'ArrowLeft', 2);
  await press(page, 'Enter');
  await waitScene(page, 'CharSelectScene');
  await press(page, 'Enter'); // P1: HAYATE
  await press(page, 'ArrowRight'); // CPU cursor
  await press(page, 'Enter');
  await press(page, 'ArrowLeft', 3); // difficulty: EASY
  await press(page, 'Enter');
  await waitScene(page, 'StageSelectScene');
  await press(page, 'ArrowRight');
  await press(page, 'ArrowLeft');
  await press(page, 'Enter');
  await waitScene(page, 'VersusScene');
  await waitScene(page, 'MatchScene', 20000);

  await expect.poll(async () => (await match(page))?.phase, { timeout: 15000 }).toBe('fight');
  const t0 = (await match(page))!.timer;

  // Special move: quarter-circle forward + LP (S, S+D, D+U) -- retried in case the CPU interrupts
  let specials = 0;
  for (let attempt = 0; attempt < 8 && specials === 0; attempt++) {
    await hold(page, ['KeyS'], 2);
    await hold(page, ['KeyS', 'KeyD'], 2);
    await page.keyboard.down('KeyD');
    await hold(page, ['KeyU'], 3);
    await page.keyboard.up('KeyD');
    await page.waitForTimeout(500);
    specials = (await match(page))!.fighters[0].stats.specials;
  }
  expect(specials).toBeGreaterThan(0);

  // HUD reacts: the timer counts down and a health bar moves once someone takes damage
  await expect.poll(async () => (await match(page))!.timer, { timeout: 5000 }).toBeLessThan(t0);
  await page.evaluate(() => (window as unknown as { __NT: NT }).__NT.setFighter(1, { hp: 400 }));
  await expect.poll(async () => {
    const h = await page.evaluate(() => (window as unknown as { __NT: NT }).__NT.hud()?.shown ?? [1, 1]);
    return Math.min(h[0], h[1]);
  }, { timeout: 8000 }).toBeLessThan(0.99);

  // Finish the round: leave both fighters at 1 HP and keep attacking until someone falls
  await page.evaluate(() => {
    const nt = (window as unknown as { __NT: NT }).__NT;
    nt.setFighter(0, { hp: 1 });
    nt.setFighter(1, { hp: 1 });
  });
  for (let i = 0; i < 30; i++) {
    const m = await match(page);
    if (m && m.results.length > 0) break;
    await hold(page, ['KeyD'], 4);
    await hold(page, ['KeyJ'], 3);
    await hold(page, ['KeyU'], 3);
  }
  await expect.poll(async () => (await match(page))!.results.length, { timeout: 20000 }).toBeGreaterThan(0);

  // Pause menu opens and closes
  await press(page, 'Escape');
  await page.waitForTimeout(300);
  await press(page, 'Escape');

  expect(problems, problems.join('\n')).toEqual([]);
});
