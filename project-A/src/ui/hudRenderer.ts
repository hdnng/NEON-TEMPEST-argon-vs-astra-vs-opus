import { DummyBehavior } from '../ai/cpuController';
import { CHARACTERS } from '../data/characters';
import {
  ComboTrialDef,
  FighterState,
  InputHistoryEntry,
  MatchState,
  NumpadDir
} from '../core/types';
import {
  BTN_HK,
  BTN_HP,
  BTN_LK,
  BTN_LP,
  BTN_MK,
  BTN_MP
} from '../input/inputBuffer';
import { FighterRenderer } from '../render/fighterRenderer';

export interface TrainingHudState {
  enabled: boolean;
  infiniteHealth: boolean;
  infiniteMeter: boolean;
  noStun: boolean;
  showHitboxes: boolean;
  showFrameData: boolean;
  showInputHistory: boolean;
  dummyBehavior: DummyBehavior;
  recordingState: 'idle' | 'recording' | 'playback';
  recordedFramesCount: number;
}

export interface TrialHudState {
  trial: ComboTrialDef;
  completedStepIndex: number; // 0..steps.length
  trialSuccessTimer: number;
  trialIndex: number;
  totalTrials: number;
}

export class HudRenderer {
  private fighterRenderer: FighterRenderer;

  constructor(fighterRenderer: FighterRenderer) {
    this.fighterRenderer = fighterRenderer;
  }

  public renderHud(
    ctx: CanvasRenderingContext2D,
    state: MatchState,
    showInputHistory: boolean,
    colorblindMode: boolean,
    training?: TrainingHudState,
    trial?: TrialHudState
  ): void {
    const f0 = state.fighters[0];
    const f1 = state.fighters[1];
    const c0 = CHARACTERS[f0.charId];
    const c1 = CHARACTERS[f1.charId];

    // 1. Low-Health Critical Vignette Pulse
    if (f0.hp <= f0.maxHp * 0.3 || f1.hp <= f1.maxHp * 0.3) {
      const pulse = 0.08 + Math.abs(Math.sin(state.frame * 0.12)) * 0.1;
      ctx.save();
      const grad = ctx.createRadialGradient(640, 360, 380, 640, 360, 740);
      grad.addColorStop(0, 'rgba(255, 0, 80, 0)');
      grad.addColorStop(1, `rgba(255, 0, 80, ${pulse.toFixed(3)})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1280, 720);
      ctx.restore();
    }

    // 2. Portraits (Top Left & Top Right)
    this.fighterRenderer.renderCharacterPortrait(
      ctx,
      f0.charId,
      26,
      20,
      68,
      68,
      f0.useAltPalette,
      state.frame
    );
    this.fighterRenderer.renderCharacterPortrait(
      ctx,
      f1.charId,
      1186,
      20,
      68,
      68,
      f1.useAltPalette,
      state.frame
    );

    // 3. Health Bars (Draining towards center timer)
    this.drawHealthBar(ctx, f0, 104, 28, 466, 26, false, state.frame, colorblindMode);
    this.drawHealthBar(ctx, f1, 710, 28, 466, 26, true, state.frame, colorblindMode);

    // 4. Stun / Neural Overload Bars
    this.drawStunBar(ctx, f0, 104, 62, 290, 9, false, state.frame);
    this.drawStunBar(ctx, f1, 886, 62, 290, 9, true, state.frame);

    // 5. Character Names, Archetypes & Round Win Pips
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px "Segoe UI", "Orbitron", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${c0.name}`, 108, 22);
    ctx.fillStyle = '#00f0ff';
    ctx.font = '11px "Segoe UI", "Consolas", monospace';
    ctx.fillText(c0.archetype, 200, 22);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px "Segoe UI", "Orbitron", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${c1.name}`, 1172, 22);
    ctx.fillStyle = '#ff00aa';
    ctx.font = '11px "Segoe UI", "Consolas", monospace';
    ctx.fillText(c1.archetype, 1080, 22);
    ctx.restore();

    // Round Win Pips
    for (let i = 0; i < state.roundsToWin; i++) {
      this.drawRoundPip(ctx, 552 - i * 24, 68, i < state.p1RoundsWon, '#00f0ff');
      this.drawRoundPip(ctx, 728 + i * 24, 68, i < state.p2RoundsWon, '#ff00aa');
    }

    // 6. Center Round Timer & Round Indicator
    this.drawTimerBox(ctx, state);

    // 7. Bottom Super Meter Gauges (3 Stocks = 300 Max)
    this.drawSuperMeter(ctx, f0, 36, 668, 440, 22, false, state.frame);
    this.drawSuperMeter(ctx, f1, 804, 668, 440, 22, true, state.frame);

    // 8. Combo Counter & Damage Popups
    // Note: f1.comboCounter tracks hits landed BY P1 ON P2!
    if (f1.comboCounter >= 2 || (f1.comboDisplayTimer > 0 && f1.lastComboTotalHits >= 2)) {
      const hits = f1.comboCounter >= 2 ? f1.comboCounter : f1.lastComboTotalHits;
      const dmg = f1.comboCounter >= 2 ? f1.comboDamage : f1.lastComboTotalDamage;
      this.drawComboCounter(ctx, 36, 155, hits, dmg, f1.comboScaling, false, '#00f0ff');
    }
    if (f0.comboCounter >= 2 || (f0.comboDisplayTimer > 0 && f0.lastComboTotalHits >= 2)) {
      const hits = f0.comboCounter >= 2 ? f0.comboCounter : f0.lastComboTotalHits;
      const dmg = f0.comboCounter >= 2 ? f0.comboDamage : f0.lastComboTotalDamage;
      this.drawComboCounter(ctx, 1244, 155, hits, dmg, f0.comboScaling, true, '#ff00aa');
    }

    // 9. Input History Display (if enabled in Settings or Training)
    if (showInputHistory || training?.showInputHistory) {
      this.drawInputHistory(ctx, f0.inputBuffer, 26, 235);
    }

    // 10. Training Mode Frame Data & Controls Bar
    if (training && training.enabled) {
      this.drawTrainingOverlay(ctx, state, training);
    }

    // 11. Combo Trials Step-by-Step Checklist
    if (trial) {
      this.drawComboTrialOverlay(ctx, trial);
    }

    // 12. Kinetic Announcer Banner ("ROUND 1", "ENGAGE!", "K.O.", "PERFECT K.O.")
    if (state.announcementTimer > 0 && state.announcementText && state.screenFreezeFrames === 0) {
      this.drawAnnouncerBanner(
        ctx,
        state.announcementText,
        state.announcementSubtext,
        state.announcementTimer
      );
    }
  }

  private drawHealthBar(
    ctx: CanvasRenderingContext2D,
    f: FighterState,
    x: number,
    y: number,
    w: number,
    h: number,
    isRightSide: boolean,
    frame: number,
    colorblindMode: boolean
  ): void {
    const hpRatio = Math.max(0, Math.min(1, f.hp / f.maxHp));
    const whiteRatio = Math.max(hpRatio, Math.min(1, f.whiteHp / f.maxHp));
    const slant = isRightSide ? -14 : 14;

    ctx.save();

    // Outer frame
    ctx.fillStyle = 'rgba(5, 10, 24, 0.88)';
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w - slant, y + h);
    ctx.lineTo(x - slant, y + h);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Clip inside bar
    ctx.save();
    ctx.clip();

    // White recoverable damage trail
    const whiteW = w * whiteRatio;
    const whiteX = isRightSide ? x : x + (w - whiteW);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.fillRect(whiteX - 16, y, whiteW + 32, h);

    // Active HP fill
    const hpW = w * hpRatio;
    const hpX = isRightSide ? x : x + (w - hpW);
    const isLow = hpRatio <= 0.35;

    const grad = ctx.createLinearGradient(x, y, x + w, y);
    if (colorblindMode) {
      grad.addColorStop(0, isLow ? '#ff9900' : '#00aaff');
      grad.addColorStop(1, isLow ? '#ffcc00' : '#66ddff');
    } else if (isLow) {
      const pulse = Math.sin(frame * 0.25) > 0;
      grad.addColorStop(0, pulse ? '#ff0055' : '#ff5500');
      grad.addColorStop(1, '#ffbe00');
    } else {
      grad.addColorStop(0, '#00f0ff');
      grad.addColorStop(0.5, '#00ffaa');
      grad.addColorStop(1, '#00c8ff');
    }

    ctx.fillStyle = grad;
    ctx.fillRect(hpX - 16, y, hpW + 32, h);

    // Segment tick marks
    ctx.strokeStyle = 'rgba(4, 10, 24, 0.45)';
    ctx.lineWidth = 1.5;
    for (let i = 1; i < 10; i++) {
      const tx = x + (w * i) / 10;
      ctx.beginPath();
      ctx.moveTo(tx, y);
      ctx.lineTo(tx - slant, y + h);
      ctx.stroke();
    }
    ctx.restore();

    // Numeric HP readout
    ctx.fillStyle = '#d8f4ff';
    ctx.font = 'bold 11px "Consolas", monospace';
    ctx.textAlign = isRightSide ? 'right' : 'left';
    ctx.fillText(
      `${Math.ceil(f.hp)}/${f.maxHp}`,
      isRightSide ? x + w - 8 : x + 8,
      y + h - 7
    );

    // Overdrive Active Badge (positioned cleanly to avoid archetype text)
    if (f.overdriveTimer > 0) {
      const odSec = (f.overdriveTimer / 60).toFixed(1);
      const badgeX = isRightSide ? x + w - 315 : x + 205;
      ctx.fillStyle = 'rgba(30, 18, 0, 0.9)';
      ctx.strokeStyle = '#ffbe00';
      ctx.lineWidth = 1.2;
      ctx.fillRect(badgeX, y - 21, 118, 16);
      ctx.strokeRect(badgeX, y - 21, 118, 16);

      ctx.fillStyle = '#ffbe00';
      ctx.font = 'bold 10px "Segoe UI", "Orbitron", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`⚡ OVERDRIVE ${odSec}s`, badgeX + 59, y - 9);
    }

    ctx.restore();
  }

  private drawStunBar(
    ctx: CanvasRenderingContext2D,
    f: FighterState,
    x: number,
    y: number,
    w: number,
    h: number,
    isRightSide: boolean,
    frame: number
  ): void {
    const ratio = Math.max(0, Math.min(1, f.stun / f.maxStun));
    ctx.save();
    ctx.fillStyle = 'rgba(5, 10, 24, 0.8)';
    ctx.strokeStyle = 'rgba(255, 0, 140, 0.45)';
    ctx.lineWidth = 1;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);

    const fillW = w * ratio;
    const fillX = isRightSide ? x : x + (w - fillW);
    const isDanger = ratio >= 0.75 || f.status === 'dizzy';
    ctx.fillStyle =
      isDanger && Math.sin(frame * 0.35) > 0 ? '#ffffff' : '#ff007f';
    ctx.fillRect(fillX, y, fillW, h);

    ctx.fillStyle = '#9ab8d4';
    ctx.font = '10px "Consolas", monospace';
    ctx.textAlign = isRightSide ? 'right' : 'left';
    ctx.fillText('STUN', isRightSide ? x - 6 : x + w + 6, y + 8);
    ctx.restore();
  }

  private drawRoundPip(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    won: boolean,
    color: string
  ): void {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = won ? color : 'rgba(10, 20, 40, 0.8)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    if (won) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
    }
    ctx.fillRect(-6, -6, 12, 12);
    ctx.strokeRect(-6, -6, 12, 12);
    ctx.restore();
  }

  private drawTimerBox(ctx: CanvasRenderingContext2D, state: MatchState): void {
    const seconds = Math.ceil(state.roundTimerFrames / 60);
    const timeStr = seconds.toString().padStart(2, '0');

    ctx.save();
    ctx.fillStyle = 'rgba(4, 10, 26, 0.94)';
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 14;

    ctx.beginPath();
    ctx.moveTo(596, 14);
    ctx.lineTo(684, 14);
    ctx.lineTo(698, 44);
    ctx.lineTo(684, 74);
    ctx.lineTo(596, 74);
    ctx.lineTo(582, 44);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = seconds <= 15 ? '#ff0055' : '#ffffff';
    ctx.font = 'bold 34px "Segoe UI", "Orbitron", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(timeStr, 640, 52);

    ctx.fillStyle = '#00f0ff';
    ctx.font = 'bold 10px "Consolas", monospace';
    ctx.fillText(`RND 0${state.roundNumber}`, 640, 68);
    ctx.restore();
  }

  private drawSuperMeter(
    ctx: CanvasRenderingContext2D,
    f: FighterState,
    x: number,
    y: number,
    w: number,
    h: number,
    isRightSide: boolean,
    frame: number
  ): void {
    const stocks = Math.floor(f.meter / 100);
    const segW = (w - 12) / 3;

    ctx.save();
    // Draw 3 stock segments
    for (let s = 0; s < 3; s++) {
      const segIndex = isRightSide ? 2 - s : s;
      const sx = x + s * (segW + 6);
      const segFill = Math.max(0, Math.min(1, (f.meter - segIndex * 100) / 100));

      ctx.fillStyle = 'rgba(4, 10, 26, 0.88)';
      ctx.strokeStyle = segFill >= 1 ? '#00f0ff' : 'rgba(0, 240, 255, 0.35)';
      ctx.lineWidth = segFill >= 1 ? 2 : 1.5;
      ctx.fillRect(sx, y, segW, h);
      ctx.strokeRect(sx, y, segW, h);

      if (segFill > 0) {
        const fw = segW * segFill;
        const fx = isRightSide ? sx + (segW - fw) : sx;
        ctx.fillStyle =
          segFill >= 1
            ? segIndex === 2
              ? '#ffbe00'
              : segIndex === 1
              ? '#ff00aa'
              : '#00f0ff'
            : 'rgba(0, 210, 255, 0.65)';
        ctx.fillRect(fx, y, fw, h);
      }
    }

    // Status Badges above Super Meter
    ctx.font = 'bold 12px "Segoe UI", "Orbitron", sans-serif';
    ctx.textAlign = isRightSide ? 'right' : 'left';
    const labelX = isRightSide ? x + w : x;

    const canUltimate = f.meter >= 200 && f.hp <= f.maxHp * 0.35;
    const canOverdrive = f.meter >= 150 && !f.overdriveUsedThisRound && f.overdriveTimer <= 0;

    let statusLabel = `METER: ${Math.floor(f.meter)}/300 (${stocks} STOCK${stocks === 1 ? '' : 'S'})`;
    let statusColor = '#a8d8ff';
    if (canUltimate) {
      statusLabel = '★ ULTIMATE ART READY [236236+PP] ★';
      statusColor = Math.sin(frame * 0.25) > 0 ? '#ff0055' : '#ffbe00';
    } else if (canOverdrive) {
      statusLabel = '⚡ OVERDRIVE READY [HP+HK] // SUPER READY [236236+P]';
      statusColor = '#ffbe00';
    } else if (stocks >= 1) {
      statusLabel = 'SUPER READY [236236+P] // EX READY';
      statusColor = '#00f0ff';
    }

    ctx.fillStyle = statusColor;
    ctx.fillText(statusLabel, labelX, y - 7);
    ctx.restore();
  }

  private drawComboCounter(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    hits: number,
    damage: number,
    scaling: number,
    alignRight: boolean,
    color: string
  ): void {
    ctx.save();
    ctx.textAlign = alignRight ? 'right' : 'left';

    const rating =
      hits >= 8
        ? 'TEMPESTUOUS!!'
        : hits >= 6
        ? 'CYBERNETIC!'
        : hits >= 4
        ? 'RADICAL!'
        : 'SOLID COMBO';

    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.font = 'italic 900 44px "Segoe UI", "Orbitron", sans-serif';
    ctx.fillText(`${hits} HITS`, x, y);

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px "Segoe UI", "Orbitron", sans-serif';
    ctx.fillText(`${damage} DAMAGE  (${Math.round(scaling * 100)}% SCALE)`, x, y + 24);

    ctx.fillStyle = '#ffbe00';
    ctx.font = 'italic bold 14px "Segoe UI", "Orbitron", sans-serif';
    ctx.fillText(rating, x, y + 44);
    ctx.restore();
  }

  private drawInputHistory(
    ctx: CanvasRenderingContext2D,
    buffer: InputHistoryEntry[],
    x: number,
    y: number
  ): void {
    ctx.save();
    ctx.fillStyle = 'rgba(4, 9, 22, 0.78)';
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.fillRect(x, y, 168, 255);
    ctx.strokeRect(x, y, 168, 255);

    ctx.fillStyle = '#00f0ff';
    ctx.font = 'bold 11px "Consolas", monospace';
    ctx.fillText('INPUT TELEMETRY', x + 10, y + 18);

    // Collapse consecutive identical states for clean display
    const collapsed: { dir: NumpadDir; held: number; frames: number }[] = [];
    for (let i = 0; i < buffer.length && collapsed.length < 9; i++) {
      const e = buffer[i];
      const prev = collapsed[collapsed.length - 1];
      if (prev && prev.dir === e.rawDir && prev.held === e.held) {
        prev.frames++;
      } else {
        collapsed.push({ dir: e.rawDir, held: e.held, frames: 1 });
      }
    }

    const dirArrows: Record<NumpadDir, string> = {
      1: '↙',
      2: '↓',
      3: '↘',
      4: '←',
      5: '•',
      6: '→',
      7: '↖',
      8: '↑',
      9: '↗'
    };

    for (let i = 0; i < collapsed.length; i++) {
      const row = collapsed[i];
      const ry = y + 40 + i * 23;

      ctx.fillStyle = '#88a8c8';
      ctx.font = '11px "Consolas", monospace';
      ctx.fillText(`${Math.min(99, row.frames).toString().padStart(2, ' ')}f`, x + 8, ry);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(dirArrows[row.dir], x + 38, ry + 1);

      let bx = x + 60;
      const btns: [number, string, string][] = [
        [BTN_LP, 'LP', '#00f0ff'],
        [BTN_MP, 'MP', '#ffbe00'],
        [BTN_HP, 'HP', '#ff0055'],
        [BTN_LK, 'LK', '#00ffaa'],
        [BTN_MK, 'MK', '#38b6ff'],
        [BTN_HK, 'HK', '#ff00aa']
      ];
      for (const [mask, lbl, col] of btns) {
        if (row.held & mask) {
          ctx.fillStyle = col;
          ctx.fillRect(bx, ry - 11, 20, 14);
          ctx.fillStyle = '#020612';
          ctx.font = 'bold 9px sans-serif';
          ctx.fillText(lbl, bx + 3, ry - 1);
          bx += 23;
        }
      }
    }
    ctx.restore();
  }

  private drawTrainingOverlay(
    ctx: CanvasRenderingContext2D,
    state: MatchState,
    t: TrainingHudState
  ): void {
    const f0 = state.fighters[0];
    const f1 = state.fighters[1];
    const dist = Math.round(Math.abs(f1.x - f0.x));

    if (t.showFrameData) {
      ctx.save();
      const bx = 250;
      const by = 92;
      const bw = 780;
      const bh = 54;

      ctx.fillStyle = 'rgba(4, 10, 26, 0.88)';
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeRect(bx, by, bw, bh);

      ctx.font = 'bold 12px "Consolas", monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#00f0ff';
      const moveStr = f0.currentMoveId ?? 'IDLE';
      ctx.fillText(
        `P1 STATE: ${f0.status.toUpperCase()} (${moveStr})`,
        bx + 14,
        by + 20
      );

      ctx.fillStyle = '#e0f4ff';
      ctx.fillText(
        `STARTUP: ${f0.lastMoveStartup}f | ACTIVE: ${f0.lastMoveActive}f | RECOVERY: ${f0.lastMoveRecovery}f`,
        bx + 14,
        by + 40
      );

      // Frame Advantage badge
      const adv = f0.lastFrameAdvantage;
      const advStr = adv > 0 ? `+${adv}f (PLUS)` : adv < 0 ? `${adv}f (MINUS)` : '0f (EVEN)';
      ctx.fillStyle = adv > 0 ? '#00ff88' : adv < 0 ? '#ff3366' : '#ffbe00';
      ctx.textAlign = 'right';
      ctx.fillText(`FRAME ADVANTAGE: ${advStr}`, bx + bw - 14, by + 20);

      ctx.fillStyle = '#a8d0f0';
      ctx.fillText(
        `RANGE: ${dist}px | DUMMY: ${t.dummyBehavior.toUpperCase()} | REC: ${t.recordingState.toUpperCase()}`,
        bx + bw - 14,
        by + 40
      );

      if (t.showHitboxes) {
        // Color-coded hitbox overlay legend pill
        const ly = by + bh + 6;
        ctx.fillStyle = 'rgba(4, 10, 26, 0.88)';
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
        ctx.fillRect(340, ly, 600, 22);
        ctx.strokeRect(340, ly, 600, 22);

        const legendItems: [string, string, number][] = [
          ['■ HITBOX (ACTIVE)', '#ff143c', 362],
          ['■ HURTBOX (VULN)', '#00ccff', 512],
          ['■ PUSHBOX (BODY)', '#00ff66', 662],
          ['■ THROWBOX', '#ffcc00', 815]
        ];
        ctx.font = 'bold 10px "Consolas", monospace';
        ctx.textAlign = 'left';
        for (const [label, col, lx] of legendItems) {
          ctx.fillStyle = col;
          ctx.fillText(label, lx, ly + 15);
        }
      }

      ctx.restore();
    }

    // Bottom center quick shortcut hint for Training Mode (positioned cleanly between Super Meters)
    ctx.save();
    ctx.fillStyle = 'rgba(4, 10, 26, 0.9)';
    ctx.fillRect(486, 665, 308, 25);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
    ctx.strokeRect(486, 665, 308, 25);
    ctx.fillStyle = '#bfe8ff';
    ctx.font = 'bold 10px "Consolas", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('[1] Dummy  [2] Boxes  [3] Rec/Play  [4] Reset', 640, 681);
    ctx.restore();
  }

  private drawComboTrialOverlay(
    ctx: CanvasRenderingContext2D,
    trialHud: TrialHudState
  ): void {
    const { trial, completedStepIndex, trialSuccessTimer, trialIndex, totalTrials } = trialHud;
    ctx.save();
    const x = 945;
    const y = 96;
    const w = 310;
    const h = 88 + trial.steps.length * 32;

    ctx.fillStyle = 'rgba(4, 10, 26, 0.9)';
    ctx.strokeStyle = trialSuccessTimer > 0 ? '#00ff88' : '#00f0ff';
    ctx.lineWidth = 2;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = '#00f0ff';
    ctx.font = 'bold 13px "Segoe UI", "Orbitron", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(
      `${trial.name} (${trialIndex + 1}/${totalTrials})`,
      x + 14,
      y + 24
    );

    ctx.fillStyle = '#9cc4e4';
    ctx.font = '11px "Segoe UI", sans-serif';
    ctx.fillText(`[N] Next Trial  |  Difficulty: ${trial.difficulty}`, x + 14, y + 44);

    for (let i = 0; i < trial.steps.length; i++) {
      const step = trial.steps[i];
      const sy = y + 72 + i * 30;
      const done = i < completedStepIndex || trialSuccessTimer > 0;

      ctx.fillStyle = done ? 'rgba(0, 255, 136, 0.2)' : 'rgba(20, 36, 68, 0.6)';
      ctx.fillRect(x + 12, sy - 16, w - 24, 24);

      ctx.fillStyle = done ? '#00ff88' : '#ffffff';
      ctx.font = 'bold 12px "Consolas", monospace';
      ctx.fillText(`${done ? '✓' : i + 1 + '.'} ${step.label}`, x + 20, sy);

      ctx.fillStyle = '#ffbe00';
      ctx.textAlign = 'right';
      ctx.fillText(step.notation, x + w - 20, sy);
      ctx.textAlign = 'left';
    }

    if (trialSuccessTimer > 0) {
      ctx.fillStyle = '#00ff88';
      ctx.font = 'bold 16px "Segoe UI", "Orbitron", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('★ TRIAL COMPLETE! ★', x + w * 0.5, y + h - 10);
    }

    ctx.restore();
  }

  private drawAnnouncerBanner(
    ctx: CanvasRenderingContext2D,
    title: string,
    subtitle: string,
    timer: number
  ): void {
    ctx.save();
    const alpha = Math.min(1, timer / 14);
    ctx.globalAlpha = alpha;

    ctx.fillStyle = 'rgba(3, 8, 22, 0.84)';
    ctx.fillRect(0, 285, 1280, 118);

    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 285);
    ctx.lineTo(1280, 285);
    ctx.moveTo(0, 403);
    ctx.lineTo(1280, 403);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 24;
    ctx.font = 'italic 900 58px "Segoe UI", "Orbitron", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, 640, 352);

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#00f0ff';
    ctx.font = 'bold 16px "Consolas", monospace';
    ctx.fillText(subtitle, 640, 384);

    ctx.restore();
  }
}
