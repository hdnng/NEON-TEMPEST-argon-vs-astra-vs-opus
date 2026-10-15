/**
 * State hashing (FNV-1a 32-bit over a canonical JSON encoding) used by determinism tests,
 * replays and desync checks. Transient presentation events are excluded.
 */
import type { MatchState } from './types';

export function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function hashState(s: MatchState): number {
  const { events: _events, ...rest } = s;
  return fnv1a(JSON.stringify(rest));
}

/** Deep clone of a match state (rollback snapshot). */
export function cloneState(s: MatchState): MatchState {
  return structuredClone(s);
}

/** Serialize / deserialize for save files and network transport. */
export function serializeState(s: MatchState): string {
  return JSON.stringify(s);
}
export function deserializeState(json: string): MatchState {
  return JSON.parse(json) as MatchState;
}
