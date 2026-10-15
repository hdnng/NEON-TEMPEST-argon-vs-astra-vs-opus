import { describe, expect, it } from 'vitest';
import { audio } from '../src/audio/audio';
import { SFX_NAMES } from '../src/audio/sfx';
import { TRACKS, parseChord } from '../src/audio/tracks';
import type { Ambience, TrackId } from '../src/audio/types';

describe('audio (no AudioContext available)', () => {
  it('every API call is a safe no-op in Node', () => {
    expect(() => {
      audio.unlock();
      audio.setVolumes(0.5, 0.5, 0.5, false);
      for (const n of SFX_NAMES) audio.sfx(n, { pan: 0.3, vol: 1, pitch: 1.1 });
      for (const t of Object.keys(TRACKS) as TrackId[]) audio.music(t, 0.5);
      audio.music(null);
      for (const a of ['rain', 'storm', 'crowd', 'none'] as Ambience[]) audio.ambience(a);
      audio.duck(0.5, 1);
      audio.setMuffled(true);
      audio.setMuffled(false);
      audio.suspend();
      audio.resume();
    }).not.toThrow();
    expect(audio.unlocked).toBe(false);
    expect(audio.beat()).toEqual({ phase: 0, count: 0, bpm: 120 });
  });

  it('defines a synth for every SfxName and data for every track', () => {
    expect(SFX_NAMES.length).toBeGreaterThanOrEqual(50); // completeness is enforced by Record<SfxName, ...>
    const ids: TrackId[] = ['title', 'menu', 'select', 'versus', 'stage_rooftop', 'stage_shrine', 'stage_pit', 'training', 'victory', 'results'];
    for (const id of ids) {
      const t = TRACKS[id];
      expect(t.sections.length).toBeGreaterThanOrEqual(2);
      for (const s of t.sections) for (const c of s.chords) expect(parseChord(c).iv.length).toBeGreaterThan(1);
    }
  });
});
