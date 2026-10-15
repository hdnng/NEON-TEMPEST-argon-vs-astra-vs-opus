import {
  type Character,
  type Move,
  type FighterId,
  type Strength,
  type Button,
  type Motion,
} from "../core/types";
const base = (id: string, name: string): Move => ({
  id,
  name,
  input: "",
  description: "",
  kind: "normal",
  stance: "stand",
  button: "LP",
  motion: "NONE",
  strength: 0,
  startup: 5,
  active: 3,
  recovery: 10,
  damage: 38,
  chip: 0,
  hitstun: 16,
  blockstun: 11,
  hitstop: 7,
  meter: 12,
  attackMeter: 1,
  cost: 0,
  push: 14,
  level: "mid",
  hitboxes: [],
  hurtboxes: [],
  throwboxes: [],
  pushboxes: [],
  pushbox: { x: -23.5, y: -100, w: 47, h: 100 },
  cancel: [6, 14],
  invuln: [-1, -1],
  armor: [-1, -1],
  knockdown: false,
  launch: 0,
  juggle: 1,
  velocity: 0,
});
function boxes(m: Move, reach: number, height = -90) {
  m.hitboxes = [
    {
      from: m.startup,
      to: m.startup + m.active - 1,
      box: { x: 15, y: height, w: reach, h: m.level === "low" ? 28 : 38 },
    },
  ];
  m.hurtboxes = [
    {
      from: 0,
      to: m.startup + m.active + m.recovery,
      box: {
        x: -24,
        y: m.stance === "crouch" ? -110 : -171,
        w: 48,
        h: m.stance === "crouch" ? 110 : 171,
      },
    },
    {
      from: m.startup - 2,
      to: m.startup + m.active + 4,
      box: { x: 15, y: height, w: reach * 0.76, h: 28 },
    },
  ];
  return m;
}
const SPECS = {
  hayate: {
    name: "HAYATE",
    title: "THE STORM RUNNER",
    archetype: "BALANCED",
    tagline: "Find stillness. Become the storm.",
    bio: "A rooftop courier enters the underground circuit to win back the city’s stolen weather grid.",
    ending:
      "With the grid returned to the streets, the rain finally belongs to everyone. Hayate disappears across the rooftops before the applause begins.",
    color: "#60f4ef",
    secondary: "#e9f8ff",
    hp: 1000,
    stun: 640,
    speed: 3.65,
    jump: 12.9,
    weight: 1,
    reach: 1,
    power: 1,
    stats: [4, 4, 3, 4],
    specials: ["Pulse Current", "Skybreak Spiral", "Gale Circuit"],
  },
  magnus: {
    name: "MAGNUS",
    title: "THE IRON MONSOON",
    archetype: "GRAPPLER",
    tagline: "The city bends. I don’t.",
    bio: "A dockworker with industrial bracers fights to keep the waterfront from being erased by corporate towers.",
    ending:
      "The docks ring with celebration. Magnus spends the prize on a new flood barrier, then returns to the night shift.",
    color: "#ffb66b",
    secondary: "#ff6e57",
    hp: 1160,
    stun: 760,
    speed: 2.9,
    jump: 11.8,
    weight: 1.18,
    reach: 1.12,
    power: 1.09,
    stats: [2, 5, 5, 2],
    specials: ["Foundry Orbit", "Tectonic Clasp", "Iron Pilgrimage"],
  },
  sable: {
    name: "SABLE",
    title: "THE SIGNAL GHOST",
    archetype: "RUSHDOWN",
    tagline: "You’re already looking the wrong way.",
    bio: "An escaped hologram technician turns forbidden light-bending hardware into an unpredictable fighting style.",
    ending:
      "Sable broadcasts the tournament’s secret contracts to every billboard in Neo-Kyoto. For one night, the whole city sees the truth.",
    color: "#fc7ee7",
    secondary: "#b89aff",
    hp: 960,
    stun: 590,
    speed: 4.5,
    jump: 13.4,
    weight: 0.9,
    reach: 1,
    power: 0.96,
    stats: [5, 3, 2, 5],
    specials: ["Prism Rush", "Ghost Interval", "Violet Sever"],
  },
  warden: {
    name: "WARDEN",
    title: "THE LAST SENTINEL",
    archetype: "CHARGE / ZONER",
    tagline: "Hold your ground. Own the horizon.",
    bio: "A former transit guardian protects the forgotten platforms beneath the city with a repurposed magnetic shield.",
    ending:
      "The abandoned metro opens its gates again. Warden stands beside the first train, watching the city find its way home.",
    color: "#a7e786",
    secondary: "#61c9dc",
    hp: 1000,
    stun: 690,
    speed: 3.1,
    jump: 12.5,
    weight: 1.06,
    reach: 1.1,
    power: 0.76,
    stats: [3, 4, 4, 3],
    specials: ["Flux Disc", "Meridian Sweep", "Rail Lance"],
  },
} as const;
function create(id: FighterId): Character {
  const s = SPECS[id],
    moves: Record<string, Move> = {};
  const buttons: Button[] = ["LP", "MP", "HP", "LK", "MK", "HK"];
  for (const stance of ["stand", "crouch", "air"] as const)
    for (let b = 0; b < 6; b++) {
      const strength = (b % 3) as Strength,
        kick = b >= 3,
        key = `${stance}_${buttons[b]}`,
        m = base(
          key,
          `${stance === "stand" ? "Standing" : stance === "crouch" ? "Crouching" : "Jumping"} ${["Light", "Medium", "Heavy"][strength]} ${kick ? "Kick" : "Punch"}`,
        );
      Object.assign(m, {
        stance,
        button: buttons[b],
        strength,
        input: `${stance === "crouch" ? "↓ + " : stance === "air" ? "↗ + " : ""}${buttons[b]}`,
        description:
          strength === 0
            ? "Fast pressure starter. Chains into another light or a medium."
            : strength === 1
              ? "Reliable link and special-cancel tool."
              : "Strong spacing strike with a large commitment.",
        startup:
          [5, 8, 12][strength] +
          (id === "magnus" ? 1 : id === "sable" ? -1 : 0),
        active: [3, 4, 5][strength],
        recovery: [10, 16, 24][strength],
        damage: Math.round([34, 62, 94][strength] * s.power),
        hitstun: [18, 23, 29][strength],
        blockstun: [11, 16, 20][strength],
        hitstop: [6, 9, 12][strength],
        meter: [10, 16, 22][strength],
        push: [11, 20, 32][strength],
        level:
          stance === "air"
            ? "overhead"
            : stance === "crouch" && kick
              ? "low"
              : "mid",
        knockdown: stance === "crouch" && b === 5,
        launch: stance === "crouch" && b === 2 ? 9 : 0,
      });
      m.cancel = [m.startup, m.startup + m.active + 7];
      boxes(
        m,
        ([42, 64, 85][strength] + (kick ? 15 : 0)) * s.reach,
        stance === "crouch"
          ? kick
            ? -28
            : -85
          : stance === "air"
            ? -84
            : kick
              ? -73
              : -104,
      );
      moves[key] = m;
    }
  const command = boxes(
    Object.assign(base("command", "Overline"), {
      kind: "command",
      input: "→ + MP",
      description: "A deliberate overhead that defeats crouching guard.",
      button: "MP",
      startup: 20,
      active: 4,
      recovery: 19,
      damage: 72,
      level: "overhead",
      cancel: [20, 28],
    } as Partial<Move>),
    68,
    -108,
  );
  moves.command = command;
  const sweep = boxes(
    Object.assign(base("command2", "Anchor Strike"), {
      kind: "command",
      input: "→ + HK",
      description: "Forward-moving knockdown tool.",
      button: "HK",
      strength: 2,
      startup: 17,
      active: 5,
      recovery: 25,
      damage: 100,
      velocity: 2.3,
      knockdown: true,
      cancel: [-1, -1],
    } as Partial<Move>),
    97,
    -62,
  );
  moves.command2 = sweep;
  for (const back of [false, true]) {
    const key = back ? "backThrow" : "throw",
      m = base(key, back ? "Reverse Displacement" : "Close Displacement");
    Object.assign(m, {
      kind: "throw",
      input: `${back ? "← + " : ""}LP + LK`,
      description:
        "Unblockable at close range; the opponent can tech the opening frames.",
      button: "THROW",
      startup: 5,
      active: 2,
      recovery: 30,
      damage: id === "magnus" ? 155 : 115,
      hitstun: 32,
      hitstop: 10,
      knockdown: true,
      level: "throw",
      back,
    });
    m.throwboxes = [{ from: 5, to: 6, box: { x: 0, y: -110, w: 66, h: 110 } }];
    m.hurtboxes = [
      { from: 0, to: 37, box: { x: -24, y: -171, w: 48, h: 171 } },
    ];
    m.cancel = [-1, -1];
    moves[key] = m;
  }
  const motions: Motion[] =
    id === "hayate"
      ? ["QCF", "DP", "QCB"]
      : id === "magnus"
        ? ["360", "HCB", "HCF"]
        : id === "sable"
          ? ["QCF", "QCB", "DP"]
          : ["BF", "DU", "QCF"];
  for (let n = 0; n < 3; n++)
    for (let v = 0; v < 4; v++) {
      const key = `special${n}_${v}`,
        m = base(
          key,
          s.specials[n] + (v === 3 ? " EX" : ` ${["L", "M", "H"][v]}`),
        );
      Object.assign(m, {
        kind: "special",
        stance: "any",
        motion: motions[n],
        button: (n === 2 ? "LK" : "LP") as Button,
        strength: v as Strength,
        input: `${motionText(motions[n])} + ${n === 2 ? "K" : "P"}${v === 3 ? " + EX" : ""}`,
        description: specialDescription(id, n),
        startup: [12, 15, 18, 9][v],
        active: 5,
        recovery: [23, 26, 29, 21][v],
        damage: Math.round([75, 95, 118, 145][v] * s.power),
        chip: [7, 10, 13, 18][v],
        hitstun: 27,
        blockstun: 18,
        hitstop: 10 + v,
        meter: 22,
        cost: v === 3 ? 100 : 0,
        push: 34,
        knockdown: v > 1,
        cancel: [12, 27],
        juggle: v === 3 ? 2 : 1,
      });
      if ((id === "hayate" && n === 0) || (id === "warden" && n !== 1)) {
        m.projectile = {
          speed:
            (id === "warden" ? [4.8, 7.2, 10, 12] : [6, 8, 10, 12])[v] *
            (n === 2 ? 1.2 : 1),
          life: 160,
          size: v === 3 ? 22 : 17,
        };
        m.active = 1;
        m.recovery += 4;
      }
      if (
        (id === "hayate" && n === 1) ||
        (id === "warden" && n === 1) ||
        (id === "sable" && n === 2)
      ) {
        m.startup = 6 + v;
        m.active = 12;
        m.recovery = 29;
        m.launch = 13;
        m.velocity = 1.8;
        m.invuln = [0, v === 3 ? 15 : 8];
        m.knockdown = true;
        m.hitstun = 33;
      }
      if ((id === "hayate" && n === 2) || (id === "sable" && n === 0)) {
        m.velocity = [4, 5, 6, 7][v];
        m.active = 12 + v * 2;
        m.startup = 9;
        m.damage += id === "sable" ? 15 : 0;
        m.multi = v === 3 ? 2 : 1;
      }
      if (id === "sable" && n === 1) {
        m.teleport = true;
        m.startup = 14;
        m.active = 4;
        m.recovery = 16;
        m.invuln = [3, 15];
        m.velocity = 0;
        m.damage = 60 + v * 15;
      }
      if (id === "magnus" && n < 2) {
        m.level = "throw";
        m.startup = n === 0 ? 5 : 10;
        m.active = 3;
        m.damage = [175, 195, 215, 250][v];
        m.recovery = 38;
        m.knockdown = true;
        m.chip = 0;
        m.throwboxes = [
          {
            from: m.startup,
            to: m.startup + 2,
            box: { x: 0, y: -120, w: n === 0 ? 80 : 95, h: 120 },
          },
        ];
        m.invuln = v === 3 ? [0, 5] : [-1, -1];
      }
      if (id === "magnus" && n === 2) {
        m.velocity = 6;
        m.active = 20;
        m.armor = [3, v === 3 ? 35 : 25];
        m.knockdown = true;
        m.damage += 20;
      }
      if (id === "warden" && n === 2) {
        m.damage = Math.round(m.damage * 0.8);
        m.recovery += 6;
      }
      boxes(m, id === "magnus" ? 87 : 78, m.launch ? -136 : -95);
      if (m.level === "throw") m.hitboxes = [];
      if (m.projectile) m.hitboxes = [];
      m.cancel = [m.startup, m.startup + m.active + 10];
      moves[key] = m;
    }
  for (const ult of [false, true]) {
    const key = ult ? "ultimate" : "super",
      names = {
        hayate: ["Stormline Resonance", "Eye of the Tempest"],
        magnus: ["Seismic Oath", "Worldbreaker Protocol"],
        sable: ["Afterimage Chorus", "Zero Signal Requiem"],
        warden: ["Citadel Array", "Last Horizon"],
      };
    const m = base(key, names[id][ult ? 1 : 0]);
    Object.assign(m, {
      kind: ult ? "ultimate" : "super",
      stance: "any",
      button: ult ? "ULT" : "SUPER",
      motion: "2QCF",
      input: ult ? "Life ≤ 30% · ↓↘→ ↓↘→ + K / [" : "↓↘→ ↓↘→ + P / P",
      description: ult
        ? "Once per round at low life. A cinematic final stand."
        : "One-stock invincible super; cancel a confirmed special into it.",
      strength: 3,
      startup: 8,
      active: 24,
      recovery: 35,
      damage: ult ? 350 : 240,
      chip: ult ? 28 : 22,
      hitstun: 45,
      blockstun: 30,
      hitstop: 18,
      meter: 0,
      cost: ult ? 0 : 100,
      push: 60,
      knockdown: true,
      launch: 9,
      velocity: id === "warden" ? 1 : 6,
      invuln: [0, 18],
      cancel: [-1, -1],
      juggle: 3,
    });
    if (id === "warden") {
      m.damage = Math.round(m.damage * 0.72);
      m.recovery += 8;
    }
    boxes(m, id === "warden" ? 320 : 140, -126);
    moves[key] = m;
  }
  for (const m of Object.values(moves)) {
    m.attackMeter =
      m.cost > 0 || m.kind === "super" || m.kind === "ultimate" ? 0 : 1;
    m.pushboxes = [
      { from: 0, to: m.startup + m.active + m.recovery, box: { ...m.pushbox } },
    ];
    if (m.stance === "stand" && m.kind === "normal" && m.button.endsWith("P"))
      m.level = "high";
  }
  return {
    id,
    ...s,
    maxJumps: id === "sable" ? 2 : 1,
    canAirDash: id === "sable",
    motionPriority: id === "magnus" ? [0, 1, 2] : [1, 0, 2],
    specials: [...s.specials],
    stats: [...s.stats],
    moves,
  };
}
function specialDescription(id: FighterId, n: number) {
  const d = {
    hayate: [
      "A travelling plasma wave. Heavy travels faster; EX is larger.",
      "An invincible rising anti-air. Punishable if blocked.",
      "A spinning advancing kick that carries pressure forward.",
    ],
    magnus: [
      "A devastating full-circle command throw.",
      "A longer-reaching half-circle command grab.",
      "An armored shoulder charge that absorbs one strike.",
    ],
    sable: [
      "A rapid advancing pressure string. EX strikes twice.",
      "Phase through an opponent and strike from the other side.",
      "A rising blade of light with anti-air invincibility.",
    ],
    warden: [
      "Charge back for 40 frames; release a disc at three speeds.",
      "Charge down for 40 frames; launch a sweeping anti-air.",
      "A fast horizontal rail projectile for controlling space.",
    ],
  };
  return d[id][n];
}
export function motionText(m: Motion) {
  return {
    QCF: "↓↘→",
    QCB: "↓↙←",
    DP: "→↓↘",
    HCF: "←↙↓↘→",
    HCB: "→↘↓↙←",
    "360": "→↓←↑↻",
    BF: "[←] →",
    DU: "[↓] ↑",
    "2QCF": "↓↘→ ↓↘→",
    NONE: "",
  }[m];
}
export const CHARACTERS: Record<FighterId, Character> = {
  hayate: create("hayate"),
  magnus: create("magnus"),
  sable: create("sable"),
  warden: create("warden"),
};
