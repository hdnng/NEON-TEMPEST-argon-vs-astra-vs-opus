import {
  writeFileSync,
  readFileSync,
  existsSync,
  readdirSync,
  statSync,
} from "node:fs";
import { gzipSync } from "node:zlib";
import { CHARACTERS } from "../src/characters/data";
import { IDS } from "../src/core/types";
const balance = existsSync("balance-results.json")
  ? JSON.parse(readFileSync("balance-results.json", "utf8"))
  : null;
const bench = existsSync("bench-results.json")
  ? JSON.parse(readFileSync("bench-results.json", "utf8"))
  : null;
const unit = JSON.parse(readFileSync("unit-results.json", "utf8"));
const e2e = JSON.parse(readFileSync("e2e-results.json", "utf8"));
let bundle = 0,
  gzip = 0;
if (existsSync("dist/assets"))
  for (const file of readdirSync("dist/assets")) {
    const bytes = readFileSync("dist/assets/" + file);
    bundle += bytes.length;
    gzip += gzipSync(bytes).length;
  }
let md = `# NEON TEMPEST

An original, entirely procedural 2D fighting game set in rain-soaked Neo-Kyoto. Four distinct fighters, three animated stages, a deterministic 60 Hz combat core, original synthesized music, and a complete local play experience. No downloaded artwork, fonts, music, sound samples, or runtime libraries.

## Run with one command

`;
md +=
  "```sh\nnpm start\n```\n\nRequires Node.js 22.12+ or 24 LTS and npm (verified on Node 24.16.0). The launcher automatically runs `npm ci` when dependencies are absent, then starts Vite. Open the local URL printed in the terminal (normally http://localhost:5173). First installation needs network access; the game does not contact external services.\n\n";
md += `## Modes and navigation

- **Arcade:** four fights, including a final mirror challenge, with a fighter introduction and original ending. Losing permits a rematch.
- **Local versus:** two control mappings on one keyboard, two standard Gamepad API controllers, or a combination.
- **Training lab:** infinite health/meter switches, five dummy behaviors, live frame data, box overlays, inputs, position reset, and 30-second dummy recording with looping playback. Recording redirects Player 1 controls to Player 2. The dummy recording is session-local.
- **Combo trials:** three connected combo challenges for every fighter. Steps advance only on landed hits in the prescribed order. All twelve are also executed by the unit suite.
- **Last-match replay:** records every 60 Hz input pair and the match setup. Playback reconstructs the simulation from the original seed. The latest completed Arcade/Versus fight is saved in browser storage. A full browser replay hash is tested.

Menus: arrows / Tab to navigate, Enter to confirm, Esc to return. During fighter selection, A/D moves P1's cursor, left/right arrows move P2's cursor, and Enter locks the active selection. Mouse, touchscreen menu buttons, and gamepads are supported. In the move archive, up/down or Page Up/Down scrolls; left/right/Tab selects controls.

## Controls

| Action | Player 1 | Player 2 | Standard gamepad |
|---|---|---|---|
| Move / crouch / jump | W A S D | Arrow keys | D-pad / left stick |
| Light / medium / heavy punch | J / K / L | Numpad 1 / 2 / 3 | South / West / RB |
| Light / medium / heavy kick | U / I / O | Numpad 4 / 5 / 6 | East / North / RT |
| Forward / backward throw | H, or J + U; hold away for back throw | Numpad 0 | LB |
| EX modifier / pushblock | Left Shift | Numpad + | LT |
| Super Art | P, or double-QCF + punch | Numpad 7 | Left-stick click, or three punches |
| Ultimate | [ (left bracket), or double-QCF + kick | Numpad 9 | Right-stick click |
| Parry | Space | Numpad decimal | Back / Select |
| Overdrive | N | Numpad 8 | Back + Start |
| Pause | Esc | Esc | Start |

Keyboard and gamepad attack bindings are remappable in Settings. Duplicate keyboard bindings swap their previous keys, rather than silently creating a conflict. Keyboard ghosting depends on the physical keyboard; gamepads avoid that limitation. Opposite directions cancel to neutral. The standard browser gamepad mapping varies by controller; use the remapper where necessary. Touch devices have an on-screen eight-direction pad and six attack buttons for basic play.

Training: **F1** boxes, **F2** input history, **F3** start/stop dummy recording, **F4** loop playback, **R** reset. Training tools temporarily disappear during the super cinematic.

## Combat rules

Simulation is fixed at **60 Hz**, independent of requestAnimationFrame. There is a six-frame button buffer, motion leniency, negative-edge specials, and a three-frame jump startup. Buffered buttons retain their original direction and EX modifier through hitstop. Direction histories are relative to facing; collision checks use the actual source position for cross-up blocking.

- **Motions:** QCF ↓↘→, QCB ↓↙←, DP →↓↘ (or →↓→), HCF ←↙↓↘→, HCB →↘↓↙←, 360 (four cardinal directions in clockwise or counterclockwise order within 32 frames), and charge motions. Hold back/down for **40 frames**, then release forward/up within **8 frames**. Charge can be held down-back. Inputs shown below face right; mirror when facing left.
- **Attacks:** all fighters have 18 standing/crouching/jumping normals, two command normals, two directional throws, three specials with L/M/H/EX variants, one Super Art, and one Ultimate: **36 data-defined moves per fighter, 144 total**.
- **Cancel rules:** light normals chain into light/medium normals; normal/command attacks cancel into specials; confirmed normals and specials cancel into supers or ultimates. These require contact and the move's cancel window. Link combos use hitstun remaining after recovery. No automatic combo execution is given to human players.
- **Blocking:** hold away for mid/high guard, down-away for low guard; overheads defeat crouch guard. Airborne fighters cannot block. Chip cannot take the final point of life.
- **Throws:** normal throws are techable with a throw input buffered within the six-frame window at contact. Magnus's command grabs are untechable but cannot catch airborne, invincible, or hitstunned opponents. Throws can whiff and be punished.
- **Defense:** parry is active for seven frames with a 38-frame cooldown; success awards 30 meter and briefly stuns the attacker. Pushblock spends 50 meter while guarding to create distance. Down/light kick speeds up grounded wakeup. Wakeup grants 12 invincible frames. Air recovery requires an attack after aerial hitstun ends. Backdash has a short invincible opening.
- **Juggles:** six points maximum per sequence; specials/supers consume larger budgets. Aerial knockdowns can be followed up before landing. Grounded knockdowns cannot be struck.
- **Scaling:** each additional connected hit reduces damage by nine percentage points, with a 25% floor. The next clean opening after recovery starts a fresh combo. Stun damage depletes a separate gauge; zero causes a 150-frame dizzy state. Recovery or a new hit restores the gauge; that hit begins ordinary hitstun rather than restarting the dizzy loop.
- **Resonance meter:** 300 maximum / three 100-point stocks. Starting a meter-free normal, command, throw or special earns one point, including on whiff. Contact, guarding, damage taken and parries earn additional meter. EX and Super Art cost one stock. EX is motion + Shift + attack, or two buttons of the same attack type. Three punches or three kicks act as a Super Art macro.
- **Ultimate:** requires life at or below 30%, once per round, with no additional meter cost.
- **Overdrive:** one stock for 420 frames: +18% damage dealt, +12% movement speed, and +12% incoming damage. A 600-frame reactivation cooldown includes the active duration.
- **Rounds:** best of three with 99-second rounds. Time-over compares remaining life percentages. Equal life or double KO awards one pip to both; equal match scores produce a draw. Perfect wins are announced. Meter carries between rounds; life and stun refill. Hitstop pauses the timer. KO presentation includes slow motion and camera zoom.

## Fighter move lists

Frame columns are **startup / active / recovery**. Damage is the base value before combo scaling and overdrive. The in-game archive displays the same source data. EX always costs 100 meter; listed Super Art costs 100, Ultimate costs zero subject to low-life/once-per-round requirements.

`;
for (const id of IDS) {
  const c = CHARACTERS[id];
  md += `### ${c.name} — ${c.archetype}\n\n${c.bio}\n\nHP ${c.hp}; stun ${c.stun}; walk speed ${c.speed} units/frame. ${id === "sable" ? "Sable has a double jump and one forward air dash per airtime. " : ""}${c.tagline}\n\n| Move | Input | Frames | Damage | Properties |\n|---|---|---|---:|---|\n`;
  for (const m of Object.values(c.moves)) {
    md += `| ${m.name} | ${m.input} | ${m.startup} / ${m.active} / ${m.recovery} | ${m.damage} | ${m.level}${m.knockdown ? ", knockdown" : ""}${m.invuln[0] >= 0 ? `, invincible ${m.invuln[0]}–${m.invuln[1]}` : ""}${m.armor[0] >= 0 ? ", one-hit armor" : ""}${m.projectile ? ", projectile" : ""}${m.teleport ? ", cross-up teleport" : ""} |\n`;
  }
  md += "\n";
}
md += `## Architecture and determinism

- src/core/: serializable simulation types, fixed-tick rules, collision, resources, rounds, and state serialization. No DOM, real-time clocks, audio, or unseeded randomness.
- src/characters/data.ts: roster, data-generated normal sets, specials, per-frame box ranges, cancel windows, invincibility, armor, projectile definitions, and narrative.
- src/input/: SOCD-cleaned polling, relative eight-way directions, buffered press/release edges, motion matching, keyboard/gamepad mappings.
- src/ai/: seeded, character-aware CPU decisions and literal input queues. Easy/Normal/Hard reconsider decisions every 17/11/7 frames; they do not directly trigger moves. They approach, guard, react to projectiles, anti-air, punish recovery, chain/cancel, throw, and spend resources.
- src/render/: cached parallax stage composites, animated rain/hologram/lighting, bounded caches of code-generated articulated fighter frames, camera, HUD, and cinematic cut-ins. Rendering randomness only affects cosmetic particles and audio noise; it never touches combat state.
- src/vfx/: a preallocated 520-particle ring pool. Simulation uses a fixed 32-projectile pool. Inactive slots are reused.
- src/audio/: Web Audio oscillators, envelopes, generated noise, musical sequencer, and per-theme patterns. Nodes disconnect when finished. Audio begins on a user gesture; background tabs suspend it.
- src/ui/ and src/scenes/: design tokens/styles, English strings, mode/trial data and flow. Character and stage copy lives in their data modules.
- src/main.ts: scene orchestration, six-tick maximum catch-up loop, input recording, storage, accessibility status, letterboxing and device-pixel-ratio scaling.

serialize(state) / restore(json) round-trip the complete simulation, including buffered input histories, live projectiles, and event state. hash(state) provides a stable JSON-based FNV-1a regression fingerprint. AI brains are separately serializable plain data; the replay records their produced inputs, so brains are not needed to play it back. This provides replay/rollback foundations; **network transport and online rollback play are not implemented**.

## Verification and measurements

Commands:

    npm test                 # Vitest combat, motion, determinism and all 12 trials
    npm run test:e2e         # Headless Chromium menu, input, HUD, rounds, replay and remapping
    npm run balance          # 512 full CPU matches, reproducible seeded matrix
    npm run screenshots      # 18 reproducible review captures
    npm run bench            # 60 seconds of rendered CPU-vs-CPU, writes bench-results.json
    npm run build            # Typecheck + production bundle


Install Chromium once for browser tools: npx playwright install chromium. Each browser script can start a local Vite server; an already-running npm start is reused. Run browser scripts sequentially if they own their own server. npm run balance can be given MATCHES_PER_PAIR for smaller tuning experiments; its default is 32 × 16 = 512. Normal play has no development-tool or browser-test dependency at runtime.

`;
md += `Unit verification: **${unit.numPassedTests}/${unit.numTotalTests} passing tests**, including all twelve connected trials. Browser verification: **${e2e.stats.expected} passing tests**, **${e2e.stats.unexpected} unexpected failures**, covering keyboard-only menu traversal, real motion inputs, HUD damage, round completion, replay hashes, training, remapping and Gamepad API fixtures. Fresh-directory one-command startup also passed.\n\n`;
if (balance)
  md += `Final balance run: **${balance.matches} matches**, **${balance.crashes} crashes**, **${balance.softlocks} softlocks**, **${balance.totalFrames.toLocaleString()} simulation frames**. Average match **${balance.averageMatchSeconds.toFixed(1)} seconds** of simulation time. Aggregate win rates, excluding mirrors and counting draws as half-wins: ${balance.winRates.map((r: any) => `${r.id.toUpperCase()} ${(r.winRate * 100).toFixed(1)}%`).join(", ")}. See [BALANCE.md](BALANCE.md) and [balance-results.json](balance-results.json) for the complete matrix. These are CPU-policy results, not a claim of solved competitive human balance.\n\n`;
if (bench)
  md += `Rendered benchmark: **${bench.averageFPS.toFixed(2)} FPS average**, **${bench.onePercentLowFPS.toFixed(2)} FPS 1% low**, **${bench.averageFrameTimeMs.toFixed(2)} ms average frame**, over **${bench.durationSeconds.toFixed(2)} seconds**; **${bench.memoryPeakMB.toFixed(1)} MiB peak sampled JS heap**. ${bench.errors.length} browser errors/warnings. Headless Chromium on this specific Windows host, at ${bench.viewport.join(" × ")} / DPR ${bench.devicePixelRatio}; the host's rendering configuration materially affects results. See [bench-results.json](bench-results.json).\n\n`;
md += `Production JS + CSS: **${(bundle / 1024).toFixed(1)} KiB raw / ${(gzip / 1024).toFixed(1)} KiB gzip** (plus the small HTML entry). There are no external art/audio/font payloads.\n\nVisual QA and improvement records are in [QUALITY.md](QUALITY.md). Final captures are in [screenshots/](screenshots/).\n\n## Practical limits\n\nThe game uses stylized procedural vector art and synthesized music. The benchmark uses standard versus rules; an additional unlimited-meter Training stress measurement is saved in bench-stress.json. Occasional missed presentation frames remain, so a strictly locked 60 FPS target has not been achieved on this Intel UHD 620 host.\n\nThere is no online multiplayer, physical gamepad hardware was not available for tactile testing, and human tournament balance remains unproven. The simulation does not implement a production rollback networking layer. Only English is shipped; the UI string/data organization is ready for a translation pass but some explanatory tool text still lives with its screen. Touch controls cover basic fighting; a keyboard or gamepad gives access to every system. Audio is synthesized tones/noise without recorded voice announcers. Browser replay storage holds the latest completed match; clearing local storage removes settings/replays.\n`;
writeFileSync("README.md", md);
