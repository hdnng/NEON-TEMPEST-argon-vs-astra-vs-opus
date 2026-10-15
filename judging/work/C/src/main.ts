/**
 * Entry point. Boots the app, wires the first scene and exposes a small automation API
 * (window.__NT) used by the Playwright end-to-end tests, screenshots and the benchmark.
 *
 * URL parameters (for development and automation):
 *   ?scene=match&mode=cpu|versus|training|trials|attract&p1=hayate&p2=magnus&stage=rooftop&diff=2
 *   ?scene=title|menu|modes|select|stage|versus|movelist|settings
 *   &cpu=both  (CPU controls both fighters)
 */
import { App, setApp, type MatchSetup } from './core/app';
import { CHARACTER_LIST } from './data/characters';
import { BootScene } from './scenes/boot';
import * as flow from './scenes/flow';
import { CharSelectScene } from './scenes/charSelect';
import { MainMenuScene } from './scenes/mainMenu';
import { MatchScene } from './scenes/match/matchScene';
import { ModeSelectScene } from './scenes/modeSelect';
import { MoveListScene } from './scenes/moveListScene';
import { SettingsScene } from './scenes/settingsScene';
import { StageSelectScene } from './scenes/stageSelect';
import { TitleScene } from './scenes/title';
import { VersusScene } from './scenes/versus';
import { hashState } from './sim/hash';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const app = new App(canvas);
setApp(app);
document.getElementById('boot')?.remove();

const q = new URLSearchParams(location.search);

function setupFromQuery(): MatchSetup {
  const ids = CHARACTER_LIST.map((c) => c.id);
  const p1 = ids.includes(q.get('p1') ?? '') ? q.get('p1')! : ids[0];
  const p2 = ids.includes(q.get('p2') ?? '') ? q.get('p2')! : ids[Math.min(1, ids.length - 1)];
  const mode = (q.get('mode') ?? 'cpu') as MatchSetup['mode'];
  const cpuBoth = q.get('cpu') === 'both' || mode === 'attract';
  return {
    mode, chars: [p1, p2], palettes: [0, p1 === p2 ? 1 : 0], stage: q.get('stage') ?? 'rooftop',
    cpu: [cpuBoth, mode === 'cpu' || mode === 'arcade' || cpuBoth], difficulty: Number(q.get('diff') ?? 2),
  };
}

const scene = q.get('scene');
switch (scene) {
  case 'match': app.go(new MatchScene(setupFromQuery(), { onMatchEnd: () => flow.toMainMenu() }), 'none'); break;
  case 'title': app.go(new TitleScene(), 'none'); break;
  case 'menu': app.go(new MainMenuScene(), 'none'); break;
  case 'modes': app.go(new ModeSelectScene(), 'none'); break;
  case 'select': app.go(new CharSelectScene((q.get('mode') ?? 'versus') as never), 'none'); break;
  case 'stage': app.go(new StageSelectScene(setupFromQuery()), 'none'); break;
  case 'versus': app.go(new VersusScene(setupFromQuery()), 'none'); break;
  case 'movelist': app.go(new MoveListScene(), 'none'); break;
  case 'settings': app.go(new SettingsScene(), 'none'); break;
  default: app.go(new BootScene(), 'none');
}
app.start();

/** Automation hooks (tests / screenshots / benchmark). */
declare global {
  interface Window { __NT: unknown }
}
window.__NT = {
  app,
  sceneName: () => app.scenes.current?.id ?? '',
  match: () => (app.scenes.current instanceof MatchScene ? app.scenes.current.s : null),
  matchScene: () => (app.scenes.current instanceof MatchScene ? app.scenes.current : null),
  hash: () => (app.scenes.current instanceof MatchScene ? hashState(app.scenes.current.s) : 0),
  startMatch: (setup: MatchSetup) => flow.startMatch(setup),
  fps: () => app.fps,
  frameTimes: () => app.frameTimes,
  recordFrames: (on: boolean) => { app.recordFrameTimes = on; if (on) app.frameTimes = []; },
  /** Queue raw input bits for a player in the current match (automation). */
  queue: (player: 0 | 1, bits: number[]) => {
    const m = app.scenes.current;
    if (m instanceof MatchScene) m.inputQueue[player].push(...bits);
  },
  setFighter: (i: 0 | 1, v: { hp?: number; meter?: number; x?: number }) => {
    const m = app.scenes.current;
    if (!(m instanceof MatchScene)) return;
    const f = m.s.fighters[i];
    if (v.hp !== undefined) f.hp = v.hp;
    if (v.meter !== undefined) f.meter = v.meter;
    if (v.x !== undefined) f.x = v.x * 100;
  },
  setWins: (a: number, b: number) => {
    const m = app.scenes.current;
    if (m instanceof MatchScene) m.s.wins = [a, b];
  },
  showHitboxes: (on: boolean) => {
    const m = app.scenes.current;
    if (m instanceof MatchScene && m.training) m.training.showBoxes = on;
  },
  hud: () => (app.scenes.current instanceof MatchScene ? app.scenes.current.hud : null),
  /** Simulation speed multiplier (fast-forward for automation). */
  setSpeed: (k: number) => { app.loop.speed = k; },
  arcade: () => app.arcade,
  lastMatchEnd: () => app.lastMatchEnd,
  goto: (name: string) => {
    const scenes: Record<string, () => void> = {
      title: () => flow.toTitle(), menu: () => flow.toMainMenu(), modes: () => flow.toModeSelect(),
      movelist: () => flow.toMoveList(), settings: () => flow.toSettings(), credits: () => flow.toCredits(),
    };
    scenes[name]?.();
  },
};
