/**
 * Training mode: dummy behaviours (stand / crouch / jump / CPU / record & playback), guard
 * settings, infinite resources, hitbox overlay, frame data readout (startup / active / recovery
 * and measured advantage) and input history.
 */
import { CpuController } from '../../ai/cpu';
import { app } from '../../core/app';
import { settings } from '../../core/settings';
import { W } from '../../core/view';
import type { MenuEvent } from '../../input/input';
import { curMove } from '../../sim/fighter';
import { DOWN, LEFT, RIGHT, UP } from '../../sim/input';
import { getMove, moveTotal } from '../../sim/registry';
import type { SimEvent } from '../../sim/types';
import { chamferPath, text } from '../../ui/draw';
import { MenuList, type MenuItem } from '../../ui/menu';
import { frameRow } from '../../ui/movelistPanel';
import { t } from '../../ui/strings';
import { C, rgba } from '../../ui/theme';
import type { MatchScene } from './matchScene';

type DummyAction = 'stand' | 'crouch' | 'jump' | 'cpu' | 'playback';
type Guard = 'none' | 'all' | 'after hit' | 'random';

const ACTIONS: DummyAction[] = ['stand', 'crouch', 'jump', 'cpu', 'playback'];
const GUARDS: Guard[] = ['none', 'all', 'after hit', 'random'];

export class TrainingMode {
  action: DummyAction = 'stand';
  guard: Guard = 'none';
  showBoxes = false;
  showFrames = true;
  recording = false;
  recordBuf: number[] = [];
  recordFacing = 1;
  private playI = 0;
  private cpu: CpuController;
  private lastAdv: { move: string; v: number; blocked: boolean } | null = null;
  private lastMoveInfo = '';
  private guardTimer = 0;
  private rnd = 1;
  private status = '';
  private statusT = 0;

  constructor(private scene: MatchScene) {
    this.cpu = new CpuController(1, settings.difficulty, 77);
    scene.hud.showInputs = true;
  }

  menu(onBack: () => void): MenuList {
    const o = this.scene.s.config.trainingOpts;
    const cycle = <T,>(arr: T[], cur: T, d: number) => arr[(arr.indexOf(cur) + d + arr.length) % arr.length];
    const items: MenuItem[] = [
      { id: 'dummy', label: t('training.dummy'), value: () => this.action.toUpperCase(), onAdjust: (d) => { this.action = cycle(ACTIONS, this.action, d); } },
      { id: 'guard', label: t('training.block'), value: () => this.guard.toUpperCase(), onAdjust: (d) => { this.guard = cycle(GUARDS, this.guard, d); } },
      { id: 'hp', label: t('training.hp'), value: () => (o.infiniteHp ? 'ON' : 'OFF'), onAdjust: () => { o.infiniteHp = !o.infiniteHp; } },
      { id: 'meter', label: t('training.meter'), value: () => (o.infiniteMeter ? 'ON' : 'OFF'), onAdjust: () => { o.infiniteMeter = !o.infiniteMeter; } },
      { id: 'stun', label: t('training.stun'), value: () => (o.noStun ? 'ON' : 'OFF'), onAdjust: () => { o.noStun = !o.noStun; } },
      { id: 'boxes', label: t('training.hitbox'), value: () => (this.showBoxes ? 'ON' : 'OFF'), onAdjust: () => { this.showBoxes = !this.showBoxes; } },
      { id: 'frames', label: t('training.frames'), value: () => (this.showFrames ? 'ON' : 'OFF'), onAdjust: () => { this.showFrames = !this.showFrames; } },
      { id: 'inputs', label: t('training.inputs'), value: () => (this.scene.hud.showInputs ? 'ON' : 'OFF'), onAdjust: () => { this.scene.hud.showInputs = !this.scene.hud.showInputs; } },
      { id: 'rec', label: t('training.record'), onSelect: () => { onBack(); this.scene.closePause(); this.toggleRecord(); } },
      { id: 'play', label: t('training.play'), onSelect: () => { onBack(); this.scene.closePause(); this.action = 'playback'; this.playI = 0; } },
      { id: 'reset', label: t('training.reset'), onSelect: () => { onBack(); this.scene.closePause(); this.resetPositions(); } },
    ];
    for (const it of items) if (it.onAdjust && !it.onSelect) it.onSelect = () => it.onAdjust!(1);
    const l = new MenuList(items, { x: 380, y: 190, w: 520, itemH: 40, size: 19, accent: C.lime, valueX: 340 });
    l.onBack = onBack;
    return l;
  }

  private toggleRecord(): void {
    if (!this.recording) {
      this.recording = true;
      this.recordBuf = [];
      this.recordFacing = this.scene.s.fighters[1].facing;
      this.flash(t('training.recording'));
    } else {
      this.recording = false;
      this.flash(t('training.recorded', this.recordBuf.length));
    }
    app().sfx('ui_confirm');
  }

  private flash(s: string): void { this.status = s; this.statusT = 150; }

  private resetPositions(): void {
    this.scene.restart();
    this.flash(t('training.resetDone'));
  }

  /** Hotkeys (keyboard F1/F2/F4, gamepad Select). */
  preTick(events: MenuEvent[]): void {
    const inp = app().input;
    for (const e of events) if (e.k === 'select') this.resetPositions();
    if (inp.keyDown('F1') && !this.f1) this.toggleRecord();
    if (inp.keyDown('F2') && !this.f2) { this.action = this.action === 'playback' ? 'stand' : 'playback'; this.playI = 0; this.flash(this.action === 'playback' ? t('training.playback') : t('training.playbackOff')); }
    if (inp.keyDown('F4') && !this.f4) this.resetPositions();
    this.f1 = inp.keyDown('F1'); this.f2 = inp.keyDown('F2'); this.f4 = inp.keyDown('F4');
  }

  private f1 = false;
  private f2 = false;
  private f4 = false;

  filterInputs(inputs: [number, number]): void {
    const s = this.scene.s;
    const dummy = s.fighters[1];
    if (this.recording) {
      // player controls the dummy; P1 stands still
      this.recordBuf.push(inputs[0]);
      inputs[1] = inputs[0];
      inputs[0] = 0;
      return;
    }
    let bits = 0;
    switch (this.action) {
      case 'crouch': bits = DOWN; break;
      case 'jump': bits = UP; break;
      case 'cpu': bits = this.cpu.next(s, 1); break;
      case 'playback':
        if (this.recordBuf.length) {
          bits = this.recordBuf[this.playI % this.recordBuf.length];
          this.playI++;
          if (dummy.facing !== this.recordFacing) bits = mirror(bits);
        }
        break;
    }
    // guard
    const p1 = s.fighters[0];
    const wantGuard = this.guard === 'all' || (this.guard === 'after hit' && this.guardTimer > 0) || (this.guard === 'random' && this.randomGuard());
    if (wantGuard && this.action !== 'cpu' && this.action !== 'playback') {
      const away = p1.x > dummy.x ? LEFT : RIGHT;
      const m = curMove(p1);
      const low = m?.hits.some((h) => h.level === 'low') ?? false;
      const over = m?.hits.some((h) => h.level === 'overhead') ?? p1.air;
      bits = away | (low || (!over && (bits & DOWN)) ? DOWN : 0);
    }
    if (dummy.state === 'hitstun' || dummy.state === 'blockstun' || dummy.state === 'juggle') this.guardTimer = 40;
    else if (this.guardTimer > 0) this.guardTimer--;
    inputs[1] = bits;
  }

  private randomGuard(): boolean {
    this.rnd = (this.rnd * 1103515245 + 12345) & 0x7fffffff;
    return (this.rnd >> 8) % 2 === 0;
  }

  onEvents(evs: SimEvent[]): void {
    for (const e of evs) {
      if (e.t === 'adv' && e.p === 0) this.lastAdv = { move: e.k, v: e.v, blocked: this.scene.s.adv.blocked };
      if ((e.t === 'attack' || e.t === 'special' || e.t === 'super' || e.t === 'ult' || e.t === 'throwStart') && e.p === 0) this.lastMoveInfo = e.k;
    }
  }

  postTick(): void {
    if (this.statusT > 0) this.statusT--;
  }

  onRestart(): void {
    this.lastAdv = null;
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.recording) {
      const blink = Math.floor(Date.now() / 400) % 2;
      ctx.fillStyle = blink ? 'rgba(255,40,70,0.9)' : 'rgba(255,40,70,0.4)';
      ctx.beginPath(); ctx.arc(W / 2 - 30, 236, 7, 0, Math.PI * 2); ctx.fill();
      text(ctx, t('training.rec'), W / 2 - 16, 241, { size: 16, weight: 800, font: 'display', color: C.red, tracking: 3 });
    }
    if (this.statusT > 0) {
      text(ctx, this.status, W / 2, 206, { size: 15, weight: 800, font: 'display', align: 'center', color: C.lime, tracking: 3, alpha: Math.min(1, this.statusT / 20) });
    }
    if (!this.showFrames) return;
    const s = this.scene.s;
    const p1 = s.fighters[0];
    const id = this.lastMoveInfo || p1.lastMove;
    const m = id ? getMove(p1.char, id) : undefined;
    const x = W / 2 - 250, y = 124;
    chamferPath(ctx, x, y, 500, 58, 10);
    ctx.fillStyle = 'rgba(4,6,16,0.82)';
    ctx.fill();
    ctx.strokeStyle = rgba(C.lime, 0.5);
    ctx.lineWidth = 1;
    ctx.stroke();
    if (!m) {
      text(ctx, t('training.noframes'), W / 2, y + 35, { size: 14, weight: 700, font: 'display', align: 'center', color: C.dim, tracking: 2 });
      return;
    }
    const fr = frameRow(m);
    text(ctx, m.name.toUpperCase(), x + 14, y + 22, { size: 14, weight: 800, font: 'display', color: C.white, tracking: 2 });
    text(ctx, t('training.total', moveTotal(m)), x + 14, y + 44, { size: 12, weight: 700, font: 'display', color: C.dim, tracking: 2 });
    const labels = [t('frame.startup'), t('frame.active'), t('frame.recovery'), t('frame.advantage')];
    const adv = this.lastAdv && this.lastAdv.move === m.id ? this.lastAdv : null;
    const advTxt = adv ? `${adv.v > 0 ? '+' : ''}${adv.v} ${adv.blocked ? t('training.blk') : t('training.hit')}` : '—';
    const vals = [fr[0], fr[1], fr[2], advTxt];
    labels.forEach((l, i) => {
      const cx = x + 230 + i * 72;
      text(ctx, l, cx, y + 20, { size: 9, weight: 800, font: 'display', align: 'center', color: C.dim, tracking: 1 });
      const col = i === 3 && adv ? (adv.v >= 0 ? C.lime : adv.v <= -7 ? C.red : C.amber) : C.white;
      text(ctx, vals[i], cx, y + 43, { size: i === 3 ? 15 : 18, weight: 800, font: 'mono', align: 'center', color: col });
    });
  }
}

function mirror(bits: number): number {
  const l = bits & LEFT, r = bits & RIGHT;
  bits &= ~(LEFT | RIGHT);
  if (l) bits |= RIGHT;
  if (r) bits |= LEFT;
  return bits;
}
