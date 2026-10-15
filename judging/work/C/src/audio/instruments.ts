/**
 * Synth voices used by the music sequencer: drums, basses, pads, arps and leads.
 * Every note is a self-cleaning node Group.
 */
import { Group, adsr, env, mtof, sweep, type Engine } from './engine';

export type DrumKind = 'kick' | 'kickDeep' | 'kickHard' | 'snare' | 'rim' | 'clap' | 'hat' | 'ohat' | 'shaker' | 'tom' | 'taiko' | 'clank' | 'crash';
export type BassInst = 'subsaw' | 'reese' | 'sine' | 'dist' | 'pluck';
export type PadInst = 'warm' | 'glass' | 'dark' | 'brass' | 'epiano';
export type MelInst = 'saw' | 'square' | 'koto' | 'flute' | 'piano' | 'bell' | 'epiano' | 'pluck' | 'brass';

export function drum(e: Engine, kind: DrumKind, t: number, vel: number, out: AudioNode): void {
  const g = new Group(e);
  const ctx = e.ctx;
  const amp = (peak: number, attack: number, decay: number) => {
    const a = g.gain(0);
    env(a.gain, t, peak * vel, attack, decay);
    a.connect(out);
    return a;
  };
  switch (kind) {
    case 'kick': case 'kickDeep': case 'kickHard': {
      const f0 = kind === 'kickDeep' ? 110 : kind === 'kickHard' ? 170 : 150;
      const f1 = kind === 'kickDeep' ? 42 : 46;
      const dec = kind === 'kickDeep' ? 0.5 : 0.36;
      const o = g.osc('sine', f0, t, t + dec + 0.05);
      sweep(o.frequency, t, f0, f1, 0.11);
      let dst: AudioNode = amp(kind === 'kickHard' ? 0.95 : 0.85, 0.002, dec);
      if (kind === 'kickHard') {
        const sh = g.shaper(e.softCurve);
        sh.connect(dst);
        dst = sh;
      }
      o.connect(dst);
      const n = g.noise(e.white, t, t + 0.02);
      const hp = g.filter('highpass', 3500);
      n.connect(hp);
      hp.connect(amp(kind === 'kickDeep' ? 0.08 : 0.18, 0.001, 0.01));
      break;
    }
    case 'snare': case 'rim': {
      const n = g.noise(e.white, t, t + 0.25);
      const hp = g.filter('highpass', kind === 'rim' ? 2500 : 1300);
      n.connect(hp);
      hp.connect(amp(kind === 'rim' ? 0.18 : 0.45, 0.001, kind === 'rim' ? 0.05 : 0.18));
      const o = g.osc('triangle', kind === 'rim' ? 420 : 190, t, t + 0.12);
      sweep(o.frequency, t, kind === 'rim' ? 420 : 200, kind === 'rim' ? 380 : 160, 0.08);
      o.connect(amp(kind === 'rim' ? 0.2 : 0.3, 0.001, 0.08));
      break;
    }
    case 'clap': {
      const n = g.noise(e.white, t, t + 0.3);
      const bp = g.filter('bandpass', 1300, 0.9);
      const a = g.gain(0);
      const p = a.gain;
      p.setValueAtTime(0.0001, t);
      for (let i = 0; i < 3; i++) {
        p.linearRampToValueAtTime(0.5 * vel, t + i * 0.011 + 0.001);
        p.exponentialRampToValueAtTime(0.08 * vel, t + i * 0.011 + 0.01);
      }
      p.linearRampToValueAtTime(0.42 * vel, t + 0.036);
      p.exponentialRampToValueAtTime(0.0001, t + 0.25);
      n.connect(bp);
      bp.connect(a);
      a.connect(out);
      break;
    }
    case 'hat': case 'ohat': case 'shaker': {
      const n = g.noise(e.white, t, t + (kind === 'ohat' ? 0.3 : 0.08));
      const hp = g.filter('highpass', kind === 'shaker' ? 5000 : 7000);
      const bp = g.filter('bandpass', kind === 'shaker' ? 7000 : 10000, 0.8);
      n.connect(hp);
      hp.connect(bp);
      bp.connect(amp(kind === 'shaker' ? 0.14 : 0.2, kind === 'shaker' ? 0.01 : 0.001, kind === 'ohat' ? 0.24 : 0.04));
      break;
    }
    case 'tom': case 'taiko': {
      const base = kind === 'taiko' ? 72 : 120;
      const dec = kind === 'taiko' ? 0.55 : 0.3;
      const o = g.osc('sine', base * 2, t, t + dec + 0.05);
      sweep(o.frequency, t, base * 2, base, 0.09);
      o.connect(amp(0.8, 0.002, dec));
      const n = g.noise(e.white, t, t + 0.08);
      const lp = g.filter('lowpass', kind === 'taiko' ? 700 : 1200);
      n.connect(lp);
      lp.connect(amp(kind === 'taiko' ? 0.4 : 0.2, 0.001, 0.06));
      break;
    }
    case 'clank': {
      const car = g.osc('square', 320, t, t + 0.3);
      const mod = g.osc('sine', 320 * 2.7, t, t + 0.3);
      const mg = g.gain(900);
      mod.connect(mg);
      mg.connect(car.frequency);
      const hp = g.filter('highpass', 600);
      car.connect(hp);
      hp.connect(amp(0.12, 0.001, 0.2));
      break;
    }
    case 'crash': {
      const n = g.noise(e.white, t, t + 1.6);
      const hp = g.filter('highpass', 4000);
      n.connect(hp);
      hp.connect(amp(0.22, 0.002, 1.4));
      break;
    }
  }
  void ctx;
  g.done();
}

/** Bass voice. */
export function bass(e: Engine, inst: BassInst, t: number, dur: number, midi: number, vel: number, out: AudioNode): void {
  const g = new Group(e);
  const f = mtof(midi);
  const off = t + dur;
  const rel = 0.06;
  const a = g.gain(0);
  a.connect(out);
  switch (inst) {
    case 'subsaw': {
      const lp = g.filter('lowpass', 1400, 2);
      sweep(lp.frequency, t, 1400, 280, Math.min(dur, 0.3));
      g.osc('sawtooth', f, t, off + rel + 0.05).connect(lp);
      lp.connect(a);
      g.osc('sine', f, t, off + rel + 0.05).connect(a);
      adsr(a.gain, t, off, 0.32 * vel, 0.005, 0.15, 0.7, rel);
      break;
    }
    case 'reese': {
      const lp = g.filter('lowpass', 900, 1.5);
      sweep(lp.frequency, t, 1300, 500, Math.min(dur, 0.4));
      g.osc('sawtooth', f, t, off + rel + 0.05, -14).connect(lp);
      g.osc('sawtooth', f, t, off + rel + 0.05, 14).connect(lp);
      lp.connect(a);
      g.osc('sine', f / 2, t, off + rel + 0.05).connect(a);
      adsr(a.gain, t, off, 0.26 * vel, 0.01, 0.2, 0.8, rel);
      break;
    }
    case 'sine': {
      g.osc('sine', f, t, off + 0.15).connect(a);
      const tri = g.gain(0.25);
      g.osc('triangle', f, t, off + 0.15).connect(tri);
      tri.connect(a);
      adsr(a.gain, t, off, 0.42 * vel, 0.01, 0.3, 0.75, 0.1);
      break;
    }
    case 'dist': {
      const sh = g.shaper(e.distCurve);
      const lp = g.filter('lowpass', 1800, 1);
      sweep(lp.frequency, t, 2400, 700, Math.min(dur, 0.25));
      const pre = g.gain(0.8);
      g.osc('sawtooth', f, t, off + rel + 0.05).connect(pre);
      g.osc('square', f / 2, t, off + rel + 0.05).connect(pre);
      pre.connect(sh);
      sh.connect(lp);
      lp.connect(a);
      adsr(a.gain, t, off, 0.2 * vel, 0.003, 0.1, 0.8, rel);
      break;
    }
    case 'pluck': {
      const lp = g.filter('lowpass', 2000, 3);
      sweep(lp.frequency, t, 2200, 300, 0.2);
      g.osc('square', f, t, off + rel + 0.05).connect(lp);
      lp.connect(a);
      adsr(a.gain, t, off, 0.3 * vel, 0.003, 0.2, 0.5, rel);
      break;
    }
  }
  g.done();
}

/** Chord pad / stab voice. */
export function pad(e: Engine, inst: PadInst, t: number, dur: number, midis: number[], vel: number, out: AudioNode): void {
  const g = new Group(e);
  const off = t + dur;
  const a = g.gain(0);
  a.connect(out);
  const n = Math.max(1, midis.length);
  switch (inst) {
    case 'warm': case 'dark': {
      const lp = g.filter('lowpass', inst === 'warm' ? 1500 : 650, 0.9);
      lp.connect(a);
      for (const m of midis) {
        for (const d of [-8, 8]) g.osc('sawtooth', mtof(m), t, off + 1.0, d).connect(lp);
      }
      if (inst === 'dark') g.osc('sine', mtof(midis[0] - 12), t, off + 1.0).connect(a);
      adsr(a.gain, t, off, (0.22 / n) * vel, 0.45, 0.4, 0.85, 0.8);
      break;
    }
    case 'glass': {
      for (const m of midis) {
        g.osc('triangle', mtof(m), t, off + 1.0).connect(a);
        const s = g.gain(0.4);
        g.osc('sine', mtof(m + 12), t, off + 1.0).connect(s);
        s.connect(a);
      }
      adsr(a.gain, t, off, (0.2 / n) * vel, 0.25, 0.5, 0.7, 0.9);
      break;
    }
    case 'brass': {
      const lp = g.filter('lowpass', 3000, 1.5);
      sweep(lp.frequency, t, 3600, 900, Math.min(0.35, dur));
      lp.connect(a);
      for (const m of midis) {
        for (const d of [-10, 10]) g.osc('sawtooth', mtof(m), t, off + 0.25, d).connect(lp);
      }
      adsr(a.gain, t, off, (0.3 / n) * vel, 0.01, 0.2, 0.6, 0.15);
      break;
    }
    case 'epiano': {
      for (const m of midis) epianoNote(g, mtof(m), t, off, (0.26 / n) * vel, a);
      a.gain.value = 1;
      break;
    }
  }
  g.done();
}

function epianoNote(g: Group, f: number, t: number, off: number, peak: number, out: AudioNode): void {
  const car = g.osc('sine', f, t, off + 0.8);
  const mod = g.osc('sine', f, t, off + 0.8);
  const mg = g.gain(0);
  mg.gain.setValueAtTime(f * 1.6, t);
  mg.gain.exponentialRampToValueAtTime(f * 0.1, t + 0.6);
  mod.connect(mg);
  mg.connect(car.frequency);
  const a = g.gain(0);
  a.gain.setValueAtTime(0.0001, t);
  a.gain.linearRampToValueAtTime(peak, t + 0.004);
  a.gain.exponentialRampToValueAtTime(peak * 0.35, t + 0.8);
  a.gain.setValueAtTime(peak * 0.35, Math.max(off, t + 0.8));
  a.gain.exponentialRampToValueAtTime(0.0001, Math.max(off, t + 0.8) + 0.5);
  car.connect(a);
  a.connect(out);
}

/** Melodic voice (leads, arps, plucks). `send` receives a copy for the echo delay. */
export function mel(e: Engine, inst: MelInst, t: number, dur: number, midi: number, vel: number, out: AudioNode, send?: AudioNode): void {
  const g = new Group(e);
  const f = mtof(midi);
  const off = t + dur;
  const a = g.gain(0);
  a.connect(out);
  if (send) a.connect(send);
  switch (inst) {
    case 'saw': {
      const lp = g.filter('lowpass', 3200, 1);
      lp.connect(a);
      const vib = g.osc('sine', 5.5, t, off + 0.3);
      const vd = g.gain(0);
      vd.gain.setValueAtTime(0, t);
      vd.gain.linearRampToValueAtTime(f * 0.006, t + 0.35);
      vib.connect(vd);
      for (const d of [-11, 0, 11]) {
        const o = g.osc('sawtooth', f, t, off + 0.3, d);
        vd.connect(o.frequency);
        o.connect(lp);
      }
      adsr(a.gain, t, off, 0.1 * vel, 0.015, 0.2, 0.8, 0.18);
      break;
    }
    case 'square': {
      const lp = g.filter('lowpass', 2600, 1);
      lp.connect(a);
      g.osc('square', f, t, off + 0.2).connect(lp);
      g.osc('square', f, t, off + 0.2, 7).connect(lp);
      adsr(a.gain, t, off, 0.08 * vel, 0.006, 0.15, 0.75, 0.1);
      break;
    }
    case 'koto': {
      const lp = g.filter('lowpass', 4200, 2);
      sweep(lp.frequency, t, 4200, 1100, 0.3);
      lp.connect(a);
      const o1 = g.osc('triangle', f, t, t + 1.3);
      const o2 = g.osc('sawtooth', f, t, t + 1.3);
      for (const o of [o1, o2]) {
        o.detune.setValueAtTime(60, t);
        o.detune.exponentialRampToValueAtTime(1, t + 0.04);
      }
      const sg = g.gain(0.35);
      o2.connect(sg);
      sg.connect(lp);
      o1.connect(lp);
      env(a.gain, t, 0.22 * vel, 0.002, 1.1);
      break;
    }
    case 'flute': {
      const o = g.osc('sine', f, t, off + 0.3);
      const tri = g.gain(0.18);
      g.osc('triangle', f, t, off + 0.3).connect(tri);
      tri.connect(a);
      const vib = g.osc('sine', 5, t, off + 0.3);
      const vd = g.gain(f * 0.008);
      vib.connect(vd);
      vd.connect(o.frequency);
      o.connect(a);
      const n = g.noise(e.white, t, off + 0.3);
      const bp = g.filter('bandpass', f * 2, 3);
      const ng = g.gain(0.18);
      n.connect(bp);
      bp.connect(ng);
      ng.connect(a);
      adsr(a.gain, t, off, 0.16 * vel, 0.09, 0.2, 0.85, 0.2);
      break;
    }
    case 'piano': {
      const parts: [OscillatorType, number, number][] = [['sine', 1, 1], ['sine', 2, 0.3], ['triangle', 1, 0.25], ['sine', 3, 0.08]];
      for (const [type, mult, lvl] of parts) {
        const s = g.gain(lvl);
        g.osc(type, f * mult, t, t + 2.2).connect(s);
        s.connect(a);
      }
      env(a.gain, t, 0.14 * vel, 0.003, 2.0);
      break;
    }
    case 'bell': {
      const car = g.osc('sine', f, t, t + 1.4);
      const mod = g.osc('sine', f * 3.5, t, t + 1.4);
      const mg = g.gain(0);
      mg.gain.setValueAtTime(f * 2.2, t);
      mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 1.0);
      mod.connect(mg);
      mg.connect(car.frequency);
      car.connect(a);
      env(a.gain, t, 0.12 * vel, 0.002, 1.2);
      break;
    }
    case 'epiano': {
      epianoNote(g, f, t, off, 0.16 * vel, a);
      a.gain.value = 1;
      break;
    }
    case 'pluck': {
      const lp = g.filter('lowpass', 3000, 4);
      sweep(lp.frequency, t, 3500, 500, 0.18);
      lp.connect(a);
      g.osc('sawtooth', f, t, t + 0.4).connect(lp);
      g.osc('square', f * 2, t, t + 0.4, 5).connect(lp);
      env(a.gain, t, 0.09 * vel, 0.002, 0.3);
      break;
    }
    case 'brass': {
      const lp = g.filter('lowpass', 3000, 1.4);
      lp.frequency.setValueAtTime(600, t);
      lp.frequency.exponentialRampToValueAtTime(3200, t + 0.06);
      lp.frequency.exponentialRampToValueAtTime(1500, t + 0.4);
      lp.connect(a);
      for (const d of [-9, 9]) g.osc('sawtooth', f, t, off + 0.2, d).connect(lp);
      adsr(a.gain, t, off, 0.12 * vel, 0.02, 0.2, 0.75, 0.15);
      break;
    }
  }
  g.done();
}

/** Noise riser over `dur` seconds. */
export function riser(e: Engine, t: number, dur: number, vel: number, out: AudioNode): void {
  const g = new Group(e);
  const n = g.noise(e.white, t, t + dur + 0.05);
  const bp = g.filter('bandpass', 300, 1.5);
  sweep(bp.frequency, t, 300, 7000, dur);
  const a = g.gain(0);
  a.gain.setValueAtTime(0.0001, t);
  a.gain.exponentialRampToValueAtTime(0.2 * vel, t + dur);
  a.gain.linearRampToValueAtTime(0.0001, t + dur + 0.04);
  n.connect(bp);
  bp.connect(a);
  a.connect(out);
  g.done();
}
