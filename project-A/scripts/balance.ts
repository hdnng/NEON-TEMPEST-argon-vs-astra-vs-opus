import * as fs from 'node:fs';
import * as path from 'node:path';
import { CpuController } from '../src/ai/cpuController';
import { createMatchState, stepMatch } from '../src/core/simulation';
import { CharacterId } from '../src/core/types';
import { CHARACTER_LIST } from '../src/data/characters';

const CHAR_IDS: CharacterId[] = CHARACTER_LIST.map((c) => c.id);
const MATCHES_PER_ORDERED_PAIR = 35; // 16 ordered pairs * 35 = 560 matches total!
const MAX_FRAMES_PER_MATCH = 60 * 240; // Safety cap to detect softlocks

interface PairStats {
  matches: number;
  p1Wins: number;
  p2Wins: number;
  draws: number;
}

function runBalanceSimulation(): void {
  console.log('=== NEON TEMPEST // HEADLESS BOT-VS-BOT BALANCE SIMULATION ===');
  const startTime = performance.now();

  const pairMatrix: Record<string, PairStats> = {};
  const charTotals: Record<
    CharacterId,
    { played: number; wins: number; losses: number; draws: number }
  > = {
    hayate: { played: 0, wins: 0, losses: 0, draws: 0 },
    magnus: { played: 0, wins: 0, losses: 0, draws: 0 },
    sable: { played: 0, wins: 0, losses: 0, draws: 0 },
    warden: { played: 0, wins: 0, losses: 0, draws: 0 }
  };

  let totalMatches = 0;
  let totalSimFrames = 0;
  let softlocks = 0;
  let crashes = 0;

  for (const c1 of CHAR_IDS) {
    for (const c2 of CHAR_IDS) {
      const key = `${c1}_vs_${c2}`;
      pairMatrix[key] = { matches: 0, p1Wins: 0, p2Wins: 0, draws: 0 };

      for (let m = 0; m < MATCHES_PER_ORDERED_PAIR; m++) {
        totalMatches++;
        const seed = (0x13370000 + totalMatches * 9973) | 0;
        const state = createMatchState({
          p1Char: c1,
          p2Char: c2,
          stageId: 'rooftop',
          seed,
          roundsToWin: 2,
          skipIntro: true
        });

        const cpu1 = new CpuController('hard');
        const cpu2 = new CpuController('hard');

        let frames = 0;
        try {
          while (state.phase !== 'match_over' && frames < MAX_FRAMES_PER_MATCH) {
            const in1 = cpu1.getInput(state, 0);
            const in2 = cpu2.getInput(state, 1);
            stepMatch(state, in1, in2);
            frames++;
          }
        } catch (err) {
          crashes++;
          console.error(`Crash in ${key} match #${m}:`, err);
          continue;
        }

        if (state.phase !== 'match_over') {
          softlocks++;
          console.error(`Softlock detected in ${key} match #${m} at frame ${frames}`);
          continue;
        }

        totalSimFrames += frames;
        pairMatrix[key].matches++;

        if (state.p1RoundsWon > state.p2RoundsWon) {
          pairMatrix[key].p1Wins++;
          if (c1 !== c2) {
            charTotals[c1].played++;
            charTotals[c1].wins++;
            charTotals[c2].played++;
            charTotals[c2].losses++;
          }
        } else if (state.p2RoundsWon > state.p1RoundsWon) {
          pairMatrix[key].p2Wins++;
          if (c1 !== c2) {
            charTotals[c2].played++;
            charTotals[c2].wins++;
            charTotals[c1].played++;
            charTotals[c1].losses++;
          }
        } else {
          pairMatrix[key].draws++;
          if (c1 !== c2) {
            charTotals[c1].played++;
            charTotals[c1].draws++;
            charTotals[c2].played++;
            charTotals[c2].draws++;
          }
        }
      }
    }
  }

  const elapsedSec = ((performance.now() - startTime) / 1000).toFixed(2);
  const avgMatchFrames = Math.round(totalSimFrames / totalMatches);
  const avgMatchSeconds = Number((avgMatchFrames / 60).toFixed(2));

  const winRates: Record<string, number> = {};
  for (const id of CHAR_IDS) {
    const t = charTotals[id];
    winRates[id] = Number(((t.wins / Math.max(1, t.played)) * 100).toFixed(1));
  }

  const report = {
    totalMatches,
    totalSimFrames,
    elapsedWallSeconds: Number(elapsedSec),
    simFramesPerSecond: Math.round(totalSimFrames / Math.max(0.01, Number(elapsedSec))),
    crashes,
    softlocks,
    averageMatchFrames: avgMatchFrames,
    averageMatchSeconds: avgMatchSeconds,
    characterWinRatesPercent: winRates,
    characterTotalsNonMirror: charTotals,
    pairwiseMatrix: pairMatrix
  };

  fs.writeFileSync(
    path.resolve(process.cwd(), 'balance-report.json'),
    JSON.stringify(report, null, 2),
    'utf-8'
  );

  console.log(`Completed ${totalMatches} matches (${totalSimFrames} frames) in ${elapsedSec}s`);
  console.log(`Crashes: ${crashes} | Softlocks: ${softlocks}`);
  console.log(`Average Match Length: ${avgMatchSeconds}s (${avgMatchFrames} frames)`);
  console.log('Non-Mirror Win Rates (%):', winRates);
}

runBalanceSimulation();
