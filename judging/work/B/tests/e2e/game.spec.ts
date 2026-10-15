import { test, expect, type Page } from "@playwright/test";
async function keyboardFocus(page: Page, selector: string) {
  for (let i = 0; i < 70; i++) {
    if (
      await page.locator(selector).evaluate((e) => e === document.activeElement)
    )
      return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`Keyboard focus did not reach ${selector}`);
}
test("keyboard complete flow, special, HUD, round, settings and replay", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") errors.push(m.text());
  });
  await page.goto("/");
  await expect(page.locator('[data-scene="title"]')).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-scene="menu"]')).toBeVisible();
  // Every main menu destination is reachable by keyboard, including the reference panels.
  for (const action of ["settings", "moves", "howto"]) {
    await keyboardFocus(page, `[data-action="${action}"]`);
    await page.keyboard.press("Enter");
    await expect(page.locator(`[data-scene="${action}"]`)).toBeVisible();
    await page.keyboard.press("Escape");
  }
  await keyboardFocus(page, '[data-action="mode:training"]');
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-scene="character"]')).toBeVisible();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-scene="stage"]')).toBeVisible();
  await keyboardFocus(page, '[data-action="stage:0"]');
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-scene="versus"]')).toBeVisible();
  await expect(page.locator('[data-scene="match"]')).toBeVisible();
  await page.waitForFunction(
    () => (window as any).__NEON__.state.phase === "fight",
  );
  // Real quarter-circle-forward + punch through DOM keyboard events, no direct move injection.
  await page.keyboard.down("KeyS");
  await page.waitForTimeout(55);
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(55);
  await page.keyboard.up("KeyS");
  await page.waitForTimeout(35);
  await page.keyboard.down("KeyJ");
  await page.waitForTimeout(45);
  await page.keyboard.up("KeyJ");
  await page.keyboard.up("KeyD");
  await expect(page.locator("#hud-state")).toHaveAttribute(
    "data-move",
    /special0_/,
  );
  await page.waitForFunction(
    () => (window as any).__NEON__.state.fighters[1].hp < 1160,
  );
  await expect(page.locator("#hud-state")).not.toHaveAttribute(
    "data-p2hp",
    "1160",
  );
  await page.keyboard.press("F1");
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-scene="pause"]')).toBeVisible();
  await page.keyboard.press("Escape");
  // Accelerate the timer to exercise the normal time-over and best-of-three transition.
  await page.evaluate(() => {
    const g = (window as any).__NEON__.game;
    g.mode = "versus";
    g.state.rules.mode = "versus";
    g.state.rules.infiniteHealth = false;
    g.state.fighters[1].hp = 100;
    g.state.timer = 1;
  });
  await page.waitForFunction(
    () => (window as any).__NEON__.state.phase === "ko",
  );
  await page.waitForFunction(() => (window as any).__NEON__.state.round === 2);
  await page.waitForFunction(
    () => (window as any).__NEON__.state.phase === "fight",
  );
  await page.evaluate(() => {
    const s = (window as any).__NEON__.state;
    s.fighters[1].hp = 100;
    s.timer = 1;
  });
  await expect(page.locator('[data-scene="results"]')).toBeVisible();
  await keyboardFocus(page, '[data-action="menu"]');
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-scene="menu"]')).toBeVisible();
  expect(errors).toEqual([]);
});
test("all modes, training recorder, settings and responsive letterboxing", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator('[data-scene="title"]')).toBeVisible();
  await page.keyboard.press("Enter");
  for (const mode of ["arcade", "versus", "trials"]) {
    await page.locator(`[data-action="mode:${mode}"]`).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator('[data-scene="character"]')).toBeVisible();
    await page.keyboard.press("Escape");
  }
  await page.evaluate(() =>
    (window as any).__NEON__.start("sable", "warden", "training", 2),
  );
  await page.waitForFunction(
    () => (window as any).__NEON__.state.phase === "fight",
  );
  await page.keyboard.press("F3");
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(250);
  await page.keyboard.up("KeyD");
  await page.keyboard.press("F3");
  await page.keyboard.press("F4");
  await expect(page.locator("#record-status")).toHaveText("▶ PLAYBACK");
  await page.keyboard.press("Escape");
  await page.locator('[data-action="settings"]').focus();
  await page.keyboard.press("Enter");
  await page.locator('[data-action="setting:shake"]').focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-action="setting:shake"]')).toHaveText("OFF");
  await page.locator('[data-action="keybind:p1_LP"]').focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("KeyF");
  await expect(page.locator('[data-action="keybind:p1_LP"]')).toHaveText("F");
  await page.setViewportSize({ width: 800, height: 900 });
  await expect
    .poll(async () =>
      Math.round((await page.locator("#app").boundingBox())!.width),
    )
    .toBe(800);
  const bounds = await page.locator("#app").boundingBox();
  expect(bounds!.height).toBeCloseTo(450, 0);
  await expect(page.locator('[data-scene="settings"]')).toBeVisible();
});
test("a complete browser match replays to the identical final state", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).__NEON__);
  await page.evaluate(() => {
    const n = (window as any).__NEON__;
    n.start("hayate", "magnus", "versus", 0);
    const g = n.game;
    g.cpuBoth = true;
    g.state.rules.timer = 3;
    g.state.timer = 180;
    g.recording.rules.timer = 3;
  });
  await expect(page.locator('[data-scene="results"]')).toBeVisible({
    timeout: 35000,
  });
  const original = await page.evaluate(
    () => (window as any).__NEON__.game.lastReplay.hash,
  );
  await page.evaluate(() => (window as any).__NEON__.game.playReplay());
  await expect(page.locator('[data-scene="results"]')).toBeVisible({
    timeout: 35000,
  });
  expect(await page.evaluate(() => (window as any).__NEON__.hash())).toBe(
    original,
  );
});

test("gamepad menus, held-button edges, remapping and SOCD", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator('[data-scene="title"]')).toBeVisible();
  await page.keyboard.press("Shift");
  await page.evaluate(() => {
    const w = window as any;
    w.__pad = {
      axes: [0, 0],
      buttons: Array.from({ length: 18 }, () => ({ pressed: false, value: 0 })),
      connected: true,
      index: 0,
      mapping: "standard",
      id: "QA standard controller",
    };
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => [w.__pad],
    });
    w.__pad.buttons[0].pressed = true;
  });
  await page.waitForTimeout(400);
  await expect(page.locator('[data-scene="menu"]')).toBeVisible();
  await page.evaluate(() => {
    (window as any).__pad.buttons[0].pressed = false;
  });
  await page.waitForTimeout(200);
  await page.locator('[data-action="mode:versus"]').focus();
  await page.keyboard.press("Enter");
  await page.evaluate(() => {
    (window as any).__pad.axes[0] = 1;
  });
  await page.waitForTimeout(220);
  await page.evaluate(() => {
    (window as any).__pad.axes[0] = 0;
  });
  expect(
    await page.evaluate(() => (window as any).__NEON__.game.selected[0]),
  ).not.toBe("hayate");
  expect(
    await page.evaluate(() => (window as any).__NEON__.game.selected[1]),
  ).toBe("magnus");
  await page.evaluate(() => {
    (window as any).__pad.buttons[0].pressed = true;
  });
  await page.waitForTimeout(400);
  await expect(page.locator('[data-scene="character"]')).toBeVisible();
  expect(
    await page.evaluate(() => (window as any).__NEON__.game.selectPlayer),
  ).toBe(1);
  await page.evaluate(() => {
    (window as any).__pad.buttons[0].pressed = false;
  });
  await page.keyboard.press("Escape");
  await page.locator('[data-action="settings"]').focus();
  await page.keyboard.press("Enter");
  await page.locator('[data-action="padbind:LP"]').focus();
  await page.evaluate(() => {
    (window as any).__pad.buttons[0].pressed = true;
  });
  await page.waitForTimeout(200);
  expect(
    await page.evaluate(() => (window as any).__NEON__.game.padCapture),
  ).toBe("LP");
  await page.evaluate(() => {
    (window as any).__pad.buttons[0].pressed = false;
  });
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    (window as any).__pad.buttons[3].pressed = true;
  });
  await expect(page.locator('[data-action="padbind:LP"]')).toHaveText(
    "BUTTON 3",
  );
  const input = await page.evaluate(() => {
    const w = window as any;
    w.__pad.buttons[14].pressed = true;
    w.__pad.buttons[15].pressed = true;
    return w.__NEON__.game.devices.read(0);
  });
  expect(input.x).toBe(0);
  expect(input.buttons).toBe(1);
});
