import { writeFileSync } from "node:fs";
import { createMatch, step } from "../src/core/sim";
import { IDS, type FighterId } from "../src/core/types";
import { createBrain, cpu } from "../src/ai/cpu";
const perPair = Number(process.env.MATCHES_PER_PAIR ?? 32),
  start = performance.now();
const matrix = IDS.map(() =>
  IDS.map(() => ({ wins: 0, losses: 0, draws: 0, frames: 0, matches: 0 })),
);
let crashes = 0,
  softlocks = 0,
  frames = 0,
  matches = 0,
  maxFrames = 0;
for (let a = 0; a < 4; a++)
  for (let b = 0; b < 4; b++) {
    for (let m = 0; m < perPair; m++) {
      const seed = 19831 + m * 317 + a * 7919 + b * 1301,
        s = createMatch(IDS[a], IDS[b], seed),
        brains = [createBrain(seed + 51, 2), createBrain(seed + 131, 2)];
      try {
        while (s.phase !== "complete" && s.frame < 60000) {
          step(s, [cpu(s, 0, brains[0]), cpu(s, 1, brains[1])]);
          if (
            s.frame % 600 === 0 &&
            s.fighters.some(
              (p) =>
                !Number.isFinite(p.x) ||
                !Number.isFinite(p.hp) ||
                p.x < 0 ||
                p.x > 1480 ||
                p.meter < 0 ||
                p.meter > 300,
            )
          )
            throw new Error("State invariant failed");
        }
        if (s.phase !== "complete") softlocks++;
        const cell = matrix[a][b];
        cell.matches++;
        cell.frames += s.frame;
        if (s.winner === 0) cell.wins++;
        else if (s.winner === 1) cell.losses++;
        else cell.draws++;
        frames += s.frame;
        maxFrames = Math.max(maxFrames, s.frame);
        matches++;
      } catch (e) {
        crashes++;
        console.error(IDS[a], IDS[b], seed, e);
      }
    }
    console.log(
      `${IDS[a]} vs ${IDS[b]}: ${matrix[a][b].wins}/${matrix[a][b].matches} P1 wins`,
    );
  }
const winRates = IDS.map((id, a) => {
  let wins = 0,
    games = 0,
    draws = 0;
  for (let b = 0; b < 4; b++) {
    if (a === b) continue;
    wins += matrix[a][b].wins + matrix[b][a].losses;
    games += matrix[a][b].matches + matrix[b][a].matches;
    draws += matrix[a][b].draws + matrix[b][a].draws;
  }
  return { id, winRate: (wins + draws * 0.5) / games, games };
});
const report = {
  date: new Date().toISOString(),
  matches,
  crashes,
  softlocks,
  averageMatchSeconds: frames / matches / 60,
  longestMatchSeconds: maxFrames / 60,
  totalFrames: frames,
  elapsedSeconds: (performance.now() - start) / 1000,
  winRates,
  matrix,
  seedFormula: "19831 + match*317 + p1*7919 + p2*1301",
  difficulty: "Hard",
  interpretation:
    "Row win rates use row fighter as Player 1. Aggregate rates include both sides and exclude mirror matches; draws count as half a win.",
};
writeFileSync("balance-results.json", JSON.stringify(report, null, 2));
let md =
  "# NEON TEMPEST balance report\n\n" +
  `${matches} full best-of-three matches; ${crashes} crashes; ${softlocks} softlocks. Average match: ${report.averageMatchSeconds.toFixed(1)} simulated seconds. ${frames.toLocaleString()} frames verified.\n\n| P1 / P2 | HAYATE | MAGNUS | SABLE | WARDEN |\n|---|---:|---:|---:|---:|\n`;
matrix.forEach(
  (row, i) =>
    (md += `| ${IDS[i].toUpperCase()} | ${row.map((c) => ((100 * (c.wins + 0.5 * c.draws)) / c.matches).toFixed(1) + "%").join(" | ")} |\n`),
);
md +=
  "\nAggregate across both sides, excluding mirrors:\n\n" +
  winRates
    .map(
      (r) =>
        `- ${r.id.toUpperCase()}: ${(r.winRate * 100).toFixed(1)}% (${r.games} matches)`,
    )
    .join("\n") +
  "\n\nThis measures this specific reaction-delayed CPU policy, not competitive human balance. Each bot submits ordinary buffered inputs and motions. Seeds and detailed counts are in balance-results.json.\n";
writeFileSync("BALANCE.md", md);
console.log(JSON.stringify(report, null, 2));
if (crashes || softlocks) process.exitCode = 1;
