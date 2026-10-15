/**
 * Pause overlay for matches (also hosts the move list, settings and training option panels).
 */
import { app } from '../../core/app';
import type { MenuEvent } from '../../input/input';
import { MenuList, overlayBackdrop, type MenuItem } from '../../ui/menu';
import { MoveListPanel } from '../../ui/movelistPanel';
import { SettingsPanel } from '../../ui/settingsPanel';
import { t } from '../../ui/strings';
import { drawStrokeText } from '../../ui/strokeFont';
import { C, ease, clamp01 } from '../../ui/theme';
import { text } from '../../ui/draw';
import * as flow from '../flow';
import type { MatchScene } from './matchScene';

export class PauseMenu {
  private list: MenuList;
  private sub: MoveListPanel | SettingsPanel | null = null;
  private trainingList: MenuList | null = null;
  private t = 0;

  constructor(private scene: MatchScene) {
    this.list = new MenuList(this.items(), { x: 470, y: 250, w: 340, itemH: 50, size: 24, accent: C.cyan });
    this.list.onBack = () => this.resume();
  }

  private items(): MenuItem[] {
    const sc = this.scene;
    const mode = sc.setup.mode;
    const items: MenuItem[] = [{ id: 'resume', label: t('pause.resume'), onSelect: () => this.resume() }];
    if (mode === 'training') items.push({ id: 'training', label: t('pause.training'), onSelect: () => this.openTraining() });
    if (mode === 'trials') {
      items.push({ id: 'nextTrial', label: t('trials.next'), onSelect: () => { sc.trials?.next(); this.resume(); } });
      items.push({ id: 'prevTrial', label: t('trials.prev'), onSelect: () => { sc.trials?.prev(); this.resume(); } });
    }
    if (mode === 'replay') {
      items.push({ id: 'speed', label: t('replay.speed'), value: () => `${sc.replaySpeed}x`, onAdjust: (d) => { sc.replaySpeed = Math.max(0.25, Math.min(4, d > 0 ? sc.replaySpeed * 2 : sc.replaySpeed / 2)); } });
      items.push({ id: 'restart', label: t('replay.restart'), onSelect: () => { sc.restart(); this.resume(); } });
    }
    items.push({ id: 'moves', label: t('pause.movelist'), onSelect: () => this.openSub(new MoveListPanel(sc.s.config.chars[0], mode === 'training')) });
    items.push({ id: 'settings', label: t('pause.settings'), onSelect: () => this.openSub(new SettingsPanel()) });
    if (mode !== 'replay' && mode !== 'trials') items.push({ id: 'restart', label: t('pause.restart'), onSelect: () => { sc.restart(); this.resume(); } });
    if (mode !== 'replay' && mode !== 'arcade') items.push({ id: 'char', label: t('pause.charselect'), onSelect: () => { this.resume(); flow.toCharSelect(mode === 'trials' ? 'trials' : mode === 'training' ? 'training' : mode === 'versus' ? 'versus' : 'cpu'); } });
    items.push({ id: 'quit', label: t('pause.quit'), onSelect: () => { this.resume(); flow.toMainMenu(); } });
    return items;
  }

  open(): void {
    this.t = 0;
    this.sub = null;
    this.trainingList = null;
    this.list = new MenuList(this.items(), { x: 470, y: 250, w: 340, itemH: 50, size: 24, accent: C.cyan });
    this.list.onBack = () => this.resume();
    app().sfx('ui_start');
  }

  private resume(): void {
    this.scene.closePause();
    app().input.clearMenu();
  }

  private openSub(p: MoveListPanel | SettingsPanel): void {
    this.sub = p;
    p.onClose = () => { this.sub = null; };
  }

  private openTraining(): void {
    const tr = this.scene.training;
    if (!tr) return;
    this.trainingList = tr.menu(() => { this.trainingList = null; });
  }

  update(events: MenuEvent[]): void {
    this.t++;
    if (this.sub) { this.sub.update(events); return; }
    if (this.trainingList) { this.trainingList.update(events); return; }
    if (events.some((e) => e.k === 'pause')) { app().sfx('ui_back'); this.resume(); return; }
    this.list.update(events);
  }

  render(ctx: CanvasRenderingContext2D): void {
    const k = ease.outCubic(clamp01(this.t / 12));
    overlayBackdrop(ctx, k);
    if (this.sub) { this.sub.render(ctx); return; }
    if (this.trainingList) {
      drawStrokeText(ctx, t('training.title'), 640, 120, { size: 30, color: C.lime, align: 'center', tracking: 0.8 });
      this.trainingList.render(ctx, 1, 1);
      text(ctx, t('hint.training'), 640, 670, { size: 12, weight: 700, font: 'display', tracking: 2, align: 'center', color: C.dim });
      return;
    }
    drawStrokeText(ctx, t('pause.title'), 640, 150 - (1 - k) * 30, { size: 46, color: C.cyan, align: 'center', tracking: 1, alpha: k });
    ctx.fillStyle = `rgba(39,232,255,${0.4 * k})`;
    ctx.fillRect(640 - 200 * k, 214, 400 * k, 1);
    this.list.render(ctx, k, clamp01(this.t / 20));
  }
}
