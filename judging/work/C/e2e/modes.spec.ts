/**
 * Mode flows: replay determinism (a recorded CPU match replays to the identical end state) and
 * a complete Arcade run (story intro, four fights, ending, credits).
 */
import { expect, test, type Page } from '@playwright/test';

/* eslint-disable @typescript-eslint/no-explicit-any */
const ev = <T>(page: Page, fn: () => T) => page.evaluate(fn);

async function waitScene(page: Page, name: string, timeout = 20000): Promise<void> {
  await expect.poll(() => ev(page, () => (window as any).__NT.sceneName()), { timeout, intervals: [100] }).toBe(name);
}

test('replay reproduces the recorded match exactly', async ({ page }) => {
  test.setTimeout(480_000);
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(e.message));
  await page.goto('/?scene=title');
  await waitScene(page, 'TitleScene');
  await page.evaluate(() => {
    const nt = (window as any).__NT;
    nt.setSpeed(5);
    nt.startMatch({ mode: 'cpu', chars: ['sable', 'warden'], palettes: [0, 0], stage: 'pit', cpu: [true, true], difficulty: 3 });
  });
  await waitScene(page, 'MatchScene');
  await expect.poll(() => ev(page, () => (window as any).__NT.lastMatchEnd()?.frame ?? -1), { timeout: 220000, intervals: [500] }).toBeGreaterThan(0);
  const original = await ev(page, () => (window as any).__NT.lastMatchEnd());
  expect(original.replay).toBe(false);
  await waitScene(page, 'ResultsScene', 20000);
  // Results menu: REMATCH, WATCH REPLAY, ... -> select WATCH REPLAY
  await page.waitForTimeout(800);
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(100);
  await page.keyboard.press('Enter');
  await waitScene(page, 'MatchScene');
  await expect.poll(() => ev(page, () => (window as any).__NT.lastMatchEnd()?.replay ?? false), { timeout: 220000, intervals: [250] }).toBe(true);
  const replay = await ev(page, () => (window as any).__NT.lastMatchEnd());
  expect(replay.frame).toBe(original.frame);
  expect(replay.hash).toBe(original.hash);
  expect(problems).toEqual([]);
});

test('arcade: story, four fights, ending and credits', async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
  await page.goto('/?scene=select&mode=arcade');
  await waitScene(page, 'CharSelectScene');
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter'); // HAYATE
  await page.waitForTimeout(150);
  await page.keyboard.press('Enter'); // difficulty
  await waitScene(page, 'StoryScene');
  await page.waitForTimeout(300);
  await page.keyboard.press('Enter'); // finish typewriter
  await page.waitForTimeout(150);
  await page.keyboard.press('Enter');
  for (let fight = 0; fight < 4; fight++) {
    await waitScene(page, 'VersusScene');
    await waitScene(page, 'MatchScene', 20000);
    await expect.poll(() => ev(page, () => (window as any).__NT.match()?.phase), { timeout: 20000 }).toBe('fight');
    await page.evaluate(() => { const nt = (window as any).__NT; nt.setWins(1, 0); nt.setFighter(1, { hp: 1 }); nt.setFighter(0, { hp: 2000 }); });
    for (let i = 0; i < 40; i++) {
      const sc = await ev(page, () => (window as any).__NT.sceneName());
      if (sc !== 'MatchScene') break;
      const m = await ev(page, () => (window as any).__NT.match());
      // Storm Breaker (QCFx2 + P): its chip damage finishes a 1 HP opponent even through a guard
      if (m && m.phase === 'fight') await page.evaluate(() => {
        const nt = (window as any).__NT;
        nt.setFighter(0, { meter: 300 });
        const f = nt.match().fighters[0].facing > 0 ? 8 : 4;
        nt.queue(0, [2, 2, 2 | f, 2 | f, f, f, 2, 2, 2 | f, 2 | f, f | 64, f | 64, 0, 0, 0, 0]);
      });
      await page.waitForTimeout(700);
    }
    await waitScene(page, 'ResultsScene', 30000);
    expect(await ev(page, () => (window as any).__NT.arcade()?.index)).toBe(fight);
    await page.waitForTimeout(700);
    await page.keyboard.press('Enter'); // NEXT FIGHT
  }
  await waitScene(page, 'StoryScene', 20000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  await page.keyboard.press('Enter');
  await waitScene(page, 'CreditsScene');
  expect(problems).toEqual([]);
});
