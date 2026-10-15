/**
 * Global application services: view, input, audio, loop, scene manager and shared game data
 * (last replay, arcade progress). Created once in main.ts.
 */
import { audio } from '../audio/audio';
import type { AudioAPI, SfxName, SfxOptions } from '../audio/types';
import { Input } from '../input/input';
import { setRigPixelRatio } from '../render/rig';
import { SceneManager, type Scene, type TransitionKind } from '../scenes/scene';
import type { MatchConfig } from '../sim/types';
import { setLanguage } from '../ui/strings';
import { Loop } from './loop';
import { onSettingsChange, settings } from './settings';
import { View } from './view';

export interface ReplayData {
  config: MatchConfig;
  inputs: number[];
  frames: number;
  names: [string, string];
  date: number;
}

export interface MatchSetup {
  mode: 'arcade' | 'versus' | 'cpu' | 'training' | 'trials' | 'replay' | 'attract';
  chars: [string, string];
  palettes: [number, number];
  stage: string;
  /** CPU control per side. */
  cpu: [boolean, boolean];
  difficulty: number;
  arcadeIndex?: number;
  trialIndex?: number;
}

export class App {
  readonly view: View;
  readonly input: Input;
  readonly audio: AudioAPI;
  readonly scenes = new SceneManager();
  readonly loop: Loop;
  lastReplay: ReplayData | null = null;
  /** End frame + state hash of the last finished match (replay verification). */
  lastMatchEnd: { frame: number; hash: number; replay: boolean } | null = null;
  arcade: { char: string; palette: number; ladder: string[]; index: number; continues: number; difficulty: number } | null = null;
  fps = 60;
  private fpsAcc = 0;
  private fpsN = 0;
  private hooksRender: ((ctx: CanvasRenderingContext2D) => void)[] = [];
  /** Frame-time samples for the benchmark (ms). */
  frameTimes: number[] = [];
  recordFrameTimes = false;

  constructor(canvas: HTMLCanvasElement) {
    this.view = new View(canvas);
    this.input = new Input(this.view);
    this.audio = audio;
    this.view.onResize(() => setRigPixelRatio(this.view.pixelRatio / this.view.resScale));
    this.view.setResolutionScale(settings.resolutionScale > 0 ? settings.resolutionScale : 1);
    this.applyAudioSettings();
    setLanguage(settings.language);
    onSettingsChange(() => {
      this.applyAudioSettings();
      if (settings.resolutionScale > 0 && this.view.resScale !== settings.resolutionScale) this.view.setResolutionScale(settings.resolutionScale);
      if (settings.resolutionScale === 0) this.autoScale = this.view.resScale;
    });
    this.loop = new Loop({
      beforeUpdate: () => this.input.poll(),
      update: () => {
        this.scenes.update();
      },
      render: (alpha, ms) => {
        const t0 = performance.now();
        const ctx = this.view.ctx;
        this.view.begin();
        this.scenes.render(ctx, alpha);
        for (const h of this.hooksRender) h(ctx);
        if (settings.showFps) this.drawFps(ctx);
        this.view.end();
        this.input.endFrame();
        this.fpsAcc += ms; this.fpsN++;
        if (this.fpsAcc >= 500) { this.fps = (this.fpsN * 1000) / this.fpsAcc; this.fpsAcc = 0; this.fpsN = 0; }
        this.adaptResolution(ms);
        if (this.recordFrameTimes) this.frameTimes.push(ms, performance.now() - t0);
      },
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.audio.suspend();
        this.scenes.current?.onHidden();
      } else {
        this.audio.resume();
        this.loop.resetClock();
      }
    });
    // unlock audio on first gesture
    const unlock = () => {
      // only real user activations may start audio (e.g. Escape is not an activation in Chrome)
      const ua = (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation;
      if (ua && !ua.isActive) return;
      this.audio.unlock();
    };
    window.addEventListener('keydown', unlock, { once: false });
    window.addEventListener('pointerdown', unlock, { once: false });
  }

  /** Dynamic resolution (settings.resolutionScale === 0 = AUTO): keeps 60 FPS on weak GPUs. */
  autoScale = 1;
  private slowFrames = 0;
  private fastFrames = 0;
  private ceiling = 1;
  private ceilingT = 0;
  private adaptResolution(ms: number): void {
    if (settings.resolutionScale !== 0 || document.hidden) return;
    if (ms > 250) return;
    if (ms > 19.5) { this.slowFrames++; this.fastFrames = 0; }
    else { this.fastFrames++; if (this.slowFrames > 0) this.slowFrames -= 0.25; }
    if (this.ceilingT > 0) this.ceilingT--;
    else this.ceiling = 1;
    if (this.slowFrames > 40 && this.autoScale > 0.55) {
      this.ceiling = this.autoScale;
      this.ceilingT = 60 * 30;
      this.autoScale = Math.max(0.55, Math.round((this.autoScale - 0.1) * 100) / 100);
      this.view.setResolutionScale(this.autoScale);
      this.slowFrames = 0;
    } else if (this.fastFrames > 60 * 6 && this.autoScale < Math.min(1, this.ceiling - 0.04)) {
      this.autoScale = Math.min(1, Math.round((this.autoScale + 0.05) * 100) / 100);
      this.view.setResolutionScale(this.autoScale);
      this.fastFrames = 0;
    }
  }

  applyAudioSettings(): void {
    this.audio.setVolumes(settings.master, settings.music, settings.sfx, settings.muted);
  }

  go(scene: Scene, kind: TransitionKind = 'wipe', frames = 36): void {
    this.scenes.go(scene, kind, frames);
  }

  sfx(name: SfxName, opts?: SfxOptions): void {
    this.audio.sfx(name, opts);
  }

  start(): void {
    this.loop.start();
  }

  toggleFullscreen(): void {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  }

  private drawFps(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.font = '600 12px Consolas, monospace';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(1180, 700, 96, 18);
    ctx.fillStyle = this.fps > 55 ? '#6dff9e' : '#ffb238';
    ctx.textAlign = 'right';
    ctx.fillText(`${this.fps.toFixed(0)} FPS`, 1270, 713);
    ctx.restore();
  }
}

let appInstance: App | null = null;
export function setApp(a: App): void { appInstance = a; }
export function app(): App {
  if (!appInstance) throw new Error('App not initialized');
  return appInstance;
}
