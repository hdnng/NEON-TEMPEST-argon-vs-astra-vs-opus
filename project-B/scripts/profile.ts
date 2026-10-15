import { browserSession } from "./browser";
const session = await browserSession();
const { page, url } = session;
try {
  await page.goto(url);
  await page.waitForFunction(() => !!(window as any).__NEON__);
  await page.evaluate(() => {
    const n = (window as any).__NEON__;
    n.start("hayate", "warden", "training", 1);
    n.game.cpuBoth = true;
  });
  const result = await page.evaluate(async () => {
    const g = (window as any).__NEON__.game,
      r = g.renderer,
      original = r.render.bind(r),
      art = r.art.draw.bind(r.art),
      stats: any[] = [];
    let costs: number[] = [];
    r.render = (...args: any[]) => {
      const t = performance.now();
      original(...args);
      costs.push(performance.now() - t);
    };
    for (const variant of [
      "normal",
      "static-stage",
      "half-resolution",
      "no-background",
      "no-hud",
      "no-render",
    ]) {
      if (variant === "static-stage")
        r.art.draw = (c: any, s: number) =>
          c.drawImage(r.art.snapshots[s] ?? r.art.composites[s], 0, 0);
      if (variant === "half-resolution") {
        r.settings.scale = 0.5;
        r.resize();
      }
      if (variant === "no-background") r.art.draw = () => {};
      if (variant === "no-hud") r.settings.hud = false;
      if (variant === "no-render") r.render = () => {};
      costs = [];
      let frames = 0,
        start = performance.now();
      await new Promise<void>((resolve) => {
        const sample = () => {
          frames++;
          if (performance.now() - start >= 5000) resolve();
          else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      stats.push({
        variant,
        fps: (frames / (performance.now() - start)) * 1000,
        renderMs: costs.reduce((a, b) => a + b, 0) / costs.length,
      });
    }
    return stats;
  });
  console.log(JSON.stringify(result, null, 2));
} finally {
  await session.close();
}
