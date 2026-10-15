import {
  type InputState,
  type RawInput,
  bit,
  type Button,
} from "../core/types";
const ROTATIONS = [6, 2, 4, 8]
  .map((_, i) => [6, 2, 4, 8].slice(i).concat([6, 2, 4, 8].slice(0, i)))
  .concat(
    [6, 8, 4, 2].map((_, i) =>
      [6, 8, 4, 2].slice(i).concat([6, 8, 4, 2].slice(0, i)),
    ),
  );
export function createInput(): InputState {
  return {
    history: [],
    previous: 0,
    used: -99,
    chargeBack: 0,
    chargeDown: 0,
    backReleased: -99,
    downReleased: -99,
    lastDash: -99,
  };
}
export function direction(x: number, y: number, facing: number) {
  return y < 0
    ? x * facing < 0
      ? 7
      : x * facing > 0
        ? 9
        : 8
    : y > 0
      ? x * facing < 0
        ? 1
        : x * facing > 0
          ? 3
          : 2
      : x * facing < 0
        ? 4
        : x * facing > 0
          ? 6
          : 5;
}
export function poll(
  state: InputState,
  raw: RawInput,
  facing: number,
  frame: number,
) {
  const dir = direction(Math.sign(raw.x), Math.sign(raw.y), facing),
    back = [1, 4, 7].includes(dir),
    down = [1, 2, 3].includes(dir);
  if (back) state.chargeBack++;
  else {
    if (state.chargeBack >= 40) state.backReleased = frame;
    state.chargeBack = 0;
  }
  if (down) state.chargeDown++;
  else {
    if (state.chargeDown >= 40) state.downReleased = frame;
    state.chargeDown = 0;
  }
  state.history.push({
    dir,
    worldX: Math.sign(raw.x),
    held: raw.buttons,
    context: raw.buttons | state.previous,
    pressed: raw.buttons & ~state.previous,
    released: state.previous & ~raw.buttons,
    frame,
  });
  if (state.history.length > 100) state.history.shift();
  state.previous = raw.buttons;
}
export function sequence(s: InputState, steps: number[], window = 24): boolean {
  const h = s.history;
  if (!h.length) return false;
  const now = h[h.length - 1].frame;
  let n = steps.length - 1,
    last = now;
  for (let i = h.length - 1; i >= 0; i--) {
    const f = h[i];
    if (now - f.frame > window || last - f.frame > 12) return false;
    if (f.dir === steps[n]) {
      last = f.frame;
      n--;
      if (n < 0) return true;
      while (i > 0 && h[i - 1].dir === f.dir) i--;
    }
  }
  return false;
}
export function motion(s: InputState, name: string): boolean {
  const f = s.history.at(-1);
  if (!f) return false;
  switch (name) {
    case "NONE":
      return true;
    case "QCF":
      return sequence(s, [2, 3, 6]);
    case "QCB":
      return sequence(s, [2, 1, 4]);
    case "DP":
      return sequence(s, [6, 2, 3], 22) || sequence(s, [6, 2, 6], 20);
    case "HCF":
      return sequence(s, [4, 1, 2, 3, 6], 32);
    case "HCB":
      return sequence(s, [6, 3, 2, 1, 4], 32);
    case "2QCF":
      return sequence(s, [2, 3, 6, 2, 3, 6], 44);
    case "BF":
      return f.frame - s.backReleased <= 8 && [3, 6, 9].includes(f.dir);
    case "DU":
      return f.frame - s.downReleased <= 8 && [7, 8, 9].includes(f.dir);
    case "360": {
      return ROTATIONS.some((dirs) => sequence(s, dirs, 32));
    }
    default:
      return false;
  }
}
export function trigger(s: InputState, b: Button, negative = false): boolean {
  const now = s.history.at(-1)?.frame ?? 0;
  return s.history.some(
    (f) =>
      now - f.frame <= 5 &&
      f.frame > s.used &&
      !!((f.pressed | (negative ? f.released : 0)) & bit(b)),
  );
}
export function simultaneous(s: InputState, a: Button, b: Button) {
  const now = s.history.at(-1);
  if (!now) return false;
  return (
    !!(now.held & bit(a)) &&
    !!(now.held & bit(b)) &&
    (trigger(s, a) || trigger(s, b))
  );
}
export function dash(s: InputState, dir: number) {
  const f = s.history.at(-1);
  if (!f || f.frame - s.lastDash < 22 || f.dir !== dir) return false;
  return sequence(s, [dir, 5, dir], 16);
}
