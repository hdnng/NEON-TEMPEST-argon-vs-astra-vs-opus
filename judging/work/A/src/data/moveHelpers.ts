import {
  AttackButton,
  CancelTarget,
  HitLevel,
  MotionType,
  MoveBoxes,
  MoveCategory,
  MoveDef,
  PoseType,
  ProjectileDef
} from '../core/types';
import { Box } from '../utils/math';

export const DEFAULT_STAND_PUSHBOX: Box = { x: -32, y: -150, w: 64, h: 150 };
export const DEFAULT_CROUCH_PUSHBOX: Box = { x: -34, y: -105, w: 68, h: 105 };
export const DEFAULT_AIR_PUSHBOX: Box = { x: -30, y: -140, w: 60, h: 110 };

export const DEFAULT_STAND_HURTBOXES: Box[] = [
  { x: -26, y: -175, w: 52, h: 42 }, // head/upper
  { x: -34, y: -135, w: 68, h: 70 }, // torso
  { x: -32, y: -65, w: 64, h: 65 }   // legs
];

export const DEFAULT_CROUCH_HURTBOXES: Box[] = [
  { x: -28, y: -120, w: 56, h: 40 }, // head/shoulders
  { x: -38, y: -80, w: 76, h: 80 }   // crouched body/legs
];

export const DEFAULT_AIR_HURTBOXES: Box[] = [
  { x: -30, y: -155, w: 60, h: 115 }
];

export interface NormalBuildOpts {
  id: string;
  name: string;
  inputNotation: string;
  description: string;
  posture: 'standing' | 'crouching' | 'airborne';
  button: AttackButton;
  commandDir?: 1 | 2 | 3 | 4 | 6;
  startup: number;
  active: number;
  recovery: number;
  hitstun: number;
  blockstun: number;
  hitstop: number;
  damage: number;
  stunDamage: number;
  pushbackHit: number;
  pushbackBlock: number;
  hitLevel: HitLevel;
  knockdown?: 'none' | 'soft' | 'hard' | 'launch';
  launchVx?: number;
  launchVy?: number;
  cancels: CancelTarget[];
  hitbox: Box;
  limbHurtbox?: Box;
  vx?: number;
  pose: PoseType;
  strength: 'light' | 'medium' | 'heavy';
}

export function buildNormalMove(opts: NormalBuildOpts): MoveDef {
  const baseHurt =
    opts.posture === 'crouching'
      ? DEFAULT_CROUCH_HURTBOXES
      : opts.posture === 'airborne'
      ? DEFAULT_AIR_HURTBOXES
      : DEFAULT_STAND_HURTBOXES;

  const activeHurt = opts.limbHurtbox ? [...baseHurt, opts.limbHurtbox] : baseHurt;
  const totalFrames = opts.startup + opts.active + opts.recovery;

  const boxes: MoveBoxes = {
    startupHurtboxes: baseHurt,
    activeHurtboxes: activeHurt,
    recoveryHurtboxes: activeHurt,
    hitboxes: [opts.hitbox]
  };

  return {
    id: opts.id,
    name: opts.name,
    inputNotation: opts.inputNotation,
    description: opts.description,
    category: opts.commandDir ? 'command_normal' : 'normal',
    posture: opts.posture,
    button: opts.button,
    commandDir: opts.commandDir,
    meterCost: 0,
    startup: opts.startup,
    active: opts.active,
    recovery: opts.recovery,
    totalFrames,
    hitstun: opts.hitstun,
    blockstun: opts.blockstun,
    hitstop: opts.hitstop,
    damage: opts.damage,
    chipDamage: opts.strength === 'heavy' ? Math.max(2, Math.round(opts.damage * 0.05)) : 0,
    stunDamage: opts.stunDamage,
    meterGainWhiff: opts.strength === 'light' ? 2 : opts.strength === 'medium' ? 4 : 6,
    meterGainHit: opts.strength === 'light' ? 8 : opts.strength === 'medium' ? 14 : 20,
    meterGainBlock: opts.strength === 'light' ? 4 : opts.strength === 'medium' ? 7 : 10,
    pushbackHit: opts.pushbackHit,
    pushbackBlock: opts.pushbackBlock,
    hitLevel: opts.hitLevel,
    knockdown: opts.knockdown ?? 'none',
    launchVx: opts.launchVx,
    launchVy: opts.launchVy,
    juggleCost: 1,
    juggleLimit: opts.strength === 'light' ? 3 : 2,
    cancelWindows:
      opts.cancels.length > 0
        ? [
            {
              startFrame: opts.startup,
              endFrame: opts.startup + opts.active + 5,
              targets: opts.cancels,
              onHitOrBlockOnly: true
            }
          ]
        : [],
    movement: opts.vx
      ? [{ startFrame: 1, endFrame: opts.startup + 2, vx: opts.vx }]
      : undefined,
    boxes,
    hitSparkStrength: opts.strength,
    pose: opts.pose
  };
}

export function buildStandardThrows(
  charPrefix: string,
  forwardName: string,
  backName: string,
  damage = 115,
  reach = 68
): { throw_f: MoveDef; throw_b: MoveDef } {
  const throwBox: Box = { x: 10, y: -150, w: reach, h: 110 };
  const throw_f: MoveDef = {
    id: 'throw_f',
    name: forwardName,
    inputNotation: 'LP + LK',
    description: `${charPrefix} close-range forward grapple that slams the opponent down.`,
    category: 'throw',
    posture: 'standing',
    button: 'THROW',
    meterCost: 0,
    startup: 5,
    active: 3,
    recovery: 22,
    totalFrames: 30,
    hitstun: 30,
    blockstun: 0,
    hitstop: 12,
    damage,
    chipDamage: 0,
    stunDamage: 120,
    meterGainWhiff: 0,
    meterGainHit: 18,
    meterGainBlock: 0,
    pushbackHit: 180,
    pushbackBlock: 0,
    hitLevel: 'throw',
    knockdown: 'hard',
    launchVx: 7.5,
    launchVy: -7.0,
    juggleCost: 99,
    juggleLimit: 0,
    cancelWindows: [],
    boxes: {
      startupHurtboxes: DEFAULT_STAND_HURTBOXES,
      activeHurtboxes: DEFAULT_STAND_HURTBOXES,
      recoveryHurtboxes: DEFAULT_STAND_HURTBOXES,
      throwbox: throwBox
    },
    hitSparkStrength: 'throw',
    pose: 'throw_grab'
  };

  const throw_b: MoveDef = {
    ...throw_f,
    id: 'throw_b',
    name: backName,
    inputNotation: '4 + LP + LK',
    description: `${charPrefix} side-switching back throw that hurls the opponent behind you.`,
    commandDir: 4,
    swapSidesOnHit: true,
    launchVx: 8.5,
    launchVy: -7.5
  };

  return { throw_f, throw_b };
}

export interface SpecialVariantOpts {
  baseId: string;
  baseName: string;
  baseNotation: string;
  description: string;
  motion: MotionType;
  buttonType: 'P' | 'K';
  posture?: 'standing' | 'crouching' | 'airborne' | 'any';
  startup: [number, number, number, number]; // L, M, H, EX
  active: [number, number, number, number];
  recovery: [number, number, number, number];
  damage: [number, number, number, number];
  chipDamage?: [number, number, number, number];
  stunDamage: [number, number, number, number];
  hitstun: [number, number, number, number];
  blockstun: [number, number, number, number];
  hitstop: [number, number, number, number];
  pushbackHit: number;
  pushbackBlock: number;
  hitLevel: HitLevel;
  knockdown: ('none' | 'soft' | 'hard' | 'launch')[];
  launchVx?: [number, number, number, number];
  launchVy?: [number, number, number, number];
  juggleCost?: number;
  juggleLimit?: number;
  multiHitFrames?: [number[] | undefined, number[] | undefined, number[] | undefined, number[] | undefined];
  vx?: [number, number, number, number];
  vy?: [number, number, number, number];
  teleportOffsetX?: [number, number, number, number];
  teleportBehind?: [boolean, boolean, boolean, boolean];
  invuln?: (
    | { startFrame: number; endFrame: number; type: 'full' | 'strike' | 'throw' | 'projectile' | 'airborne' }[]
    | undefined
  )[];
  armor?: ({ startFrame: number; endFrame: number; hits: number } | undefined)[];
  projectiles?: (ProjectileDef | undefined)[];
  hitbox?: Box;
  throwbox?: Box;
  pose: PoseType;
}

/**
 * Generates L, M, H, and EX versions of a Special Move with full frame data and Super/Ultimate cancel support.
 */
export function buildSpecialVariants(opts: SpecialVariantOpts): Record<string, MoveDef> {
  const suffixes = ['_l', '_m', '_h', '_ex'] as const;
  const labels = ['L', 'M', 'H', 'EX'] as const;
  const buttonsP: AttackButton[] = ['LP', 'MP', 'HP', 'PP'];
  const buttonsK: AttackButton[] = ['LK', 'MK', 'HK', 'KK'];
  const buttons = opts.buttonType === 'P' ? buttonsP : buttonsK;

  const result: Record<string, MoveDef> = {};

  for (let i = 0; i < 4; i++) {
    const isEx = i === 3;
    const id = `${opts.baseId}${suffixes[i]}`;
    const name = `${opts.baseName} (${labels[i]})`;
    const startup = opts.startup[i];
    const active = opts.active[i];
    const recovery = opts.recovery[i];
    const totalFrames = startup + active + recovery;
    const dmg = opts.damage[i];

    const movement: MoveDef['movement'] = [];
    const vx = opts.vx ? opts.vx[i] : 0;
    const vy = opts.vy ? opts.vy[i] : 0;
    const teleX = opts.teleportOffsetX ? opts.teleportOffsetX[i] : 0;
    const teleBehind = opts.teleportBehind ? opts.teleportBehind[i] : false;

    if (vx !== 0 || vy !== 0) {
      movement.push({
        startFrame: Math.max(1, startup - 2),
        endFrame: startup + active,
        vx: vx !== 0 ? vx : undefined,
        vy: vy !== 0 ? vy : undefined
      });
    }
    if (teleX !== 0 || teleBehind) {
      movement.push({
        startFrame: startup,
        endFrame: startup,
        teleportOffsetX: teleX !== 0 ? teleX : undefined,
        teleportBehindOpponent: teleBehind
      });
    }

    const category: MoveCategory = isEx ? 'ex_special' : 'special';

    result[id] = {
      id,
      name,
      inputNotation: `${opts.baseNotation} + ${buttons[i]}`,
      description: isEx ? `${opts.description} [EX Enhanced — Costs 1 Stock]` : opts.description,
      category,
      posture: opts.posture ?? 'standing',
      motion: opts.motion,
      button: buttons[i],
      meterCost: isEx ? 100 : 0,
      startup,
      active,
      recovery,
      totalFrames,
      hitstun: opts.hitstun[i],
      blockstun: opts.blockstun[i],
      hitstop: opts.hitstop[i],
      damage: dmg,
      chipDamage: opts.chipDamage ? opts.chipDamage[i] : Math.max(8, Math.round(dmg * 0.14)),
      stunDamage: opts.stunDamage[i],
      meterGainWhiff: isEx ? 0 : 8,
      meterGainHit: isEx ? 0 : 22,
      meterGainBlock: isEx ? 0 : 12,
      pushbackHit: opts.pushbackHit,
      pushbackBlock: opts.pushbackBlock,
      hitLevel: opts.hitLevel,
      knockdown: opts.knockdown[i],
      launchVx: opts.launchVx ? opts.launchVx[i] : undefined,
      launchVy: opts.launchVy ? opts.launchVy[i] : undefined,
      juggleCost: opts.juggleCost ?? 1,
      juggleLimit: isEx ? (opts.juggleLimit ?? 3) + 2 : (opts.juggleLimit ?? 3),
      multiHitFrames: opts.multiHitFrames ? opts.multiHitFrames[i] : undefined,
      cancelWindows: [
        {
          startFrame: startup,
          endFrame: startup + active + 6,
          targets: ['super', 'ultimate'],
          onHitOrBlockOnly: true
        }
      ],
      invincibility: opts.invuln ? opts.invuln[i] : undefined,
      armor: opts.armor ? opts.armor[i] : undefined,
      movement: movement.length > 0 ? movement : undefined,
      projectile: opts.projectiles ? opts.projectiles[i] : undefined,
      boxes: {
        startupHurtboxes: DEFAULT_STAND_HURTBOXES,
        activeHurtboxes: DEFAULT_STAND_HURTBOXES,
        recoveryHurtboxes: DEFAULT_STAND_HURTBOXES,
        hitboxes: opts.hitbox ? [opts.hitbox] : undefined,
        throwbox: opts.throwbox
      },
      hitSparkStrength: isEx ? 'ex' : 'special',
      pose: opts.pose
    };
  }

  return result;
}
