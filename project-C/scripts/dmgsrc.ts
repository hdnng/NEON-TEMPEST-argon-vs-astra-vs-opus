// Dev diagnostic: damage dealt per move id for a matchup. tsx scripts/dmgsrc.ts magnus sable 10
import { CpuController } from '../src/ai/cpu';
import { createMatch, defaultConfig, stepMatch } from '../src/sim/match';
const [a, b, nStr] = process.argv.slice(2);
const n = Number(nStr ?? 10);
const tally: Record<string, Record<string, { hits: number; dmg: number }>> = { [a]: {}, [b]: {} };
const used: Record<string, Record<string, number>> = { [a]: {}, [b]: {} };
let wins = [0, 0];
for (let k = 0; k < n; k++) {
  const s = createMatch(defaultConfig({ chars: [a, b], palettes: [0, 1], seed: 77 + k * 31 }));
  const c = [new CpuController(0, 2, k * 3 + 1), new CpuController(1, 2, k * 7 + 2)];
  let lastDmg = [0, 0];
  while (s.phase !== 'matchEnd' && s.frame < 40000) {
    stepMatch(s, [c[0].next(s, 0), c[1].next(s, 1)]);
    for (const e of s.events) {
      const ch = s.fighters[e.p]?.char;
      if (e.t === 'hit') lastDmg[e.p] = e.v;
      if (e.t === 'hitMove') {
        const t = (tally[ch][e.k] ??= { hits: 0, dmg: 0 });
        t.hits++; t.dmg += lastDmg[e.p];
      }
      if (['attack', 'special', 'super', 'ult', 'throwStart', 'drive'].includes(e.t)) used[ch][e.k] = (used[ch][e.k] ?? 0) + 1;
    }
  }
  if (s.matchWinner >= 0) wins[s.matchWinner]++;
}
console.log('wins', wins);
for (const ch of [a, b]) {
  const rows = Object.entries(tally[ch]).sort((x, y) => y[1].dmg - x[1].dmg).slice(0, 12);
  console.log(`== ${ch} damage by move (per match)`);
  for (const [id, t] of rows) console.log(`  ${id.padEnd(12)} hits ${(t.hits / n).toFixed(1).padStart(5)}  dmg ${(t.dmg / n).toFixed(0).padStart(5)}`);
  const u = Object.entries(used[ch]).sort((x, y) => y[1] - x[1]).slice(0, 14).map(([id, v]) => `${id}:${(v / n).toFixed(1)}`).join(' ');
  console.log(`  used/match: ${u}`);
}
