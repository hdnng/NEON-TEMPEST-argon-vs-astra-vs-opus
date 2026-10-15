import { SimEvent } from '../core/types';
import { SettingsManager } from '../data/settings';

export type MusicTrackId = 'none' | 'menu' | 'rooftop' | 'alley' | 'shrine' | 'victory';

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private settings: SettingsManager;
  private currentTrack: MusicTrackId = 'none';
  private stepTimer: number | null = null;
  private stepIndex = 0;

  constructor(settings: SettingsManager) {
    this.settings = settings;
  }

  public init(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }
    try {
      const AudioCtx =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();

      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      this.updateVolumes();
    } catch {
      // Headless or restricted audio environment
    }
  }

  public updateVolumes(): void {
    if (!this.ctx || !this.masterGain || !this.musicGain || !this.sfxGain) return;
    const v = this.settings.values;
    const now = this.ctx.currentTime;
    const master = v.muted ? 0 : (v.masterVolume / 100) * 0.65;
    const music = (v.musicVolume / 100) * 0.45;
    const sfx = (v.sfxVolume / 100) * 0.85;

    this.masterGain.gain.setTargetAtTime(master, now, 0.02);
    this.musicGain.gain.setTargetAtTime(music, now, 0.02);
    this.sfxGain.gain.setTargetAtTime(sfx, now, 0.02);
  }

  public playMusic(track: MusicTrackId): void {
    if (this.currentTrack === track) return;
    this.currentTrack = track;
    if (this.stepTimer !== null) {
      window.clearInterval(this.stepTimer);
      this.stepTimer = null;
    }
    if (track === 'none') return;

    this.init();
    this.stepIndex = 0;
    const bpm =
      track === 'rooftop'
        ? 136
        : track === 'alley'
        ? 142
        : track === 'shrine'
        ? 148
        : track === 'victory'
        ? 120
        : 118;
    const stepMs = (60 / bpm / 4) * 1000; // 16th-note sequencer

    this.stepTimer = window.setInterval(() => {
      this.tickSequencer(this.currentTrack, this.stepIndex++);
    }, stepMs);
  }

  private tickSequencer(track: MusicTrackId, step: number): void {
    if (!this.ctx || !this.musicGain || this.ctx.state !== 'running') return;
    if (this.settings.values.muted || this.settings.values.musicVolume <= 0) return;

    const s16 = step % 16;
    const bar = Math.floor(step / 16) % 4;
    const now = this.ctx.currentTime;

    // Scales in Hz (D minor / Japanese In-Sen cyberpunk pentatonic)
    const bassRoots =
      track === 'menu'
        ? [73.42, 65.41, 58.27, 65.41] // D2, C2, Bb1, C2
        : track === 'rooftop'
        ? [73.42, 87.31, 65.41, 69.3]  // D2, F2, C2, C#2
        : track === 'alley'
        ? [65.41, 65.41, 77.78, 73.42] // C2, C2, Eb2, D2
        : track === 'shrine'
        ? [82.41, 87.31, 98.0, 87.31]  // E2, F2, G2, F2
        : [73.42, 98.0, 110.0, 146.83];

    const root = bassRoots[bar];

    // 1. Sub-Bass Synth (driving 8th or 16th pattern)
    if (track !== 'victory' && (s16 % 2 === 0 || (track === 'alley' && s16 % 3 === 0))) {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(s16 === 14 ? root * 1.5 : root, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(420, now);
      filter.frequency.exponentialRampToValueAtTime(110, now + 0.12);

      g.gain.setValueAtTime(0.24, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

      osc.connect(filter);
      filter.connect(g);
      g.connect(this.musicGain);
      osc.start(now);
      osc.stop(now + 0.14);
    }

    // 2. Kick & Snare Drum synthesis for combat stages
    if (track === 'rooftop' || track === 'alley' || track === 'shrine') {
      if (s16 === 0 || s16 === 8 || (s16 === 10 && track === 'alley')) {
        this.synthKick(now);
      }
      if (s16 === 4 || s16 === 12) {
        this.synthSnare(now);
      }
      if (s16 % 2 === 1) {
        this.synthHiHat(now, s16 === 7 || s16 === 15 ? 0.08 : 0.035);
      }
    }

    // 3. Lead Neon Arpeggio (In-Sen / Cyberpunk intervals)
    const arpMultipliers = [4, 4.756, 5.339, 6, 7.127, 8, 6, 5.339];
    if (s16 % 2 === 0 || track === 'shrine') {
      const noteIdx = (s16 + bar * 3) % arpMultipliers.length;
      const freq = root * arpMultipliers[noteIdx];
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = track === 'shrine' ? 'triangle' : 'square';
      osc.frequency.setValueAtTime(freq, now);

      g.gain.setValueAtTime(track === 'menu' ? 0.08 : 0.065, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc.connect(g);
      g.connect(this.musicGain);
      osc.start(now);
      osc.stop(now + 0.17);
    }
  }

  private synthKick(now: number): void {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(135, now);
    osc.frequency.exponentialRampToValueAtTime(36, now + 0.11);
    g.gain.setValueAtTime(0.35, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(g);
    g.connect(this.musicGain);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  private synthSnare(now: number): void {
    if (!this.ctx || !this.musicGain) return;
    this.playNoiseBurst(0.11, 1400, 0.16, this.musicGain);
  }

  private synthHiHat(now: number, dur: number): void {
    if (!this.ctx || !this.musicGain) return;
    this.playNoiseBurst(dur, 6500, 0.06, this.musicGain);
  }

  private playNoiseBurst(
    duration: number,
    filterFreq: number,
    gainAmount: number,
    targetNode: AudioNode
  ): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const bufferSize = Math.max(256, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = filterFreq > 3500 ? 'highpass' : 'bandpass';
    filter.frequency.setValueAtTime(filterFreq, now);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gainAmount, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(g);
    g.connect(targetNode);
    noise.start(now);
    noise.stop(now + duration + 0.01);
  }

  public playUiMove(): void {
    this.init();
    this.playTone(680, 920, 0.045, 'sine', 0.14);
  }

  public playUiConfirm(): void {
    this.init();
    this.playTone(520, 1040, 0.09, 'triangle', 0.22);
    setTimeout(() => this.playTone(780, 1560, 0.11, 'sine', 0.18), 40);
  }

  public playUiBack(): void {
    this.init();
    this.playTone(640, 320, 0.08, 'triangle', 0.18);
  }

  private playTone(
    startFreq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType,
    volume: number
  ): void {
    if (!this.ctx || !this.sfxGain || this.ctx.state !== 'running') return;
    if (this.settings.values.muted || this.settings.values.sfxVolume <= 0) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);

    g.gain.setValueAtTime(volume, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  /**
   * Consumes simulation events emitted during a match frame and plays layered procedural SFX.
   */
  public processSimEvents(events: SimEvent[]): void {
    if (events.length === 0) return;
    this.init();
    if (!this.ctx || !this.sfxGain || this.ctx.state !== 'running') return;

    for (const ev of events) {
      switch (ev.type) {
        case 'whiff':
          this.playNoiseBurst(0.06, 1800, 0.12, this.sfxGain);
          this.playTone(320, 120, 0.06, 'sine', 0.1);
          break;
        case 'hit': {
          const str = ev.strength ?? 'medium';
          if (str === 'light') {
            this.playNoiseBurst(0.07, 2400, 0.24, this.sfxGain);
            this.playTone(280, 90, 0.07, 'triangle', 0.25);
          } else if (str === 'medium' || str === 'special') {
            this.playNoiseBurst(0.11, 1600, 0.34, this.sfxGain);
            this.playTone(220, 55, 0.11, 'sawtooth', 0.32);
          } else {
            // heavy / ex / super
            this.playNoiseBurst(0.16, 1100, 0.45, this.sfxGain);
            this.playTone(170, 38, 0.18, 'sawtooth', 0.42);
            this.playTone(540, 110, 0.14, 'square', 0.2);
          }
          break;
        }
        case 'block':
          this.playTone(920, 480, 0.08, 'square', 0.24);
          this.playNoiseBurst(0.06, 3200, 0.18, this.sfxGain);
          break;
        case 'pushblock':
        case 'parry':
          this.playTone(660, 1760, 0.18, 'triangle', 0.35);
          this.playTone(880, 2200, 0.22, 'sine', 0.28);
          break;
        case 'throw_start':
          this.playTone(300, 520, 0.08, 'triangle', 0.22);
          break;
        case 'throw_tech':
          this.playTone(880, 440, 0.12, 'square', 0.3);
          break;
        case 'throw_slam':
        case 'knockdown':
          this.playNoiseBurst(0.18, 600, 0.4, this.sfxGain);
          this.playTone(130, 32, 0.2, 'sawtooth', 0.38);
          break;
        case 'projectile_spawn':
          this.playTone(820, 340, 0.12, 'sawtooth', 0.22);
          break;
        case 'projectile_clash':
          this.playTone(1200, 300, 0.14, 'square', 0.28);
          break;
        case 'super_freeze':
        case 'ultimate_freeze':
        case 'overdrive_burst':
          this.playTone(220, 1480, 0.35, 'sawtooth', 0.38);
          this.playTone(110, 55, 0.4, 'triangle', 0.35);
          break;
        case 'ko':
          this.playNoiseBurst(0.45, 800, 0.5, this.sfxGain);
          this.playTone(190, 28, 0.55, 'sawtooth', 0.48);
          break;
        case 'round_start':
          this.playTone(440, 880, 0.18, 'triangle', 0.25);
          break;
      }
    }
  }
}
