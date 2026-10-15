/**
 * Presentation reactions to simulation events: particles, camera shake, sounds and stage
 * reactions. Purely cosmetic; never feeds back into the simulation.
 */
import type { AudioAPI, SfxName } from '../../audio/types';
import { settings } from '../../core/settings';
import type { Stage } from '../../render/stages/types';
import { getChar, getMove } from '../../sim/registry';
import { FP, type MatchState, type SimEvent } from '../../sim/types';
import type { Particles } from '../../vfx/particles';

export interface ShakeState { amp: number; t: number }

const HIT_SFX: Record<string, SfxName> = {
  light: 'hit_light', medium: 'hit_medium', heavy: 'hit_heavy', special: 'hit_special', super: 'hit_super',
};
const SHAKE: Record<string, number> = { light: 0, medium: 2, heavy: 5, special: 5, super: 6 };

const PROJ_SFX: Record<string, SfxName> = {
  orb: 'proj_orb', orbEX: 'proj_orb', lance: 'proj_lance', lanceEX: 'proj_lance', disc: 'proj_disc', beam: 'proj_wave', wave: 'proj_wave', grid: 'proj_wave',
};

const MOVE_SFX: Record<string, SfxName> = {
  rise: 'rise', spin: 'spin', teleport: 'teleport', charge: 'charge_rush', orb: 'proj_orb',
};

export function handleEvents(
  s: MatchState, evs: SimEvent[], vfx: Particles, audio: AudioAPI, stage: Stage | null, shake: ShakeState, camX: number,
): void {
  const pan = (x: number) => Math.max(-1, Math.min(1, (x / FP - camX) / 640));
  for (const e of evs) {
    const wx = e.x / FP, wy = e.y / FP;
    switch (e.t) {
      case 'hit': {
        const att = s.fighters[e.p];
        const col = att ? getChar(att.char).themeColor : '#ffffff';
        const dir = att && att.x <= e.x ? 1 : -1;
        vfx.hit(wx, wy, e.k, col, dir);
        audio.sfx(HIT_SFX[e.k] ?? 'hit_medium', { pan: pan(e.x), pitch: 0.95 + Math.random() * 0.1 });
        addShake(shake, SHAKE[e.k] ?? 2);
        if (e.k === 'heavy' || e.k === 'special' || e.k === 'super') stage?.onEvent('hit_heavy', e.k === 'super' ? 1 : 0.6);
        break;
      }
      case 'block': {
        const att = s.fighters[e.p];
        const dir = att && att.x <= e.x ? 1 : -1;
        vfx.block(wx, wy, e.k, '#8fe9ff', dir);
        audio.sfx(e.k === 'heavy' || e.k === 'special' || e.k === 'super' ? 'block_heavy' : 'block', { pan: pan(e.x) });
        addShake(shake, e.k === 'heavy' ? 1.5 : 0);
        break;
      }
      case 'armor':
        vfx.block(wx, wy, 'heavy', '#ffb238', 1);
        audio.sfx('armor', { pan: pan(e.x) });
        addShake(shake, 3);
        break;
      case 'attack': {
        audio.sfx(e.v === 0 ? 'whiff_light' : e.v === 1 ? 'whiff_medium' : 'whiff_heavy', { pan: pan(e.x), vol: 0.7 });
        break;
      }
      case 'special': {
        const f = s.fighters[e.p];
        const m = getMove(f.char, e.k);
        const name = m?.sfx && MOVE_SFX[m.sfx];
        if (name && m?.sfx !== 'orb') audio.sfx(name, { pan: pan(e.x) });
        else if (!m?.projectile) audio.sfx('whiff_heavy', { pan: pan(e.x) });
        if (e.k.endsWith('_EX')) vfx.burst(wx, wy + 120, getChar(f.char).themeColor, 14, 6);
        break;
      }
      case 'proj':
        audio.sfx(PROJ_SFX[e.k] ?? 'proj_orb', { pan: pan(e.x) });
        vfx.burst(wx, wy, '#ffffff', 6, 4);
        break;
      case 'projEnd':
        vfx.trail(wx, wy, '#9fe8ff', 30);
        break;
      case 'clash':
        vfx.burst(wx, wy, '#ffffff', 20, 8);
        audio.sfx('clash', { pan: pan(e.x) });
        addShake(shake, 3);
        break;
      case 'super': case 'ult': {
        const f = s.fighters[e.p];
        audio.sfx(e.t === 'super' ? 'super_flash' : 'ult_flash');
        audio.duck(0.5, e.t === 'super' ? 1.2 : 1.8);
        vfx.burst(f.x / FP, f.y / FP + 120, getChar(f.char).themeColor, 30, 9);
        stage?.onEvent('super', 1);
        break;
      }
      case 'drive': {
        const f = s.fighters[e.p];
        audio.sfx('drive');
        vfx.burst(f.x / FP, f.y / FP + 120, '#27e8ff', 24, 8);
        break;
      }
      case 'burnout': audio.sfx('burnout'); break;
      case 'guardcancel': audio.sfx('guardcancel'); vfx.burst(wx, wy + 120, '#8b5cff', 20, 8); break;
      case 'pushblock': audio.sfx('pushblock'); vfx.block(wx + (s.fighters[e.p].facing * 30), wy, 'heavy', '#6dff9e', s.fighters[e.p].facing); break;
      case 'grab': audio.sfx('grab', { pan: pan(e.x) }); break;
      case 'throw': audio.sfx('throw_slam', { pan: pan(e.x) }); addShake(shake, 5); vfx.dust(wx, 0, 10); break;
      case 'tech': audio.sfx('tech'); vfx.burst(wx, wy, '#ffffff', 14, 6); break;
      case 'jump': audio.sfx('jump', { pan: pan(e.x), vol: 0.5 }); break;
      case 'doubleJump': audio.sfx('jump', { pan: pan(e.x), vol: 0.6, pitch: 1.2 }); vfx.burst(wx, wy, '#ff2e9a', 8, 3); break;
      case 'land': {
        audio.sfx('land', { pan: pan(e.x), vol: e.k === 'heavy' ? 1 : 0.5 });
        vfx.splash(wx, 0, e.k === 'heavy' ? 12 : 5);
        if (e.k === 'heavy') { vfx.dust(wx, 0, 8); addShake(shake, 4); }
        break;
      }
      case 'dash': audio.sfx('dash', { pan: pan(e.x), vol: 0.6 }); vfx.dust(wx, 0, 4); vfx.splash(wx, 0, 4); break;
      case 'knockdown': audio.sfx('knockdown', { pan: pan(e.x) }); vfx.dust(wx, 0, e.k === 'hard' ? 14 : 8); vfx.splash(wx, 0, 14); addShake(shake, e.k === 'hard' ? 5 : 3); break;
      case 'quickRise': audio.sfx('quickrise'); break;
      case 'airRecover': audio.sfx('quickrise', { pitch: 1.3 }); break;
      case 'teleportOut': case 'teleportIn': audio.sfx('teleport', { pan: pan(e.x) }); vfx.burst(wx, wy, '#ff2e9a', 16, 6); break;
      case 'dizzy': audio.sfx('dizzy'); break;
      case 'counter': audio.sfx('counter'); break;
      case 'ko': audio.sfx('ko'); addShake(shake, 9); stage?.onEvent('ko', 1); break;
      case 'roundStart': audio.sfx('announce_round'); stage?.onEvent('round_start', 1); break;
      case 'fight': audio.sfx('announce_fight'); break;
      case 'timeover': audio.sfx('timeover'); break;
      case 'timerWarn': audio.sfx('timer_tick', { vol: 0.6 }); break;
      case 'roundEnd':
        if (e.k === 'perfect') { audio.sfx('perfect'); stage?.onEvent('perfect', 1); }
        audio.sfx('crowd_cheer');
        break;
    }
  }
}

export function addShake(sh: ShakeState, amp: number): void {
  if (!settings.screenShake) return;
  if (amp > sh.amp) sh.amp = amp;
}
