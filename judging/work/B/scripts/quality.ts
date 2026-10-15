import { readFileSync, writeFileSync } from "node:fs";
const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const unit = read("unit-results.json"),
  e2e = read("e2e-results.json"),
  balance = read("balance-results.json"),
  bench = read("bench-results.json"),
  stress = read("bench-stress.json"),
  startup = read("startup-results.json");
const text = `# Verification and improvement record

## Architecture plan

1. Vite, TypeScript and Canvas 2D; no runtime libraries or downloaded assets.
2. Fixed 60 Hz serializable simulation, separate from rendering and audio.
3. Shared buffered motion input for humans, CPU and recorded replay inputs.
4. Data-defined roster, frame boxes, projectiles, cancels and resources.
5. Original articulated fighters, procedural stages, synthesized music and pooled effects.
6. Complete local modes and menus, then unit/browser/balance/performance verification.
7. Two critical improvement passes informed by actual captures and failures.

## Acceptance evidence

| Gate | Result | Evidence |
|---|---|---|
| Fresh one-command startup | ${startup.passed ? "PASS" : "FAIL"}; dependencies initially absent | startup-results.json |
| Unit suite | ${unit.numPassedTests}/${unit.numTotalTests} passed | unit-results.json; tests/ |
| Browser end-to-end | ${e2e.stats.expected} passed; ${e2e.stats.unexpected} unexpected failures | e2e-results.json |
| Seeded CPU tournament | ${balance.matches} complete matches; ${balance.crashes} crashes; ${balance.softlocks} softlocks | BALANCE.md; balance-results.json |
| Determinism | Unit state hashes and a full browser replay agree | systems.test.ts; game.spec.ts |
| Combo trials | All 12 validated using actual buffered inputs and landed hits | systems.test.ts |
| Visual review | 18 final full-resolution captures inspected | screenshots/ |
| 60-second rendering benchmark | ${bench.averageFPS.toFixed(2)} average FPS; ${bench.onePercentLowFPS.toFixed(2)} FPS 1% low; ${bench.averageFrameTimeMs.toFixed(2)} ms/frame | bench-results.json |
| Runtime console | ${bench.errors.length} errors/warnings in the benchmark; the keyboard-flow E2E test also asserts zero | bench-results.json; game.spec.ts |
| Production | Typecheck and Vite build completed | npm run build; dist/ |

## Improvement pass 1 — first working version

The complete first implementation was built and captured before this review. The five largest weaknesses and resulting fixes were:

1. **Flat fighter materials:** added faceted light/shadow surfaces, gloves, mechanical joints, face details, fabric seams and distinct armor details.
2. **Small fighting silhouettes:** increased in-match art scale and aligned hurtboxes with the illustrated bodies; added cropped HUD portraits.
3. **Selection text crossed fighter artwork:** moved previews inward, added quiet stat backplates and improved card color accents.
4. **HUD leaked into results and cinematics:** results now use their own hero composition; training tools yield to the super cut-in; the winning fighter appears on results.
5. **Weak projectile decisions and extreme roster imbalance:** taught CPUs to approach charge zones, crouch-charge in place, react to travelling projectiles and punish recovery. Adjusted Warden's damage/recovery and Sable's reach, vitality and pressure. The first 512-match run had Warden at 89.1%; the final rates are recorded below.

## Improvement pass 2 — mechanics, usability and performance

The second capture/test review found these five main weaknesses:

1. **Buffered inputs lost their stance/EX context during hitstop:** preserved the input edge's direction/modifiers, froze buffer age through hitstop, and verified every trial with actual inputs.
2. **Combo recovery and defensive edges:** corrected clean-opening scaling, final-frame links, airborne knockdown follow-ups, untechable grounded command grabs, negative-life armor, true teleport cross-ups and world-direction guarding, dizzy recovery, perfect announcements and cumulative match totals. Added regression coverage.
3. **Controller and replay edge cases:** made held confirm buttons edge-triggered, routed the first character cursor correctly, required release before gamepad remapping, swapped conflicting bindings, and removed Arcade continuation from replay results. Verified a complete browser replay hash.
4. **Rendering missed its target:** the first 60-second headless-shell/software-graphics run measured 11.67 FPS. Profiled individual layers, cached generated fighter frames and static stage composites, rasterized reusable images, reduced HUD redraws, replaced expensive rain strokes/patterns with small primitives and stopped painting behind paused panels. The acceptance benchmark uses full Chromium's hardware-capable headless backend; its actual graphics device/features are saved alongside the results. The original diagnostic run remains in bench-baseline.json; the backend and rendering changes both contributed, so the two timings are not a controlled speedup comparison.
5. **Incomplete verification artifacts and startup ergonomics:** added an automatic dependency bootstrap, tested it in a clean temporary checkout, saved machine-readable unit/browser/startup reports, generated full move documentation from combat data, and inspected the final captures again.

## Final tuning and measurement context

${balance.winRates.map((r: any) => `${r.id.toUpperCase()}: ${(r.winRate * 100).toFixed(1)}%`).join(" · ")}. Rates combine both sides, exclude mirrors and count a draw as half a win. ${balance.totalFrames.toLocaleString()} deterministic frames were simulated; average match duration ${balance.averageMatchSeconds.toFixed(1)} seconds. CPU-policy balance does not establish competitive human balance.

The final benchmark runs two Hard CPUs with standard versus health/meter and round rules, full graphics/HUD, procedural audio and background animation. It measures requestAnimationFrame intervals for ${bench.durationSeconds.toFixed(2)} seconds after warmup. Memory is sampled JS heap (${bench.memoryPeakMB.toFixed(1)} MiB peak); bitmap/driver allocations are additional. Rendered resolution is ${bench.canvas.join(" × ")}. Browser: ${bench.browserBackend ?? bench.environment}. Actual GPU: ${bench.graphics?.devices?.[0]?.deviceString ?? "see report"}. Hardware-specific numbers are not a universal performance guarantee.

The measured rendering rate remains below a strictly locked 60 FPS on this host, including occasional missed presentation frames. This is an outstanding performance limit, not a fully passed steady-60 guarantee. The simulation uses a fixed 60 Hz step; the measured window records ${bench.droppedCatchups} catch-up/safety-cap overruns, with ${bench.warmupOverruns} during warmup. The earlier optimized run is retained in bench-optimization.json so measurement variation remains visible. An additional unlimited-meter Training stress run measured ${stress.averageFPS.toFixed(2)} FPS average / ${stress.onePercentLowFPS.toFixed(2)} FPS 1% low; its distinct workload is retained in bench-stress.json. These workloads should not be compared as a controlled optimization speedup.

Screenshots use controlled state fixtures for reproducible super, combo and results captures. Connected combos, input recognition, rounds and replay correctness are separately verified by executable tests. Controller routing/remapping was tested with a standard Gamepad API fixture; a physical controller was not available for a tactile check.
`;
writeFileSync("QUALITY.md", text);
