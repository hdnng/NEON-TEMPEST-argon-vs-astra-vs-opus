/**
 * The audio singleton. Safe to import anywhere (including Node tests): when Web Audio is not
 * available every method is a no-op. The AudioContext is created lazily in unlock(), which must
 * be called from a user gesture (key press / click / gamepad button) to satisfy autoplay rules.
 */
import type { Ambience, AudioAPI, SfxName, SfxOptions, TrackId } from './types';
import { AmbiencePlayer } from './ambience';
import { audioSupported, createEngine, type Engine } from './engine';
import { Music } from './music';
import { SfxPlayer } from './sfx';

class AudioSystem implements AudioAPI {
  private e: Engine | null = null;
  private sfxPlayer: SfxPlayer | null = null;
  private musicPlayer: Music | null = null;
  private amb: AmbiencePlayer | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private vols = { master: 0.8, music: 0.6, sfx: 0.85, muted: false };
  private wantTrack: TrackId | null = null;
  private wantAmb: Ambience = 'none';
  private muffled = false;
  private suspendedByUser = false;

  get unlocked(): boolean {
    return !!this.e && this.e.ctx.state === 'running';
  }

  unlock(): void {
    if (!audioSupported()) return;
    if (!this.e) {
      this.e = createEngine();
      if (!this.e) return;
      this.sfxPlayer = new SfxPlayer(this.e);
      this.musicPlayer = new Music(this.e);
      this.amb = new AmbiencePlayer(this.e);
      this.applyVolumes();
      this.applyMuffle();
      const ctx = this.e.ctx;
      ctx.addEventListener?.('statechange', () => {
        if (ctx.state === 'running') this.startPending();
      });
    }
    const ctx = this.e.ctx;
    if (ctx.state !== 'running' && !this.suspendedByUser) {
      ctx.resume().then(() => this.startPending()).catch(() => { /* still locked */ });
    }
    if (!this.timer) this.timer = setInterval(() => this.tick(), 25);
    if (ctx.state === 'running') this.startPending();
  }

  private startPending(): void {
    if (!this.musicPlayer || !this.amb) return;
    if (this.musicPlayer.currentId !== this.wantTrack) this.musicPlayer.play(this.wantTrack, 0.8);
    if (this.amb.kind !== this.wantAmb) this.amb.set(this.wantAmb, 1.2);
  }

  private tick(): void {
    if (!this.e || this.e.ctx.state !== 'running') return;
    try {
      this.musicPlayer?.tick();
      this.amb?.tick();
    } catch {
      /* never let the scheduler die */
    }
  }

  setVolumes(master: number, music: number, sfx: number, muted: boolean): void {
    this.vols = { master, music, sfx, muted };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    const e = this.e;
    if (!e) return;
    const now = e.ctx.currentTime;
    const v = this.vols;
    const set = (p: AudioParam, val: number) => {
      p.cancelScheduledValues(now);
      p.setTargetAtTime(Math.max(0, val), now, 0.03);
    };
    set(e.master.gain, v.muted ? 0 : v.master);
    set(e.musicVol.gain, v.music);
    set(e.sfxVol.gain, v.sfx);
    set(e.sfxWet.gain, v.sfx);
    set(e.ambVol.gain, v.sfx * 0.7);
  }

  sfx(name: SfxName, opts?: SfxOptions): void {
    if (!this.sfxPlayer) return;
    try {
      this.sfxPlayer.play(name, opts);
    } catch {
      /* audio must never break gameplay */
    }
  }

  music(track: TrackId | null, fadeSeconds = 1): void {
    this.wantTrack = track;
    if (!this.musicPlayer || !this.e || this.e.ctx.state !== 'running') return;
    try {
      this.musicPlayer.play(track, fadeSeconds);
    } catch {
      /* ignore */
    }
  }

  ambience(kind: Ambience): void {
    this.wantAmb = kind;
    if (!this.amb || !this.e || this.e.ctx.state !== 'running') return;
    try {
      this.amb.set(kind);
    } catch {
      /* ignore */
    }
  }

  duck(amount: number, seconds: number): void {
    const e = this.e;
    if (!e) return;
    const now = e.ctx.currentTime;
    const p = e.musicDuck.gain;
    p.cancelScheduledValues(now);
    p.setTargetAtTime(Math.max(0.02, 1 - Math.max(0, Math.min(1, amount))), now, 0.03);
    p.setTargetAtTime(1, now + Math.max(0, seconds), 0.25);
  }

  setMuffled(on: boolean): void {
    this.muffled = on;
    this.applyMuffle();
  }

  private applyMuffle(): void {
    const e = this.e;
    if (!e) return;
    const now = e.ctx.currentTime;
    e.musicFilter.frequency.cancelScheduledValues(now);
    e.musicFilter.frequency.setTargetAtTime(this.muffled ? 650 : 20000, now, 0.08);
  }

  suspend(): void {
    if (!this.e) return;
    this.suspendedByUser = true;
    this.e.ctx.suspend().catch(() => { /* ignore */ });
  }

  resume(): void {
    if (!this.e) return;
    this.suspendedByUser = false;
    this.e.ctx.resume().catch(() => { /* ignore */ });
  }

  beat(): { phase: number; count: number; bpm: number } {
    if (!this.musicPlayer || !this.e) return { phase: 0, count: 0, bpm: 120 };
    return this.musicPlayer.beat();
  }
}

export const audio: AudioAPI = new AudioSystem();
