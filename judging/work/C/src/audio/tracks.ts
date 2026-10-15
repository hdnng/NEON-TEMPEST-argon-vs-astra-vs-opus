/**
 * Procedural music tracks. Each track is a small arrangement of sections; each section is a
 * set of 16th-note step patterns (one char per step, patterns repeat to fill the section):
 *
 *   drums  'x' hit, 'X' accent, 'g' ghost, 'o' open hat, '.' rest
 *   bass   'r' root, 'R' root +8va, 'f' fifth, 't' 2nd chord tone, 's' 4th chord tone, '-' hold, '.' rest
 *   arp    '0'-'9' chord-tone index (wraps upward in octaves), '-' hold, '.' rest
 *   lead   '0'-'9','a'-'f' scale degree (10-15) relative to the lead base note, '-' hold, '.' rest
 *   stab   'x' chord stab, '-' hold, '.' rest  (pads play sustained chords if no stab pattern)
 *
 * Chords are given one per bar by name (e.g. 'Am9', 'Fmaj7', 'Bb', 'E5').
 */
import type { TrackId } from './types';
import type { BassInst, DrumKind, MelInst, PadInst } from './instruments';

export interface SectionDef {
  bars: number;
  chords: string[];
  kick?: string;
  snare?: string;
  clap?: string;
  hat?: string;
  tom?: string;
  perc?: string;
  bass?: string;
  arp?: string;
  lead?: string;
  lead2?: string;
  /** Pads: true = sustained chords, string = stab pattern, false/undefined = none. */
  pad?: boolean | string;
  riser?: boolean;
  crash?: boolean;
}

export interface TrackDef {
  bpm: number;
  swing: number;
  /** Key root pitch class (0 = C). */
  key: number;
  scale: number[];
  sections: SectionDef[];
  order: number[];
  /** Index into `order` to loop back to after the end. */
  loopFrom: number;
  vol: number;
  kit: { kick: DrumKind; snare: DrumKind; clap: DrumKind; tom: DrumKind; perc: DrumKind };
  bass: BassInst;
  pad: PadInst;
  arp: MelInst;
  lead: MelInst;
  lead2: MelInst;
  /** MIDI base notes. */
  bassBase: number;
  padBase: number;
  arpBase: number;
  leadBase: number;
  lead2Base: number;
  mix: { kick: number; snare: number; clap: number; hat: number; tom: number; perc: number; bass: number; pad: number; arp: number; lead: number; lead2: number };
  /** Echo: delay in steps, feedback, wet level. */
  delay: { steps: number; fb: number; wet: number };
  texture?: 'vinyl' | 'rain';
}

export const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  in: [0, 1, 5, 7, 8],
};

const MIX = { kick: 1, snare: 0.8, clap: 0.7, hat: 0.5, tom: 0.8, perc: 0.6, bass: 1, pad: 1, arp: 0.8, lead: 1, lead2: 0.8 };
const KIT = { kick: 'kick' as DrumKind, snare: 'snare' as DrumKind, clap: 'clap' as DrumKind, tom: 'tom' as DrumKind, perc: 'clank' as DrumKind };

type TrackInput = Omit<Partial<TrackDef>, 'kit' | 'mix'> & Pick<TrackDef, 'bpm' | 'key' | 'sections' | 'order'> & {
  kit?: Partial<TrackDef['kit']>;
  mix?: Partial<TrackDef['mix']>;
};

function track(t: TrackInput): TrackDef {
  return {
    swing: 0,
    scale: SCALES.minor,
    loopFrom: 0,
    vol: 0.75,
    bass: 'subsaw',
    pad: 'warm',
    arp: 'pluck',
    lead: 'saw',
    lead2: 'bell',
    bassBase: 36,
    padBase: 48,
    arpBase: 60,
    leadBase: 60,
    lead2Base: 72,
    delay: { steps: 3, fb: 0.32, wet: 0.28 },
    ...t,
    kit: { ...KIT, ...(t.kit ?? {}) },
    mix: { ...MIX, ...(t.mix ?? {}) },
  };
}

export const TRACKS: Record<TrackId, TrackDef> = {
  // Slow atmospheric neon-noir: pads, sparse piano, distant rain texture.
  title: track({
    bpm: 86, key: 9, scale: SCALES.minor, texture: 'rain', vol: 0.8,
    bass: 'sine', pad: 'warm', lead: 'piano', arp: 'bell', leadBase: 57, arpBase: 69,
    kit: { kick: 'kickDeep', snare: 'rim' },
    mix: { hat: 0.35, snare: 0.6, pad: 1.2, lead: 1.1, arp: 0.5 },
    delay: { steps: 6, fb: 0.4, wet: 0.35 },
    sections: [
      { bars: 4, chords: ['Am9', 'Fmaj7', 'Cmaj7', 'Em7'], pad: true,
        lead: 'b...9...7...4... c...b...9...7... b...9...6...4... b.......d.......' },
      { bars: 4, chords: ['Am9', 'Fmaj7', 'Cmaj7', 'Em7'], pad: true,
        kick: 'x.........x.....', snare: '........x.......', hat: '..g...g...g...g.',
        bass: 'r---------------',
        lead: 'b...9...7...4... c...b...9...7... b...9...6...4... b.......d.......' },
      { bars: 4, chords: ['Dm9', 'Am9', 'Fmaj7', 'G'], pad: true,
        kick: 'x.........x.....', snare: '........x.......', hat: '..g...g...g...gg',
        bass: 'r---------------', arp: '0...2...1...3...',
        lead: 'a...c...e...c... b...9...7....... c...9...5...7... d.......8...6...' },
    ],
    order: [0, 1, 2, 1, 2], loopFrom: 1,
  }),

  // Chill synthwave, D dorian.
  menu: track({
    bpm: 100, key: 2, scale: SCALES.dorian,
    bass: 'subsaw', pad: 'warm', arp: 'pluck', lead: 'saw', leadBase: 62, arpBase: 62,
    mix: { hat: 0.35, arp: 0.7, lead: 0.85 },
    delay: { steps: 3, fb: 0.38, wet: 0.3 },
    sections: [
      { bars: 4, chords: ['Dm7', 'Bbmaj7', 'F', 'C'], pad: true,
        kick: 'x.......x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.xo',
        bass: 'r.r.r.r.r.r.r.R.', arp: '0.2.1.3.0.2.1.3.' },
      { bars: 4, chords: ['Gm7', 'Dm7', 'Bbmaj7', 'A7'], pad: true,
        kick: 'x.......x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.xo',
        bass: 'r.r.r.r.r.r.r.R.', arp: '0.2.1.3.0.2.1.3.',
        lead: 'a---9-7-6---4--- 7---------5-4--- 3---4-6-7---6--- 4-------1---4---' },
    ],
    order: [0, 0, 1, 1],
  }),

  // Energetic select screen, E harmonic minor.
  select: track({
    bpm: 124, key: 4, scale: SCALES.harmonicMinor,
    bass: 'reese', pad: 'warm', arp: 'pluck', lead: 'square', leadBase: 64, arpBase: 64,
    mix: { pad: 0.7, lead: 0.9, hat: 0.45 },
    delay: { steps: 3, fb: 0.3, wet: 0.25 },
    sections: [
      { bars: 4, chords: ['Em', 'C', 'G', 'D'], pad: true, crash: true,
        kick: 'x...x...x...x...', clap: '....x.......x...', hat: 'x.o.x.o.x.o.x.o.',
        bass: 'r.rR.rr.r.rR.rr.', arp: '0123012301230123' },
      { bars: 4, chords: ['Am', 'Em', 'C', 'B7'], pad: true,
        kick: 'x...x...x...x...', clap: '....x.......x...', hat: 'x.o.x.o.x.o.x.o.',
        bass: 'r.rR.rr.r.rR.rr.', arp: '0123012301230123',
        lead: '4.4.5.7.-.5.4.2. 4---------2-4--- 7.7.9.7.-.5.4.2. 6---4---1-------' },
    ],
    order: [0, 1],
  }),

  // Tense versus splash loop, C minor.
  versus: track({
    bpm: 140, key: 0, scale: SCALES.minor,
    bass: 'dist', pad: 'brass', vol: 0.8,
    kit: { kick: 'kickHard', tom: 'taiko' },
    mix: { hat: 0.3, pad: 0.8 },
    sections: [
      { bars: 2, chords: ['Cm', 'Cm'], pad: 'x.....x.....x...',
        kick: 'x..x..x...x..x..', tom: '....x.......x.x.', hat: 'xgxgxgxgxgxgxgxg',
        bass: 'r--r--r-r--r--rR' },
      { bars: 2, chords: ['Ab', 'G'], pad: 'x.....x.....x...', riser: true,
        kick: 'x..x..x...x..x..', tom: '....x.......x.x.', hat: 'xgxgxgxgxgxgxgxg',
        snare: '....x.......x.......x.x.xxxxXXXX',
        bass: 'r--r--r-r--r--rR' },
    ],
    order: [0, 1],
  }),

  // Rooftop: driving synthwave / drum & bass, F minor.
  stage_rooftop: track({
    bpm: 150, key: 5, scale: SCALES.minor,
    bass: 'reese', pad: 'warm', arp: 'pluck', lead: 'saw', lead2: 'bell', leadBase: 65, arpBase: 65, lead2Base: 65,
    mix: { hat: 0.45, arp: 0.65, pad: 0.8, lead: 0.9 },
    delay: { steps: 3, fb: 0.35, wet: 0.26 },
    sections: [
      { bars: 4, chords: ['Fm', 'Db', 'Ab', 'Eb'], pad: true, crash: true,
        kick: 'x.........x.....x.x.......x.....', snare: '....X.......X.......X..g....X...',
        hat: 'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.xo', bass: 'r-----r-r---R-r-', arp: '0121012101210121' },
      { bars: 4, chords: ['Fm', 'Db', 'Ab', 'Eb'], pad: true, crash: true,
        kick: 'x.........x.....x.x.......x.....', snare: '....X.......X.......X..g....X...',
        hat: 'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.xo', bass: 'r-----r-r---R-r-', arp: '0121012101210121',
        lead: '7---4---7-9-7--- 5---4---2---4--- 4---2---4-5-7--- 8-------6---4---' },
      { bars: 4, chords: ['Bbm', 'Fm', 'Db', 'C'], pad: true, riser: true,
        hat: '....x.......x...', arp: '0.1.2.3.2.1.0.1.',
        lead2: '7.......9....... 7.......4....... 5.......7....... 6-------........' },
    ],
    order: [0, 1, 2, 1],
  }),

  // Shrine alley: in-scale koto plucks, taiko, shakuhachi-like flute.
  stage_shrine: track({
    bpm: 128, key: 2, scale: SCALES.in,
    bass: 'sine', pad: 'glass', arp: 'koto', lead: 'koto', lead2: 'flute', leadBase: 62, arpBase: 62, lead2Base: 62,
    kit: { tom: 'taiko', snare: 'rim', clap: 'clap' },
    mix: { tom: 1.0, hat: 0.4, pad: 0.6, lead: 1.0, lead2: 1.0, arp: 0.8 },
    delay: { steps: 3, fb: 0.4, wet: 0.3 },
    sections: [
      { bars: 4, chords: ['D5', 'D5', 'Gm', 'A5'], pad: true,
        tom: 'x..x..x.x...x...', kick: 'x.......x.......',
        bass: 'r-------r-------',
        lead: '5.3.4.3.2.3.0... 5.6.5.3.4---3--- 7.5.4.2.4.5.7... 8---7.6.5---3---' },
      { bars: 4, chords: ['Bb', 'Gm', 'D5', 'A5'], pad: true, crash: true,
        tom: 'x..x..x.x...x...', kick: 'x.......x.......', hat: 'g.x.g.x.g.x.g.x.', clap: '....x.......x...',
        bass: 'r.......r...f...', arp: '0.1.2.1.0.1.2.1.',
        lead2: '9-------8---7--- 7-----5-4------- 5-------3---5--- 8---------------' },
      { bars: 2, chords: ['D5', 'A5'], tom: 'x.xx.x.xx.x.xxxx', kick: 'x.......x...x...', riser: true,
        lead: '5...........3... 0...............' },
    ],
    order: [0, 1, 0, 1, 2],
  }),

  // Underground pit: industrial, distorted bass, E phrygian.
  stage_pit: track({
    bpm: 132, key: 4, scale: SCALES.phrygian,
    bass: 'dist', pad: 'dark', lead: 'square', leadBase: 64,
    kit: { kick: 'kickHard', clap: 'clap', perc: 'clank' },
    mix: { hat: 0.4, clap: 0.85, perc: 0.8, pad: 0.9, lead: 0.85 },
    delay: { steps: 2, fb: 0.3, wet: 0.2 },
    sections: [
      { bars: 4, chords: ['E5', 'E5', 'F5', 'G5'], pad: true, crash: true,
        kick: 'x..x..x...x..x..', clap: '....X.......X...', hat: 'x.xxx.xxx.xxx.xx', perc: '..x.......x..x..',
        bass: 'r.rr.rr.r.rr.rRr' },
      { bars: 4, chords: ['A5', 'G5', 'F5', 'E5'], pad: true,
        kick: 'x..x..x...x..x..', clap: '....X.......X...', hat: 'x.xxx.xxx.xxx.xx', perc: '..x.......x..x..',
        bass: 'r.rr.rr.r.rr.rRr',
        lead: '3.3.4.3.1.0..... 2.2.3.2.1.0..... 1.1.2.1.0.0.1.0. 0---1---0-------' },
      { bars: 2, chords: ['E5', 'F5'], pad: true, riser: true, perc: 'x..x..x.x..x..x.', hat: '....x.......x...' },
    ],
    order: [0, 1, 0, 1, 2],
  }),

  // Laid-back lo-fi for training, F major with swing.
  training: track({
    bpm: 90, key: 5, scale: SCALES.major, swing: 0.18, texture: 'vinyl',
    bass: 'sine', pad: 'epiano', lead: 'bell', leadBase: 65,
    kit: { kick: 'kickDeep', snare: 'rim' },
    mix: { hat: 0.35, snare: 1.0, pad: 1.0, lead: 0.8 },
    delay: { steps: 3, fb: 0.35, wet: 0.25 },
    sections: [
      { bars: 4, chords: ['Fmaj7', 'Em7', 'Dm7', 'Cmaj7'], pad: 'x.....x...x.....',
        kick: 'x......x..x.....', snare: '....x.......x..g', hat: 'x.x.x.x.x.x.x.x.', bass: 'r.....r...r.f...' },
      { bars: 4, chords: ['Bbmaj7', 'Am7', 'Gm7', 'C7'], pad: 'x.....x...x.....',
        kick: 'x......x..x.....', snare: '....x.......x..g', hat: 'x.x.x.x.x.x.x.x.', bass: 'r.....r...r.f...',
        lead: '9...7...6...4... 6.......4...2... 5...3...1...3... 4-------6-------' },
    ],
    order: [0, 1],
  }),

  // Victory: short fanfare then a soft loop.
  victory: track({
    bpm: 112, key: 0, scale: SCALES.major,
    pad: 'glass', lead: 'brass', arp: 'bell', leadBase: 60, arpBase: 72, vol: 0.8,
    kit: { tom: 'taiko' },
    mix: { lead: 1.2, arp: 0.6, pad: 0.9 },
    sections: [
      { bars: 2, chords: ['C', 'G'], pad: 'x..x..x.x-------', crash: true,
        kick: 'x...x...x.x.x.x.', snare: '....x...x.xxxxXX', tom: 'x.......x.......',
        lead: '0.2.4.7---4-7--- b---------------' },
      { bars: 4, chords: ['C', 'F', 'Am', 'G'], pad: true, crash: true, arp: '0...1...2...1...',
        lead: '7-------9------- a-------9------- 7---------------6---------------' },
    ],
    order: [0, 1], loopFrom: 1,
  }),

  // Results: calm, reflective, G major.
  results: track({
    bpm: 96, key: 7, scale: SCALES.major,
    bass: 'sine', pad: 'epiano', lead: 'bell', arp: 'bell', leadBase: 67, arpBase: 67,
    kit: { kick: 'kickDeep', snare: 'rim' },
    mix: { hat: 0.3, arp: 0.5, lead: 0.8, pad: 0.9 },
    delay: { steps: 3, fb: 0.38, wet: 0.3 },
    sections: [
      { bars: 4, chords: ['Gmaj7', 'Bm7', 'Cmaj7', 'D'], pad: true,
        kick: 'x.......x..x....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', bass: 'r-------r-----f-',
        arp: '0.2.1.3.0.2.1.3.' },
      { bars: 4, chords: ['Em7', 'Cmaj7', 'Am7', 'Dsus4'], pad: true,
        kick: 'x.......x..x....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', bass: 'r-------r-----f-',
        lead: '5---4---2---0--- 2---4---5------- 4---2---0---2--- 3-------4-------' },
    ],
    order: [0, 1],
  }),
};

// ---------------------------------------------------------------------------------------------
// Chord parsing

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const QUAL: Record<string, number[]> = {
  '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], M7: [0, 4, 7, 11],
  sus2: [0, 2, 7], sus4: [0, 5, 7], add9: [0, 4, 7, 14], m9: [0, 3, 7, 10, 14], dim: [0, 3, 6], '5': [0, 7, 12],
  '6': [0, 4, 7, 9], m6: [0, 3, 7, 9], '9': [0, 4, 7, 10, 14],
};

export interface Chord { pc: number; iv: number[] }

export function parseChord(name: string): Chord {
  const m = /^([A-G])([#b]?)(.*)$/.exec(name.trim());
  if (!m) return { pc: 0, iv: [0, 4, 7] };
  let pc = PC[m[1]];
  if (m[2] === '#') pc++;
  if (m[2] === 'b') pc--;
  return { pc: (pc + 12) % 12, iv: QUAL[m[3]] ?? [0, 4, 7] };
}

/** Lowest MIDI note >= base with pitch class pc. */
export function noteAbove(base: number, pc: number): number {
  return base + ((pc - (base % 12) + 12) % 12);
}
