/**
 * Synthesized sound effects. Each effect is a small graph of oscillators / filtered noise with
 * envelopes, built on demand and torn down automatically when its last source ends.
 */
import type { SfxName, SfxOptions } from './types';
import { Group, env, sweep, type Engine } from './engine';

interface V {
  e: Engine;
  g: Group;
  out: GainNode;
  /** Start time. */
  t: number;
  /** Pitch multiplier. */
  p: number;
  wet(amount: number): void;
}

type NoiseKind = 'white' | 'pink' | 'brown';

// ---------------------------------------------------------------------------------------------
// Building blocks

function tone(v: V, type: OscillatorType, f0: number, f1: number, dur: number, peak: number,
  o: { attack?: number; start?: number; to?: AudioNode; detune?: number } = {}): OscillatorNode {
  const t = v.t + (o.start ?? 0);
  const attack = o.attack ?? 0.002;
  const osc = v.g.osc(type, f0 * v.p, t, t + attack + dur + 0.05, o.detune ?? 0);
  if (f1 !== f0) sweep(osc.frequency, t, f0 * v.p, f1 * v.p, attack + dur);
  const a = v.g.gain(0);
  env(a.gain, t, peak, attack, dur);
  osc.connect(a);
  a.connect(o.to ?? v.out);
  return osc;
}

function noise(v: V, type: BiquadFilterType, f0: number, f1: number, dur: number, peak: number,
  o: { q?: number; attack?: number; start?: number; to?: AudioNode; kind?: NoiseKind } = {}): BiquadFilterNode {
  const t = v.t + (o.start ?? 0);
  const attack = o.attack ?? 0.001;
  const buf = o.kind === 'pink' ? v.e.pink : o.kind === 'brown' ? v.e.brown : v.e.white;
  const s = v.g.noise(buf, t, t + attack + dur + 0.05);
  const f = v.g.filter(type, f0 * v.p, o.q ?? 0.8);
  if (f1 !== f0) sweep(f.frequency, t, f0 * v.p, f1 * v.p, attack + dur);
  const a = v.g.gain(0);
  env(a.gain, t, peak, attack, dur);
  s.connect(f);
  f.connect(a);
  a.connect(o.to ?? v.out);
  return f;
}

/** Two-operator FM bell / metallic ring. */
function bell(v: V, freq: number, ratio: number, index: number, dur: number, peak: number,
  o: { start?: number; to?: AudioNode } = {}): void {
  const t = v.t + (o.start ?? 0);
  const f = freq * v.p;
  const car = v.g.osc('sine', f, t, t + dur + 0.05);
  const mod = v.g.osc('sine', f * ratio, t, t + dur + 0.05);
  const mg = v.g.gain(0);
  mg.gain.setValueAtTime(f * index, t);
  mg.gain.exponentialRampToValueAtTime(Math.max(1, f * index * 0.02), t + dur);
  mod.connect(mg);
  mg.connect(car.frequency);
  const a = v.g.gain(0);
  env(a.gain, t, peak, 0.002, dur);
  car.connect(a);
  a.connect(o.to ?? v.out);
}

/** Returns an input node that feeds a waveshaper (distortion) into the voice output. */
function drive(v: V, curve: 'dist' | 'soft', post = 1): GainNode {
  const input = v.g.gain(1);
  const sh = v.g.shaper(curve === 'dist' ? v.e.distCurve : v.e.softCurve);
  const out = v.g.gain(post);
  input.connect(sh);
  sh.connect(out);
  out.connect(v.out);
  return input;
}

/** Detuned saw chord through a sweeping lowpass. */
function chord(v: V, freqs: number[], dur: number, peak: number,
  o: { attack?: number; start?: number; cut0?: number; cut1?: number; q?: number; type?: OscillatorType } = {}): void {
  const t = v.t + (o.start ?? 0);
  const attack = o.attack ?? 0.005;
  const f = v.g.filter('lowpass', (o.cut0 ?? 3000) * v.p, o.q ?? 1.2);
  sweep(f.frequency, t, (o.cut0 ?? 3000) * v.p, (o.cut1 ?? 600) * v.p, attack + dur);
  const a = v.g.gain(0);
  env(a.gain, t, peak, attack, dur);
  f.connect(a);
  a.connect(v.out);
  for (const fr of freqs) {
    for (const det of [-9, 9]) {
      const osc = v.g.osc(o.type ?? 'sawtooth', fr * v.p, t, t + attack + dur + 0.05, det);
      osc.connect(f);
    }
  }
}

/** Amplitude-modulated filtered noise (spins, chatter). */
function amNoise(v: V, freq: number, q: number, rate: number, dur: number, peak: number,
  o: { attack?: number; start?: number; kind?: NoiseKind } = {}): void {
  const t = v.t + (o.start ?? 0);
  const attack = o.attack ?? 0.02;
  const buf = o.kind === 'pink' ? v.e.pink : v.e.white;
  const s = v.g.noise(buf, t, t + attack + dur + 0.05);
  const f = v.g.filter('bandpass', freq * v.p, q);
  const am = v.g.gain(0.5);
  const lfo = v.g.osc('sine', rate, t, t + attack + dur + 0.05);
  const depth = v.g.gain(0.5);
  lfo.connect(depth);
  depth.connect(am.gain);
  const a = v.g.gain(0);
  env(a.gain, t, peak, attack, dur);
  s.connect(f);
  f.connect(am);
  am.connect(a);
  a.connect(v.out);
}

function crackles(v: V, count: number, spread: number, peak: number, start = 0): void {
  for (let i = 0; i < count; i++) {
    noise(v, 'highpass', 2500 + Math.random() * 3000, 2500, 0.008 + Math.random() * 0.015, peak * (0.5 + Math.random() * 0.5),
      { start: start + Math.random() * spread });
  }
}

const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

// ---------------------------------------------------------------------------------------------
// Effects

function hitCore(v: V, s: number): void {
  // s: 0 light, 1 medium, 2 heavy
  const tr = [5000, 4500, 4000][s];
  noise(v, 'highpass', tr, tr, [0.012, 0.016, 0.02][s], [0.35, 0.45, 0.5][s]);
  noise(v, 'bandpass', [2800, 2200, 1700][s], [1800, 1300, 900][s], [0.05, 0.08, 0.12][s], [0.5, 0.6, 0.75][s], { q: [1.2, 1, 0.9][s] });
  const thumpTo = s === 2 ? drive(v, 'soft', 0.9) : v.out;
  tone(v, 'sine', [240, 190, 160][s], [90, 60, 42][s], [0.06, 0.11, 0.2][s], [0.6, 0.85, 1.0][s], { to: thumpTo });
  if (s === 0) tone(v, 'triangle', 600, 220, 0.035, 0.18);
  else {
    const lp = v.g.filter('lowpass', 2000);
    lp.connect(v.out);
    tone(v, 'square', s === 1 ? 420 : 300, s === 1 ? 150 : 90, s === 1 ? 0.05 : 0.08, s === 1 ? 0.12 : 0.15, { to: lp });
  }
  if (s === 2) noise(v, 'lowpass', 700, 300, 0.16, 0.5);
  v.wet([0.03, 0.06, 0.12][s]);
}

const SYNTHS: Record<SfxName, (v: V) => void> = {
  // ---- UI
  ui_move: (v) => {
    tone(v, 'sine', 1650, 1500, 0.025, 0.12);
    noise(v, 'highpass', 6000, 6000, 0.008, 0.05);
  },
  ui_confirm: (v) => {
    tone(v, 'triangle', 1319, 1319, 0.18, 0.15);
    tone(v, 'triangle', 1976, 1976, 0.25, 0.13, { start: 0.05 });
    tone(v, 'sine', 2637, 2637, 0.2, 0.05, { start: 0.05 });
    v.wet(0.12);
  },
  ui_back: (v) => {
    tone(v, 'triangle', 880, 660, 0.1, 0.15);
    tone(v, 'triangle', 587, 587, 0.12, 0.11, { start: 0.05 });
  },
  ui_error: (v) => {
    const lp = v.g.filter('lowpass', 1500);
    lp.connect(v.out);
    tone(v, 'square', 110, 110, 0.16, 0.12, { to: lp });
    tone(v, 'square', 117, 117, 0.16, 0.12, { to: lp });
  },
  ui_tab: (v) => {
    noise(v, 'bandpass', 2000, 5000, 0.06, 0.14, { q: 2 });
    tone(v, 'sine', 1200, 1200, 0.03, 0.07);
  },
  ui_start: (v) => {
    noise(v, 'bandpass', 300, 6000, 0.05, 0.3, { q: 1.5, attack: 0.45 });
    chord(v, [hz(48), hz(55), hz(60), hz(62), hz(67)], 1.0, 0.07, { attack: 0.4, cut0: 300, cut1: 6000 });
    tone(v, 'sine', 90, 35, 0.5, 0.8, { start: 0.45 });
    noise(v, 'highpass', 3000, 3000, 0.7, 0.3, { start: 0.45 });
    v.wet(0.45);
  },
  ui_select_char: (v) => {
    tone(v, 'sine', 140, 50, 0.15, 0.7);
    chord(v, [hz(52), hz(59), hz(64), hz(67)], 0.35, 0.09, { cut0: 3000, cut1: 600 });
    noise(v, 'highpass', 3500, 3500, 0.1, 0.2);
    v.wet(0.3);
  },
  ui_slide: (v) => {
    noise(v, 'bandpass', 400, 3000, 0.2, 0.2, { q: 1.2, attack: 0.08 });
  },

  // ---- movement
  jump: (v) => noise(v, 'bandpass', 600, 1800, 0.08, 0.18, { attack: 0.01 }),
  land: (v) => {
    tone(v, 'sine', 130, 50, 0.08, 0.4);
    noise(v, 'lowpass', 500, 500, 0.07, 0.25);
  },
  dash: (v) => {
    noise(v, 'bandpass', 1400, 500, 0.13, 0.3, { attack: 0.02 });
    noise(v, 'lowpass', 300, 300, 0.1, 0.15);
  },
  step: (v) => noise(v, 'lowpass', 380, 380, 0.03, 0.12),

  // ---- attacks
  whiff_light: (v) => noise(v, 'bandpass', 2600, 1500, 0.06, 0.28, { q: 1.4, attack: 0.01 }),
  whiff_medium: (v) => noise(v, 'bandpass', 1900, 850, 0.1, 0.34, { q: 1.2, attack: 0.015 }),
  whiff_heavy: (v) => {
    noise(v, 'bandpass', 1300, 380, 0.15, 0.42, { q: 1, attack: 0.02 });
    tone(v, 'sine', 140, 70, 0.12, 0.12, { attack: 0.02 });
  },
  hit_light: (v) => hitCore(v, 0),
  hit_medium: (v) => hitCore(v, 1),
  hit_heavy: (v) => hitCore(v, 2),
  hit_special: (v) => {
    hitCore(v, 2);
    const bp = v.g.filter('bandpass', 1800, 2);
    bp.connect(v.out);
    tone(v, 'sawtooth', 1400, 260, 0.14, 0.3, { to: bp });
    crackles(v, 5, 0.14, 0.25);
    v.wet(0.18);
  },
  hit_super: (v) => {
    hitCore(v, 2);
    tone(v, 'sine', 90, 30, 0.45, 0.9);
    tone(v, 'sine', 2400, 2400, 0.25, 0.08, { start: 0.01 });
    tone(v, 'sine', 3600, 3600, 0.2, 0.06, { start: 0.02 });
    noise(v, 'highpass', 3000, 3000, 0.5, 0.25);
    crackles(v, 6, 0.2, 0.2);
    v.wet(0.35);
  },
  counter: (v) => {
    bell(v, 1320, 1.41, 3, 0.5, 0.32);
    tone(v, 'sine', 2640, 2640, 0.25, 0.1);
    v.wet(0.25);
  },
  block: (v) => {
    noise(v, 'bandpass', 3600, 3600, 0.035, 0.6, { q: 6 });
    const hp = v.g.filter('highpass', 900);
    hp.connect(v.out);
    tone(v, 'square', 1150, 950, 0.03, 0.14, { to: hp });
    tone(v, 'sine', 160, 90, 0.05, 0.25);
    v.wet(0.05);
  },
  block_heavy: (v) => {
    noise(v, 'bandpass', 2600, 2600, 0.06, 0.7, { q: 5 });
    bell(v, 760, 2.4, 2, 0.18, 0.22);
    tone(v, 'sine', 130, 60, 0.08, 0.45);
    v.wet(0.08);
  },
  armor: (v) => {
    bell(v, 310, 2.76, 4, 0.6, 0.45);
    bell(v, 620, 1.5, 2, 0.4, 0.22);
    tone(v, 'sine', 120, 50, 0.12, 0.6);
    noise(v, 'bandpass', 1500, 1500, 0.1, 0.4, { q: 3 });
    v.wet(0.2);
  },
  parry: (v) => {
    tone(v, 'sine', 1900, 1900, 0.25, 0.28);
    tone(v, 'sine', 2850, 2850, 0.3, 0.18);
    noise(v, 'highpass', 6000, 6000, 0.06, 0.25);
    v.wet(0.3);
  },
  grab: (v) => {
    noise(v, 'bandpass', 900, 900, 0.07, 0.4, { q: 1.5 });
    tone(v, 'sine', 180, 100, 0.06, 0.35);
  },
  throw_slam: (v) => {
    tone(v, 'sine', 110, 35, 0.28, 1.0, { to: drive(v, 'soft', 0.9) });
    noise(v, 'lowpass', 350, 200, 0.3, 0.6);
    crackles(v, 5, 0.2, 0.15, 0.02);
    v.wet(0.15);
  },
  tech: (v) => {
    noise(v, 'bandpass', 4200, 4200, 0.04, 0.5, { q: 8 });
    noise(v, 'bandpass', 4600, 4600, 0.04, 0.4, { q: 8, start: 0.05 });
    noise(v, 'bandpass', 1800, 900, 0.1, 0.25);
    bell(v, 1800, 1.41, 1.5, 0.15, 0.18);
    v.wet(0.08);
  },

  // ---- specials / projectiles
  proj_orb: (v) => {
    const bp = v.g.filter('bandpass', 900 * v.p, 3);
    sweep(bp.frequency, v.t, 900 * v.p, 1600 * v.p, 0.4);
    const a = v.g.gain(0);
    env(a.gain, v.t, 0.32, 0.01, 0.42);
    bp.connect(a);
    a.connect(v.out);
    v.g.osc('sawtooth', 180 * v.p, v.t, v.t + 0.5).connect(bp);
    v.g.osc('sawtooth', 183 * v.p, v.t, v.t + 0.5).connect(bp);
    tone(v, 'sawtooth', 1800, 400, 0.08, 0.18);
    crackles(v, 8, 0.4, 0.3);
    v.wet(0.15);
  },
  proj_lance: (v) => {
    const hp = v.g.filter('highpass', 400);
    hp.connect(v.out);
    tone(v, 'sawtooth', 2600, 320, 0.17, 0.38, { to: hp });
    tone(v, 'square', 800, 200, 0.12, 0.13);
    noise(v, 'highpass', 5000, 5000, 0.04, 0.3);
    v.wet(0.12);
  },
  proj_disc: (v) => {
    const t = v.t;
    const bp = v.g.filter('bandpass', 1400 * v.p, 2);
    const am = v.g.gain(0.5);
    const lfo = v.g.osc('square', 28, t, t + 0.6);
    const depth = v.g.gain(0.5);
    lfo.connect(depth);
    depth.connect(am.gain);
    const a = v.g.gain(0);
    env(a.gain, t, 0.3, 0.02, 0.5);
    const o = v.g.osc('sawtooth', 240 * v.p, t, t + 0.6);
    sweep(o.frequency, t, 240 * v.p, 480 * v.p, 0.5);
    o.connect(bp);
    bp.connect(am);
    am.connect(a);
    a.connect(v.out);
    v.wet(0.12);
  },
  proj_wave: (v) => {
    tone(v, 'sine', 70, 150, 0.4, 0.6);
    noise(v, 'lowpass', 300, 1400, 0.4, 0.4, { attack: 0.05 });
    v.wet(0.1);
  },
  clash: (v) => {
    noise(v, 'highpass', 2500, 2500, 0.05, 0.6);
    bell(v, 1500, 1.7, 3, 0.35, 0.32);
    tone(v, 'sine', 200, 80, 0.1, 0.4);
    v.wet(0.3);
  },
  rise: (v) => {
    noise(v, 'bandpass', 400, 2600, 0.26, 0.35, { q: 1.2, attack: 0.03 });
    const lp = v.g.filter('lowpass', 3000);
    lp.connect(v.out);
    tone(v, 'sawtooth', 220, 880, 0.25, 0.14, { to: lp });
    crackles(v, 4, 0.2, 0.15);
    v.wet(0.12);
  },
  spin: (v) => {
    amNoise(v, 1500, 1, 18, 0.45, 0.4, { attack: 0.03 });
    v.wet(0.05);
  },
  teleport: (v) => {
    for (let i = 0; i < 6; i++) {
      tone(v, 'square', 600 + Math.random() * 1800, 600 + Math.random() * 1800, 0.02, 0.12, { start: i * 0.025 });
    }
    noise(v, 'highpass', 2000, 4000, 0.03, 0.3, { attack: 0.12 });
    v.wet(0.25);
  },
  charge_rush: (v) => {
    const lp = v.g.filter('lowpass', 900);
    lp.connect(v.out);
    const d = v.g.gain(1);
    const sh = v.g.shaper(v.e.distCurve);
    d.connect(sh);
    sh.connect(lp);
    tone(v, 'sawtooth', 55, 90, 0.45, 0.3, { to: d });
    noise(v, 'lowpass', 600, 600, 0.35, 0.3, { attack: 0.05 });
    v.wet(0.05);
  },

  // ---- meter / systems
  super_flash: (v) => {
    tone(v, 'sine', 110, 40, 0.3, 0.8);
    noise(v, 'highpass', 3000, 3000, 0.2, 0.35);
    noise(v, 'bandpass', 500, 7000, 0.1, 0.32, { q: 2, attack: 0.6 });
    chord(v, [220, 277.2, 329.6, 440], 0.4, 0.07, { attack: 0.5, cut0: 400, cut1: 5000 });
    tone(v, 'sine', 80, 30, 0.5, 0.9, { start: 0.72 });
    noise(v, 'lowpass', 2000, 800, 0.6, 0.5, { start: 0.72 });
    v.wet(0.35);
  },
  ult_flash: (v) => {
    noise(v, 'bandpass', 1200, 600, 0.25, 0.7);
    noise(v, 'lowpass', 200, 120, 1.5, 0.6, { kind: 'brown', attack: 0.05 });
    noise(v, 'bandpass', 300, 8000, 0.1, 0.35, { q: 2, attack: 1.0 });
    // choir-ish: detuned saws through formant band-passes
    const t = v.t;
    const mixN = v.g.gain(0);
    env(mixN.gain, t, 0.09, 0.6, 0.7);
    mixN.connect(v.out);
    for (const fq of [700, 1100, 2500]) {
      const bp = v.g.filter('bandpass', fq, 4);
      bp.connect(mixN);
      for (const n of [110, 130.8, 164.8, 220]) {
        v.g.osc('sawtooth', n * v.p, t, t + 1.4, (Math.random() - 0.5) * 20).connect(bp);
      }
    }
    tone(v, 'sine', 70, 25, 0.8, 1.0, { start: 1.08, to: drive(v, 'soft', 0.9) });
    noise(v, 'highpass', 2500, 2500, 0.9, 0.4, { start: 1.08 });
    v.wet(0.5);
  },
  drive: (v) => {
    tone(v, 'sine', 110, 440, 0.5, 0.4, { attack: 0.02 });
    chord(v, [110, 164.8, 220], 0.5, 0.1, { attack: 0.3, cut0: 300, cut1: 3000 });
    noise(v, 'bandpass', 800, 3000, 0.2, 0.25, { attack: 0.2 });
    tone(v, 'sine', 1760, 1760, 0.4, 0.1, { start: 0.25 });
    v.wet(0.3);
  },
  burnout: (v) => {
    const lp = v.g.filter('lowpass', 1200);
    sweep(lp.frequency, v.t, 1200, 300, 0.6);
    lp.connect(v.out);
    tone(v, 'sawtooth', 420, 55, 0.6, 0.25, { to: lp });
    noise(v, 'lowpass', 800, 800, 0.3, 0.15);
    for (let i = 0; i < 4; i++) tone(v, 'square', 300 - i * 50, 300 - i * 50, 0.02, 0.08, { start: 0.15 + i * 0.09 });
    v.wet(0.1);
  },
  guardcancel: (v) => {
    noise(v, 'highpass', 2000, 2000, 0.08, 0.6);
    bell(v, 980, 2.1, 3, 0.3, 0.3);
    tone(v, 'sine', 150, 60, 0.12, 0.6);
    v.wet(0.2);
  },
  pushblock: (v) => {
    noise(v, 'lowpass', 400, 1600, 0.23, 0.45, { attack: 0.02 });
    tone(v, 'sine', 120, 70, 0.08, 0.35);
  },
  meter_stock: (v) => {
    tone(v, 'sine', 1760, 1760, 0.12, 0.16);
    tone(v, 'sine', 2640, 2640, 0.15, 0.12, { start: 0.04 });
    v.wet(0.15);
  },
  dizzy: (v) => {
    const t = v.t;
    for (const [f, peak, dur] of [[1100, 0.18, 0.7], [1650, 0.08, 0.5]] as const) {
      const o = v.g.osc('triangle', f * v.p, t, t + dur + 0.05);
      const lfo = v.g.osc('sine', 9, t, t + dur + 0.05);
      const depth = v.g.gain(180 * v.p);
      lfo.connect(depth);
      depth.connect(o.frequency);
      const a = v.g.gain(0);
      env(a.gain, t, peak, 0.02, dur);
      o.connect(a);
      a.connect(v.out);
    }
    v.wet(0.15);
  },
  knockdown: (v) => {
    tone(v, 'sine', 95, 40, 0.18, 0.75);
    noise(v, 'lowpass', 500, 500, 0.22, 0.5);
    tone(v, 'sine', 80, 40, 0.12, 0.4, { start: 0.12 });
    noise(v, 'lowpass', 400, 400, 0.15, 0.3, { start: 0.12 });
  },
  quickrise: (v) => {
    noise(v, 'bandpass', 900, 2200, 0.12, 0.25);
    tone(v, 'sine', 300, 500, 0.06, 0.1);
  },

  // ---- round flow
  announce_round: (v) => {
    chord(v, [130.8, 155.6, 196, 261.6], 0.6, 0.12, { cut0: 4000, cut1: 600 });
    tone(v, 'sine', 65, 65, 0.5, 0.5);
    noise(v, 'highpass', 4000, 4000, 0.15, 0.3);
    bell(v, 523, 3.5, 2, 0.5, 0.14);
    v.wet(0.35);
  },
  announce_fight: (v) => {
    chord(v, [130.8, 196, 261.6, 311.1, 392], 0.9, 0.12, { cut0: 5000, cut1: 700 });
    tone(v, 'sine', 70, 35, 0.7, 1.0, { to: drive(v, 'soft', 0.85) });
    noise(v, 'highpass', 2500, 2500, 1.0, 0.45);
    v.wet(0.45);
  },
  ko: (v) => {
    tone(v, 'sine', 80, 25, 1.3, 1.0, { to: drive(v, 'soft', 0.9) });
    tone(v, 'sine', 150, 40, 0.3, 0.9);
    noise(v, 'lowpass', 3500, 900, 1.6, 0.7);
    bell(v, 220, 2.76, 5, 1.5, 0.28);
    noise(v, 'highpass', 4000, 4000, 0.05, 0.6);
    v.wet(0.6);
  },
  perfect: (v) => {
    chord(v, [261.6, 329.6, 392, 493.9, 523.3], 1.0, 0.08, { cut0: 6000, cut1: 1500 });
    [523.3, 659.3, 784, 1046.5].forEach((f, i) => bell(v, f, 3.5, 1.2, 0.6, 0.16, { start: 0.08 * i }));
    noise(v, 'highpass', 7000, 7000, 0.6, 0.1, { attack: 0.1 });
    v.wet(0.45);
  },
  timeover: (v) => {
    const lp = v.g.filter('lowpass', 2500);
    lp.connect(v.out);
    for (let i = 0; i < 6; i++) tone(v, 'square', i % 2 ? 660 : 880, i % 2 ? 660 : 880, 0.11, 0.1, { start: i * 0.13, to: lp });
    v.wet(0.1);
  },
  timer_tick: (v) => {
    tone(v, 'sine', 1250, 1250, 0.04, 0.16);
    noise(v, 'highpass', 6000, 6000, 0.005, 0.05);
  },
  crowd_cheer: (v) => {
    noise(v, 'bandpass', 500, 600, 1.6, 0.25, { q: 1.4, attack: 0.4, kind: 'pink' });
    noise(v, 'bandpass', 1200, 1300, 1.6, 0.2, { q: 1.6, attack: 0.35, kind: 'pink' });
    noise(v, 'bandpass', 2600, 2400, 1.4, 0.1, { q: 2, attack: 0.3, kind: 'pink' });
    amNoise(v, 900, 2, 11, 1.4, 0.15, { attack: 0.3, kind: 'pink' });
    v.wet(0.2);
  },
  victory_sting: (v) => {
    const notes: [number, number, number][] = [[261.6, 0, 0.12], [329.6, 0.11, 0.12], [392, 0.22, 0.12], [523.3, 0.34, 0.9]];
    for (const [f, st, d] of notes) chord(v, [f, f * 1.003], d, 0.13, { start: st, attack: 0.02, cut0: 3200, cut1: 1100 });
    tone(v, 'sine', 98, 80, 0.6, 0.5, { start: 0.34 });
    v.wet(0.35);
  },
};

export const SFX_NAMES = Object.keys(SYNTHS) as SfxName[];

const RANDOM_PITCH = new Set<SfxName>([
  'hit_light', 'hit_medium', 'hit_heavy', 'hit_special', 'block', 'block_heavy', 'whiff_light', 'whiff_medium',
  'whiff_heavy', 'step', 'land', 'jump', 'dash',
]);

export class SfxPlayer {
  private voices = 0;
  private last = new Map<SfxName, number>();
  static readonly MAX_VOICES = 32;

  constructor(private e: Engine) {}

  play(name: SfxName, opts: SfxOptions = {}): void {
    const e = this.e;
    const ctx = e.ctx;
    if (ctx.state !== 'running') return;
    const synth = SYNTHS[name];
    if (!synth) return;
    const now = ctx.currentTime;
    const prev = this.last.get(name);
    if (prev !== undefined && now - prev < 0.025) return;
    if (this.voices >= SfxPlayer.MAX_VOICES) return;
    this.last.set(name, now);

    const g = new Group(e);
    const out = g.gain(Math.max(0, Math.min(2, opts.vol ?? 1)) * 0.9);
    if (e.hasPanner && opts.pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, opts.pan));
      g.add(p);
      out.connect(p);
      p.connect(e.sfxVol);
    } else {
      out.connect(e.sfxVol);
    }
    let pitch = opts.pitch ?? 1;
    if (opts.pitch === undefined && RANDOM_PITCH.has(name)) pitch *= 0.96 + Math.random() * 0.08;
    let wetDone = false;
    const v: V = {
      e, g, out, t: now + 0.004, p: pitch,
      wet: (amount: number) => {
        if (wetDone || amount <= 0) return;
        wetDone = true;
        const s = g.gain(amount);
        out.connect(s);
        s.connect(e.sfxWet);
      },
    };
    try {
      synth(v);
    } catch {
      g.done();
      return;
    }
    this.voices++;
    g.done(() => { this.voices--; });
  }
}
