Build the BEST possible 2D fighting game that runs in the browser, in the current empty working directory. Work fully autonomously: do not ask me questions, make reasonable decisions yourself, and do not stop until every requirement and quality gate below is met and verified. Use your full capability and effort. Aim for a polished, commercial-quality result with deep mechanics and a beautiful UI/UX, not a prototype.

## Fixed theme (do not change)
Title: "NEON TEMPEST". Setting: an underground martial arts tournament in a rain-soaked cyberpunk Neo-Kyoto, with a neon-noir art direction (deep blues/magentas/cyans, glow, rain, holographic signs). Everything must be ORIGINAL: do not use or imitate any existing game's characters, names, logos, move names or sprites (this includes Street Fighter). Only the genre's mechanics are the reference.

Fixed roster (4 fighters, each with a distinct archetype and full move list):
1. HAYATE: balanced all-rounder. Fireball (QCF), rising uppercut invincible anti-air (DP), spinning advancing kick (QCB).
2. MAGNUS: heavy grappler. High HP, slow, command grabs (360 / half-circle motions), armored charging move, strong throws.
3. SABLE: fast rushdown. Air dash, double jump, teleport/cross-up tools, low-damage high-pressure strings, mix-ups.
4. WARDEN: charge/zoner. Charge motions (back-forward, down-up), projectiles with different speeds, a sweeping anti-air, good normals for spacing.

## A. Technical requirements
1. Tech: HTML5 Canvas 2D or WebGL (PixiJS/Phaser allowed; vanilla + TypeScript preferred), built with Vite + npm. Must start with ONE command, documented in README.md.
2. No external assets. All art, animation, backgrounds, VFX and audio must be procedural (code only): vector/pixel characters built from articulated parts or code-generated sprite frames, procedural stage backgrounds with parallax, Web Audio API for SFX and music.
3. Fixed-timestep deterministic simulation at 60 Hz, fully decoupled from rendering (render interpolation allowed). Same inputs must always produce the same result (seeded RNG). Game state must be serializable so rollback/replay is possible.
4. Data-driven design: characters, moves, frame data, hitboxes and projectiles defined in data files (JSON/TS), not hard-coded in logic.

## B. Combat mechanics (the core, make it deep and correct)
1. Frame data per move: startup, active, recovery, hitstun, blockstun, hitstop, damage, chip damage, meter gain, pushback, hit level (high/mid/low/overhead), cancel windows, invincibility frames, armor. Separate hurtbox, hitbox, pushbox, throwbox, with per-frame definition.
2. Input system: 60 Hz polling, input buffer (about 6 frames), leniency windows, 8-way directional parsing with SOCD cleaning, motion inputs (QCF, QCB, DP, HCF, HCB, 360, charge), negative edge, simultaneous button presses (e.g. LP+LK throw, 3-punch / 3-kick macros), button priority. Keyboard, gamepad (Gamepad API) and remappable controls.
3. Move set per character: standing/crouching/jumping normals (light/medium/heavy punch and kick), command normals, forward/backward throws, 3 special moves minimum with light/medium/heavy versions, EX versions that cost meter, and 1 Super Art (level 1) plus 1 Ultimate (when life is low) per character.
4. Systems: walk, crouch, jump (neutral/forward/back), forward/back dash, block (high/low/cross-up detection), pushblock, throw tech, wakeup/quick rise, knockdown, juggle with limited juggle points, air recovery, corner pressure, wall push logic.
5. Combos: link combos, special/super cancels, chain cancels for light normals, hit confirm windows, combo damage scaling, a combo counter and total damage display, and a dizzy/stun gauge that causes a stun state when depleted.
6. Resource system: Super meter (gained on attack, hit, block and damage taken, with 3 stocks), EX moves, a defensive tool (parry or focus-style absorb or guard-cancel) and an offensive "overdrive" mechanic with risk/reward. Design them cleanly and document them in README.
7. Round system: best of 3, 99-second timer, time-over resolution, perfect/double KO/draw handling, round intro/outro, KO slow-motion and camera zoom.
8. Game feel: hitstop, screen shake, hit sparks and flashes by strength, block effects, camera that tracks both fighters (zoom in/out by distance, stage bounds), shadows under characters, speed lines on supers, cinematic super cut-in.
9. CPU opponent: difficulty levels (Easy to Hard), reads spacing, uses anti-airs, blocks, punishes, combos, uses meter, mixes up; must not cheat via frame-perfect inputs (go through the same input system). Distinct personality per character.
10. Modes: Arcade (4-fight ladder with short intro/ending text), Versus (local 2P), Training mode (infinite health/meter toggles, frame data display, hitbox/hurtbox overlay, input display, record/playback dummy, dummy behavior options), Practice/Trials (at least 3 combo trials per character with step-by-step validation), Replay of the last match.

## C. UI/UX (must be exceptional; this is judged heavily)
1. Complete flow with animated transitions: boot/logo, title screen (press start, neon animated), main menu, mode select, character select (animated portraits, 2-player cursors, character stats and archetype, selected-fighter preview with idle animation), stage select, loading/versus splash screen, match, results screen, pause menu, settings, move list, back to menu.
2. In-match HUD: stylized health bars (with damage-recovery "white life" trail), super meter with 3 stocks, stun gauge, round win pips, timer, player names/portraits, combo counter with damage and "hits" popups, input history display (toggleable), announcer text ("ROUND 1", "FIGHT", "K.O.", "PERFECT", "SUPER ART") with stylish kinetic typography, low-health warning effects.
3. Move list screen per character (inputs shown as clear icons/arrows, described, with frame data in Training).
4. Settings: remap keyboard/gamepad, volume (music/SFX/master), screen shake toggle, flash reduction, colorblind-friendly option, show/hide HUD elements, resolution scale, fullscreen, language-ready structure (English strings centralized).
5. Responsiveness: scale correctly to any window size and aspect ratio (letterbox properly), crisp rendering, devicePixelRatio handled. Menus work with keyboard and gamepad (and mouse/touch where reasonable).
6. Consistent visual language: one cohesive design system (typography, color tokens, spacing, glow, motion easing), polished micro-animations on every menu interaction, sound feedback on navigation, no placeholder-looking UI anywhere.
7. Stages: at least 3 original animated stages with parallax layers, rain/neon flicker/crowd silhouettes/holograms, and stage-specific music/ambience.
8. Audio: procedural music loops (per menu, per stage, victory), SFX for every action (hits by strength, blocks, whiffs, projectiles, supers, UI), mute and volume control.

## D. Performance and robustness
- Stable 60 FPS on a mid-range laptop, no GC stutters (use object pooling for particles/projectiles/sparks), input-to-screen latency kept minimal, proper cleanup of resources, tab visibility handling (auto-pause), no console errors or warnings.
- Clean modular architecture (core/sim, input, characters/data, ai, render, vfx, audio, ui, scenes, utils), typed, commented where non-obvious.

## E. Quality gates (verify each, do not assume)
1. Unit tests (Vitest or similar): motion input parser (all motions incl. charge and buffer edge cases), frame data execution of several moves, hit/block/throw resolution, combo scaling, meter math, round/timer logic, and determinism (same input sequence gives identical state hash).
2. Playwright (headless Chromium) end-to-end test: load the game, navigate every menu with keyboard, start a match, perform a special move input, confirm the HUD updates, finish a round, confirm no console errors.
3. Headless bot-vs-bot simulation: run at least 500 CPU-vs-CPU matches across all 4 characters at max speed. Verify no crash, no softlock/infinite state, and report a win-rate matrix and average match length. Use it to tune balance (no character should be outside roughly 40-60% win rate if achievable).
4. Screenshots: capture at least 10 (title, menu, character select, versus screen, each stage in match, super cut-in, combo counter, training mode with hitboxes, results). Inspect them yourself and fix visual problems (overlaps, clipping, unreadable text, misalignment, flat lighting).
5. Benchmark script (`npm run bench`): average FPS, 1% low FPS, frame time and memory over 60 seconds of a CPU-vs-CPU match, saved to `bench-results.json`.
6. `npm run build` must succeed; report bundle size.

## F. Process
1. Write a short plan (max 20 lines): architecture, simulation model, data schema, art approach.
2. Build in iterations and verify after each: (1) simulation core + input + one character playable, (2) full combat systems + 4 characters, (3) AI + modes, (4) UI/UX + VFX + audio + stages, (5) tests + balance + performance.
3. After the first fully working version, do at least TWO critical improvement passes: review screenshots, test results and play-feel, list the 5 biggest weaknesses, fix them.
4. Fix every bug yourself. Do not leave TODOs or placeholder content.

## G. Deliverables
- Fully runnable project, `README.md` (run instructions, controls for keyboard and gamepad, full move lists for all characters, system explanations, architecture, test and benchmark results, known limitations), `screenshots/`, `bench-results.json`, balance report, tests.
- Final summary (max 20 lines): what was built, what was verified, final FPS and balance numbers, what you would improve next.

If time or budget runs short, prioritize in this order: correct and deterministic combat core, 4 characters with full move lists, UI/UX polish, then extra modes. Never deliver a project that does not run with one command.