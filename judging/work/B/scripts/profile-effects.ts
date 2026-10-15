import { browserSession } from "./browser";
const ss = await browserSession();
try {
  await ss.page.goto(ss.url);
  await ss.page.waitForFunction(() => !!(window as any).__NEON__);
  await ss.page.evaluate(() => {
    const n = (window as any).__NEON__;
    n.start("hayate", "warden", "training", 1);
    n.game.cpuBoth = true;
  });
  const results = await ss.page.evaluate(async () => {
    const g = (window as any).__NEON__.game,
      out: any[] = [];
    for (const effect of ["all", "rain", "ripples", "beam", "petals"]) {
      if (effect !== "all") g.renderer.art.effects[effect] = false;
      let start = performance.now(),
        frames = 0;
      await new Promise<void>((resolve) => {
        const tick = () => {
          frames++;
          if (performance.now() - start > 5000) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      out.push({
        disabledThrough: effect,
        fps: (frames / (performance.now() - start)) * 1000,
      });
    }
    return out;
  });
  console.log(results);
} finally {
  await ss.close();
}
