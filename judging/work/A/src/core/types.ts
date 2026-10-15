import { Box } from '../utils/math';

export type CharacterId = 'hayate' | 'magnus' | 'sable' | 'warden';
export type StageId = 'rooftop' | 'alley' | 'shrine';

export type HitLevel = 'high' | 'mid' | 'low' | 'overhead' | 'throw' | 'unblockable';

export type MoveCategory =
  | 'normal'
  | 'command_normal'
  | 'throw'
  | 'special'
  | 'ex_special'
  | 'super'
  | 'ultimate'
  | 'system';

export type CancelTarget = 'chain' | 'special' | 'super' | 'ultimate' | 'dash' | 'jump';

export type MotionType =
  | 'QCF'
  | 'QCB'
  | 'DP'
  | 'HCF'
  | 'HCB'
  | '360'
  | 'CHARGE_BF'
  | 'CHARGE_DU'
  | 'DQCF'
  | 'DQCB';

export type AttackButton =
  | 'LP'
  | 'MP'
  | 'HP'
  | 'LK'
  | 'MK'
  | 'HK'
  | 'PP'
  | 'KK'
  | 'THROW'
  | 'PARRY'
  | 'OVERDRIVE';

export interface CancelWindow {
  startFrame: number;
  endFrame: number;
  targets: CancelTarget[];
  onHitOrBlockOnly?: boolean;
}

export interface InvincibilityWindow {
  startFrame: number;
  endFrame: number;
  type: 'full' | 'strike' | 'throw' | 'projectile' | 'airborne';
}

export interface ArmorWindow {
  startFrame: number;
  endFrame: number;
  hits: number;
}

export interface MovementPulse {
  startFrame: number;
  endFrame: number;
  vx?: number;
  vy?: number;
  teleportOffsetX?: number;
  teleportBehindOpponent?: boolean;
}

export interface ProjectileDef {
  id: string;
  name: string;
  spawnFrame: number;
  offsetX: number;
  offsetY: number;
  vx: number;
  vy: number;
  ax?: number;
  ay?: number;
  width: number;
  height: number;
  damage: number;
  chipDamage: number;
  stunDamage: number;
  hitstun: number;
  blockstun: number;
  hitstop: number;
  pushbackHit: number;
  pushbackBlock: number;
  hitLevel: HitLevel;
  knockdown: 'none' | 'soft' | 'hard' | 'launch';
  launchVx?: number;
  launchVy?: number;
  hits: number;
  lifetime: number;
  color: string;
  coreColor: string;
  style: 'shuriken' | 'rail_beam' | 'shockwave' | 'dagger_fan' | 'plasma_orb' | 'pillar';
}

export interface FrameBoxOverride {
  startFrame: number;
  endFrame: number;
  hurtboxes?: Box[];
  hitboxes?: Box[];
  pushbox?: Box;
  throwbox?: Box;
}

export interface MoveBoxes {
  startupHurtboxes?: Box[];
  activeHurtboxes?: Box[];
  recoveryHurtboxes?: Box[];
  hitboxes?: Box[];
  throwbox?: Box;
  pushbox?: Box;
  frameOverrides?: FrameBoxOverride[];
}

export type PoseType =
  | 'idle'
  | 'walk_f'
  | 'walk_b'
  | 'crouch'
  | 'jump'
  | 'dash_f'
  | 'dash_b'
  | 'block_stand'
  | 'block_crouch'
  | 'hit_stand'
  | 'hit_crouch'
  | 'knockdown'
  | 'dizzy'
  | 'parry'
  | 'overdrive'
  | 'punch_light'
  | 'punch_heavy'
  | 'uppercut'
  | 'kick_low'
  | 'kick_high'
  | 'kick_spin'
  | 'sweep'
  | 'throw_grab'
  | 'command_grab'
  | 'lariat'
  | 'shoulder_charge'
  | 'blade_slash'
  | 'teleport'
  | 'baton_thrust'
  | 'flash_kick'
  | 'super_cast'
  | 'victory';

export interface MoveDef {
  id: string;
  name: string;
  inputNotation: string;
  description: string;
  category: MoveCategory;
  posture: 'standing' | 'crouching' | 'airborne' | 'any';
  motion?: MotionType;
  button?: AttackButton;
  commandDir?: 1 | 2 | 3 | 4 | 6 | 7 | 8 | 9;
  meterCost: number;
  requiresLowHealth?: boolean;
  startup: number;
  active: number;
  recovery: number;
  totalFrames: number;
  hitstun: number;
  blockstun: number;
  hitstop: number;
  damage: number;
  chipDamage: number;
  stunDamage: number;
  meterGainWhiff: number;
  meterGainHit: number;
  meterGainBlock: number;
  pushbackHit: number;
  pushbackBlock: number;
  hitLevel: HitLevel;
  knockdown: 'none' | 'soft' | 'hard' | 'launch';
  launchVx?: number;
  launchVy?: number;
  juggleCost: number;
  juggleLimit: number;
  multiHitFrames?: number[];
  swapSidesOnHit?: boolean;
  cancelWindows: CancelWindow[];
  invincibility?: InvincibilityWindow[];
  armor?: ArmorWindow;
  movement?: MovementPulse[];
  projectile?: ProjectileDef;
  cinematicFreeze?: number;
  boxes: MoveBoxes;
  hitSparkStrength: 'light' | 'medium' | 'heavy' | 'special' | 'ex' | 'super' | 'throw';
  pose: PoseType;
}

export interface CharacterStats {
  power: number;     // 1-10
  speed: number;     // 1-10
  range: number;     // 1-10
  technique: number; // 1-10
  defense: number;   // 1-10
}

export interface CharacterPalette {
  primary: string;
  secondary: string;
  accent: string;
  glow: string;
  skin: string;
  clothDark: string;
}

export interface ComboTrialStep {
  moveId: string;
  label: string;
  notation: string;
}

export interface ComboTrialDef {
  id: string;
  name: string;
  difficulty: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED';
  description: string;
  steps: ComboTrialStep[];
}

export interface CharacterDef {
  id: CharacterId;
  name: string;
  title: string;
  archetype: string;
  origin: string;
  bio: string;
  arcadeIntro: string;
  arcadeEnding: string;
  quoteWin: string;
  maxHp: number;
  maxStun: number;
  walkForwardSpeed: number;
  walkBackwardSpeed: number;
  dashForwardVx: number;
  dashForwardFrames: number;
  dashBackwardVx: number;
  dashBackwardVy: number;
  dashBackwardFrames: number;
  jumpVx: number;
  jumpVy: number;
  gravity: number;
  preJumpFrames: number;
  maxAirJumps: number;
  maxAirDashes: number;
  airDashVx: number;
  airDashFrames: number;
  standPushbox: Box;
  crouchPushbox: Box;
  airPushbox: Box;
  standHurtboxes: Box[];
  crouchHurtboxes: Box[];
  airHurtboxes: Box[];
  stats: CharacterStats;
  palette: CharacterPalette;
  altPalette: CharacterPalette;
  moves: Record<string, MoveDef>;
  moveOrder: string[]; // Priority order for input evaluation
  trials: ComboTrialDef[];
}

export interface RawInputFrame {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  lp: boolean;
  mp: boolean;
  hp: boolean;
  lk: boolean;
  mk: boolean;
  hk: boolean;
  // Optional macro convenience flags
  throwMacro?: boolean;
  parryMacro?: boolean;
  overdriveMacro?: boolean;
  exMacro?: boolean;
}

/**
 * Numpad direction 1..9 relative to facing direction:
 * 7 8 9
 * 4 5 6 (6 = forward, 4 = backward, 2 = down, 8 = up, 5 = neutral)
 * 1 2 3
 */
export type NumpadDir = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface InputHistoryEntry {
  frame: number;
  rawDir: NumpadDir; // relative to P1 facing right (for HUD display)
  relDir: NumpadDir; // relative to character facing
  pressed: number;   // bitmask of buttons pressed this frame
  released: number;  // bitmask of buttons released this frame
  held: number;      // bitmask of buttons currently held
  duration: number;  // frames held in this state
}

export type FighterStatus =
  | 'idle'
  | 'walk_f'
  | 'walk_b'
  | 'crouch'
  | 'prejump'
  | 'jump'
  | 'dash_f'
  | 'dash_b'
  | 'air_dash'
  | 'attack'
  | 'block_stand'
  | 'block_crouch'
  | 'hitstun_stand'
  | 'hitstun_crouch'
  | 'hitstun_air'
  | 'thrown'
  | 'knockdown'
  | 'wakeup'
  | 'dizzy'
  | 'parry_stance'
  | 'parry_success'
  | 'overdrive_burst'
  | 'victory'
  | 'defeat';

export interface ActiveProjectile {
  uid: number;
  ownerIndex: 0 | 1;
  defId: string;
  name: string;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  ax: number;
  ay: number;
  facing: 1 | -1;
  width: number;
  height: number;
  damage: number;
  chipDamage: number;
  stunDamage: number;
  hitstun: number;
  blockstun: number;
  hitstop: number;
  pushbackHit: number;
  pushbackBlock: number;
  hitLevel: HitLevel;
  knockdown: 'none' | 'soft' | 'hard' | 'launch';
  launchVx: number;
  launchVy: number;
  hitsRemaining: number;
  hitCooldown: number;
  age: number;
  lifetime: number;
  color: string;
  coreColor: string;
  style: ProjectileDef['style'];
}

export interface FighterState {
  playerIndex: 0 | 1;
  charId: CharacterId;
  useAltPalette: boolean;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  hp: number;
  maxHp: number;
  whiteHp: number;
  whiteHpDelay: number;
  meter: number; // 0 to 300 (3 stocks of 100)
  stun: number;
  maxStun: number;
  stunDecayTimer: number;
  status: FighterStatus;
  statusFrame: number;
  currentMoveId: string | null;
  moveFrame: number;
  moveHitConnected: boolean;
  moveBlockedConnected: boolean;
  moveHitCount: number;
  hitstunFrames: number;
  blockstunFrames: number;
  hitstopFrames: number;
  knockdownFrames: number;
  knockdownType: 'none' | 'soft' | 'hard';
  quickRiseAvailable: boolean;
  usedQuickRise: boolean;
  invulnFrames: number;
  throwInvulnFrames: number;
  armorHitsRemaining: number;
  jugglePoints: number;
  airJumpsLeft: number;
  airDashesLeft: number;
  pendingJumpDir: -1 | 0 | 1;
  // Charge tracking
  chargeBackFrames: number;
  chargeDownFrames: number;
  chargeBackReleaseGrace: number;
  chargeDownReleaseGrace: number;
  // Combo tracking (when this fighter is BEING hit)
  comboCounter: number;
  comboDamage: number;
  comboScaling: number;
  lastComboTotalHits: number;
  lastComboTotalDamage: number;
  comboDisplayTimer: number;
  // Overdrive state
  overdriveTimer: number;
  overdriveUsedThisRound: boolean;
  // Throw state
  throwTargetIndex: number | null;
  throwTechWindow: number;
  isBackThrow: boolean;
  // Frame advantage tracking for Training mode
  lastFrameAdvantage: number;
  lastMoveStartup: number;
  lastMoveActive: number;
  lastMoveRecovery: number;
  // Input buffer inside serializable state for determinism
  inputBuffer: InputHistoryEntry[];
}

export type SimEventType =
  | 'hit'
  | 'block'
  | 'pushblock'
  | 'parry'
  | 'whiff'
  | 'throw_start'
  | 'throw_tech'
  | 'throw_slam'
  | 'knockdown'
  | 'quick_rise'
  | 'dizzy'
  | 'projectile_spawn'
  | 'projectile_clash'
  | 'super_freeze'
  | 'ultimate_freeze'
  | 'overdrive_burst'
  | 'ko'
  | 'round_start'
  | 'round_end'
  | 'dash'
  | 'jump'
  | 'land';

export interface SimEvent {
  type: SimEventType;
  playerIndex: 0 | 1;
  x: number;
  y: number;
  strength?: 'light' | 'medium' | 'heavy' | 'special' | 'ex' | 'super' | 'throw';
  damage?: number;
  moveName?: string;
  text?: string;
  isCounter?: boolean;
  isCrossUp?: boolean;
}

export type RoundPhase = 'intro' | 'fight' | 'ko_slowmo' | 'outro' | 'match_over';

export interface MatchState {
  frame: number;
  rngSeed: number;
  stageId: StageId;
  roundNumber: number;
  roundTimerFrames: number; // 99 * 60 = 5940
  phase: RoundPhase;
  phaseFrame: number;
  p1RoundsWon: number;
  p2RoundsWon: number;
  roundsToWin: number;
  winnerIndex: 0 | 1 | -1 | null; // -1 for draw
  finishType: 'NONE' | 'KO' | 'SUPER_KO' | 'ULTIMATE_KO' | 'PERFECT' | 'TIME_OVER' | 'DOUBLE_KO';
  announcementText: string;
  announcementSubtext: string;
  announcementTimer: number;
  screenFreezeFrames: number;
  superFreezeOwner: 0 | 1 | null;
  superFreezeMoveName: string;
  superFreezeIsUltimate: boolean;
  slowMoFrames: number;
  cameraX: number;
  cameraY: number;
  cameraZoom: number;
  screenShake: number;
  nextProjectileUid: number;
  fighters: [FighterState, FighterState];
  projectiles: ActiveProjectile[];
  events: SimEvent[];
}
