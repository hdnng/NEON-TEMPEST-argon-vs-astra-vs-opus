import { CHARACTERS } from '../data/characters';
import {
  FighterState,
  MatchState,
  NumpadDir,
  RawInputFrame
} from '../core/types';
import { createEmptyInput } from '../input/inputManager';
import { nextRandom } from '../utils/rng';

export type CpuDifficulty = 'easy' | 'medium' | 'hard';

export type DummyBehavior =
  | 'stand'
  | 'crouch'
  | 'jump'
  | 'block_always'
  | 'block_after_hit'
  | 'parry_always'
  | 'cpu';

/**
 * Helper that converts a relative numpad direction (1..9) + facing (1 | -1) + buttons
 * into a RawInputFrame.
 */
export function buildRawInputFromNumpad(
  relDir: NumpadDir,
  facing: 1 | -1,
  buttons: Partial<Omit<RawInputFrame, 'up' | 'down' | 'left' | 'right'>> = {}
): RawInputFrame {
  const relX =
    relDir === 1 || relDir === 4 || relDir === 7
      ? -1
      : relDir === 3 || relDir === 6 || relDir === 9
      ? 1
      : 0;
  const dy =
    relDir === 1 || relDir === 2 || relDir === 3
      ? -1
      : relDir === 7 || relDir === 8 || relDir === 9
      ? 1
      : 0;

  const worldX = relX * facing;
  return {
    up: dy === 1,
    down: dy === -1,
    left: worldX === -1,
    right: worldX === 1,
    lp: buttons.lp ?? false,
    mp: buttons.mp ?? false,
    hp: buttons.hp ?? false,
    lk: buttons.lk ?? false,
    mk: buttons.mk ?? false,
    hk: buttons.hk ?? false,
    throwMacro: buttons.throwMacro ?? false,
    parryMacro: buttons.parryMacro ?? false,
    overdriveMacro: buttons.overdriveMacro ?? false,
    exMacro: buttons.exMacro ?? false
  };
}

/**
 * Generates multi-frame input sequences for special/super motions so the CPU goes through
 * the exact same input buffer & motion parser as a human player.
 */
export function buildMotionSequence(
  motion:
    | 'QCF'
    | 'QCB'
    | 'DP'
    | 'HCF'
    | 'HCB'
    | '360'
    | 'CHARGE_BF'
    | 'CHARGE_DU'
    | 'DQCF'
    | 'DASH_F'
    | 'DASH_B',
  facing: 1 | -1,
  button: Partial<Omit<RawInputFrame, 'up' | 'down' | 'left' | 'right'>>
): RawInputFrame[] {
  const f = (dir: NumpadDir, btn: typeof button = {}) =>
    buildRawInputFromNumpad(dir, facing, btn);

  switch (motion) {
    case 'QCF':
      return [f(2), f(3), f(6, button), f(6)];
    case 'QCB':
      return [f(2), f(1), f(4, button), f(4)];
    case 'DP':
      return [f(6), f(2), f(3, button), f(3)];
    case 'HCF':
      return [f(4), f(1), f(2), f(3), f(6, button), f(6)];
    case 'HCB':
      return [f(6), f(3), f(2), f(1), f(4, button), f(4)];
    case '360':
      return [f(6), f(2), f(4), f(8, button), f(8)];
    case 'DQCF':
      return [f(2), f(3), f(6), f(2), f(3), f(6, button), f(6)];
    case 'CHARGE_BF':
      return [f(6, button), f(6)];
    case 'CHARGE_DU':
      return [f(8, button), f(8)];
    case 'DASH_F':
      return [f(6), f(5), f(6), f(6)];
    case 'DASH_B':
      return [f(4), f(5), f(4)];
  }
}

export class CpuController {
  public difficulty: CpuDifficulty;
  private scriptQueue: RawInputFrame[] = [];
  private decisionCooldown = 0;
  private defaultHoldDir: NumpadDir = 5;

  constructor(difficulty: CpuDifficulty = 'medium') {
    this.difficulty = difficulty;
  }

  public reset(): void {
    this.scriptQueue = [];
    this.decisionCooldown = 0;
    this.defaultHoldDir = 5;
  }

  private rand(state: MatchState, salt: number): number {
    const mixed = (state.rngSeed ^ Math.imul(state.frame + salt, 0x9e3779b1)) | 0;
    return nextRandom(mixed).value;
  }

  public getInput(state: MatchState, playerIndex: 0 | 1): RawInputFrame {
    const me = state.fighters[playerIndex];
    const opp = state.fighters[playerIndex === 0 ? 1 : 0];

    if (state.phase !== 'fight') {
      this.scriptQueue = [];
      return createEmptyInput();
    }

    // If executing a multi-frame motion or combo sequence, pop the next frame
    if (this.scriptQueue.length > 0) {
      // If we got hit or knocked down mid-sequence, clear the script queue
      if (
        me.status === 'hitstun_stand' ||
        me.status === 'hitstun_crouch' ||
        me.status === 'hitstun_air' ||
        me.status === 'knockdown' ||
        me.status === 'thrown'
      ) {
        this.scriptQueue = [];
      } else {
        return this.scriptQueue.shift()!;
      }
    }

    const dist = Math.abs(opp.x - me.x);
    const r1 = this.rand(state, playerIndex * 31 + 1);
    const r2 = this.rand(state, playerIndex * 31 + 2);
    const r3 = this.rand(state, playerIndex * 31 + 3);

    // 1. Knockdown Quick Rise check
    if (me.status === 'knockdown' && me.quickRiseAvailable && me.statusFrame <= 6) {
      const quickChance =
        this.difficulty === 'hard' ? 0.8 : this.difficulty === 'medium' ? 0.5 : 0.2;
      if (r1 < quickChance) {
        return buildRawInputFromNumpad(2, me.facing, { lp: true });
      }
    }

    // 2. Throw Tech check when grabbed
    if (me.status === 'thrown') {
      const techChance =
        this.difficulty === 'hard' ? 0.52 : this.difficulty === 'medium' ? 0.28 : 0.1;
      if (r1 < techChance) {
        return buildRawInputFromNumpad(5, me.facing, { lp: true, lk: true, throwMacro: true });
      }
      return createEmptyInput();
    }

    // 3. Hit-Confirm Cancel check! When our current normal/special connects, cancel into Special or Super!
    if (
      me.status === 'attack' &&
      me.currentMoveId &&
      me.moveHitConnected &&
      this.scriptQueue.length === 0
    ) {
      const confirmChance =
        this.difficulty === 'hard' ? 0.85 : this.difficulty === 'medium' ? 0.55 : 0.25;
      if (r1 < confirmChance) {
        const curMove = CHARACTERS[me.charId].moves[me.currentMoveId];
        if (curMove && (curMove.category === 'normal' || curMove.category === 'command_normal')) {
          this.enqueueSpecialCancelForArchetype(me, opp, r2, r3);
          if (this.scriptQueue.length > 0) {
            return this.scriptQueue.shift()!;
          }
        } else if (
          curMove &&
          (curMove.category === 'special' || curMove.category === 'ex_special') &&
          me.meter >= 100 &&
          r2 < (this.difficulty === 'hard' ? 0.55 : 0.3)
        ) {
          // Cancel special into Super or Ultimate!
          if (me.meter >= 200 && me.hp <= me.maxHp * 0.35) {
            this.scriptQueue.push(
              ...buildMotionSequence('DQCF', me.facing, { lp: true, mp: true })
            );
          } else {
            this.scriptQueue.push(...buildMotionSequence('DQCF', me.facing, { hp: true }));
          }
          return this.scriptQueue.shift()!;
        }
      }
    }

    // 4. Defensive Reaction when opponent is attacking or projectile is approaching
    const incomingProj = state.projectiles.find(
      (p) => p.ownerIndex !== playerIndex && Math.abs(p.x - me.x) < 180
    );
    const oppAttackingClose =
      opp.status === 'attack' && dist < 210 && opp.currentMoveId !== null;

    if ((oppAttackingClose || incomingProj) && me.y >= 0) {
      const defendChance =
        this.difficulty === 'hard' ? 0.78 : this.difficulty === 'medium' ? 0.52 : 0.25;
      if (r1 < defendChance) {
        // Occasionally Cyber Parry on Hard/Medium!
        if (this.difficulty !== 'easy' && r2 < 0.14 && me.status === 'idle') {
          return buildRawInputFromNumpad(5, me.facing, { mp: true, mk: true, parryMacro: true });
        }
        // Block low if opponent is doing a crouching move, otherwise stand block
        const oppMove =
          opp.currentMoveId ? CHARACTERS[opp.charId].moves[opp.currentMoveId] : null;
        const blockDir: NumpadDir =
          oppMove?.hitLevel === 'low' ? 1 : oppMove?.hitLevel === 'overhead' ? 4 : r3 < 0.5 ? 1 : 4;
        return buildRawInputFromNumpad(blockDir, me.facing);
      }
    }

    // 5. Anti-Air check if opponent is jumping in
    if (opp.y < -45 && dist < 210 && me.y >= 0 && (me.status === 'idle' || me.status === 'crouch' || me.status === 'walk_b')) {
      const aaChance =
        this.difficulty === 'hard' ? 0.75 : this.difficulty === 'medium' ? 0.45 : 0.2;
      if (r1 < aaChance) {
        if (me.charId === 'hayate') {
          this.scriptQueue.push(...buildMotionSequence('DP', me.facing, { hp: true }));
        } else if (me.charId === 'warden' && me.chargeDownFrames >= 30) {
          this.scriptQueue.push(...buildMotionSequence('CHARGE_DU', me.facing, { hk: true }));
        } else if (me.charId === 'magnus') {
          this.scriptQueue.push(...buildMotionSequence('QCB', me.facing, { hk: true }));
        } else {
          // Universal 2HP anti-air uppercut
          return buildRawInputFromNumpad(2, me.facing, { hp: true });
        }
        if (this.scriptQueue.length > 0) return this.scriptQueue.shift()!;
      }
    }

    // 6. Airborne behavior when CPU is in mid-air
    if (me.y < 0) {
      if (me.charId === 'sable' && dist > 180 && me.airDashesLeft > 0 && me.y < -70 && r1 < 0.4) {
        this.scriptQueue.push(...buildMotionSequence('DASH_F', me.facing, {}));
        return this.scriptQueue.shift()!;
      }
      if (dist < 165 && me.vy > -3) {
        if (me.charId === 'sable' && r1 < 0.45) {
          this.scriptQueue.push(...buildMotionSequence('QCF', me.facing, { mk: true }));
          return this.scriptQueue.shift()!;
        }
        return buildRawInputFromNumpad(5, me.facing, {
          hp: r2 < 0.4,
          hk: r2 >= 0.4 && r2 < 0.75,
          mk: r2 >= 0.75
        });
      }
      return buildRawInputFromNumpad(this.defaultHoldDir, me.facing);
    }

    // 7. Decision Cooldown for pacing neutral actions naturally
    if (this.decisionCooldown > 0) {
      this.decisionCooldown--;
      return buildRawInputFromNumpad(this.defaultHoldDir, me.facing);
    }

    this.decisionCooldown =
      this.difficulty === 'hard' ? 4 : this.difficulty === 'medium' ? 8 : 15;

    // 8. Activate Tempest Overdrive when meter >= 150 and health < 65%
    if (
      !me.overdriveUsedThisRound &&
      me.meter >= 150 &&
      me.hp < me.maxHp * 0.65 &&
      dist < 220 &&
      r1 < 0.35
    ) {
      return buildRawInputFromNumpad(5, me.facing, { hp: true, hk: true, overdriveMacro: true });
    }

    // 9. Character Archetype Decision Tree
    switch (me.charId) {
      case 'hayate':
        this.decideHayate(me, opp, dist, r1, r2, r3);
        break;
      case 'magnus':
        this.decideMagnus(me, opp, dist, r1, r2, r3);
        break;
      case 'sable':
        this.decideSable(me, opp, dist, r1, r2, r3);
        break;
      case 'warden':
        this.decideWarden(me, opp, dist, r1, r2, r3);
        break;
    }

    if (this.scriptQueue.length > 0) {
      return this.scriptQueue.shift()!;
    }
    return buildRawInputFromNumpad(this.defaultHoldDir, me.facing);
  }

  private enqueueSpecialCancelForArchetype(
    me: FighterState,
    opp: FighterState,
    r2: number,
    r3: number
  ): void {
    const useEx = me.meter >= 150 && r3 < 0.4;
    switch (me.charId) {
      case 'hayate':
        if (r2 < 0.55) {
          this.scriptQueue.push(
            ...buildMotionSequence(
              'QCB',
              me.facing,
              useEx ? { lk: true, mk: true } : { hk: true }
            )
          );
        } else {
          this.scriptQueue.push(
            ...buildMotionSequence(
              'DP',
              me.facing,
              useEx ? { lp: true, mp: true } : { hp: true }
            )
          );
        }
        break;
      case 'magnus':
        if (r2 < 0.55) {
          this.scriptQueue.push(
            ...buildMotionSequence(
              'HCF',
              me.facing,
              useEx ? { lp: true, mp: true } : { mp: true }
            )
          );
        } else {
          this.scriptQueue.push(
            ...buildMotionSequence(
              'QCB',
              me.facing,
              useEx ? { lk: true, mk: true } : { hk: true }
            )
          );
        }
        break;
      case 'sable':
        if (r2 < 0.6) {
          this.scriptQueue.push(
            ...buildMotionSequence(
              'QCF',
              me.facing,
              useEx ? { lp: true, mp: true } : { hp: true }
            )
          );
        } else {
          this.scriptQueue.push(
            ...buildMotionSequence(
              'QCF',
              me.facing,
              useEx ? { lk: true, mk: true } : { hk: true }
            )
          );
        }
        break;
      case 'warden':
        if (me.chargeDownFrames >= 30 && r2 < 0.45) {
          this.scriptQueue.push(
            ...buildMotionSequence(
              'CHARGE_DU',
              me.facing,
              useEx ? { lk: true, mk: true } : { hk: true }
            )
          );
        } else {
          this.scriptQueue.push(
            ...buildMotionSequence(
              'QCF',
              me.facing,
              useEx ? { lk: true, mk: true } : { mk: true }
            )
          );
        }
        break;
    }
  }

  private decideHayate(
    me: FighterState,
    opp: FighterState,
    dist: number,
    r1: number,
    r2: number,
    r3: number
  ): void {
    this.defaultHoldDir = r3 < 0.45 ? 1 : 6;
    if (dist > 270) {
      // Long range: Tempest Cyclone (projectile-invulnerable gap closer!), Arc Shuriken, or Dash
      if (r1 < 0.38) {
        this.scriptQueue.push(
          ...buildMotionSequence(
            'QCB',
            me.facing,
            me.meter >= 100 && r2 < 0.35 ? { lk: true, mk: true } : { hk: true }
          )
        );
      } else if (r1 < 0.68) {
        this.scriptQueue.push(
          ...buildMotionSequence('QCF', me.facing, r2 < 0.5 ? { lp: true } : { hp: true })
        );
      } else {
        this.scriptQueue.push(...buildMotionSequence('DASH_F', me.facing, {}));
      }
    } else if (dist > 130) {
      // Mid range: 2MK, 5MP, 5HP, 3HK slide, or Tempest Cyclone
      if (r1 < 0.28) {
        this.scriptQueue.push(buildRawInputFromNumpad(2, me.facing, { mk: true }));
      } else if (r1 < 0.52) {
        this.scriptQueue.push(buildRawInputFromNumpad(5, me.facing, { hp: true }));
      } else if (r1 < 0.74) {
        this.scriptQueue.push(
          ...buildMotionSequence(
            'QCB',
            me.facing,
            me.meter >= 100 && r2 < 0.3 ? { lk: true, mk: true } : { mk: true }
          )
        );
      } else if (r1 < 0.9) {
        this.scriptQueue.push(buildRawInputFromNumpad(3, me.facing, { hk: true }));
      } else {
        this.defaultHoldDir = 9;
      }
    } else {
      // Close range: throw, 2MP, 5MP, 6MP overhead, or DP / Super
      if (r1 < 0.22 && opp.y >= 0) {
        this.scriptQueue.push(
          buildRawInputFromNumpad(r2 < 0.35 ? 4 : 5, me.facing, {
            lp: true,
            lk: true,
            throwMacro: true
          })
        );
      } else if (r1 < 0.48) {
        this.scriptQueue.push(buildRawInputFromNumpad(2, me.facing, { mp: true }));
      } else if (r1 < 0.68) {
        this.scriptQueue.push(buildRawInputFromNumpad(6, me.facing, { mp: true }));
      } else if (r1 < 0.85) {
        this.scriptQueue.push(buildRawInputFromNumpad(5, me.facing, { hp: true }));
      } else if (me.meter >= 100 && r3 < 0.5) {
        this.scriptQueue.push(...buildMotionSequence('DQCF', me.facing, { hp: true }));
      } else {
        this.scriptQueue.push(...buildMotionSequence('DP', me.facing, { hp: true }));
      }
    }
  }

  private decideMagnus(
    me: FighterState,
    opp: FighterState,
    dist: number,
    r1: number,
    r2: number,
    r3: number
  ): void {
    this.defaultHoldDir = r3 < 0.42 ? 1 : 6;
    if (dist > 250) {
      if (r1 < 0.42) {
        this.scriptQueue.push(
          ...buildMotionSequence(
            'HCF',
            me.facing,
            me.meter >= 100 && r2 < 0.32 ? { lp: true, mp: true } : { hp: true }
          )
        );
      } else if (r1 < 0.74) {
        this.scriptQueue.push(...buildMotionSequence('DASH_F', me.facing, {}));
      } else {
        this.defaultHoldDir = 6;
      }
    } else if (dist > 148) {
      if (r1 < 0.34) {
        this.scriptQueue.push(
          ...buildMotionSequence(
            'HCF',
            me.facing,
            me.meter >= 100 && r2 < 0.28 ? { lp: true, mp: true } : { mp: true }
          )
        );
      } else if (r1 < 0.62) {
        this.scriptQueue.push(
          ...buildMotionSequence(
            'QCB',
            me.facing,
            me.meter >= 100 && r2 < 0.28 ? { lk: true, mk: true } : { hk: true }
          )
        );
      } else if (r1 < 0.86) {
        this.scriptQueue.push(buildRawInputFromNumpad(5, me.facing, { hp: true }));
      } else {
        this.defaultHoldDir = r2 < 0.4 ? 9 : 6;
      }
    } else {
      if (r1 < 0.34 && opp.y >= 0) {
        this.scriptQueue.push(
          ...buildMotionSequence(
            '360',
            me.facing,
            me.meter >= 100 && r2 < 0.32 ? { lp: true, mp: true } : { hp: true }
          )
        );
      } else if (r1 < 0.51 && opp.y >= 0) {
        this.scriptQueue.push(
          buildRawInputFromNumpad(5, me.facing, { lp: true, lk: true, throwMacro: true })
        );
      } else if (r1 < 0.72) {
        this.scriptQueue.push(buildRawInputFromNumpad(2, me.facing, { mp: true }));
      } else if (r1 < 0.87) {
        this.scriptQueue.push(buildRawInputFromNumpad(6, me.facing, { mp: true }));
      } else if (me.meter >= 100 && r3 < 0.5) {
        this.scriptQueue.push(...buildMotionSequence('DQCF', me.facing, { hp: true }));
      } else {
        this.scriptQueue.push(...buildMotionSequence('QCB', me.facing, { hk: true }));
      }
    }
  }

  private decideSable(
    me: FighterState,
    opp: FighterState,
    dist: number,
    r1: number,
    r2: number,
    r3: number
  ): void {
    this.defaultHoldDir = r3 < 0.44 ? 1 : 6;
    if (dist > 245) {
      // Rushdown approach: Dash, jump-in, or Phantom Blink
      if (r1 < 0.28) {
        this.scriptQueue.push(
          ...buildMotionSequence(
            'QCB',
            me.facing,
            me.meter >= 100 && r2 < 0.25 ? { lk: true, mk: true } : { hk: true }
          )
        );
      } else if (r1 < 0.72) {
        this.scriptQueue.push(...buildMotionSequence('DASH_F', me.facing, {}));
      } else {
        this.defaultHoldDir = 9;
      }
    } else if (dist > 125) {
      if (r1 < 0.28) {
        this.scriptQueue.push(buildRawInputFromNumpad(3, me.facing, { hk: true }));
      } else if (r1 < 0.54) {
        this.scriptQueue.push(
          ...buildMotionSequence(
            'QCF',
            me.facing,
            me.meter >= 100 && r2 < 0.28 ? { lk: true, mk: true } : { hk: true }
          )
        );
      } else if (r1 < 0.8) {
        this.scriptQueue.push(
          ...buildMotionSequence(
            'QCF',
            me.facing,
            me.meter >= 100 && r2 < 0.28 ? { lp: true, mp: true } : { hp: true }
          )
        );
      } else {
        this.scriptQueue.push(buildRawInputFromNumpad(2, me.facing, { mk: true }));
      }
    } else {
      // Point-blank pressure: 2MP, 5HP, 6MP overhead, throw, or Super
      if (r1 < 0.28) {
        this.scriptQueue.push(buildRawInputFromNumpad(2, me.facing, { mp: true }));
      } else if (r1 < 0.52) {
        this.scriptQueue.push(buildRawInputFromNumpad(5, me.facing, { hp: true }));
      } else if (r1 < 0.7) {
        this.scriptQueue.push(buildRawInputFromNumpad(6, me.facing, { mp: true }));
      } else if (r1 < 0.85 && opp.y >= 0) {
        this.scriptQueue.push(
          buildRawInputFromNumpad(r2 < 0.4 ? 4 : 5, me.facing, {
            lp: true,
            lk: true,
            throwMacro: true
          })
        );
      } else if (me.meter >= 100 && r3 < 0.48) {
        this.scriptQueue.push(...buildMotionSequence('DQCF', me.facing, { hp: true }));
      } else {
        this.scriptQueue.push(buildRawInputFromNumpad(2, me.facing, { lk: true }));
      }
    }
  }

  private decideWarden(
    me: FighterState,
    opp: FighterState,
    dist: number,
    r1: number,
    r2: number,
    r3: number
  ): void {
    // Always hold Down-Back (1) while building charge so charge isn't prematurely lost!
    this.defaultHoldDir = 1;

    if (dist > 250) {
      if (me.chargeBackFrames >= 30 && r1 < 0.58) {
        const useEx = me.meter >= 150 && r2 < 0.25;
        this.scriptQueue.push(
          ...buildMotionSequence(
            'CHARGE_BF',
            me.facing,
            useEx ? { lp: true, mp: true } : r2 < 0.5 ? { lp: true } : { hp: true }
          )
        );
      } else if (me.chargeBackFrames >= 30 && r1 < 0.82) {
        this.scriptQueue.push(
          ...buildMotionSequence(
            'QCF',
            me.facing,
            me.meter >= 100 && r2 < 0.25 ? { lk: true, mk: true } : { hk: true }
          )
        );
      } else if (dist > 430 && r1 < 0.25) {
        this.scriptQueue.push(...buildMotionSequence('DASH_F', me.facing, {}));
      }
    } else if (dist > 135) {
      if (me.chargeBackFrames >= 30 && r1 < 0.34) {
        this.scriptQueue.push(
          ...buildMotionSequence(
            'CHARGE_BF',
            me.facing,
            me.meter >= 120 && r2 < 0.25 ? { lp: true, mp: true } : { mp: true }
          )
        );
      } else if (r1 < 0.58) {
        this.scriptQueue.push(
          ...buildMotionSequence(
            'QCF',
            me.facing,
            me.meter >= 100 && r2 < 0.25 ? { lk: true, mk: true } : { mk: true }
          )
        );
      } else if (r1 < 0.8) {
        this.scriptQueue.push(buildRawInputFromNumpad(2, me.facing, { mk: true }));
      } else {
        this.scriptQueue.push(buildRawInputFromNumpad(5, me.facing, { hp: true }));
      }
    } else {
      if (me.chargeDownFrames >= 30 && r1 < 0.36) {
        this.scriptQueue.push(
          ...buildMotionSequence(
            'CHARGE_DU',
            me.facing,
            me.meter >= 100 && r2 < 0.25 ? { lk: true, mk: true } : { hk: true }
          )
        );
      } else if (r1 < 0.55 && opp.y >= 0) {
        this.scriptQueue.push(
          buildRawInputFromNumpad(4, me.facing, { lp: true, lk: true, throwMacro: true })
        );
      } else if (r1 < 0.78) {
        this.scriptQueue.push(buildRawInputFromNumpad(2, me.facing, { mp: true }));
      } else if (me.meter >= 100 && r3 < 0.45) {
        this.scriptQueue.push(...buildMotionSequence('DQCF', me.facing, { hp: true }));
      }
    }
  }
}

/**
 * Generates input for the Training Mode Dummy based on selected DummyBehavior
 * or recorded playback slot.
 */
export function getTrainingDummyInput(
  state: MatchState,
  dummyIndex: 0 | 1,
  behavior: DummyBehavior,
  cpuFallback: CpuController
): RawInputFrame {
  const me = state.fighters[dummyIndex];
  const opp = state.fighters[dummyIndex === 0 ? 1 : 0];

  // Auto quick-rise in training mode
  if (me.status === 'knockdown' && me.quickRiseAvailable && me.statusFrame === 3) {
    return buildRawInputFromNumpad(2, me.facing, { lp: true });
  }

  switch (behavior) {
    case 'stand':
      return createEmptyInput();
    case 'crouch':
      return buildRawInputFromNumpad(2, me.facing);
    case 'jump':
      return buildRawInputFromNumpad(8, me.facing);
    case 'parry_always':
      if (opp.status === 'attack' && me.status === 'idle') {
        return buildRawInputFromNumpad(5, me.facing, { mp: true, mk: true, parryMacro: true });
      }
      return createEmptyInput();
    case 'block_always':
    case 'block_after_hit': {
      const shouldBlock =
        behavior === 'block_always' ||
        me.comboCounter > 0 ||
        me.status === 'block_stand' ||
        me.status === 'block_crouch' ||
        me.comboDisplayTimer > 40;

      if (!shouldBlock) return createEmptyInput();

      // Detect opponent's attack hit level so dummy blocks high/low/cross-up accurately
      const oppMove =
        opp.currentMoveId ? CHARACTERS[opp.charId].moves[opp.currentMoveId] : null;
      const isLow = oppMove?.hitLevel === 'low';
      const attackFromRight = opp.x >= me.x;
      const holdLeft = attackFromRight;
      return {
        ...createEmptyInput(),
        left: holdLeft,
        right: !holdLeft,
        down: isLow
      };
    }
    case 'cpu':
      return cpuFallback.getInput(state, dummyIndex);
  }
}
