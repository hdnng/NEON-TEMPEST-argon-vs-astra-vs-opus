/**
 * Navigation between screens. Centralized so scenes don't import each other directly.
 */
import { app, type MatchSetup } from '../core/app';
import { settings } from '../core/settings';
import { CHARACTER_LIST } from '../data/characters';
import { STAGE_INFOS } from '../render/stages/index';
import { CharSelectScene, type SelectMode } from './charSelect';
import { CreditsScene } from './credits';
import { MainMenuScene } from './mainMenu';
import { MatchScene } from './match/matchScene';
import { ModeSelectScene } from './modeSelect';
import { MoveListScene } from './moveListScene';
import { ResultsScene } from './results';
import { SettingsScene } from './settingsScene';
import { StageSelectScene } from './stageSelect';
import { StoryScene } from './story';
import { TitleScene } from './title';
import { VersusScene } from './versus';

export function toTitle(): void { app().go(new TitleScene(), 'fade', 40); }
export function toMainMenu(): void { app().arcade = null; app().go(new MainMenuScene(), 'wipe'); }
export function toModeSelect(): void { app().go(new ModeSelectScene(), 'wipe'); }
export function toCharSelect(mode: SelectMode): void { app().go(new CharSelectScene(mode), 'wipe'); }
export function toMoveList(): void { app().go(new MoveListScene(), 'slice'); }
export function toSettings(): void { app().go(new SettingsScene(), 'slice'); }
export function toCredits(): void { app().go(new CreditsScene(), 'fade'); }

export function toStageSelect(setup: MatchSetup): void { app().go(new StageSelectScene(setup), 'slice'); }

export function toVersus(setup: MatchSetup): void { app().go(new VersusScene(setup), 'wipe', 44); }

export function startMatch(setup: MatchSetup): void {
  const scene = new MatchScene(setup, {
    onMatchEnd: (m) => {
      if (setup.mode === 'attract') { toTitle(); return; }
      if (setup.mode === 'replay') { toMainMenu(); return; }
      app().go(new ResultsScene(m), 'wipe');
    },
  });
  app().go(scene, setup.mode === 'training' || setup.mode === 'trials' ? 'wipe' : 'fade', 40);
}

export function startReplay(): void {
  const r = app().lastReplay;
  if (!r) return;
  const setup: MatchSetup = {
    mode: 'replay', chars: r.config.chars, palettes: r.config.palettes, stage: r.config.stage, cpu: [false, false], difficulty: 1,
  };
  const scene = new MatchScene(setup, { onMatchEnd: () => toMainMenu() }, r);
  app().go(scene, 'fade', 40);
}

/** CPU-vs-CPU demo after idling on the title. */
export function startAttract(): void {
  const r = (n: number) => Math.floor(Math.random() * n);
  const a = CHARACTER_LIST[r(CHARACTER_LIST.length)].id;
  let b = CHARACTER_LIST[r(CHARACTER_LIST.length)].id;
  if (b === a && CHARACTER_LIST.length > 1) b = CHARACTER_LIST[(CHARACTER_LIST.findIndex((c) => c.id === a) + 1) % CHARACTER_LIST.length].id;
  startMatch({ mode: 'attract', chars: [a, b], palettes: [0, a === b ? 1 : 0], stage: STAGE_INFOS[r(STAGE_INFOS.length)].id, cpu: [true, true], difficulty: 2 });
}

// ------------------------------------------------------------------------------- arcade

export const ARCADE_LENGTH = 4;

/** Builds the 4-fight ladder: three other fighters in a seeded order, then the rival (or mirror). */
export function startArcade(charId: string, palette: number, difficulty: number): void {
  const me = CHARACTER_LIST.find((c) => c.id === charId)!;
  const others = CHARACTER_LIST.filter((c) => c.id !== charId).map((c) => c.id);
  const rival = me.arcade.rival;
  const ladder = others.filter((id) => id !== rival).sort(() => Math.random() - 0.5);
  ladder.push(rival && rival !== charId ? rival : charId);
  while (ladder.length < ARCADE_LENGTH) ladder.unshift(charId);
  app().arcade = { char: charId, palette, ladder: ladder.slice(0, ARCADE_LENGTH), index: 0, continues: 0, difficulty };
  app().go(new StoryScene('intro', charId), 'fade', 40);
}

export function arcadeNextFight(): void {
  const ar = app().arcade;
  if (!ar) { toMainMenu(); return; }
  if (ar.index >= ar.ladder.length) {
    app().go(new StoryScene('ending', ar.char), 'fade', 50);
    return;
  }
  const opp = ar.ladder[ar.index];
  const stage = STAGE_INFOS[ar.index % STAGE_INFOS.length].id;
  const diff = Math.min(3, Math.max(0, ar.difficulty + (ar.index >= 2 ? 1 : 0) - (ar.index === 0 ? 1 : 0)));
  toVersus({
    mode: 'arcade', chars: [ar.char, opp], palettes: [ar.palette, opp === ar.char ? 1 - ar.palette : 0], stage,
    cpu: [false, true], difficulty: diff, arcadeIndex: ar.index,
  });
}

export function defaultDifficulty(): number { return settings.difficulty; }
