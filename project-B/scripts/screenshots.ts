import { mkdirSync } from "node:fs";
import { browserSession } from "./browser";
const session = await browserSession(),
  { page, url } = session;
mkdirSync("screenshots", { recursive: true });
const shot = async (name: string) => {
  await page.waitForTimeout(240);
  await page.screenshot({ path: `screenshots/${name}.png` });
  console.log(name);
};
try {
  await page.goto(url);
  await page.waitForSelector('[data-scene="title"]');
  await shot("01-title");
  await page.keyboard.press("Enter");
  await shot("02-main-menu");
  await page.click('[data-action="mode:versus"]');
  await shot("03-character-select");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await shot("04-stage-select");
  await page.click('[data-action="stage:0"]');
  await shot("05-versus");
  await page.waitForSelector('[data-scene="match"]');
  for (let stage = 0; stage < 3; stage++) {
    await page.evaluate((stage) => {
      const n = (window as any).__NEON__;
      n.start(
        ["hayate", "sable", "warden"][stage],
        ["magnus", "hayate", "sable"][stage],
        "versus",
        stage,
      );
      n.state.phase = "fight";
      n.state.fighters[0].x = 580;
      n.state.fighters[1].x = 880;
      n.state.fighters[0].meter = 225;
      n.state.fighters[1].meter = 150;
    }, stage);
    await shot(`0${6 + stage}-stage-${stage + 1}`);
  }
  await page.evaluate(() => {
    const n = (window as any).__NEON__;
    n.start("hayate", "sable", "training", 0);
    n.state.phase = "fight";
    n.state.fighters[0].x = 610;
    n.state.fighters[1].x = 710;
    n.game.renderer.settings.hitboxes = true;
    n.game.renderer.settings.inputs = true;
  });
  await shot("09-training-boxes");
  await page.evaluate(() => {
    const n = (window as any).__NEON__;
    n.game.renderer.settings.hitboxes = false;
    n.super();
  });
  await shot("10-super-cutin");
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    const n = (window as any).__NEON__,
      s = n.state;
    n.game.mode = "versus";
    n.game.show("match");
    s.fighters[0].combo = 7;
    s.fighters[0].comboDamage = 382;
    s.fighters[0].comboTimer = 180;
    s.fighters[0].comboScale = 0.46;
    s.fighters[1].hp = 438;
    s.fighters[1].white = 580;
  });
  await shot("11-combo-counter");
  await page.evaluate(() => {
    const n = (window as any).__NEON__;
    n.state.winner = 0;
    n.state.fighters[0].wins = 2;
    n.state.fighters[1].wins = 1;
    n.state.fighters[0].damageDealt = 2402;
    n.state.frame = 7765;
    n.game.show("results");
  });
  await shot("12-results");
  await page.evaluate(() => {
    const n = (window as any).__NEON__;
    n.start("sable", "warden", "trials", 1);
    n.state.phase = "fight";
  });
  await shot("13-trials");
  await page.keyboard.press("Escape");
  await shot("14-pause");
  await page.click('[data-action="moves"]');
  await shot("15-move-archive");
  await page.keyboard.press("Escape");
  await page.click('[data-action="settings"]');
  await shot("16-settings");
  await page.evaluate(() => {
    const n = (window as any).__NEON__;
    n.start("hayate", "warden", "versus", 0);
    n.state.phase = "fight";
    n.state.fighters[0].x = 480;
    n.state.fighters[1].x = 1020;
  });
  await page.keyboard.down("s");
  await page.waitForTimeout(80);
  await page.keyboard.down("d");
  await page.waitForTimeout(70);
  await page.keyboard.up("s");
  await page.keyboard.press("j", { delay: 50 });
  await page.keyboard.up("d");
  await page.waitForFunction(() =>
    (window as any).__NEON__.state.projectiles.some((p: any) => p.active),
  );
  await shot("17-pulse-current");
  await page.evaluate(() => {
    const n = (window as any).__NEON__;
    n.start("sable", "magnus", "versus", 1);
    n.state.phase = "fight";
    n.state.fighters[0].x = 610;
    n.state.fighters[1].x = 705;
  });
  await page.keyboard.press("o", { delay: 50 });
  await page.waitForFunction(
    () => (window as any).__NEON__.state.fighters[0].combo > 0,
  );
  await page.evaluate(() => {
    (window as any).__NEON__.state.hitstop = 60;
  });
  await page.screenshot({ path: "screenshots/18-heavy-impact.png" });
  console.log("18-heavy-impact");
} finally {
  await session.close();
}
