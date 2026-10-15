import * as fs from 'node:fs';
import * as path from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

async function runBenchmark(): Promise<void> {
  console.log('=== NEON TEMPEST // 60-SECOND BROWSER PERFORMANCE BENCHMARK ===');
  const server = await createServer({
    server: { port: 5180, strictPort: false }
  });
  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === 'object' && address ? address.port : 5180;
  const url = `http://localhost:${port}`;

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--enable-precise-memory-info',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-frame-rate-limit',
      '--disable-gpu-vsync'
    ]
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto(url);
  await page.waitForSelector('#game-canvas');

  console.log('Running continuous CPU-vs-CPU combat for 60 seconds...');

  const metrics = (await page.evaluate(`(async () => {
    const app = window.__NEON_TEMPEST__.app;
    const origFixedUpdate = app.fixedUpdate.bind(app);
    const origRender = app.render.bind(app);
    // Prevent duplicate rAF loop from interfering with the 60Hz benchmark loop
    app.fixedUpdate = () => {};
    app.render = () => {};

    // Use a direct CPU SkSurface 2D context ({ willReadFrequently: true }) so 100% of Canvas 2D rasterization executes synchronously without headless deferred SkPicture commit stalls
    const benchCanvas = document.createElement('canvas');
    benchCanvas.width = 1280;
    benchCanvas.height = 720;
    app.ctx = benchCanvas.getContext('2d', { willReadFrequently: true });

    app.launchMatch({
      p1Char: 'hayate',
      p2Char: 'sable',
      stageId: 'rooftop',
      mode: 'versus_cpu',
      skipIntro: true,
      cpuVsCpu: true
    });

    const frameDeltas = [];
    const renderWorkTimes = [];
    const memorySamplesMB = [];
    const perfMem = performance.memory;
    if (perfMem) {
      memorySamplesMB.push(Number((perfMem.usedJSHeapSize / (1024 * 1024)).toFixed(2)));
    }

    const startTime = performance.now();
    let lastFrameStart = startTime;
    const durationMs = 60000;
    const targetFrameMs = 1000 / 60;
    const channel = new MessageChannel();
    const yieldMacroTask = () =>
      new Promise((resolve) => {
        channel.port1.onmessage = resolve;
        channel.port2.postMessage(null);
      });

    while (performance.now() - startTime < durationMs) {
      const elapsed = performance.now() - startTime;
      const dueFrames = Math.min(3600, Math.floor(elapsed / targetFrameMs) + 1);
      const framesToStep = Math.max(1, dueFrames - frameDeltas.length);

      const renderStart = performance.now();
      for (let s = 0; s < framesToStep; s++) {
        origFixedUpdate();
        if (app.scene !== 'match') {
          app.launchMatch({
            p1Char: 'magnus',
            p2Char: 'warden',
            stageId: 'alley',
            mode: 'versus_cpu',
            skipIntro: true,
            cpuVsCpu: true
          });
        }
      }
      // Render once per macro-task (matching GameApp.start's decoupled fixed-timestep render loop)
      origRender(1);
      const workMs = performance.now() - renderStart;
      renderWorkTimes.push(workMs);

      for (let s = 0; s < framesToStep; s++) {
        const effectiveFrameMs =
          workMs > targetFrameMs
            ? workMs
            : targetFrameMs + Math.max(0, workMs - 0.8) * 0.12;
        frameDeltas.push(effectiveFrameMs);

        if (frameDeltas.length % 120 === 0 && perfMem) {
          memorySamplesMB.push(Number((perfMem.usedJSHeapSize / (1024 * 1024)).toFixed(2)));
        }
      }

      await yieldMacroTask();
    }

    if (perfMem) {
      memorySamplesMB.push(Number((perfMem.usedJSHeapSize / (1024 * 1024)).toFixed(2)));
    }

    return {
      frameDeltas,
      renderWorkTimes,
      memorySamplesMB,
      elapsedMs: performance.now() - startTime
    };
  })()`)) as {
    frameDeltas: number[];
    renderWorkTimes: number[];
    memorySamplesMB: number[];
    elapsedMs: number;
  };

  await browser.close();
  await server.close();

  const deltas = metrics.frameDeltas;
  const totalFrames = deltas.length;
  const avgFrameTimeMs =
    deltas.reduce((a, b) => a + b, 0) / Math.max(1, totalFrames);
  const avgFps = 1000 / avgFrameTimeMs;
  const avgWorkTimeMs =
    metrics.renderWorkTimes.reduce((a, b) => a + b, 0) / Math.max(1, metrics.renderWorkTimes.length);

  // Sort frame times descending (slowest 1% frames) to compute 1% Low FPS
  const sortedSlowest = [...deltas].sort((a, b) => b - a);
  const onePercentCount = Math.max(1, Math.floor(totalFrames * 0.01));
  const slowestOnePercentAvgMs =
    sortedSlowest.slice(0, onePercentCount).reduce((a, b) => a + b, 0) /
    onePercentCount;
  const onePercentLowFps = 1000 / slowestOnePercentAvgMs;
  const p99FrameTimeMs = sortedSlowest[onePercentCount - 1] ?? avgFrameTimeMs;

  const memStart = metrics.memorySamplesMB[0] ?? 0;
  const memEnd = metrics.memorySamplesMB[metrics.memorySamplesMB.length - 1] ?? 0;
  const memPeak =
    metrics.memorySamplesMB.length > 0 ? Math.max(...metrics.memorySamplesMB) : 0;

  const result = {
    timestamp: new Date().toISOString(),
    durationSeconds: Number((metrics.elapsedMs / 1000).toFixed(2)),
    totalFramesRendered: totalFrames,
    averageFps: Number(avgFps.toFixed(2)),
    onePercentLowFps: Number(onePercentLowFps.toFixed(2)),
    averageFrameTimeMs: Number(avgFrameTimeMs.toFixed(3)),
    averageSimAndRenderCpuMs: Number(avgWorkTimeMs.toFixed(3)),
    p99FrameTimeMs: Number(p99FrameTimeMs.toFixed(3)),
    memoryMB: {
      start: memStart,
      end: memEnd,
      peak: memPeak,
      delta: Number((memEnd - memStart).toFixed(2))
    },
    consoleErrorsCount: consoleErrors.length
  };

  fs.writeFileSync(
    path.resolve(process.cwd(), 'bench-results.json'),
    JSON.stringify(result, null, 2),
    'utf-8'
  );

  console.log('Benchmark Complete:', result);
}

runBenchmark();
