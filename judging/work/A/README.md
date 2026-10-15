# NEON TEMPEST // Neo-Kyoto 2099

**NEON TEMPEST** is an original, 100% procedural 2D cyberpunk fighting game set in a rain-soaked Neo-Kyoto underground martial arts tournament. Built with TypeScript, HTML5 Canvas 2D, Vite, and the Web Audio API, it features a deterministic 60 Hz simulation engine, articulated vector-neon fighters, parallax cyberpunk arenas, and a deep competitive combat system with zero external image or audio assets.

---

## Quick Start (One Command)

```bash
npm install && npm run dev
```

Or if dependencies are already installed:

```bash
npm start
```

Then open the local URL printed by Vite (default `http://localhost:5173`) in your browser.

---

## Verification & Quality Gate Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` / `npm start` | Starts the Vite development server |
| `npm run build` | Type-checks (`tsc`) and builds the production bundle into `dist/` (`~193.2 kB` JS / `~53.7 kB` gzip) |
| `npm test` | Runs the Vitest unit test suite (`tests/simulation.test.ts`: motion parser, charge, negative edge, frame data, hit/block/throw, combo scaling, meter math, timer/KO, and determinism hash) |
| `npm run test:e2e` | Runs the headless Chromium Playwright E2E test (`tests/e2e.spec.ts`) navigating all menus, starting a match, performing a special move, verifying HUD updates, and finishing a round with 0 console errors |
| `npm run balance` | Runs 560 headless CPU-vs-CPU matches across all 4 fighters at ~37,500+ sim FPS and writes `balance-report.json` |
| `npm run bench` | Runs a 60-second continuous CPU-vs-CPU match benchmark in headless Chromium and saves `bench-results.json` |
| `npm run screenshots` | Captures 12 automated verification screenshots into `screenshots/` |

---

## Controls (Remappable in System Config)

All controls can be customized in **System Config (Settings)** and persist to `localStorage`. Simultaneous button shortcuts and Standard tournament Gamepads (via the HTML5 Gamepad API) are supported out of the box.

### Keyboard Defaults

| Action | Player 1 (Left) | Player 2 (Right) | Gamepad (Standard Mapping) |
| :--- | :--- | :--- | :--- |
| **Move / Crouch / Jump** | `W` `A` `S` `D` | `Arrow Keys` (`↑` `←` `↓` `→`) | D-Pad or Left Analog Stick |
| **Light Punch (LP)** | `U` | `Numpad 4` | West Face Button (`X` / `Square`) |
| **Medium Punch (MP)** | `I` | `Numpad 5` | North Face Button (`Y` / `Triangle`) |
| **Heavy Punch (HP)** | `O` | `Numpad 6` | Right Shoulder (`RB` / `R1`) |
| **Light Kick (LK)** | `J` | `Numpad 1` | South Face Button (`A` / `Cross`) |
| **Medium Kick (MK)** | `K` | `Numpad 2` | East Face Button (`B` / `Circle`) |
| **Heavy Kick (HK)** | `L` | `Numpad 3` | Right Trigger (`RT` / `R2`) |
| **Throw / Throw Tech** | `LP + LK` (`U + J`) | `LP + LK` (`Num4 + Num1`) | `X + A` or Left Shoulder (`LB` / `L1`) |
| **Cyber Parry** | `MP + MK` (`I + K`) or `P` | `MP + MK` (`Num5 + Num2`) or `Num0` | `Y + B` or Left Trigger (`LT` / `L2`) |
| **Tempest Overdrive** | `HP + HK` (`O + L`) | `HP + HK` (`Num6 + Num3`) | `RB + RT` (`R1 + R2`) |
| **EX Special Move** | Motion + `Two Punches` or `Two Kicks` | Motion + `Two Punches` or `Two Kicks` | Motion + `Two Punches` or `Two Kicks` |
| **Pushblock** | While Blocking: `Two Punches` | While Blocking: `Two Punches` | While Blocking: `Two Punches` |
| **Guard Cancel** | While Blocking: `6 + HP + HK` | While Blocking: `6 + HP + HK` | While Blocking: `Forward + RB + RT` |
| **Pause / Menu** | `Escape` / `Enter` | `Escape` / `Enter` | `Start` / `Options` |

### Training Mode Hotkeys
- `1`: Cycle Dummy Behavior (`STAND` → `CROUCH` → `JUMP` → `AUTO BLOCK` → `FIRST HIT BLOCK` → `RANDOM BLOCK` → `COUNTER ATTACK` → `CPU`)
- `2`: Toggle Hitbox / Hurtbox / Pushbox / Throwbox Overlay
- `3`: Cycle Dummy Recording (`IDLE` → `RECORDING` → `PLAYBACK`)
- `4`: Reset Fighter Positions & Vitality

---

## Core Combat Systems & Resource Mechanics

1. **60 Hz Input Engine & SOCD Cleaning**
   - Polls Keyboard and Gamepad at 60 Hz with Left+Right = Neutral (`5`) and Down+Up = Up (`8`) SOCD cleaning.
   - Features a 6-frame button buffer, motion leniency windows, **Negative Edge** (button release triggers specials/supers), and charge storage with 10-frame release leniency.
2. **3-Stock Super Meter (0–300)**
   - Gained on whiff, hit, block, parries, and damage taken.
   - **EX Specials (50 Meter / 0.5 Stock)**: Performed with any two punches (`PP`) or two kicks (`KK`). Faster startup, enhanced hitstun/damage, knockdown/launch properties, or projectile invulnerability.
   - **Super Art — Level 1 (`236236 + P`, 100 Meter / 1 Stock)**: Cinematic freeze cut-in followed by a high-damage multi-hit hyper attack.
   - **Ultimate Overload (`236236 + PP`, 300 Meter / 3 Stocks, requires `≤ 35% HP`)**: Desperation cinematic protocol with full startup invincibility and massive comeback damage.
3. **Defensive Mechanics**
   - **Cyber Parry (`MP + MK` in neutral)**: 10 active parry frames (`frames 1–10`). Absorbs any incoming strike or projectile with zero damage, grants **+45 Super Meter**, freezes the attacker for 16 frames while recovering in 4 frames (`+12f` punish window). Whiffing has 17 recovery frames.
   - **Advancing Guard / Pushblock (`Two Punches` during blockstun, costs 25 Meter)**: Emits a kinetic barrier that pushes the attacker far back to reset neutral.
   - **Guard Cancel Counter (`6 + HP + HK` during blockstun, costs 100 Meter)**: Invincible armored blowback strike that breaks relentless corner pressure.
   - **Throw Tech (`LP + LK` within 7 frames of being grabbed)**: Breaks normal throws and resets both fighters to neutral.
   - **Quick Rise & Air Tech**: Press Down or any attack button within 10 frames of a soft knockdown for a fast technical wakeup (`QUICK RISE`), or press any button in mid-air after juggled hitstun expires (`AIR TECH`).
4. **Offensive Mechanic — Tempest Overdrive (`HP + HK`, requires ≥ 150 Meter)**
   - Emits an invincible shockwave burst (`frames 1–12`) that blasts nearby opponents away and activates **Tempest Overdrive** for 360 frames (6 seconds):
     - **+15% attack damage** and increased chip damage.
     - **Expanded cancel routes**: any normal or command normal can cancel into other normals, specials, or supers on hit/block.
     - **White life regeneration**: rapidly recovers trailing white health.
     - **Risk/Trade-off**: consumes 150 meter immediately and reduces meter gain by 75% while active.
5. **Combo Scaling, Juggle Limit & Stun Gauge**
   - Each subsequent hit in a combo scales damage (`100% → 90% → 80% → ...` down to a `20%` minimum floor; Supers/Ultimates have a `45%` floor).
   - Airborne juggle hits accumulate `jugglePoints` against each move's `juggleLimit` (`10` for normals/specials, `20` for EX/Supers) to prevent infinite loops.
   - Filling the opponent's **Stun Gauge** triggers a `STUNNED!` dizzy state on wakeup/recovery.

---

## Roster & Full Move Lists

*(Numpad notation assuming fighter faces right: `2`=Down, `3`=Down-Forward, `6`=Forward, `4`=Back, `1`=Down-Back, `8`=Up)*

### 1. HAYATE — *"The Neon Ronin"* (Balanced All-Rounder)
- **Vitality**: `1000 HP` | **Stun**: `1000` | **Archetype**: Balanced Shoto / Space Control & Anti-Air
- **Normals**: Standing/Crouching/Jumping `LP`, `MP`, `HP`, `LK`, `MK`, `HK`
- **Command Normal**: ** Helm Splitter** (`6 + MP` — 16f startup overhead slash that hits crouching opponents)
- **Throws**: **Seismic Shoulder Throw** (`LP + LK`), **Reverse Vortex Throw** (`4 + LP + LK`, swaps sides)
- **Specials**:
  - **Arc Shuriken** (`236 + P` [L/M/H/EX]): Hurls an ionized plasma shuriken across the arena (`EX` fires a high-speed 2-hit shuriken).
  - **Rising Raijin** (`623 + P` [L/M/H/EX]): Invincible ascending plasma-blade uppercut anti-air.
  - **Tempest Cyclone** (`214 + K` [L/M/H/EX]): Advancing spinning cyber-heel kick that projectiles pass under during mid-frames.
- **Super Art (100 Meter)**: **Ion Storm Barrage** (`236236 + P`)
- **Ultimate Art (300 Meter, ≤35% HP)**: **Kusanagi Zero Protocol** (`236236 + PP`)

### 2. MAGNUS — *"The Iron Juggernaut"* (Heavy Grappler)
- **Vitality**: `1075 HP` | **Stun**: `1150` | **Archetype**: Heavy Grappler / Super Armor & Command Throws
- **Normals**: Standing/Crouching/Jumping `LP`, `MP`, `HP`, `LK`, `MK`, `HK`
- **Command Normal**: **Tectonic Hammer** (`6 + HP` — 18f overhead double-fisted slam)
- **Throws**: **Hydraulic Backbreaker** (`LP + LK`), **Suplex Transfer** (`4 + LP + LK`, swaps sides)
- **Specials**:
  - **Giga Driver** (`360 / HCF + P` [L/M/H/EX]): Unblockable cyber-piledriver command grab (`190–230` raw damage).
  - **Titan Juggernaut** (`236 + P` [L/M/H/EX]): Armored advancing shoulder ram (`1–2` hits of super armor starting frame 3).
  - **Seismic Tremor** (`214 + K` [L/M/H/EX]): Slams the arena floor, sending a low-hitting shockwave tremor.
- **Super Art (100 Meter)**: **Megaton Extinction** (`236236 + P`)
- **Ultimate Art (300 Meter, ≤35% HP)**: **Orbital Reactor Drop** (`236236 + PP`)

### 3. SABLE — *"The Phantom Viper"* (Fast Rushdown)
- **Vitality**: `960 HP` | **Stun**: `950` | **Archetype**: High-Speed Rushdown / Double Jump, Air Dash & Cross-Ups
- **Mobility**: **Double Jump** (in air) & **Air Dash** (`66` or `44` in mid-air)
- **Normals**: Standing/Crouching/Jumping `LP`, `MP`, `HP`, `LK`, `MK`, `HK`
- **Command Normal**: **Mirage Heel Drop** (`6 + MK` — 15f fast overhead kick)
- **Throws**: **Neck Scissor Takedown** (`LP + LK`), **Phantom Slip Throw** (`4 + LP + LK`, swaps sides)
- **Specials**:
  - **Viper Twin-Fang** (`236 + P` [L/M/H/EX]): Lunging twin vibro-dagger blitz with high corner carry.
  - **Phantom Blink** (`214 + K` [L/M/H/EX]): Optical-camo teleport strike (`M/H/EX` warp directly behind the opponent for left/right cross-ups!).
  - **Nightfall Crescent** (`236 + K` [L/M/H/EX], Ground or Air): High-speed diagonal divekick/crescent slash.
- **Super Art (100 Meter)**: **Mirage Dance** (`236236 + P`)
- **Ultimate Art (300 Meter, ≤35% HP)**: **Phantom Eclipse** (`236236 + PP`)

### 4. WARDEN — *"The Aegis Enforcer"* (Charge / Zoner)
- **Vitality**: `980 HP` | **Stun**: `1000` | **Archetype**: Charge Zoner / Long-Range Baton Normals & Multi-Speed Beams
- **Normals**: Standing/Crouching/Jumping `LP`, `MP`, `HP`, `LK`, `MK`, `HK`
- **Command Normal**: **Aegis Stun Gavel** (`6 + MP` — 17f electrified baton overhead)
- **Throws**: **Suppression Chokehold** (`LP + LK`), **Riot Toss** (`4 + LP + LK`, swaps sides)
- **Specials**:
  - **Rail Pulse** (`[4]6 + P` Charge Back 36f → Forward + Punch [L/M/H/EX]): Fires a variable-speed electromagnetic rail beam.
  - **Aegis Crescent** (`[2]8 + K` Charge Down 36f → Up + Kick [L/M/H/EX]): Invincible rising vertical shock-arc anti-air.
  - **Volt Tackle** (`214 + K` [L/M/H/EX]): Low-profiling electrified riot-shield slide (hits low).
- **Super Art (100 Meter)**: **Orbital Rail Cannon** (`236236 + P`)
- **Ultimate Art (300 Meter, ≤35% HP)**: **Judgment Satellite** (`236236 + PP`)

---

## Architecture Overview

```text
src/
├── core/
│   ├── types.ts          # Serializable state interfaces, MoveDef, CharacterDef, Box schemas
│   └── simulation.ts     # Deterministic 60Hz fixed-timestep combat engine & state hashing
├── input/
│   ├── inputBuffer.ts    # SOCD cleaner, 60Hz ring buffer, QCF/QCB/DP/HCF/HCB/360/Charge parser
│   └── inputManager.ts   # Keyboard, Gamepad API polling, & persistent keybind remapping
├── data/
│   ├── characters.ts     # Data-driven definitions for Hayate, Magnus, Sable, Warden & 12 Trials
│   ├── stages.ts         # Data-driven stage definitions (Rooftop, Back-Alley, Cyber Shrine)
│   └── strings.ts        # Centralized English UI/UX strings
├── ai/
│   └── cpuController.ts  # Archetype-driven AI (Easy/Medium/Hard) feeding standard RawInputFrame
├── render/
│   ├── fighterRenderer.ts# Articulated procedural cyberpunk fighters, weapons, portraits & hitboxes
│   └── stageRenderer.ts  # Multi-layer parallax stages, holograms, crowds, wet floor & rain
├── vfx/
│   └── vfxManager.ts     # Pre-allocated object pool (260 sparks/rings), speed lines & Super Cut-In
├── audio/
│   └── soundEngine.ts    # 100% Web Audio API synthesizer for SFX & 136–142 BPM cyberpunk music
├── ui/
│   ├── hudRenderer.ts    # Health/white-life bars, 3-stock meter, stun, combo popups, training HUD
│   ├── moveListModal.ts  # Interactive Command Archive with motion badges & frame data table
│   └── settingsManager.ts# Persistent audio, visual, accessibility & HUD configuration
└── scenes/
    └── gameApp.ts        # Fixed-timestep loop, scene state machine, Training recorder & Replay
```

---

## Verified Quality Gates & Results

### 1. Headless Balance Report (`balance-report.json`)
- **Total CPU-vs-CPU Matches Simulated**: `560` matches (`2,218,158` frames at `37,564` sim FPS)
- **Crashes / Softlocks**: `0 crashes`, `0 softlocks`
- **Average Match Duration**: `66.02s` (`3,961` frames)
- **Overall Win Rates (Target: 40%–60%)**:
  - **HAYATE**: `51.0%` (`107W - 103L`)
  - **MAGNUS**: `55.7%` (`117W - 93L`)
  - **SABLE**: `42.9%` (`90W - 120L`)
  - **WARDEN**: `50.5%` (`106W - 104L`)

### 2. Unit & E2E Tests
- **Vitest Unit Suite (`npm test`)**: `8/8 passed` (SOCD, QCF/DP/HCB/360/DQCF, Charge & Negative Edge, Startup/Active/Recovery execution, Strike/Block/Throw/Tech, Combo Scaling, Meter/Parry, Determinism state hash).
- **Playwright E2E Suite (`npm run test:e2e`)**: `1/1 passed` (Full keyboard navigation across Title, Main Menu, Move List, Settings, Character Select, Stage Select, Versus Splash, Match, Special Move execution, HUD verification, and Round Finish with `0` console errors).

### 3. 60-Second Performance Benchmark (`bench-results.json`)
- **Duration**: `60.03s` (`3,597` frames rendered)
- **Average FPS**: `59.61 FPS` (`16.776 ms` average frame time)
- **1% Low FPS**: `48.45 FPS` (`17.183 ms` p99 frame time)
- **Simulation + Canvas 2D Render CPU Time**: `1.296 ms` per frame
- **Heap Memory Usage**: `5.28 MB` start → `5.28 MB` end (`0 MB` net growth, zero GC leaks via pre-allocated VFX object pools)

### 4. Production Bundle (`npm run build`)
- **Output**: `dist/index.html` (`1.29 kB`) + `dist/assets/index-*.js` (`193.28 kB` raw / `53.76 kB` gzipped), built in `0.86s` with zero external dependencies.

### Known Limitations
- Local multiplayer and CPU modes run in a single browser window; online netcode is not included, though the simulation state (`serializeMatchState` / `deserializeMatchState` / `computeStateHash`) is 100% deterministic and rollback-ready.
- Browsers require an initial user gesture (keypress or click on the Title/Boot screen) before unlocking the Web Audio API context.
