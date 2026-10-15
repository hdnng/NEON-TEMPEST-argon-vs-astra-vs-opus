import "./ui/style.css";
import "./ui/refinements.css";
import { Renderer } from "./render/renderer";
import {
  Devices,
  DEFAULT_KEYS,
  DEFAULT_PAD,
  type Bindings,
} from "./input/devices";
import { Synth } from "./audio/synth";
import { CHARACTERS } from "./characters/data";
import { STAGES } from "./render/stages";
import {
  IDS,
  NEUTRAL,
  BUTTONS,
  bit,
  type FighterId,
  type RawInput,
  type SimState,
  type Rules,
} from "./core/types";
import { createMatch, step, serialize, restore, startMove } from "./core/sim";
import { createBrain, cpu, type Brain } from "./ai/cpu";
import { trialsFor } from "./scenes/trials";
import { EN as T } from "./ui/strings";
import { hash } from "./utils/math";

type Scene =
  | "boot"
  | "title"
  | "menu"
  | "character"
  | "stage"
  | "versus"
  | "match"
  | "pause"
  | "results"
  | "settings"
  | "moves"
  | "howto";
interface Settings {
  master: number;
  music: number;
  sfx: number;
  shake: boolean;
  flashes: boolean;
  colorblind: boolean;
  hud: boolean;
  inputs: boolean;
  scale: number;
  difficulty: number;
  keys: Bindings;
  pad: Record<string, number>;
}
interface Replay {
  version: 1;
  a: FighterId;
  b: FighterId;
  seed: number;
  stage: number;
  rules: Partial<Rules>;
  inputs: number[][];
  hash: string;
}
const initialSettings: Settings = {
  master: 0.65,
  music: 0.45,
  sfx: 0.75,
  shake: true,
  flashes: true,
  colorblind: false,
  hud: true,
  inputs: false,
  scale: 1,
  difficulty: 1,
  keys: { ...DEFAULT_KEYS },
  pad: { ...DEFAULT_PAD },
};
const el = (id: string) => document.getElementById(id)!;
const prettyKey = (key: string) =>
  key
    .replace("Key", "")
    .replace("Digit", "")
    .replace("Arrow", "")
    .replace("Numpad", "Num ")
    .replace("BracketLeft", "[")
    .replace("ShiftLeft", "L Shift");
class Game {
  canvas = el("game") as HTMLCanvasElement;
  ui = el("ui");
  renderer = new Renderer(this.canvas);
  devices = new Devices();
  audio = new Synth();
  scene: Scene = "boot";
  previous: Scene = "menu";
  settings: Settings = { ...initialSettings };
  state: SimState | null = null;
  selected: [FighterId, FighterId] = ["hayate", "magnus"];
  stage = 0;
  mode: Rules["mode"] = "arcade";
  selectPlayer = 0;
  arcadeFight = 0;
  ladder: FighterId[] = [];
  brains: [Brain, Brain] = [createBrain(1), createBrain(2)];
  cpuBoth = false;
  last = 0;
  accumulator = 0;
  time = 0;
  frameTimes: number[] = [];
  dropped = 0;
  recording: Replay | null = null;
  lastReplay: Replay | null = null;
  replayIndex = 0;
  replaying = false;
  dummyRecording: RawInput[] = [];
  recordingDummy = false;
  dummyPlayback = false;
  dummyIndex = 0;
  trial = 0;
  trialStep = 0;
  trialDone = false;
  moveCharacter: FighterId = "hayate";
  lastUi = 0;
  sceneToken = 0;
  noticeTimer: ReturnType<typeof setTimeout> | null = null;
  padLast = 0;
  padPrev = false;
  padFaceHeld = false;
  padCapture: string | null = null;
  padCaptureReady = false;
  elapsed = 0;
  returnFromPanel: Scene = "menu";
  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem("nt-settings") ?? "null");
      if (saved)
        this.settings = {
          ...initialSettings,
          ...saved,
          keys: { ...DEFAULT_KEYS, ...saved.keys },
          pad: { ...DEFAULT_PAD, ...saved.pad },
        };
      const replay = JSON.parse(localStorage.getItem("nt-replay") ?? "null");
      if (
        replay?.version === 1 &&
        IDS.includes(replay.a) &&
        IDS.includes(replay.b) &&
        Array.isArray(replay.inputs)
      )
        this.lastReplay = replay;
    } catch {
      localStorage.removeItem("nt-settings");
    }
    this.applySettings();
    this.fit();
    window.addEventListener("resize", () => this.fit());
    document.addEventListener("keydown", (e) => this.key(e));
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.scene === "match") this.pause();
      if (document.hidden) this.audio.pause();
      else if (this.scene !== "pause") this.audio.resume();
      this.accumulator = 0;
      this.last = performance.now();
    });
    window.addEventListener("pagehide", () => this.audio.dispose());
    this.show("boot");
    setTimeout(() => {
      if (this.scene === "boot") this.show("title");
    }, 900);
    requestAnimationFrame((t) => this.loop(t));
  }
  fit() {
    const scale = Math.min(innerWidth / 1280, innerHeight / 720),
      a = el("app");
    a.style.transform = `scale(${scale})`;
    a.style.left = `${(innerWidth - 1280 * scale) / 2}px`;
    a.style.top = `${(innerHeight - 720 * scale) / 2}px`;
  }
  applySettings() {
    Object.assign(this.renderer.settings, {
      shake: this.settings.shake,
      flashes: this.settings.flashes,
      colorblind: this.settings.colorblind,
      hud: this.settings.hud,
      inputs: this.settings.inputs,
      scale: this.settings.scale,
    });
    this.devices.bindings = this.settings.keys;
    this.devices.padBindings = this.settings.pad;
    this.audio.setVolumes(
      this.settings.master,
      this.settings.music,
      this.settings.sfx,
    );
    this.renderer.resize();
  }
  save() {
    this.applySettings();
    try {
      localStorage.setItem("nt-settings", JSON.stringify(this.settings));
    } catch {
      this.notify("Settings storage is unavailable in this browser.");
    }
  }
  async unlock() {
    await this.audio.unlock();
  }
  top(right = T.season) {
    return `<div class="topbar"><span class="brand-small">NEON / TEMPEST</span><span class="online">${right}</span></div>`;
  }
  bottom(hint = "NAVIGATE", right = T.version) {
    return `<div class="bottom-bar"><span><span class="key">↑ ↓</span> ${hint} <span class="key">ENTER</span> CONFIRM <span class="key">ESC</span> BACK</span><span>${right}</span></div>`;
  }
  btn(label: string, action: string, cls = "outline-button") {
    return `<button class="${cls}" data-action="${action}">${label}</button>`;
  }
  show(scene: Scene) {
    this.scene = scene;
    this.sceneToken++;
    const root = (content: string, cls = "") =>
      `<section class="screen ${cls}" data-scene="${scene}">${content}</section>`;
    if (scene === "boot")
      this.ui.innerHTML = root(
        `<div><div class="boot-logo">N / T</div><div class="boot-line"></div><p>${T.boot}</p></div>`,
        "boot",
      );
    if (scene === "title")
      this.ui.innerHTML = root(
        `${this.top()}<div class="title-block"><div class="eyebrow">AN ORIGINAL FIGHTING EXPERIENCE</div><h1 class="hero-title"><span>NEON</span><span>TEMPEST</span></h1><div class="subtitle">${T.edition}</div><p class="tagline">Beneath the city. Beyond the limit.<br>The underground is calling.</p><button class="start" data-action="menu"><span>${T.pressStart}</span></button></div><div class="vertical">雨 / THE RAIN NEVER STOPS / 35.0116° N 135.7681° E</div><div class="hero-stamp"><b>01—04</b>FOUR FIGHTERS. ONE STORM.</div><div class="bottom-bar"><span>PROCEDURAL ART & SOUND / CRAFTED IN CODE</span><span>KEYBOARD + CONTROLLER</span></div>`,
      );
    if (scene === "menu") {
      this.audio.setTheme(-1);
      this.ui.innerHTML = root(
        `${this.top()}<div class="menu-heading"><div class="eyebrow">THE CITY IS STILL AWAKE</div><h1>${T.menuTitle}</h1><p>${T.menuSubtitle}</p></div><nav class="menu-list">${[
          [T.arcade, "mode:arcade"],
          [T.versus, "mode:versus"],
          [T.training, "mode:training"],
          [T.trials, "mode:trials"],
          [T.replay, "replay"],
        ]
          .map(
            ([label, action], i) =>
              `<button class="menu-item" data-action="${action}"><span class="num">0${i + 1}</span><strong>${label}</strong><span class="arrow">↗</span></button>`,
          )
          .join(
            "",
          )}</nav><div class="menu-secondary">${this.btn(T.moves, "moves", "text-button")}${this.btn(T.settings, "settings", "text-button")}${this.btn(T.howto, "howto", "text-button")}</div><div class="feature-note"><small>FIGHTER SPOTLIGHT / 01</small><strong>HAYATE</strong><p>Wind at his back.<br>A whole city on his shoulders.</p></div>${this.bottom()}`,
      );
    }
    if (scene === "character") this.characterUI(root);
    if (scene === "stage") {
      this.ui.innerHTML = root(
        `${this.top("LOCATION SELECT / NEO-KYOTO")}<div class="page-title"><h1>${T.stage}</h1><p>THREE DISTRICTS. THE SAME RESTLESS CITY.</p></div>${this.btn("← " + T.back, "back", "back")}<div class="stage-grid">${STAGES.map((s, i) => `<button class="stage-card" data-action="stage:${i}"><div class="stage-image"><canvas data-stage="${i}" width="600" height="350"></canvas><span class="stage-index">${s.label}</span></div><div class="stage-copy"><small>${s.subtitle}</small><h2>${s.name}</h2><p>${s.description}</p></div></button>`).join("")}</div><div class="stage-footer"><span>${this.selected.map((id) => CHARACTERS[id].name).join(" / VS / ")}</span><span>RAIN / NEON / RESONANCE</span></div>${this.bottom()}`,
      );
      this.ui
        .querySelectorAll<HTMLCanvasElement>("[data-stage]")
        .forEach((canvas) => {
          const i = Number(canvas.dataset.stage),
            c = canvas.getContext("2d")!;
          c.scale(600 / 1280, 350 / 720);
          this.renderer.art.draw(c, i, 2, 0);
        });
    }
    if (scene === "versus") {
      this.ui.innerHTML = root(
        `${this.top(`FIGHT ${this.mode === "arcade" ? this.arcadeFight + 1 : "01"} / ${this.mode.toUpperCase()}`)}<div class="vs-mark">VS</div><div class="vs-info">${STAGES[this.stage].name}<br>BEST OF THREE / 99 SECONDS</div><div class="vs-names"><span>${CHARACTERS[this.selected[0]].name}</span><span>${CHARACTERS[this.selected[1]].name}</span></div><div class="story-strip">${this.mode === "arcade" ? CHARACTERS[this.selected[0]].bio : STAGES[this.stage].description}</div><div class="loading-line"></div><div class="bottom-bar"><span>ESTABLISHING RESONANCE</span><span>${T.controlsHint}</span></div>`,
        "versus-screen",
      );
      const token = this.sceneToken;
      setTimeout(() => {
        if (this.sceneToken === token) this.startMatch();
      }, 2300);
    }
    if (scene === "match") this.matchUI();
    if (scene === "pause") {
      this.ui.innerHTML = `<div class="dim"></div><section class="pause-panel" data-scene="pause"><div class="eyebrow">TAKE A BREATH</div><h1>${T.pause}</h1>${[
        [T.resume, "resume"],
        [T.moves, "moves"],
        [T.settings, "settings"],
        [
          this.mode === "training" || this.mode === "trials"
            ? T.reset
            : T.rematch,
          "rematch",
        ],
        [T.quit, "menu"],
      ]
        .map(
          ([label, action], i) =>
            `<button class="menu-item" data-action="${action}"><span class="num">0${i + 1}</span><strong>${label}</strong><span class="arrow">→</span></button>`,
        )
        .join("")}</section>`;
    }
    if (scene === "settings") this.settingsUI(root);
    if (scene === "moves") this.movesUI(root);
    if (scene === "results") this.resultsUI(root);
    if (scene === "howto")
      this.ui.innerHTML = root(
        `${this.top()}<div class="page-title"><h1>${T.systemTitle}</h1><p>READ THE RHYTHM. MAKE YOUR OPENING COUNT.</p></div>${this.btn("← " + T.back, "back", "back")}<div class="panel-content howto-grid">${[
          [
            "01 / MOVE & STRIKE",
            "W A S D moves Player 1. J K L are light, medium, heavy punches; U I O are kicks. Hold away to block, down-away to block low. Double-tap a direction to dash. Sable can double jump and air dash.",
          ],
          [
            "02 / FIND YOUR FLOW",
            "Light normals chain into light or medium normals. Confirm a hit or block, then cancel into a special during its cancel window. Specials cancel into supers. Link attacks after recovery. Air juggles have a six-point limit.",
          ],
          [
            "03 / SPEND RESONANCE",
            "Gain meter by attacking, hitting, blocking, and taking damage. Three stocks maximum. Hold Shift with a special for EX (one stock). P activates Super Art (one stock). [ activates Ultimate below 30% life, once per round.",
          ],
          [
            "04 / DEFEND WITH INTENT",
            "Space opens a seven-frame parry window with a 38-frame cooldown. Press Shift while blocking to pushblock for half a stock. H or J + U throws; respond with a throw to tech a normal throw. Down or light kick speeds up your rise.",
          ],
          [
            "05 / OVERDRIVE",
            "N spends one stock for seven seconds of overdrive: move 12% faster and deal 18% more damage, but take 12% more damage. Repeated hits scale damage. Breaking the stun gauge leaves a fighter briefly dizzy.",
          ],
          [
            "06 / YOUR SECOND CHALLENGER",
            "Player 2 moves with arrow keys; numpad 1–3 punches, 4–6 kicks, 0 throws, + activates EX, decimal parries, 7 supers, 9 ultimates, and 8 overdrives. All keys and controller attack buttons can be remapped in Settings.",
          ],
        ]
          .map(
            ([h, p]) =>
              `<article class="howto-card"><h3>${h}</h3><p>${p}</p></article>`,
          )
          .join("")}</div>${this.bottom("READ")}`,
        "panel-screen",
      );
    this.bind();
    if (scene !== "match")
      requestAnimationFrame(() => {
        const focus = this.ui.querySelector<HTMLButtonElement>(
          scene === "stage"
            ? ".stage-card"
            : scene === "character"
              ? ".fighter-card"
              : ".menu-item, .start, .solid-button, .back, button",
        );
        focus?.focus({ preventScroll: true });
      });
    el("a11y").textContent = scene === "match" ? "Fight!" : scene;
  }
  characterUI(root: (s: string, c?: string) => string) {
    this.ui.innerHTML = root(
      `${this.top("ROSTER / 04 ORIGINAL FIGHTERS")}<div class="page-title"><h1>${T.select}</h1><p>${T.selectSub}</p></div>${this.btn("← " + T.back, "back", "back")}${this.selected
        .map((id, i) => {
          const c = CHARACTERS[id];
          return `<div class="character-name ${i ? "right" : "left"}" style="--fighter:${c.color}"><small>PLAYER ${i + 1} / ${c.archetype}</small><h2>${c.name}</h2><p>${c.title}</p><div class="stat-panel">${["SPEED", "POWER", "VITALITY", "TECH"].map((s, n) => `<div class="stat"><span>${s}</span>${Array.from({ length: 5 }, (_, k) => `<i class="${k < c.stats[n] ? "on" : ""}"></i>`).join("")}</div>`).join("")}</div></div>`;
        })
        .join(
          "",
        )}<div class="select-center"><div class="selection-status">${this.selectPlayer === 0 ? "P1 / SELECT FIGHTER" : this.mode === "versus" ? "P2 / SELECT FIGHTER" : "SELECT YOUR OPPONENT"}</div><div class="versus-label">VS</div>${this.btn(this.selectPlayer === 0 ? "CONFIRM P1 →" : "CONFIRM & CONTINUE →", "lock", "solid-button")}</div><div class="roster">${IDS.map((id, i) => `<button class="fighter-card ${this.selected[0] === id ? "p1" : ""} ${this.selected[1] === id ? "p2" : ""}" style="--fighter:${CHARACTERS[id].color}" data-action="fighter:${id}" aria-label="Select ${CHARACTERS[id].name}"><small>0${i + 1}</small><b>${["風", "鉄", "影", "衛"][i]}</b><strong>${CHARACTERS[id].name}</strong></button>`).join("")}</div>${this.bottom("CHOOSE FIGHTER", "A / D SELECT P1 · ← / → SELECT P2 · ENTER LOCK")}`,
    );
  }
  matchUI() {
    const training = this.mode === "training",
      trials = this.mode === "trials";
    this.ui.innerHTML = `<section class="match-ui" data-scene="match"><div class="match-buttons">${this.btn("ESC / PAUSE", "pause")}${this.replaying ? '<span class="key">REPLAY</span>' : ""}</div><span id="hud-state" role="status" aria-live="off" style="position:absolute;left:-9999px"></span>${training ? `<div class="training-panel"><h3>TRAINING LAB <span id="record-status"></span></h3><p id="frame-info">Move: neutral · Startup / Active / Recovery</p><p id="training-stats">DAMAGE 0 · COMBO 0 · ADVANTAGE —</p><div class="training-options">${this.btn("HEALTH ∞", "toggle-health")}${this.btn("METER ∞", "toggle-meter")}${this.btn("DUMMY: " + (this.state?.rules.dummy ?? "stand").toUpperCase(), "dummy")}${this.btn("HITBOXES / F1", "boxes")}${this.btn("INPUTS / F2", "inputs")}${this.btn("RECORD / F3", "record")}${this.btn("PLAY / F4", "playback")}${this.btn("RESET / R", "reset")}</div></div>` : ""}${trials ? '<div class="trial-panel" id="trial-panel"></div>' : ""}<div class="touch-controls"><div class="touch-dpad">${[7, 8, 9, 4, 5, 6, 1, 2, 3].map((d) => `<button data-touch="${d}">${["", "↙", "↓", "↘", "←", "·", "→", "↖", "↑", "↗"][d]}</button>`).join("")}</div><div class="touch-attacks">${["LP", "MP", "HP", "LK", "MK", "HK"].map((b) => `<button data-touch="${b}">${b}</button>`).join("")}</div></div></section>`;
    if (trials) this.trialUI();
    this.bindTouch();
  }
  trialUI() {
    const panel = document.getElementById("trial-panel");
    if (!panel) return;
    const trial = trialsFor(this.selected[0])[this.trial],
      moves = CHARACTERS[this.selected[0]].moves;
    panel.innerHTML = `<h3>${this.trialDone ? "✓ " + T.trialClear : trial.name}</h3><div class="trial-steps">${trial.steps.map((m, i) => `<span class="trial-step ${i < this.trialStep ? "done" : i === this.trialStep ? "current" : ""}">${moves[m].input}</span>${i < trial.steps.length - 1 ? "<span>→</span>" : ""}`).join("")}</div><p>${trial.description}</p><div class="trial-footer"><button data-action="trial-prev">← PREVIOUS</button><span class="eyebrow">${this.trial + 1} / 3</span><button data-action="trial-next">NEXT TRIAL →</button></div>`;
    this.bind(panel);
  }
  settingsUI(root: (s: string, c?: string) => string) {
    const toggles: [keyof Settings, string][] = [
      ["shake", T.shake],
      ["flashes", T.flashes],
      ["colorblind", T.colorblind],
      ["hud", T.hud],
      ["inputs", T.inputs],
    ];
    this.ui.innerHTML = root(
      `${this.top("SYSTEM / CONFIGURATION")}<div class="page-title"><h1>${T.settings}</h1><p>MAKE THE UNDERGROUND YOUR OWN.</p></div>${this.btn("← " + T.back, "back", "back")}<div class="panel-content settings-grid"><div><p class="section-label">AUDIO / PRESENTATION</p>${(["master", "music", "sfx"] as const).map((key) => `<label class="setting">${T[key]}<input type="range" min="0" max="100" value="${this.settings[key] * 100}" data-volume="${key}" aria-label="${T[key]}"/></label>`).join("")}${toggles.map(([key, label]) => `<div class="setting"><span>${label}</span>${this.btn(this.settings[key] ? T.on : T.off, "setting:" + key)}</div>`).join("")}<div class="setting"><span>${T.resolution}</span>${this.btn(Math.round(this.settings.scale * 100) + "%", "scale")}</div><div class="setting"><span>${T.difficulty}</span>${this.btn([T.easy, T.normal, T.hard][this.settings.difficulty], "difficulty")}</div><div class="setting"><span>Display</span>${this.btn(T.fullscreen, "fullscreen")}</div><h3>GAMEPAD / STANDARD MAPPING</h3><p style="font:11px monospace;color:#839fb1">D-pad / left stick moves. Remap actions below.</p><div class="binding-grid">${BUTTONS.map((b) => `<div class="setting keybind"><span>${b}</span>${this.btn(this.padCapture === b ? T.padWait : "BUTTON " + this.settings.pad[b], "padbind:" + b)}</div>`).join("")}</div></div><div><p class="section-label">KEYBOARD / SELECT TO REBIND</p><div class="tabbar">${this.btn("PLAYER 1", "keys:1")}${this.btn("PLAYER 2", "keys:2")}${this.btn("RESTORE DEFAULTS", "defaults")}</div><div class="binding-grid" id="key-bindings">${this.bindingHtml(1)}</div><p style="font:10px monospace;color:#829bad;margin-top:20px">${T.rebind}<br><br>Opposite directions resolve to neutral (SOCD).<br>Press Esc to cancel a rebind.</p></div></div>${this.bottom("CONFIGURE")}`,
      "panel-screen",
    );
  }
  bindingHtml(player: number) {
    return Object.entries(this.settings.keys)
      .filter(([k]) => k.startsWith("p" + player))
      .map(
        ([k, v]) =>
          `<div class="setting keybind"><span>${k.split("_")[1].toUpperCase()}</span>${this.btn(prettyKey(v), "keybind:" + k)}</div>`,
      )
      .join("");
  }
  movesUI(root: (s: string, c?: string) => string) {
    const ch = CHARACTERS[this.moveCharacter],
      moves = Object.values(ch.moves);
    this.ui.innerHTML = root(
      `${this.top("ARCHIVE / FIGHTER REFERENCE")}<div class="page-title"><h1>${T.moves}</h1><p>${T.moveHint}</p></div>${this.btn("← " + T.back, "back", "back")}<div class="panel-content"><div class="tabbar">${IDS.map((id) => this.btn(CHARACTERS[id].name, "archive:" + id, id === ch.id ? "active" : "")).join("")}</div><p style="font:11px monospace;color:#a4baca">${ch.archetype} · ${ch.hp} HP · ${ch.tagline} &nbsp; | &nbsp; EX: motion + two same-type buttons or Shift + attack · 100 meter</p><table class="move-table"><thead><tr><th>MOVE</th><th>INPUT</th><th>PROPERTIES</th><th>START / ACTIVE / RECOVERY · DMG</th></tr></thead><tbody>${moves.map((m) => `<tr><td>${m.name}</td><td>${m.input.replace("/ O", "/ P").replace("/ U", "/ [")}</td><td>${m.description}</td><td>${m.startup} / ${m.active} / ${m.recovery} · ${m.damage}</td></tr>`).join("")}</tbody></table></div>${this.bottom("BROWSE")}`,
      "panel-screen",
    );
  }
  resultsUI(root: (s: string, c?: string) => string) {
    const s = this.state!,
      winner = s.winner,
      win = winner === 0,
      ending = win && this.mode === "arcade" && this.arcadeFight === 3;
    this.audio.setTheme(3);
    this.ui.innerHTML = root(
      `${this.top("MATCH COMPLETE / RESONANCE ARCHIVED")}<div class="result-panel"><div class="eyebrow">${this.replaying ? T.replayComplete : T.results}</div><h1>${ending ? T.endTitle : winner < 0 ? T.draw : win ? T.victory : T.defeat}</h1><h2>${winner < 0 ? "TWO STORMS. ONE HORIZON." : CHARACTERS[s.fighters[Math.max(0, winner)].id].name + " TAKES THE NIGHT."}</h2><p>${ending ? CHARACTERS[this.selected[0]].ending : win ? CHARACTERS[this.selected[0]].tagline : "The rain keeps falling. Your next chance is waiting."}</p><div class="result-stats"><div><small>${T.rounds}</small><b>${s.fighters[0].wins} — ${s.fighters[1].wins}</b></div><div><small>${T.damage}</small><b>${s.fighters[0].damageDealt}</b></div><div><small>${T.matchLength}</small><b>${Math.floor(s.frame / 3600)}:${String(Math.floor(s.frame / 60) % 60).padStart(2, "0")}</b></div></div><div class="result-actions">${this.btn(!this.replaying && win && this.mode === "arcade" && !ending ? T.continue : T.rematch, !this.replaying && win && this.mode === "arcade" && !ending ? "arcade-next" : "rematch", "solid-button")}${this.btn(T.quit, "menu")}</div></div>${this.bottom("SELECT", "REPLAY SAVED LOCALLY / NO NETWORK REQUIRED")}`,
    );
  }
  bind(container: HTMLElement = this.ui) {
    container
      .querySelectorAll<HTMLButtonElement>("[data-action]")
      .forEach((b) => {
        b.onclick = () => {
          void this.unlock();
          this.audio.play("confirm");
          this.action(b.dataset.action!, b);
        };
        b.onmouseenter = () => {
          b.focus({ preventScroll: true });
          this.audio.play("nav");
        };
      });
    container.querySelectorAll<HTMLInputElement>("[data-volume]").forEach(
      (v) =>
        (v.oninput = () => {
          this.settings[v.dataset.volume as "master"] = Number(v.value) / 100;
          this.save();
        }),
    );
  }
  bindTouch() {
    this.ui.querySelectorAll<HTMLButtonElement>("[data-touch]").forEach((b) => {
      const k = b.dataset.touch!,
        set = (down: boolean) => {
          if (/^\d$/.test(k)) {
            const d = down ? Number(k) : 5;
            this.devices.virtual.x = [1, 4, 7].includes(d)
              ? -1
              : [3, 6, 9].includes(d)
                ? 1
                : 0;
            this.devices.virtual.y = d < 4 ? 1 : d > 6 ? -1 : 0;
          } else {
            if (down) this.devices.virtual.buttons |= bit(k as "LP");
            else this.devices.virtual.buttons &= ~bit(k as "LP");
          }
        };
      b.onpointerdown = (e) => {
        e.preventDefault();
        b.setPointerCapture(e.pointerId);
        set(true);
      };
      b.onpointerup = () => set(false);
      b.onpointercancel = () => set(false);
    });
  }
  action(action: string, button?: HTMLButtonElement) {
    const [name, value] = action.split(":");
    switch (name) {
      case "menu":
        this.replaying = false;
        this.cpuBoth = false;
        this.recordingDummy = false;
        this.dummyPlayback = false;
        this.audio.resume();
        this.show("menu");
        break;
      case "mode":
        this.mode = value as Rules["mode"];
        this.selectPlayer = 0;
        this.arcadeFight = 0;
        this.trial = 0;
        this.replaying = false;
        this.show("character");
        break;
      case "fighter":
        this.selected[this.selectPlayer] = value as FighterId;
        this.show("character");
        break;
      case "lock":
        if (this.selectPlayer === 0) {
          this.selectPlayer = 1;
          if (this.mode === "arcade") {
            this.ladder = IDS.filter((id) => id !== this.selected[0]).concat(
              this.selected[0],
            );
            this.selected[1] = this.ladder[0];
            this.show("stage");
          } else this.show("character");
        } else this.show("stage");
        break;
      case "stage":
        this.stage = Number(value);
        this.show("versus");
        break;
      case "pause":
        this.pause();
        break;
      case "resume":
        this.audio.resume();
        this.accumulator = 0;
        this.devices.keys.clear();
        this.show("match");
        break;
      case "settings":
      case "moves":
      case "howto":
        this.returnFromPanel = this.scene === "pause" ? "pause" : "menu";
        if (name === "moves") this.moveCharacter = this.selected[0];
        this.show(name);
        break;
      case "back":
        this.back();
        break;
      case "rematch":
        if (this.replaying) this.playReplay();
        else this.startMatch();
        break;
      case "arcade-next":
        this.arcadeFight++;
        this.selected[1] = this.ladder[this.arcadeFight];
        this.stage = this.arcadeFight % 3;
        this.show("versus");
        break;
      case "replay":
        this.playReplay();
        break;
      case "archive":
        this.moveCharacter = value as FighterId;
        this.show("moves");
        break;
      case "setting":
        (this.settings as unknown as Record<string, unknown>)[value] =
          !this.settings[value as keyof Settings];
        this.save();
        if (button)
          button.textContent = this.settings[value as keyof Settings]
            ? T.on
            : T.off;
        break;
      case "scale":
        this.settings.scale =
          this.settings.scale === 1
            ? 0.75
            : this.settings.scale === 0.75
              ? 0.5
              : 1;
        this.save();
        button!.textContent = Math.round(this.settings.scale * 100) + "%";
        break;
      case "difficulty":
        this.settings.difficulty = (this.settings.difficulty + 1) % 3;
        this.save();
        button!.textContent = [T.easy, T.normal, T.hard][
          this.settings.difficulty
        ];
        break;
      case "fullscreen":
        if (!document.fullscreenElement)
          void document.documentElement
            .requestFullscreen()
            .catch(() =>
              this.notify("Fullscreen is unavailable in this window."),
            );
        else void document.exitFullscreen();
        break;
      case "keys":
        el("key-bindings").innerHTML = this.bindingHtml(Number(value));
        this.bind(el("key-bindings"));
        break;
      case "keybind":
        button!.textContent = T.bindWait;
        this.devices.capture = (code) => {
          if (code !== "Escape") {
            const previous = this.settings.keys[value];
            for (const k of Object.keys(this.settings.keys))
              if (k !== value && this.settings.keys[k] === code)
                this.settings.keys[k] = previous;
            this.settings.keys[value] = code;
            this.save();
          }
          el("key-bindings").innerHTML = this.bindingHtml(
            value.startsWith("p1") ? 1 : 2,
          );
          this.bind(el("key-bindings"));
        };
        break;
      case "padbind":
        this.padCapture = value;
        this.padCaptureReady = false;
        button!.textContent = T.padWait;
        break;
      case "defaults":
        this.settings.keys = { ...DEFAULT_KEYS };
        this.settings.pad = { ...DEFAULT_PAD };
        this.save();
        this.show("settings");
        break;
      case "boxes":
        this.renderer.settings.hitboxes = !this.renderer.settings.hitboxes;
        break;
      case "inputs":
        this.settings.inputs = !this.settings.inputs;
        this.save();
        break;
      case "toggle-health":
        this.state!.rules.infiniteHealth = !this.state!.rules.infiniteHealth;
        button?.classList.toggle("active", this.state!.rules.infiniteHealth);
        break;
      case "toggle-meter":
        this.state!.rules.infiniteMeter = !this.state!.rules.infiniteMeter;
        button?.classList.toggle("active", this.state!.rules.infiniteMeter);
        break;
      case "dummy": {
        const types: Rules["dummy"][] = [
          "stand",
          "crouch",
          "block",
          "jump",
          "cpu",
        ];
        this.state!.rules.dummy =
          types[(types.indexOf(this.state!.rules.dummy) + 1) % types.length];
        if (button)
          button.textContent =
            "DUMMY: " + this.state!.rules.dummy.toUpperCase();
        break;
      }
      case "record":
        this.recordingDummy = !this.recordingDummy;
        this.dummyPlayback = false;
        if (this.recordingDummy) {
          this.dummyRecording = [];
          this.notify(
            "Recording dummy: your Player 1 controls now move Player 2. F3 to stop.",
          );
        } else
          this.notify(
            `${this.dummyRecording.length} frames recorded. F4 to play.`,
          );
        break;
      case "playback":
        if (!this.dummyRecording.length) {
          this.notify("Record a dummy sequence with F3 first.");
          break;
        }
        this.recordingDummy = false;
        this.dummyPlayback = !this.dummyPlayback;
        this.dummyIndex = 0;
        this.notify(
          this.dummyPlayback ? "Dummy playback looping." : "Playback stopped.",
        );
        break;
      case "reset":
        this.resetPositions();
        break;
      case "trial-next":
        this.trial = (this.trial + 1) % 3;
        this.resetPositions();
        break;
      case "trial-prev":
        this.trial = (this.trial + 2) % 3;
        this.resetPositions();
        break;
    }
  }
  back() {
    if (this.scene === "pause") this.action("resume");
    else if (["settings", "moves", "howto"].includes(this.scene))
      this.show(this.returnFromPanel);
    else if (this.scene === "stage") this.show("character");
    else if (this.scene === "character") this.show("menu");
    else if (this.scene === "menu") this.show("title");
    else if (this.scene === "match") this.pause();
    else if (this.scene === "versus") this.show("stage");
    else this.show("menu");
  }
  key(e: KeyboardEvent) {
    if (this.devices.capture || (e.defaultPrevented && this.scene === "match"))
      return;
    if (e.repeat && e.code === "Escape") return;
    void this.unlock();
    if (e.code === "Escape") {
      e.preventDefault();
      if (this.padCapture) {
        this.padCapture = null;
        this.show("settings");
        return;
      }
      this.back();
      return;
    }
    if (this.scene === "boot") {
      this.show("title");
      return;
    }
    if (this.scene === "title" && (e.code === "Enter" || e.code === "Space")) {
      e.preventDefault();
      this.show("menu");
      return;
    }
    if (this.scene === "match") {
      if (this.replaying && e.code === "Space") {
        this.pause();
        return;
      }
      if (this.mode === "training" || this.mode === "trials") {
        const actions: Record<string, string> = {
          F1: "boxes",
          F2: "inputs",
          F3: "record",
          F4: "playback",
          KeyR: "reset",
        };
        if (actions[e.code]) {
          e.preventDefault();
          this.action(actions[e.code]);
        }
      }
      return;
    }
    if (this.scene === "character") {
      if (["KeyA", "KeyD", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
        const p = e.code.startsWith("Arrow") ? 1 : 0;
        this.selectPlayer = p;
        const n = IDS.indexOf(this.selected[p]),
          d = e.code === "KeyA" || e.code === "ArrowLeft" ? -1 : 1;
        this.selected[p] = IDS[(n + d + 4) % 4];
        this.audio.play("nav");
        this.show("character");
        return;
      }
      if (e.code === "Enter") {
        e.preventDefault();
        this.action("lock");
        return;
      }
    }
    if (
      (this.scene === "moves" || this.scene === "howto") &&
      ["ArrowDown", "ArrowUp", "PageDown", "PageUp"].includes(e.code)
    ) {
      e.preventDefault();
      this.ui.querySelector(".panel-content")?.scrollBy({
        top: ["ArrowDown", "PageDown"].includes(e.code) ? 130 : -130,
        behavior: "smooth",
      });
      return;
    }
    if (
      ["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Tab"].includes(
        e.code,
      ) &&
      !(document.activeElement instanceof HTMLInputElement)
    ) {
      e.preventDefault();
      const buttons = [
          ...this.ui.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled),input",
          ),
        ].filter((b) => b.offsetParent !== null),
        idx = buttons.indexOf(document.activeElement as HTMLButtonElement),
        d = ["ArrowUp", "ArrowLeft"].includes(e.code) || e.shiftKey ? -1 : 1;
      buttons[(idx + d + buttons.length) % buttons.length]?.focus();
      this.audio.play("nav");
    }
  }
  pause() {
    if (this.scene !== "match") return;
    this.audio.pause();
    this.devices.keys.clear();
    this.show("pause");
  }
  startMatch() {
    this.replaying = false;
    const seed = 73421 + this.arcadeFight * 183;
    this.state = createMatch(...this.selected, seed, {
      mode: this.mode,
      infiniteHealth: this.mode === "training" || this.mode === "trials",
      infiniteMeter: this.mode === "training" || this.mode === "trials",
    });
    this.brains = [
      createBrain(seed + 3, this.settings.difficulty),
      createBrain(seed + 7, this.settings.difficulty),
    ];
    this.recording = {
      version: 1,
      a: this.selected[0],
      b: this.selected[1],
      seed,
      stage: this.stage,
      rules: { ...this.state.rules },
      inputs: [],
      hash: "",
    };
    this.recordingDummy = false;
    this.dummyPlayback = false;
    this.renderer.particles.clear();
    this.renderer.cutin = 0;
    this.renderer.announcementLife = 0;
    this.trialStep = 0;
    this.trialDone = false;
    this.elapsed = 0;
    this.accumulator = 0;
    this.devices.keys.clear();
    if (this.mode === "trials") {
      this.state.fighters[1].x = this.state.fighters[0].x + 63;
      this.state.fighters.forEach((p) => (p.meter = 300));
    }
    this.audio.setTheme(this.stage);
    this.audio.resume();
    this.show("match");
  }
  resetPositions() {
    const rules = this.state?.rules;
    this.startMatch();
    if (rules) this.state!.rules = { ...rules };
    this.state!.phase = "fight";
    this.state!.fighters[0].x = 630;
    this.state!.fighters[1].x = this.mode === "trials" ? 693 : 850;
    this.trialUI();
  }
  playReplay() {
    if (!this.lastReplay) {
      this.notify(T.noReplay);
      return;
    }
    const r = this.lastReplay;
    this.selected = [r.a, r.b];
    this.stage = r.stage;
    this.mode = r.rules.mode ?? "versus";
    this.state = createMatch(r.a, r.b, r.seed, r.rules);
    this.replaying = true;
    this.replayIndex = 0;
    this.recording = null;
    this.accumulator = 0;
    this.renderer.cutin = 0;
    this.renderer.particles.clear();
    this.audio.setTheme(this.stage);
    this.audio.resume();
    this.show("match");
  }
  simTick() {
    if (!this.state) return;
    const s = this.state;
    let inputs: [RawInput, RawInput];
    if (this.replaying) {
      const r = this.lastReplay!.inputs[this.replayIndex++];
      if (!r) {
        this.show("results");
        return;
      }
      inputs = [
        { x: r[0], y: r[1], buttons: r[2] },
        { x: r[3], y: r[4], buttons: r[5] },
      ];
    } else {
      let a = this.cpuBoth ? cpu(s, 0, this.brains[0]) : this.devices.read(0),
        b: RawInput = NEUTRAL;
      if (this.cpuBoth || this.mode === "arcade") b = cpu(s, 1, this.brains[1]);
      else if (this.mode === "versus") b = this.devices.read(1);
      else if (this.recordingDummy) {
        b = a;
        a = NEUTRAL;
        if (this.dummyRecording.length < 1800)
          this.dummyRecording.push({ ...b });
        else this.recordingDummy = false;
      } else if (this.dummyPlayback && this.dummyRecording.length)
        b = this.dummyRecording[this.dummyIndex++ % this.dummyRecording.length];
      else {
        switch (s.rules.dummy) {
          case "crouch":
            b = { x: 0, y: 1, buttons: 0 };
            break;
          case "block":
            b = { x: -s.fighters[1].facing, y: 1, buttons: 0 };
            break;
          case "jump":
            b = { x: 0, y: s.frame % 45 === 0 ? -1 : 0, buttons: 0 };
            break;
          case "cpu":
            b = cpu(s, 1, this.brains[1]);
            break;
        }
      }
      inputs = [a, b];
      if (this.recording && this.mode !== "training" && this.mode !== "trials")
        this.recording.inputs.push([a.x, a.y, a.buttons, b.x, b.y, b.buttons]);
    }
    step(s, inputs);
    for (const event of s.events) {
      this.renderer.handle(event);
      this.audio.play(event.type, event.strength);
      if (
        this.mode === "trials" &&
        !this.trialDone &&
        (event.type === "hit" || event.type === "throw") &&
        event.player === 1
      ) {
        const wanted = trialsFor(this.selected[0])[this.trial].steps,
          move = s.fighters[0].lastMove;
        if (move === wanted[this.trialStep]) {
          this.trialStep++;
          if (this.trialStep === wanted.length) {
            this.trialDone = true;
            this.audio.play("confirm");
            this.renderer.announce("TRIAL COMPLETE", 100);
          }
          this.trialUI();
        }
      }
    }
    if (
      this.mode === "trials" &&
      !this.trialDone &&
      this.trialStep > 0 &&
      s.fighters[1].stunFrames === 0 &&
      !s.fighters[1].downFrames &&
      s.fighters[0].move === null
    ) {
      this.trialStep = 0;
      this.trialUI();
    }
    if (s.phase === "complete") {
      if (this.recording && !this.replaying) {
        this.recording.hash = hash(s);
        this.lastReplay = this.recording;
        try {
          localStorage.setItem("nt-replay", JSON.stringify(this.lastReplay));
        } catch {
          this.notify(
            "Replay retained for this session; browser storage is full.",
          );
        }
      }
      this.show("results");
    }
  }
  updateUI() {
    if (this.scene !== "match" || !this.state) return;
    const s = this.state,
      p = s.fighters[0],
      d = s.fighters[1],
      m = p.move ? CHARACTERS[p.id].moves[p.move] : null,
      hud = document.getElementById("hud-state");
    if (hud) {
      hud.textContent = `${p.id} ${p.hp} HP / ${d.id} ${d.hp} HP · ${Math.ceil(s.timer / 60)} seconds`;
      hud.dataset.p1hp = String(p.hp);
      hud.dataset.p2hp = String(d.hp);
      hud.dataset.frame = String(s.frame);
      hud.dataset.move = p.lastMove;
    }
    const info = document.getElementById("frame-info");
    if (info)
      info.textContent = m
        ? `${m.name} · ${m.startup} / ${m.active} / ${m.recovery} · FRAME ${p.moveFrame}`
        : `LAST: ${p.lastMove ? CHARACTERS[p.id].moves[p.lastMove].name : "NEUTRAL"} · START / ACTIVE / RECOVERY`;
    const stats = document.getElementById("training-stats");
    if (stats) {
      const lm = p.lastMove ? CHARACTERS[p.id].moves[p.lastMove] : null;
      stats.textContent = `DAMAGE ${p.comboDamage} · HITS ${p.combo} · ON BLOCK ${lm ? lm.blockstun - lm.recovery - lm.active + 1 : "—"} · METER ${Math.floor(p.meter)}`;
    }
    const rec = document.getElementById("record-status");
    if (rec) {
      rec.textContent = this.recordingDummy
        ? `● REC ${this.dummyRecording.length}F`
        : this.dummyPlayback
          ? "▶ PLAYBACK"
          : "";
      rec.className = this.recordingDummy ? "record-dot" : "";
    }
  }
  pollMenuPad(now: number) {
    const pad = navigator.getGamepads?.()[0];
    if (!pad) return;
    if (this.padCapture) {
      const i = pad.buttons.findIndex((b) => b.pressed);
      if (i < 0) this.padCaptureReady = true;
      if (i >= 0 && this.padCaptureReady) {
        const previous = this.settings.pad[this.padCapture];
        for (const key of Object.keys(this.settings.pad))
          if (key !== this.padCapture && this.settings.pad[key] === i)
            this.settings.pad[key] = previous;
        this.settings.pad[this.padCapture] = i;
        this.padCapture = null;
        this.save();
        this.show("settings");
      }
      return;
    }
    const start = pad.buttons[9]?.pressed && !pad.buttons[8]?.pressed;
    if (this.scene === "match") {
      if (start && !this.padPrev) this.pause();
      this.padPrev = start;
      this.padFaceHeld = !!(
        pad.buttons[0]?.pressed ||
        pad.buttons[1]?.pressed ||
        start
      );
      return;
    }
    this.padPrev = start;
    const face = !!(
        pad.buttons[0]?.pressed ||
        pad.buttons[1]?.pressed ||
        start
      ),
      edge = face && !this.padFaceHeld;
    this.padFaceHeld = face;
    if (now - this.padLast < 180 && !edge) return;
    let key = "";
    if (pad.buttons[12]?.pressed || pad.axes[1] < -0.5) key = "ArrowUp";
    else if (pad.buttons[13]?.pressed || pad.axes[1] > 0.5) key = "ArrowDown";
    else if (pad.buttons[14]?.pressed || pad.axes[0] < -0.5) key = "ArrowLeft";
    else if (pad.buttons[15]?.pressed || pad.axes[0] > 0.5) key = "ArrowRight";
    else if ((pad.buttons[0]?.pressed || start) && edge) key = "Enter";
    else if (pad.buttons[1]?.pressed && edge) key = "Escape";
    if (key) {
      this.padLast = now;
      if (this.scene === "character" && this.selectPlayer === 0) {
        if (key === "ArrowLeft") key = "KeyA";
        if (key === "ArrowRight") key = "KeyD";
      }
      if (
        key === "Enter" &&
        this.scene !== "title" &&
        this.scene !== "character" &&
        this.scene !== "boot"
      )
        (document.activeElement as HTMLButtonElement)?.click();
      else this.key(new KeyboardEvent("keydown", { code: key }));
    }
  }
  loop(now: number) {
    const rawElapsed = this.last ? (now - this.last) / 1000 : 1 / 60;
    const elapsed = Math.min(0.1, rawElapsed);
    this.last = now;
    this.time += elapsed;
    this.pollMenuPad(now);
    if (this.scene === "match" && !document.hidden) {
      // Count time discarded by the safety cap as well as catch-up overflow.
      if (rawElapsed > 0.1) this.dropped++;
      this.frameTimes.push(elapsed * 1000);
      if (this.frameTimes.length > 7200) this.frameTimes.shift();
      this.accumulator += elapsed;
      let ticks = 0;
      while (
        this.accumulator >= 1 / 60 &&
        ticks < 6 &&
        this.scene === "match"
      ) {
        this.simTick();
        this.accumulator -= 1 / 60;
        ticks++;
      }
      if (ticks === 6 && this.accumulator > 1 / 60) {
        this.accumulator = 0;
        this.dropped++;
      }
    } else this.accumulator = 0;
    el("app").classList.toggle(
      "cinematic",
      this.renderer.cutin > 0 && this.scene === "match",
    );
    if (
      this.scene !== "boot" &&
      (!["pause", "settings", "moves", "howto"].includes(this.scene) ||
        !this.renderer.hasFrame)
    )
      this.renderer.render(
        this.time,
        elapsed,
        this.scene,
        this.stage,
        this.state,
        this.selected,
      );
    if (now - this.lastUi > 80) {
      this.updateUI();
      this.lastUi = now;
    }
    requestAnimationFrame((t) => this.loop(t));
  }
  notify(text: string) {
    document.querySelector(".notification")?.remove();
    const n = document.createElement("div");
    n.className = "notification";
    n.textContent = text;
    this.ui.append(n);
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => n.remove(), 4200);
  }
}
const game = new Game();
// Read-only state access and explicit harness controls keep browser QA reproducible.
Object.assign(window, {
  __NEON__: {
    get game() {
      return game;
    },
    get state() {
      return game.state;
    },
    get scene() {
      return game.scene;
    },
    get frameTimes() {
      return game.frameTimes;
    },
    hash: () => (game.state ? hash(game.state) : ""),
    start: (
      a: FighterId = "hayate",
      b: FighterId = "magnus",
      mode: Rules["mode"] = "training",
      stage = 0,
    ) => {
      game.selected = [a, b];
      game.mode = mode;
      game.stage = stage;
      game.startMatch();
    },
    snapshot: () => (game.state ? serialize(game.state) : ""),
    restore: (json: string) => {
      game.state = restore(json);
      game.show("match");
    },
    super: () => {
      if (game.state) {
        game.state.fighters[0].meter = 300;
        startMove(game.state, 0, CHARACTERS[game.selected[0]].moves.super);
        for (const e of game.state.events) game.renderer.handle(e);
      }
    },
    show: (scene: Scene) => game.show(scene),
  },
});
