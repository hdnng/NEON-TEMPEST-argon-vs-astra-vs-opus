import {
  CpuController,
  DummyBehavior,
  getTrainingDummyInput
} from '../ai/cpuController';
import { SoundEngine } from '../audio/soundEngine';
import {
  cloneMatchState,
  createFighterState,
  createMatchState,
  resetRoundState,
  stepMatch
} from '../core/simulation';
import {
  CharacterId,
  MatchState,
  RawInputFrame,
  StageId
} from '../core/types';
import { CHARACTER_LIST, CHARACTERS } from '../data/characters';
import { SettingsManager } from '../data/settings';
import { STAGE_LIST, STAGES } from '../data/stages';
import { T } from '../data/strings';
import {
  createEmptyInput,
  formatKeyCode,
  InputManager,
  KeyBindings
} from '../input/inputManager';
import { FighterRenderer } from '../render/fighterRenderer';
import { STAGE_FLOOR_SCREEN_Y, StageRenderer } from '../render/stageRenderer';
import { HudRenderer, TrainingHudState, TrialHudState } from '../ui/hudRenderer';
import { MoveListRenderer } from '../ui/moveListModal';
import { VfxManager } from '../vfx/vfxManager';

export type SceneId =
  | 'boot'
  | 'title'
  | 'menu'
  | 'char_select'
  | 'stage_select'
  | 'versus_splash'
  | 'match'
  | 'results'
  | 'arcade_ending'
  | 'movelist'
  | 'settings';

export type GameMode =
  | 'arcade'
  | 'versus_cpu'
  | 'versus_2p'
  | 'training'
  | 'trials'
  | 'replay';

export interface ReplayRecording {
  p1Char: CharacterId;
  p2Char: CharacterId;
  p1Alt: boolean;
  p2Alt: boolean;
  stageId: StageId;
  seed: number;
  roundsToWin: number;
  frames: [RawInputFrame, RawInputFrame][];
}

export class GameApp {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public settings: SettingsManager;
  public input: InputManager;
  public sound: SoundEngine;
  public stageRenderer: StageRenderer;
  public fighterRenderer: FighterRenderer;
  public hudRenderer: HudRenderer;
  public moveListRenderer: MoveListRenderer;
  public vfx: VfxManager;

  public scene: SceneId = 'boot';
  public sceneFrame = 0;
  public transitionAlpha = 0;
  public mode: GameMode = 'arcade';

  // Menu state
  public menuIndex = 0;
  public pauseIndex = 0;
  public isPaused = false;
  public showPauseMoveList = false;
  public moveListScroll = 0;
  public moveListCharIndex = 0;
  public resultsIndex = 0;

  // Settings UI state
  public settingsTab: 'general' | 'p1_keys' | 'p2_keys' = 'general';
  public settingsRowIndex = 0;

  // Character & Stage Select state
  public p1Cursor = 0;
  public p2Cursor = 1;
  public p1Locked = false;
  public p2Locked = false;
  public p1AltColor = false;
  public p2AltColor = false;
  public selectedStageIndex = 0;

  // Arcade Ladder state
  public arcadeStageIndex = 0;
  public arcadeOpponents: CharacterId[] = ['warden', 'sable', 'magnus', 'hayate'];

  // Active Match & Simulation state
  public matchState: MatchState | null = null;
  public prevMatchState: MatchState | null = null;
  public cpu1: CpuController;
  public cpu2: CpuController;
  public isCpuVsCpuDemo = false;

  // Training Mode state
  public training: TrainingHudState = {
    enabled: false,
    infiniteHealth: true,
    infiniteMeter: true,
    noStun: false,
    showHitboxes: true,
    showFrameData: true,
    showInputHistory: true,
    dummyBehavior: 'stand',
    recordingState: 'idle',
    recordedFramesCount: 0
  };
  private dummyRecordedInputs: RawInputFrame[] = [];
  private dummyPlaybackCursor = 0;

  // Combo Trials state
  public activeTrialIndex = 0;
  public trialCompletedStep = 0;
  public trialSuccessTimer = 0;

  // Replay Recording & Playback
  public lastReplay: ReplayRecording | null = null;
  private activeRecording: ReplayRecording | null = null;
  private replayCursor = 0;

  // Fixed-timestep loop state
  private lastTimestamp = 0;
  private accumulator = 0;
  private readonly FIXED_DT = 1000 / 60;
  public fps = 60;
  private frameTimes: number[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not initialize 2D context');
    this.ctx = context;

    this.settings = new SettingsManager();
    this.input = new InputManager();
    this.sound = new SoundEngine(this.settings);
    this.stageRenderer = new StageRenderer();
    this.fighterRenderer = new FighterRenderer();
    this.hudRenderer = new HudRenderer(this.fighterRenderer);
    this.moveListRenderer = new MoveListRenderer();
    this.vfx = new VfxManager();

    this.cpu1 = new CpuController(this.settings.values.cpuDifficulty);
    this.cpu2 = new CpuController(this.settings.values.cpuDifficulty);

    this.setupWindowListeners();
    this.resizeCanvas();
  }

  private setupWindowListeners(): void {
    window.addEventListener('resize', () => this.resizeCanvas());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.scene === 'match' && !this.isPaused && !this.isCpuVsCpuDemo) {
        this.isPaused = true;
      }
    });

    // Mouse support for menu clicks
    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * 1280;
      const my = ((e.clientY - rect.top) / rect.height) * 720;
      this.handleMouseClick(mx, my);
    });
  }

  public resizeCanvas(): void {
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const targetAspect = 16 / 9;
    let drawW = winW;
    let drawH = winW / targetAspect;

    if (drawH > winH) {
      drawH = winH;
      drawW = winH * targetAspect;
    }

    const dpr = Math.min(2, window.devicePixelRatio || 1) * this.settings.values.resolutionScale;
    this.canvas.width = Math.round(1280 * dpr);
    this.canvas.height = Math.round(720 * dpr);
    this.canvas.style.width = `${Math.floor(drawW)}px`;
    this.canvas.style.height = `${Math.floor(drawH)}px`;
  }

  public changeScene(nextScene: SceneId): void {
    this.scene = nextScene;
    this.sceneFrame = 0;
    this.transitionAlpha = 1.0;
    this.input.clearJustPressed();

    if (
      nextScene === 'title' ||
      nextScene === 'menu' ||
      nextScene === 'char_select' ||
      nextScene === 'stage_select' ||
      nextScene === 'movelist' ||
      nextScene === 'settings'
    ) {
      this.sound.playMusic('menu');
    } else if (nextScene === 'results' || nextScene === 'arcade_ending') {
      this.sound.playMusic('victory');
    }
  }

  public start(): void {
    this.lastTimestamp = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(100, now - this.lastTimestamp);
      this.lastTimestamp = now;

      if (dt > 0) {
        this.frameTimes.push(dt);
        if (this.frameTimes.length > 60) this.frameTimes.shift();
        const avgDt =
          this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
        this.fps = Math.round(1000 / Math.max(1, avgDt));
      }

      this.accumulator += dt;
      let steps = 0;
      while (this.accumulator >= this.FIXED_DT && steps < 4) {
        this.fixedUpdate();
        this.accumulator -= this.FIXED_DT;
        steps++;
      }

      const interpAlpha = Math.max(0, Math.min(1, this.accumulator / this.FIXED_DT));
      this.render(interpAlpha);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /**
   * Launches a match with the current character, stage, and mode configuration.
   */
  public launchMatch(opts?: {
    p1Char?: CharacterId;
    p2Char?: CharacterId;
    stageId?: StageId;
    mode?: GameMode;
    skipIntro?: boolean;
    cpuVsCpu?: boolean;
  }): void {
    if (opts?.mode) this.mode = opts.mode;
    this.isCpuVsCpuDemo = opts?.cpuVsCpu ?? false;

    const p1Char = opts?.p1Char ?? CHARACTER_LIST[this.p1Cursor].id;
    let p2Char = opts?.p2Char ?? CHARACTER_LIST[this.p2Cursor].id;

    if (this.mode === 'arcade' && !opts?.p2Char) {
      p2Char = this.arcadeOpponents[this.arcadeStageIndex % this.arcadeOpponents.length];
    }

    const stageId = opts?.stageId ?? STAGE_LIST[this.selectedStageIndex].id;

    this.cpu1.difficulty = this.settings.values.cpuDifficulty;
    this.cpu2.difficulty = this.settings.values.cpuDifficulty;
    this.cpu1.reset();
    this.cpu2.reset();

    const isTrainingOrTrials = this.mode === 'training' || this.mode === 'trials';
    this.training.enabled = this.mode === 'training';

    const seed =
      this.mode === 'replay' && this.lastReplay
        ? this.lastReplay.seed
        : 0x2099cafe ^ (this.arcadeStageIndex * 7919);

    this.matchState = createMatchState({
      p1Char: this.mode === 'replay' && this.lastReplay ? this.lastReplay.p1Char : p1Char,
      p2Char: this.mode === 'replay' && this.lastReplay ? this.lastReplay.p2Char : p2Char,
      stageId: this.mode === 'replay' && this.lastReplay ? this.lastReplay.stageId : stageId,
      seed,
      roundsToWin: 2,
      p1Alt: this.p1AltColor,
      p2Alt:
        p1Char === p2Char && this.p1AltColor === this.p2AltColor
          ? !this.p1AltColor
          : this.p2AltColor,
      skipIntro: opts?.skipIntro ?? isTrainingOrTrials
    });

    if (isTrainingOrTrials) {
      this.matchState.fighters[0].meter = 300;
    }

    this.prevMatchState = cloneMatchState(this.matchState);
    this.vfx.clear();
    this.isPaused = false;
    this.showPauseMoveList = false;
    this.trialCompletedStep = 0;
    this.trialSuccessTimer = 0;

    if (this.mode !== 'replay') {
      this.activeRecording = {
        p1Char: this.matchState.fighters[0].charId,
        p2Char: this.matchState.fighters[1].charId,
        p1Alt: this.matchState.fighters[0].useAltPalette,
        p2Alt: this.matchState.fighters[1].useAltPalette,
        stageId: this.matchState.stageId,
        seed,
        roundsToWin: 2,
        frames: []
      };
    } else {
      this.replayCursor = 0;
    }

    this.sound.playMusic(this.matchState.stageId);
    this.changeScene('match');
  }

  public fixedUpdate(): void {
    this.sceneFrame++;
    if (this.transitionAlpha > 0) {
      this.transitionAlpha = Math.max(0, this.transitionAlpha - 0.08);
    }

    switch (this.scene) {
      case 'boot':
        this.updateBootScene();
        break;
      case 'title':
        this.updateTitleScene();
        break;
      case 'menu':
        this.updateMenuScene();
        break;
      case 'char_select':
        this.updateCharSelectScene();
        break;
      case 'stage_select':
        this.updateStageSelectScene();
        break;
      case 'versus_splash':
        this.updateVersusSplashScene();
        break;
      case 'match':
        this.updateMatchScene();
        break;
      case 'results':
        this.updateResultsScene();
        break;
      case 'arcade_ending':
        this.updateArcadeEndingScene();
        break;
      case 'movelist':
        this.updateMoveListScene();
        break;
      case 'settings':
        this.updateSettingsScene();
        break;
    }
  }

  private updateBootScene(): void {
    const nav = this.input.pollMenuNav();
    if (this.sceneFrame >= 75 || nav.confirm || nav.back) {
      this.changeScene('title');
    }
  }

  private updateTitleScene(): void {
    const nav = this.input.pollMenuNav();
    if (nav.confirm) {
      this.sound.playUiConfirm();
      this.changeScene('menu');
    }
  }

  private updateMenuScene(): void {
    const nav = this.input.pollMenuNav();
    const totalItems = 8;

    if (nav.up) {
      this.menuIndex = (this.menuIndex - 1 + totalItems) % totalItems;
      this.sound.playUiMove();
    } else if (nav.down) {
      this.menuIndex = (this.menuIndex + 1) % totalItems;
      this.sound.playUiMove();
    } else if (nav.back) {
      this.sound.playUiBack();
      this.changeScene('title');
    } else if (nav.confirm) {
      this.sound.playUiConfirm();
      this.executeMainMenuSelection(this.menuIndex);
    }
  }

  private executeMainMenuSelection(index: number): void {
    this.p1Locked = false;
    this.p2Locked = false;

    switch (index) {
      case 0: // Arcade Circuit
        this.mode = 'arcade';
        this.arcadeStageIndex = 0;
        this.changeScene('char_select');
        break;
      case 1: // Versus CPU
        this.mode = 'versus_cpu';
        this.changeScene('char_select');
        break;
      case 2: // Versus 2P
        this.mode = 'versus_2p';
        this.changeScene('char_select');
        break;
      case 3: // Training Lab
        this.mode = 'training';
        this.changeScene('char_select');
        break;
      case 4: // Combo Trials
        this.mode = 'trials';
        this.activeTrialIndex = 0;
        this.changeScene('char_select');
        break;
      case 5: // Replay Theater
        this.mode = 'replay';
        if (!this.lastReplay) {
          // Create a default showcase replay if no match has been played yet
          this.generateDefaultShowcaseReplay();
        }
        this.launchMatch({ mode: 'replay', skipIntro: true });
        break;
      case 6: // Command Archive (Move List)
        this.moveListScroll = 0;
        this.changeScene('movelist');
        break;
      case 7: // System Config (Settings)
        this.settingsRowIndex = 0;
        this.changeScene('settings');
        break;
    }
  }

  private generateDefaultShowcaseReplay(): void {
    const sim = createMatchState({
      p1Char: 'hayate',
      p2Char: 'sable',
      stageId: 'rooftop',
      seed: 0x2099cafe,
      skipIntro: true
    });
    const c1 = new CpuController('hard');
    const c2 = new CpuController('hard');
    const frames: [RawInputFrame, RawInputFrame][] = [];
    for (let i = 0; i < 600; i++) {
      const i1 = c1.getInput(sim, 0);
      const i2 = c2.getInput(sim, 1);
      frames.push([i1, i2]);
      stepMatch(sim, i1, i2);
    }
    this.lastReplay = {
      p1Char: 'hayate',
      p2Char: 'sable',
      p1Alt: false,
      p2Alt: false,
      stageId: 'rooftop',
      seed: 0x2099cafe,
      roundsToWin: 2,
      frames
    };
  }

  private updateCharSelectScene(): void {
    if (this.input.consumeJustPressed('Tab')) {
      this.p1AltColor = !this.p1AltColor;
      this.sound.playUiMove();
    }

    const nav = this.input.pollMenuNav();
    if (nav.back) {
      this.sound.playUiBack();
      if (this.p1Locked) {
        this.p1Locked = false;
      } else {
        this.changeScene('menu');
      }
      return;
    }

    if (!this.p1Locked) {
      if (nav.left) {
        this.p1Cursor = (this.p1Cursor - 1 + CHARACTER_LIST.length) % CHARACTER_LIST.length;
        this.sound.playUiMove();
      } else if (nav.right) {
        this.p1Cursor = (this.p1Cursor + 1) % CHARACTER_LIST.length;
        this.sound.playUiMove();
      } else if (nav.confirm) {
        this.p1Locked = true;
        this.sound.playUiConfirm();

        if (this.mode === 'arcade') {
          const p1Id = CHARACTER_LIST[this.p1Cursor].id;
          const others = CHARACTER_LIST.map((c) => c.id).filter((id) => id !== p1Id);
          this.arcadeOpponents = [...others, p1Id];
          this.p2Cursor = CHARACTER_LIST.findIndex((c) => c.id === this.arcadeOpponents[0]);
          this.p2Locked = true;
          this.changeScene('versus_splash');
          return;
        }
        if (this.mode === 'trials') {
          this.p2Cursor = (this.p1Cursor + 1) % CHARACTER_LIST.length;
          this.p2Locked = true;
          this.launchMatch({ skipIntro: true });
          return;
        }
      }
    } else if (!this.p2Locked) {
      // P1 is locked; select P2 character (either by P1 cursor in CPU/Training mode or P2 keys in 2P mode)
      if (nav.left || nav.p2Left) {
        this.p2Cursor = (this.p2Cursor - 1 + CHARACTER_LIST.length) % CHARACTER_LIST.length;
        this.sound.playUiMove();
      } else if (nav.right || nav.p2Right) {
        this.p2Cursor = (this.p2Cursor + 1) % CHARACTER_LIST.length;
        this.sound.playUiMove();
      } else if (nav.confirm || nav.p2Confirm) {
        this.p2Locked = true;
        this.sound.playUiConfirm();
        this.changeScene('stage_select');
      }
    }
  }

  private updateStageSelectScene(): void {
    const nav = this.input.pollMenuNav();
    if (nav.back) {
      this.sound.playUiBack();
      this.p2Locked = false;
      this.changeScene('char_select');
      return;
    }

    if (nav.left) {
      this.selectedStageIndex =
        (this.selectedStageIndex - 1 + STAGE_LIST.length) % STAGE_LIST.length;
      this.sound.playUiMove();
    } else if (nav.right) {
      this.selectedStageIndex = (this.selectedStageIndex + 1) % STAGE_LIST.length;
      this.sound.playUiMove();
    } else if (nav.confirm) {
      this.sound.playUiConfirm();
      if (this.mode === 'training') {
        this.launchMatch({ skipIntro: true });
      } else {
        this.changeScene('versus_splash');
      }
    }
  }

  private updateVersusSplashScene(): void {
    const nav = this.input.pollMenuNav();
    if (this.sceneFrame >= 110 || nav.confirm) {
      this.launchMatch();
    }
  }

  private updateMatchScene(): void {
    if (!this.matchState) return;

    // Training Mode Hotkeys ([1] Dummy Behavior, [2] Hitboxes, [3] Rec/Play, [4] Reset Positions)
    if (this.mode === 'training' && !this.isPaused) {
      if (this.input.consumeJustPressed('Digit1')) {
        const behaviors: DummyBehavior[] = [
          'stand',
          'crouch',
          'jump',
          'block_always',
          'block_after_hit',
          'parry_always',
          'cpu'
        ];
        const idx = behaviors.indexOf(this.training.dummyBehavior);
        this.training.dummyBehavior = behaviors[(idx + 1) % behaviors.length];
        this.sound.playUiMove();
      }
      if (this.input.consumeJustPressed('Digit2')) {
        this.training.showHitboxes = !this.training.showHitboxes;
        this.sound.playUiMove();
      }
      if (this.input.consumeJustPressed('Digit3')) {
        if (this.training.recordingState === 'idle') {
          this.training.recordingState = 'recording';
          this.dummyRecordedInputs = [];
        } else if (this.training.recordingState === 'recording') {
          this.training.recordingState = 'playback';
          this.dummyPlaybackCursor = 0;
        } else {
          this.training.recordingState = 'idle';
        }
        this.sound.playUiConfirm();
      }
      if (this.input.consumeJustPressed('Digit4')) {
        resetRoundState(this.matchState, true);
        this.matchState.fighters[0].meter = 300;
        this.sound.playUiMove();
      }
    }

    // Combo Trials Hotkey ([N] Next Trial)
    if (this.mode === 'trials' && !this.isPaused) {
      if (this.input.consumeJustPressed('KeyN')) {
        const trials = CHARACTERS[this.matchState.fighters[0].charId].trials;
        this.activeTrialIndex = (this.activeTrialIndex + 1) % trials.length;
        this.trialCompletedStep = 0;
        this.trialSuccessTimer = 0;
        resetRoundState(this.matchState, true);
        this.matchState.fighters[0].meter = 300;
        this.sound.playUiConfirm();
      }
    }

    // Check Pause toggle
    if (this.input.consumeJustPressed('Escape')) {
      if (this.showPauseMoveList) {
        this.showPauseMoveList = false;
        this.sound.playUiBack();
      } else {
        this.isPaused = !this.isPaused;
        this.pauseIndex = 0;
        this.sound.playUiMove();
      }
      return;
    }

    if (this.isPaused) {
      this.updatePauseMenu();
      return;
    }

    // Save previous state for render interpolation
    this.prevMatchState = cloneMatchState(this.matchState);

    // Gather P1 and P2 inputs for this 60Hz tick
    let p1In: RawInputFrame;
    let p2In: RawInputFrame;

    if (this.isCpuVsCpuDemo) {
      p1In = this.cpu1.getInput(this.matchState, 0);
      p2In = this.cpu2.getInput(this.matchState, 1);
    } else if (this.mode === 'replay' && this.lastReplay) {
      if (this.replayCursor < this.lastReplay.frames.length) {
        const pair = this.lastReplay.frames[this.replayCursor++];
        p1In = pair[0];
        p2In = pair[1];
      } else {
        this.changeScene('menu');
        return;
      }
    } else if (this.mode === 'versus_2p') {
      p1In = this.input.pollPlayerInput(0, false);
      p2In = this.input.pollPlayerInput(1, false);
    } else if (this.mode === 'training') {
      if (this.training.recordingState === 'recording') {
        // Player controls Dummy (P2) while recording!
        p1In = createEmptyInput();
        p2In = this.input.pollPlayerInput(0, true);
        this.dummyRecordedInputs.push(p2In);
        this.training.recordedFramesCount = this.dummyRecordedInputs.length;
        if (this.dummyRecordedInputs.length >= 600) {
          this.training.recordingState = 'playback';
          this.dummyPlaybackCursor = 0;
        }
      } else if (
        this.training.recordingState === 'playback' &&
        this.dummyRecordedInputs.length > 0
      ) {
        p1In = this.input.pollPlayerInput(0, true);
        p2In =
          this.dummyRecordedInputs[
            this.dummyPlaybackCursor % this.dummyRecordedInputs.length
          ];
        this.dummyPlaybackCursor++;
      } else {
        p1In = this.input.pollPlayerInput(0, true);
        p2In = getTrainingDummyInput(
          this.matchState,
          1,
          this.training.dummyBehavior,
          this.cpu2
        );
      }
    } else if (this.mode === 'trials') {
      p1In = this.input.pollPlayerInput(0, true);
      p2In = createEmptyInput();
    } else {
      // Arcade or Versus CPU
      p1In = this.input.pollPlayerInput(0, true);
      p2In = this.cpu2.getInput(this.matchState, 1);
    }

    // Record frame into active replay
    if (this.activeRecording && this.mode !== 'replay') {
      this.activeRecording.frames.push([p1In, p2In]);
    }

    const trainingOpts =
      this.mode === 'training'
        ? {
            infiniteHealth: this.training.infiniteHealth,
            infiniteMeter: this.training.infiniteMeter,
            noStun: this.training.noStun
          }
        : this.mode === 'trials'
        ? {
            infiniteHealth: true,
            infiniteMeter: true,
            noStun: true
          }
        : undefined;

    stepMatch(this.matchState, p1In, p2In, trainingOpts);

    // Update Combo Trial progression if in Trials mode
    if (this.mode === 'trials') {
      this.updateComboTrialValidation(this.matchState);
    }

    // Process SFX & VFX events
    this.sound.processSimEvents(this.matchState.events);
    this.vfx.processSimEvents(
      this.matchState.events,
      this.settings.values.reduceFlashes
    );
    this.vfx.update();

    // Transition to Results when match finishes
    if (this.matchState.phase === 'match_over') {
      if (this.activeRecording && this.activeRecording.frames.length > 0) {
        this.lastReplay = this.activeRecording;
      }
      this.resultsIndex = 0;
      this.changeScene('results');
    }
  }

  private updateComboTrialValidation(state: MatchState): void {
    const f0 = state.fighters[0];
    const f1 = state.fighters[1];
    const trials = CHARACTERS[f0.charId].trials;
    const trial = trials[this.activeTrialIndex % trials.length];

    if (this.trialSuccessTimer > 0) {
      this.trialSuccessTimer--;
      if (this.trialSuccessTimer === 0) {
        this.activeTrialIndex = (this.activeTrialIndex + 1) % trials.length;
        this.trialCompletedStep = 0;
        resetRoundState(state, true);
        state.fighters[0].meter = 300;
      }
      return;
    }

    // Reset progress if opponent recovered from hitstun before trial finished
    if (
      this.trialCompletedStep > 0 &&
      f1.comboCounter === 0 &&
      f1.status !== 'hitstun_stand' &&
      f1.status !== 'hitstun_crouch' &&
      f1.status !== 'hitstun_air'
    ) {
      this.trialCompletedStep = 0;
    }

    // Check if the current expected step just hit the opponent
    const expectedStep = trial.steps[this.trialCompletedStep];
    if (!expectedStep) return;

    const hitEvent = state.events.find(
      (e) => e.type === 'hit' && e.playerIndex === 0
    );
    if (hitEvent && f0.currentMoveId) {
      // Allow any L/M/H strength of the same special if notation is generic, or exact match
      const expectedBase = expectedStep.moveId.replace(/_(l|m|h)$/, '');
      const actualBase = f0.currentMoveId.replace(/_(l|m|h)$/, '');
      const matched =
        f0.currentMoveId === expectedStep.moveId ||
        ( !expectedStep.moveId.endsWith('_ex') &&
          !f0.currentMoveId.endsWith('_ex') &&
          expectedBase === actualBase);

      if (matched) {
        this.trialCompletedStep++;
        if (this.trialCompletedStep >= trial.steps.length) {
          this.trialSuccessTimer = 95;
          this.sound.playUiConfirm();
        }
      }
    }
  }

  private updatePauseMenu(): void {
    const nav = this.input.pollMenuNav();

    if (this.showPauseMoveList) {
      if (nav.up) this.moveListScroll = Math.max(0, this.moveListScroll - 1);
      if (nav.down) this.moveListScroll++;
      if (nav.back || nav.confirm) {
        this.showPauseMoveList = false;
        this.sound.playUiBack();
      }
      return;
    }

    const pauseOptionsCount = this.mode === 'training' ? 6 : 5;
    if (nav.up) {
      this.pauseIndex = (this.pauseIndex - 1 + pauseOptionsCount) % pauseOptionsCount;
      this.sound.playUiMove();
    } else if (nav.down) {
      this.pauseIndex = (this.pauseIndex + 1) % pauseOptionsCount;
      this.sound.playUiMove();
    } else if (nav.confirm) {
      this.sound.playUiConfirm();
      let idx = this.pauseIndex;
      if (this.mode !== 'training' && idx >= 2) idx++; // Skip training toggle option when not in training

      switch (idx) {
        case 0: // Resume
          this.isPaused = false;
          break;
        case 1: // Command List
          this.showPauseMoveList = true;
          this.moveListScroll = 0;
          break;
        case 2: // Cycle Training Dummy / Hitbox toggles
          this.training.showHitboxes = !this.training.showHitboxes;
          this.training.infiniteHealth = true;
          break;
        case 3: // Restart Match
          this.launchMatch({
            skipIntro: this.mode === 'training' || this.mode === 'trials'
          });
          break;
        case 4: // Character Select
          this.p1Locked = false;
          this.p2Locked = false;
          this.changeScene('char_select');
          break;
        case 5: // Main Menu
          this.changeScene('menu');
          break;
      }
    }
  }

  private updateResultsScene(): void {
    const nav = this.input.pollMenuNav();
    const totalOpts = 4;

    if (nav.up || nav.left) {
      this.resultsIndex = (this.resultsIndex - 1 + totalOpts) % totalOpts;
      this.sound.playUiMove();
    } else if (nav.down || nav.right) {
      this.resultsIndex = (this.resultsIndex + 1) % totalOpts;
      this.sound.playUiMove();
    } else if (nav.confirm) {
      this.sound.playUiConfirm();
      if (this.resultsIndex === 0) {
        // Next Arcade Stage or Rematch
        if (
          this.mode === 'arcade' &&
          this.matchState &&
          this.matchState.p1RoundsWon >= this.matchState.roundsToWin
        ) {
          this.arcadeStageIndex++;
          if (this.arcadeStageIndex >= 4) {
            this.changeScene('arcade_ending');
          } else {
            this.selectedStageIndex =
              (this.selectedStageIndex + 1) % STAGE_LIST.length;
            this.changeScene('versus_splash');
          }
        } else {
          this.launchMatch();
        }
      } else if (this.resultsIndex === 1) {
        // Watch Replay
        if (this.lastReplay) {
          this.launchMatch({ mode: 'replay', skipIntro: true });
        }
      } else if (this.resultsIndex === 2) {
        this.p1Locked = false;
        this.p2Locked = false;
        this.changeScene('char_select');
      } else {
        this.changeScene('menu');
      }
    }
  }

  private updateArcadeEndingScene(): void {
    const nav = this.input.pollMenuNav();
    if (nav.confirm || nav.back) {
      this.sound.playUiConfirm();
      this.changeScene('menu');
    }
  }

  private updateMoveListScene(): void {
    const nav = this.input.pollMenuNav();
    if (nav.left) {
      this.moveListCharIndex =
        (this.moveListCharIndex - 1 + CHARACTER_LIST.length) % CHARACTER_LIST.length;
      this.moveListScroll = 0;
      this.sound.playUiMove();
    } else if (nav.right) {
      this.moveListCharIndex =
        (this.moveListCharIndex + 1) % CHARACTER_LIST.length;
      this.moveListScroll = 0;
      this.sound.playUiMove();
    } else if (nav.up) {
      this.moveListScroll = Math.max(0, this.moveListScroll - 1);
      this.sound.playUiMove();
    } else if (nav.down) {
      this.moveListScroll++;
      this.sound.playUiMove();
    } else if (nav.back) {
      this.sound.playUiBack();
      this.changeScene('menu');
    }
  }

  private updateSettingsScene(): void {
    if (this.input.isListening()) return;

    if (this.input.consumeJustPressed('Tab')) {
      const tabs: ('general' | 'p1_keys' | 'p2_keys')[] = [
        'general',
        'p1_keys',
        'p2_keys'
      ];
      this.settingsTab = tabs[(tabs.indexOf(this.settingsTab) + 1) % tabs.length];
      this.settingsRowIndex = 0;
      this.sound.playUiMove();
      return;
    }

    const nav = this.input.pollMenuNav();
    if (nav.back) {
      this.settings.save();
      this.input.saveBindings();
      this.sound.playUiBack();
      this.changeScene('menu');
      return;
    }

    const rowCount = this.settingsTab === 'general' ? 11 : 12;
    if (nav.up) {
      this.settingsRowIndex = (this.settingsRowIndex - 1 + rowCount) % rowCount;
      this.sound.playUiMove();
    } else if (nav.down) {
      this.settingsRowIndex = (this.settingsRowIndex + 1) % rowCount;
      this.sound.playUiMove();
    } else if (this.settingsTab === 'general') {
      if (nav.left || nav.right || nav.confirm) {
        const dir = nav.left ? -1 : 1;
        this.adjustGeneralSetting(this.settingsRowIndex, dir);
        this.sound.playUiMove();
      }
    } else {
      // Keybind tabs
      if (nav.confirm) {
        const keyFields: (keyof KeyBindings)[] = [
          'up',
          'down',
          'left',
          'right',
          'lp',
          'mp',
          'hp',
          'lk',
          'mk',
          'hk',
          'parryMacro'
        ];
        if (this.settingsRowIndex === 11) {
          this.input.resetBindings();
          this.sound.playUiConfirm();
        } else {
          const field = keyFields[this.settingsRowIndex];
          const target =
            this.settingsTab === 'p1_keys' ? this.input.p1Keys : this.input.p2Keys;
          this.sound.playUiConfirm();
          this.input.listenForNextKey((newCode) => {
            target[field] = newCode;
            this.input.saveBindings();
          });
        }
      }
    }
  }

  private adjustGeneralSetting(row: number, dir: -1 | 1): void {
    const v = this.settings.values;
    switch (row) {
      case 0:
        v.masterVolume = Math.max(0, Math.min(100, v.masterVolume + dir * 10));
        this.sound.updateVolumes();
        break;
      case 1:
        v.musicVolume = Math.max(0, Math.min(100, v.musicVolume + dir * 10));
        this.sound.updateVolumes();
        break;
      case 2:
        v.sfxVolume = Math.max(0, Math.min(100, v.sfxVolume + dir * 10));
        this.sound.updateVolumes();
        break;
      case 3:
        v.muted = !v.muted;
        this.sound.updateVolumes();
        break;
      case 4: {
        const diffs: ('easy' | 'medium' | 'hard')[] = ['easy', 'medium', 'hard'];
        const next = (diffs.indexOf(v.cpuDifficulty) + dir + diffs.length) % diffs.length;
        v.cpuDifficulty = diffs[next];
        break;
      }
      case 5:
        v.screenShake = !v.screenShake;
        break;
      case 6:
        v.reduceFlashes = !v.reduceFlashes;
        break;
      case 7:
        v.colorblindMode = !v.colorblindMode;
        break;
      case 8:
        v.showHud = !v.showHud;
        break;
      case 9:
        v.showInputHistory = !v.showInputHistory;
        break;
      case 10: {
        const scales = [0.75, 1.0, 1.25];
        const idx = scales.indexOf(v.resolutionScale);
        v.resolutionScale = scales[(idx + dir + scales.length) % scales.length];
        this.resizeCanvas();
        break;
      }
    }
    this.settings.save();
  }

  private handleMouseClick(mx: number, my: number): void {
    if (this.scene === 'boot' || this.scene === 'title') {
      this.sound.playUiConfirm();
      this.changeScene('menu');
    } else if (this.scene === 'menu') {
      for (let i = 0; i < 8; i++) {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const bx = 130 + col * 525;
        const by = 185 + row * 112;
        if (mx >= bx && mx <= bx + 495 && my >= by && my <= by + 94) {
          this.menuIndex = i;
          this.sound.playUiConfirm();
          this.executeMainMenuSelection(i);
          return;
        }
      }
    }
  }

  // ==========================================================================
  // RENDERING PIPELINE
  // ==========================================================================
  public render(interpAlpha: number): void {
    const ctx = this.ctx;
    const scaleX = this.canvas.width / 1280;
    const scaleY = this.canvas.height / 720;

    ctx.save();
    ctx.scale(scaleX, scaleY);

    switch (this.scene) {
      case 'boot':
        this.renderBootScene(ctx);
        break;
      case 'title':
        this.renderTitleScene(ctx);
        break;
      case 'menu':
        this.renderMenuScene(ctx);
        break;
      case 'char_select':
        this.renderCharSelectScene(ctx);
        break;
      case 'stage_select':
        this.renderStageSelectScene(ctx);
        break;
      case 'versus_splash':
        this.renderVersusSplashScene(ctx);
        break;
      case 'match':
        this.renderMatchScene(ctx, interpAlpha);
        break;
      case 'results':
        this.renderResultsScene(ctx);
        break;
      case 'arcade_ending':
        this.renderArcadeEndingScene(ctx);
        break;
      case 'movelist': {
        this.stageRenderer.renderStage(ctx, 'rooftop', 0, 0, 1.0, this.sceneFrame);
        const maxScroll = this.moveListRenderer.renderMoveList(
          ctx,
          CHARACTER_LIST[this.moveListCharIndex].id,
          this.moveListScroll,
          true
        );
        this.moveListScroll = Math.min(this.moveListScroll, maxScroll);
        break;
      }
      case 'settings':
        this.renderSettingsScene(ctx);
        break;
    }

    // Scene transition flash/fade
    if (this.transitionAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = this.transitionAlpha;
      ctx.fillStyle = '#030818';
      ctx.fillRect(0, 0, 1280, 720);
      ctx.restore();
    }

    ctx.restore();
  }

  private renderBootScene(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#02050e';
    ctx.fillRect(0, 0, 1280, 720);

    ctx.save();
    ctx.strokeStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 24;
    ctx.lineWidth = 3;

    // Cyber Hexagon Emblem
    ctx.translate(640, 310);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      const hx = Math.cos(a) * 65;
      const hy = Math.sin(a) * 65;
      if (i === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px "Segoe UI", "Orbitron", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ZAIBATSU // NEURAL OS 2099', 0, 115);

    ctx.fillStyle = '#00f0ff';
    ctx.font = '14px "Consolas", monospace';
    ctx.fillText('DETERMINISTIC 60HZ COMBAT ENGINE INITIALIZED', 0, 148);
    ctx.restore();
  }

  private renderTitleScene(ctx: CanvasRenderingContext2D): void {
    this.stageRenderer.renderStage(
      ctx,
      'rooftop',
      Math.sin(this.sceneFrame * 0.01) * 90,
      0,
      1.02,
      this.sceneFrame
    );

    // Dark gradient overlay
    const grad = ctx.createRadialGradient(640, 360, 120, 640, 360, 720);
    grad.addColorStop(0, 'rgba(3, 7, 20, 0.35)');
    grad.addColorStop(1, 'rgba(2, 4, 12, 0.88)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1280, 720);

    // Showcase fighters Hayate and Sable flanking the center prompt cleanly
    const dummyH = createFighterState(0, 'hayate');
    dummyH.x = -345;
    const dummyS = createFighterState(1, 'sable');
    dummyS.x = 345;

    ctx.save();
    ctx.translate(640, 0);
    this.fighterRenderer.renderFighter(ctx, dummyH, 1, STAGE_FLOOR_SCREEN_Y, this.sceneFrame);
    this.fighterRenderer.renderFighter(ctx, dummyS, 1, STAGE_FLOOR_SCREEN_Y, this.sceneFrame);
    ctx.restore();

    // Neon Title Logo Crest & Backing Plate
    ctx.save();
    ctx.textAlign = 'center';

    // Angled cyber-crest behind logo so background billboards never bleed into title text
    ctx.fillStyle = 'rgba(3, 8, 22, 0.86)';
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(190, 145);
    ctx.lineTo(1090, 145);
    ctx.lineTo(1050, 315);
    ctx.lineTo(230, 315);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Top and bottom neon accent rails on logo crest
    ctx.fillStyle = '#ff007f';
    ctx.fillRect(360, 143, 560, 4);
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(420, 313, 440, 4);

    ctx.fillStyle = '#ff007f';
    ctx.font = 'bold 16px "Consolas", monospace';
    ctx.fillText(T.gameSubtitle, 640, 182);

    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 34;
    ctx.font = 'italic 900 92px "Segoe UI", "Orbitron", sans-serif';
    ctx.fillText('NEON TEMPEST', 640, 276);

    ctx.strokeStyle = '#ff00aa';
    ctx.lineWidth = 2.5;
    ctx.strokeText('NEON TEMPEST', 644, 279);

    // Pulsing Press Start Banner (centered cleanly between the two fighters)
    const pulse = 0.65 + Math.abs(Math.sin(this.sceneFrame * 0.06)) * 0.35;
    ctx.globalAlpha = pulse;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 18;
    ctx.fillStyle = 'rgba(4, 12, 28, 0.94)';
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2.5;
    ctx.fillRect(420, 505, 440, 52);
    ctx.strokeRect(420, 505, 440, 52);

    ctx.fillStyle = '#00f0ff';
    ctx.font = 'bold 19px "Segoe UI", "Orbitron", sans-serif';
    ctx.fillText(T.pressStart, 640, 537);

    // Bottom System Telemetry Footer
    ctx.globalAlpha = 0.85;
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#8cb4d8';
    ctx.font = '12px "Consolas", monospace';
    ctx.fillText(
      'VER 1.0 // 60HZ DETERMINISTIC SIMULATION // KEYBOARD & GAMEPAD READY // 100% PROCEDURAL ENGINE',
      640,
      690
    );
    ctx.restore();
  }

  private renderMenuScene(ctx: CanvasRenderingContext2D): void {
    this.stageRenderer.renderStage(
      ctx,
      'alley',
      Math.cos(this.sceneFrame * 0.008) * 60,
      0,
      1.0,
      this.sceneFrame
    );

    ctx.fillStyle = 'rgba(3, 7, 18, 0.84)';
    ctx.fillRect(0, 0, 1280, 720);

    // Top Header
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 18;
    ctx.font = 'italic 900 44px "Segoe UI", "Orbitron", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('NEON TEMPEST // MAIN TERMINAL', 130, 108);

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#00f0ff';
    ctx.font = '14px "Consolas", monospace';
    ctx.fillText('SELECT COMBAT MODULE  |  P1: WASD + U/I/O/J/K/L  |  GAMEPAD READY', 132, 138);

    const items = [
      { title: T.menus.arcade, desc: T.menus.arcadeDesc, tag: '01 // CAMPAIGN' },
      { title: T.menus.versusCpu, desc: T.menus.versusCpuDesc, tag: '02 // SINGLE' },
      { title: T.menus.versus2p, desc: T.menus.versus2pDesc, tag: '03 // LOCAL 2P' },
      { title: T.menus.training, desc: T.menus.trainingDesc, tag: '04 // TELEMETRY' },
      { title: T.menus.trials, desc: T.menus.trialsDesc, tag: '05 // MASTERY' },
      { title: T.menus.replay, desc: T.menus.replayDesc, tag: '06 // ARCHIVE' },
      { title: T.menus.movelist, desc: T.menus.movelistDesc, tag: '07 // DATABASE' },
      { title: T.menus.settings, desc: T.menus.settingsDesc, tag: '08 // CONFIG' }
    ];

    for (let i = 0; i < items.length; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const selected = i === this.menuIndex;
      const bx = 130 + col * 525 + (selected ? 6 : 0);
      const by = 175 + row * 114;
      const bw = 495;
      const bh = 94;

      ctx.save();
      ctx.fillStyle = selected
        ? 'rgba(0, 48, 82, 0.92)'
        : 'rgba(7, 15, 34, 0.85)';
      ctx.strokeStyle = selected ? '#00f0ff' : 'rgba(0, 240, 255, 0.25)';
      ctx.lineWidth = selected ? 3 : 1.5;
      if (selected) {
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 18;
      }

      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + bw - 18, by);
      ctx.lineTo(bx + bw, by + 18);
      ctx.lineTo(bx + bw, by + bh);
      ctx.lineTo(bx, by + bh);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Left accent bar
      ctx.fillStyle = selected ? '#ff00aa' : '#00f0ff';
      ctx.fillRect(bx, by, 6, bh);

      ctx.shadowBlur = 0;
      ctx.fillStyle = selected ? '#ffbe00' : '#6e9ec4';
      ctx.font = 'bold 11px "Consolas", monospace';
      ctx.fillText(items[i].tag, bx + 20, by + 24);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 21px "Segoe UI", "Orbitron", sans-serif';
      ctx.fillText(items[i].title, bx + 20, by + 52);

      ctx.fillStyle = '#a8d0f0';
      ctx.font = '13px "Segoe UI", sans-serif';
      ctx.fillText(items[i].desc, bx + 20, by + 76);

      ctx.restore();
    }

    ctx.restore();
  }

  private renderCharSelectScene(ctx: CanvasRenderingContext2D): void {
    this.stageRenderer.renderStage(ctx, 'shrine', 0, 0, 1.0, this.sceneFrame);
    ctx.fillStyle = 'rgba(3, 8, 22, 0.88)';
    ctx.fillRect(0, 0, 1280, 720);

    const p1Char = CHARACTER_LIST[this.p1Cursor];
    const p2Char = CHARACTER_LIST[this.p2Cursor];

    // Title
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 16;
    ctx.font = 'italic 900 38px "Segoe UI", "Orbitron", sans-serif';
    ctx.fillText('SELECT YOUR COMBATANT', 640, 56);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#00f0ff';
    ctx.font = '13px "Consolas", monospace';
    ctx.fillText('[TAB] TOGGLE ALT PALETTE   |   [ENTER / LP] CONFIRM   |   [ESC] BACK', 640, 80);

    // P1 & P2 Full-Body Animated Preview Panels + Stats
    this.renderCharPreviewPanel(ctx, p1Char, 0, 48, 102, this.p1Locked, this.p1AltColor);
    this.renderCharPreviewPanel(ctx, p2Char, 1, 832, 102, this.p2Locked, this.p2AltColor);

    // Center 4 Character Portrait Cards
    for (let i = 0; i < CHARACTER_LIST.length; i++) {
      const c = CHARACTER_LIST[i];
      const cx = 468 + (i % 2) * 180;
      const cy = 140 + Math.floor(i / 2) * 205;
      const cw = 164;
      const ch = 185;

      this.fighterRenderer.renderCharacterPortrait(
        ctx,
        c.id,
        cx,
        cy,
        cw,
        ch - 42,
        false,
        this.sceneFrame
      );

      ctx.fillStyle = 'rgba(4, 10, 26, 0.95)';
      ctx.fillRect(cx, cy + ch - 42, cw, 42);
      ctx.strokeStyle = c.palette.primary;
      ctx.lineWidth = 2;
      ctx.strokeRect(cx, cy, cw, ch);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 17px "Segoe UI", "Orbitron", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(c.name, cx + cw * 0.5, cy + ch - 20);
      ctx.fillStyle = c.palette.primary;
      ctx.font = '10px "Consolas", monospace';
      ctx.fillText(c.archetype, cx + cw * 0.5, cy + ch - 6);

      // P1 Cursor highlight
      if (this.p1Cursor === i) {
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 4;
        ctx.strokeRect(cx - 4, cy - 4, cw + 8, ch + 8);
        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(cx - 4, cy - 24, 48, 20);
        ctx.fillStyle = '#020612';
        ctx.font = 'bold 12px "Orbitron", sans-serif';
        ctx.fillText('P1', cx + 20, cy - 10);
      }

      // P2 Cursor highlight
      if (this.p2Cursor === i) {
        ctx.strokeStyle = '#ff00aa';
        ctx.lineWidth = 4;
        ctx.strokeRect(cx - 8, cy - 8, cw + 16, ch + 16);
        ctx.fillStyle = '#ff00aa';
        ctx.fillRect(cx + cw - 44, cy - 24, 48, 20);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px "Orbitron", sans-serif';
        ctx.fillText(this.mode === 'versus_2p' ? 'P2' : 'CPU', cx + cw - 20, cy - 10);
      }
    }

    ctx.restore();
  }

  private renderCharPreviewPanel(
    ctx: CanvasRenderingContext2D,
    charDef: (typeof CHARACTER_LIST)[number],
    playerIndex: 0 | 1,
    x: number,
    y: number,
    locked: boolean,
    useAlt: boolean
  ): void {
    const w = 398;
    const h = 565;
    const accent = playerIndex === 0 ? '#00f0ff' : '#ff00aa';

    ctx.save();
    ctx.fillStyle = 'rgba(5, 11, 26, 0.9)';
    ctx.strokeStyle = locked ? '#00ff88' : accent;
    ctx.lineWidth = locked ? 3 : 2;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);

    // Render live animated fighter inside preview box
    const previewFighter = createFighterState(playerIndex, charDef.id, useAlt);
    previewFighter.x = x + w * 0.5;
    previewFighter.y = 0;
    previewFighter.prevX = previewFighter.x;
    previewFighter.prevY = 0;
    previewFighter.facing = playerIndex === 0 ? 1 : -1;
    if (locked) previewFighter.status = 'victory';

    this.fighterRenderer.renderFighter(
      ctx,
      previewFighter,
      1,
      y + 265,
      this.sceneFrame,
      this.settings.values.colorblindMode
    );

    // Character Name, Archetype & Bio
    ctx.textAlign = 'left';
    ctx.fillStyle = accent;
    ctx.font = 'bold 13px "Consolas", monospace';
    ctx.fillText(
      `${playerIndex === 0 ? 'PLAYER 1' : this.mode === 'versus_2p' ? 'PLAYER 2' : 'CPU OPPONENT'} // ${charDef.archetype}`,
      x + 20,
      y + 30
    );

    ctx.fillStyle = '#ffffff';
    ctx.font = 'italic 900 32px "Segoe UI", "Orbitron", sans-serif';
    ctx.fillText(charDef.name, x + 20, y + 64);

    ctx.fillStyle = '#9cc4e8';
    ctx.font = 'bold 12px "Consolas", monospace';
    ctx.fillText(charDef.title, x + 20, y + 84);

    // Stat Bars
    const stats: [string, number][] = [
      ['POWER', charDef.stats.power],
      ['SPEED', charDef.stats.speed],
      ['RANGE', charDef.stats.range],
      ['TECHNIQUE', charDef.stats.technique],
      ['DEFENSE', charDef.stats.defense]
    ];

    for (let i = 0; i < stats.length; i++) {
      const [label, val] = stats[i];
      const sy = y + 315 + i * 26;
      ctx.fillStyle = '#b8dcf8';
      ctx.font = 'bold 11px "Consolas", monospace';
      ctx.fillText(label, x + 20, sy);

      ctx.fillStyle = 'rgba(15, 30, 58, 0.9)';
      ctx.fillRect(x + 110, sy - 10, 260, 12);
      ctx.fillStyle = charDef.palette.primary;
      ctx.fillRect(x + 110, sy - 10, (260 * val) / 10, 12);
    }

    // Signature Specials Preview
    ctx.fillStyle = '#ffbe00';
    ctx.font = 'bold 12px "Consolas", monospace';
    ctx.fillText('SIGNATURE PROTOCOLS:', x + 20, y + 462);

    const specials = Object.values(charDef.moves).filter(
      (m) => m.category === 'special' && m.id.endsWith('_l')
    );
    for (let i = 0; i < Math.min(3, specials.length); i++) {
      const sp = specials[i];
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px "Consolas", monospace';
      ctx.fillText(
        `• ${sp.name.replace(' (L)', '')}  [${sp.inputNotation.replace(' + LP', '+P').replace(' + LK', '+K')}]`,
        x + 20,
        y + 484 + i * 20
      );
    }

    if (locked) {
      ctx.fillStyle = '#00ff88';
      ctx.font = 'bold 15px "Segoe UI", "Orbitron", sans-serif';
      ctx.fillText('✓ LOCKED IN // READY', x + 20, y + 548);
    }

    ctx.restore();
  }

  private renderStageSelectScene(ctx: CanvasRenderingContext2D): void {
    const stage = STAGE_LIST[this.selectedStageIndex];
    this.stageRenderer.renderStage(ctx, stage.id, 0, 0, 1.0, this.sceneFrame);

    ctx.fillStyle = 'rgba(2, 6, 18, 0.58)';
    ctx.fillRect(0, 0, 1280, 720);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = stage.neonPrimary;
    ctx.shadowBlur = 20;
    ctx.font = 'italic 900 42px "Segoe UI", "Orbitron", sans-serif';
    ctx.fillText('SELECT COMBAT ARENA', 640, 88);

    // 3 Stage Cards
    for (let i = 0; i < STAGE_LIST.length; i++) {
      const s = STAGE_LIST[i];
      const active = i === this.selectedStageIndex;
      const sx = 140 + i * 345;
      const sy = 440;
      const sw = 310;
      const sh = 165;

      ctx.fillStyle = active ? 'rgba(6, 22, 46, 0.94)' : 'rgba(4, 10, 24, 0.84)';
      ctx.strokeStyle = active ? s.neonPrimary : 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = active ? 3.5 : 1.5;
      ctx.fillRect(sx, sy, sw, sh);
      ctx.strokeRect(sx, sy, sw, sh);

      ctx.fillStyle = s.neonPrimary;
      ctx.font = 'bold 12px "Consolas", monospace';
      ctx.fillText(s.subtitle, sx + sw * 0.5, sy + 36);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px "Segoe UI", "Orbitron", sans-serif';
      ctx.fillText(s.name, sx + sw * 0.5, sy + 72);

      ctx.fillStyle = '#9cc4e8';
      ctx.font = '12px "Consolas", monospace';
      ctx.fillText(s.location, sx + sw * 0.5, sy + 106);
      ctx.fillText(`TEMPO: ${s.bpm} BPM`, sx + sw * 0.5, sy + 132);
    }

    ctx.fillStyle = '#00f0ff';
    ctx.font = 'bold 14px "Consolas", monospace';
    ctx.fillText('[← / →] SELECT ARENA     [ENTER] LAUNCH MATCH     [ESC] BACK', 640, 665);
    ctx.restore();
  }

  private renderVersusSplashScene(ctx: CanvasRenderingContext2D): void {
    const p1Char = CHARACTER_LIST[this.p1Cursor];
    const p2CharId =
      this.mode === 'arcade'
        ? this.arcadeOpponents[this.arcadeStageIndex % this.arcadeOpponents.length]
        : CHARACTER_LIST[this.p2Cursor].id;
    const p2Char = CHARACTERS[p2CharId];

    // Split screen diagonal background
    ctx.fillStyle = '#04091a';
    ctx.fillRect(0, 0, 1280, 720);

    ctx.save();
    ctx.fillStyle = p1Char.palette.secondary;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(720, 0);
    ctx.lineTo(560, 720);
    ctx.lineTo(0, 720);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = p2Char.palette.secondary;
    ctx.beginPath();
    ctx.moveTo(720, 0);
    ctx.lineTo(1280, 0);
    ctx.lineTo(1280, 720);
    ctx.lineTo(560, 720);
    ctx.closePath();
    ctx.fill();

    // Render large portraits and fighters
    this.fighterRenderer.renderCharacterPortrait(
      ctx,
      p1Char.id,
      80,
      140,
      360,
      340,
      this.p1AltColor,
      this.sceneFrame
    );
    this.fighterRenderer.renderCharacterPortrait(
      ctx,
      p2Char.id,
      840,
      140,
      360,
      340,
      this.p2AltColor,
      this.sceneFrame
    );

    // Diagonal lightning divider & energy arcs
    ctx.strokeStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 26;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(720, 0);
    ctx.lineTo(560, 720);
    ctx.stroke();

    // Secondary magenta lightning filament
    ctx.strokeStyle = '#ff00aa';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let ly = 0; ly <= 720; ly += 45) {
      const baseLx = 720 - (ly / 720) * 160;
      const jag = Math.sin(ly * 0.15 + this.sceneFrame * 0.25) * 18;
      if (ly === 0) ctx.moveTo(baseLx + jag, ly);
      else ctx.lineTo(baseLx + jag, ly);
    }
    ctx.stroke();

    // VS Emblem with outer rotating ring
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 4;
    ctx.fillStyle = '#040a1c';
    ctx.beginPath();
    ctx.arc(640, 320, 68, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#ff00aa';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(640, 320, 78, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'italic 900 56px "Segoe UI", "Orbitron", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VS', 640, 340);

    // Arena Stage Badge under VS Emblem
    const stageDef = STAGE_LIST[this.selectedStageIndex % STAGE_LIST.length];
    ctx.fillStyle = 'rgba(4, 12, 28, 0.92)';
    ctx.strokeStyle = stageDef.neonPrimary;
    ctx.lineWidth = 1.5;
    ctx.fillRect(465, 430, 350, 52);
    ctx.strokeRect(465, 430, 350, 52);
    ctx.fillStyle = stageDef.neonPrimary;
    ctx.font = 'bold 13px "Segoe UI", "Orbitron", sans-serif';
    ctx.fillText(`ARENA // ${stageDef.name}`, 640, 452);
    ctx.fillStyle = '#b8dcf8';
    ctx.font = '11px "Consolas", monospace';
    ctx.fillText(`${stageDef.location}  |  ${stageDef.bpm} BPM`, 640, 471);

    // Character names & telemetry pills
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'italic 900 48px "Segoe UI", "Orbitron", sans-serif';
    ctx.fillText(p1Char.name, 80, 540);
    ctx.fillStyle = p1Char.palette.primary;
    ctx.font = 'bold 16px "Consolas", monospace';
    ctx.fillText(`${p1Char.title} // ${p1Char.archetype}`, 80, 568);
    ctx.fillStyle = '#9cc4e8';
    ctx.font = '12px "Consolas", monospace';
    ctx.fillText(`VITALITY: ${p1Char.maxHp} HP  |  SIG: ${p1Char.moves.super_art.name.toUpperCase()}`, 80, 592);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'italic 900 48px "Segoe UI", "Orbitron", sans-serif';
    ctx.fillText(p2Char.name, 1200, 540);
    ctx.fillStyle = p2Char.palette.primary;
    ctx.font = 'bold 16px "Consolas", monospace';
    ctx.fillText(`${p2Char.title} // ${p2Char.archetype}`, 1200, 568);
    ctx.fillStyle = '#9cc4e8';
    ctx.font = '12px "Consolas", monospace';
    ctx.fillText(`VITALITY: ${p2Char.maxHp} HP  |  SIG: ${p2Char.moves.super_art.name.toUpperCase()}`, 1200, 592);

    // Top Header Banner
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(4, 10, 24, 0.88)';
    ctx.strokeStyle = '#ffbe00';
    ctx.lineWidth = 1.5;
    ctx.fillRect(420, 38, 440, 42);
    ctx.strokeRect(420, 38, 440, 42);
    ctx.fillStyle = '#ffbe00';
    ctx.font = 'bold 17px "Segoe UI", "Orbitron", sans-serif';
    ctx.fillText(
      this.mode === 'arcade'
        ? `ARCADE CIRCUIT // STAGE ${this.arcadeStageIndex + 1} OF 4`
        : `VERSUS ENGAGEMENT // BEST OF 3`,
      640,
      65
    );

    if (this.mode === 'arcade') {
      ctx.fillStyle = '#d8f0ff';
      ctx.font = '14px "Segoe UI", sans-serif';
      ctx.fillText(p1Char.arcadeIntro, 640, 660);
    }

    ctx.restore();
  }

  private renderMatchScene(ctx: CanvasRenderingContext2D, interpAlpha: number): void {
    if (!this.matchState) return;
    const state = this.matchState;

    // Apply screen shake offset if enabled
    ctx.save();
    if (this.settings.values.screenShake && state.screenShake > 0) {
      const sx = (Math.random() - 0.5) * state.screenShake * 1.8;
      const sy = (Math.random() - 0.5) * state.screenShake * 1.8;
      ctx.translate(sx, sy);
    }

    // 1. Render Parallax Stage & Floor
    this.stageRenderer.renderStage(
      ctx,
      state.stageId,
      state.cameraX,
      state.cameraY,
      state.cameraZoom,
      state.frame
    );

    // 2. Render World-Space Entities (Fighters, Projectiles, Hitboxes, World VFX)
    ctx.save();
    ctx.translate(640, STAGE_FLOOR_SCREEN_Y);
    ctx.scale(state.cameraZoom, state.cameraZoom);
    ctx.translate(-state.cameraX, -state.cameraY);

    // Draw fighters (attacker on top of defender)
    const f0OnTop = state.fighters[0].status === 'attack';
    const order = f0OnTop ? [1, 0] : [0, 1];
    for (const idx of order) {
      this.fighterRenderer.renderFighter(
        ctx,
        state.fighters[idx],
        interpAlpha,
        0,
        state.frame,
        this.settings.values.colorblindMode
      );
    }

    // Draw active projectiles
    this.fighterRenderer.renderProjectiles(
      ctx,
      state.projectiles,
      interpAlpha,
      0,
      state.frame
    );

    // Draw Hitbox/Hurtbox/Pushbox/Throwbox overlay in Training mode
    if (this.mode === 'training' && this.training.showHitboxes) {
      this.fighterRenderer.renderDebugBoxes(ctx, state.fighters[0], 0);
      this.fighterRenderer.renderDebugBoxes(ctx, state.fighters[1], 0);
    }

    // Draw World-Space VFX Sparks & Shockwaves
    this.vfx.renderWorldVfx(ctx, 0);

    ctx.restore();
    ctx.restore(); // End screen shake

    // 3. Render Screen-Space VFX (Super Cut-In, Callouts, Flash)
    this.vfx.renderScreenVfx(ctx, state, this.settings.values.reduceFlashes);

    // 4. Render Match HUD
    if (this.settings.values.showHud) {
      let trialHud: TrialHudState | undefined;
      if (this.mode === 'trials') {
        const trials = CHARACTERS[state.fighters[0].charId].trials;
        trialHud = {
          trial: trials[this.activeTrialIndex % trials.length],
          completedStepIndex: this.trialCompletedStep,
          trialSuccessTimer: this.trialSuccessTimer,
          trialIndex: this.activeTrialIndex % trials.length,
          totalTrials: trials.length
        };
      }

      this.hudRenderer.renderHud(
        ctx,
        state,
        this.settings.values.showInputHistory,
        this.settings.values.colorblindMode,
        this.mode === 'training' ? this.training : undefined,
        trialHud
      );
    }

    // Replay Theater banner
    if (this.mode === 'replay' && this.lastReplay) {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 0, 128, 0.85)';
      ctx.fillRect(540, 82, 200, 24);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px "Consolas", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        `● REPLAY ${this.replayCursor}/${this.lastReplay.frames.length}f`,
        640,
        98
      );
      ctx.restore();
    }

    // 5. Render Pause Overlay / In-Match Move List
    if (this.isPaused) {
      this.renderPauseOverlay(ctx);
    }
  }

  private renderPauseOverlay(ctx: CanvasRenderingContext2D): void {
    if (this.showPauseMoveList && this.matchState) {
      const maxScroll = this.moveListRenderer.renderMoveList(
        ctx,
        this.matchState.fighters[0].charId,
        this.moveListScroll,
        false
      );
      this.moveListScroll = Math.min(this.moveListScroll, maxScroll);
      return;
    }

    ctx.save();
    ctx.fillStyle = 'rgba(2, 6, 18, 0.82)';
    ctx.fillRect(0, 0, 1280, 720);

    const bx = 430;
    const by = 165;
    const bw = 420;
    const bh = 390;

    ctx.fillStyle = 'rgba(6, 14, 32, 0.96)';
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2.5;
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeRect(bx, by, bw, bh);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'italic 900 30px "Segoe UI", "Orbitron", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SYSTEM PAUSED', 640, by + 48);

    const opts =
      this.mode === 'training'
        ? [
            'RESUME COMBAT',
            'COMMAND LIST & FRAME DATA',
            `HITBOX OVERLAY: ${this.training.showHitboxes ? 'ON' : 'OFF'}`,
            'RESTART SESSION',
            'CHARACTER SELECT',
            'MAIN MENU'
          ]
        : [
            'RESUME COMBAT',
            'COMMAND LIST & FRAME DATA',
            'RESTART MATCH',
            'CHARACTER SELECT',
            'MAIN MENU'
          ];

    for (let i = 0; i < opts.length; i++) {
      const oy = by + 92 + i * 46;
      const sel = i === this.pauseIndex;

      ctx.fillStyle = sel ? 'rgba(0, 240, 255, 0.22)' : 'rgba(12, 24, 48, 0.8)';
      ctx.strokeStyle = sel ? '#00f0ff' : 'rgba(0, 240, 255, 0.2)';
      ctx.lineWidth = sel ? 2 : 1;
      ctx.fillRect(bx + 36, oy - 24, bw - 72, 36);
      ctx.strokeRect(bx + 36, oy - 24, bw - 72, 36);

      ctx.fillStyle = sel ? '#00f0ff' : '#ffffff';
      ctx.font = 'bold 15px "Segoe UI", "Orbitron", sans-serif';
      ctx.fillText(opts[i], 640, oy);
    }

    ctx.restore();
  }

  private renderResultsScene(ctx: CanvasRenderingContext2D): void {
    if (!this.matchState) return;
    const state = this.matchState;
    const winIdx = state.p1RoundsWon >= state.p2RoundsWon ? 0 : 1;
    const winner = state.fighters[winIdx];
    const winChar = CHARACTERS[winner.charId];

    this.stageRenderer.renderStage(ctx, state.stageId, 0, 0, 1.0, this.sceneFrame);
    ctx.fillStyle = 'rgba(3, 8, 22, 0.92)';
    ctx.fillRect(0, 0, 1280, 720);

    ctx.save();
    // Main Results Cyber Frame
    ctx.fillStyle = 'rgba(5, 11, 26, 0.94)';
    ctx.strokeStyle = winChar.palette.primary;
    ctx.lineWidth = 2;
    ctx.fillRect(65, 85, 1150, 565);
    ctx.strokeRect(65, 85, 1150, 565);

    this.fighterRenderer.renderCharacterPortrait(
      ctx,
      winChar.id,
      95,
      115,
      360,
      360,
      winner.useAltPalette,
      this.sceneFrame
    );

    // Victory Rank Badge below portrait
    const rank =
      state.finishType === 'PERFECT' || state.finishType === 'ULTIMATE_KO'
        ? 'S-RANK // SUPREME OVERLORD'
        : state.finishType === 'SUPER_KO'
        ? 'A-RANK // HYPER EXECUTION'
        : 'B-RANK // COMBAT VICTOR';
    ctx.fillStyle = 'rgba(10, 22, 46, 0.95)';
    ctx.strokeStyle = '#ffbe00';
    ctx.lineWidth = 2;
    ctx.fillRect(95, 495, 360, 48);
    ctx.strokeRect(95, 495, 360, 48);
    ctx.fillStyle = '#ffbe00';
    ctx.font = 'bold 15px "Segoe UI", "Orbitron", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`★ ${rank} ★`, 275, 525);

    ctx.textAlign = 'left';
    ctx.fillStyle = winChar.palette.primary;
    ctx.font = 'bold 16px "Consolas", monospace';
    ctx.fillText(
      `VICTOR // ${winIdx === 0 ? 'PLAYER 1' : this.mode === 'versus_2p' ? 'PLAYER 2' : 'CPU'}  [${winChar.archetype}]`,
      490,
      140
    );

    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = winChar.palette.primary;
    ctx.shadowBlur = 22;
    ctx.font = 'italic 900 58px "Segoe UI", "Orbitron", sans-serif';
    ctx.fillText(`${winChar.name} WINS`, 490, 200);

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#e0f4ff';
    ctx.font = 'italic 17px "Segoe UI", sans-serif';
    ctx.fillText(`"${winChar.quoteWin}"`, 490, 240);

    // Match Telemetry Card with visual stat bars
    ctx.fillStyle = 'rgba(8, 18, 40, 0.95)';
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.fillRect(490, 265, 685, 155);
    ctx.strokeRect(490, 265, 685, 155);

    ctx.fillStyle = '#00f0ff';
    ctx.font = 'bold 14px "Consolas", monospace';
    ctx.fillText(
      `FINAL SCORE: P1 [${state.p1RoundsWon}] — P2 [${state.p2RoundsWon}]     FINISH: ${state.finishType}`,
      515,
      298
    );

    const p1MaxDmg = state.fighters[1].lastComboTotalDamage;
    const p2MaxDmg = state.fighters[0].lastComboTotalDamage;
    const p1VitalityPct = Math.round((state.fighters[0].hp / state.fighters[0].maxHp) * 100);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(
      `P1 MAX COMBO: ${p1MaxDmg} DMG (${state.fighters[1].lastComboTotalHits} HITS)`,
      515,
      334
    );
    ctx.fillStyle = '#102244';
    ctx.fillRect(830, 322, 315, 14);
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(830, 322, Math.min(315, Math.max(12, (p1MaxDmg / 500) * 315)), 14);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(
      `P2 MAX COMBO: ${p2MaxDmg} DMG (${state.fighters[0].lastComboTotalHits} HITS)`,
      515,
      366
    );
    ctx.fillStyle = '#102244';
    ctx.fillRect(830, 354, 315, 14);
    ctx.fillStyle = '#ff00aa';
    ctx.fillRect(830, 354, Math.min(315, Math.max(8, (p2MaxDmg / 500) * 315)), 14);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(`P1 REMAINING VITALITY: ${p1VitalityPct}%`, 515, 398);
    ctx.fillStyle = '#102244';
    ctx.fillRect(830, 386, 315, 14);
    ctx.fillStyle = '#00ff9d';
    ctx.fillRect(830, 386, Math.round((p1VitalityPct / 100) * 315), 14);

    // Action Buttons
    const firstLabel =
      this.mode === 'arcade' && winIdx === 0
        ? this.arcadeStageIndex >= 3
          ? 'VIEW ARCADE ENDING'
          : 'NEXT ARCADE CHALLENGER'
        : 'REMATCH IMMEDIATELY';
    const opts = [
      firstLabel,
      'WATCH MATCH REPLAY',
      'CHARACTER SELECT',
      'RETURN TO MAIN MENU'
    ];

    for (let i = 0; i < opts.length; i++) {
      const sel = i === this.resultsIndex;
      const oy = 440 + i * 48;
      ctx.fillStyle = sel ? 'rgba(0, 240, 255, 0.25)' : 'rgba(10, 22, 48, 0.85)';
      ctx.strokeStyle = sel ? '#00f0ff' : 'rgba(0, 240, 255, 0.25)';
      ctx.lineWidth = sel ? 2.5 : 1;
      ctx.fillRect(490, oy, 460, 40);
      ctx.strokeRect(490, oy, 460, 40);

      ctx.fillStyle = sel ? '#00f0ff' : '#ffffff';
      ctx.font = 'bold 15px "Segoe UI", "Orbitron", sans-serif';
      ctx.fillText(opts[i], 515, oy + 25);
    }

    ctx.restore();
  }

  private renderArcadeEndingScene(ctx: CanvasRenderingContext2D): void {
    const p1Char = CHARACTER_LIST[this.p1Cursor];
    this.stageRenderer.renderStage(ctx, 'rooftop', 0, 0, 1.0, this.sceneFrame);
    ctx.fillStyle = 'rgba(2, 6, 18, 0.9)';
    ctx.fillRect(0, 0, 1280, 720);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffbe00';
    ctx.font = 'bold 18px "Consolas", monospace';
    ctx.fillText('NEON TEMPEST // TOURNAMENT CHAMPION', 640, 110);

    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = p1Char.palette.primary;
    ctx.shadowBlur = 24;
    ctx.font = 'italic 900 54px "Segoe UI", "Orbitron", sans-serif';
    ctx.fillText(`${p1Char.name} // EPILOGUE`, 640, 170);

    this.fighterRenderer.renderCharacterPortrait(
      ctx,
      p1Char.id,
      500,
      210,
      280,
      240,
      this.p1AltColor,
      this.sceneFrame
    );

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#d8f4ff';
    ctx.font = '18px "Segoe UI", sans-serif';
    ctx.fillText(p1Char.arcadeEnding, 640, 515);

    ctx.fillStyle = '#00f0ff';
    ctx.font = 'bold 16px "Consolas", monospace';
    ctx.fillText('PRESS ENTER TO RETURN TO MAIN TERMINAL', 640, 620);
    ctx.restore();
  }

  private renderSettingsScene(ctx: CanvasRenderingContext2D): void {
    this.stageRenderer.renderStage(ctx, 'alley', 0, 0, 1.0, this.sceneFrame);
    ctx.fillStyle = 'rgba(3, 7, 18, 0.94)';
    ctx.fillRect(0, 0, 1280, 720);

    ctx.save();
    ctx.fillStyle = '#00f0ff';
    ctx.font = 'italic 900 34px "Segoe UI", "Orbitron", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('SYSTEM CONFIGURATION', 100, 76);

    // Tabs
    const tabs: [typeof this.settingsTab, string][] = [
      ['general', 'AUDIO / DISPLAY / GAMEPLAY'],
      ['p1_keys', 'PLAYER 1 CONTROLS'],
      ['p2_keys', 'PLAYER 2 CONTROLS']
    ];
    for (let i = 0; i < tabs.length; i++) {
      const [id, label] = tabs[i];
      const active = this.settingsTab === id;
      const tx = 100 + i * 310;
      ctx.fillStyle = active ? '#00f0ff' : 'rgba(12, 24, 48, 0.9)';
      ctx.fillRect(tx, 96, 295, 36);
      ctx.strokeStyle = '#00f0ff';
      ctx.strokeRect(tx, 96, 295, 36);

      ctx.fillStyle = active ? '#020612' : '#ffffff';
      ctx.font = 'bold 14px "Segoe UI", "Orbitron", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, tx + 147, 119);
    }

    ctx.textAlign = 'left';
    const v = this.settings.values;

    if (this.settingsTab === 'general') {
      const rows: [string, string][] = [
        ['MASTER VOLUME', `${v.masterVolume}%`],
        ['MUSIC SYNTH VOLUME', `${v.musicVolume}%`],
        ['COMBAT SFX VOLUME', `${v.sfxVolume}%`],
        ['MUTE ALL AUDIO', v.muted ? 'MUTED' : 'ACTIVE'],
        ['CPU AI DIFFICULTY', v.cpuDifficulty.toUpperCase()],
        ['IMPACT SCREEN SHAKE', v.screenShake ? 'ENABLED' : 'DISABLED'],
        ['FLASH REDUCTION (PHOTOSENSITIVITY)', v.reduceFlashes ? 'ENABLED' : 'DISABLED'],
        ['COLORBLIND HIGH-CONTRAST PALETTE', v.colorblindMode ? 'ENABLED' : 'DISABLED'],
        ['SHOW IN-MATCH HUD', v.showHud ? 'VISIBLE' : 'HIDDEN'],
        ['SHOW LIVE INPUT TELEMETRY', v.showInputHistory ? 'VISIBLE' : 'HIDDEN'],
        ['INTERNAL RESOLUTION SCALE', `${v.resolutionScale}x`]
      ];

      for (let i = 0; i < rows.length; i++) {
        const ry = 166 + i * 42;
        const sel = i === this.settingsRowIndex;
        ctx.fillStyle = sel ? 'rgba(0, 240, 255, 0.2)' : 'rgba(8, 18, 38, 0.8)';
        ctx.fillRect(100, ry - 24, 1080, 34);
        if (sel) {
          ctx.strokeStyle = '#00f0ff';
          ctx.strokeRect(100, ry - 24, 1080, 34);
        }

        ctx.fillStyle = sel ? '#00f0ff' : '#ffffff';
        ctx.font = 'bold 15px "Consolas", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(rows[i][0], 124, ry - 2);

        ctx.fillStyle = '#ffbe00';
        ctx.textAlign = 'right';
        ctx.fillText(`<  ${rows[i][1]}  >`, 1156, ry - 2);
      }
    } else {
      const binds =
        this.settingsTab === 'p1_keys' ? this.input.p1Keys : this.input.p2Keys;
      const keyRows: [string, string][] = [
        ['JUMP / UP', formatKeyCode(binds.up)],
        ['CROUCH / DOWN', formatKeyCode(binds.down)],
        ['MOVE LEFT', formatKeyCode(binds.left)],
        ['MOVE RIGHT', formatKeyCode(binds.right)],
        ['LIGHT PUNCH (LP)', formatKeyCode(binds.lp)],
        ['MEDIUM PUNCH (MP)', formatKeyCode(binds.mp)],
        ['HEAVY PUNCH (HP)', formatKeyCode(binds.hp)],
        ['LIGHT KICK (LK)', formatKeyCode(binds.lk)],
        ['MEDIUM KICK (MK)', formatKeyCode(binds.mk)],
        ['HEAVY KICK (HK)', formatKeyCode(binds.hk)],
        ['CYBER PARRY MACRO (MP+MK)', formatKeyCode(binds.parryMacro)],
        ['RESET BINDINGS TO DEFAULT', 'PRESS ENTER']
      ];

      for (let i = 0; i < keyRows.length; i++) {
        const ry = 164 + i * 39;
        const sel = i === this.settingsRowIndex;
        ctx.fillStyle = sel ? 'rgba(0, 240, 255, 0.2)' : 'rgba(8, 18, 38, 0.8)';
        ctx.fillRect(100, ry - 22, 1080, 32);
        if (sel) {
          ctx.strokeStyle = '#00f0ff';
          ctx.strokeRect(100, ry - 22, 1080, 32);
        }

        ctx.fillStyle = sel ? '#00f0ff' : '#ffffff';
        ctx.font = 'bold 14px "Consolas", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(keyRows[i][0], 124, ry - 2);

        ctx.fillStyle =
          sel && this.input.isListening() ? '#ff0055' : '#ffbe00';
        ctx.textAlign = 'right';
        ctx.fillText(
          sel && this.input.isListening() ? 'PRESS ANY KEY...' : `[ ${keyRows[i][1]} ]`,
          1156,
          ry - 2
        );
      }
    }

    ctx.fillStyle = '#00f0ff';
    ctx.font = 'bold 13px "Consolas", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      '[TAB] SWITCH CONFIG TAB     [↑ / ↓] SELECT     [← / → / ENTER] MODIFY     [ESC] SAVE & EXIT',
      640,
      674
    );
    ctx.restore();
  }
}
