/**
 * The match scene: runs the deterministic simulation at 60 Hz with input from controllers,
 * records the replay, drives presentation (fighters, stage, camera, particles, HUD, cut-ins),
 * and hosts the pause menu, training mode and trials.
 */
import { app, type MatchSetup, type ReplayData } from '../../core/app';
import { settings } from '../../core/settings';
import { H, W } from '../../core/view';
import { CutIn } from '../../render/cutin';
import { FighterView } from '../../render/fighterView';
import { Hud } from '../../render/hud';
import { drawProjectiles, updateProjectileFx } from '../../render/projectiles';
import { ZOOM_FAR, ZOOM_NEAR, clampCamera, makeCamera, sx, sy, type Camera } from '../../render/camera';
import { createStage } from '../../render/stages/index';
import type { Stage } from '../../render/stages/types';
import { createMatch, defaultConfig, stepMatch } from '../../sim/match';
import { hashState } from '../../sim/hash';
import { getChar } from '../../sim/registry';
import { FP, type MatchConfig, type MatchState } from '../../sim/types';
import { C, rgba } from '../../ui/theme';
import { t } from '../../ui/strings';
import { Particles } from '../../vfx/particles';
import type { DrawOpts } from '../../render/bodyDraw';
import { Scene } from '../scene';
import { HumanController, ReplayController, type Controller } from './controllers';
import { addShake, handleEvents, type ShakeState } from './effects';
import { CpuController } from '../../ai/cpu';
import { PauseMenu } from './pauseMenu';
import { TrainingMode } from './training';
import { TrialMode } from './trials';
import { drawHitboxes } from '../../render/debugBoxes';

export interface MatchHooks {
  onMatchEnd?(scene: MatchScene): void;
}

export class MatchScene extends Scene {
  readonly id = 'MatchScene';
  s: MatchState;
  readonly setup: MatchSetup;
  readonly config: MatchConfig;
  views: [FighterView, FighterView];
  cam: Camera = makeCamera();
  stage: Stage;
  vfx = new Particles();
  hud: Hud;
  cutin = new CutIn();
  controllers: [Controller, Controller];
  shake: ShakeState = { amp: 0, t: 0 };
  recorded: number[] = [];
  paused = false;
  pause: PauseMenu;
  training: TrainingMode | null = null;
  trials: TrialMode | null = null;
  lastInputs: [number, number] = [0, 0];
  /** Frame and state hash when the match ended (replay verification). */
  endFrame = -1;
  endHash = 0;
  /** Scripted input frames per player (automation only). */
  inputQueue: [number[], number[]] = [[], []];
  endTimer = 0;
  replaySpeed = 1;
  private stageTime = 0;
  private koZoom = 0;
  private opts: [DrawOpts, DrawOpts];
  private hooks: MatchHooks;
  private replayData: ReplayData | null;
  private ended = false;

  constructor(setup: MatchSetup, hooks: MatchHooks = {}, replay: ReplayData | null = null) {
    super();
    this.setup = setup;
    this.hooks = hooks;
    this.replayData = replay;
    const training = setup.mode === 'training' || setup.mode === 'trials';
    this.config = replay ? structuredClone(replay.config) : defaultConfig({
      chars: setup.chars,
      palettes: setup.palettes,
      stage: setup.stage,
      seed: (Date.now() & 0x7fffffff) | 1,
      training,
      roundTime: training ? 0 : 99,
      skipIntro: training,
      trainingOpts: { infiniteHp: true, infiniteMeter: setup.mode === 'training', noStun: setup.mode === 'trials' },
    });
    this.s = createMatch(this.config);
    this.views = [new FighterView(this.config.chars[0], this.config.palettes[0]), new FighterView(this.config.chars[1], this.config.palettes[1])];
    this.stage = createStage(this.config.stage, { flashReduction: settings.flashReduction });
    this.hud = new Hud(this.s);
    this.hud.trainingMode = training;
    this.controllers = this.makeControllers();
    this.pause = new PauseMenu(this);
    if (setup.mode === 'training') this.training = new TrainingMode(this);
    if (setup.mode === 'trials') this.trials = new TrialMode(this, setup.trialIndex ?? 0);
    const rim: [string, string] = [this.stage.light.rim, C.magenta];
    this.opts = [0, 1].map(() => ({ flat: null, rimA: rim[0], rimB: rim[1], glow: true, t: 0, energy: 0 })) as [DrawOpts, DrawOpts];
    this.vfx.quality = 2;
    for (const v of this.views) v.setLight(this.stage.light.rim, C.magenta);
  }

  private makeControllers(): [Controller, Controller] {
    if (this.replayData) {
      return [new ReplayController(this.replayData.inputs, 0), new ReplayController(this.replayData.inputs, 1)];
    }
    const mk = (i: 0 | 1): Controller => {
      if (this.setup.cpu[i]) return new CpuController(i, this.setup.difficulty, this.config.seed + i * 7919);
      return new HumanController(this.setup.mode === 'versus' ? i : 0);
    };
    return [mk(0), mk(1)];
  }

  enter(): void {
    const dpr = app().view.pixelRatio;
    this.stage.init(dpr, 2);
    app().input.singlePlayer = this.setup.mode !== 'versus';
    app().audio.music(this.setup.mode === 'training' || this.setup.mode === 'trials' ? 'training' : (this.stage.info.music as never));
    app().audio.ambience(this.stage.info.ambience);
    app().audio.setMuffled(false);
    this.cam.x = 0;
    this.cam.zoom = 1;
    for (let i = 0; i < 2; i++) this.views[i].update(this.s.fighters[i], 0.2);
  }

  exit(): void {
    this.stage.dispose();
    app().audio.setMuffled(false);
    app().input.singlePlayer = true;
  }

  onHidden(): void {
    if (this.setup.mode !== 'replay' && this.setup.mode !== 'attract' && !this.paused) this.openPause();
  }

  openPause(): void {
    this.paused = true;
    this.pause.open();
    app().audio.setMuffled(true);
  }

  closePause(): void {
    this.paused = false;
    app().audio.setMuffled(false);
  }

  get isReplay(): boolean { return !!this.replayData; }

  update(): void {
    const input = app().input;
    const menu = input.menuEventsTagged();
    if (this.paused) {
      this.pause.update(menu);
      return;
    }
    if (menu.some((e) => e.k === 'pause' || e.k === 'start')) {
      if (this.setup.mode === 'attract') { this.hooks.onMatchEnd?.(this); return; }
      this.openPause();
      return;
    }
    if (this.isReplay) {
      for (const e of menu) {
        if (e.k === 'right') this.replaySpeed = Math.min(4, this.replaySpeed * 2);
        if (e.k === 'left') this.replaySpeed = Math.max(0.25, this.replaySpeed / 2);
      }
      this.replayAcc += this.replaySpeed;
      while (this.replayAcc >= 1) { this.replayAcc--; this.tick(); }
      return;
    }
    if (this.setup.mode === 'attract' && input.anyInputThisFrame) { this.hooks.onMatchEnd?.(this); return; }
    this.training?.preTick(menu);
    this.tick();
  }

  private replayAcc = 0;

  /** One simulation step plus presentation updates. */
  tick(): void {
    const s = this.s;
    const inputs: [number, number] = [0, 0];
    for (let i = 0; i < 2; i++) inputs[i] = this.controllers[i].next(s, i);
    if (this.training) this.training.filterInputs(inputs);
    // automation (tests / screenshots): queued inputs override controllers
    for (let i = 0; i < 2; i++) if (this.inputQueue[i].length) inputs[i] = this.inputQueue[i].shift()!;
    this.lastInputs = inputs;
    if (!this.isReplay && s.phase !== 'matchEnd') this.recorded.push(inputs[0], inputs[1]);
    const wasFreeze = s.freeze;
    const wasEnd = s.phase === 'matchEnd';
    stepMatch(s, inputs);
    if (!wasEnd && s.phase === 'matchEnd') {
      this.endFrame = s.frame;
      this.endHash = hashState(s);
      app().lastMatchEnd = { frame: this.endFrame, hash: this.endHash, replay: this.isReplay };
    }
    if (s.freeze > 0 && wasFreeze === 0) this.cutin.start(s);
    handleEvents(s, s.events, this.vfx, app().audio, this.stage, this.shake, this.cam.x);
    this.hud.onEvents(s, s.events);
    this.training?.onEvents(s.events);
    this.trials?.onEvents(s.events);
    for (const e of s.events) {
      if (e.t === 'ko') this.koZoom = 1;
      if (e.t === 'matchEnd') app().audio.music('victory');
    }
    const frozen = s.freeze > 0;
    if (!frozen) {
      const wind = 0.25 + Math.sin(this.stageTime * 0.7) * 0.15;
      for (let i = 0; i < 2; i++) this.views[i].update(s.fighters[i], wind);
      updateProjectileFx(s, this.vfx);
      this.vfx.update();
    }
    this.cutin.update(s);
    this.hud.update(s, inputs);
    this.updateCamera();
    this.stageTime += 1 / 60;
    this.stage.update(this.stageTime, this.cam);
    this.training?.postTick();
    this.trials?.postTick();
    if (s.phase === 'matchEnd' && !this.ended) {
      this.endTimer++;
      if (this.endTimer === 100) this.finish();
    }
  }

  private finish(): void {
    this.ended = true;
    if (!this.isReplay && this.setup.mode !== 'attract') {
      app().lastReplay = {
        config: structuredClone(this.config),
        inputs: this.recorded.slice(),
        frames: this.recorded.length / 2,
        names: [getChar(this.config.chars[0]).name, getChar(this.config.chars[1]).name],
        date: Date.now(),
      };
    }
    this.hooks.onMatchEnd?.(this);
  }

  restart(): void {
    if (this.replayData) {
      this.s = createMatch(structuredClone(this.replayData.config));
      this.controllers = this.makeControllers();
    } else {
      this.config.seed = (this.config.seed * 1103515245 + 12345) & 0x7fffffff;
      this.s = createMatch(this.config);
      this.controllers = this.makeControllers();
      this.recorded = [];
    }
    this.hud = new Hud(this.s);
    this.hud.trainingMode = !!this.training || !!this.trials;
    this.vfx.clear();
    this.ended = false;
    this.endTimer = 0;
    this.koZoom = 0;
    this.views = [new FighterView(this.config.chars[0], this.config.palettes[0]), new FighterView(this.config.chars[1], this.config.palettes[1])];
    for (const v of this.views) v.setLight(this.stage.light.rim, C.magenta);
    for (let i = 0; i < 2; i++) this.views[i].update(this.s.fighters[i], 0.2);
    this.training?.onRestart();
    this.trials?.onRestart();
  }

  private updateCamera(): void {
    const s = this.s;
    const [a, b] = this.views;
    const cam = this.cam;
    let tx = (a.x + b.x) / 2;
    const dist = Math.abs(a.x - b.x);
    let tz = ZOOM_NEAR + (ZOOM_FAR - ZOOM_NEAR) * Math.max(0, Math.min(1, (dist - 240) / 640));
    const maxY = Math.max(a.y, b.y);
    let ty = Math.max(0, maxY - 150) * 0.5;
    let kx = 0.16, kz = 0.07;
    if (s.freeze > 0 && (s.freezeKind === 'super' || s.freezeKind === 'ultimate')) {
      const o = this.views[s.freezeOwner];
      tx = tx * 0.4 + o.x * 0.6;
      tz = 1.22;
      kz = 0.12;
    }
    if (s.phase === 'ko' && this.koZoom > 0 && s.slowmo > 0) {
      const loser = s.roundWinner === 0 ? b : s.roundWinner === 1 ? a : null;
      if (loser) { tx = loser.x * 0.7 + tx * 0.3; ty = Math.max(ty, loser.y * 0.4); }
      tz = 1.32;
      kz = 0.1; kx = 0.12;
    }
    cam.x += (tx - cam.x) * kx;
    cam.y += (ty - cam.y) * 0.12;
    cam.zoom += (tz - cam.zoom) * kz;
    clampCamera(cam);
    // shake
    const sh = this.shake;
    if (sh.amp > 0.1) {
      sh.t++;
      cam.shakeX = Math.sin(sh.t * 2.7) * sh.amp;
      cam.shakeY = Math.cos(sh.t * 3.3) * sh.amp * 0.7;
      sh.amp *= 0.86;
    } else { cam.shakeX = 0; cam.shakeY = 0; sh.amp = 0; }
  }

  render(ctx: CanvasRenderingContext2D, alpha: number): void {
    const s = this.s;
    const cam = this.cam;
    const t = this.stageTime;
    this.stage.drawBack(ctx, cam, t);
    this.cutin.drawBackdrop(ctx, cam, s);
    // shadows
    for (let i = 0; i < 2; i++) {
      const v = this.views[i];
      const x = v.rx(alpha), y = v.ry(alpha);
      const k = Math.max(0.25, 1 - y / 300);
      const gx = W / 2 + (x - cam.x) * cam.zoom + cam.shakeX, gy = sy(cam, 0);
      ctx.fillStyle = `rgba(0,0,0,${0.5 * k})`;
      ctx.beginPath();
      ctx.ellipse(gx, gy + 2, 52 * cam.zoom * k * getChar(s.fighters[i].char).body.scale, 9 * cam.zoom * k, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // fighters: the attacking one drawn last
    const order = this.drawOrder();
    for (const i of order) {
      const o = this.opts[i];
      o.t = t;
      o.glow = true;
      this.views[i].draw(ctx, cam, s.fighters[i], alpha, o, this.stage.light.reflection);
    }
    drawProjectiles(ctx, cam, s, t);
    this.vfx.draw(ctx, cam);
    this.stage.drawFront(ctx, cam, t);
    if (this.training?.showBoxes) drawHitboxes(ctx, cam, s);
    this.drawCinematic(ctx, s);
    this.cutin.drawBand(ctx, s, this.views[s.freezeOwner >= 0 ? s.freezeOwner : 0]);
    this.hud.draw(ctx, s);
    this.drawPlayerTags(ctx, s, alpha);
    if (!this.paused) {
      this.training?.render(ctx);
      this.trials?.render(ctx);
    }
    this.hud.drawAnnouncer(ctx);
    if (this.isReplay) this.drawReplayBar(ctx);
    if (this.paused) this.pause.render(ctx);
  }

  private barK = 0;

  /** Letterbox bars during round intros and the KO slow motion. */
  private drawCinematic(ctx: CanvasRenderingContext2D, s: MatchState): void {
    const want = (s.phase === 'intro' && !s.config.skipIntro) || (s.phase === 'ko' && s.slowmo > 0) ? 1 : 0;
    this.barK += (want - this.barK) * 0.12;
    if (this.barK < 0.01) return;
    const h = 46 * this.barK;
    ctx.fillStyle = '#010104';
    ctx.fillRect(0, 0, W, h);
    ctx.fillRect(0, H - h, W, h);
    ctx.fillStyle = rgba(C.magenta, 0.5 * this.barK);
    ctx.fillRect(0, h, W, 1);
    ctx.fillStyle = rgba(C.cyan, 0.5 * this.barK);
    ctx.fillRect(0, H - h - 1, W, 1);
  }

  /** 1P / 2P / CPU markers above the fighters at the start of each round. */
  private drawPlayerTags(ctx: CanvasRenderingContext2D, s: MatchState, alpha: number): void {
    let a = 0;
    if (s.phase === 'intro') a = Math.min(1, s.phaseFrame / 20);
    else if (s.phase === 'fight' && s.phaseFrame < 100) a = 1 - s.phaseFrame / 100;
    if (a <= 0 || this.isReplay) return;
    for (let i = 0; i < 2; i++) {
      const v = this.views[i];
      const col = (settings.colorblind ? ['#3aa0ff', '#ffa630'] : [C.cyan, C.magenta])[i];
      const head = v.skel.head.y * v.char.body.scale;
      const x = sx(this.cam, v.rx(alpha)), y = sy(this.cam, v.ry(alpha) + head + 52) + Math.sin(this.stageTime * 5) * 3;
      const lbl = this.controllers[i].kind === 'cpu' ? 'CPU' : this.setup.mode === 'versus' ? (i === 0 ? '1P' : '2P') : i === 0 ? '1P' : 'CPU';
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(x - 7, y + 10); ctx.lineTo(x + 7, y + 10); ctx.lineTo(x, y + 18);
      ctx.fill();
      ctx.font = '900 15px "Bahnschrift", "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#03040a';
      ctx.strokeText(lbl, x, y + 4);
      ctx.fillText(lbl, x, y + 4);
      ctx.restore();
    }
  }

  private drawOrder(): number[] {
    const [a, b] = this.s.fighters;
    if (b.state === 'attack' && a.state !== 'attack') return [0, 1];
    if (a.state === 'attack' && b.state !== 'attack') return [1, 0];
    if (a.state === 'thrown') return [0, 1];
    if (b.state === 'thrown') return [1, 0];
    return [1, 0];
  }

  private drawReplayBar(ctx: CanvasRenderingContext2D): void {
    const total = (this.replayData?.inputs.length ?? 2) / 2;
    const prog = Math.min(1, this.s.frame / Math.max(1, total));
    ctx.save();
    ctx.fillStyle = 'rgba(4,6,16,0.8)';
    ctx.fillRect(W / 2 - 260, H - 40, 520, 28);
    ctx.fillStyle = rgba(C.cyan, 0.85);
    ctx.fillRect(W / 2 - 250, H - 18, 500 * prog, 3);
    ctx.font = '700 12px "Bahnschrift", "Segoe UI", sans-serif';
    ctx.fillStyle = C.white;
    ctx.textAlign = 'center';
    ctx.fillText(t('replay.bar', this.replaySpeed), W / 2, H - 23);
    ctx.restore();
  }

  addShake(a: number): void { addShake(this.shake, a); }
  get fps(): number { return app().fps; }
  get groundY(): number { return sy(this.cam, 0); }
  worldX(i: number): number { return this.s.fighters[i].x / FP; }
}
