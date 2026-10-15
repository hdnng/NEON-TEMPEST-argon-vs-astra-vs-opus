# Reproducing the independent evaluation

Run from the repository root on Windows. Prerequisites: Node/npm (the recorded run used Node 24), Python 3.11+, Pillow, markdown-it-py, and Playwright Chromium. The project dependencies are installed in the work copies by their documented startup commands. The judging JavaScript harnesses deliberately reuse the installed Playwright/tsx from work copy B; no global npm package is needed.

```powershell
python -m pip install Pillow markdown-it-py
```

The originals under `project-A`, `project-B`, `project-C` are never launch directories. `setup.py` records source/content SHA-256 manifests, chooses a random review order, and copies each submission, excluding generated dependencies/build/test output. It refuses to overwrite an existing judging work copy. To recreate a clean audit, use a fresh checkout/destination rather than deleting originals. Preserve the recorded `environment.json` to reuse the B → C → A order and seed.

The committed work copies preserve the source paths cited in the report. For a new audit, copy `SPEC.md` and the three original project folders to an empty destination before running `setup.py`; a checkout already contains the recorded work copies. To verify the existing reports, install the Python prerequisites above, run `npm --prefix judging/work/B ci`, install Chromium in that work copy, then run only `html_verify.mjs` and `verify.py`.

```powershell
python judging/scripts/setup.py
python judging/scripts/objective.py
```

`objective.py` executes A's `npm install && npm run dev`, and B/C's `npm start`, exactly as their READMEs say; BROWSER=none suppresses browser popups. It then runs `npm run build` and the original `npm test` with JSON reporting. Its startup commands remain alive and therefore have a null exit at readiness. Logs retain command, duration, URL, PID, output and ordinary build/test exit codes. No assistance was needed in this audit.

Install the shared browser once if absent:

```powershell
Push-Location judging/work/B
npx playwright install chromium
Pop-Location
```

Original browser suites and the shared seeded headless procedure:

```powershell
python judging/scripts/own_e2e.py
python judging/scripts/balance_all.py
node judging/work/B/node_modules/tsx/dist/cli.mjs judging/scripts/inventory.ts
node judging/work/B/node_modules/tsx/dist/cli.mjs judging/scripts/edge_cases.ts
```

The temporary `judging.playwright.config.ts` files only override viewport, reporter location and worker count. Unit/E2E failures are reported, not fixed. `headless.ts` uses the same ordered pairs, 32 seeds per pair, Hard controllers, normal best-of-three rules and 36,000-step safety cap for each engine. It also replays 7,200 identical input pairs twice and checks SHA-256 state equality and serialized continuation. Its matrix counts P1 wins; aggregate win rates combine both sides, omit mirrors and count draws as half wins.

For the independent browser procedures, run this server in another terminal (it serves only the built work copies on ports 6101–6103):

```powershell
node judging/scripts/server.mjs
```

Run these sequentially, with no other benchmark/browser workload in parallel:

```powershell
python judging/scripts/performance_all.py
python judging/scripts/gpu_all.py
```

The first performs the default software-headless benchmark and two minutes of actual keyboard P1 versus CPU gameplay per project. The second runs the primary GPU-headless 60-second benchmark. Both use 1920×1080, DPR 1, fixed scale 1, standard HP/meter, HAYATE versus SABLE, Hard CPU, the first stage, a warmup and a shared rAF sampler. Raw frame intervals, heap samples, GPU backend and console output are retained. 1% low is 1000 divided by the mean of the slowest 1% of frame intervals. p95 is the nearest-rank 95th percentile. No forced GC is used. A's smaller backing canvas is preserved and disclosed. Browser seeds follow submission defaults; balance/replay seeds are independently fixed.

Capture procedures, in the recorded review order:

```powershell
foreach ($projectLabel in @('B','C','A')) {
    node judging/scripts/browser.mjs $projectLabel
    node judging/scripts/mechanics.mjs $projectLabel
}
node judging/scripts/menus.mjs
node judging/scripts/presentation_captures.mjs
node judging/scripts/stage_captures.mjs
node judging/scripts/placeholders.mjs
node judging/scripts/keyboard_probe.mjs
python judging/scripts/images.py
```

The live-simulation capture harness uses documented development hooks and original modules. Its dev addresses are the observed README addresses: A localhost:5123, B 127.0.0.1:5173, C localhost:5173 (IPv6 loopback). If another unrelated server occupies these ports, use the printed ready URLs and verify application identity before adapting the adapter URLs. Production captures do not depend on those dev addresses.

Only neutral spacing, initial HP/meter and the near-expiry timer are controlled. Attacks, hits, combo values, damage and victories come from simulation inputs. The shared cast sequence has six actual frames, spaced by five simulation steps. B hitbox/input overlays are explicitly off for the animation comparison. C's built-in scene query entry points are used to capture settled presentation screens without entrance wipes; the independent keyboard traversal remains separate evidence. Every final image was manually viewed and its notes/fingerprint are in `visual-review.json`; `visual_notes.py` serializes those human-readable judge observations, it is not an automatic image-quality test.

After inspecting images, regenerate the shared-data deliverables:

```powershell
python judging/scripts/visual_notes.py
python judging/scripts/build_data.py
python judging/scripts/content.py
python judging/scripts/report.py
node judging/scripts/html_verify.mjs
python judging/scripts/verify.py
```

`build_data.py` computes all completion percentages, weighted totals, performance-threshold scores, win rates/comparisons and approximate Wilson intervals. `content.py` contains the bilingual editorial judgments. `report.py` renders both languages and the offline-capable HTML with inline CSS/JS and relative images. `html_verify.mjs` opens the actual report using a temporary local HTTP server, checks both languages, localStorage persistence and every image, then closes its browser/server. `verify.py` checks report image paths, metric/score values, bilingual numeric/image parity, all evidence paths, screenshot dimensions/fingerprints, original hashes and recomputed totals. They write machine-readable verification results under `judging/data/`.

Do not treat `combat-probes-initial.json` as final results; it documents exploratory judge probes corrected after source inspection. The corrections are explained in `judging/logs/harness-notes.md`. The score evidence points only to corrected probes. Scores are independent of README length, named models and supplied screenshots; no model identities were inferred.
