import { CHARACTERS } from '../data/characters';
import {
  ActiveProjectile,
  AttackButton,
  CharacterDef,
  CharacterId,
  FighterState,
  MatchState,
  MoveDef,
  RawInputFrame,
  StageId
} from './types';
import {
  BTN_HK,
  BTN_HP,
  BTN_LK,
  BTN_LP,
  BTN_MK,
  BTN_MP,
  checkButtonBuffered,
  checkDashInput,
  checkMotionInput,
  consumeBufferedInput,
  countBits,
  PUNCH_MASK,
  KICK_MASK,
  pushInputFrame
} from '../input/inputBuffer';
import {
  Box,
  boxesOverlap,
  boxIntersectionCenter,
  clamp,
  lerp,
  toWorldBox
} from '../utils/math';
import { nextRandom } from '../utils/rng';

export const STAGE_LEFT_BOUND = -540;
export const STAGE_RIGHT_BOUND = 540;
export const MAX_FIGHTER_SEPARATION = 880;
export const ROUND_TIME_SECONDS = 99;
export const FRAMES_PER_SECOND = 60;

export interface TrainingSimulationOptions {
  infiniteHealth?: boolean;
  infiniteMeter?: boolean;
  noStun?: boolean;
  alwaysCounterHit?: boolean;
}

export function createFighterState(
  playerIndex: 0 | 1,
  charId: CharacterId,
  useAltPalette = false
): FighterState {
  const def = CHARACTERS[charId];
  const startX = playerIndex === 0 ? -210 : 210;
  const facing: 1 | -1 = playerIndex === 0 ? 1 : -1;

  return {
    playerIndex,
    charId,
    useAltPalette,
    x: startX,
    y: 0,
    prevX: startX,
    prevY: 0,
    vx: 0,
    vy: 0,
    facing,
    hp: def.maxHp,
    maxHp: def.maxHp,
    whiteHp: def.maxHp,
    whiteHpDelay: 0,
    meter: 0,
    stun: 0,
    maxStun: def.maxStun,
    stunDecayTimer: 0,
    status: 'idle',
    statusFrame: 0,
    currentMoveId: null,
    moveFrame: 0,
    moveHitConnected: false,
    moveBlockedConnected: false,
    moveHitCount: 0,
    hitstunFrames: 0,
    blockstunFrames: 0,
    hitstopFrames: 0,
    knockdownFrames: 0,
    knockdownType: 'none',
    quickRiseAvailable: false,
    usedQuickRise: false,
    invulnFrames: 0,
    throwInvulnFrames: 0,
    armorHitsRemaining: 0,
    jugglePoints: 0,
    airJumpsLeft: def.maxAirJumps,
    airDashesLeft: def.maxAirDashes,
    pendingJumpDir: 0,
    chargeBackFrames: 0,
    chargeDownFrames: 0,
    chargeBackReleaseGrace: 0,
    chargeDownReleaseGrace: 0,
    comboCounter: 0,
    comboDamage: 0,
    comboScaling: 1.0,
    lastComboTotalHits: 0,
    lastComboTotalDamage: 0,
    comboDisplayTimer: 0,
    overdriveTimer: 0,
    overdriveUsedThisRound: false,
    throwTargetIndex: null,
    throwTechWindow: 0,
    isBackThrow: false,
    lastFrameAdvantage: 0,
    lastMoveStartup: 0,
    lastMoveActive: 0,
    lastMoveRecovery: 0,
    inputBuffer: []
  };
}

export function createMatchState(opts: {
  p1Char: CharacterId;
  p2Char: CharacterId;
  stageId?: StageId;
  seed?: number;
  roundsToWin?: number;
  p1Alt?: boolean;
  p2Alt?: boolean;
  skipIntro?: boolean;
}): MatchState {
  const p1Alt = opts.p1Alt ?? false;
  const p2Alt = opts.p2Alt ?? (opts.p1Char === opts.p2Char ? !p1Alt : false);

  const p1 = createFighterState(0, opts.p1Char, p1Alt);
  const p2 = createFighterState(1, opts.p2Char, p2Alt);

  return {
    frame: 0,
    rngSeed: opts.seed ?? 0x2099cafe,
    stageId: opts.stageId ?? 'rooftop',
    roundNumber: 1,
    roundTimerFrames: ROUND_TIME_SECONDS * FRAMES_PER_SECOND,
    phase: opts.skipIntro ? 'fight' : 'intro',
    phaseFrame: 0,
    p1RoundsWon: 0,
    p2RoundsWon: 0,
    roundsToWin: opts.roundsToWin ?? 2,
    winnerIndex: null,
    finishType: 'NONE',
    announcementText: opts.skipIntro ? '' : 'ROUND 1',
    announcementSubtext: opts.skipIntro ? '' : 'INITIALIZE COMBAT PROTOCOL',
    announcementTimer: opts.skipIntro ? 0 : 75,
    screenFreezeFrames: 0,
    superFreezeOwner: null,
    superFreezeMoveName: '',
    superFreezeIsUltimate: false,
    slowMoFrames: 0,
    cameraX: 0,
    cameraY: 0,
    cameraZoom: 1.04,
    screenShake: 0,
    nextProjectileUid: 1,
    fighters: [p1, p2],
    projectiles: [],
    events: []
  };
}

export function cloneMatchState(state: MatchState): MatchState {
  return JSON.parse(JSON.stringify(state)) as MatchState;
}

export function resetRoundState(state: MatchState, skipIntro = false): void {
  const p1Meter = state.fighters[0].meter;
  const p2Meter = state.fighters[1].meter;
  const f0 = createFighterState(0, state.fighters[0].charId, state.fighters[0].useAltPalette);
  const f1 = createFighterState(1, state.fighters[1].charId, state.fighters[1].useAltPalette);
  // Carry over meter between rounds (standard fighting game mechanic)
  f0.meter = p1Meter;
  f1.meter = p2Meter;

  state.fighters = [f0, f1];
  state.projectiles = [];
  state.roundTimerFrames = ROUND_TIME_SECONDS * FRAMES_PER_SECOND;
  state.phase = skipIntro ? 'fight' : 'intro';
  state.phaseFrame = 0;
  state.winnerIndex = null;
  state.finishType = 'NONE';
  state.screenFreezeFrames = 0;
  state.superFreezeOwner = null;
  state.slowMoFrames = 0;
  state.screenShake = 0;
  state.cameraX = 0;
  state.cameraY = 0;
  state.cameraZoom = 1.04;
  state.announcementText = skipIntro ? '' : `ROUND ${state.roundNumber}`;
  state.announcementSubtext = skipIntro ? '' : 'STANDBY FOR ENGAGEMENT';
  state.announcementTimer = skipIntro ? 0 : 75;
}

/**
 * Computes world-space pushbox, hurtboxes, hitboxes, and throwbox for a fighter on the current frame.
 */
export function getFighterBoxes(
  fighter: FighterState,
  charDef: CharacterDef = CHARACTERS[fighter.charId]
): {
  pushbox: Box;
  hurtboxes: Box[];
  hitboxes: Box[];
  throwbox: Box | null;
} {
  const isAir = fighter.y < 0 || fighter.status === 'jump' || fighter.status === 'hitstun_air' || fighter.status === 'air_dash';
  const isCrouch =
    fighter.status === 'crouch' ||
    fighter.status === 'block_crouch' ||
    fighter.status === 'hitstun_crouch' ||
    (fighter.status === 'attack' &&
      fighter.currentMoveId !== null &&
      charDef.moves[fighter.currentMoveId]?.posture === 'crouching');

  const relPush = isAir
    ? charDef.airPushbox
    : isCrouch
    ? charDef.crouchPushbox
    : charDef.standPushbox;

  const pushbox = toWorldBox(fighter.x, fighter.y, fighter.facing, relPush);

  // Knockdown / Wakeup / Thrown have no hurtboxes (invulnerable on ground)
  if (
    fighter.status === 'knockdown' ||
    fighter.status === 'wakeup' ||
    fighter.status === 'thrown' ||
    fighter.invulnFrames > 0
  ) {
    return { pushbox, hurtboxes: [], hitboxes: [], throwbox: null };
  }

  let relHurtboxes: Box[] = isAir
    ? charDef.airHurtboxes
    : isCrouch
    ? charDef.crouchHurtboxes
    : charDef.standHurtboxes;
  let relHitboxes: Box[] = [];
  let relThrowbox: Box | null = null;

  if (fighter.status === 'overdrive_burst') {
    if (fighter.statusFrame >= 3 && fighter.statusFrame <= 10) {
      relHitboxes = [{ x: -110, y: -180, w: 220, h: 180 }];
    }
    return {
      pushbox,
      hurtboxes: [],
      hitboxes: relHitboxes.map((b) => toWorldBox(fighter.x, fighter.y, fighter.facing, b)),
      throwbox: null
    };
  }

  if (fighter.status === 'attack' && fighter.currentMoveId) {
    const move = charDef.moves[fighter.currentMoveId];
    if (move) {
      const f = fighter.moveFrame;
      const inStartup = f < move.startup;
      const inActive = f >= move.startup && f < move.startup + move.active;

      if (inStartup && move.boxes.startupHurtboxes) {
        relHurtboxes = move.boxes.startupHurtboxes;
      } else if (inActive && move.boxes.activeHurtboxes) {
        relHurtboxes = move.boxes.activeHurtboxes;
      } else if (!inStartup && !inActive && move.boxes.recoveryHurtboxes) {
        relHurtboxes = move.boxes.recoveryHurtboxes;
      }

      // Check full invincibility windows on the move
      if (move.invincibility) {
        for (const win of move.invincibility) {
          if (f >= win.startFrame && f <= win.endFrame && win.type === 'full') {
            relHurtboxes = [];
          }
        }
      }

      // Determine if hitbox / throwbox is active on this frame
      if (inActive) {
        let canHitThisFrame = false;
        if (move.multiHitFrames && move.multiHitFrames.length > 0) {
          // Multi-hit moves reactivate hitbox at each specified pulse frame for 3 frames
          for (let idx = 0; idx < move.multiHitFrames.length; idx++) {
            const pulseStart = move.multiHitFrames[idx];
            if (f >= pulseStart && f <= pulseStart + 2 && fighter.moveHitCount <= idx) {
              canHitThisFrame = true;
              break;
            }
          }
        } else {
          canHitThisFrame = !fighter.moveHitConnected && !fighter.moveBlockedConnected;
        }

        if (canHitThisFrame) {
          if (move.boxes.hitboxes) {
            relHitboxes = move.boxes.hitboxes;
          }
          if (move.boxes.throwbox) {
            relThrowbox = move.boxes.throwbox;
          }
        }
      }
    }
  }

  return {
    pushbox,
    hurtboxes: relHurtboxes.map((b) => toWorldBox(fighter.x, fighter.y, fighter.facing, b)),
    hitboxes: relHitboxes.map((b) => toWorldBox(fighter.x, fighter.y, fighter.facing, b)),
    throwbox: relThrowbox ? toWorldBox(fighter.x, fighter.y, fighter.facing, relThrowbox) : null
  };
}

export function isFighterInvulnerableTo(
  fighter: FighterState,
  charDef: CharacterDef,
  attackType: 'strike' | 'throw' | 'projectile'
): boolean {
  if (
    fighter.status === 'knockdown' ||
    fighter.status === 'wakeup' ||
    fighter.status === 'thrown' ||
    fighter.status === 'overdrive_burst' ||
    fighter.invulnFrames > 0
  ) {
    return true;
  }
  if (attackType === 'throw') {
    if (
      fighter.throwInvulnFrames > 0 ||
      fighter.y < 0 ||
      fighter.status === 'prejump' ||
      fighter.status === 'jump' ||
      fighter.status === 'hitstun_stand' ||
      fighter.status === 'hitstun_crouch' ||
      fighter.status === 'hitstun_air' ||
      fighter.status === 'block_stand' ||
      fighter.status === 'block_crouch'
    ) {
      return true;
    }
  }

  if (fighter.status === 'attack' && fighter.currentMoveId) {
    const move = charDef.moves[fighter.currentMoveId];
    if (move?.invincibility) {
      const f = fighter.moveFrame;
      for (const win of move.invincibility) {
        if (f >= win.startFrame && f <= win.endFrame) {
          if (win.type === 'full') return true;
          if (win.type === attackType) return true;
          if (win.type === 'airborne' && attackType === 'throw') return true;
        }
      }
    }
  }

  return false;
}

function addMeter(fighter: FighterState, amount: number): void {
  if (fighter.overdriveTimer > 0 && amount > 0) {
    // Reduced meter gain while Overdrive is active
    amount = Math.round(amount * 0.25);
  }
  fighter.meter = clamp(fighter.meter + amount, 0, 300);
}

/**
 * Starts a move on a fighter and emits any startup events (whiff, super freeze, etc.).
 */
export function startMove(
  state: MatchState,
  fighter: FighterState,
  move: MoveDef
): void {
  if (move.meterCost > 0) {
    fighter.meter = Math.max(0, fighter.meter - move.meterCost);
  }
  if (move.meterGainWhiff > 0) {
    addMeter(fighter, move.meterGainWhiff);
  }

  fighter.status = 'attack';
  fighter.statusFrame = 0;
  fighter.currentMoveId = move.id;
  fighter.moveFrame = 1;
  fighter.moveHitConnected = false;
  fighter.moveBlockedConnected = false;
  fighter.moveHitCount = 0;
  fighter.lastMoveStartup = move.startup;
  fighter.lastMoveActive = move.active;
  fighter.lastMoveRecovery = move.recovery;

  // Set initial armor if move has armor
  if (move.armor && move.armor.startFrame <= 1) {
    fighter.armorHitsRemaining = move.armor.hits;
  } else {
    fighter.armorHitsRemaining = 0;
  }

  // Stop horizontal walk inertia on ground moves unless they have their own velocity pulse
  if (fighter.y >= 0) {
    fighter.vx *= 0.35;
  }

  consumeBufferedInput(fighter, move.motion);

  if (move.cinematicFreeze && move.cinematicFreeze > 0) {
    state.screenFreezeFrames = move.cinematicFreeze;
    state.superFreezeOwner = fighter.playerIndex;
    state.superFreezeMoveName = move.name;
    state.superFreezeIsUltimate = move.category === 'ultimate';
    state.announcementText = move.category === 'ultimate' ? 'ULTIMATE ART' : 'SUPER ART';
    state.announcementSubtext = move.name.toUpperCase();
    state.announcementTimer = 55;
    state.events.push({
      type: move.category === 'ultimate' ? 'ultimate_freeze' : 'super_freeze',
      playerIndex: fighter.playerIndex,
      x: fighter.x,
      y: fighter.y - 110,
      moveName: move.name
    });
  } else {
    state.events.push({
      type: 'whiff',
      playerIndex: fighter.playerIndex,
      x: fighter.x,
      y: fighter.y - 100,
      strength: move.hitSparkStrength,
      moveName: move.name
    });
  }
}

/**
 * Checks if `candidateMove` is allowed as a cancel from `currentMove` on `fighter`.
 */
function canCancelInto(
  fighter: FighterState,
  currentMove: MoveDef,
  candidateMove: MoveDef
): boolean {
  const f = fighter.moveFrame;
  const hitOrBlock = fighter.moveHitConnected || fighter.moveBlockedConnected;

  // During Tempest Overdrive, characters gain expanded cancel routes on hit/block!
  if (fighter.overdriveTimer > 0 && hitOrBlock) {
    if (currentMove.category === 'normal' || currentMove.category === 'command_normal') {
      if (
        candidateMove.category === 'normal' ||
        candidateMove.category === 'command_normal' ||
        candidateMove.category === 'special' ||
        candidateMove.category === 'ex_special' ||
        candidateMove.category === 'super' ||
        candidateMove.category === 'ultimate'
      ) {
        if (candidateMove.id !== currentMove.id) return true;
      }
    }
    if (currentMove.category === 'special' || currentMove.category === 'ex_special') {
      if (candidateMove.category === 'super' || candidateMove.category === 'ultimate') {
        return true;
      }
    }
  }

  for (const win of currentMove.cancelWindows) {
    if (f >= win.startFrame && f <= win.endFrame) {
      if (win.onHitOrBlockOnly && !hitOrBlock) continue;

      if (
        win.targets.includes('chain') &&
        candidateMove.category === 'normal' &&
        candidateMove.hitSparkStrength === 'light'
      ) {
        return true;
      }
      if (
        win.targets.includes('special') &&
        (candidateMove.category === 'special' || candidateMove.category === 'ex_special')
      ) {
        return true;
      }
      if (win.targets.includes('super') && candidateMove.category === 'super') {
        return true;
      }
      if (win.targets.includes('ultimate') && candidateMove.category === 'ultimate') {
        return true;
      }
    }
  }

  return false;
}

/**
 * Evaluates system actions (Pushblock, Guard Cancel, Overdrive, Parry) and Character Moves
 * from the fighter's input buffer.
 */
function tryTriggerActions(
  state: MatchState,
  fighter: FighterState,
  opponent: FighterState,
  charDef: CharacterDef
): boolean {
  const buf = fighter.inputBuffer;
  if (buf.length === 0) return false;

  const isAir = fighter.y < 0;
  const inNeutral =
    fighter.status === 'idle' ||
    fighter.status === 'walk_f' ||
    fighter.status === 'walk_b' ||
    fighter.status === 'crouch' ||
    fighter.status === 'dash_f';

  // 1. Blockstun Defensive Mechanics: Pushblock & Guard Cancel Blowback
  if (fighter.status === 'block_stand' || fighter.status === 'block_crouch') {
    // Guard Cancel Blowback: HP+HK (OVERDRIVE button) while blocking, costs 100 meter
    if (fighter.meter >= 100 && checkButtonBuffered(buf, 'OVERDRIVE', 5, false)) {
      fighter.meter -= 100;
      fighter.blockstunFrames = 0;
      fighter.invulnFrames = 14;
      fighter.status = 'overdrive_burst';
      fighter.statusFrame = 1;
      consumeBufferedInput(fighter);
      state.events.push({
        type: 'overdrive_burst',
        playerIndex: fighter.playerIndex,
        x: fighter.x,
        y: fighter.y - 100,
        text: 'GUARD CANCEL!'
      });
      return true;
    }

    // Pushblock (Advancing Guard): Press PP or PARRY while in blockstun
    if (
      checkButtonBuffered(buf, 'PP', 4, false) ||
      checkButtonBuffered(buf, 'PARRY', 4, false)
    ) {
      const pushDir = opponent.x >= fighter.x ? 1 : -1;
      applyPushbackWithCornerTransfer(fighter, opponent, pushDir * 135);
      consumeBufferedInput(fighter);
      state.events.push({
        type: 'pushblock',
        playerIndex: fighter.playerIndex,
        x: fighter.x + fighter.facing * 40,
        y: fighter.y - 105,
        text: 'PUSHBLOCK!'
      });
      return true;
    }
    return false;
  }

  // Only allow starting moves from neutral, jumping, or active cancel windows
  const inJumpNeutral = fighter.status === 'jump' || fighter.status === 'air_dash';
  const inAttack = fighter.status === 'attack' && fighter.currentMoveId !== null;
  if (!inNeutral && !inJumpNeutral && !inAttack) {
    return false;
  }

  const currentMove =
    inAttack && fighter.currentMoveId ? charDef.moves[fighter.currentMoveId] : null;

  // 2. Tempest Overdrive Activation (HP+HK on ground, costs 150 meter, once per round)
  if (
    !isAir &&
    (inNeutral || (currentMove && ( fighter.moveHitConnected || fighter.moveBlockedConnected))) &&
    fighter.meter >= 150 &&
    !fighter.overdriveUsedThisRound &&
    fighter.overdriveTimer <= 0 &&
    checkButtonBuffered(buf, 'OVERDRIVE', 5, false)
  ) {
    fighter.meter -= 150;
    fighter.overdriveUsedThisRound = true;
    fighter.overdriveTimer = 480; // 8 seconds of Overdrive!
    fighter.status = 'overdrive_burst';
    fighter.statusFrame = 1;
    fighter.currentMoveId = null;
    fighter.invulnFrames = 16;
    consumeBufferedInput(fighter);
    state.screenFreezeFrames = 16;
    state.announcementText = 'TEMPEST OVERDRIVE';
    state.announcementSubtext = `${charDef.name} // SYSTEM OVERCLOCK`;
    state.announcementTimer = 45;
    state.events.push({
      type: 'overdrive_burst',
      playerIndex: fighter.playerIndex,
      x: fighter.x,
      y: fighter.y - 105,
      text: 'OVERDRIVE!'
    });
    return true;
  }

  // 3. Cyber Parry (MP+MK on ground in neutral)
  if (!isAir && inNeutral && checkButtonBuffered(buf, 'PARRY', 4, false)) {
    fighter.status = 'parry_stance';
    fighter.statusFrame = 1;
    fighter.currentMoveId = null;
    fighter.vx = 0;
    consumeBufferedInput(fighter);
    return true;
  }

  // 4. Evaluate Character Moves in Priority Order
  const relDir = buf[0].relDir;
  const isCrouchingInput = relDir === 1 || relDir === 2 || relDir === 3;

  for (const moveId of charDef.moveOrder) {
    const move = charDef.moves[moveId];
    if (!move) continue;

    // Check posture compatibility
    if (move.posture === 'airborne' && !isAir) continue;
    if ((move.posture === 'standing' || move.posture === 'crouching') && isAir) continue;

    // For normals without motion, check standing vs crouching posture
    if (!move.motion && move.category === 'normal') {
      if (move.posture === 'crouching' && !isCrouchingInput) continue;
      if (move.posture === 'standing' && isCrouchingInput) continue;
    }

    // Check Command Normal / Back Throw directional requirement
    if (move.commandDir !== undefined) {
      if (move.commandDir === 6 && relDir !== 6) continue;
      if (move.commandDir === 4 && relDir !== 4) continue;
      if (move.commandDir === 3 && relDir !== 3) continue;
      if (move.commandDir === 2 && relDir !== 2) continue;
    } else if (move.category === 'normal' && move.posture === 'standing' && move.button === 'MP' && relDir === 6) {
      // Allow 6MP to take priority over 5MP
      continue;
    }

    // Check meter requirement
    if (fighter.meter < move.meterCost) continue;

    // Check Ultimate low-health requirement (<= 35% HP)
    if (move.requiresLowHealth && fighter.hp > fighter.maxHp * 0.35) continue;

    // If currently attacking, check cancel rules
    if (currentMove) {
      if (!canCancelInto(fighter, currentMove, move)) continue;
    }

    // Check button press/release
    const allowNegEdge =
      move.category === 'special' ||
      move.category === 'ex_special' ||
      move.category === 'super' ||
      move.category === 'ultimate';

    let buttonMatched = false;
    if (move.category === 'super') {
      // Super Art triggers on any single Punch or Kick with DQCF
      buttonMatched =
        checkButtonBuffered(buf, 'LP', 6, true) ||
        checkButtonBuffered(buf, 'MP', 6, true) ||
        checkButtonBuffered(buf, 'HP', 6, true);
    } else if (move.category === 'ultimate') {
      buttonMatched =
        checkButtonBuffered(buf, 'PP', 6, true) ||
        checkButtonBuffered(buf, 'KK', 6, true) ||
        checkButtonBuffered(buf, 'HP', 6, true);
    } else if (move.button) {
      buttonMatched = checkButtonBuffered(buf, move.button, 6, allowNegEdge);
    }

    if (!buttonMatched) continue;

    // Check motion input if required
    if (move.motion) {
      if (!checkMotionInput(fighter, move.motion)) continue;
    }

    // All conditions met! Start the move!
    startMove(state, fighter, move);
    return true;
  }

  return false;
}

/**
 * Applies horizontal pushback to `defender`, transferring excess pushback to `attacker`
 * when `defender` is pinned against the stage corner.
 */
function applyPushbackWithCornerTransfer(
  defender: FighterState,
  attacker: FighterState,
  signedDisplacement: number
): void {
  const targetX = defender.x + signedDisplacement;
  const clampedX = clamp(targetX, STAGE_LEFT_BOUND, STAGE_RIGHT_BOUND);
  const overflow = targetX - clampedX;
  defender.x = clampedX;

  if (Math.abs(overflow) > 0.01 && Math.abs(attacker.x - defender.x) < 260) {
    attacker.x = clamp(attacker.x - overflow * 0.85, STAGE_LEFT_BOUND, STAGE_RIGHT_BOUND);
  }
}

/**
 * Checks whether `defender` is holding block against an attack originating at `sourceX` with `hitLevel`.
 */
export function canBlockAttack(
  defender: FighterState,
  sourceX: number,
  hitLevel: MoveDef['hitLevel']
): { blocked: boolean; crouchBlock: boolean; isCrossUp: boolean } {
  if (hitLevel === 'throw' || hitLevel === 'unblockable') {
    return { blocked: false, crouchBlock: false, isCrossUp: false };
  }

  // Cannot block in air, during attack, hitstun, knockdown, parry, or dizzy
  const canBlockState =
    defender.y >= 0 &&
    (defender.status === 'idle' ||
      defender.status === 'walk_b' ||
      defender.status === 'walk_f' ||
      defender.status === 'crouch' ||
      defender.status === 'block_stand' ||
      defender.status === 'block_crouch');

  if (!canBlockState || defender.inputBuffer.length === 0) {
    return { blocked: false, crouchBlock: false, isCrossUp: false };
  }

  // Cross-up check: if attack source is behind the direction the defender is currently facing
  const attackDirFromDefender: 1 | -1 = sourceX >= defender.x ? 1 : -1;
  const isCrossUp = attackDirFromDefender !== defender.facing;

  // To block, the player must hold away from `attackDirFromDefender`
  // Raw numpad dir has 4/1/7 as Left (-1) and 6/3/9 as Right (+1)
  const rawDir = defender.inputBuffer[0].rawDir;
  const rawHoriz: -1 | 0 | 1 =
    rawDir === 1 || rawDir === 4 || rawDir === 7
      ? -1
      : rawDir === 3 || rawDir === 6 || rawDir === 9
      ? 1
      : 0;
  const isCrouching = rawDir === 1 || rawDir === 2 || rawDir === 3;

  const holdingAwayFromAttack = rawHoriz === -attackDirFromDefender;
  if (!holdingAwayFromAttack) {
    return { blocked: false, crouchBlock: false, isCrossUp };
  }

  if (hitLevel === 'low' && !isCrouching) {
    return { blocked: false, crouchBlock: false, isCrossUp };
  }
  if (hitLevel === 'overhead' && isCrouching) {
    return { blocked: false, crouchBlock: false, isCrossUp };
  }

  return { blocked: true, crouchBlock: isCrouching, isCrossUp };
}

/**
 * Resolves a strike or projectile connecting with a defender.
 */
function resolveStrikeHitOrBlock(opts: {
  state: MatchState;
  attacker: FighterState;
  defender: FighterState;
  sourceX: number;
  impactX: number;
  impactY: number;
  damage: number;
  chipDamage: number;
  stunDamage: number;
  hitstun: number;
  blockstun: number;
  hitstop: number;
  pushbackHit: number;
  pushbackBlock: number;
  hitLevel: MoveDef['hitLevel'];
  knockdown: MoveDef['knockdown'];
  launchVx?: number;
  launchVy?: number;
  juggleCost: number;
  juggleLimit: number;
  meterGainHit: number;
  meterGainBlock: number;
  sparkStrength: MoveDef['hitSparkStrength'];
  moveCategory: MoveDef['category'];
  moveName: string;
  trainingOpts?: TrainingSimulationOptions;
}): void {
  const { state, attacker, defender } = opts;

  // 1. Check Cyber Parry (active frames 1..10 of parry_stance)
  if (defender.status === 'parry_stance' && defender.statusFrame <= 10) {
    defender.status = 'parry_success';
    defender.statusFrame = 1;
    defender.invulnFrames = 14;
    addMeter(defender, 45);
    attacker.hitstopFrames = 16;
    defender.hitstopFrames = 4; // Defender recovers much faster for punish!
    state.events.push({
      type: 'parry',
      playerIndex: defender.playerIndex,
      x: opts.impactX,
      y: opts.impactY,
      text: 'PARRY!'
    });
    return;
  }

  // 2. Check Block
  const blockCheck = canBlockAttack(defender, opts.sourceX, opts.hitLevel);
  if (blockCheck.blocked) {
    // Blocked!
    let chip = opts.chipDamage;
    if (attacker.overdriveTimer > 0) {
      chip = Math.max(chip + 3, Math.round(opts.damage * 0.15));
    }
    // Chip damage cannot KO unless it's a Super or Ultimate, or leaves at 1 HP for normals/specials
    if (
      opts.moveCategory !== 'super' &&
      opts.moveCategory !== 'ultimate' &&
      defender.hp - chip <= 0
    ) {
      defender.hp = Math.max(1, defender.hp);
    } else {
      defender.hp = Math.max(0, defender.hp - chip);
    }

    defender.status = blockCheck.crouchBlock ? 'block_crouch' : 'block_stand';
    defender.statusFrame = 0;
    defender.currentMoveId = null;
    defender.blockstunFrames = opts.blockstun;
    attacker.hitstopFrames = opts.hitstop;
    defender.hitstopFrames = opts.hitstop;

    // Frame advantage calculation for Training HUD
    if (attacker.status === 'attack' && attacker.currentMoveId) {
      const attMove = CHARACTERS[attacker.charId].moves[attacker.currentMoveId];
      if (attMove) {
        const remainingAttFrames = Math.max(0, attMove.totalFrames - attacker.moveFrame);
        attacker.lastFrameAdvantage = opts.blockstun - remainingAttFrames;
      }
    }

    addMeter(attacker, opts.meterGainBlock);
    addMeter(defender, Math.round(opts.meterGainBlock * 0.65));

    const pushDir = defender.x >= attacker.x ? 1 : -1;
    applyPushbackWithCornerTransfer(defender, attacker, pushDir * opts.pushbackBlock);

    state.events.push({
      type: 'block',
      playerIndex: defender.playerIndex,
      x: opts.impactX,
      y: opts.impactY,
      strength: opts.sparkStrength
    });

    if (defender.hp <= 0) {
      triggerKO(state, attacker.playerIndex, opts.moveCategory);
    }
    return;
  }

  // 3. Check Armor
  const defChar = CHARACTERS[defender.charId];
  let hasActiveArmor = defender.armorHitsRemaining > 0;
  if (defender.status === 'attack' && defender.currentMoveId) {
    const defMove = defChar.moves[defender.currentMoveId];
    if (
      defMove?.armor &&
      defender.moveFrame >= defMove.armor.startFrame &&
      defender.moveFrame <= defMove.armor.endFrame &&
      defender.armorHitsRemaining > 0
    ) {
      hasActiveArmor = true;
    }
  }

  if (
    hasActiveArmor &&
    opts.moveCategory !== 'super' &&
    opts.moveCategory !== 'ultimate'
  ) {
    defender.armorHitsRemaining--;
    const armorDmg = Math.round(opts.damage * 0.5);
    defender.hp = Math.max(1, defender.hp - armorDmg);
    defender.whiteHpDelay = 35;
    attacker.hitstopFrames = opts.hitstop;
    defender.hitstopFrames = Math.max(3, opts.hitstop - 3);
    state.events.push({
      type: 'hit',
      playerIndex: attacker.playerIndex,
      x: opts.impactX,
      y: opts.impactY,
      strength: 'light',
      damage: armorDmg,
      text: 'ARMOR!'
    });
    return;
  }

  // 4. Clean Hit!
  const isCounterHit =
    opts.trainingOpts?.alwaysCounterHit ||
    (defender.status === 'attack' &&
      defender.currentMoveId !== null &&
      defender.moveFrame <= (defChar.moves[defender.currentMoveId]?.startup ?? 0) + 2);

  // Update combo counter and scaling on defender
  const wasInCombo =
    defender.status === 'hitstun_stand' ||
    defender.status === 'hitstun_crouch' ||
    defender.status === 'hitstun_air' ||
    defender.status === 'dizzy';

  if (wasInCombo) {
    defender.comboCounter++;
    defender.comboScaling = Math.max(0.2, 1.0 - (defender.comboCounter - 1) * 0.1);
  } else {
    defender.comboCounter = 1;
    defender.comboScaling = 1.0;
    defender.comboDamage = 0;
  }

  const minScale =
    opts.moveCategory === 'ultimate'
      ? 0.5
      : opts.moveCategory === 'super'
      ? 0.4
      : 0.2;
  const effectiveScale = Math.max(minScale, defender.comboScaling);

  let rawDmg = opts.damage;
  if (isCounterHit) rawDmg = Math.round(rawDmg * 1.15);
  if (attacker.overdriveTimer > 0) rawDmg = Math.round(rawDmg * 1.15);
  if (defender.overdriveTimer > 0) rawDmg = Math.round(rawDmg * 1.12);

  const finalDamage = Math.max(1, Math.round(rawDmg * effectiveScale));
  defender.hp = Math.max(0, defender.hp - finalDamage);
  defender.whiteHpDelay = 45;

  defender.comboDamage += finalDamage;
  defender.lastComboTotalHits = defender.comboCounter;
  defender.lastComboTotalDamage = defender.comboDamage;
  defender.comboDisplayTimer = 95;

  // Stun accumulation (unless already dizzy or noStun enabled)
  if (defender.status !== 'dizzy' && !opts.trainingOpts?.noStun) {
    const scaledStun = Math.round(opts.stunDamage * Math.max(0.35, effectiveScale));
    defender.stun = Math.min(defender.maxStun, defender.stun + scaledStun);
    defender.stunDecayTimer = 120;
  } else if (defender.status === 'dizzy') {
    // Hitting a dizzy opponent breaks dizzy state into standard combo scaling
    defender.stun = 0;
  }

  // Meter gain
  addMeter(attacker, opts.meterGainHit);
  addMeter(defender, Math.round(opts.meterGainHit * 0.55));

  // Hitstop & Screen Shake
  const bonusHitstop = isCounterHit ? 3 : 0;
  attacker.hitstopFrames = opts.hitstop + bonusHitstop;
  defender.hitstopFrames = opts.hitstop + bonusHitstop;

  state.screenShake = Math.max(
    state.screenShake,
    opts.sparkStrength === 'super'
      ? 14
      : opts.sparkStrength === 'heavy' || opts.sparkStrength === 'ex'
      ? 9
      : opts.sparkStrength === 'medium' || opts.sparkStrength === 'special'
      ? 5
      : 3
  );

  // Frame advantage calculation for Training HUD
  const effectiveHitstun = opts.hitstun + (isCounterHit ? 3 : 0);
  if (attacker.status === 'attack' && attacker.currentMoveId) {
    const attMove = CHARACTERS[attacker.charId].moves[attacker.currentMoveId];
    if (attMove) {
      const remainingAttFrames = Math.max(0, attMove.totalFrames - attacker.moveFrame);
      attacker.lastFrameAdvantage = effectiveHitstun - remainingAttFrames;
    }
  }

  // Face the attacker when hit
  defender.facing = attacker.x >= defender.x ? 1 : -1;
  defender.currentMoveId = null;

  const pushDir = defender.x >= attacker.x ? 1 : -1;
  const isDefenderAir = defender.y < 0 || defender.status === 'hitstun_air';

  if (
    opts.knockdown === 'launch' ||
    opts.knockdown === 'hard' ||
    opts.knockdown === 'soft' ||
    isDefenderAir
  ) {
    // Launch / Juggle / Knockdown trajectory
    defender.jugglePoints += opts.juggleCost;
    defender.status = 'hitstun_air';
    defender.statusFrame = 0;
    defender.hitstunFrames = Math.max(effectiveHitstun, 26);
    defender.knockdownType = opts.knockdown === 'hard' ? 'hard' : 'soft';
    const lvx = opts.launchVx ?? 4.2;
    const lvy = opts.launchVy ?? -7.5;
    defender.vx = pushDir * lvx;
    defender.vy = lvy;
    if (defender.y >= 0) {
      defender.y = -2; // lift off ground so airborne physics apply
    }
  } else {
    // Grounded hitstun
    const wasCrouching =
      defender.status === 'crouch' || defender.status === 'hitstun_crouch';
    defender.status = wasCrouching ? 'hitstun_crouch' : 'hitstun_stand';
    defender.statusFrame = 0;
    defender.hitstunFrames = effectiveHitstun;
    defender.vx = 0;
    applyPushbackWithCornerTransfer(defender, attacker, pushDir * opts.pushbackHit);
  }

  state.events.push({
    type: 'hit',
    playerIndex: attacker.playerIndex,
    x: opts.impactX,
    y: opts.impactY,
    strength: opts.sparkStrength,
    damage: finalDamage,
    moveName: opts.moveName,
    isCounter: isCounterHit,
    isCrossUp: blockCheck.isCrossUp
  });

  if (defender.hp <= 0) {
    triggerKO(state, attacker.playerIndex, opts.moveCategory);
  }
}

function triggerKO(
  state: MatchState,
  winnerPlayerIndex: 0 | 1 | -1,
  moveCategory?: MoveDef['category']
): void {
  if (state.phase !== 'fight') return;

  const f0Dead = state.fighters[0].hp <= 0;
  const f1Dead = state.fighters[1].hp <= 0;

  if (f0Dead && f1Dead) {
    state.winnerIndex = -1;
    state.p1RoundsWon++;
    state.p2RoundsWon++;
    state.finishType = 'DOUBLE_KO';
    state.announcementText = 'DOUBLE K.O.';
    state.announcementSubtext = 'SIMULTANEOUS NEUTRALIZATION';
  } else {
    const winIdx = f0Dead ? 1 : f1Dead ? 0 : winnerPlayerIndex;
    state.winnerIndex = winIdx;
    if (winIdx === 0) state.p1RoundsWon++;
    if (winIdx === 1) state.p2RoundsWon++;

    const winner = winIdx === 0 || winIdx === 1 ? state.fighters[winIdx] : null;
    const isPerfect = winner !== null && winner.hp === winner.maxHp;

    if (isPerfect) {
      state.finishType = 'PERFECT';
      state.announcementText = 'PERFECT K.O.';
      state.announcementSubtext = 'FLAWLESS EXECUTION';
    } else if (moveCategory === 'ultimate') {
      state.finishType = 'ULTIMATE_KO';
      state.announcementText = 'ULTIMATE K.O.';
      state.announcementSubtext = 'CRITICAL PROTOCOL COMPLETE';
    } else if (moveCategory === 'super') {
      state.finishType = 'SUPER_KO';
      state.announcementText = 'HYPER K.O.';
      state.announcementSubtext = 'OVERDRIVE FINISH';
    } else {
      state.finishType = 'KO';
      state.announcementText = 'K.O.';
      state.announcementSubtext = `${winner ? CHARACTERS[winner.charId].name : ''} DOMINATES`;
    }
  }

  state.phase = 'ko_slowmo';
  state.phaseFrame = 0;
  state.slowMoFrames = 45;
  state.announcementTimer = 110;
  state.screenShake = 16;

  // Launch defeated fighters into dramatic knockdown arc
  for (const f of state.fighters) {
    if (f.hp <= 0) {
      f.status = 'hitstun_air';
      f.knockdownType = 'hard';
      f.vx = -f.facing * 6.5;
      f.vy = -9.5;
      if (f.y >= 0) f.y = -2;
    }
  }

  state.events.push({
    type: 'ko',
    playerIndex: winnerPlayerIndex === 1 ? 1 : 0,
    x: (state.fighters[0].x + state.fighters[1].x) * 0.5,
    y: -100,
    text: state.announcementText
  });
}

/**
 * Advances a single fighter's physics, timers, and state transitions by 1 simulation frame.
 */
function updateFighterMovementAndState(
  state: MatchState,
  fighter: FighterState,
  opponent: FighterState,
  charDef: CharacterDef,
  trainingOpts?: TrainingSimulationOptions
): void {
  fighter.statusFrame++;

  // Update Overdrive timer
  if (fighter.overdriveTimer > 0) {
    fighter.overdriveTimer--;
  }

  // Update invulnerability timers
  if (fighter.invulnFrames > 0) fighter.invulnFrames--;
  if (fighter.throwInvulnFrames > 0) fighter.throwInvulnFrames--;

  // Update White HP recovery trail
  if (fighter.whiteHp > fighter.hp) {
    if (fighter.whiteHpDelay > 0) {
      fighter.whiteHpDelay--;
    } else {
      fighter.whiteHp = Math.max(fighter.hp, fighter.whiteHp - 3.5);
    }
  } else {
    fighter.whiteHp = fighter.hp;
  }

  // Update Stun decay when not in hitstun/dizzy
  const inHitstun =
    fighter.status === 'hitstun_stand' ||
    fighter.status === 'hitstun_crouch' ||
    fighter.status === 'hitstun_air';
  if (!inHitstun && fighter.status !== 'dizzy' && fighter.stun > 0) {
    if (fighter.stunDecayTimer > 0) {
      fighter.stunDecayTimer--;
    } else {
      fighter.stun = Math.max(0, fighter.stun - 4);
    }
  }

  // Update Combo display timer
  if (!inHitstun && fighter.comboDisplayTimer > 0) {
    fighter.comboDisplayTimer--;
  }

  // Training mode regenerations when fighter returns to neutral
  const isNeutral =
    fighter.status === 'idle' ||
    fighter.status === 'walk_f' ||
    fighter.status === 'walk_b' ||
    fighter.status === 'crouch';
  if (isNeutral) {
    fighter.jugglePoints = 0;
    if (trainingOpts?.infiniteHealth && fighter.hp < fighter.maxHp) {
      fighter.hp = fighter.maxHp;
      fighter.whiteHp = fighter.maxHp;
    }
    if (trainingOpts?.infiniteMeter) {
      fighter.meter = 300;
    }
  }

  // Auto-face opponent when grounded in neutral
  if (fighter.y >= 0 && isNeutral) {
    if (Math.abs(opponent.x - fighter.x) > 4) {
      fighter.facing = opponent.x >= fighter.x ? 1 : -1;
    }
  }

  const speedMult = fighter.overdriveTimer > 0 ? 1.12 : 1.0;
  const buf = fighter.inputBuffer;
  const relDir = buf.length > 0 ? buf[0].relDir : 5;

  switch (fighter.status) {
    case 'idle':
    case 'walk_f':
    case 'walk_b':
    case 'crouch': {
      // Check dash input first
      const dashDir = checkDashInput(buf);
      if (dashDir === 'forward') {
        fighter.status = 'dash_f';
        fighter.statusFrame = 1;
        fighter.vx = fighter.facing * charDef.dashForwardVx * speedMult;
        state.events.push({
          type: 'dash',
          playerIndex: fighter.playerIndex,
          x: fighter.x,
          y: fighter.y
        });
        break;
      } else if (dashDir === 'backward') {
        fighter.status = 'dash_b';
        fighter.statusFrame = 1;
        fighter.vx = fighter.facing * charDef.dashBackwardVx * speedMult;
        fighter.vy = charDef.dashBackwardVy;
        fighter.invulnFrames = 6; // Airborne/invulnerable startup on backdash!
        state.events.push({
          type: 'dash',
          playerIndex: fighter.playerIndex,
          x: fighter.x,
          y: fighter.y
        });
        break;
      }

      // Check Jump input (7, 8, 9)
      if (relDir === 7 || relDir === 8 || relDir === 9) {
        fighter.status = 'prejump';
        fighter.statusFrame = 1;
        fighter.throwInvulnFrames = charDef.preJumpFrames + 2;
        fighter.pendingJumpDir = relDir === 9 ? 1 : relDir === 7 ? -1 : 0;
        fighter.vx = 0;
        break;
      }

      // Check Crouch (1, 2, 3)
      if (relDir === 1 || relDir === 2 || relDir === 3) {
        fighter.status = 'crouch';
        fighter.vx = 0;
      } else if (relDir === 6) {
        fighter.status = 'walk_f';
        fighter.vx = fighter.facing * charDef.walkForwardSpeed * speedMult;
        addMeter(fighter, 0.08);
      } else if (relDir === 4) {
        fighter.status = 'walk_b';
        fighter.vx = -fighter.facing * charDef.walkBackwardSpeed * speedMult;
      } else {
        fighter.status = 'idle';
        fighter.vx = 0;
      }
      break;
    }

    case 'prejump': {
      if (fighter.statusFrame >= charDef.preJumpFrames) {
        fighter.status = 'jump';
        fighter.statusFrame = 1;
        fighter.vx = fighter.facing * fighter.pendingJumpDir * charDef.jumpVx * speedMult;
        fighter.vy = charDef.jumpVy;
        fighter.y = -1;
        fighter.airJumpsLeft = charDef.maxAirJumps;
        fighter.airDashesLeft = charDef.maxAirDashes;
        state.events.push({
          type: 'jump',
          playerIndex: fighter.playerIndex,
          x: fighter.x,
          y: 0
        });
      }
      break;
    }

    case 'jump': {
      // Check Air Dash (if character has airDashesLeft > 0 and is high enough)
      if (fighter.airDashesLeft > 0 && fighter.y < -60 && fighter.statusFrame > 5) {
        const dashDir = checkDashInput(buf);
        if (dashDir === 'forward' || dashDir === 'backward') {
          fighter.airDashesLeft--;
          fighter.status = 'air_dash';
          fighter.statusFrame = 1;
          const mult = dashDir === 'forward' ? 1 : -0.85;
          fighter.vx = fighter.facing * charDef.airDashVx * mult;
          fighter.vy = 0;
          state.events.push({
            type: 'dash',
            playerIndex: fighter.playerIndex,
            x: fighter.x,
            y: fighter.y
          });
          break;
        }
      }

      // Check Double Jump (if character has airJumpsLeft > 0 and just pressed Up)
      if (
        fighter.airJumpsLeft > 0 &&
        fighter.statusFrame > 8 &&
        buf.length >= 2 &&
        (relDir === 7 || relDir === 8 || relDir === 9) &&
        buf[1].relDir !== 7 &&
        buf[1].relDir !== 8 &&
        buf[1].relDir !== 9
      ) {
        fighter.airJumpsLeft--;
        const jDir = relDir === 9 ? 1 : relDir === 7 ? -1 : 0;
        fighter.vx = fighter.facing * jDir * charDef.jumpVx;
        fighter.vy = charDef.jumpVy * 0.9;
        state.events.push({
          type: 'jump',
          playerIndex: fighter.playerIndex,
          x: fighter.x,
          y: fighter.y
        });
      }
      break;
    }

    case 'air_dash': {
      if (fighter.statusFrame >= charDef.airDashFrames) {
        fighter.status = 'jump';
        fighter.statusFrame = 10;
        fighter.vx *= 0.65;
      }
      break;
    }

    case 'dash_f': {
      if (fighter.statusFrame >= charDef.dashForwardFrames) {
        fighter.status = 'idle';
        fighter.statusFrame = 0;
        fighter.vx = 0;
      }
      break;
    }

    case 'dash_b': {
      if (fighter.statusFrame >= charDef.dashBackwardFrames) {
        fighter.status = 'idle';
        fighter.statusFrame = 0;
        fighter.vx = 0;
        fighter.y = 0;
        fighter.vy = 0;
      }
      break;
    }

    case 'parry_stance': {
      if (fighter.statusFrame >= 22) {
        fighter.status = 'idle';
        fighter.statusFrame = 0;
      }
      break;
    }

    case 'parry_success': {
      if (fighter.statusFrame >= 8) {
        fighter.status = 'idle';
        fighter.statusFrame = 0;
      }
      break;
    }

    case 'overdrive_burst': {
      if (fighter.statusFrame >= 18) {
        fighter.status = 'idle';
        fighter.statusFrame = 0;
      }
      break;
    }

    case 'attack': {
      const move = fighter.currentMoveId ? charDef.moves[fighter.currentMoveId] : null;
      if (!move) {
        fighter.status = fighter.y < 0 ? 'jump' : 'idle';
        break;
      }

      // Apply movement pulses defined on the move
      if (move.movement) {
        for (const pulse of move.movement) {
          if (fighter.moveFrame >= pulse.startFrame && fighter.moveFrame <= pulse.endFrame) {
            if (pulse.vx !== undefined) {
              fighter.vx = fighter.facing * pulse.vx;
            }
            if (pulse.vy !== undefined && fighter.moveFrame === pulse.startFrame) {
              fighter.vy = pulse.vy;
              if (pulse.vy < 0 && fighter.y >= 0) {
                fighter.y = -1;
              }
            }
            if (pulse.teleportOffsetX && fighter.moveFrame === pulse.startFrame) {
              fighter.x = clamp(
                fighter.x + fighter.facing * pulse.teleportOffsetX,
                STAGE_LEFT_BOUND,
                STAGE_RIGHT_BOUND
              );
            }
            if (pulse.teleportBehindOpponent && fighter.moveFrame === pulse.startFrame) {
              const behindX = opponent.x + opponent.facing * 85;
              fighter.x = clamp(behindX, STAGE_LEFT_BOUND, STAGE_RIGHT_BOUND);
              fighter.facing = opponent.x >= fighter.x ? 1 : -1;
            }
          } else if (fighter.moveFrame === pulse.endFrame + 1 && pulse.vx !== undefined && fighter.y >= 0) {
            fighter.vx *= 0.25;
          }
        }
      }

      // Spawn projectile on designated frame
      if (move.projectile && fighter.moveFrame === move.projectile.spawnFrame) {
        const pDef = move.projectile;
        const spawnX = fighter.x + fighter.facing * pDef.offsetX;
        const spawnY = fighter.y + pDef.offsetY;
        const proj: ActiveProjectile = {
          uid: state.nextProjectileUid++,
          ownerIndex: fighter.playerIndex,
          defId: pDef.id,
          name: pDef.name,
          x: spawnX,
          y: spawnY,
          prevX: spawnX,
          prevY: spawnY,
          vx: fighter.facing * pDef.vx,
          vy: pDef.vy,
          ax: pDef.ax ?? 0,
          ay: pDef.ay ?? 0,
          facing: fighter.facing,
          width: pDef.width,
          height: pDef.height,
          damage: pDef.damage,
          chipDamage: pDef.chipDamage,
          stunDamage: pDef.stunDamage,
          hitstun: pDef.hitstun,
          blockstun: pDef.blockstun,
          hitstop: pDef.hitstop,
          pushbackHit: pDef.pushbackHit,
          pushbackBlock: pDef.pushbackBlock,
          hitLevel: pDef.hitLevel,
          knockdown: pDef.knockdown,
          launchVx: pDef.launchVx ?? 0,
          launchVy: pDef.launchVy ?? 0,
          hitsRemaining: pDef.hits,
          hitCooldown: 0,
          age: 0,
          lifetime: pDef.lifetime,
          color: pDef.color,
          coreColor: pDef.coreColor,
          style: pDef.style
        };
        state.projectiles.push(proj);
        state.events.push({
          type: 'projectile_spawn',
          playerIndex: fighter.playerIndex,
          x: spawnX,
          y: spawnY,
          moveName: pDef.name
        });
      }

      // Resolve active throw grab after tech window expires
      if (fighter.throwTargetIndex !== null && fighter.throwTechWindow > 0) {
        fighter.throwTechWindow--;
        // Check if opponent techs the throw (only normal throws can be teched; 360 command grabs are untechable!)
        const isNormalThrow = move.category === 'throw';
        if (
          isNormalThrow &&
          checkButtonBuffered(opponent.inputBuffer, 'THROW', 5, false)
        ) {
          // THROW TECH!
          fighter.throwTargetIndex = null;
          fighter.throwTechWindow = 0;
          fighter.status = 'idle';
          fighter.currentMoveId = null;
          fighter.vx = -fighter.facing * 8.5;

          opponent.status = 'idle';
          opponent.currentMoveId = null;
          opponent.vx = -opponent.facing * 8.5;
          opponent.throwInvulnFrames = 14;
          fighter.throwInvulnFrames = 14;
          consumeBufferedInput(opponent);
          consumeBufferedInput(fighter);

          state.events.push({
            type: 'throw_tech',
            playerIndex: opponent.playerIndex,
            x: (fighter.x + opponent.x) * 0.5,
            y: -115,
            text: 'THROW TECH!'
          });
          break;
        }

        if (fighter.throwTechWindow === 0) {
          // Execute the throw slam!
          fighter.throwTargetIndex = null;
          if (move.swapSidesOnHit) {
            const oldX = fighter.x;
            fighter.x = opponent.x;
            opponent.x = clamp(oldX - fighter.facing * 60, STAGE_LEFT_BOUND, STAGE_RIGHT_BOUND);
            fighter.facing = (fighter.facing * -1) as 1 | -1;
            opponent.facing = (opponent.facing * -1) as 1 | -1;
          }
          const slamDmg =
            fighter.overdriveTimer > 0 ? Math.round(move.damage * 1.15) : move.damage;
          opponent.hp = Math.max(0, opponent.hp - slamDmg);
          opponent.whiteHpDelay = 45;
          opponent.comboCounter = 1;
          opponent.comboDamage = slamDmg;
          opponent.lastComboTotalHits = 1;
          opponent.lastComboTotalDamage = slamDmg;
          opponent.comboDisplayTimer = 95;
          if (!trainingOpts?.noStun) {
            opponent.stun = Math.min(opponent.maxStun, opponent.stun + move.stunDamage);
            opponent.stunDecayTimer = 120;
          }
          addMeter(fighter, move.meterGainHit);
          opponent.status = 'hitstun_air';
          opponent.knockdownType = 'hard';
          opponent.vx = fighter.facing * (move.launchVx ?? 7.5);
          opponent.vy = move.launchVy ?? -8.0;
          opponent.y = -4;
          state.screenShake = 12;

          state.events.push({
            type: 'throw_slam',
            playerIndex: fighter.playerIndex,
            x: opponent.x,
            y: -90,
            strength: 'throw',
            damage: slamDmg,
            moveName: move.name
          });

          if (opponent.hp <= 0) {
            triggerKO(state, fighter.playerIndex, move.category);
          }
        }
      }

      fighter.moveFrame++;
      if (fighter.moveFrame > move.totalFrames) {
        fighter.currentMoveId = null;
        fighter.moveFrame = 0;
        fighter.armorHitsRemaining = 0;
        fighter.status = fighter.y < 0 ? 'jump' : 'idle';
        fighter.statusFrame = 0;
        if (fighter.y >= 0) fighter.vx = 0;
      }
      break;
    }

    case 'block_stand':
    case 'block_crouch': {
      fighter.blockstunFrames--;
      fighter.vx *= 0.7;
      if (fighter.blockstunFrames <= 0) {
        fighter.status =
          relDir === 1 || relDir === 2 || relDir === 3 ? 'crouch' : 'idle';
        fighter.statusFrame = 0;
        fighter.vx = 0;
      }
      break;
    }

    case 'hitstun_stand':
    case 'hitstun_crouch': {
      fighter.hitstunFrames--;
      fighter.vx *= 0.75;
      if (fighter.hitstunFrames <= 0) {
        if (fighter.stun >= fighter.maxStun && fighter.hp > 0) {
          fighter.status = 'dizzy';
          fighter.statusFrame = 1;
          fighter.stun = 0;
          fighter.comboCounter = 0;
          state.events.push({
            type: 'dizzy',
            playerIndex: fighter.playerIndex,
            x: fighter.x,
            y: fighter.y - 165,
            text: 'STUNNED!'
          });
        } else {
          fighter.status =
            relDir === 1 || relDir === 2 || relDir === 3 ? 'crouch' : 'idle';
          fighter.statusFrame = 0;
          fighter.comboCounter = 0;
          fighter.comboScaling = 1.0;
        }
      }
      break;
    }

    case 'hitstun_air': {
      fighter.hitstunFrames--;
      // Air recovery (Air Tech) if hitstun expires while airborne on a soft knockdown
      if (
        fighter.hitstunFrames <= 0 &&
        fighter.y < -30 &&
        fighter.knockdownType !== 'hard' &&
        fighter.hp > 0
      ) {
        const anyBtn =
          buf.length > 0 &&
          (buf[0].held & (PUNCH_MASK | KICK_MASK)) !== 0;
        if (anyBtn) {
          fighter.status = 'jump';
          fighter.statusFrame = 10;
          fighter.vy = -5.5;
          fighter.invulnFrames = 10;
          fighter.comboCounter = 0;
          fighter.comboScaling = 1.0;
          fighter.jugglePoints = 0;
        }
      }
      break;
    }

    case 'knockdown': {
      fighter.knockdownFrames--;
      fighter.vx *= 0.8;
      // Check Quick Rise on soft knockdown during first 10 frames on ground
      if (
        fighter.quickRiseAvailable &&
        fighter.statusFrame <= 10 &&
        fighter.hp > 0 &&
        buf.length > 0
      ) {
        const downOrBtns =
          relDir === 2 ||
          countBits(buf[0].pressed & (PUNCH_MASK | KICK_MASK)) >= 1;
        if (downOrBtns) {
          fighter.quickRiseAvailable = false;
          fighter.usedQuickRise = true;
          fighter.knockdownFrames = 6;
          state.events.push({
            type: 'quick_rise',
            playerIndex: fighter.playerIndex,
            x: fighter.x,
            y: 0,
            text: 'QUICK RISE'
          });
        }
      }

      if (fighter.knockdownFrames <= 0 && fighter.hp > 0) {
        fighter.status = 'wakeup';
        fighter.statusFrame = 1;
        fighter.invulnFrames = 6;
        fighter.throwInvulnFrames = 9;
        fighter.facing = opponent.x >= fighter.x ? 1 : -1;
      }
      break;
    }

    case 'wakeup': {
      if (fighter.statusFrame >= 8) {
        if (fighter.stun >= fighter.maxStun && fighter.hp > 0) {
          fighter.status = 'dizzy';
          fighter.statusFrame = 1;
          fighter.stun = 0;
          fighter.comboCounter = 0;
          state.events.push({
            type: 'dizzy',
            playerIndex: fighter.playerIndex,
            x: fighter.x,
            y: fighter.y - 165,
            text: 'STUNNED!'
          });
        } else {
          fighter.status = 'idle';
          fighter.statusFrame = 0;
          fighter.comboCounter = 0;
          fighter.comboScaling = 1.0;
          fighter.jugglePoints = 0;
        }
      }
      break;
    }

    case 'dizzy': {
      fighter.vx = 0;
      if (fighter.statusFrame >= 135) {
        fighter.status = 'idle';
        fighter.statusFrame = 0;
        fighter.stun = 0;
      }
      break;
    }
  }

  // Integrate horizontal & vertical velocity
  fighter.x += fighter.vx;

  if (fighter.y < 0 || fighter.vy < 0) {
    fighter.y += fighter.vy;
    if (fighter.status !== 'air_dash') {
      fighter.vy += charDef.gravity;
    }

    // Landing check
    if (fighter.y >= 0) {
      fighter.y = 0;
      fighter.vy = 0;
      fighter.airJumpsLeft = charDef.maxAirJumps;
      fighter.airDashesLeft = charDef.maxAirDashes;

      if (fighter.status === 'hitstun_air') {
        if (fighter.hp <= 0) {
          fighter.status = 'defeat';
          fighter.vx = 0;
        } else {
          fighter.status = 'knockdown';
          fighter.statusFrame = 1;
          fighter.knockdownFrames = fighter.knockdownType === 'hard' ? 32 : 20;
          fighter.quickRiseAvailable = fighter.knockdownType === 'soft';
          fighter.usedQuickRise = false;
          fighter.comboCounter = 0;
          fighter.comboScaling = 1.0;
          fighter.jugglePoints = 0;
          state.screenShake = Math.max(state.screenShake, 6);
          state.events.push({
            type: 'knockdown',
            playerIndex: fighter.playerIndex,
            x: fighter.x,
            y: 0
          });
        }
      } else {
        // Normal landing from jump or air move
        fighter.currentMoveId = null;
        fighter.moveFrame = 0;
        fighter.status = 'idle';
        fighter.statusFrame = 0;
        fighter.vx = 0;
        fighter.facing = opponent.x >= fighter.x ? 1 : -1;
        state.events.push({
          type: 'land',
          playerIndex: fighter.playerIndex,
          x: fighter.x,
          y: 0
        });
      }
    }
  }

  // Clamp to stage boundaries
  fighter.x = clamp(fighter.x, STAGE_LEFT_BOUND, STAGE_RIGHT_BOUND);
}

/**
 * Resolves pushbox overlap so the two fighters never occupy the exact same horizontal coordinate,
 * including corner push-out logic.
 */
function resolvePushboxCollision(f0: FighterState, f1: FighterState): void {
  const b0 = getFighterBoxes(f0).pushbox;
  const b1 = getFighterBoxes(f1).pushbox;

  if (!boxesOverlap(b0, b1)) return;

  const overlapLeft = b0.x + b0.w - b1.x;
  const overlapRight = b1.x + b1.w - b0.x;
  const overlap = Math.min(overlapLeft, overlapRight);
  if (overlap <= 0) return;

  // Determine direction to separate
  let dir = f0.x < f1.x ? -1 : f0.x > f1.x ? 1 : f0.playerIndex === 0 ? -1 : 1;
  const half = overlap * 0.5 + 0.5;

  f0.x = clamp(f0.x + dir * half, STAGE_LEFT_BOUND, STAGE_RIGHT_BOUND);
  f1.x = clamp(f1.x - dir * half, STAGE_LEFT_BOUND, STAGE_RIGHT_BOUND);

  // Re-check if one is pinned in the corner, push the other out fully
  const b0After = getFighterBoxes(f0).pushbox;
  const b1After = getFighterBoxes(f1).pushbox;
  if (boxesOverlap(b0After, b1After)) {
    const rem = Math.min(b0After.x + b0After.w - b1After.x, b1After.x + b1After.w - b0After.x);
    if (Math.abs(f0.x - STAGE_LEFT_BOUND) < 2) {
      f1.x = clamp(f1.x + rem, STAGE_LEFT_BOUND, STAGE_RIGHT_BOUND);
    } else if (Math.abs(f0.x - STAGE_RIGHT_BOUND) < 2) {
      f1.x = clamp(f1.x - rem, STAGE_LEFT_BOUND, STAGE_RIGHT_BOUND);
    } else if (Math.abs(f1.x - STAGE_LEFT_BOUND) < 2) {
      f0.x = clamp(f0.x + rem, STAGE_LEFT_BOUND, STAGE_RIGHT_BOUND);
    } else if (Math.abs(f1.x - STAGE_RIGHT_BOUND) < 2) {
      f0.x = clamp(f0.x - rem, STAGE_LEFT_BOUND, STAGE_RIGHT_BOUND);
    }
  }
}

/**
 * Updates active projectiles, projectile-vs-projectile clashes, and projectile-vs-fighter hits.
 */
function updateProjectiles(
  state: MatchState,
  trainingOpts?: TrainingSimulationOptions
): void {
  const projs = state.projectiles;
  for (let i = projs.length - 1; i >= 0; i--) {
    const p = projs[i];
    p.prevX = p.x;
    p.prevY = p.y;
    p.age++;
    if (p.hitCooldown > 0) p.hitCooldown--;

    p.vx += p.ax;
    p.vy += p.ay;
    p.x += p.vx;
    p.y += p.vy;

    if (
      p.age > p.lifetime ||
      p.hitsRemaining <= 0 ||
      p.x < STAGE_LEFT_BOUND - 160 ||
      p.x > STAGE_RIGHT_BOUND + 160
    ) {
      projs.splice(i, 1);
    }
  }

  // Projectile vs Projectile clash
  for (let i = 0; i < projs.length; i++) {
    for (let j = i + 1; j < projs.length; j++) {
      const a = projs[i];
      const b = projs[j];
      if (a.ownerIndex === b.ownerIndex) continue;
      if (a.hitsRemaining <= 0 || b.hitsRemaining <= 0) continue;

      const boxA: Box = {
        x: a.x - a.width * 0.5,
        y: a.y - a.height * 0.5,
        w: a.width,
        h: a.height
      };
      const boxB: Box = {
        x: b.x - b.width * 0.5,
        y: b.y - b.height * 0.5,
        w: b.width,
        h: b.height
      };

      if (boxesOverlap(boxA, boxB)) {
        a.hitsRemaining--;
        b.hitsRemaining--;
        state.events.push({
          type: 'projectile_clash',
          playerIndex: a.ownerIndex,
          x: (a.x + b.x) * 0.5,
          y: (a.y + b.y) * 0.5
        });
      }
    }
  }

  // Projectile vs Fighter
  for (let i = projs.length - 1; i >= 0; i--) {
    const p = projs[i];
    if (p.hitsRemaining <= 0 || p.hitCooldown > 0) continue;

    const targetIdx: 0 | 1 = p.ownerIndex === 0 ? 1 : 0;
    const attacker = state.fighters[p.ownerIndex];
    const defender = state.fighters[targetIdx];
    const defChar = CHARACTERS[defender.charId];

    if (isFighterInvulnerableTo(defender, defChar, 'projectile')) continue;

    const pBox: Box = {
      x: p.x - p.width * 0.5,
      y: p.y - p.height * 0.5,
      w: p.width,
      h: p.height
    };
    const defBoxes = getFighterBoxes(defender, defChar);

    // Check parry even before hurtbox overlap if close
    const parryBox = defBoxes.pushbox;
    const hitParry =
      defender.status === 'parry_stance' &&
      defender.statusFrame <= 10 &&
      boxesOverlap(pBox, parryBox);

    let hitHurtbox = hitParry;
    if (!hitHurtbox) {
      for (const hb of defBoxes.hurtboxes) {
        if (boxesOverlap(pBox, hb)) {
          hitHurtbox = true;
          break;
        }
      }
    }

    if (hitHurtbox) {
      if (
        defender.y < 0 &&
        defender.status === 'hitstun_air' &&
        defender.jugglePoints > 3
      ) {
        continue;
      }

      p.hitsRemaining--;
      p.hitCooldown = 6;

      resolveStrikeHitOrBlock({
        state,
        attacker,
        defender,
        sourceX: p.x,
        impactX: p.x,
        impactY: p.y,
        damage: p.damage,
        chipDamage: p.chipDamage,
        stunDamage: p.stunDamage,
        hitstun: p.hitstun,
        blockstun: p.blockstun,
        hitstop: p.hitstop,
        pushbackHit: p.pushbackHit,
        pushbackBlock: p.pushbackBlock,
        hitLevel: p.hitLevel,
        knockdown: p.knockdown,
        launchVx: p.launchVx,
        launchVy: p.launchVy,
        juggleCost: 1,
        juggleLimit: 3,
        meterGainHit: 12,
        meterGainBlock: 6,
        sparkStrength: p.hitsRemaining > 0 ? 'ex' : 'special',
        moveCategory: 'special',
        moveName: p.name,
        trainingOpts
      });
    }
  }
}

/**
 * Checks melee hitboxes and throwboxes for both fighters simultaneously (supporting trades!).
 */
function resolveMeleeCombat(
  state: MatchState,
  trainingOpts?: TrainingSimulationOptions
): void {
  const f0 = state.fighters[0];
  const f1 = state.fighters[1];
  const c0 = CHARACTERS[f0.charId];
  const c1 = CHARACTERS[f1.charId];

  const boxes0 = getFighterBoxes(f0, c0);
  const boxes1 = getFighterBoxes(f1, c1);

  // 1. Check Throwboxes (f0 throwing f1, or f1 throwing f0)
  for (const [attacker, defender, attChar, defChar, attBoxes, defBoxes] of [
    [f0, f1, c0, c1, boxes0, boxes1] as const,
    [f1, f0, c1, c0, boxes1, boxes0] as const
  ]) {
    if (
      attBoxes.throwbox &&
      attacker.status === 'attack' &&
      attacker.currentMoveId &&
      !attacker.moveHitConnected
    ) {
      const move = attChar.moves[attacker.currentMoveId];
      if (!move) continue;
      if (isFighterInvulnerableTo(defender, defChar, 'throw')) continue;

      if (boxesOverlap(attBoxes.throwbox, defBoxes.pushbox)) {
        attacker.moveHitConnected = true;
        attacker.throwTargetIndex = defender.playerIndex;
        // Normal throws give 7-frame tech window; 360 command grabs give 1-frame immediate slam!
        attacker.throwTechWindow = move.category === 'throw' ? 7 : 1;
        defender.status = 'thrown';
        defender.statusFrame = 1;
        defender.currentMoveId = null;
        defender.vx = 0;
        defender.vy = 0;
        defender.x = attacker.x + attacker.facing * 56;

        state.events.push({
          type: 'throw_start',
          playerIndex: attacker.playerIndex,
          x: (attacker.x + defender.x) * 0.5,
          y: -110,
          moveName: move.name
        });
        return; // Throw locks both fighters
      }
    }
  }

  // 2. Check Strike Hitboxes (evaluate both before applying so trades can happen cleanly!)
  interface PendingHit {
    attacker: FighterState;
    defender: FighterState;
    move: MoveDef;
    impactX: number;
    impactY: number;
  }
  const pendingHits: PendingHit[] = [];

  for (const [attacker, defender, attChar, defChar, attBoxes, defBoxes] of [
    [f0, f1, c0, c1, boxes0, boxes1] as const,
    [f1, f0, c1, c0, boxes1, boxes0] as const
  ]) {
    if (attBoxes.hitboxes.length === 0) continue;

    // Handle Overdrive Burst shockwave hitbox
    if (attacker.status === 'overdrive_burst' && !attacker.moveHitConnected) {
      for (const hb of attBoxes.hitboxes) {
        if (boxesOverlap(hb, defBoxes.pushbox)) {
          attacker.moveHitConnected = true;
          const pushDir = defender.x >= attacker.x ? 1 : -1;
          defender.status = 'hitstun_air';
          defender.knockdownType = 'soft';
          defender.vx = pushDir * 8.5;
          defender.vy = -7.5;
          defender.y = -2;
          state.screenShake = 10;
          break;
        }
      }
      continue;
    }

    if (attacker.status !== 'attack' || !attacker.currentMoveId) continue;
    const move = attChar.moves[attacker.currentMoveId];
    if (!move) continue;

    if (isFighterInvulnerableTo(defender, defChar, 'strike')) continue;

    // Check juggle limit if defender is airborne in hitstun
    if (
      (defender.y < 0 || defender.status === 'hitstun_air') &&
      defender.comboCounter > 0 &&
      defender.jugglePoints > move.juggleLimit
    ) {
      continue;
    }

    // Check overlap with defender's parry stance or hurtboxes
    let hitPoint: { x: number; y: number } | null = null;
    if (defender.status === 'parry_stance' && defender.statusFrame <= 10) {
      for (const hb of attBoxes.hitboxes) {
        if (boxesOverlap(hb, defBoxes.pushbox)) {
          hitPoint = boxIntersectionCenter(hb, defBoxes.pushbox);
          break;
        }
      }
    }

    if (!hitPoint) {
      for (const hb of attBoxes.hitboxes) {
        for (const hurt of defBoxes.hurtboxes) {
          if (boxesOverlap(hb, hurt)) {
            hitPoint = boxIntersectionCenter(hb, hurt);
            break;
          }
        }
        if (hitPoint) break;
      }
    }

    if (hitPoint) {
      pendingHits.push({
        attacker,
        defender,
        move,
        impactX: hitPoint.x,
        impactY: hitPoint.y
      });
    }
  }

  for (const hit of pendingHits) {
    const { attacker, defender, move } = hit;
    attacker.moveHitConnected = true;
    attacker.moveHitCount++;

    resolveStrikeHitOrBlock({
      state,
      attacker,
      defender,
      sourceX: attacker.x,
      impactX: hit.impactX,
      impactY: hit.impactY,
      damage: move.damage,
      chipDamage: move.chipDamage,
      stunDamage: move.stunDamage,
      hitstun: move.hitstun,
      blockstun: move.blockstun,
      hitstop: move.hitstop,
      pushbackHit: move.pushbackHit,
      pushbackBlock: move.pushbackBlock,
      hitLevel: move.hitLevel,
      knockdown: move.knockdown,
      launchVx: move.launchVx,
      launchVy: move.launchVy,
      juggleCost: move.juggleCost,
      juggleLimit: move.juggleLimit,
      meterGainHit: move.meterGainHit,
      meterGainBlock: move.meterGainBlock,
      sparkStrength: move.hitSparkStrength,
      moveCategory: move.category,
      moveName: move.name,
      trainingOpts
    });
  }
}

/**
 * Advances the deterministic match simulation by 1 fixed frame (1/60s).
 */
export function stepMatch(
  state: MatchState,
  p1Input: RawInputFrame,
  p2Input: RawInputFrame,
  trainingOpts?: TrainingSimulationOptions
): void {
  state.frame++;
  state.phaseFrame++;
  state.events = [];

  // Advance deterministic RNG seed each frame
  const rngStep = nextRandom(state.rngSeed);
  state.rngSeed = rngStep.nextSeed;

  // Save previous positions for render interpolation
  for (const f of state.fighters) {
    f.prevX = f.x;
    f.prevY = f.y;
  }

  // Decay screen shake & announcement timer
  if (state.screenShake > 0) {
    state.screenShake = Math.max(0, state.screenShake - 0.85);
  }
  if (state.announcementTimer > 0) {
    state.announcementTimer--;
  }

  // Always record inputs into the 60Hz input buffer so charge and motions buffer during freeze/hitstop
  pushInputFrame(state.fighters[0], p1Input, state.frame);
  pushInputFrame(state.fighters[1], p2Input, state.frame);

  // Handle Round Intro Phase
  if (state.phase === 'intro') {
    if (state.phaseFrame === 1) {
      state.events.push({
        type: 'round_start',
        playerIndex: 0,
        x: 0,
        y: -120,
        text: `ROUND ${state.roundNumber}`
      });
    }
    if (state.phaseFrame === 55) {
      state.announcementText = 'ENGAGE!';
      state.announcementSubtext = 'NEON TEMPEST // FIGHT';
      state.announcementTimer = 45;
    }
    if (state.phaseFrame >= 85) {
      state.phase = 'fight';
      state.phaseFrame = 0;
    }
    updateCamera(state);
    return;
  }

  // Handle KO Slow-Motion Phase
  if (state.phase === 'ko_slowmo') {
    state.slowMoFrames--;
    if (state.slowMoFrames <= 0) {
      state.phase = 'outro';
      state.phaseFrame = 0;
      const winIdx = state.winnerIndex;
      if (winIdx === 0 || winIdx === 1) {
        state.fighters[winIdx].status = 'victory';
        state.fighters[winIdx].statusFrame = 1;
        state.fighters[winIdx].vx = 0;
      }
      state.events.push({
        type: 'round_end',
        playerIndex: winIdx === 1 ? 1 : 0,
        x: 0,
        y: -120
      });
    } else if (state.phaseFrame % 3 !== 0) {
      // Tick physics only every 3rd frame during KO slow-mo!
      updateCamera(state);
      return;
    }
  }

  // Handle Round Outro Phase
  if (state.phase === 'outro') {
    for (let i = 0; i < 2; i++) {
      const f = state.fighters[i];
      const opp = state.fighters[i === 0 ? 1 : 0];
      updateFighterMovementAndState(state, f, opp, CHARACTERS[f.charId], trainingOpts);
    }
    if (state.phaseFrame >= 110) {
      if (
        state.p1RoundsWon >= state.roundsToWin ||
        state.p2RoundsWon >= state.roundsToWin
      ) {
        state.phase = 'match_over';
        state.phaseFrame = 0;
      } else {
        state.roundNumber++;
        resetRoundState(state, false);
      }
    }
    updateCamera(state);
    return;
  }

  if (state.phase === 'match_over') {
    updateCamera(state);
    return;
  }

  // Handle Cinematic Super / Ultimate Freeze
  if (state.screenFreezeFrames > 0) {
    state.screenFreezeFrames--;
    if (state.screenFreezeFrames === 0) {
      state.superFreezeOwner = null;
    }
    updateCamera(state);
    return;
  }

  // Decrement Round Timer during active fight (unless infiniteHealth / training mode)
  if (state.phase === 'fight' && !trainingOpts?.infiniteHealth) {
    if (state.roundTimerFrames > 0) {
      state.roundTimerFrames--;
      if (state.roundTimerFrames === 0) {
        // Time Over resolution!
        const hp0 = state.fighters[0].hp / state.fighters[0].maxHp;
        const hp1 = state.fighters[1].hp / state.fighters[1].maxHp;
        if (Math.abs(hp0 - hp1) < 0.001) {
          state.winnerIndex = -1;
          state.p1RoundsWon++;
          state.p2RoundsWon++;
          state.finishType = 'TIME_OVER';
          state.announcementText = 'TIME OVER // DRAW';
          state.announcementSubtext = 'EQUAL VITALITY';
        } else {
          const winIdx: 0 | 1 = hp0 > hp1 ? 0 : 1;
          state.winnerIndex = winIdx;
          if (winIdx === 0) state.p1RoundsWon++;
          else state.p2RoundsWon++;
          state.finishType = 'TIME_OVER';
          state.announcementText = 'TIME OVER';
          state.announcementSubtext = `${CHARACTERS[state.fighters[winIdx].charId].name} WINS BY VITALITY`;
        }
        state.phase = 'outro';
        state.phaseFrame = 0;
        state.announcementTimer = 100;
        return;
      }
    }
  }

  const f0 = state.fighters[0];
  const f1 = state.fighters[1];
  const c0 = CHARACTERS[f0.charId];
  const c1 = CHARACTERS[f1.charId];

  // Process each fighter (skipping movement/action updates if in hitstop)
  for (const [fighter, opponent, charDef] of [
    [f0, f1, c0] as const,
    [f1, f0, c1] as const
  ]) {
    if (fighter.hitstopFrames > 0) {
      fighter.hitstopFrames--;
      // Allow buffering cancels during hitstop!
      if (fighter.hitstopFrames === 0 && state.phase === 'fight') {
        tryTriggerActions(state, fighter, opponent, charDef);
      }
      continue;
    }

    if (state.phase === 'fight') {
      tryTriggerActions(state, fighter, opponent, charDef);
    }
    updateFighterMovementAndState(state, fighter, opponent, charDef, trainingOpts);
  }

  // Enforce max separation between fighters
  const dist = Math.abs(f1.x - f0.x);
  if (dist > MAX_FIGHTER_SEPARATION) {
    const mid = (f0.x + f1.x) * 0.5;
    const sign = f0.x < f1.x ? -1 : 1;
    f0.x = mid + sign * (MAX_FIGHTER_SEPARATION * 0.5);
    f1.x = mid - sign * (MAX_FIGHTER_SEPARATION * 0.5);
  }

  // Resolve pushbox collision
  resolvePushboxCollision(f0, f1);

  // Update projectiles and melee hits
  if (state.phase === 'fight') {
    updateProjectiles(state, trainingOpts);
    resolveMeleeCombat(state, trainingOpts);
  }

  updateCamera(state);
}

function updateCamera(state: MatchState): void {
  const f0 = state.fighters[0];
  const f1 = state.fighters[1];

  const targetX = clamp((f0.x + f1.x) * 0.5, -240, 240);
  const targetY = clamp(Math.min(f0.y, f1.y) * 0.35, -90, 0);
  const dist = Math.abs(f1.x - f0.x);

  // Zoom in when fighters are close or during Super Freeze / KO slowmo
  let targetZoom = clamp(1.16 - (dist / 880) * 0.18, 0.98, 1.16);
  if (state.screenFreezeFrames > 0) {
    targetZoom = 1.24;
  } else if (state.phase === 'ko_slowmo') {
    targetZoom = 1.22;
  }

  state.cameraX = lerp(state.cameraX, targetX, 0.18);
  state.cameraY = lerp(state.cameraY, targetY, 0.15);
  state.cameraZoom = lerp(state.cameraZoom, targetZoom, 0.12);
}
