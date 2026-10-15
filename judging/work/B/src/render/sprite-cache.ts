import { drawFighter as drawVector } from "./fighter";
import { CHARACTERS } from "../characters/data";
import type { Fighter, FighterId } from "../core/types";

// Every sprite is painted locally from the articulated vector model. A bounded
// frame cache turns hundreds of path submissions per fighter into one image blit.
const W = 336,
  H = 256,
  OX = 192,
  OY = 238,
  SLOTS = 256;
const surfaces: Array<HTMLCanvasElement | undefined> = Array(SLOTS);
const bitmaps: Array<ImageBitmap | undefined> = Array(SLOTS);
const versions = Array<number>(SLOTS).fill(0);
let cursor = 0;
const entries = new Map<string, number>(),
  keys = Array<string>(SLOTS).fill("");
const portraits = new Map<string, HTMLCanvasElement>();
const portraitBitmaps = new Map<string, ImageBitmap>();
function frame(p: Fighter | undefined, time: number) {
  const moving = p?.pose === "walk" || p?.pose === "dash";
  const cycle = moving ? 13 : 2.5,
    phases = moving ? 8 : 12;
  return {
    phase: Math.floor(((time * cycle) / (Math.PI * 2)) * phases) % phases,
    time:
      ((Math.floor(((time * cycle) / (Math.PI * 2)) * phases) % phases) /
        phases) *
      ((Math.PI * 2) / cycle),
  };
}
export function drawFighter(
  c: CanvasRenderingContext2D,
  id: FighterId,
  x: number,
  y: number,
  scale: number,
  facing: number,
  time: number,
  p?: Fighter,
) {
  const f = frame(p, time);
  if (!p) {
    const key = id + ":" + f.phase;
    let source = portraits.get(key);
    if (!source) {
      source = document.createElement("canvas");
      source.width = W * 2;
      source.height = H * 2;
      const pc = source.getContext("2d")!;
      pc.scale(2, 2);
      drawVector(pc, id, OX, OY, 1, 1, f.time);
      portraits.set(key, source);
      void createImageBitmap(source).then((bitmap) =>
        portraitBitmaps.set(key, bitmap),
      );
    }
    c.save();
    c.translate(x, y);
    c.scale(scale * facing, scale);
    c.drawImage(portraitBitmaps.get(key) ?? source, -OX, -OY, W, H);
    c.restore();
    return;
  }
  const m = p.move ? CHARACTERS[id].moves[p.move] : null;
  const attack = m
    ? p.moveFrame < m.startup
      ? (p.moveFrame / m.startup) * 0.25
      : p.moveFrame < m.startup + m.active
        ? 1
        : Math.max(
            0,
            1 - (p.moveFrame - m.startup - m.active) / Math.min(12, m.recovery),
          )
    : 0;
  const bucket = Math.round(attack * 4),
    phase = m ? 0 : f.phase;
  const key = `${id}:${p.pose}:${p.move ?? ""}:${bucket}:${phase}:${p.grounded ? 1 : 0}:${p.drive > 0 ? 1 : 0}`;
  let slot = entries.get(key);
  if (slot === undefined) {
    slot = cursor++ % SLOTS;
    if (keys[slot]) entries.delete(keys[slot]);
    keys[slot] = key;
    entries.set(key, slot);
    let source = surfaces[slot];
    if (!source) {
      source = document.createElement("canvas");
      source.width = W;
      source.height = H;
      surfaces[slot] = source;
    }
    const ctx = source.getContext("2d")!;
    ctx.clearRect(0, 0, W, H);
    const pose = { ...p };
    if (m)
      pose.moveFrame =
        bucket === 4
          ? m.startup
          : m.startup + m.active + (1 - bucket / 4) * Math.min(12, m.recovery);
    drawVector(ctx, id, OX, OY, 1, 1, m ? 0 : f.time, pose);
    bitmaps[slot]?.close();
    bitmaps[slot] = undefined;
    const index = slot,
      version = ++versions[index];
    void createImageBitmap(source).then((bitmap) => {
      if (versions[index] === version) bitmaps[index] = bitmap;
      else bitmap.close();
    });
  }
  c.save();
  c.translate(x, y);
  c.scale(scale * facing, scale);
  c.drawImage(bitmaps[slot] ?? surfaces[slot]!, -OX, -OY, W, H);
  c.restore();
}
