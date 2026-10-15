import { type RawInput, BUTTONS, bit, type Button } from "../core/types";
export type Bindings = Record<string, string>;
export const DEFAULT_KEYS: Bindings = {
  p1_left: "KeyA",
  p1_right: "KeyD",
  p1_up: "KeyW",
  p1_down: "KeyS",
  p1_LP: "KeyJ",
  p1_MP: "KeyK",
  p1_HP: "KeyL",
  p1_LK: "KeyU",
  p1_MK: "KeyI",
  p1_HK: "KeyO",
  p1_THROW: "KeyH",
  p1_EX: "ShiftLeft",
  p1_SUPER: "KeyP",
  p1_ULT: "BracketLeft",
  p1_PARRY: "Space",
  p1_DRIVE: "KeyN",
  p2_left: "ArrowLeft",
  p2_right: "ArrowRight",
  p2_up: "ArrowUp",
  p2_down: "ArrowDown",
  p2_LP: "Numpad1",
  p2_MP: "Numpad2",
  p2_HP: "Numpad3",
  p2_LK: "Numpad4",
  p2_MK: "Numpad5",
  p2_HK: "Numpad6",
  p2_THROW: "Numpad0",
  p2_EX: "NumpadAdd",
  p2_SUPER: "Numpad7",
  p2_ULT: "Numpad9",
  p2_PARRY: "NumpadDecimal",
  p2_DRIVE: "Numpad8",
};
export const DEFAULT_PAD: Record<string, number> = {
  LP: 0,
  MP: 2,
  HP: 5,
  LK: 1,
  MK: 3,
  HK: 7,
  THROW: 4,
  EX: 6,
  SUPER: 10,
  ULT: 11,
  PARRY: 8,
  DRIVE: 9,
};
export class Devices {
  keys = new Set<string>();
  virtual: RawInput = { x: 0, y: 0, buttons: 0 };
  bindings: Bindings = { ...DEFAULT_KEYS };
  padBindings = { ...DEFAULT_PAD };
  capture: ((code: string) => void) | null = null;
  constructor() {
    window.addEventListener(
      "keydown",
      (e) => {
        if (this.capture) {
          e.preventDefault();
          e.stopImmediatePropagation();
          const capture = this.capture;
          this.capture = null;
          capture(e.code);
          return;
        }
        if (
          [
            "Space",
            "ArrowUp",
            "ArrowDown",
            "ArrowLeft",
            "ArrowRight",
            "Tab",
          ].includes(e.code)
        )
          e.preventDefault();
        this.keys.add(e.code);
      },
      true,
    );
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => this.keys.clear());
  }
  read(player: number): RawInput {
    const p = `p${player + 1}_`,
      has = (s: string) => this.keys.has(this.bindings[p + s]);
    let x = Number(has("right")) - Number(has("left")),
      y = Number(has("down")) - Number(has("up")),
      buttons = 0;
    for (const b of BUTTONS) if (has(b)) buttons |= bit(b);
    const pad = navigator.getGamepads?.()[player];
    if (pad) {
      x +=
        Number(pad.buttons[15]?.pressed || pad.axes[0] > 0.35) -
        Number(pad.buttons[14]?.pressed || pad.axes[0] < -0.35);
      y +=
        Number(pad.buttons[13]?.pressed || pad.axes[1] > 0.35) -
        Number(pad.buttons[12]?.pressed || pad.axes[1] < -0.35);
      for (const b of BUTTONS)
        if (
          pad.buttons[this.padBindings[b]]?.pressed &&
          (b !== "DRIVE" ||
            this.padBindings[b] !== 9 ||
            pad.buttons[8]?.pressed)
        )
          buttons |= bit(b);
    }
    if (player === 0) {
      x += this.virtual.x;
      y += this.virtual.y;
      buttons |= this.virtual.buttons;
    }
    return { x: Math.sign(x), y: Math.sign(y), buttons };
  }
}
