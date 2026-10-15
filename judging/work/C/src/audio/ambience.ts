/**
 * Ambience beds: rain, storm (rain + distant thunder), crowd (murmur + chatter + swells).
 * Continuous layers are looped noise buffers through filters; sporadic events (droplets,
 * thunder, chatter, swells) are scheduled from the shared audio tick.
 */
import type { Ambience } from './types';
import { Group, env, sweep, type Engine } from './engine';

interface Bed {
  kind: Ambience;
  out: GainNode;
  nodes: AudioNode[];
  sources: AudioScheduledSourceNode[];
  /** Crowd swell gain. */
  swell?: GainNode;
  nextDrop: number;
  nextBig: number;
  nextChatter: number;
}

export class AmbiencePlayer {
  private bed: Bed | null = null;

  constructor(private e: Engine) {}

  get kind(): Ambience {
    return this.bed?.kind ?? 'none';
  }

  set(kind: Ambience, fade = 1.5): void {
    if ((this.bed?.kind ?? 'none') === kind) return;
    const ctx = this.e.ctx;
    const now = ctx.currentTime;
    if (this.bed) {
      const old = this.bed;
      old.out.gain.cancelScheduledValues(now);
      old.out.gain.setValueAtTime(Math.max(0.0001, old.out.gain.value), now);
      old.out.gain.exponentialRampToValueAtTime(0.0001, now + fade);
      for (const s of old.sources) {
        try { s.stop(now + fade + 0.05); } catch { /* ignore */ }
      }
      setTimeout(() => {
        for (const n of old.nodes) {
          try { n.disconnect(); } catch { /* ignore */ }
        }
      }, (fade + 0.5) * 1000);
      this.bed = null;
    }
    if (kind === 'none') return;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, now);
    out.gain.exponentialRampToValueAtTime(1, now + fade);
    out.connect(this.e.ambVol);
    const bed: Bed = { kind, out, nodes: [out], sources: [], nextDrop: now + 0.2, nextBig: now + 4 + Math.random() * 6, nextChatter: now + 0.5 };
    const layer = (buf: AudioBuffer, type: BiquadFilterType, freq: number, q: number, gain: number, dst: AudioNode = out) => {
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = gain;
      s.connect(f);
      f.connect(g);
      g.connect(dst);
      s.start(now, Math.random() * 2);
      bed.sources.push(s);
      bed.nodes.push(s, f, g);
      return g;
    };
    if (kind === 'rain' || kind === 'storm') {
      const k = kind === 'storm' ? 1.6 : 1;
      layer(this.e.pink, 'bandpass', 1800, 0.4, 0.22 * k);
      layer(this.e.white, 'highpass', 4500, 0.7, 0.035 * k);
      layer(this.e.brown, 'lowpass', 320, 0.7, 0.16 * k);
    } else if (kind === 'crowd') {
      const swell = ctx.createGain();
      swell.gain.value = 1;
      swell.connect(out);
      bed.swell = swell;
      bed.nodes.push(swell);
      const bands: [number, number, number][] = [[350, 0.13, 0.17], [800, 0.21, 0.13], [1700, 0.31, 0.06]];
      for (const [freq, rate, gain] of bands) {
        const g = layer(this.e.pink, 'bandpass', freq, 1.8, gain, swell);
        const lfo = ctx.createOscillator();
        lfo.frequency.value = rate;
        const depth = ctx.createGain();
        depth.gain.value = gain * 0.45;
        lfo.connect(depth);
        depth.connect(g.gain);
        lfo.start(now);
        bed.sources.push(lfo);
        bed.nodes.push(lfo, depth);
      }
      layer(this.e.brown, 'lowpass', 220, 0.7, 0.12, swell);
    }
    this.bed = bed;
  }

  /** Schedules sporadic events; called from the audio tick (~40 Hz). */
  tick(): void {
    const bed = this.bed;
    if (!bed) return;
    const e = this.e;
    const now = e.ctx.currentTime;
    if (bed.kind === 'rain' || bed.kind === 'storm') {
      while (bed.nextDrop < now + 0.1) {
        this.droplet(bed, bed.nextDrop);
        bed.nextDrop += (bed.kind === 'storm' ? 0.025 : 0.04) + Math.random() * 0.12;
      }
      if (bed.kind === 'storm' && now >= bed.nextBig) {
        this.thunder(bed, now + 0.05);
        bed.nextBig = now + 7 + Math.random() * 11;
      }
    } else if (bed.kind === 'crowd') {
      while (bed.nextChatter < now + 0.1) {
        this.chatter(bed, bed.nextChatter);
        bed.nextChatter += 0.12 + Math.random() * 0.35;
      }
      if (now >= bed.nextBig && bed.swell) {
        const p = bed.swell.gain;
        p.cancelScheduledValues(now);
        p.setValueAtTime(1, now);
        p.linearRampToValueAtTime(1.6, now + 1.0);
        p.linearRampToValueAtTime(1, now + 3.2);
        bed.nextBig = now + 6 + Math.random() * 7;
      }
    }
  }

  private droplet(bed: Bed, t: number): void {
    const e = this.e;
    const g = new Group(e);
    const a = g.gain(0);
    a.connect(bed.out);
    if (Math.random() < 0.5) {
      const o = g.osc('sine', 1800 + Math.random() * 3200, t, t + 0.03);
      sweep(o.frequency, t, o.frequency.value, o.frequency.value * 0.7, 0.02);
      o.connect(a);
      env(a.gain, t, 0.012 + Math.random() * 0.025, 0.001, 0.02);
    } else {
      const n = g.noise(e.white, t, t + 0.02);
      const bp = g.filter('bandpass', 2500 + Math.random() * 4000, 4);
      n.connect(bp);
      bp.connect(a);
      env(a.gain, t, 0.04 + Math.random() * 0.05, 0.001, 0.012);
    }
    g.done();
  }

  private thunder(bed: Bed, t: number): void {
    const e = this.e;
    const g = new Group(e);
    const dur = 3 + Math.random() * 2.5;
    const n = g.noise(e.brown, t, t + dur + 0.1);
    const lp = g.filter('lowpass', 380, 0.8);
    sweep(lp.frequency, t, 420, 90, dur);
    const a = g.gain(0);
    a.gain.setValueAtTime(0.0001, t);
    a.gain.linearRampToValueAtTime(0.5 + Math.random() * 0.3, t + 0.25);
    a.gain.linearRampToValueAtTime(0.35, t + 0.9);
    a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(lp);
    lp.connect(a);
    a.connect(bed.out);
    // crack
    const c = g.noise(e.white, t + 0.05, t + 0.5);
    const bp = g.filter('bandpass', 900, 0.8);
    const ca = g.gain(0);
    env(ca.gain, t + 0.05, 0.18, 0.01, 0.35);
    c.connect(bp);
    bp.connect(ca);
    ca.connect(bed.out);
    g.done();
  }

  private chatter(bed: Bed, t: number): void {
    const e = this.e;
    const g = new Group(e);
    const dur = 0.12 + Math.random() * 0.28;
    const n = g.noise(e.pink, t, t + dur + 0.05);
    const bp = g.filter('bandpass', 500 + Math.random() * 1100, 5 + Math.random() * 4);
    const am = g.gain(0.5);
    const lfo = g.osc('sine', 5 + Math.random() * 6, t, t + dur + 0.05);
    const depth = g.gain(0.5);
    lfo.connect(depth);
    depth.connect(am.gain);
    const a = g.gain(0);
    env(a.gain, t, 0.05 + Math.random() * 0.07, dur * 0.3, dur * 0.7);
    n.connect(bp);
    bp.connect(am);
    am.connect(a);
    a.connect(bed.swell ?? bed.out);
    g.done();
  }
}
