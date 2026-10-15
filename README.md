**English** | [Tiếng Việt](README.vi.md)

# NEON TEMPEST — independent blind evaluation

Opus offers the strongest combat implementation, CPU policy, verification coverage and scene architecture. Astra has the clearest interface hierarchy and substantially better native-resolution performance, but its normal-throw tech fails in the full simulation. Argon is playable and has a substantial combat core, yet its presentation is basic, its browser test fails, and several README claims do not describe the shipped code. These are evaluations of the submitted artifacts under the same protocol; the labels have not been deanonymized.

[Open the interactive bilingual HTML report](report.html). Raw evidence and reproducibility scripts are under [judging/](judging/).

## 1. Summary and ranking

| Rank | Project | runs (10) | combat (20) | feel (10) | ai (8) | ui (20) | visuals (10) | balance (5) | performance (7) | tests (7) | architecture (3) | Total / 100 | Spec % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Opus <!--score:Opus--> | 8.0 | 8.4 | 8.0 | 8.2 | 7.8 | 8.0 | 6.7 | 5.0 | 8.6 | 8.1 | **78.26** | 93.33 |
| 2 | Astra <!--score:Astra--> | 8.0 | 7.1 | 7.1 | 6.2 | 8.2 | 7.1 | 7.2 | 8.5 | 7.3 | 7.0 | **74.52** | 88.33 |
| 3 | Argon <!--score:Argon--> | 8.0 | 7.2 | 6.5 | 5.0 | 6.0 | 5.4 | 6.6 | 4.0 | 3.8 | 4.8 | **60.50** | 75.00 |


Weights total **100**. Category scores are on **0–10**; the total is `sum(score × weight / 10)`. The anchors are **5** functional/generic, **8** polished/robust, **9–10** exceptional near-commercial quality. No score enters the exceptional band. All numerical results and rankings are computed by script.

All highest and lowest category scores were reread against the same anchors. Identical run/stability scores are intentional: startup, builds, long play and the balance safety checks all pass. No category reaches the near-commercial band; human game feel and audio taste remain unverified.

| Project | Code-based game feel estimate | Human playtest score |
| --- | --- | --- |
| Argon | 6.5 |  |
| Astra | 7.1 |  |
| Opus | 8.0 |  |


Confidence: high for observed commands, assertions and recorded state; moderate for visual/code quality; low for human game feel, listening quality and competitive balance.

## 2. Methodology and limitations

**Random review order:** Astra → Opus → Argon. **Seed:** 2139301718. **Viewport:** 1920 × 1080; **DPR:** 1; **rAF benchmark:** 60 s; **keyboard play:** 120 s; **headless balance:** 512 matches/project; **input replay:** 7200 frames.

SPEC.md is the authority. Review order was drawn before execution and preserved in environment.json. Each submission was copied before installation. Original source/content hashes were recorded and checked again at delivery; dependencies, old builds and test output were excluded from the clean copies. No submission source was fixed.

Startup followed each README exactly; BROWSER=none only suppressed an unsolicited browser window. A server address overlap was resolved by verifying the loaded application identity and selecting the correct IPv4/IPv6 address. Builds use the same command. Original unit and browser suites were run; browser viewport was overridden consistently. Node runner color-environment warnings are retained in command logs and are distinct from game console warnings.

The primary benchmark uses production bundles, full Chromium headless, the same GPU flags, fixed resolution scale, a fresh profile, standard life/meter and Hard HAYATE versus SABLE on the first stage. It measures actual requestAnimationFrame intervals, with a warmup, automatic next-match restart and raw samples retained. A separate software-rendering run and keyboard gameplay are also retained. No uncapped or scheduled synthetic FPS is substituted for rAF.

Keyboard navigation and sustained gameplay use actual DOM keyboard input. Precise combat spot-checks run the original simulation inside a live browser through raw inputs; only neutral spacing, initial life/meter and near-expiry timer fixtures are staged. No move, hit, combo count, damage or winner is fabricated. Animation captures pause presentation at genuine simulated states. Gallery notes identify these fixtures; they are not claims of a naturally played full-health victory.

Completion is a separate equal-weight checklist, not the weighted quality score. Partial earns half credit; Missing and Broken earn none. Composite requirements are Partial if material parts are missing, broken or unverified. The unnumbered robustness bullets are explicitly labeled. Process and deliverable sections outside the requested checklist do not inflate this percentage.

Headless FPS is host/backend-specific and does not establish input latency, human-perceived smoothness or universal laptop performance. Endpoint heap growth without forced GC is not proof of a leak. The common viewport does not force identical internal pixel counts: Argon keeps a smaller backing canvas, while Astra and Opus render at the full viewport in the primary benchmark. Opus normally offers automatic resolution reduction; it was disabled for this fixed-scale comparison.

The judge is an LLM: aesthetic preferences, code-reading omissions and fixture design can bias results. The score anchors were reread across submissions; high scores require executable or visual evidence. Game feel is only a code-based estimate. No physical controller or human assessment of responsiveness, mix, fatigue, strategic depth or competitive balance was performed.

Benchmark match seeds follow each project’s browser defaults; exact seeded reproducibility is established separately in the common balance and input-replay harnesses. There is one primary run per backend, so the reported tails are measurements, not repeat-run confidence intervals.

Long-running startup commands have no natural exit at readiness: the recorded exit code is null, with the ready duration and PID retained. Build/test commands have ordinary exit codes. Submitted screenshots were never used as visual evidence.

## 3. Objective metrics

| Metric | Argon | Astra | Opus |
| --- | --- | --- | --- |
| README startup; assisted? <!--metric:startup--> | PASS / NO | PASS / NO | PASS / NO |
| Install + ready (s) <!--metric:startup_seconds--> | 14.843 | 12.702 | 15.190 |
| Build exit code <!--metric:build_exit--> | 0 | 0 | 0 |
| Build time (s) <!--metric:build_seconds--> | 7.309 | 10.494 | 13.893 |
| Whole dist / gzip bytes <!--metric:bundle_bytes--> | 194742 / 53925 | 114188 / 40740 | 411823 / 133781 |
| JS only / gzip bytes <!--metric:js_bytes--> | 193452 / 53233 | 96677 / 35632 | 410475 / 133027 |
| Own unit: passed / failed <!--metric:unit--> | 8 / 0 | 55 / 0 | 68 / 0 |
| Own E2E: expected / unexpected / skipped <!--metric:e2e--> | 0 / 1 / 0 | 4 / 0 / 0 | 5 / 0 / 0 |
| Game console: errors / warnings <!--metric:console--> | 0 / 0 | 0 / 0 | 0 / 0 |
| GPU: average FPS <!--metric:fps_average--> | 32.61 | 60.02 | 41.83 |
| GPU: 1% low FPS <!--metric:fps_low--> | 13.96 | 58.99 | 17.91 |
| GPU: p95 frame time (ms) <!--metric:p95--> | 50.00 | 16.80 | 33.40 |
| GPU: p99 frame time (ms) <!--metric:p99--> | 66.60 | 16.90 | 50.00 |
| GPU: measured duration (s) <!--metric:duration--> | 60.01 | 60.01 | 60.03 |
| GPU: rAF intervals sampled <!--metric:samples--> | 1957 | 3602 | 2511 |
| JS heap start (MiB) <!--metric:heap_start--> | 2.99 | 3.23 | 8.21 |
| JS heap end (MiB) <!--metric:heap_end--> | 5.23 | 4.38 | 11.10 |
| JS heap growth (MiB) <!--metric:heap_growth--> | 2.24 | 1.15 | 2.89 |
| Primary backing canvas <!--metric:pixels--> | 1280 × 720 | 1920 × 1080 | 1920 × 1080 |
| Software: average / low FPS <!--metric:software--> | 36.72 / 10.86 | 41.56 / 13.64 | 7.56 / 2.97 |
| Independent keyboard play (s) <!--metric:play_seconds--> | 121.07 | 120.51 | 121.41 |
| Independent determinism / serialized continuation <!--metric:determinism--> | PASS / PASS | PASS / PASS | PASS / PASS |
| Bot matches / crashes / frame-cap hits <!--metric:bot--> | 512 / 0 / 0 | 512 / 0 / 0 | 512 / 0 / 0 |
| Mean match length (simulated s) <!--metric:match_seconds--> | 67.52 | 72.12 | 106.91 |
| Spec completion % <!--metric:completion--> | 75.00% | 88.33% | 93.33% |


Bundle totals include HTML/CSS/JS; gzip is the sum of independently compressed output files. The heap figures include normal replay recording and the benchmark sampler and do not establish a leak. The primary GPU exposes accelerated Canvas and compositing; the software run uses the default headless-shell software path.

Evidence: [judging/data/environment.json](judging/data/environment.json); [judging/data/objective.json](judging/data/objective.json); [logs/Argon/independent-benchmark-gpu.json](judging/logs/A/independent-benchmark-gpu.json); [logs/Astra/independent-benchmark-gpu.json](judging/logs/B/independent-benchmark-gpu.json); [logs/Opus/independent-benchmark-gpu.json](judging/logs/C/independent-benchmark-gpu.json)

### Submitted benchmark claims versus observation

| Project | Claim avg | Observed avg | Δ % | Claim low | Observed low | Δ % | Mismatch flag |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Argon | 59.61 | 32.61 | -45.29% | 48.45 | 13.96 | -71.19% | True |
| Astra | 59.60 | 60.02 | 0.70% | 35.13 | 58.99 | 67.93% | True |
| Opus | 59.70 | 41.83 | -29.93% | 38.30 | 17.91 | -53.23% | True |


The mismatch rule is an average FPS difference above **10%** or a low-FPS difference above **25%**, in either direction. All comparison rows have different conditions from the submitted claims: this flags non-reproduction, not dishonesty. Argon’s method additionally replaces rAF presentation with scheduled offscreen work.

### Independent combat spot-checks

| Probe | Argon | Astra | Opus |
| --- | --- | --- | --- |
| QCF projectile | PASS | PASS | PASS |
| DP startup invincibility | PASS | PASS | PASS |
| Throw and throw tech | PASS | FAIL | PASS |
| High and low guard | PASS | PASS | PASS |
| Combo counter and damage scaling | PASS | PASS | PASS |
| Super meter gain and Super Art | PASS | PASS | PASS |
| Timer and time-over | PASS | PASS | PASS |
| KO and round transition | PASS | PASS | PASS |
| Next round starts | PASS | PASS | PASS |
| Warden charge move | PASS | PASS | PASS |
| Magnus command grab | PASS | PASS | PASS |
| Sable double jump or air dash | PASS | PASS | PASS |


[logs/Argon/combat-spotchecks.json](judging/logs/A/combat-spotchecks.json); [logs/Astra/combat-spotchecks.json](judging/logs/B/combat-spotchecks.json); [logs/Opus/combat-spotchecks.json](judging/logs/C/combat-spotchecks.json); [logs/Astra/edge-cases.json](judging/logs/B/edge-cases.json)

### Spec completion by section

| Section / requirements | Argon | Astra | Opus |
| --- | --- | --- | --- |
| A / 4 | 100.00% | 100.00% | 100.00% |
| B / 10 | 85.00% | 90.00% | 95.00% |
| C / 8 | 75.00% | 87.50% | 93.75% |
| D / 2 | 50.00% | 50.00% | 75.00% |
| E / 6 | 50.00% | 91.67% | 91.67% |
| Overall | 75.00% | 88.33% | 93.33% |


## 4. Project reviews and screenshot galleries

### Argon

**Strengths.** Runs from the documented setup without assistance; the deterministic combat core includes the full roster, motion/charge attacks, throws, guard levels, cancels, scaling, resources and round flow. The required combat probes pass. Training telemetry and the move archive expose useful information. Procedural line art remains visually consistent across the menus and HUD.

**Weaknesses.** Characters are simplified neon outlines and the stages reuse the same city/grid composition, so the result feels closer to a functional prototype than commercial art direction. Dense small text and the fixed backing resolution weaken readability. CPU defense sees current state immediately. The very small unit suite and failing E2E do not support the breadth of the verification claims.

**Issue — Full-scale rendering misses the stable performance target.** Run the shared GPU benchmark on each production build with the fixed scale and common viewport. Inspect raw intervals and the long-tail metrics; the result persists while Astra meets the same threshold. For Opus, automatic scale is a fallback rather than evidence of full-resolution performance. [logs/Argon/independent-benchmark-gpu.json](judging/logs/A/independent-benchmark-gpu.json); [logs/Astra/independent-benchmark-gpu.json](judging/logs/B/independent-benchmark-gpu.json); [logs/Opus/independent-benchmark-gpu.json](judging/logs/C/independent-benchmark-gpu.json)

**Issue — Own browser verification fails and overstates keyboard coverage.** Run the recorded E2E command. The move-list expectation fails because the menu never reaches that scene after rapid presses. A paced independent keyboard traversal succeeds. The later special test directly steps the simulation, so it would not prove the advertised keyboard path even if navigation passed. [logs/Argon/own-e2e.log](judging/logs/A/own-e2e.log); [logs/Argon/browser-flow.json](judging/logs/A/browser-flow.json); [Argon/tests/e2e.spec.ts:113](judging/work/A/tests/e2e.spec.ts#L113)

**Issue — README command-grab binding and Ultimate cost differ from code.** Follow the README’s HCF+punch grab binding: the selected move is the armored shoulder charge. The actual grab uses the rotation binding. The move data also sets the Ultimate cost below the README claim. The live archive is more accurate than the prose documentation. [logs/Argon/edge-cases.json](judging/logs/A/edge-cases.json); [Argon/README.md:119](judging/work/A/README.md#L119); [Argon/src/data/characters.ts:747](judging/work/A/src/data/characters.ts#L747)

**Issue — Rotation parser accepts a non-rotating cardinal sequence.** Feed the same out-of-order cardinal sequence recorded in edge-cases.json. Argon and Opus accept it as a rotation; Astra rejects it. Opus explicitly documents this implementation choice in a code comment. This is excessive leniency rather than a failure to recognize valid motions. [logs/Argon/edge-cases.json](judging/logs/A/edge-cases.json); [logs/Astra/edge-cases.json](judging/logs/B/edge-cases.json); [logs/Opus/edge-cases.json](judging/logs/C/edge-cases.json)

#### Balance — row is Player 1 win percentage

| P1 / P2 | HAYATE | MAGNUS | SABLE | WARDEN |
| --- | --- | --- | --- | --- |
| HAYATE | 50.00% | 56.25% | 68.75% | 28.12% |
| MAGNUS | 18.75% | 56.25% | 62.50% | 78.12% |
| SABLE | 37.50% | 53.12% | 59.38% | 59.38% |
| WARDEN | 81.25% | 25.00% | 43.75% | 53.12% |


Each ordered cell has **32** matches. Aggregate rates combine both sides, exclude mirror matches and count draws as half-wins. Match duration includes intro/outro, hitstop and round transitions. This is bot-policy balance, with correlated match seeds and limited per-matchup precision.

| Fighter | Win % | Wilson 95% |
| --- | --- | --- |
| HAYATE | 52.60 | 45.56–59.55 |
| MAGNUS | 54.17 | 47.11–61.06 |
| SABLE | 45.83 | 38.94–52.89 |
| WARDEN | 47.40 | 40.45–54.44 |


[logs/Argon/independent-balance.json](judging/logs/A/independent-balance.json); [logs/Argon/roster-inventory.json](judging/logs/A/roster-inventory.json)

#### Judge-captured gallery — click to inspect originals

All game captures are **1920 × 1080**. Menu-flow captures use real keyboard traversal; precision combat shots use disclosed fixtures. The blank mode-select placeholders label only the missing separate screen. All images were inspected, including animation frames.

| Screen | Visual review / evidence |
| --- | --- |
| [![Argon — Boot / logo](judging/screenshots/A/01-boot-logo.png)](judging/screenshots/A/01-boot-logo.png) | Centered mark and heading have clear spacing; the supporting initialization line is tiny. Restrained boot composition, with a generic geometric logo. |
| [![Argon — Title](judging/screenshots/A/02-title.png)](judging/screenshots/A/02-title.png) | Title and confirm button are easy to locate. Repeated cyan borders, glow and small outlined fighters make this feel like a functional neon prototype. |
| [![Argon — Main menu](judging/screenshots/A/03-main-menu.png)](judging/screenshots/A/03-main-menu.png) | Aligned card grid and strong selection border work. Nearly every label is uppercase/bold, so supporting text is dense and the hierarchy is fairly flat. |
| [![Argon — Character select](judging/screenshots/A/04-character-select.png)](judging/screenshots/A/04-character-select.png) | Both side panels, cursors and stat bars fit cleanly. Large symbolic portraits outweigh the small fighter previews; short move descriptions are cramped. |
| [![Argon — Stage select](judging/screenshots/A/05-stage-select.png)](judging/screenshots/A/05-stage-select.png) | Stage names and selection are readable, but there are no distinct stage thumbnail previews here. Large empty upper space retains the reused city backdrop. |
| [![Argon — Versus splash](judging/screenshots/A/06-versus-splash.png)](judging/screenshots/A/06-versus-splash.png) | Clear split composition and high-contrast names. The icon portraits and neon dividers are consistent, though visually simple; no persistent clipping. |
| [![Argon — Round-start HUD](judging/screenshots/A/07-match-hud-start.png)](judging/screenshots/A/07-match-hud-start.png) | Timer and health are recognizable; numerical labels are small. The intro band occupies much of the center and the outlined fighters feel lightweight. |
| [![Argon — Connected combo](judging/screenshots/A/08-mid-combo.png)](judging/screenshots/A/08-mid-combo.png) | Actual connected combo has a clear counter and damage/scaling text. The hit spark is readable, but both bodies still look like simple articulated line figures. |
| [![Argon — Super cut-in / active](judging/screenshots/A/09-super-active.png)](judging/screenshots/A/09-super-active.png) | The cut-in band is properly aligned. Cyan-on-blue lettering and excessive bloom soften the super name; the small bust is closer to an icon than a cinematic portrait. |
| [![Argon — KO / round end](judging/screenshots/A/10-ko-round-end.png)](judging/screenshots/A/10-ko-round-end.png) | Perfect KO announcement is large, centered and legible without colliding with the HUD. The background composition remains visually flat. |
| [![Argon — Training + boxes](judging/screenshots/A/11-training-hitboxes.png)](judging/screenshots/A/11-training-hitboxes.png) | Real active hit/hurt/push boxes and frame telemetry are visible. The panels fit, but the small legend and bottom tool hints require close inspection. |
| [![Argon — Move list](judging/screenshots/A/12-move-list.png)](judging/screenshots/A/12-move-list.png) | Move rows, inputs and frame columns line up. Dense compact text and glow reduce reading comfort; scrolling is required for the remaining moves. |
| [![Argon — Settings](judging/screenshots/A/13-settings.png)](judging/screenshots/A/13-settings.png) | Settings rows and selected value align well. The shared all-caps treatment and very small footer feel utilitarian; the shown tabs only remap keyboards. |
| [![Argon — Results](judging/screenshots/A/14-results.png)](judging/screenshots/A/14-results.png) | Winner, score, stats and rematch choices have a clear layout. The oversized icon and rank slogan look generic; borders and selected-button contrast are consistent. |
| [![Argon — Stage I](judging/screenshots/A/15-stage-1.png)](judging/screenshots/A/15-stage-1.png) | Rooftop has legible fighters, rain and wet grid. Depth relies mainly on repeated building outlines and signage rather than rich material or lighting variation. |
| [![Argon — Stage II](judging/screenshots/A/16-stage-2.png)](judging/screenshots/A/16-stage-2.png) | The magenta palette and signage change, but the same skyline/grid/crowd composition dominates. HUD and action remain unobstructed. |
| [![Argon — Stage III](judging/screenshots/A/17-stage-3.png)](judging/screenshots/A/17-stage-3.png) | Shrine gates and the central symbol distinguish this variant. It still shares the flat line-art language and floor with the other stages. |
| [![Argon — Special animation strip](judging/screenshots/A/18-special-strip.png)](judging/screenshots/A/18-special-strip.png) | Six genuine cast samples show the star projectile forming and moving. Anticipation and body-weight changes are slight; open the originals to judge poses. |
| [![Argon — Pause](judging/screenshots/A/19-pause-menu.png)](judging/screenshots/A/19-pause-menu.png) | Centered pause panel has clear button contrast and orderly spacing. Its large unused lower area and repeated cyan outline look basic. |
| [![Argon — Separate mode select](judging/screenshots/A/20-mode-select.png)](judging/screenshots/A/20-mode-select.png) | Judge placeholder: only the separate mode-select screen is absent. The integrated main-menu mode choices are shown elsewhere and are not treated as missing modes. |
| [![Argon — Trials](judging/screenshots/A/21-trials.png)](judging/screenshots/A/21-trials.png) | Trial guide fits in the top-right without HUD collisions. Instructions and step text are small, while most of the frame is the familiar empty stage. |
| [![Argon — Keyboard QCF evidence](judging/screenshots/A/22-keyboard-qcf.png)](judging/screenshots/A/22-keyboard-qcf.png) | The projectile and training telemetry come from actual keyboard motion. Thin input-history symbols and small labels remain harder to read than the main HUD. |
| [![Argon — Super follow-through](judging/screenshots/A/23-super-followthrough.png)](judging/screenshots/A/23-super-followthrough.png) | Connected super hits show a real counter and impact. Effects are clear but the articulated pose changes and character volume remain limited. |
| [![Argon — Sustained keyboard play](judging/screenshots/A/24-two-minute-play.png)](judging/screenshots/A/24-two-minute-play.png) | The sustained play capture preserves life trails and combo labels with no visible softlock. Small status labels remain a weak point; this is gameplay evidence, not a human feel score. |


Full animation source frames: [screenshots/Argon/animation-1.png](judging/screenshots/A/animation-1.png); [screenshots/Argon/animation-2.png](judging/screenshots/A/animation-2.png); [screenshots/Argon/animation-3.png](judging/screenshots/A/animation-3.png); [screenshots/Argon/animation-4.png](judging/screenshots/A/animation-4.png); [screenshots/Argon/animation-5.png](judging/screenshots/A/animation-5.png); [screenshots/Argon/animation-6.png](judging/screenshots/A/animation-6.png)

Visual inspection ledger: [logs/Argon/visual-review.json](judging/logs/A/visual-review.json); [logs/Argon/image-inventory.json](judging/logs/A/image-inventory.json)

### Astra

**Strengths.** The strongest interface hierarchy: large clear titles, restrained color, readable focus states, consistent spacing, useful preview cards and a well-organized results screen. It has the smallest bundle, the best frame pacing in the shared GPU run, meaningful input/round/replay/trial tests, working responsive layout and mocked gamepad coverage.

**Weaknesses.** The normal-throw tech is a genuine integration failure hidden by a direct resolver unit test. CPU defense reads the opponent’s exact current hit level. Character motions are stylized but often reuse angular poses; small secondary labels and the training panel could be clearer. The application/UI scene controller is concentrated in one large file, and the victory music branch is not selected by results.

**Issue — Normal throws cannot be teched through the full input pipeline.** Start a local versus fixture at close range. Press the attacker’s LP+LK, then the defender’s LP+LK at each delay in the logged window, including the same frame. Normal throws connect but no tech event occurs. Simultaneous throws can damage both fighters. startMove consumes the defender’s edge before resolveHit checks it. [logs/Astra/edge-cases.json](judging/logs/B/edge-cases.json); [Astra/src/core/sim.ts:160](judging/work/B/src/core/sim.ts#L160); [Astra/src/core/sim.ts:338](judging/work/B/src/core/sim.ts#L338); [Astra/tests/sim.test.ts:126](judging/work/B/tests/sim.test.ts#L126)

**Issue — Results do not select the authored victory-tempo branch.** Finish a match and inspect the audio theme selection. Results keep the prior stage theme; the victory-tempo condition exists but is not selected by that flow. [Astra/src/audio/synth.ts:132](judging/work/B/src/audio/synth.ts#L132); [Astra/src/main.ts:297](judging/work/B/src/main.ts#L297)

#### Balance — row is Player 1 win percentage

| P1 / P2 | HAYATE | MAGNUS | SABLE | WARDEN |
| --- | --- | --- | --- | --- |
| HAYATE | 53.12% | 53.12% | 43.75% | 37.50% |
| MAGNUS | 50.00% | 37.50% | 50.00% | 68.75% |
| SABLE | 59.38% | 50.00% | 50.00% | 65.62% |
| WARDEN | 59.38% | 25.00% | 31.25% | 50.00% |


Each ordered cell has **32** matches. Aggregate rates combine both sides, exclude mirror matches and count draws as half-wins. Match duration includes intro/outro, hitstop and round transitions. This is bot-policy balance, with correlated match seeds and limited per-matchup precision.

| Fighter | Win % | Wilson 95% |
| --- | --- | --- |
| HAYATE | 44.27 | 37.43–51.34 |
| MAGNUS | 56.77 | 49.70–63.58 |
| SABLE | 58.33 | 51.26–65.08 |
| WARDEN | 40.62 | 33.93–47.69 |


[logs/Astra/independent-balance.json](judging/logs/B/independent-balance.json); [logs/Astra/roster-inventory.json](judging/logs/B/roster-inventory.json)

#### Judge-captured gallery — click to inspect originals

All game captures are **1920 × 1080**. Menu-flow captures use real keyboard traversal; precision combat shots use disclosed fixtures. The blank mode-select placeholders label only the missing separate screen. All images were inspected, including animation frames.

| Screen | Visual review / evidence |
| --- | --- |
| [![Astra — Boot / logo](judging/screenshots/B/01-boot-logo.png)](judging/screenshots/B/01-boot-logo.png) | Minimal centered monogram and progress line have clean balance. Microtype is very small, but the screen feels deliberate rather than unfinished. |
| [![Astra — Title](judging/screenshots/B/02-title.png)](judging/screenshots/B/02-title.png) | Large stacked title, clear prompt and hero silhouette create the strongest title hierarchy. Controlled glow and dark negative space keep the focal points legible. |
| [![Astra — Main menu](judging/screenshots/B/03-main-menu.png)](judging/screenshots/B/03-main-menu.png) | Large left navigation, highlighted focus and right hero balance well. Secondary links and flavor text are small, but spacing and contrast are cohesive. |
| [![Astra — Character select](judging/screenshots/B/04-character-select.png)](judging/screenshots/B/04-character-select.png) | Character names, separate sides and confirm action are easy to scan. Stats labels are tiny and the shared angular pose language limits portrait variety. |
| [![Astra — Stage select](judging/screenshots/B/05-stage-select.png)](judging/screenshots/B/05-stage-select.png) | Distinct live-looking stage cards, clear title and selected border form a polished selection screen. Thumbnail, caption and card spacing are consistent. |
| [![Astra — Versus splash](judging/screenshots/B/06-versus-splash.png)](judging/screenshots/B/06-versus-splash.png) | Large VS and names align with the fighter columns. The layout is clean and restrained; stage/loading copy is noticeably small. |
| [![Astra — Round-start HUD](judging/screenshots/B/07-match-hud-start.png)](judging/screenshots/B/07-match-hud-start.png) | Balanced health bars, portraits, round pips and large timer read clearly. Supporting health/stun labels are small, with no visible clipping or overlap. |
| [![Astra — Connected combo](judging/screenshots/B/08-mid-combo.png)](judging/screenshots/B/08-mid-combo.png) | The actual combo counter is cleanly separated from the fighters. White impact rings contrast well; damage/scaling subtext is much smaller than the hit count. |
| [![Astra — Super cut-in / active](judging/screenshots/B/09-super-active.png)](judging/screenshots/B/09-super-active.png) | Cinematic band, cropped hero bust and high-contrast super name are composed cleanly. It temporarily hides the upper action but leaves the important HUD readable. |
| [![Astra — KO / round end](judging/screenshots/B/10-ko-round-end.png)](judging/screenshots/B/10-ko-round-end.png) | KO and impact effects remain readable against the dark stage. HUD alignment is stable and the character forms remain distinguishable. |
| [![Astra — Training + boxes](judging/screenshots/B/11-training-hitboxes.png)](judging/screenshots/B/11-training-hitboxes.png) | Active hitboxes and hurtboxes are clearly colored and the training panel sits above the action. Telemetry labels and tool buttons are rather small. |
| [![Astra — Move list](judging/screenshots/B/12-move-list.png)](judging/screenshots/B/12-move-list.png) | Move archive has the clearest tabular organization and useful descriptions. Fine frame-data text and faded lower rows need scrolling or close inspection. |
| [![Astra — Settings](judging/screenshots/B/13-settings.png)](judging/screenshots/B/13-settings.png) | Two-column settings separate audio/video from keyboard bindings with aligned controls. Additional device/display options sit below the visible scroll region. |
| [![Astra — Results](judging/screenshots/B/14-results.png)](judging/screenshots/B/14-results.png) | Strong victory heading, hero, concise stats and rematch choices make a clear results hierarchy. Secondary copy remains small but there are no persistent collisions. |
| [![Astra — Stage I](judging/screenshots/B/15-stage-1.png)](judging/screenshots/B/15-stage-1.png) | Alley composition has readable fighter silhouettes, depth, reflections, cables and rain. The restrained palette avoids the strongest glow competing with the HUD. |
| [![Astra — Stage II](judging/screenshots/B/16-stage-2.png)](judging/screenshots/B/16-stage-2.png) | The skyline/sanctum palette and torii silhouette give a distinct mood. Broad shapes keep the fight readable, with less surface detail than Opus. |
| [![Astra — Stage III](judging/screenshots/B/17-stage-3.png)](judging/screenshots/B/17-stage-3.png) | Train, platform, signage and structural grid clearly differ from the other stages. Contrast around the fighters is good and the HUD remains stable. |
| [![Astra — Special animation strip](judging/screenshots/B/18-special-strip.png)](judging/screenshots/B/18-special-strip.png) | Six real frames show arm extension, projectile formation and travel. The geometric body remains economical; the effect reads clearly without excessive bloom. |
| [![Astra — Pause](judging/screenshots/B/19-pause-menu.png)](judging/screenshots/B/19-pause-menu.png) | Opaque centered card, dimmed world and selected row create excellent focus. Button spacing and typography match the rest of the interface. |
| [![Astra — Separate mode select](judging/screenshots/B/20-mode-select.png)](judging/screenshots/B/20-mode-select.png) | Judge placeholder for the absent separate mode-select screen. The main menu itself contains the working mode choices. |
| [![Astra — Trials](judging/screenshots/B/21-trials.png)](judging/screenshots/B/21-trials.png) | Trial guide is positioned above the action, with clearly connected step icons. Explanatory text is small; close starting fighters are an intentional practice fixture. |
| [![Astra — Keyboard QCF evidence](judging/screenshots/B/22-keyboard-qcf.png)](judging/screenshots/B/22-keyboard-qcf.png) | Actual keyboard projectile evidence is captured after the intro. Training copy is small but aligned and the projectile is visible against the dark floor. |
| [![Astra — Super follow-through](judging/screenshots/B/23-super-followthrough.png)](judging/screenshots/B/23-super-followthrough.png) | Super follow-through and opponent reaction remain legible. The central announcement is strong; character poses are still angular and simple. |
| [![Astra — Sustained keyboard play](judging/screenshots/B/24-two-minute-play.png)](judging/screenshots/B/24-two-minute-play.png) | Life trails, impact rings and both fighter identities remain visible during prolonged play. No visual softlock is evident; tiny supporting HUD copy is the main legibility limitation. |


Full animation source frames: [screenshots/Astra/animation-1.png](judging/screenshots/B/animation-1.png); [screenshots/Astra/animation-2.png](judging/screenshots/B/animation-2.png); [screenshots/Astra/animation-3.png](judging/screenshots/B/animation-3.png); [screenshots/Astra/animation-4.png](judging/screenshots/B/animation-4.png); [screenshots/Astra/animation-5.png](judging/screenshots/B/animation-5.png); [screenshots/Astra/animation-6.png](judging/screenshots/B/animation-6.png)

Visual inspection ledger: [logs/Astra/visual-review.json](judging/logs/B/visual-review.json); [logs/Astra/image-inventory.json](judging/logs/B/image-inventory.json)

### Opus

**Strengths.** The most thoroughly realized combat system and cleanest scene/module structure. The CPU has a real delayed observation buffer, error/jitter and character-specific planning. Detailed frame, guard, trade, throw, resource, rollback and trial assertions pass, as do the browser flow, full Arcade, replay, gamepad and audio-analysis tests. Stages and fighters have the richest procedural detail and the most varied animation.

**Weaknesses.** Full-resolution performance does not meet the stable target on this host; default automatic resolution can hide this cost by reducing sharpness. The rotation parser accepts unordered cardinals. Neon bloom, thin small labels and dense animated backgrounds compete with gameplay information. The grappler’s life advantage is very small and its zoner matchup remains poor despite acceptable overall bot win rates. Projectile allocation also contradicts the broad allocation-free README wording.

**Issue — Full-scale rendering misses the stable performance target.** Run the shared GPU benchmark on each production build with the fixed scale and common viewport. Inspect raw intervals and the long-tail metrics; the result persists while Astra meets the same threshold. For Opus, automatic scale is a fallback rather than evidence of full-resolution performance. [logs/Argon/independent-benchmark-gpu.json](judging/logs/A/independent-benchmark-gpu.json); [logs/Astra/independent-benchmark-gpu.json](judging/logs/B/independent-benchmark-gpu.json); [logs/Opus/independent-benchmark-gpu.json](judging/logs/C/independent-benchmark-gpu.json)

**Issue — Rotation parser accepts a non-rotating cardinal sequence.** Feed the same out-of-order cardinal sequence recorded in edge-cases.json. Argon and Opus accept it as a rotation; Astra rejects it. Opus explicitly documents this implementation choice in a code comment. This is excessive leniency rather than a failure to recognize valid motions. [logs/Argon/edge-cases.json](judging/logs/A/edge-cases.json); [logs/Astra/edge-cases.json](judging/logs/B/edge-cases.json); [logs/Opus/edge-cases.json](judging/logs/C/edge-cases.json)

**Issue — Allocation-free wording exceeds the implementation.** Inspect spawnProjectile: it pushes a newly created projectile object into the simulation list. Particle pooling is real, but it does not make every hot path allocation-free. Endpoint heap growth alone is not used to allege a leak. [Opus/src/sim/fighter.ts:504](judging/work/C/src/sim/fighter.ts#L504); [Opus/README.md:382](judging/work/C/README.md#L382)

**Issue — Documented runtime minimum does not match locked dependencies.** Compare the README requirement of Node.js 18+ with the locked Vite engine range, ^20.19.0 || >=22.12.0. This audit ran successfully on Node.js 24; compatibility with the advertised older runtime was not demonstrated. [Opus/README.md:17](judging/work/C/README.md#L17); [Opus/package-lock.json:1574](judging/work/C/package-lock.json#L1574)

#### Balance — row is Player 1 win percentage

| P1 / P2 | HAYATE | MAGNUS | SABLE | WARDEN |
| --- | --- | --- | --- | --- |
| HAYATE | 53.12% | 53.12% | 59.38% | 59.38% |
| MAGNUS | 53.12% | 59.38% | 37.50% | 25.00% |
| SABLE | 40.62% | 46.88% | 53.12% | 62.50% |
| WARDEN | 37.50% | 68.75% | 53.12% | 50.00% |


Each ordered cell has **32** matches. Aggregate rates combine both sides, exclude mirror matches and count draws as half-wins. Match duration includes intro/outro, hitstop and round transitions. This is bot-policy balance, with correlated match seeds and limited per-matchup precision.

| Fighter | Win % | Wilson 95% |
| --- | --- | --- |
| HAYATE | 56.77 | 49.70–63.58 |
| MAGNUS | 41.15 | 34.43–48.21 |
| SABLE | 50.00 | 43.00–57.00 |
| WARDEN | 52.08 | 45.05–59.04 |


[logs/Opus/independent-balance.json](judging/logs/C/independent-balance.json); [logs/Opus/roster-inventory.json](judging/logs/C/roster-inventory.json)

#### Judge-captured gallery — click to inspect originals

All game captures are **1920 × 1080**. Menu-flow captures use real keyboard traversal; precision combat shots use disclosed fixtures. The blank mode-select placeholders label only the missing separate screen. All images were inspected, including animation frames.

| Screen | Visual review / evidence |
| --- | --- |
| [![Opus — Boot / logo](judging/screenshots/C/01-boot-logo.png)](judging/screenshots/C/01-boot-logo.png) | Neon studio mark and wordmark are centered with deliberate spacing. The small presents line is low contrast, but the boot identity is coherent. |
| [![Opus — Title](judging/screenshots/C/02-title.png)](judging/screenshots/C/02-title.png) | Distinctive original neon lettering, rain and skyline form a strong title. The blinking press-start prompt is much lower contrast than the title; bloom softens edges. |
| [![Opus — Main menu](judging/screenshots/C/03-main-menu.png)](judging/screenshots/C/03-main-menu.png) | Simple menu hierarchy and animated fighter preview read well. Busy city detail and decorative glow compete with small footer and descriptive text. |
| [![Opus — Character select](judging/screenshots/C/04-character-select.png)](judging/screenshots/C/04-character-select.png) | Full-body previews, archetypes, palettes and stats have a complete selection layout. Fine labels are small and slightly bloom-softened; margins stay clean. |
| [![Opus — Stage select](judging/screenshots/C/05-stage-select.png)](judging/screenshots/C/05-stage-select.png) | Large stage preview and clear selected card give useful context. Name hierarchy is strong; long location/flavor captions are small but not overlapping. |
| [![Opus — Versus splash](judging/screenshots/C/06-versus-splash.png)](judging/screenshots/C/06-versus-splash.png) | Color-coded split panels, full figures and large VS feel designed. Quotes are small, while the primary names and stage banner remain distinct. |
| [![Opus — Round-start HUD](judging/screenshots/C/07-match-hud-start.png)](judging/screenshots/C/07-match-hud-start.png) | Health, timer, pips and portraits are cleanly aligned; ROUND is large and kinetic. The animated signs compete with fine stun/name information. |
| [![Opus — Connected combo](judging/screenshots/C/08-mid-combo.png)](judging/screenshots/C/08-mid-combo.png) | The real combo counter and impact are highly visible. Saturated background signs and bright contact FX create more visual noise than Astra. |
| [![Opus — Super cut-in / active](judging/screenshots/C/09-super-active.png)](judging/screenshots/C/09-super-active.png) | Readable complete super name, fighter cut-in and speed lines are well integrated. The band fills much of the center, with strong cyan/magenta contrast. |
| [![Opus — KO / round end](judging/screenshots/C/10-ko-round-end.png)](judging/screenshots/C/10-ko-round-end.png) | Large KO typography communicates the result clearly. It obscures the center intentionally; the health HUD remains visible and no settled clipping is evident. |
| [![Opus — Training + boxes](judging/screenshots/C/11-training-hitboxes.png)](judging/screenshots/C/11-training-hitboxes.png) | Detailed active hit/hurt/push boxes, frame data and input history are visible. Thin labels and the animated billboard backdrop reduce clarity at a glance. |
| [![Opus — Move list](judging/screenshots/C/12-move-list.png)](judging/screenshots/C/12-move-list.png) | Move groups, motion icons, variant rows and descriptions are well structured. Small alternate-version labels and inactive tabs could have higher contrast. |
| [![Opus — Settings](judging/screenshots/C/13-settings.png)](judging/screenshots/C/13-settings.png) | Clear audio/video/gameplay/controls/accessibility tabs with aligned values. The panel is spacious, while the footer and small labels retain excessive glow. |
| [![Opus — Results](judging/screenshots/C/14-results.png)](judging/screenshots/C/14-results.png) | Winner animation, result statistics and rematch/replay choices form a complete screen. Small secondary stats and background city detail compete slightly. |
| [![Opus — Stage I](judging/screenshots/C/15-stage-1.png)](judging/screenshots/C/15-stage-1.png) | Rooftop includes rich signage, holographic fish, rain, floor markings and reflections. Fighters stay distinct, though the background is visually busy. |
| [![Opus — Stage II](judging/screenshots/C/16-stage-2.png)](judging/screenshots/C/16-stage-2.png) | Shrine alley has a different warm palette, lanterns, crowd silhouettes and atmospheric depth. The fight area is readable without the intro announcement. |
| [![Opus — Stage III](judging/screenshots/C/17-stage-3.png)](judging/screenshots/C/17-stage-3.png) | Pit uses a distinct industrial ring, fence, crowd and information board. Dark materials support fighter visibility; the board adds some HUD-like visual clutter. |
| [![Opus — Special animation strip](judging/screenshots/C/18-special-strip.png)](judging/screenshots/C/18-special-strip.png) | Six genuine frames show torso anticipation, arm release, cloth motion and projectile travel. This has the strongest body-motion variation of the three. |
| [![Opus — Pause](judging/screenshots/C/19-pause-menu.png)](judging/screenshots/C/19-pause-menu.png) | Pause text and focus row are clear. The frozen round announcement remains visible behind the translucent menu, making this intro-time pause unnecessarily busy. |
| [![Opus — Separate mode select](judging/screenshots/C/20-mode-select.png)](judging/screenshots/C/20-mode-select.png) | Separate animated mode cards provide the most complete literal screen flow. The selected card has good contrast and clear iconography; inactive copy is subtle. |
| [![Opus — Trials](judging/screenshots/C/21-trials.png)](judging/screenshots/C/21-trials.png) | Trial panel shows ordered steps and an active highlight. At this captured entry moment the large FIGHT announcement competes with the guidance. |
| [![Opus — Keyboard QCF evidence](judging/screenshots/C/22-keyboard-qcf.png)](judging/screenshots/C/22-keyboard-qcf.png) | Actual keyboard motion produces a visible projectile and move telemetry. The effect and icons read well; many fine background signs still compete for attention. |
| [![Opus — Super follow-through](judging/screenshots/C/23-super-followthrough.png)](judging/screenshots/C/23-super-followthrough.png) | Real multi-hit follow-through shows clear combo damage and a substantial reaction pose. Contact bloom is intense but the main HUD remains readable. |
| [![Opus — Sustained keyboard play](judging/screenshots/C/24-two-minute-play.png)](judging/screenshots/C/24-two-minute-play.png) | Sustained keyboard play reaches a genuine KO with combo and life changes. Large announcements cover the central bodies by design; no softlock is visible. |


Full animation source frames: [screenshots/Opus/animation-1.png](judging/screenshots/C/animation-1.png); [screenshots/Opus/animation-2.png](judging/screenshots/C/animation-2.png); [screenshots/Opus/animation-3.png](judging/screenshots/C/animation-3.png); [screenshots/Opus/animation-4.png](judging/screenshots/C/animation-4.png); [screenshots/Opus/animation-5.png](judging/screenshots/C/animation-5.png); [screenshots/Opus/animation-6.png](judging/screenshots/C/animation-6.png)

Visual inspection ledger: [logs/Opus/visual-review.json](judging/logs/C/visual-review.json); [logs/Opus/image-inventory.json](judging/logs/C/image-inventory.json)

## 5. Side-by-side screen comparison

| Screen | Argon | Astra | Opus |
| --- | --- | --- | --- |
| Boot / logo | [![Argon — Boot / logo](judging/screenshots/A/01-boot-logo.png)](judging/screenshots/A/01-boot-logo.png) | [![Astra — Boot / logo](judging/screenshots/B/01-boot-logo.png)](judging/screenshots/B/01-boot-logo.png) | [![Opus — Boot / logo](judging/screenshots/C/01-boot-logo.png)](judging/screenshots/C/01-boot-logo.png) |
| Title | [![Argon — Title](judging/screenshots/A/02-title.png)](judging/screenshots/A/02-title.png) | [![Astra — Title](judging/screenshots/B/02-title.png)](judging/screenshots/B/02-title.png) | [![Opus — Title](judging/screenshots/C/02-title.png)](judging/screenshots/C/02-title.png) |
| Main menu | [![Argon — Main menu](judging/screenshots/A/03-main-menu.png)](judging/screenshots/A/03-main-menu.png) | [![Astra — Main menu](judging/screenshots/B/03-main-menu.png)](judging/screenshots/B/03-main-menu.png) | [![Opus — Main menu](judging/screenshots/C/03-main-menu.png)](judging/screenshots/C/03-main-menu.png) |
| Character select | [![Argon — Character select](judging/screenshots/A/04-character-select.png)](judging/screenshots/A/04-character-select.png) | [![Astra — Character select](judging/screenshots/B/04-character-select.png)](judging/screenshots/B/04-character-select.png) | [![Opus — Character select](judging/screenshots/C/04-character-select.png)](judging/screenshots/C/04-character-select.png) |
| Stage select | [![Argon — Stage select](judging/screenshots/A/05-stage-select.png)](judging/screenshots/A/05-stage-select.png) | [![Astra — Stage select](judging/screenshots/B/05-stage-select.png)](judging/screenshots/B/05-stage-select.png) | [![Opus — Stage select](judging/screenshots/C/05-stage-select.png)](judging/screenshots/C/05-stage-select.png) |
| Versus splash | [![Argon — Versus splash](judging/screenshots/A/06-versus-splash.png)](judging/screenshots/A/06-versus-splash.png) | [![Astra — Versus splash](judging/screenshots/B/06-versus-splash.png)](judging/screenshots/B/06-versus-splash.png) | [![Opus — Versus splash](judging/screenshots/C/06-versus-splash.png)](judging/screenshots/C/06-versus-splash.png) |
| Round-start HUD | [![Argon — Round-start HUD](judging/screenshots/A/07-match-hud-start.png)](judging/screenshots/A/07-match-hud-start.png) | [![Astra — Round-start HUD](judging/screenshots/B/07-match-hud-start.png)](judging/screenshots/B/07-match-hud-start.png) | [![Opus — Round-start HUD](judging/screenshots/C/07-match-hud-start.png)](judging/screenshots/C/07-match-hud-start.png) |
| Connected combo | [![Argon — Connected combo](judging/screenshots/A/08-mid-combo.png)](judging/screenshots/A/08-mid-combo.png) | [![Astra — Connected combo](judging/screenshots/B/08-mid-combo.png)](judging/screenshots/B/08-mid-combo.png) | [![Opus — Connected combo](judging/screenshots/C/08-mid-combo.png)](judging/screenshots/C/08-mid-combo.png) |
| Super cut-in / active | [![Argon — Super cut-in / active](judging/screenshots/A/09-super-active.png)](judging/screenshots/A/09-super-active.png) | [![Astra — Super cut-in / active](judging/screenshots/B/09-super-active.png)](judging/screenshots/B/09-super-active.png) | [![Opus — Super cut-in / active](judging/screenshots/C/09-super-active.png)](judging/screenshots/C/09-super-active.png) |
| KO / round end | [![Argon — KO / round end](judging/screenshots/A/10-ko-round-end.png)](judging/screenshots/A/10-ko-round-end.png) | [![Astra — KO / round end](judging/screenshots/B/10-ko-round-end.png)](judging/screenshots/B/10-ko-round-end.png) | [![Opus — KO / round end](judging/screenshots/C/10-ko-round-end.png)](judging/screenshots/C/10-ko-round-end.png) |
| Training + boxes | [![Argon — Training + boxes](judging/screenshots/A/11-training-hitboxes.png)](judging/screenshots/A/11-training-hitboxes.png) | [![Astra — Training + boxes](judging/screenshots/B/11-training-hitboxes.png)](judging/screenshots/B/11-training-hitboxes.png) | [![Opus — Training + boxes](judging/screenshots/C/11-training-hitboxes.png)](judging/screenshots/C/11-training-hitboxes.png) |
| Move list | [![Argon — Move list](judging/screenshots/A/12-move-list.png)](judging/screenshots/A/12-move-list.png) | [![Astra — Move list](judging/screenshots/B/12-move-list.png)](judging/screenshots/B/12-move-list.png) | [![Opus — Move list](judging/screenshots/C/12-move-list.png)](judging/screenshots/C/12-move-list.png) |
| Settings | [![Argon — Settings](judging/screenshots/A/13-settings.png)](judging/screenshots/A/13-settings.png) | [![Astra — Settings](judging/screenshots/B/13-settings.png)](judging/screenshots/B/13-settings.png) | [![Opus — Settings](judging/screenshots/C/13-settings.png)](judging/screenshots/C/13-settings.png) |
| Results | [![Argon — Results](judging/screenshots/A/14-results.png)](judging/screenshots/A/14-results.png) | [![Astra — Results](judging/screenshots/B/14-results.png)](judging/screenshots/B/14-results.png) | [![Opus — Results](judging/screenshots/C/14-results.png)](judging/screenshots/C/14-results.png) |
| Stage I | [![Argon — Stage I](judging/screenshots/A/15-stage-1.png)](judging/screenshots/A/15-stage-1.png) | [![Astra — Stage I](judging/screenshots/B/15-stage-1.png)](judging/screenshots/B/15-stage-1.png) | [![Opus — Stage I](judging/screenshots/C/15-stage-1.png)](judging/screenshots/C/15-stage-1.png) |
| Stage II | [![Argon — Stage II](judging/screenshots/A/16-stage-2.png)](judging/screenshots/A/16-stage-2.png) | [![Astra — Stage II](judging/screenshots/B/16-stage-2.png)](judging/screenshots/B/16-stage-2.png) | [![Opus — Stage II](judging/screenshots/C/16-stage-2.png)](judging/screenshots/C/16-stage-2.png) |
| Stage III | [![Argon — Stage III](judging/screenshots/A/17-stage-3.png)](judging/screenshots/A/17-stage-3.png) | [![Astra — Stage III](judging/screenshots/B/17-stage-3.png)](judging/screenshots/B/17-stage-3.png) | [![Opus — Stage III](judging/screenshots/C/17-stage-3.png)](judging/screenshots/C/17-stage-3.png) |
| Special animation strip | [![Argon — Special animation strip](judging/screenshots/A/18-special-strip.png)](judging/screenshots/A/18-special-strip.png) | [![Astra — Special animation strip](judging/screenshots/B/18-special-strip.png)](judging/screenshots/B/18-special-strip.png) | [![Opus — Special animation strip](judging/screenshots/C/18-special-strip.png)](judging/screenshots/C/18-special-strip.png) |
| Pause | [![Argon — Pause](judging/screenshots/A/19-pause-menu.png)](judging/screenshots/A/19-pause-menu.png) | [![Astra — Pause](judging/screenshots/B/19-pause-menu.png)](judging/screenshots/B/19-pause-menu.png) | [![Opus — Pause](judging/screenshots/C/19-pause-menu.png)](judging/screenshots/C/19-pause-menu.png) |
| Separate mode select | [![Argon — Separate mode select](judging/screenshots/A/20-mode-select.png)](judging/screenshots/A/20-mode-select.png) | [![Astra — Separate mode select](judging/screenshots/B/20-mode-select.png)](judging/screenshots/B/20-mode-select.png) | [![Opus — Separate mode select](judging/screenshots/C/20-mode-select.png)](judging/screenshots/C/20-mode-select.png) |
| Trials | [![Argon — Trials](judging/screenshots/A/21-trials.png)](judging/screenshots/A/21-trials.png) | [![Astra — Trials](judging/screenshots/B/21-trials.png)](judging/screenshots/B/21-trials.png) | [![Opus — Trials](judging/screenshots/C/21-trials.png)](judging/screenshots/C/21-trials.png) |
| Keyboard QCF evidence | [![Argon — Keyboard QCF evidence](judging/screenshots/A/22-keyboard-qcf.png)](judging/screenshots/A/22-keyboard-qcf.png) | [![Astra — Keyboard QCF evidence](judging/screenshots/B/22-keyboard-qcf.png)](judging/screenshots/B/22-keyboard-qcf.png) | [![Opus — Keyboard QCF evidence](judging/screenshots/C/22-keyboard-qcf.png)](judging/screenshots/C/22-keyboard-qcf.png) |
| Super follow-through | [![Argon — Super follow-through](judging/screenshots/A/23-super-followthrough.png)](judging/screenshots/A/23-super-followthrough.png) | [![Astra — Super follow-through](judging/screenshots/B/23-super-followthrough.png)](judging/screenshots/B/23-super-followthrough.png) | [![Opus — Super follow-through](judging/screenshots/C/23-super-followthrough.png)](judging/screenshots/C/23-super-followthrough.png) |
| Sustained keyboard play | [![Argon — Sustained keyboard play](judging/screenshots/A/24-two-minute-play.png)](judging/screenshots/A/24-two-minute-play.png) | [![Astra — Sustained keyboard play](judging/screenshots/B/24-two-minute-play.png)](judging/screenshots/B/24-two-minute-play.png) | [![Opus — Sustained keyboard play](judging/screenshots/C/24-two-minute-play.png)](judging/screenshots/C/24-two-minute-play.png) |


## 6. Category-by-category scoring evidence

### Runs and stability (10)

**Argon: 8.0/10 — verified by tool.** Clean documented installation, build, prolonged keyboard play and the shared balance safety run pass. The run score is deliberately equal across submissions; the failed own browser suite is penalized in Tests, not counted again as a startup failure. [logs/Argon/readme-start.log](judging/logs/A/readme-start.log); [logs/Argon/build.log](judging/logs/A/build.log); [logs/Argon/two-minute-play.json](judging/logs/A/two-minute-play.json); [logs/Argon/independent-balance.json](judging/logs/A/independent-balance.json)

**Astra: 8.0/10 — verified by tool.** The one-command dependency launcher works, and the observed game runs without console problems or softlocks in the measured workload. This does not erase the separate combat defect. [logs/Astra/readme-start.log](judging/logs/B/readme-start.log); [logs/Astra/build.log](judging/logs/B/build.log); [logs/Astra/two-minute-play.json](judging/logs/B/two-minute-play.json); [logs/Astra/independent-balance.json](judging/logs/B/independent-balance.json)

**Opus: 8.0/10 — verified by tool.** The first-run installer and production build succeed. Long play, the headless match workload and original browser mode coverage finish. Rendering slowdowns belong to Performance. [logs/Opus/readme-start.log](judging/logs/C/readme-start.log); [logs/Opus/build.log](judging/logs/C/build.log); [logs/Opus/two-minute-play.json](judging/logs/C/two-minute-play.json); [logs/Opus/independent-balance.json](judging/logs/C/independent-balance.json)

### Combat depth and correctness (20)

**Argon: 7.2/10 — judged visually/by reading.** The required input-driven probes pass and the move data is substantial. Confidence is limited by permissive rotation recognition, thin boundary coverage and inconsistent documented bindings/costs; this is a working combat engine, not a mechanically empty demo. [logs/Argon/combat-spotchecks.json](judging/logs/A/combat-spotchecks.json); [logs/Argon/edge-cases.json](judging/logs/A/edge-cases.json); [logs/Argon/roster-inventory.json](judging/logs/A/roster-inventory.json)

**Astra: 7.1/10 — judged visually/by reading.** The parser rejects out-of-order rotations, and guard, cancel/scaling, resource and round behavior are well covered. The missing normal-throw tech in full steps is a core defensive correctness fault, so the passing resolver test does not justify a high robustness score. [logs/Astra/combat-spotchecks.json](judging/logs/B/combat-spotchecks.json); [logs/Astra/edge-cases.json](judging/logs/B/edge-cases.json); [logs/Astra/roster-inventory.json](judging/logs/B/roster-inventory.json)

**Opus: 8.4/10 — judged visually/by reading.** Strongest evidence for frame execution, measured advantage, contact/cancel windows, guard/cross-up, throws, trade, juggle, resources and replay. Every required spot-check succeeds. Its permissive rotation policy and untested human exploits keep the score below exceptional commercial quality. [logs/Opus/combat-spotchecks.json](judging/logs/C/combat-spotchecks.json); [logs/Opus/edge-cases.json](judging/logs/C/edge-cases.json); [logs/Opus/roster-inventory.json](judging/logs/C/roster-inventory.json)

### Game feel — code estimate (10)

**Argon: 6.5/10 — judged visually/by reading.** Code defines per-strength hitstop, buffered cancels during freeze, distance-based zoom and decaying shake. Camera and presentation values are embedded in the simulation and tuned mostly through fixed constants. The estimate concerns these implemented mechanisms only; no tactile responsiveness was judged. [Argon/src/core/simulation.ts:2284](judging/work/A/src/core/simulation.ts#L2284); [Argon/src/core/simulation.ts:2336](judging/work/A/src/core/simulation.ts#L2336); [Argon/src/core/simulation.ts:2284](judging/work/A/src/core/simulation.ts#L2284)

**Astra: 7.1/10 — judged visually/by reading.** Code provides a short input buffer, strength-based hitstop, retained input context through freeze, camera easing and transient shake. These mechanisms are coherent, but there is less explicit per-fighter freeze/input bookkeeping than in Opus. No human feel or animation preference enters this estimate. [Astra/src/core/sim.ts:193](judging/work/B/src/core/sim.ts#L193); [Astra/src/render/renderer.ts:164](judging/work/B/src/render/renderer.ts#L164); [Astra/src/core/sim.ts:193](judging/work/B/src/core/sim.ts#L193)

**Opus: 8.0/10 — judged visually/by reading.** Code has freeze-aware input history, explicit frame conventions, per-fighter hitstop, dedicated camera interpolation/bounds and layered shake/recoil handling. The mechanism design is the most explicit of the three. Actual input latency, comfort and perceived impact still require human play. [Opus/src/core/loop.ts:2](judging/work/C/src/core/loop.ts#L2); [Opus/src/sim/input.ts:20](judging/work/C/src/sim/input.ts#L20); [Opus/src/sim/match.ts:132](judging/work/C/src/sim/match.ts#L132); [Opus/src/render/camera.ts:54](judging/work/C/src/render/camera.ts#L54); [Opus/src/core/loop.ts:2](judging/work/C/src/core/loop.ts#L2)

### CPU AI quality (8)

**Argon: 5.0/10 — judged visually/by reading.** Uses spacing, charge/motion sequences, anti-airs, meter and hit-confirm routes. However, defense and throw-tech branches read current state ahead of the neutral decision cooldown, allowing reactions much faster than a human perception model. [Argon/src/ai/cpuController.ts:133](judging/work/A/src/ai/cpuController.ts#L133); [logs/Argon/independent-balance.json](judging/logs/A/independent-balance.json)

**Astra: 6.2/10 — judged visually/by reading.** Character-aware queues and difficulty-dependent waits make it functional and reproducible. Defense chooses the correct current hit level without delayed observation, and tactics remain a relatively compact rule set. [Astra/src/ai/cpu.ts:71](judging/work/B/src/ai/cpu.ts#L71); [logs/Astra/independent-balance.json](judging/logs/B/independent-balance.json)

**Opus: 8.2/10 — judged visually/by reading.** A genuine observation delay, execution error/jitter, move analysis and per-character personality drive layered defense, punishes and routes. Full raw-input motions and charge holds are used. Bot success demonstrates implementation, not human entertainment quality. [Opus/src/ai/cpu.ts:135](judging/work/C/src/ai/cpu.ts#L135); [logs/Opus/independent-balance.json](judging/logs/C/independent-balance.json)

### UI/UX (20)

**Argon: 6.0/10 — judged visually/by reading.** The required destinations mostly work, with useful telemetry and readable selected states. The main menu is dense, mode select is merged, supporting labels are small and most panels use a generic cyan outline treatment. Some requested settings are absent. [logs/Argon/browser-flow.json](judging/logs/A/browser-flow.json); [screenshots/Argon/03-main-menu.png](judging/screenshots/A/03-main-menu.png); [screenshots/Argon/04-character-select.png](judging/screenshots/A/04-character-select.png); [screenshots/Argon/13-settings.png](judging/screenshots/A/13-settings.png)

**Astra: 8.2/10 — judged visually/by reading.** Best typography hierarchy, spacing, focus affordances and restrained visual language. DOM controls support keyboard and device tests, and responsive layout is sound. Secondary labels and training overlays are small; a separate mode-select screen is absent. [logs/Astra/browser-flow.json](judging/logs/B/browser-flow.json); [screenshots/Astra/03-main-menu.png](judging/screenshots/B/03-main-menu.png); [screenshots/Astra/04-character-select.png](judging/screenshots/B/04-character-select.png); [screenshots/Astra/13-settings.png](judging/screenshots/B/13-settings.png)

**Opus: 7.8/10 — judged visually/by reading.** Most complete screen flow and settings structure, with animated fighter previews, separate mode cards and rich move icons. Busy backgrounds, bloom and small functional text reduce the otherwise coherent interface’s clarity. [logs/Opus/browser-flow.json](judging/logs/C/browser-flow.json); [screenshots/Opus/03-main-menu.png](judging/screenshots/C/03-main-menu.png); [screenshots/Opus/04-character-select.png](judging/screenshots/C/04-character-select.png); [screenshots/Opus/13-settings.png](judging/screenshots/C/13-settings.png)

### Visuals, VFX, stages, audio (10)

**Argon: 5.4/10 — judged visually/by reading.** Original procedural rendering is consistent, with rain, sparks, color coding and stage variants. Simplified outlined rigs, repeated city/grid composition and limited pose changes remain visibly basic. Synth paths exist, but the mix has not been heard by a human judge. [screenshots/Argon/15-stage-1.png](judging/screenshots/A/15-stage-1.png); [screenshots/Argon/16-stage-2.png](judging/screenshots/A/16-stage-2.png); [screenshots/Argon/17-stage-3.png](judging/screenshots/A/17-stage-3.png); [screenshots/Argon/09-super-active.png](judging/screenshots/A/09-super-active.png); [screenshots/Argon/18-special-strip.png](judging/screenshots/A/18-special-strip.png)

**Astra: 7.1/10 — judged visually/by reading.** Distinct alley, skyline and train-terminal staging, reflections and clean character silhouettes are well composed. Animation remains geometric and fairly economical. Audio uses procedural stage/menu patterns and broad action classes; the results flow misses its separate victory-tempo branch. [screenshots/Astra/15-stage-1.png](judging/screenshots/B/15-stage-1.png); [screenshots/Astra/16-stage-2.png](judging/screenshots/B/16-stage-2.png); [screenshots/Astra/17-stage-3.png](judging/screenshots/B/17-stage-3.png); [screenshots/Astra/09-super-active.png](judging/screenshots/B/09-super-active.png); [screenshots/Astra/18-special-strip.png](judging/screenshots/B/18-special-strip.png)

**Opus: 8.0/10 — judged visually/by reading.** Most varied procedural stages, articulated fighters, cloth, impacts and cinematic treatment. The executable audio analyser checks every authored track/SFX/ambience for signal and clipping, which is stronger evidence than a README claim, though it cannot establish musical taste. [screenshots/Opus/15-stage-1.png](judging/screenshots/C/15-stage-1.png); [screenshots/Opus/16-stage-2.png](judging/screenshots/C/16-stage-2.png); [screenshots/Opus/17-stage-3.png](judging/screenshots/C/17-stage-3.png); [screenshots/Opus/09-super-active.png](judging/screenshots/C/09-super-active.png); [screenshots/Opus/18-special-strip.png](judging/screenshots/C/18-special-strip.png)

### Balance and roster completeness (5)

**Argon: 6.6/10 — judged visually/by reading.** Roster and archetype tools are complete, and aggregate win rates sit in the requested band. Several matchup cells remain extreme, and the small per-cell samples do not establish human balance. [logs/Argon/independent-balance.json](judging/logs/A/independent-balance.json); [logs/Argon/roster-inventory.json](judging/logs/A/roster-inventory.json)

**Astra: 7.2/10 — judged visually/by reading.** Complete roster with the least extreme overall matchup spread in this run. The zoner still trails and CPU-policy effects dominate. The throw-tech defect makes this matrix especially unsafe to generalize to human play. [logs/Astra/independent-balance.json](judging/logs/B/independent-balance.json); [logs/Astra/roster-inventory.json](judging/logs/B/roster-inventory.json)

**Opus: 6.7/10 — judged visually/by reading.** Complete, varied move sets and playable trials, but the grappler/zoner matchup is poor. The rushdown fighter has the highest life in the loaded data, weakening the stated heavy/high-HP versus fast/low-damage identity. Aggregate rates alone do not resolve these issues. [logs/Opus/independent-balance.json](judging/logs/C/independent-balance.json); [logs/Opus/roster-inventory.json](judging/logs/C/roster-inventory.json)

### Performance (7)

**Argon: 4.0/10 — verified by tool.** The shared real-rAF result is well below the stable target even with the smaller internal render target. Its submitted scheduled offscreen benchmark is methodologically unsuitable for claiming the same on-screen result. [logs/Argon/independent-benchmark-gpu.json](judging/logs/A/independent-benchmark-gpu.json); [logs/Argon/independent-benchmark.json](judging/logs/A/independent-benchmark.json)

**Astra: 8.5/10 — verified by tool.** Best measured frame pacing at full backing resolution; the threshold score is computed from the common raw samples. This is strong evidence on this host, not a promise for every machine or a latency measurement. [logs/Astra/independent-benchmark-gpu.json](judging/logs/B/independent-benchmark-gpu.json); [logs/Astra/independent-benchmark.json](judging/logs/B/independent-benchmark.json)

**Opus: 5.0/10 — verified by tool.** The fixed full-resolution run misses the stable target and has long tail frames. GPU acceleration helps substantially over software rendering, and its automatic scaling is a useful fallback, but the full-scale cost is a material limitation. [logs/Opus/independent-benchmark-gpu.json](judging/logs/C/independent-benchmark-gpu.json); [logs/Opus/independent-benchmark.json](judging/logs/C/independent-benchmark.json)

### Tests and self-verification (7)

**Argon: 3.8/10 — verified by tool.** Broad unit assertions are real but sparse. Its E2E fails on navigation and later uses direct simulation injection instead of actually performing the advertised keyboard special. Parser-only checks do not verify the documented move mapping. [logs/Argon/unit-results.json](judging/logs/A/unit-results.json); [logs/Argon/own-e2e.log](judging/logs/A/own-e2e.log); [logs/Argon/edge-cases.json](judging/logs/A/edge-cases.json)

**Astra: 7.3/10 — verified by tool.** Meaningful unit coverage includes buffer edges, deterministic continuation, full replay, combat invariants and executable trials; original browser tests pass. The direct throw-tech resolver test masks the full-step input-consumption failure, preventing a higher score. [logs/Astra/unit-results.json](judging/logs/B/unit-results.json); [logs/Astra/own-e2e.log](judging/logs/B/own-e2e.log); [logs/Astra/edge-cases.json](judging/logs/B/edge-cases.json)

**Opus: 8.6/10 — verified by tool.** The deepest behavioral unit coverage, including frame advantage, trades, rollback and every trial. Browser tests exercise real menus/inputs, complete Arcade and replay, gamepad fixtures and audio signal quality. Permissive rotation and render-cost claims still escape these gates. [logs/Opus/unit-results.json](judging/logs/C/unit-results.json); [logs/Opus/own-e2e.log](judging/logs/C/own-e2e.log); [logs/Opus/edge-cases.json](judging/logs/C/edge-cases.json)

### Code architecture and README accuracy (3)

**Argon: 4.8/10 — judged visually/by reading.** Typed modules and data separation exist, but the simulation and application/scene files are very large. README discrepancies include throw bindings, Ultimate cost, SOCD behavior and the claimed passing E2E; the benchmark claim is also methodologically misleading. [logs/Argon/source-evidence.json](judging/logs/A/source-evidence.json); [logs/Argon/own-e2e.log](judging/logs/A/own-e2e.log); [Argon/src/scenes/gameApp.ts:68](judging/work/A/src/scenes/gameApp.ts#L68)

**Astra: 7.0/10 — judged visually/by reading.** Compact typed simulation, data, inputs, rendering, particles and audio are well separated; the DOM scene controller remains monolithic. Documentation is mostly candid about performance and bot balance, but the tech rule and victory presentation overstate the observed behavior. [logs/Astra/source-evidence.json](judging/logs/B/source-evidence.json); [logs/Astra/own-e2e.log](judging/logs/B/own-e2e.log); [Astra/src/main.ts:89](judging/work/B/src/main.ts#L89)

**Opus: 8.1/10 — judged visually/by reading.** Best separation of app services, loop, serializable simulation, schema/characters, controllers, scenes, HUD, stages and audio. Allocation-free wording is too broad because projectiles are still allocated. The README runtime minimum also conflicts with the locked Vite engine requirement. Strong structure does not exempt documentation from accuracy review. [logs/Opus/source-evidence.json](judging/logs/C/source-evidence.json); [logs/Opus/own-e2e.log](judging/logs/C/own-e2e.log); [Opus/src/core/app.ts:36](judging/work/C/src/core/app.ts#L36)

## 7. Highest-priority bugs overall

### Astra — High — Normal throws cannot be teched through the full input pipeline

Start a local versus fixture at close range. Press the attacker’s LP+LK, then the defender’s LP+LK at each delay in the logged window, including the same frame. Normal throws connect but no tech event occurs. Simultaneous throws can damage both fighters. startMove consumes the defender’s edge before resolveHit checks it.

[logs/Astra/edge-cases.json](judging/logs/B/edge-cases.json); [Astra/src/core/sim.ts:160](judging/work/B/src/core/sim.ts#L160); [Astra/src/core/sim.ts:338](judging/work/B/src/core/sim.ts#L338); [Astra/tests/sim.test.ts:126](judging/work/B/tests/sim.test.ts#L126)

### Argon/Opus — High — Full-scale rendering misses the stable performance target

Run the shared GPU benchmark on each production build with the fixed scale and common viewport. Inspect raw intervals and the long-tail metrics; the result persists while Astra meets the same threshold. For Opus, automatic scale is a fallback rather than evidence of full-resolution performance.

[logs/Argon/independent-benchmark-gpu.json](judging/logs/A/independent-benchmark-gpu.json); [logs/Astra/independent-benchmark-gpu.json](judging/logs/B/independent-benchmark-gpu.json); [logs/Opus/independent-benchmark-gpu.json](judging/logs/C/independent-benchmark-gpu.json)

### Argon — Medium — Own browser verification fails and overstates keyboard coverage

Run the recorded E2E command. The move-list expectation fails because the menu never reaches that scene after rapid presses. A paced independent keyboard traversal succeeds. The later special test directly steps the simulation, so it would not prove the advertised keyboard path even if navigation passed.

[logs/Argon/own-e2e.log](judging/logs/A/own-e2e.log); [logs/Argon/browser-flow.json](judging/logs/A/browser-flow.json); [Argon/tests/e2e.spec.ts:113](judging/work/A/tests/e2e.spec.ts#L113)

### Argon — Medium — README command-grab binding and Ultimate cost differ from code

Follow the README’s HCF+punch grab binding: the selected move is the armored shoulder charge. The actual grab uses the rotation binding. The move data also sets the Ultimate cost below the README claim. The live archive is more accurate than the prose documentation.

[logs/Argon/edge-cases.json](judging/logs/A/edge-cases.json); [Argon/README.md:119](judging/work/A/README.md#L119); [Argon/src/data/characters.ts:747](judging/work/A/src/data/characters.ts#L747)

### Argon/Opus — Low — Rotation parser accepts a non-rotating cardinal sequence

Feed the same out-of-order cardinal sequence recorded in edge-cases.json. Argon and Opus accept it as a rotation; Astra rejects it. Opus explicitly documents this implementation choice in a code comment. This is excessive leniency rather than a failure to recognize valid motions.

[logs/Argon/edge-cases.json](judging/logs/A/edge-cases.json); [logs/Astra/edge-cases.json](judging/logs/B/edge-cases.json); [logs/Opus/edge-cases.json](judging/logs/C/edge-cases.json)

### Astra — Low — Results do not select the authored victory-tempo branch

Finish a match and inspect the audio theme selection. Results keep the prior stage theme; the victory-tempo condition exists but is not selected by that flow.

[Astra/src/audio/synth.ts:132](judging/work/B/src/audio/synth.ts#L132); [Astra/src/main.ts:297](judging/work/B/src/main.ts#L297)

### Opus — Low — Allocation-free wording exceeds the implementation

Inspect spawnProjectile: it pushes a newly created projectile object into the simulation list. Particle pooling is real, but it does not make every hot path allocation-free. Endpoint heap growth alone is not used to allege a leak.

[Opus/src/sim/fighter.ts:504](judging/work/C/src/sim/fighter.ts#L504); [Opus/README.md:382](judging/work/C/README.md#L382)

### Opus — Low — Documented runtime minimum does not match locked dependencies

Compare the README requirement of Node.js 18+ with the locked Vite engine range, ^20.19.0 || >=22.12.0. This audit ran successfully on Node.js 24; compatibility with the advertised older runtime was not demonstrated.

[Opus/README.md:17](judging/work/C/README.md#L17); [Opus/package-lock.json:1574](judging/work/C/package-lock.json#L1574)

## 8. Recommendations and human follow-up

### Argon

- Repair the E2E timing and verify real keyboard specials and replay hashes. Add execution tests for each documented binding, Ultimate cost and every trial; align the README with executable data.
- Give CPU defense a genuine delayed perception snapshot. Complete gamepad remapping and fullscreen, then reduce repeated glow work and cache stage/HUD elements.
- Develop stronger silhouettes, anticipation/recovery poses and stage-specific compositions; raise the backing resolution only after profiling the existing render cost.

### Astra

- Fix throw-tech evaluation before consuming the defender’s input edge; assert the result through full simulation steps and real keyboard/gamepad chords, including simultaneous throws.
- Retain the visual system and performance work. Add a delayed CPU perception model, stronger pose variation and a distinct victory track.
- Split scene/UI controllers into modules and add an explicit mode-select treatment if literal screen-flow parity matters. Recheck the weakest matchup with larger samples and human players.

### Opus

- Profile full-resolution rendering first: stage composites, glyph/portrait caches, reflections, rain and super FX. Show the chosen dynamic resolution to users and verify the stable target at a clearly documented quality level.
- Constrain rotation recognition to a documented ordered shortcut and test rejection cases. Pool projectiles or narrow the README performance claim.
- Reduce glow behind small functional text and simplify busy HUD backdrops. Human-test the grappler/zoner matchup and whether the rushdown fighter should have more life than the grappler.

Still requires hands-on play: input latency and missed inputs, physical gamepad remapping, controller comfort, defensive fairness, combo discovery/exploits, audio mix/taste, accessibility under long sessions, dynamic resolution quality, and human matchup balance. Fill the blank Human playtest score column independently of the code-based estimate.

## Appendix — every requirement in sections A–E

Equal-weight requirements; Implemented = full, Partial = half, Missing/Broken = zero. Unnumbered D bullets are D1/D2. Only sections A–E enter this percentage.

### Argon

| ID / requirement | Status | Evidence and finding |
| --- | --- | --- |
| A1 — Vite/npm, Canvas/WebGL, documented one-command startup | Implemented | README command reached a live server; production build passed. [logs/Argon/readme-start.log](judging/logs/A/readme-start.log); [logs/Argon/build.log](judging/logs/A/build.log) |
| A2 — Procedural art, stages, animation, VFX and Web Audio; no external assets | Implemented | Source uses procedural drawing/synthesis; no runtime image, font or audio asset files in the submission source. [Argon/src/main.ts:1](judging/work/A/src/main.ts#L1); [logs/Argon/original-manifest.json](judging/logs/A/original-manifest.json) |
| A3 — Deterministic, serializable 60 Hz simulation, decoupled rendering | Implemented | Independent same-input replay and JSON serialization continuation match; fixed-step loop is separate from presentation. [logs/Argon/determinism.json](judging/logs/A/determinism.json) |
| A4 — Data-defined characters, moves, frame data, boxes and projectiles | Implemented | Loaded move inventory is defined in character data, including all normal stances. [logs/Argon/roster-inventory.json](judging/logs/A/roster-inventory.json) |
| B1 — Full move frame data; separate per-frame collision box types | Implemented | Typed move schema and simulation define timing, boxes, hit levels, cancels, armor and invulnerability. [logs/Argon/roster-inventory.json](judging/logs/A/roster-inventory.json); [logs/Argon/combat-spotchecks.json](judging/logs/A/combat-spotchecks.json) |
| B2 — Buffer, SOCD, motions/charge, negative edge, macros, device remapping | Partial | The documented HCF grab binding selects a shoulder charge; unordered cardinals count as a rotation. Gamepad remapping/macros are incomplete. [logs/Argon/edge-cases.json](judging/logs/A/edge-cases.json); [Argon/src/input/inputBuffer.ts:318](judging/work/A/src/input/inputBuffer.ts#L318) |
| B3 — Complete normals, command normals, throws, specials/EX/Super/Ultimate | Implemented | Every fighter has the full standing/crouching/air normal set, directional throws, special variants, EX and finishers. [logs/Argon/roster-inventory.json](judging/logs/A/roster-inventory.json) |
| B4 — Movement, blocking, pushblock, throw tech, wakeup, juggle, air tech and walls | Implemented | Simulation movement/defense paths inspected; throw, guard, charge and air-mobility probes run in the browser. [logs/Argon/combat-spotchecks.json](judging/logs/A/combat-spotchecks.json) |
| B5 — Links/chains/cancels, scaling, combo/damage display and dizzy | Implemented | Input-driven combo forms, counter advances, scaling exists and is covered by actual combat assertions. [logs/Argon/combat-spotchecks.json](judging/logs/A/combat-spotchecks.json); [screenshots/Argon/08-mid-combo.png](judging/screenshots/A/08-mid-combo.png) |
| B6 — Three-stock meter, EX, defensive resource tool and risky overdrive | Implemented | Meter gain and a paid Super Art were observed; EX, defensive tools and overdrive costs/risk are defined. [logs/Argon/combat-spotchecks.json](judging/logs/A/combat-spotchecks.json); [screenshots/Argon/09-super-active.png](judging/screenshots/A/09-super-active.png) |
| B7 — Best-of-three, timer, time-over, KO/draw/perfect and presentation | Implemented | Timer decreases, forced near-expiry uses the real time-over path, and attack-generated KO advances rounds. [logs/Argon/combat-spotchecks.json](judging/logs/A/combat-spotchecks.json); [screenshots/Argon/10-ko-round-end.png](judging/screenshots/A/10-ko-round-end.png) |
| B8 — Hitstop, shake, sparks, block FX, camera, shadows and cinematic supers | Implemented | Hitstop, buffered inputs, camera/shake, impact FX and super presentation are visible and implemented in code. [screenshots/Argon/09-super-active.png](judging/screenshots/A/09-super-active.png); [screenshots/Argon/18-special-strip.png](judging/screenshots/A/18-special-strip.png); [logs/Argon/combat-spotchecks.json](judging/logs/A/combat-spotchecks.json) |
| B9 — Difficulty/personality, spacing/defense/combos/meter, fair input-driven CPU | Partial | Uses current opponent attack/level before the neutral cooldown; defensive decisions lack a perception delay. [Argon/src/ai/cpuController.ts:217](judging/work/A/src/ai/cpuController.ts#L217); [logs/Argon/independent-balance.json](judging/logs/A/independent-balance.json) |
| B10 — Arcade, local versus, full training, validated trials and last-match replay | Partial | Training/trial/replay code exists, but the submission has no executable validation of all trials or a browser replay hash. [Argon/src/scenes/gameApp.ts:762](judging/work/A/src/scenes/gameApp.ts#L762); [logs/Argon/unit-results.json](judging/logs/A/unit-results.json) |
| C1 — Complete animated screen flow, selection, results, pause and return | Partial | The mode choices are merged into the main menu; there is no separate mode-select screen. [screenshots/Argon/03-main-menu.png](judging/screenshots/A/03-main-menu.png); [screenshots/Argon/20-mode-select.png](judging/screenshots/A/20-mode-select.png) |
| C2 — Complete legible match HUD, trails, meters, inputs, announcements and warnings | Implemented | Health, meter stocks, round pips, timer, stun/input/combo/announcement rendering inspected. [screenshots/Argon/07-match-hud-start.png](judging/screenshots/A/07-match-hud-start.png); [screenshots/Argon/08-mid-combo.png](judging/screenshots/A/08-mid-combo.png) |
| C3 — Described move lists with clear motion icons and training frame data | Implemented | Character tabs, motion notation, descriptions and frame information are present. [screenshots/Argon/12-move-list.png](judging/screenshots/A/12-move-list.png) |
| C4 — Remapping, audio/video/accessibility settings, fullscreen, language-ready text | Partial | Keyboard remapping and audiovisual toggles exist; fullscreen and gamepad-remapping UI are absent. Many labels are hardcoded. [screenshots/Argon/13-settings.png](judging/screenshots/A/13-settings.png); [Argon/src/data/settings.ts:3](judging/work/A/src/data/settings.ts#L3) |
| C5 — Responsive letterboxing, crisp DPR rendering, keyboard/gamepad menus | Partial | Letterboxing works, but at the judge viewport the backing canvas remains lower resolution, visibly softening small text. [logs/Argon/resize.json](judging/logs/A/resize.json); [Argon/src/scenes/gameApp.ts:203](judging/work/A/src/scenes/gameApp.ts#L203) |
| C6 — Cohesive design system, interaction motion and sound; no placeholder feel | Partial | Visual consistency judged from the complete judge-captured gallery; detailed legibility/animation limitations are recorded. [screenshots/Argon/03-main-menu.png](judging/screenshots/A/03-main-menu.png); [screenshots/Argon/04-character-select.png](judging/screenshots/A/04-character-select.png); [logs/Argon/visual-review.json](judging/logs/A/visual-review.json) |
| C7 — Distinct original animated parallax stages with ambience/music | Implemented | All stage variants render with animated ambience; screenshots compare their actual layouts. [screenshots/Argon/15-stage-1.png](judging/screenshots/A/15-stage-1.png); [screenshots/Argon/16-stage-2.png](judging/screenshots/A/16-stage-2.png); [screenshots/Argon/17-stage-3.png](judging/screenshots/A/17-stage-3.png) |
| C8 — Menu/stage/victory music, action/UI SFX, mute and volume controls | Implemented | Synthesized audio paths and volume controls exist; auditory taste has not been human-tested. [screenshots/Argon/13-settings.png](judging/screenshots/A/13-settings.png) |
| D1 — Stable FPS/GC, pooling, low latency, cleanup, visibility pause, clean console | Partial | No browser errors in the shared play run; visibility event pauses the simulation, but frame-time tails and allocation paths prevent full credit. [logs/Argon/two-minute-play.json](judging/logs/A/two-minute-play.json); [logs/Argon/visibility.json](judging/logs/A/visibility.json); [logs/Argon/independent-benchmark-gpu.json](judging/logs/A/independent-benchmark-gpu.json) |
| D2 — Clean typed modular architecture with useful comments | Partial | Typed module separation inspected; monolithic scene/application code and cleanup gaps are called out. [logs/Argon/source-evidence.json](judging/logs/A/source-evidence.json) |
| E1 — Meaningful passing unit coverage of every specified combat/input topic | Partial | The small suite has meaningful broad assertions but lacks granular boundary, trial, replay and finisher coverage. [logs/Argon/unit-results.json](judging/logs/A/unit-results.json); [Argon/tests/simulation.test.ts:38](judging/work/A/tests/simulation.test.ts#L38) |
| E2 — Passing keyboard/menu/special/HUD/round browser verification | Broken | The submitted E2E fails at the move-list keyboard navigation assertion. [logs/Argon/own-e2e.log](judging/logs/A/own-e2e.log) |
| E3 — Reproducible large CPU balance run, matrix and match length | Implemented | Shared seeded headless balance script completes the full required match workload with no crashes or cap hits. [logs/Argon/independent-balance.json](judging/logs/A/independent-balance.json) |
| E4 — Screenshot verification deliverables and visual review/fixes | Partial | Submission screenshot tools/assets exist; the author’s claimed inspection/fix process cannot be independently established. Judge captures are separate evidence. [logs/Argon/original-manifest.json](judging/logs/A/original-manifest.json); [logs/Argon/visual-review.json](judging/logs/A/visual-review.json) |
| E5 — Real rendered match benchmark with frame pacing and memory output | Broken | The script replaces the game loop and paints into an offscreen software canvas using scheduled steps; it is not an on-screen rAF FPS benchmark. [Argon/scripts/bench.ts:50](judging/work/A/scripts/bench.ts#L50); [Argon/scripts/bench.ts:85](judging/work/A/scripts/bench.ts#L85) |
| E6 — Successful production build and measured bundle | Implemented | The exact production build command passed and every output file was measured, including gzip. [logs/Argon/build.log](judging/logs/A/build.log); [judging/data/objective.json](judging/data/objective.json) |


### Astra

| ID / requirement | Status | Evidence and finding |
| --- | --- | --- |
| A1 — Vite/npm, Canvas/WebGL, documented one-command startup | Implemented | README command reached a live server; production build passed. [logs/Astra/readme-start.log](judging/logs/B/readme-start.log); [logs/Astra/build.log](judging/logs/B/build.log) |
| A2 — Procedural art, stages, animation, VFX and Web Audio; no external assets | Implemented | Source uses procedural drawing/synthesis; no runtime image, font or audio asset files in the submission source. [Astra/src/main.ts:1](judging/work/B/src/main.ts#L1); [logs/Astra/original-manifest.json](judging/logs/B/original-manifest.json) |
| A3 — Deterministic, serializable 60 Hz simulation, decoupled rendering | Implemented | Independent same-input replay and JSON serialization continuation match; fixed-step loop is separate from presentation. [logs/Astra/determinism.json](judging/logs/B/determinism.json) |
| A4 — Data-defined characters, moves, frame data, boxes and projectiles | Implemented | Loaded move inventory is defined in character data, including all normal stances. [logs/Astra/roster-inventory.json](judging/logs/B/roster-inventory.json) |
| B1 — Full move frame data; separate per-frame collision box types | Implemented | Typed move schema and simulation define timing, boxes, hit levels, cancels, armor and invulnerability. [logs/Astra/roster-inventory.json](judging/logs/B/roster-inventory.json); [logs/Astra/combat-spotchecks.json](judging/logs/B/combat-spotchecks.json) |
| B2 — Buffer, SOCD, motions/charge, negative edge, macros, device remapping | Implemented | Motion/charge/negative-edge and device paths inspected and exercised; boundary limitations noted below. [logs/Astra/keyboard-qcf-state.json](judging/logs/B/keyboard-qcf-state.json); [logs/Astra/edge-cases.json](judging/logs/B/edge-cases.json) |
| B3 — Complete normals, command normals, throws, specials/EX/Super/Ultimate | Implemented | Every fighter has the full standing/crouching/air normal set, directional throws, special variants, EX and finishers. [logs/Astra/roster-inventory.json](judging/logs/B/roster-inventory.json) |
| B4 — Movement, blocking, pushblock, throw tech, wakeup, juggle, air tech and walls | Partial | Normal throws connect, but no tested full-step throw-tech timing succeeds: a defensive throw consumes its edge before collision resolution. [logs/Astra/edge-cases.json](judging/logs/B/edge-cases.json); [Astra/src/core/sim.ts:160](judging/work/B/src/core/sim.ts#L160); [Astra/src/core/sim.ts:338](judging/work/B/src/core/sim.ts#L338) |
| B5 — Links/chains/cancels, scaling, combo/damage display and dizzy | Implemented | Input-driven combo forms, counter advances, scaling exists and is covered by actual combat assertions. [logs/Astra/combat-spotchecks.json](judging/logs/B/combat-spotchecks.json); [screenshots/Astra/08-mid-combo.png](judging/screenshots/B/08-mid-combo.png) |
| B6 — Three-stock meter, EX, defensive resource tool and risky overdrive | Implemented | Meter gain and a paid Super Art were observed; EX, defensive tools and overdrive costs/risk are defined. [logs/Astra/combat-spotchecks.json](judging/logs/B/combat-spotchecks.json); [screenshots/Astra/09-super-active.png](judging/screenshots/B/09-super-active.png) |
| B7 — Best-of-three, timer, time-over, KO/draw/perfect and presentation | Implemented | Timer decreases, forced near-expiry uses the real time-over path, and attack-generated KO advances rounds. [logs/Astra/combat-spotchecks.json](judging/logs/B/combat-spotchecks.json); [screenshots/Astra/10-ko-round-end.png](judging/screenshots/B/10-ko-round-end.png) |
| B8 — Hitstop, shake, sparks, block FX, camera, shadows and cinematic supers | Implemented | Hitstop, buffered inputs, camera/shake, impact FX and super presentation are visible and implemented in code. [screenshots/Astra/09-super-active.png](judging/screenshots/B/09-super-active.png); [screenshots/Astra/18-special-strip.png](judging/screenshots/B/18-special-strip.png); [logs/Astra/combat-spotchecks.json](judging/logs/B/combat-spotchecks.json) |
| B9 — Difficulty/personality, spacing/defense/combos/meter, fair input-driven CPU | Partial | Decision waits and rolled motions exist, but guard choice reads the opponent’s current move and exact hit level. [Astra/src/ai/cpu.ts:123](judging/work/B/src/ai/cpu.ts#L123); [logs/Astra/independent-balance.json](judging/logs/B/independent-balance.json) |
| B10 — Arcade, local versus, full training, validated trials and last-match replay | Implemented | Modes and tools exist; training overlay and trials were opened; replay assertions reviewed. [screenshots/Astra/11-training-hitboxes.png](judging/screenshots/B/11-training-hitboxes.png); [screenshots/Astra/21-trials.png](judging/screenshots/B/21-trials.png); [logs/Astra/unit-results.json](judging/logs/B/unit-results.json) |
| C1 — Complete animated screen flow, selection, results, pause and return | Partial | Main menu doubles as mode select; the rest of the flow works and is captured. [screenshots/Astra/03-main-menu.png](judging/screenshots/B/03-main-menu.png); [screenshots/Astra/20-mode-select.png](judging/screenshots/B/20-mode-select.png) |
| C2 — Complete legible match HUD, trails, meters, inputs, announcements and warnings | Implemented | Health, meter stocks, round pips, timer, stun/input/combo/announcement rendering inspected. [screenshots/Astra/07-match-hud-start.png](judging/screenshots/B/07-match-hud-start.png); [screenshots/Astra/08-mid-combo.png](judging/screenshots/B/08-mid-combo.png) |
| C3 — Described move lists with clear motion icons and training frame data | Implemented | Character tabs, motion notation, descriptions and frame information are present. [screenshots/Astra/12-move-list.png](judging/screenshots/B/12-move-list.png) |
| C4 — Remapping, audio/video/accessibility settings, fullscreen, language-ready text | Implemented | Settings expose volume, visual toggles and remapping; device/fullscreen/localization paths reviewed. [screenshots/Astra/13-settings.png](judging/screenshots/B/13-settings.png) |
| C5 — Responsive letterboxing, crisp DPR rendering, keyboard/gamepad menus | Implemented | Portrait and ultrawide viewports preserve the game aspect ratio; keyboard flow works; device code reviewed. [logs/Astra/resize.json](judging/logs/B/resize.json); [logs/Astra/browser-flow.json](judging/logs/B/browser-flow.json) |
| C6 — Cohesive design system, interaction motion and sound; no placeholder feel | Implemented | Visual consistency judged from the complete judge-captured gallery; detailed legibility/animation limitations are recorded. [screenshots/Astra/03-main-menu.png](judging/screenshots/B/03-main-menu.png); [screenshots/Astra/04-character-select.png](judging/screenshots/B/04-character-select.png); [logs/Astra/visual-review.json](judging/logs/B/visual-review.json) |
| C7 — Distinct original animated parallax stages with ambience/music | Implemented | All stage variants render with animated ambience; screenshots compare their actual layouts. [screenshots/Astra/15-stage-1.png](judging/screenshots/B/15-stage-1.png); [screenshots/Astra/16-stage-2.png](judging/screenshots/B/16-stage-2.png); [screenshots/Astra/17-stage-3.png](judging/screenshots/B/17-stage-3.png) |
| C8 — Menu/stage/victory music, action/UI SFX, mute and volume controls | Partial | Stage/menu synthesis works, but the distinct victory-tempo branch is not selected by the results flow; SFX use broad action classes. [Astra/src/audio/synth.ts:132](judging/work/B/src/audio/synth.ts#L132); [Astra/src/main.ts:297](judging/work/B/src/main.ts#L297) |
| D1 — Stable FPS/GC, pooling, low latency, cleanup, visibility pause, clean console | Partial | No browser errors in the shared play run; visibility event pauses the simulation, but frame-time tails and allocation paths prevent full credit. [logs/Astra/two-minute-play.json](judging/logs/B/two-minute-play.json); [logs/Astra/visibility.json](judging/logs/B/visibility.json); [logs/Astra/independent-benchmark-gpu.json](judging/logs/B/independent-benchmark-gpu.json) |
| D2 — Clean typed modular architecture with useful comments | Partial | Typed module separation inspected; monolithic scene/application code and cleanup gaps are called out. [logs/Astra/source-evidence.json](judging/logs/B/source-evidence.json) |
| E1 — Meaningful passing unit coverage of every specified combat/input topic | Implemented | Executed own unit suite; assertions inspected for behavior rather than filenames or README promises. [logs/Astra/unit-results.json](judging/logs/B/unit-results.json); [logs/Astra/source-evidence.json](judging/logs/B/source-evidence.json) |
| E2 — Passing keyboard/menu/special/HUD/round browser verification | Implemented | Executed original browser suite under the common viewport; exact pass/fail result is retained. [logs/Astra/own-e2e.log](judging/logs/B/own-e2e.log); [logs/Astra/e2e-results.json](judging/logs/B/e2e-results.json) |
| E3 — Reproducible large CPU balance run, matrix and match length | Implemented | Shared seeded headless balance script completes the full required match workload with no crashes or cap hits. [logs/Astra/independent-balance.json](judging/logs/B/independent-balance.json) |
| E4 — Screenshot verification deliverables and visual review/fixes | Partial | Submission screenshot tools/assets exist; the author’s claimed inspection/fix process cannot be independently established. Judge captures are separate evidence. [logs/Astra/original-manifest.json](judging/logs/B/original-manifest.json); [logs/Astra/visual-review.json](judging/logs/B/visual-review.json) |
| E5 — Real rendered match benchmark with frame pacing and memory output | Implemented | Project benchmark method inspected against a shared real-rAF workload; submitted values are treated as claims. [logs/Astra/submitted-bench.json](judging/logs/B/submitted-bench.json); [logs/Astra/independent-benchmark-gpu.json](judging/logs/B/independent-benchmark-gpu.json) |
| E6 — Successful production build and measured bundle | Implemented | The exact production build command passed and every output file was measured, including gzip. [logs/Astra/build.log](judging/logs/B/build.log); [judging/data/objective.json](judging/data/objective.json) |


### Opus

| ID / requirement | Status | Evidence and finding |
| --- | --- | --- |
| A1 — Vite/npm, Canvas/WebGL, documented one-command startup | Implemented | README command reached a live server; production build passed. [logs/Opus/readme-start.log](judging/logs/C/readme-start.log); [logs/Opus/build.log](judging/logs/C/build.log) |
| A2 — Procedural art, stages, animation, VFX and Web Audio; no external assets | Implemented | Source uses procedural drawing/synthesis; no runtime image, font or audio asset files in the submission source. [Opus/src/main.ts:10](judging/work/C/src/main.ts#L10); [logs/Opus/original-manifest.json](judging/logs/C/original-manifest.json) |
| A3 — Deterministic, serializable 60 Hz simulation, decoupled rendering | Implemented | Independent same-input replay and JSON serialization continuation match; fixed-step loop is separate from presentation. [logs/Opus/determinism.json](judging/logs/C/determinism.json) |
| A4 — Data-defined characters, moves, frame data, boxes and projectiles | Implemented | Loaded move inventory is defined in character data, including all normal stances. [logs/Opus/roster-inventory.json](judging/logs/C/roster-inventory.json) |
| B1 — Full move frame data; separate per-frame collision box types | Implemented | Typed move schema and simulation define timing, boxes, hit levels, cancels, armor and invulnerability. [logs/Opus/roster-inventory.json](judging/logs/C/roster-inventory.json); [logs/Opus/combat-spotchecks.json](judging/logs/C/combat-spotchecks.json) |
| B2 — Buffer, SOCD, motions/charge, negative edge, macros, device remapping | Partial | Broad parser coverage and device remapping work; rotation recognition deliberately accepts unordered cardinal directions, reducing motion strictness. [logs/Opus/edge-cases.json](judging/logs/C/edge-cases.json); [Opus/src/sim/input.ts:267](judging/work/C/src/sim/input.ts#L267) |
| B3 — Complete normals, command normals, throws, specials/EX/Super/Ultimate | Implemented | Every fighter has the full standing/crouching/air normal set, directional throws, special variants, EX and finishers. [logs/Opus/roster-inventory.json](judging/logs/C/roster-inventory.json) |
| B4 — Movement, blocking, pushblock, throw tech, wakeup, juggle, air tech and walls | Implemented | Simulation movement/defense paths inspected; throw, guard, charge and air-mobility probes run in the browser. [logs/Opus/combat-spotchecks.json](judging/logs/C/combat-spotchecks.json) |
| B5 — Links/chains/cancels, scaling, combo/damage display and dizzy | Implemented | Input-driven combo forms, counter advances, scaling exists and is covered by actual combat assertions. [logs/Opus/combat-spotchecks.json](judging/logs/C/combat-spotchecks.json); [screenshots/Opus/08-mid-combo.png](judging/screenshots/C/08-mid-combo.png) |
| B6 — Three-stock meter, EX, defensive resource tool and risky overdrive | Implemented | Meter gain and a paid Super Art were observed; EX, defensive tools and overdrive costs/risk are defined. [logs/Opus/combat-spotchecks.json](judging/logs/C/combat-spotchecks.json); [screenshots/Opus/09-super-active.png](judging/screenshots/C/09-super-active.png) |
| B7 — Best-of-three, timer, time-over, KO/draw/perfect and presentation | Implemented | Timer decreases, forced near-expiry uses the real time-over path, and attack-generated KO advances rounds. [logs/Opus/combat-spotchecks.json](judging/logs/C/combat-spotchecks.json); [screenshots/Opus/10-ko-round-end.png](judging/screenshots/C/10-ko-round-end.png) |
| B8 — Hitstop, shake, sparks, block FX, camera, shadows and cinematic supers | Implemented | Hitstop, buffered inputs, camera/shake, impact FX and super presentation are visible and implemented in code. [screenshots/Opus/09-super-active.png](judging/screenshots/C/09-super-active.png); [screenshots/Opus/18-special-strip.png](judging/screenshots/C/18-special-strip.png); [logs/Opus/combat-spotchecks.json](judging/logs/C/combat-spotchecks.json) |
| B9 — Difficulty/personality, spacing/defense/combos/meter, fair input-driven CPU | Implemented | Hard CPU completes the shared balance workload; decision/input policy reviewed for fairness and personality. [logs/Opus/independent-balance.json](judging/logs/C/independent-balance.json) |
| B10 — Arcade, local versus, full training, validated trials and last-match replay | Implemented | Modes and tools exist; training overlay and trials were opened; replay assertions reviewed. [screenshots/Opus/11-training-hitboxes.png](judging/screenshots/C/11-training-hitboxes.png); [screenshots/Opus/21-trials.png](judging/screenshots/C/21-trials.png); [logs/Opus/unit-results.json](judging/logs/C/unit-results.json) |
| C1 — Complete animated screen flow, selection, results, pause and return | Implemented | Keyboard flow reaches selection, versus and match; settings, move list, pause and results are captured. [logs/Opus/browser-flow.json](judging/logs/C/browser-flow.json); [screenshots/Opus/14-results.png](judging/screenshots/C/14-results.png) |
| C2 — Complete legible match HUD, trails, meters, inputs, announcements and warnings | Implemented | Health, meter stocks, round pips, timer, stun/input/combo/announcement rendering inspected. [screenshots/Opus/07-match-hud-start.png](judging/screenshots/C/07-match-hud-start.png); [screenshots/Opus/08-mid-combo.png](judging/screenshots/C/08-mid-combo.png) |
| C3 — Described move lists with clear motion icons and training frame data | Implemented | Character tabs, motion notation, descriptions and frame information are present. [screenshots/Opus/12-move-list.png](judging/screenshots/C/12-move-list.png) |
| C4 — Remapping, audio/video/accessibility settings, fullscreen, language-ready text | Implemented | Settings expose volume, visual toggles and remapping; device/fullscreen/localization paths reviewed. [screenshots/Opus/13-settings.png](judging/screenshots/C/13-settings.png) |
| C5 — Responsive letterboxing, crisp DPR rendering, keyboard/gamepad menus | Implemented | Portrait and ultrawide viewports preserve the game aspect ratio; keyboard flow works; device code reviewed. [logs/Opus/resize.json](judging/logs/C/resize.json); [logs/Opus/browser-flow.json](judging/logs/C/browser-flow.json); [Opus/src/core/view.ts:59](judging/work/C/src/core/view.ts#L59) |
| C6 — Cohesive design system, interaction motion and sound; no placeholder feel | Partial | Cohesive original neon typography and panels, but glow, thin small labels and busy backdrops reduce readability; it is below the exceptional quality bar. [screenshots/Opus/04-character-select.png](judging/screenshots/C/04-character-select.png); [screenshots/Opus/11-training-hitboxes.png](judging/screenshots/C/11-training-hitboxes.png); [logs/Opus/visual-review.json](judging/logs/C/visual-review.json) |
| C7 — Distinct original animated parallax stages with ambience/music | Implemented | All stage variants render with animated ambience; screenshots compare their actual layouts. [screenshots/Opus/15-stage-1.png](judging/screenshots/C/15-stage-1.png); [screenshots/Opus/16-stage-2.png](judging/screenshots/C/16-stage-2.png); [screenshots/Opus/17-stage-3.png](judging/screenshots/C/17-stage-3.png) |
| C8 — Menu/stage/victory music, action/UI SFX, mute and volume controls | Implemented | Synthesized audio paths and volume controls exist; auditory taste has not been human-tested. [screenshots/Opus/13-settings.png](judging/screenshots/C/13-settings.png) |
| D1 — Stable FPS/GC, pooling, low latency, cleanup, visibility pause, clean console | Partial | No browser errors in the shared play run; visibility event pauses the simulation, but frame-time tails and allocation paths prevent full credit. [logs/Opus/two-minute-play.json](judging/logs/C/two-minute-play.json); [logs/Opus/visibility.json](judging/logs/C/visibility.json); [logs/Opus/independent-benchmark-gpu.json](judging/logs/C/independent-benchmark-gpu.json) |
| D2 — Clean typed modular architecture with useful comments | Implemented | Typed module separation inspected; monolithic scene/application code and cleanup gaps are called out. [logs/Opus/source-evidence.json](judging/logs/C/source-evidence.json) |
| E1 — Meaningful passing unit coverage of every specified combat/input topic | Implemented | Executed own unit suite; assertions inspected for behavior rather than filenames or README promises. [logs/Opus/unit-results.json](judging/logs/C/unit-results.json); [logs/Opus/source-evidence.json](judging/logs/C/source-evidence.json) |
| E2 — Passing keyboard/menu/special/HUD/round browser verification | Implemented | Executed original browser suite under the common viewport; exact pass/fail result is retained. [logs/Opus/own-e2e.log](judging/logs/C/own-e2e.log); [logs/Opus/e2e-results.json](judging/logs/C/e2e-results.json) |
| E3 — Reproducible large CPU balance run, matrix and match length | Implemented | Shared seeded headless balance script completes the full required match workload with no crashes or cap hits. [logs/Opus/independent-balance.json](judging/logs/C/independent-balance.json) |
| E4 — Screenshot verification deliverables and visual review/fixes | Partial | Submission screenshot tools/assets exist; the author’s claimed inspection/fix process cannot be independently established. Judge captures are separate evidence. [logs/Opus/original-manifest.json](judging/logs/C/original-manifest.json); [logs/Opus/visual-review.json](judging/logs/C/visual-review.json) |
| E5 — Real rendered match benchmark with frame pacing and memory output | Implemented | Project benchmark method inspected against a shared real-rAF workload; submitted values are treated as claims. [logs/Opus/submitted-bench.json](judging/logs/C/submitted-bench.json); [logs/Opus/independent-benchmark-gpu.json](judging/logs/C/independent-benchmark-gpu.json) |
| E6 — Successful production build and measured bundle | Implemented | The exact production build command passed and every output file was measured, including gzip. [logs/Opus/build.log](judging/logs/C/build.log); [judging/data/objective.json](judging/data/objective.json) |


## Reproduction and final verification

The authoritative machine-readable outputs are [scores.json](judging/data/scores.json), [metrics.json](judging/data/metrics.json) and [checklist.json](judging/data/checklist.json). The [script guide](judging/scripts/README.md) gives exact commands, prerequisites and source-protection boundaries. The [harness notes](judging/logs/harness-notes.md) disclose corrected judge probes and capture timing.

Final automated checks validate image references, score/metric table values, bilingual numeric/image parity, source hashes, required captures and score evidence paths. The HTML is opened headlessly to verify the language toggle, persistence and every image in both languages. See [file verification](judging/data/verification.json) and [browser verification](judging/data/html-verification.json).
