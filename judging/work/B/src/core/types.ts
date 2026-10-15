export type FighterId = "hayate" | "magnus" | "sable" | "warden";
export const IDS: FighterId[] = ["hayate", "magnus", "sable", "warden"];
export const BUTTONS = [
  "LP",
  "MP",
  "HP",
  "LK",
  "MK",
  "HK",
  "THROW",
  "EX",
  "SUPER",
  "ULT",
  "PARRY",
  "DRIVE",
] as const;
export type Button = (typeof BUTTONS)[number];
export type Strength = 0 | 1 | 2 | 3;
export type Motion =
  "QCF" | "QCB" | "DP" | "HCF" | "HCB" | "360" | "BF" | "DU" | "2QCF" | "NONE";
export type Box = { x: number; y: number; w: number; h: number };
export interface FrameBox {
  from: number;
  to: number;
  box: Box;
}
export interface Move {
  id: string;
  name: string;
  input: string;
  description: string;
  kind: "normal" | "command" | "special" | "throw" | "super" | "ultimate";
  stance: "stand" | "crouch" | "air" | "any";
  button: Button;
  motion: Motion;
  strength: Strength;
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  chip: number;
  hitstun: number;
  blockstun: number;
  hitstop: number;
  meter: number;
  attackMeter: number;
  cost: number;
  push: number;
  level: "high" | "mid" | "low" | "overhead" | "throw";
  hitboxes: FrameBox[];
  hurtboxes: FrameBox[];
  throwboxes: FrameBox[];
  pushboxes: FrameBox[];
  pushbox: Box;
  cancel: [number, number];
  invuln: [number, number];
  armor: [number, number];
  knockdown: boolean;
  launch: number;
  juggle: number;
  velocity: number;
  projectile?: { speed: number; life: number; size: number };
  teleport?: boolean;
  multi?: number;
  back?: boolean;
}
export interface Character {
  id: FighterId;
  name: string;
  title: string;
  archetype: string;
  tagline: string;
  bio: string;
  ending: string;
  color: string;
  secondary: string;
  hp: number;
  stun: number;
  speed: number;
  jump: number;
  weight: number;
  reach: number;
  power: number;
  maxJumps: number;
  canAirDash: boolean;
  motionPriority: number[];
  stats: number[];
  moves: Record<string, Move>;
  specials: string[];
}
export interface RawInput {
  x: number;
  y: number;
  buttons: number;
}
export const NEUTRAL: RawInput = { x: 0, y: 0, buttons: 0 };
export const bit = (b: Button) => 1 << BUTTONS.indexOf(b);
export interface InputFrame {
  dir: number;
  worldX: number;
  held: number;
  context: number;
  pressed: number;
  released: number;
  frame: number;
}
export interface InputState {
  history: InputFrame[];
  previous: number;
  used: number;
  chargeBack: number;
  chargeDown: number;
  backReleased: number;
  downReleased: number;
  lastDash: number;
}
export type Pose =
  | "idle"
  | "walk"
  | "crouch"
  | "air"
  | "move"
  | "hit"
  | "block"
  | "down"
  | "dizzy"
  | "dash"
  | "parry"
  | "win";
export interface Fighter {
  id: FighterId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  hp: number;
  white: number;
  meter: number;
  stun: number;
  pose: Pose;
  move: string | null;
  moveFrame: number;
  moveSerial: number;
  hitTargets: number;
  projectileSpawned: boolean;
  stunFrames: number;
  downFrames: number;
  invincible: number;
  armorHits: number;
  jumps: number;
  jumpSquat: number;
  airDash: boolean;
  grounded: boolean;
  combo: number;
  comboDamage: number;
  comboTimer: number;
  comboScale: number;
  juggle: number;
  lastHitBy: number;
  drive: number;
  driveCooldown: number;
  parry: number;
  parryCooldown: number;
  throwTech: number;
  dashFrames: number;
  input: InputState;
  wins: number;
  damageDealt: number;
  lastMove: string;
  confirm: number;
  ultimateUsed: boolean;
}
export interface Projectile {
  active: boolean;
  owner: number;
  x: number;
  y: number;
  vx: number;
  life: number;
  size: number;
  move: string;
  serial: number;
}
export interface SimEvent {
  type:
    | "hit"
    | "block"
    | "throw"
    | "projectile"
    | "move"
    | "jump"
    | "dash"
    | "parry"
    | "super"
    | "ko"
    | "round"
    | "fight"
    | "tech"
    | "dizzy"
    | "drive"
    | "win";
  x: number;
  y: number;
  player: number;
  strength: number;
  text?: string;
}
export interface Rules {
  mode: "arcade" | "versus" | "training" | "trials" | "replay";
  infiniteHealth: boolean;
  infiniteMeter: boolean;
  dummy: "stand" | "crouch" | "block" | "jump" | "cpu" | "record" | "playback";
  timer: number;
}
export interface SimState {
  version: 1;
  seed: number;
  frame: number;
  round: number;
  timer: number;
  phase: "intro" | "fight" | "ko" | "outro" | "complete";
  phaseFrames: number;
  hitstop: number;
  winner: number;
  roundWinner: number;
  fighters: [Fighter, Fighter];
  projectiles: Projectile[];
  events: SimEvent[];
  rules: Rules;
  rounds: number;
  slow: number;
}
