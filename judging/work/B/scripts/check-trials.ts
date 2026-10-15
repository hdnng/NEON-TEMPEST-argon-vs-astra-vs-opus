import { createMatch, step } from "../src/core/sim";
import { IDS, NEUTRAL, bit, type RawInput } from "../src/core/types";
import { CHARACTERS } from "../src/characters/data";
import { createBrain, queueMotion } from "../src/ai/cpu";
import { trialsFor } from "../src/scenes/trials";
for (const id of IDS)
  for (const [index, trial] of trialsFor(id).entries()) {
    const s = createMatch(id, "hayate", 1, {
        mode: "trials",
        infiniteMeter: true,
      }),
      p = s.fighters[0],
      d = s.fighters[1];
    s.phase = "fight";
    p.x = 600;
    d.x = 663;
    p.meter = 300;
    let idx = 0,
      queue: RawInput[] = [],
      waiting = false;
    const events: string[] = [];
    for (let frame = 0; frame < 500 && idx < trial.steps.length; frame++) {
      if (!waiting && !queue.length) {
        const m = CHARACTERS[id].moves[trial.steps[idx]];
        if (m.kind === "special") {
          const brain = createBrain();
          queueMotion(
            brain,
            id,
            Number(m.id[7]),
            1,
            m.strength === 3 ? 0 : m.strength,
            m.strength === 3,
          );
          queue = brain.queue;
        } else
          queue = [
            { x: 0, y: m.stance === "crouch" ? 1 : 0, buttons: bit(m.button) },
            NEUTRAL,
          ];
        waiting = true;
      }
      step(s, [queue.shift() ?? NEUTRAL, NEUTRAL]);
      for (const e of s.events) {
        if (e.type === "hit" && e.player === 1) {
          events.push(`${p.lastMove}: combo ${p.combo}`);
          if (p.lastMove === trial.steps[idx]) {
            idx++;
            waiting = false;
            queue = [];
          }
        }
      }
    }
    console.log(
      `${id} trial ${index + 1}: ${idx === trial.steps.length ? "PASS" : "FAIL"} (${idx}/${trial.steps.length}) ${events.join(", ")}`,
    );
    if (idx !== trial.steps.length) process.exitCode = 1;
  }
