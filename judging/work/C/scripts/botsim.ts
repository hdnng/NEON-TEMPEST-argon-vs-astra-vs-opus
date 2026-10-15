/**
 * Headless CPU-vs-CPU simulation at maximum speed.
 *   npm run botsim -- [matchesPerPair=32] [difficulty=2]
 * Runs every ordered character pair, checks for crashes, softlocks (match too long) and stuck
 * states, and writes a win-rate matrix + stats to balance-report.json and BALANCE.md.
 */
import { writeFileSync } from 'node:fs';
import { CpuController } from '../src/ai/cpu';
import { CHARACTER_LIST } from '../src/data/characters';
import { createMatch, defaultConfig, stepMatch } from '../src/sim/match';
import type { MatchState } from '../src/sim/types';

const perPair = Number(process.argv[2] ?? 32);
const difficulty = Number(process.argv[3] ?? 2);
const MAX_FRAMES = 60 * 60 * 9; // 9 minutes of game time = certainly a softlock
const STUCK_FRAMES = 60 * 12;
const NEUTRAL = new Set(['idle', 'walkF', 'walkB', 'crouch', 'guard', 'intro', 'win', 'lose', 'ko', 'down']);

interface Result {
  a: string; b: string; winner: number; frames: number; rounds: number; kinds: string[];
  dmg: [number, number]; maxCombo: [number, number]; supers: [number, number]; specials: [number, number]; throws: [number, number];
  error?: string; stuck?: string;
}

const ids = CHARACTER_LIST.map((c) => c.id);
const results: Result[] = [];
const t0 = Date.now();
let seed = 1;
let totalFrames = 0;

for (const a of ids) {
  for (const b of ids) {
    for (let k = 0; k < perPair; k++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const cfg = defaultConfig({ chars: [a, b], palettes: [0, a === b ? 1 : 0], seed, stage: 'rooftop' });
      const s: MatchState = createMatch(cfg);
      const ctrl = [new CpuController(0, difficulty, seed ^ 0x5151), new CpuController(1, difficulty, seed ^ 0xa2a2)];
      const r: Result = { a, b, winner: -2, frames: 0, rounds: 0, kinds: [], dmg: [0, 0], maxCombo: [0, 0], supers: [0, 0], specials: [0, 0], throws: [0, 0] };
      const stuckCount = [0, 0];
      const lastState = ['', ''];
      try {
        while (s.phase !== 'matchEnd' && s.frame < MAX_FRAMES) {
          stepMatch(s, [ctrl[0].next(s, 0), ctrl[1].next(s, 1)]);
          for (let i = 0; i < 2; i++) {
            const f = s.fighters[i];
            const key = f.state + ':' + f.move;
            if (key === lastState[i] && !NEUTRAL.has(f.state) && s.freeze === 0) stuckCount[i]++;
            else stuckCount[i] = 0;
            lastState[i] = key;
            if (stuckCount[i] > STUCK_FRAMES && !r.stuck) r.stuck = `P${i + 1} ${key} at frame ${s.frame}`;
          }
        }
        if (s.phase !== 'matchEnd') r.error = 'softlock: match exceeded max frames';
      } catch (e) {
        r.error = String((e as Error).stack ?? e);
      }
      totalFrames += s.frame;
      r.winner = s.matchWinner;
      r.frames = s.frame;
      r.rounds = s.results.length;
      r.kinds = s.results.map((x) => x.kind);
      for (let i = 0; i < 2; i++) {
        const st = s.fighters[i].stats;
        r.dmg[i] = st.damage; r.maxCombo[i] = st.maxCombo; r.supers[i] = st.supers; r.specials[i] = st.specials; r.throws[i] = st.throws;
      }
      results.push(r);
    }
  }
  process.stdout.write(`${a} done (${results.length} matches)\n`);
}

const secs = (Date.now() - t0) / 1000;
// win-rate matrix (row = character, col = opponent), counting both sides
const matrix: Record<string, Record<string, { w: number; n: number }>> = {};
for (const x of ids) { matrix[x] = {}; for (const y of ids) matrix[x][y] = { w: 0, n: 0 }; }
const overall: Record<string, { w: number; n: number }> = {};
for (const x of ids) overall[x] = { w: 0, n: 0 };
let sideWins = [0, 0], draws = 0;
for (const r of results) {
  if (r.winner === -1) draws++;
  if (r.winner >= 0) sideWins[r.winner]++;
  const sides: [string, string] = [r.a, r.b];
  for (let i = 0; i < 2; i++) {
    const me = sides[i], op = sides[1 - i];
    const won = r.winner === i ? 1 : r.winner === -1 ? 0.5 : 0;
    matrix[me][op].w += won;
    matrix[me][op].n++;
    if (me !== op) { overall[me].w += won; overall[me].n++; }
  }
}
const pct = (o: { w: number; n: number }) => (o.n ? (100 * o.w) / o.n : 0);
const errors = results.filter((r) => r.error);
const stuck = results.filter((r) => r.stuck);
const avgFrames = results.reduce((a, r) => a + r.frames, 0) / results.length;
const kinds: Record<string, number> = {};
for (const r of results) for (const k of r.kinds) kinds[k] = (kinds[k] ?? 0) + 1;
const avg = (f: (r: Result) => number) => results.reduce((a, r) => a + f(r), 0) / results.length;

const report = {
  matches: results.length,
  difficulty,
  wallSeconds: secs,
  simFramesPerSecond: Math.round(totalFrames / secs),
  errors: errors.length,
  softlocks: errors.filter((e) => e.error?.startsWith('softlock')).length,
  stuckStates: stuck.length,
  averageMatchSeconds: +(avgFrames / 60).toFixed(1),
  averageRounds: +avg((r) => r.rounds).toFixed(2),
  roundOutcomes: kinds,
  sideWins: { p1: sideWins[0], p2: sideWins[1], draws },
  overallWinRate: Object.fromEntries(ids.map((x) => [x, +pct(overall[x]).toFixed(1)])),
  matrix: Object.fromEntries(ids.map((x) => [x, Object.fromEntries(ids.map((y) => [y, +pct(matrix[x][y]).toFixed(1)]))])),
  averages: {
    damagePerMatch: +avg((r) => r.dmg[0] + r.dmg[1]).toFixed(0),
    maxCombo: +avg((r) => Math.max(...r.maxCombo)).toFixed(2),
    supersPerMatch: +avg((r) => r.supers[0] + r.supers[1]).toFixed(2),
    specialsPerMatch: +avg((r) => r.specials[0] + r.specials[1]).toFixed(1),
    throwsPerMatch: +avg((r) => r.throws[0] + r.throws[1]).toFixed(2),
  },
  perCharacter: Object.fromEntries(ids.map((x) => {
    const rows: { dmg: number; thr: number; sp: number; su: number; mc: number }[] = [];
    for (const r of results) for (let i = 0; i < 2; i++) if ((i === 0 ? r.a : r.b) === x) rows.push({ dmg: r.dmg[i], thr: r.throws[i], sp: r.specials[i], su: r.supers[i], mc: r.maxCombo[i] });
    const m = (f: (o: (typeof rows)[number]) => number) => +(rows.reduce((a, o) => a + f(o), 0) / Math.max(1, rows.length)).toFixed(1);
    return [x, { damage: m((o) => o.dmg), throws: m((o) => o.thr), specials: m((o) => o.sp), supers: m((o) => o.su), maxCombo: m((o) => o.mc) }];
  })),
  firstErrors: errors.slice(0, 3).map((e) => `${e.a} vs ${e.b}: ${e.error}`),
  firstStuck: stuck.slice(0, 5).map((e) => `${e.a} vs ${e.b}: ${e.stuck}`),
};

writeFileSync('balance-report.json', JSON.stringify(report, null, 2));
const lines: string[] = [];
lines.push('# Balance report (CPU vs CPU)', '');
lines.push(`${report.matches} matches at difficulty ${difficulty}, simulated in ${secs.toFixed(1)} s (${report.simFramesPerSecond.toLocaleString()} sim frames/s).`, '');
lines.push(`Crashes: ${report.errors - report.softlocks} · Softlocks: ${report.softlocks} · Stuck states: ${report.stuckStates}`, '');
lines.push(`Average match length: ${report.averageMatchSeconds} s game time · ${report.averageRounds} rounds`, '');
lines.push(`Round outcomes: ${Object.entries(kinds).map(([k, v]) => `${k} ${v}`).join(', ')} · Side wins P1 ${sideWins[0]} / P2 ${sideWins[1]} / draws ${draws}`, '');
lines.push('## Overall win rate (excluding mirrors)', '', '| Character | Win % |', '|---|---|');
for (const x of ids) lines.push(`| ${x.toUpperCase()} | ${pct(overall[x]).toFixed(1)}% |`);
lines.push('', '## Matchup matrix (row win % vs column)', '', '| | ' + ids.map((x) => x.toUpperCase()).join(' | ') + ' |', '|---|' + ids.map(() => '---').join('|') + '|');
for (const x of ids) lines.push(`| **${x.toUpperCase()}** | ` + ids.map((y) => `${pct(matrix[x][y]).toFixed(0)}%`).join(' | ') + ' |');
lines.push('', `Average per match: ${report.averages.damagePerMatch} total damage, best combo ${report.averages.maxCombo} hits, ${report.averages.supersPerMatch} supers/ultimates, ${report.averages.specialsPerMatch} specials, ${report.averages.throwsPerMatch} throws.`);
writeFileSync('BALANCE.md', lines.join('\n') + '\n');
console.log(JSON.stringify(report, null, 2));
