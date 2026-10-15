/**
 * Serializable simulation state. Everything here is plain data (numbers, strings, booleans,
 * arrays, plain objects) so a whole match can be cloned for rollback, hashed for determinism
 * checks and replayed from a seed + input log.
 *
 * Positions/velocities are fixed-point integers: 1 stage pixel = FP (100) units.
 */

export const FP = 100;
export const HISTORY = 64;
/** Half width of the stage in pixels (walls at +-STAGE_HALF). */
export const STAGE_HALF = 1000;
/** Maximum distance between the two fighters (camera limit), pixels. */
export const MAX_SEP = 1060;
/** Life threshold (percent) under which Ultimates become available. */
export const ULT_HP_PCT = 35;
export const METER_MAX = 300;
export const METER_STOCK = 100;
export const DRIVE_FRAMES = 360;
export const BURNOUT_FRAMES = 180;

export type FState =
  | 'intro' | 'idle' | 'walkF' | 'walkB' | 'crouch' | 'guard' | 'prejump' | 'air' | 'land'
  | 'dashF' | 'dashB' | 'airdash' | 'attack' | 'hitstun' | 'blockstun' | 'juggle' | 'down'
  | 'wakeup' | 'thrown' | 'tech' | 'dizzy' | 'ko' | 'win' | 'lose' | 'airRecover';

export interface FighterStats {
  damage: number;
  maxCombo: number;
  maxComboDmg: number;
  specials: number;
  supers: number;
  throws: number;
  blocks: number;
  drives: number;
  hits: number;
}

export interface FighterState {
  idx: number;
  char: string;
  palette: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Gravity while airborne (fixed-point px/frame^2). */
  g: number;
  facing: number;
  hp: number;
  meter: number;
  stun: number;
  stunDelay: number;
  dizzyPending: boolean;
  state: FState;
  /** Frames spent in the current state. */
  sf: number;
  /** Current move id or ''. */
  move: string;
  /** 1-based move frame. */
  mf: number;
  /** Bitmask of hit indices of the current move that already connected. */
  moveHits: number;
  /** 0 = no contact, 1 = hit, 2 = blocked, 3 = armored. */
  contact: number;
  armorLeft: number;
  hitstun: number;
  blockstun: number;
  hitstop: number;
  /** Victim shake frames (render). */
  shake: number;
  pushV: number;
  pushDecel: number;
  air: boolean;
  airAttacked: boolean;
  airJumps: number;
  airDashes: number;
  jumpDir: number;
  /** Juggle counter while airborne in hitstun. */
  juggle: number;
  /** Pending knockdown when landing from juggle: 0 air reset, 1 soft, 2 hard. */
  kd: number;
  /** Generic timer (prejump/dash/land/down/wakeup/tech/dizzy). */
  timer: number;
  crouchHit: boolean;
  /** Height (px above the feet) where the last hit landed: picks the hit reaction pose. */
  hitY: number;
  /** Was hit by a counter hit (render / popup). */
  counter: boolean;
  combo: number;
  comboDmg: number;
  throwInv: number;
  /** Index of the fighter holding this one in a throw, or -1. */
  grabbedBy: number;
  /** Frames since this fighter's grab connected, or -1. */
  grabFrame: number;
  techWindow: number;
  pushblockCd: number;
  /** General invulnerability frames (wakeup, air recovery). */
  invuln: number;
  drive: number;
  burnout: number;
  /** Input history ring buffer (absolute SOCD-cleaned bits) and input frame counter. */
  hist: number[];
  /** Per-history-frame flag: 1 if the fighter was frozen (hitstop / super freeze) that frame. */
  fz: number[];
  frame: number;
  /** Input frame number of the last consumed press per button (LP..HK). */
  consumed: number[];
  chargeB: number;
  chargeD: number;
  chargeBRel: number;
  chargeBAmt: number;
  chargeDRel: number;
  chargeDAmt: number;
  /** Count of active projectiles owned. */
  proj: number;
  /** Life lost during the current round that is still "recoverable" (render only uses). */
  koed: boolean;
  /** Last move started (for training frame data / trials). */
  lastMove: string;
  stats: FighterStats;
}

export interface ProjectileState {
  id: number;
  owner: number;
  char: string;
  move: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ay: number;
  facing: number;
  life: number;
  hitsLeft: number;
  cooldown: number;
  durability: number;
  hitstop: number;
  age: number;
  dead: boolean;
}

export interface SimEvent {
  /** Event type: hit, block, whiff, special, super, ult, drive, proj, clash, throw, tech, ko, ... */
  t: string;
  /** Fighter index (owner/attacker) when relevant. */
  p: number;
  x: number;
  y: number;
  /** Kind payload (hit power, move id, ...). */
  k: string;
  v: number;
}

export type Phase = 'intro' | 'fight' | 'ko' | 'roundEnd' | 'matchEnd';

export interface RoundResult {
  winner: number; // 0, 1, or -1 (draw / double KO)
  kind: 'ko' | 'perfect' | 'timeout' | 'double' | 'draw';
}

export interface TrainingOpts { infiniteHp: boolean; infiniteMeter: boolean; noStun: boolean }

export interface MatchConfig {
  chars: [string, string];
  palettes: [number, number];
  stage: string;
  seed: number;
  roundsToWin: number;
  /** Round time in seconds; 0 = infinite. */
  roundTime: number;
  training: boolean;
  trainingOpts: TrainingOpts;
  /** Skip the round intro (training / trials). */
  skipIntro: boolean;
}

export interface AdvantageTracker {
  active: boolean;
  attacker: number;
  /** Frame on which each fighter became actionable, -1 if not yet. */
  af: number;
  vf: number;
  move: string;
  blocked: boolean;
}

export interface MatchState {
  frame: number;
  rng: number;
  phase: Phase;
  phaseFrame: number;
  round: number;
  /** Remaining seconds and frames into the current second. */
  timer: number;
  timerSub: number;
  wins: [number, number];
  results: RoundResult[];
  /** Global super-freeze frames remaining and the fighter who caused it. */
  freeze: number;
  freezeOwner: number;
  freezeKind: string;
  /** KO slow motion frames remaining. */
  slowmo: number;
  /** -2 undecided, -1 draw, 0/1 winner. */
  matchWinner: number;
  /** Winner of the current round being resolved (-1 draw, -2 none). */
  roundWinner: number;
  timeOver: boolean;
  fighters: [FighterState, FighterState];
  projectiles: ProjectileState[];
  nextProjId: number;
  events: SimEvent[];
  config: MatchConfig;
  finalRound: boolean;
  adv: AdvantageTracker;
  /** Frames both fighters have been neutral (training refill). */
  neutralFrames: number;
}
