/**
 * Gamepad support: a mocked standard-mapping pad drives the menus (D-pad + A) and the fighter
 * (stick + face buttons) through the same input layer as a real controller.
 */
import { expect, test } from '@playwright/test';

test('gamepad navigates menus and controls a fighter', async ({ page }) => {
  await page.addInitScript(() => {
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
    const pad = { id: 'Mock Standard Gamepad', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons, timestamp: 0 };
    (window as any).__pad = pad;
    navigator.getGamepads = () => [pad as unknown as Gamepad, null, null, null];
  });
  const tap = async (i: number) => {
    await page.evaluate((i) => { (window as any).__pad.buttons[i].pressed = true; }, i);
    await page.waitForTimeout(80);
    await page.evaluate((i) => { (window as any).__pad.buttons[i].pressed = false; }, i);
    await page.waitForTimeout(120);
  };
  const scene = () => page.evaluate(() => (window as any).__NT.sceneName());
  await page.goto('/?scene=menu');
  await expect.poll(scene).toBe('MainMenuScene');
  await page.waitForTimeout(400);
  await tap(13); // D-pad down -> REPLAY
  await tap(13); // -> MOVE LIST
  await tap(0); // A
  await expect.poll(scene).toBe('MoveListScene');
  await page.waitForTimeout(300);
  await tap(15); // D-pad right: next character
  await tap(1); // B: back
  await expect.poll(scene).toBe('MainMenuScene');

  // Fighter control: start a training match and walk forward with the stick, then punch
  await page.goto('/?scene=match&mode=training&p1=hayate&p2=magnus');
  await expect.poll(scene).toBe('MatchScene');
  await page.waitForTimeout(600);
  const x0 = await page.evaluate(() => (window as any).__NT.match().fighters[0].x);
  await page.evaluate(() => { (window as any).__pad.axes[0] = 1; });
  await page.waitForTimeout(500);
  await page.evaluate(() => { (window as any).__pad.axes[0] = 0; });
  const x1 = await page.evaluate(() => (window as any).__NT.match().fighters[0].x);
  expect(x1).toBeGreaterThan(x0);
  await tap(2); // X = LP
  await expect.poll(() => page.evaluate(() => (window as any).__NT.match().fighters[0].lastMove)).toBe('5LP');
});
