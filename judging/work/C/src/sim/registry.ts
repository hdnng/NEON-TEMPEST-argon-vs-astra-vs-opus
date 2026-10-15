/**
 * Character / move registry. Builds lookup tables once from the data files.
 */
import type { CharacterDef, MoveDef, MoveType } from '../data/schema';
import { CHARACTER_LIST } from '../data/characters';

export const CHARACTERS: Record<string, CharacterDef> = {};
const MOVES: Record<string, Record<string, MoveDef>> = {};
const CANDIDATES: Record<string, MoveDef[]> = {};

/** Class rank used to resolve simultaneous matches (higher wins). */
export const TYPE_RANK: Record<MoveType, number> = {
  ultimate: 10, super: 9, guardcancel: 8, pushblock: 8, ex: 7, special: 6, drive: 5, throw: 4,
  command: 3, normal: 2,
};

for (const c of CHARACTER_LIST) {
  CHARACTERS[c.id] = c;
  MOVES[c.id] = {};
  for (const m of c.moves) MOVES[c.id][m.id] = m;
  CANDIDATES[c.id] = c.moves.slice().sort((a, b) =>
    (TYPE_RANK[b.type] - TYPE_RANK[a.type]) || ((b.priority ?? 0) - (a.priority ?? 0)));
}

export function getChar(id: string): CharacterDef {
  const c = CHARACTERS[id];
  if (!c) throw new Error(`Unknown character ${id}`);
  return c;
}

export function getMove(charId: string, moveId: string): MoveDef | undefined {
  return MOVES[charId]?.[moveId];
}

export function candidates(charId: string): MoveDef[] {
  return CANDIDATES[charId];
}

export function moveTotal(m: MoveDef): number {
  return m.startup - 1 + m.active + m.recovery;
}

/** Id prefix match: 'orb' matches 'orb_L', 'orb_EX'; exact ids match themselves. */
export function idMatches(moveId: string, pattern: string): boolean {
  return moveId === pattern || moveId.startsWith(pattern + '_');
}
