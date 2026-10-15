/**
 * Data schema for fighters, moves, hits, projectiles and render bodies.
 *
 * Conventions (documented in README "Frame data conventions"):
 *  - Distances are in stage pixels, speeds in pixels/frame. The simulation converts them to
 *    fixed-point integers (x100) when used, so data may contain up to 2 decimals.
 *  - Boxes are relative to the fighter origin (between the feet, on the ground) and are authored
 *    facing RIGHT: +x is "forward", +y is "up". `x`/`y` are the box's back/bottom edge.
 *  - Move frames are 1-based. A move with startup S, active A, recovery R has its first active
 *    frame on frame S, last active frame on S+A-1 and total length S-1+A+R.
 */

export type Btn = 'LP' | 'MP' | 'HP' | 'LK' | 'MK' | 'HK';
export type BtnGroup = 'P' | 'K';
export type Strength = 'L' | 'M' | 'H' | 'EX';

export type MotionId =
  | 'qcf' | 'qcb' | 'dp' | 'rdp' | 'hcf' | 'hcb' | '360'
  | 'qcf2' | 'qcb2' | 'hcf2'
  | 'chargeBF' | 'chargeDU' | 'chargeBFBF';

export type MoveType =
  | 'normal' | 'command' | 'throw' | 'special' | 'ex' | 'super' | 'ultimate'
  | 'drive' | 'guardcancel' | 'pushblock';

export type Stance = 'stand' | 'crouch' | 'air';
export type HitLevel = 'high' | 'mid' | 'low' | 'overhead';
export type CancelClass = 'chain' | 'special' | 'super' | 'drive' | 'jump';

export interface Box { x: number; y: number; w: number; h: number }

export interface InputReq {
  motion?: MotionId;
  /** A specific button. */
  btn?: Btn;
  /** Any single button of a group (used for supers). */
  anyOf?: BtnGroup;
  /** Any two buttons of a group, pressed together (EX moves, drive). */
  two?: BtnGroup;
  /** An exact simultaneous set of buttons (throws, Storm Drive). */
  combo?: Btn[];
  /** Allowed held numpad directions (relative to facing) when the button is pressed. */
  dirs?: number[];
}

export type KnockdownKind = 'soft' | 'hard';

export interface HitDef {
  /** Inclusive range of move frames on which this hit's boxes are active. */
  frames: [number, number];
  boxes: Box[];
  damage: number;
  chip: number;
  /** Stun-gauge damage. */
  stun: number;
  hitstun: number;
  blockstun: number;
  hitstop: number;
  level: HitLevel;
  /** Total pushback distance (px) on hit / on block. */
  pushHit: number;
  pushBlock: number;
  /** Meter gained by the attacker on hit / on block. */
  meterHit: number;
  meterBlock: number;
  knockdown?: KnockdownKind;
  /** Launch velocity (px/frame, facing-relative) applied when the hit knocks down or juggles. */
  launch?: { vx: number; vy: number };
  /** Points added to the victim's juggle counter when this hit connects in the air. */
  juggleAdd?: number;
  /** This hit can only connect on a juggled victim whose counter is below this value. */
  juggleMax?: number;
  /** Strength class used for sparks, sound and shake. */
  power: 'light' | 'medium' | 'heavy' | 'special' | 'super';
  /** Pulls the victim toward the attacker (multi-hit specials) instead of pushing. */
  vacuum?: boolean;
  /** Hit causes a crumple (long ground stun) on counter hit. */
  crumpleOnCounter?: boolean;
}

export interface ThrowDef {
  box: Box;
  damage: number;
  stun: number;
  techable: boolean;
  /** Swap sides (back throw). */
  swap: boolean;
  /** Frame (relative to grab) on which damage is dealt and the victim is released. */
  release: number;
  /** Total frames of the throw animation for the attacker after the grab. */
  duration: number;
  releaseVel: { vx: number; vy: number };
  knockdown: KnockdownKind;
  /** Victim position keyframes relative to the attacker during the hold (facing-relative). */
  victim: { f: number; x: number; y: number; rot: number }[];
  /** Can grab airborne opponents (anti-air grabs). Default false. */
  air?: boolean;
  /** Hit power for VFX. */
  power: 'medium' | 'heavy' | 'super';
  /** Attacker animation keys relative to the grab frame. */
  anim: AnimKey[];
}

export interface ProjectileDef {
  id: string;
  vx: number;
  vy: number;
  /** Vertical acceleration (px/frame^2), negative = falls. */
  ay?: number;
  life: number;
  box: Box;
  hit: Omit<HitDef, 'frames' | 'boxes'>;
  /** Number of hits before it disappears. */
  hits: number;
  /** Frames between hits for multi-hit projectiles. */
  hitInterval: number;
  /** Clash strength vs other projectiles. */
  durability: number;
  /** Renderer style key. */
  style: 'orb' | 'orbEX' | 'lance' | 'lanceEX' | 'disc' | 'beam' | 'wave' | 'grid';
  color: string;
  size: number;
}

export interface MoveKey {
  f: number;
  /** Velocity (px/frame) facing-relative. Undefined = keep. */
  vx?: number;
  vy?: number;
  /** Gravity override (px/frame^2) from this frame on. */
  g?: number;
}

export interface AnimKey { f: number; pose: string }

export interface MoveDef {
  id: string;
  name: string;
  type: MoveType;
  stance: Stance;
  input: InputReq;
  /** Short description for the move list. */
  desc: string;
  startup: number;
  active: number;
  recovery: number;
  hits: HitDef[];
  /** Hurtbox keyframes: boxes apply from frame f until the next key. */
  hurt: { f: number; boxes: Box[] }[];
  /** Optional pushbox override. */
  push?: Box;
  move?: MoveKey[];
  invuln?: { strike?: [number, number]; throw?: [number, number]; proj?: [number, number] };
  armor?: { frames: [number, number]; hits: number };
  cancel?: { window: [number, number]; into: CancelClass[]; on: 'hit' | 'contact' | 'any' };
  /** Normals this move can chain into (with 'chain' cancel). */
  chainTo?: string[];
  /** Move ids that may follow this move via `followFrom` (rekkas). */
  followFrom?: string[];
  projectile?: { frame: number; def: ProjectileDef; x: number; y: number };
  /** Move becomes airborne between these frames (uses the move's vertical velocity). */
  airborne?: boolean;
  /** Air move: lands into this many recovery frames. */
  landingLag?: number;
  throw?: ThrowDef;
  meterCost?: number;
  /** Only usable when hp <= 35% (ultimates). */
  lowHp?: boolean;
  superFreeze?: number;
  /** Cannot be used while one of this fighter's projectiles exists. */
  oneProjectile?: boolean;
  /** Teleport: at frame f, relocate relative to opponent. */
  teleport?: { f: number; rel: 'behind' | 'front' | 'above'; dist: number; height?: number };
  /** Grants the 'airborne' juggle state to the user for invuln to throws etc. */
  anim: AnimKey[];
  /** Sound to play on startup. */
  sfx?: string;
  /** Meter gained on whiff (specials). */
  meterWhiff?: number;
  /** Sort priority within its type (higher first). */
  priority?: number;
}

export interface BodyDef {
  /** Overall render scale. */
  scale: number;
  height: number;
  torso: number;
  neck: number;
  head: number;
  shoulder: number;
  hipWidth: number;
  upperArm: number;
  foreArm: number;
  thigh: number;
  shin: number;
  limbWidth: number;
  torsoWidth: number;
  /** Visual archetype keys interpreted by the fighter renderer. */
  style: 'hayate' | 'magnus' | 'sable' | 'warden';
}

export interface Palette {
  name: string;
  skin: string;
  body: string;
  bodyDark: string;
  cloth: string;
  accent: string;
  glow: string;
  hair: string;
  rim: string;
}

export interface CharStats { power: number; speed: number; range: number; defense: number; difficulty: number }

export interface AIPersonality {
  aggression: number;   // 0..1 tendency to approach / attack
  zoning: number;       // 0..1 preference to keep distance and use projectiles
  jumpiness: number;    // 0..1 jump-in frequency
  grabby: number;       // 0..1 throw / command grab tendency
  antiAirMove: string;  // preferred anti-air (move id prefix)
  pokes: string[];      // footsie normals
  combos: string[][];   // known combo routes (move ids, in order)
  blockstrings: string[][];
  preferredRange: number;
  meterUse: number;     // 0..1 how eagerly meter is spent
}

export interface TrialDef {
  name: string;
  hint: string;
  steps: { move: string; label: string }[];
}

export interface CharacterDef {
  id: string;
  name: string;
  kanji: string;
  epithet: string;
  archetype: string;
  description: string;
  stats: CharStats;
  maxHp: number;
  maxStun: number;
  walkF: number;
  walkB: number;
  dashF: { frames: number; dist: number };
  dashB: { frames: number; dist: number; invuln: number };
  jump: { prejump: number; vy: number; g: number; vxF: number; vxB: number };
  airJumps: number;
  airDashes: number;
  hurt: { stand: Box[]; crouch: Box[]; air: Box[] };
  push: { stand: Box; crouch: Box; air: Box };
  body: BodyDef;
  palettes: [Palette, Palette];
  moves: MoveDef[];
  ai: AIPersonality;
  quotes: { intro: string[]; win: string[] };
  arcade: { intro: string; ending: string; rival: string };
  trials: TrialDef[];
  themeColor: string;
}
