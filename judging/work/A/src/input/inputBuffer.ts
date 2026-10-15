import {
  AttackButton,
  FighterState,
  InputHistoryEntry,
  MotionType,
  NumpadDir,
  RawInputFrame
} from '../core/types';

// Bitmask constants for buttons
export const BTN_LP = 1 << 0;
export const BTN_MP = 1 << 1;
export const BTN_HP = 1 << 2;
export const BTN_LK = 1 << 3;
export const BTN_MK = 1 << 4;
export const BTN_HK = 1 << 5;
export const BTN_THROW = 1 << 6;
export const BTN_PARRY = 1 << 7;
export const BTN_OVERDRIVE = 1 << 8;
export const BTN_EX = 1 << 9;

export const PUNCH_MASK = BTN_LP | BTN_MP | BTN_HP;
export const KICK_MASK = BTN_LK | BTN_MK | BTN_HK;
export const ANY_ATTACK_MASK = PUNCH_MASK | KICK_MASK;

export const MAX_INPUT_HISTORY = 32;
export const INPUT_BUFFER_LENIENCY = 6; // 6-frame buffer window
export const CHARGE_THRESHOLD_FRAMES = 30; // 0.5s charge time
export const CHARGE_RELEASE_GRACE = 10; // 10 frames after releasing charge to hit opposite direction + button

/**
 * SOCD (Simultaneous Opposite Cardinal Directions) cleaner.
 * Left + Right = Neutral (0)
 * Up + Down = Neutral (0)
 */
export function cleanSOCD(raw: RawInputFrame): { dx: -1 | 0 | 1; dy: -1 | 0 | 1 } {
  const dx: -1 | 0 | 1 = raw.left && raw.right ? 0 : raw.left ? -1 : raw.right ? 1 : 0;
  const dy: -1 | 0 | 1 = raw.up && raw.down ? 0 : raw.down ? -1 : raw.up ? 1 : 0;
  return { dx, dy };
}

/**
 * Converts cleaned (dx, dy) into numpad direction (1..9).
 * If facing === -1 (facing left), horizontal axis is mirrored so 6 is always FORWARD and 4 is always BACK.
 */
export function toNumpadDir(dx: -1 | 0 | 1, dy: -1 | 0 | 1, facing: 1 | -1): NumpadDir {
  const relX = (dx * facing) as -1 | 0 | 1;
  if (dy === -1) {
    if (relX === -1) return 1;
    if (relX === 0) return 2;
    return 3;
  }
  if (dy === 0) {
    if (relX === -1) return 4;
    if (relX === 0) return 5;
    return 6;
  }
  // dy === 1 (up)
  if (relX === -1) return 7;
  if (relX === 0) return 8;
  return 9;
}

export function encodeButtons(raw: RawInputFrame): number {
  let mask = 0;
  if (raw.lp) mask |= BTN_LP;
  if (raw.mp) mask |= BTN_MP;
  if (raw.hp) mask |= BTN_HP;
  if (raw.lk) mask |= BTN_LK;
  if (raw.mk) mask |= BTN_MK;
  if (raw.hk) mask |= BTN_HK;
  if (raw.throwMacro) mask |= BTN_THROW | BTN_LP | BTN_LK;
  if (raw.parryMacro) mask |= BTN_PARRY | BTN_MP | BTN_MK;
  if (raw.overdriveMacro) mask |= BTN_OVERDRIVE | BTN_HP | BTN_HK;
  if (raw.exMacro) mask |= BTN_EX;
  return mask;
}

export function countBits(mask: number): number {
  let c = 0;
  let m = mask;
  while (m > 0) {
    c += m & 1;
    m >>= 1;
  }
  return c;
}

/**
 * Records a single frame of raw input into the fighter's deterministic input buffer
 * and updates charge timers.
 */
export function pushInputFrame(
  fighter: FighterState,
  raw: RawInputFrame,
  frameNumber: number
): InputHistoryEntry {
  const { dx, dy } = cleanSOCD(raw);
  const rawDir = toNumpadDir(dx, dy, 1);
  const relDir = toNumpadDir(dx, dy, fighter.facing);
  const held = encodeButtons(raw);

  const prev = fighter.inputBuffer.length > 0 ? fighter.inputBuffer[0] : null;
  const prevHeld = prev ? prev.held : 0;
  const pressed = held & ~prevHeld;
  const released = prevHeld & ~held;

  // Update charge timers
  const holdingBack = relDir === 4 || relDir === 1 || relDir === 7;
  const holdingDown = relDir === 2 || relDir === 1 || relDir === 3;

  if (holdingBack) {
    fighter.chargeBackFrames = Math.min(120, fighter.chargeBackFrames + 1);
    fighter.chargeBackReleaseGrace = CHARGE_RELEASE_GRACE;
  } else {
    if (fighter.chargeBackReleaseGrace > 0) {
      fighter.chargeBackReleaseGrace--;
    } else {
      fighter.chargeBackFrames = 0;
    }
  }

  if (holdingDown) {
    fighter.chargeDownFrames = Math.min(120, fighter.chargeDownFrames + 1);
    fighter.chargeDownReleaseGrace = CHARGE_RELEASE_GRACE;
  } else {
    if (fighter.chargeDownReleaseGrace > 0) {
      fighter.chargeDownReleaseGrace--;
    } else {
      fighter.chargeDownFrames = 0;
    }
  }

  // Merge duration if identical state, but still push frame-accurate entry for buffer checks
  const sameState =
    prev &&
    prev.relDir === relDir &&
    prev.held === held &&
    pressed === 0 &&
    released === 0;

  const entry: InputHistoryEntry = {
    frame: frameNumber,
    rawDir,
    relDir,
    pressed,
    released,
    held,
    duration: sameState && prev ? prev.duration + 1 : 1
  };

  fighter.inputBuffer.unshift(entry);
  if (fighter.inputBuffer.length > MAX_INPUT_HISTORY) {
    fighter.inputBuffer.length = MAX_INPUT_HISTORY;
  }
  return entry;
}

/**
 * Checks if a specific button or chord was triggered within the buffer window.
 * Supports:
 * - Single buttons (LP, MP, HP, LK, MK, HK)
 * - Simultaneous chords with 2-frame leniency (THROW = LP+LK, PARRY = MP+MK, OVERDRIVE = HP+HK, PP = 2+ punches, KK = 2+ kicks)
 * - Negative edge (button release triggers special/super motions when allowNegativeEdge is true)
 */
export function checkButtonBuffered(
  buffer: InputHistoryEntry[],
  button: AttackButton,
  windowFrames = INPUT_BUFFER_LENIENCY,
  allowNegativeEdge = false
): boolean {
  const limit = Math.min(buffer.length, windowFrames);
  if (limit === 0) return false;

  // Gather cumulative presses and releases in the recent window, plus simultaneous chord window (3 frames)
  for (let i = 0; i < limit; i++) {
    const entry = buffer[i];
    // 2-frame chord merge around index i
    let chordPressed = entry.pressed;
    if (i + 1 < buffer.length) chordPressed |= buffer[i + 1].pressed;
    const chordHeld = entry.held;

    switch (button) {
      case 'THROW': {
        if (entry.pressed & BTN_THROW) return true;
        const bothPressed = (chordPressed & BTN_LP) !== 0 && (chordPressed & BTN_LK) !== 0;
        const bothHeldAndOneJustPressed =
          (chordHeld & (BTN_LP | BTN_LK)) === (BTN_LP | BTN_LK) &&
          (entry.pressed & (BTN_LP | BTN_LK)) !== 0;
        if (bothPressed || bothHeldAndOneJustPressed) return true;
        break;
      }
      case 'PARRY': {
        if (entry.pressed & BTN_PARRY) return true;
        const bothPressed = (chordPressed & BTN_MP) !== 0 && (chordPressed & BTN_MK) !== 0;
        const bothHeldAndOneJustPressed =
          (chordHeld & (BTN_MP | BTN_MK)) === (BTN_MP | BTN_MK) &&
          (entry.pressed & (BTN_MP | BTN_MK)) !== 0;
        if (bothPressed || bothHeldAndOneJustPressed) return true;
        break;
      }
      case 'OVERDRIVE': {
        if (entry.pressed & BTN_OVERDRIVE) return true;
        const bothPressed = (chordPressed & BTN_HP) !== 0 && (chordPressed & BTN_HK) !== 0;
        const bothHeldAndOneJustPressed =
          (chordHeld & (BTN_HP | BTN_HK)) === (BTN_HP | BTN_HK) &&
          (entry.pressed & (BTN_HP | BTN_HK)) !== 0;
        if (bothPressed || bothHeldAndOneJustPressed) return true;
        break;
      }
      case 'PP': {
        if ((entry.pressed & BTN_EX) && (chordHeld & PUNCH_MASK || entry.pressed & PUNCH_MASK)) {
          return true;
        }
        const punchesPressed = countBits(chordPressed & PUNCH_MASK);
        const punchesHeld = countBits(chordHeld & PUNCH_MASK);
        if (punchesPressed >= 2 || (punchesHeld >= 2 && (entry.pressed & PUNCH_MASK) !== 0)) {
          return true;
        }
        break;
      }
      case 'KK': {
        if ((entry.pressed & BTN_EX) && (chordHeld & KICK_MASK || entry.pressed & KICK_MASK)) {
          return true;
        }
        const kicksPressed = countBits(chordPressed & KICK_MASK);
        const kicksHeld = countBits(chordHeld & KICK_MASK);
        if (kicksPressed >= 2 || (kicksHeld >= 2 && (entry.pressed & KICK_MASK) !== 0)) {
          return true;
        }
        break;
      }
      case 'LP':
        if (entry.pressed & BTN_LP || (allowNegativeEdge && entry.released & BTN_LP)) return true;
        break;
      case 'MP':
        if (entry.pressed & BTN_MP || (allowNegativeEdge && entry.released & BTN_MP)) return true;
        break;
      case 'HP':
        if (entry.pressed & BTN_HP || (allowNegativeEdge && entry.released & BTN_HP)) return true;
        break;
      case 'LK':
        if (entry.pressed & BTN_LK || (allowNegativeEdge && entry.released & BTN_LK)) return true;
        break;
      case 'MK':
        if (entry.pressed & BTN_MK || (allowNegativeEdge && entry.released & BTN_MK)) return true;
        break;
      case 'HK':
        if (entry.pressed & BTN_HK || (allowNegativeEdge && entry.released & BTN_HK)) return true;
        break;
    }
  }
  return false;
}

/**
 * Matches a directional sequence against the chronological slice of the input buffer.
 * `buffer[0]` is newest, `buffer[n-1]` is oldest.
 */
function matchSequenceChronological(
  buffer: InputHistoryEntry[],
  windowFrames: number,
  predicates: ((dir: NumpadDir) => boolean)[],
  forbiddenBetween?: (dir: NumpadDir, stepIndex: number) => boolean
): boolean {
  const len = Math.min(buffer.length, windowFrames);
  if (len === 0) return false;

  // Walk from oldest (len - 1) to newest (0)
  let step = 0;
  for (let i = len - 1; i >= 0; i--) {
    const dir = buffer[i].relDir;
    if (predicates[step](dir)) {
      step++;
      if (step === predicates.length) {
        // Ensure the final step occurred reasonably recently (within last 8 frames)
        return i <= 8;
      }
    } else if (forbiddenBetween && forbiddenBetween(dir, step)) {
      // Reset if a forbidden opposite direction occurred mid-motion
      step = predicates[0](dir) ? 1 : 0;
    }
  }
  return false;
}

const isDown = (d: NumpadDir) => d === 2;
const isDownAny = (d: NumpadDir) => d === 2 || d === 1 || d === 3;
const isDownForward = (d: NumpadDir) => d === 3;
const isDownBack = (d: NumpadDir) => d === 1;
const isForward = (d: NumpadDir) => d === 6;
const isForwardAny = (d: NumpadDir) => d === 6 || d === 3 || d === 9;
const isBack = (d: NumpadDir) => d === 4;
const isBackAny = (d: NumpadDir) => d === 4 || d === 1 || d === 7;
const isUpAny = (d: NumpadDir) => d === 8 || d === 7 || d === 9;

/**
 * Evaluates whether a specific motion input has been completed within its leniency window.
 */
export function checkMotionInput(fighter: FighterState, motion: MotionType): boolean {
  const buf = fighter.inputBuffer;
  if (buf.length < 2) return false;

  switch (motion) {
    case 'DQCF': {
      // 236236 (or 2 -> 6 -> 2 -> 6 within 26 frames)
      return (
        matchSequenceChronological(buf, 26, [isDown, isDownForward, isForward, isDown, isDownForward, isForward]) ||
        matchSequenceChronological(buf, 24, [isDownAny, isForward, isDownAny, isForward])
      );
    }
    case 'DQCB': {
      return (
        matchSequenceChronological(buf, 26, [isDown, isDownBack, isBack, isDown, isDownBack, isBack]) ||
        matchSequenceChronological(buf, 24, [isDownAny, isBack, isDownAny, isBack])
      );
    }
    case '360': {
      // Must touch all 4 cardinal zones (Back, Down, Forward, Up) within 24 frames in any order
      const len = Math.min(buf.length, 24);
      let hasBack = false;
      let hasDown = false;
      let hasForward = false;
      let hasUp = false;
      for (let i = 0; i < len; i++) {
        const d = buf[i].relDir;
        if (isBackAny(d)) hasBack = true;
        if (isDownAny(d)) hasDown = true;
        if (isForwardAny(d)) hasForward = true;
        if (isUpAny(d)) hasUp = true;
      }
      return hasBack && hasDown && hasForward && hasUp;
    }
    case 'HCF': {
      // 41236 or 4 -> 2 -> 6 within 20 frames
      return (
        matchSequenceChronological(buf, 20, [isBack, isDownAny, isForward]) ||
        matchSequenceChronological(buf, 20, [isBackAny, isDown, isDownForward, isForward])
      );
    }
    case 'HCB': {
      // 63214 or 6 -> 2 -> 4 within 20 frames
      return (
        matchSequenceChronological(buf, 20, [isForward, isDownAny, isBack]) ||
        matchSequenceChronological(buf, 20, [isForwardAny, isDown, isDownBack, isBack])
      );
    }
    case 'DP': {
      // 623 (or 6 -> 2 -> 3, or 3 -> 2 -> 3) within 16 frames, without holding back in between
      return (
        matchSequenceChronological(
          buf,
          16,
          [isForward, isDown, isDownForward],
          (d) => isBackAny(d)
        ) ||
        matchSequenceChronological(
          buf,
          14,
          [isDownForward, isDown, isDownForward],
          (d) => isBackAny(d)
        )
      );
    }
    case 'QCF': {
      // 236 (must not start with 6 right before 2 if DP is being input, handled by move priority order,
      // and must not go to Back (4) after Down (2))
      return (
        matchSequenceChronological(
          buf,
          15,
          [isDown, isDownForward, isForward],
          (d, step) => step >= 1 && isBackAny(d)
        ) ||
        matchSequenceChronological(
          buf,
          12,
          [isDown, isForward],
          (d, step) => step >= 1 && isBackAny(d)
        )
      );
    }
    case 'QCB': {
      // 214
      return (
        matchSequenceChronological(
          buf,
          15,
          [isDown, isDownBack, isBack],
          (d, step) => step >= 1 && isForwardAny(d)
        ) ||
        matchSequenceChronological(
          buf,
          12,
          [isDown, isBack],
          (d, step) => step >= 1 && isForwardAny(d)
        )
      );
    }
    case 'CHARGE_BF': {
      // Must have charged Back for >= CHARGE_THRESHOLD_FRAMES and currently have grace > 0,
      // and hit Forward within the last 8 frames
      const charged =
        fighter.chargeBackFrames >= CHARGE_THRESHOLD_FRAMES &&
        fighter.chargeBackReleaseGrace > 0;
      if (!charged) return false;
      const len = Math.min(buf.length, 8);
      for (let i = 0; i < len; i++) {
        if (isForward(buf[i].relDir) || buf[i].relDir === 3 || buf[i].relDir === 9) {
          return true;
        }
      }
      return false;
    }
    case 'CHARGE_DU': {
      // Must have charged Down for >= CHARGE_THRESHOLD_FRAMES and currently have grace > 0,
      // and hit Up within the last 8 frames
      const charged =
        fighter.chargeDownFrames >= CHARGE_THRESHOLD_FRAMES &&
        fighter.chargeDownReleaseGrace > 0;
      if (!charged) return false;
      const len = Math.min(buf.length, 8);
      for (let i = 0; i < len; i++) {
        if (isUpAny(buf[i].relDir)) {
          return true;
        }
      }
      return false;
    }
  }
}

/**
 * Checks for double-tap forward dash (6, 5, 6) or back dash (4, 5, 4) within 11 frames.
 */
export function checkDashInput(buffer: InputHistoryEntry[]): 'forward' | 'backward' | null {
  if (buffer.length < 3) return null;
  // Must have just transitioned into 6 or 4 on the current frame (buffer[0].relDir !== buffer[1].relDir)
  const currDir = buffer[0].relDir;
  if (buffer[1].relDir === currDir) return null;

  if (currDir === 6) {
    if (
      matchSequenceChronological(
        buffer,
        11,
        [(d) => d === 6, (d) => d === 5, (d) => d === 6],
        (d) => isBackAny(d) || isDownAny(d)
      )
    ) {
      return 'forward';
    }
  } else if (currDir === 4) {
    if (
      matchSequenceChronological(
        buffer,
        11,
        [(d) => d === 4, (d) => d === 5, (d) => d === 4],
        (d) => isForwardAny(d) || isDownAny(d)
      )
    ) {
      return 'backward';
    }
  }
  return null;
}

/**
 * Consumes buffered button presses and charges after a move is executed so the same
 * press doesn't re-trigger on subsequent frames.
 */
export function consumeBufferedInput(fighter: FighterState, motion?: MotionType): void {
  for (let i = 0; i < Math.min(fighter.inputBuffer.length, INPUT_BUFFER_LENIENCY + 2); i++) {
    fighter.inputBuffer[i].pressed = 0;
    fighter.inputBuffer[i].released = 0;
  }
  if (motion === 'CHARGE_BF') {
    fighter.chargeBackFrames = 0;
    fighter.chargeBackReleaseGrace = 0;
  } else if (motion === 'CHARGE_DU') {
    fighter.chargeDownFrames = 0;
    fighter.chargeDownReleaseGrace = 0;
  }
}
