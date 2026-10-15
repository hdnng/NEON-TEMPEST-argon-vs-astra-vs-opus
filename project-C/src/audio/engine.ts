/**
 * Audio engine core: AudioContext creation, bus graph, shared noise buffers, reverb impulse
 * response, waveshaper curves and a small node-group helper that disconnects every node of a
 * voice once its last source has ended (no leaks).
 *
 * Bus graph:
 *   musicIn -> musicFilter (lowpass, pause muffle) -> musicDuck -> musicVol -> master
 *   sfxVol -> master,  sfxWet (per-voice sends, scaled by sfx volume) -> reverb
 *   musicVol -> musicSend -> reverb,  reverb -> reverbOut -> master
 *   ambVol -> master
 *   master -> compressor -> destination
 */

export interface Engine {
  ctx: AudioContext;
  master: GainNode;
  comp: DynamicsCompressorNode;
  musicIn: GainNode;
  musicFilter: BiquadFilterNode;
  musicDuck: GainNode;
  musicVol: GainNode;
  musicSend: GainNode;
  sfxVol: GainNode;
  sfxWet: GainNode;
  ambVol: GainNode;
  reverb: ConvolverNode;
  reverbOut: GainNode;
  white: AudioBuffer;
  pink: AudioBuffer;
  brown: AudioBuffer;
  crackle: AudioBuffer;
  distCurve: Float32Array<ArrayBuffer>;
  softCurve: Float32Array<ArrayBuffer>;
  hasPanner: boolean;
}

type Ctor = typeof AudioContext;

export function audioSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
  return !!(w.AudioContext || w.webkitAudioContext);
}

function makeNoise(ctx: AudioContext, seconds: number, kind: 'white' | 'pink' | 'brown'): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === 'white') d[i] = w;
    else if (kind === 'pink') {
      // Paul Kellet's refined pink noise filter
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    } else {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
  }
  // short crossfade so loops are seamless
  const fade = Math.min(2048, len >> 4);
  for (let i = 0; i < fade; i++) {
    const t = i / fade;
    d[len - fade + i] = d[len - fade + i] * (1 - t) + d[i] * t;
  }
  return buf;
}

/** Sparse random clicks + faint hiss: vinyl texture loop. */
function makeCrackle(ctx: AudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.015;
  const pops = Math.floor(seconds * 14);
  for (let p = 0; p < pops; p++) {
    const at = Math.floor(Math.random() * (len - 200));
    const amp = 0.2 + Math.random() * 0.6;
    const n = 20 + Math.floor(Math.random() * 80);
    for (let i = 0; i < n; i++) d[at + i] += (Math.random() * 2 - 1) * amp * Math.exp(-i / (n * 0.25));
  }
  return buf;
}

function makeImpulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    // a few discrete early reflections, then a dense exponentially decaying tail
    for (let i = 0; i < len; i++) {
      const t = i / len;
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (i < ctx.sampleRate * 0.012 ? 0.2 : 1);
    }
    for (let r = 0; r < 6; r++) {
      const at = Math.floor(ctx.sampleRate * (0.013 + r * 0.011 + Math.random() * 0.006));
      if (at < len) d[at] += (c ? -1 : 1) * (0.5 - r * 0.06);
    }
  }
  return buf;
}

function makeCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 2048;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
  }
  return curve;
}

export function createEngine(): Engine | null {
  if (!audioSupported()) return null;
  const w = window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
  const Ctx = (w.AudioContext || w.webkitAudioContext)!;
  let ctx: AudioContext;
  try {
    ctx = new Ctx({ latencyHint: 'interactive' });
  } catch {
    return null;
  }
  const g = (v: number) => { const n = ctx.createGain(); n.gain.value = v; return n; };
  const master = g(0.8);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 10;
  comp.ratio.value = 5;
  comp.attack.value = 0.003;
  comp.release.value = 0.2;
  master.connect(comp);
  comp.connect(ctx.destination);

  const musicIn = g(1);
  const musicFilter = ctx.createBiquadFilter();
  musicFilter.type = 'lowpass';
  musicFilter.frequency.value = 20000;
  musicFilter.Q.value = 0.7;
  const musicDuck = g(1);
  const musicVol = g(0.6);
  const musicSend = g(0.16);
  musicIn.connect(musicFilter);
  musicFilter.connect(musicDuck);
  musicDuck.connect(musicVol);
  musicVol.connect(master);

  const sfxVol = g(0.85);
  sfxVol.connect(master);
  const sfxWet = g(0.85);
  const ambVol = g(0.6);
  ambVol.connect(master);

  const reverb = ctx.createConvolver();
  reverb.buffer = makeImpulse(ctx, 2.4, 3.2);
  const reverbOut = g(0.55);
  sfxWet.connect(reverb);
  musicVol.connect(musicSend);
  musicSend.connect(reverb);
  reverb.connect(reverbOut);
  reverbOut.connect(master);

  return {
    ctx, master, comp, musicIn, musicFilter, musicDuck, musicVol, musicSend, sfxVol, sfxWet, ambVol,
    reverb, reverbOut,
    white: makeNoise(ctx, 2, 'white'),
    pink: makeNoise(ctx, 4, 'pink'),
    brown: makeNoise(ctx, 4, 'brown'),
    crackle: makeCrackle(ctx, 3),
    distCurve: makeCurve(6),
    softCurve: makeCurve(2),
    hasPanner: typeof ctx.createStereoPanner === 'function',
  };
}

export const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

/**
 * A group of nodes belonging to one voice/note. Every node is disconnected when the source
 * that stops last fires `onended`.
 */
export class Group {
  nodes: AudioNode[] = [];
  private last: AudioScheduledSourceNode | null = null;
  private lastEnd = -1;
  constructor(readonly e: Engine) {}

  add<T extends AudioNode>(n: T): T {
    this.nodes.push(n);
    return n;
  }

  gain(v = 0): GainNode {
    const n = this.e.ctx.createGain();
    n.gain.value = v;
    return this.add(n);
  }

  filter(type: BiquadFilterType, freq: number, q = 0.7): BiquadFilterNode {
    const f = this.e.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return this.add(f);
  }

  shaper(curve: Float32Array<ArrayBuffer>): WaveShaperNode {
    const s = this.e.ctx.createWaveShaper();
    s.curve = curve;
    s.oversample = '2x';
    return this.add(s);
  }

  osc(type: OscillatorType, freq: number, start: number, stop: number, detune = 0): OscillatorNode {
    const o = this.e.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    if (detune) o.detune.value = detune;
    this.src(o, start, stop);
    return o;
  }

  noise(buf: AudioBuffer, start: number, stop: number, loop = false): AudioBufferSourceNode {
    const s = this.e.ctx.createBufferSource();
    s.buffer = buf;
    s.loop = loop;
    const off = loop ? 0 : Math.random() * Math.max(0, buf.duration - (stop - start) - 0.01);
    s.start(start, Math.max(0, off));
    s.stop(stop);
    this.track(s, stop);
    return this.add(s);
  }

  private src(n: AudioScheduledSourceNode, start: number, stop: number): void {
    n.start(start);
    n.stop(stop);
    this.track(n, stop);
    this.add(n);
  }

  private track(n: AudioScheduledSourceNode, stop: number): void {
    if (stop >= this.lastEnd) {
      this.last = n;
      this.lastEnd = stop;
    }
  }

  /** Arms cleanup. `onDone` runs after disconnection (voice accounting). */
  done(onDone?: () => void): void {
    const nodes = this.nodes;
    const fin = () => {
      for (const n of nodes) {
        try { n.disconnect(); } catch { /* already disconnected */ }
      }
      onDone?.();
    };
    if (this.last) this.last.onended = fin;
    else fin();
  }
}

/** Attack / exponential-decay envelope on a gain param. */
export function env(p: AudioParam, t: number, peak: number, attack: number, decay: number, floor = 0.0001): void {
  p.cancelScheduledValues(t);
  p.setValueAtTime(floor, t);
  p.linearRampToValueAtTime(Math.max(floor, peak), t + Math.max(0.001, attack));
  p.exponentialRampToValueAtTime(floor, t + attack + Math.max(0.005, decay));
}

/** ADSR-ish envelope for sustained notes: attack, hold at sustain until `off`, then release. */
export function adsr(p: AudioParam, t: number, off: number, peak: number, attack: number, decay: number, sustain: number, release: number): void {
  const a = Math.max(0.002, attack);
  p.cancelScheduledValues(t);
  p.setValueAtTime(0.0001, t);
  p.linearRampToValueAtTime(peak, t + a);
  const dEnd = Math.min(off, t + a + decay);
  if (dEnd > t + a) p.exponentialRampToValueAtTime(Math.max(0.0001, peak * sustain), dEnd);
  p.setValueAtTime(Math.max(0.0001, peak * sustain), Math.max(off, t + a));
  p.exponentialRampToValueAtTime(0.0001, Math.max(off, t + a) + Math.max(0.01, release));
}

/** Exponential pitch sweep helper. */
export function sweep(p: AudioParam, t: number, from: number, to: number, dur: number): void {
  p.setValueAtTime(Math.max(1, from), t);
  p.exponentialRampToValueAtTime(Math.max(1, to), t + Math.max(0.005, dur));
}
