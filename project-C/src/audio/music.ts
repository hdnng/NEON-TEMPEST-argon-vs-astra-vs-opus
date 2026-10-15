/**
 * Music sequencer: compiles track pattern data into per-step events and schedules them with a
 * lookahead scheduler on the AudioContext clock (rock-solid timing independent of frame rate).
 */
import type { TrackId } from './types';
import { bass, drum, mel, pad, riser, type DrumKind } from './instruments';
import { TRACKS, noteAbove, parseChord, type SectionDef, type TrackDef } from './tracks';
import type { Engine } from './engine';

type MixKey = keyof TrackDef['mix'];

interface NoteEv { len: number; midi: number }
interface StepEv {
  drums: { kind: DrumKind; vel: number; mix: MixKey }[];
  bass?: NoteEv;
  arp?: NoteEv;
  lead?: NoteEv;
  lead2?: NoteEv;
  pad?: { midis: number[]; len: number };
}
interface Compiled { steps: StepEv[]; riser: boolean; crash: boolean; bars: number }

const LOOKAHEAD = 0.12;

const clean = (p: string) => p.replace(/[\s|]/g, '');

function holdLen(p: string, i: number, n: number): number {
  let len = 1;
  while (i + len < n && p[(i + len) % p.length] === '-') len++;
  return len;
}

function degree(c: string): number {
  if (c >= '0' && c <= '9') return c.charCodeAt(0) - 48;
  if (c >= 'a' && c <= 'f') return c.charCodeAt(0) - 87;
  return -1;
}

function compileSection(def: TrackDef, sec: SectionDef): Compiled {
  const n = sec.bars * 16;
  const steps: StepEv[] = [];
  for (let i = 0; i < n; i++) steps.push({ drums: [] });
  const chordAt = (i: number) => parseChord(sec.chords[Math.floor(i / 16) % sec.chords.length]);

  const drumPart = (pat: string | undefined, mixKey: MixKey, kind: (c: string) => DrumKind) => {
    if (!pat) return;
    const p = clean(pat);
    for (let i = 0; i < n; i++) {
      const c = p[i % p.length];
      const vel = c === 'X' ? 1 : c === 'x' ? 0.8 : c === 'g' ? 0.38 : c === 'o' ? 0.7 : 0;
      if (vel > 0) steps[i].drums.push({ kind: kind(c), vel, mix: mixKey });
    }
  };
  drumPart(sec.kick, 'kick', () => def.kit.kick);
  drumPart(sec.snare, 'snare', () => def.kit.snare);
  drumPart(sec.clap, 'clap', () => def.kit.clap);
  drumPart(sec.hat, 'hat', (c) => (c === 'o' ? 'ohat' : 'hat'));
  drumPart(sec.tom, 'tom', () => def.kit.tom);
  drumPart(sec.perc, 'perc', () => def.kit.perc);

  if (sec.bass) {
    const p = clean(sec.bass);
    for (let i = 0; i < n; i++) {
      const c = p[i % p.length];
      if (!'rRfts'.includes(c)) continue;
      const ch = chordAt(i);
      const root = noteAbove(def.bassBase, ch.pc);
      const midi = c === 'r' ? root : c === 'R' ? root + 12 : c === 'f' ? root + 7
        : c === 't' ? root + (ch.iv[1] ?? 4) : root + (ch.iv[3] ?? ch.iv[2] ?? 7);
      steps[i].bass = { midi, len: holdLen(p, i, n) };
    }
  }
  if (sec.arp) {
    const p = clean(sec.arp);
    for (let i = 0; i < n; i++) {
      const d = degree(p[i % p.length]);
      if (d < 0) continue;
      const ch = chordAt(i);
      const tones = ch.iv.filter((v) => v < 12);
      const root = noteAbove(def.arpBase, ch.pc);
      steps[i].arp = { midi: root + tones[d % tones.length] + 12 * Math.floor(d / tones.length), len: holdLen(p, i, n) };
    }
  }
  const melodic = (pat: string | undefined, base: number, key: 'lead' | 'lead2') => {
    if (!pat) return;
    const p = clean(pat);
    const root = noteAbove(base, def.key);
    const L = def.scale.length;
    for (let i = 0; i < n; i++) {
      const d = degree(p[i % p.length]);
      if (d < 0) continue;
      steps[i][key] = { midi: root + def.scale[d % L] + 12 * Math.floor(d / L), len: holdLen(p, i, n) };
    }
  };
  melodic(sec.lead, def.leadBase, 'lead');
  melodic(sec.lead2, def.lead2Base, 'lead2');

  const voicing = (i: number) => {
    const ch = chordAt(i);
    const root = noteAbove(def.padBase, ch.pc);
    return ch.iv.slice(0, 5).map((v) => root + v);
  };
  if (sec.pad === true) {
    for (let b = 0; b < sec.bars; b++) {
      const name = sec.chords[b % sec.chords.length];
      if (b > 0 && sec.chords[(b - 1) % sec.chords.length] === name) continue;
      let run = 1;
      while (b + run < sec.bars && sec.chords[(b + run) % sec.chords.length] === name) run++;
      steps[b * 16].pad = { midis: voicing(b * 16), len: run * 16 };
    }
  } else if (typeof sec.pad === 'string') {
    const p = clean(sec.pad);
    for (let i = 0; i < n; i++) {
      if (p[i % p.length] !== 'x') continue;
      steps[i].pad = { midis: voicing(i), len: holdLen(p, i, n) };
    }
  }
  return { steps, riser: !!sec.riser, crash: !!sec.crash, bars: sec.bars };
}

const compiledCache = new Map<TrackId, Compiled[]>();
function compiled(id: TrackId): Compiled[] {
  let c = compiledCache.get(id);
  if (!c) {
    const def = TRACKS[id];
    c = def.sections.map((s) => compileSection(def, s));
    compiledCache.set(id, c);
  }
  return c;
}

class TrackPlayer {
  readonly def: TrackDef;
  private secs: Compiled[];
  readonly out: GainNode;
  private delayIn: GainNode;
  private fx: AudioNode[] = [];
  private textures: AudioScheduledSourceNode[] = [];
  private orderPos = 0;
  private stepInSec = 0;
  private stepCount = 0;
  nextTime: number;
  startTime: number;
  readonly stepDur: number;
  stopped = false;

  constructor(private e: Engine, readonly id: TrackId, at: number, fadeIn: number) {
    const ctx = e.ctx;
    this.def = TRACKS[id];
    this.secs = compiled(id);
    this.stepDur = 60 / this.def.bpm / 4;
    this.nextTime = at;
    this.startTime = at;
    this.out = ctx.createGain();
    this.out.gain.setValueAtTime(fadeIn > 0 ? 0.0001 : this.def.vol, ctx.currentTime);
    if (fadeIn > 0) this.out.gain.exponentialRampToValueAtTime(this.def.vol, at + fadeIn);
    this.out.connect(e.musicIn);
    // echo
    this.delayIn = ctx.createGain();
    const delay = ctx.createDelay(2);
    delay.delayTime.value = Math.min(1.9, this.def.delay.steps * this.stepDur);
    const fb = ctx.createGain();
    fb.gain.value = this.def.delay.fb;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3200;
    const wet = ctx.createGain();
    wet.gain.value = this.def.delay.wet;
    this.delayIn.connect(delay);
    delay.connect(lp);
    lp.connect(fb);
    fb.connect(delay);
    lp.connect(wet);
    wet.connect(this.out);
    this.fx.push(this.delayIn, delay, fb, lp, wet);
    if (this.def.texture) this.startTexture(at);
  }

  private startTexture(at: number): void {
    const ctx = this.e.ctx;
    const mk = (buf: AudioBuffer, type: BiquadFilterType, freq: number, gain: number) => {
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = gain;
      s.connect(f);
      f.connect(g);
      g.connect(this.out);
      s.start(at, Math.random() * 2);
      this.textures.push(s);
      this.fx.push(s, f, g);
    };
    if (this.def.texture === 'vinyl') {
      mk(this.e.crackle, 'bandpass', 2500, 0.35);
      mk(this.e.pink, 'lowpass', 3500, 0.025);
    } else {
      mk(this.e.pink, 'bandpass', 1400, 0.07);
      mk(this.e.white, 'highpass', 6000, 0.012);
    }
  }

  tick(now: number): void {
    if (this.stopped) return;
    if (this.nextTime < now - 0.2) {
      // fell behind (tab throttled): jump forward instead of bursting old notes
      const shift = now + 0.05 - this.nextTime;
      this.nextTime += shift;
      this.startTime += shift;
    }
    while (this.nextTime < now + LOOKAHEAD) {
      const swing = this.stepCount % 2 === 1 ? this.def.swing * this.stepDur : 0;
      this.scheduleStep(this.nextTime + swing);
      this.advance();
      this.nextTime += this.stepDur;
    }
  }

  private advance(): void {
    this.stepCount++;
    this.stepInSec++;
    const sec = this.secs[this.def.order[this.orderPos]];
    if (this.stepInSec >= sec.bars * 16) {
      this.stepInSec = 0;
      this.orderPos++;
      if (this.orderPos >= this.def.order.length) this.orderPos = Math.min(this.def.loopFrom, this.def.order.length - 1);
    }
  }

  private scheduleStep(t: number): void {
    const e = this.e;
    const d = this.def;
    const sec = this.secs[d.order[this.orderPos]];
    const st = sec.steps[this.stepInSec];
    const sd = this.stepDur;
    const out = this.out;
    if (this.stepInSec === 0 && sec.crash) drum(e, 'crash', t, 0.8 * d.mix.hat, out);
    if (sec.riser && this.stepInSec === (sec.bars - 1) * 16) riser(e, t, 16 * sd, 1, out);
    for (const dr of st.drums) drum(e, dr.kind, t, dr.vel * d.mix[dr.mix], out);
    if (st.bass) bass(e, d.bass, t, st.bass.len * sd * 0.92, st.bass.midi, d.mix.bass, out);
    if (st.pad) pad(e, d.pad, t, st.pad.len * sd, st.pad.midis, d.mix.pad, out);
    if (st.arp) mel(e, d.arp, t, Math.max(sd * 0.8, st.arp.len * sd * 0.9), st.arp.midi, d.mix.arp, out, this.delayIn);
    if (st.lead) mel(e, d.lead, t, st.lead.len * sd * 0.95, st.lead.midi, d.mix.lead, out, this.delayIn);
    if (st.lead2) mel(e, d.lead2, t, st.lead2.len * sd * 0.95, st.lead2.midi, d.mix.lead2, out, this.delayIn);
  }

  stop(fade: number): void {
    if (this.stopped) return;
    this.stopped = true;
    const ctx = this.e.ctx;
    const now = ctx.currentTime;
    const f = Math.max(0.02, fade);
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setValueAtTime(Math.max(0.0001, this.out.gain.value), now);
    this.out.gain.exponentialRampToValueAtTime(0.0001, now + f);
    for (const s of this.textures) {
      try { s.stop(now + f + 0.05); } catch { /* already stopped */ }
    }
    // let note / echo tails ring out under the fade, then tear down
    setTimeout(() => {
      for (const n of this.fx) {
        try { n.disconnect(); } catch { /* ignore */ }
      }
      try { this.out.disconnect(); } catch { /* ignore */ }
    }, (f + 2.5) * 1000);
  }

  beat(now: number): { phase: number; count: number; bpm: number } {
    const beats = Math.max(0, (now - this.startTime) / (this.stepDur * 4));
    return { phase: beats - Math.floor(beats), count: Math.floor(beats), bpm: this.def.bpm };
  }
}

export class Music {
  private current: TrackPlayer | null = null;

  constructor(private e: Engine) {}

  get currentId(): TrackId | null {
    return this.current ? this.current.id : null;
  }

  play(id: TrackId | null, fade: number): void {
    if ((this.current?.id ?? null) === id) return;
    const ctx = this.e.ctx;
    if (this.current) this.current.stop(fade);
    this.current = null;
    if (!id || !TRACKS[id]) return;
    // new track starts after a short gap so the crossfade overlaps cleanly
    this.current = new TrackPlayer(this.e, id, ctx.currentTime + 0.08, fade > 0 ? Math.min(fade, 1.5) : 0);
  }

  tick(): void {
    this.current?.tick(this.e.ctx.currentTime);
  }

  beat(): { phase: number; count: number; bpm: number } {
    if (!this.current) return { phase: 0, count: 0, bpm: 120 };
    return this.current.beat(this.e.ctx.currentTime);
  }
}
