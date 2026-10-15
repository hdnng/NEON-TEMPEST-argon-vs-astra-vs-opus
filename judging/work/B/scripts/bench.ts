import { writeFileSync } from "node:fs";
import { browserSession } from "./browser";
const session = await browserSession(),
  { page, url } = session;
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") errors.push(m.text());
});
try {
  const cdp = await session.browser.newBrowserCDPSession();
  const systemInfo = await cdp.send("SystemInfo.getInfo");
  await page.goto(url);
  await page.waitForFunction(() => !!(window as any).__NEON__);
  await page.evaluate(() => {
    const n = (window as any).__NEON__;
    n.start("hayate", "warden", "versus", 1);
    n.game.cpuBoth = true;
    n.game.settings.difficulty = 2;
    n.game.brains.forEach((b: any) => (b.difficulty = 2));
  });
  await page.keyboard.press("Enter");
  await page.waitForTimeout(3000);
  const result = await page.evaluate(async () => {
    const n = (window as any).__NEON__,
      frames: number[] = [],
      mem: number[] = [];
    const warmupOverruns = n.game.dropped;
    let matches = 1;
    let last = 0,
      start = 0;
    await new Promise<void>((resolve) => {
      function sample(now: number) {
        if (!start) {
          start = last = now;
          requestAnimationFrame(sample);
          return;
        }
        if (n.state.phase === "complete") {
          n.start("hayate", "warden", "versus", 1);
          n.game.cpuBoth = true;
          matches++;
        }
        frames.push(now - last);
        last = now;
        const m = (performance as any).memory;
        if (m && frames.length % 60 === 0) mem.push(m.usedJSHeapSize);
        if (now - start >= 60000) resolve();
        else requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    });
    const sorted = [...frames].sort((a, b) => a - b),
      sum = frames.reduce((a, b) => a + b, 0),
      worst = sorted.slice(Math.floor(sorted.length * 0.99)),
      memory = (performance as any).memory;
    return {
      durationSeconds: sum / 1000,
      frames: frames.length,
      averageFPS: 1000 / (sum / frames.length),
      onePercentLowFPS:
        1000 / (worst.reduce((a, b) => a + b, 0) / worst.length),
      averageFrameTimeMs: sum / frames.length,
      p99FrameTimeMs: sorted[Math.floor(sorted.length * 0.99)],
      maxFrameTimeMs: sorted.at(-1),
      memoryStartMB: mem[0] / 1048576,
      memoryEndMB: memory?.usedJSHeapSize / 1048576,
      memoryPeakMB: Math.max(...mem) / 1048576,
      simulationFrame: n.state.frame,
      droppedCatchups: n.game.dropped - warmupOverruns,
      warmupOverruns,
      matches,
      workload: "Hard CPU vs CPU, standard health and meter, best of three, 99-second rounds, all presentation effects and audio enabled",
      userAgent: navigator.userAgent,
      viewport: [innerWidth, innerHeight],
      devicePixelRatio,
      canvas: [n.game.canvas.width, n.game.canvas.height],
    };
  });
  const report = {
    ...result,
    date: new Date().toISOString(),
    browserBackend: "Full Chromium, new headless mode (channel: chromium)",
    graphics: {
      devices: systemInfo.gpu.devices,
      features: systemInfo.gpu.featureStatus,
    },
    environment:
      "Headless Chromium on this Windows host; hardware/virtualization specific, not a universal laptop guarantee.",
    errors,
  };
  writeFileSync("bench-results.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (errors.length) process.exitCode = 1;
} finally {
  await session.close();
}
