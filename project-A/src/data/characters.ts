import {
  CharacterDef,
  CharacterId,
  MoveDef
} from '../core/types';
import {
  buildNormalMove,
  buildSpecialVariants,
  buildStandardThrows,
  DEFAULT_AIR_HURTBOXES,
  DEFAULT_AIR_PUSHBOX,
  DEFAULT_CROUCH_HURTBOXES,
  DEFAULT_CROUCH_PUSHBOX,
  DEFAULT_STAND_HURTBOXES,
  DEFAULT_STAND_PUSHBOX
} from './moveHelpers';

/**
 * Builds the 18 standard normals (6 standing, 6 crouching, 6 jumping) plus 2 command normals
 * tuned to each character's speed, reach, and damage profile.
 */
function buildCharacterNormals(opts: {
  reachScale: number;
  dmgScale: number;
  speedOffset: number; // -1 faster, 0 normal, +1 slower
  cmd6mpName: string;
  cmd6mpDesc: string;
  cmd3hkName: string;
  cmd3hkDesc: string;
}): Record<string, MoveDef> {
  const r = opts.reachScale;
  const d = opts.dmgScale;
  const s = opts.speedOffset;
  const rw = (w: number) => Math.round(w * r);
  const dm = (val: number) => Math.round(val * d);
  const st = (val: number) => Math.max(3, val + s);

  const moves: Record<string, MoveDef> = {};

  // Standing Normals
  moves['5LP'] = buildNormalMove({
    id: '5LP',
    name: 'Quick Jab',
    inputNotation: 'LP',
    description: 'Fast high jab that chains into itself or cancels into specials.',
    posture: 'standing',
    button: 'LP',
    startup: st(4),
    active: 3,
    recovery: 7,
    hitstun: 13,
    blockstun: 10,
    hitstop: 6,
    damage: dm(32),
    stunDamage: 45,
    pushbackHit: 22,
    pushbackBlock: 18,
    hitLevel: 'high',
    cancels: ['chain', 'special', 'super', 'ultimate'],
    hitbox: { x: 15, y: -145, w: rw(66), h: 28 },
    limbHurtbox: { x: 15, y: -148, w: rw(55), h: 32 },
    pose: 'punch_light',
    strength: 'light'
  });

  moves['5MP'] = buildNormalMove({
    id: '5MP',
    name: 'Cyber Straight',
    inputNotation: 'MP',
    description: 'Solid mid-range straight punch with favorable hit advantage for links and special cancels.',
    posture: 'standing',
    button: 'MP',
    startup: st(6),
    active: 4,
    recovery: 12,
    hitstun: 18,
    blockstun: 14,
    hitstop: 8,
    damage: dm(62),
    stunDamage: 85,
    pushbackHit: 36,
    pushbackBlock: 30,
    hitLevel: 'mid',
    cancels: ['special', 'super', 'ultimate'],
    hitbox: { x: 18, y: -140, w: rw(82), h: 34 },
    limbHurtbox: { x: 18, y: -142, w: rw(70), h: 36 },
    pose: 'punch_light',
    strength: 'medium'
  });

  moves['5HP'] = buildNormalMove({
    id: '5HP',
    name: 'Heavy Breaker',
    inputNotation: 'HP',
    description: 'High-impact heavy strike that crushes guard and cancels into specials or supers.',
    posture: 'standing',
    button: 'HP',
    startup: st(9),
    active: 5,
    recovery: 18,
    hitstun: 22,
    blockstun: 17,
    hitstop: 11,
    damage: dm(92),
    stunDamage: 130,
    pushbackHit: 54,
    pushbackBlock: 46,
    hitLevel: 'mid',
    cancels: ['special', 'super', 'ultimate'],
    hitbox: { x: 20, y: -145, w: rw(98), h: 40 },
    limbHurtbox: { x: 20, y: -148, w: rw(84), h: 42 },
    vx: 2.5,
    pose: 'punch_heavy',
    strength: 'heavy'
  });

  moves['5LK'] = buildNormalMove({
    id: '5LK',
    name: 'Snap Kick',
    inputNotation: 'LK',
    description: 'Quick shin check with good range that chains into lights or specials.',
    posture: 'standing',
    button: 'LK',
    startup: st(5),
    active: 3,
    recovery: 8,
    hitstun: 13,
    blockstun: 10,
    hitstop: 6,
    damage: dm(35),
    stunDamage: 50,
    pushbackHit: 25,
    pushbackBlock: 20,
    hitLevel: 'mid',
    cancels: ['chain', 'special', 'super', 'ultimate'],
    hitbox: { x: 16, y: -85, w: rw(74), h: 34 },
    limbHurtbox: { x: 16, y: -88, w: rw(62), h: 36 },
    pose: 'kick_low',
    strength: 'light'
  });

  moves['5MK'] = buildNormalMove({
    id: '5MK',
    name: 'Side Thrust Kick',
    inputNotation: 'MK',
    description: 'Long-reaching midsection poke ideal for neutral control.',
    posture: 'standing',
    button: 'MK',
    startup: st(7),
    active: 4,
    recovery: 14,
    hitstun: 18,
    blockstun: 14,
    hitstop: 8,
    damage: dm(66),
    stunDamage: 90,
    pushbackHit: 42,
    pushbackBlock: 36,
    hitLevel: 'mid',
    cancels: ['special', 'super', 'ultimate'],
    hitbox: { x: 18, y: -105, w: rw(92), h: 36 },
    limbHurtbox: { x: 18, y: -108, w: rw(78), h: 38 },
    pose: 'kick_high',
    strength: 'medium'
  });

  moves['5HK'] = buildNormalMove({
    id: '5HK',
    name: 'Tempest Roundhouse',
    inputNotation: 'HK',
    description: 'Devastating high roundhouse kick with long reach and heavy stun.',
    posture: 'standing',
    button: 'HK',
    startup: st(11),
    active: 5,
    recovery: 20,
    hitstun: 23,
    blockstun: 18,
    hitstop: 12,
    damage: dm(98),
    stunDamage: 140,
    pushbackHit: 65,
    pushbackBlock: 52,
    hitLevel: 'high',
    cancels: ['super', 'ultimate'],
    hitbox: { x: 20, y: -155, w: rw(106), h: 46 },
    limbHurtbox: { x: 20, y: -155, w: rw(90), h: 46 },
    vx: 3.0,
    pose: 'kick_high',
    strength: 'heavy'
  });

  // Crouching Normals
  moves['2LP'] = buildNormalMove({
    id: '2LP',
    name: 'Crouch Jab',
    inputNotation: '2 + LP',
    description: 'Fastest crouching check that chains into itself or cancels into specials.',
    posture: 'crouching',
    button: 'LP',
    startup: st(4),
    active: 3,
    recovery: 7,
    hitstun: 13,
    blockstun: 10,
    hitstop: 6,
    damage: dm(30),
    stunDamage: 40,
    pushbackHit: 20,
    pushbackBlock: 16,
    hitLevel: 'mid',
    cancels: ['chain', 'special', 'super', 'ultimate'],
    hitbox: { x: 15, y: -95, w: rw(66), h: 28 },
    pose: 'crouch',
    strength: 'light'
  });

  moves['2MP'] = buildNormalMove({
    id: '2MP',
    name: 'Low Cross',
    inputNotation: '2 + MP',
    description: 'Compact crouching punch with strong frame advantage for hit confirms.',
    posture: 'crouching',
    button: 'MP',
    startup: st(6),
    active: 4,
    recovery: 11,
    hitstun: 18,
    blockstun: 14,
    hitstop: 8,
    damage: dm(60),
    stunDamage: 85,
    pushbackHit: 34,
    pushbackBlock: 28,
    hitLevel: 'mid',
    cancels: ['special', 'super', 'ultimate'],
    hitbox: { x: 18, y: -95, w: rw(80), h: 32 },
    pose: 'crouch',
    strength: 'medium'
  });

  moves['2HP'] = buildNormalMove({
    id: '2HP',
    name: 'Skyward Upper',
    inputNotation: '2 + HP',
    description: 'Crouching anti-air uppercut with high vertical hitbox that intercepts jump-ins.',
    posture: 'crouching',
    button: 'HP',
    startup: st(8),
    active: 6,
    recovery: 19,
    hitstun: 22,
    blockstun: 16,
    hitstop: 11,
    damage: dm(90),
    stunDamage: 125,
    pushbackHit: 40,
    pushbackBlock: 36,
    hitLevel: 'mid',
    knockdown: 'launch',
    launchVx: 3.5,
    launchVy: -9.5,
    cancels: ['special', 'super', 'ultimate'],
    hitbox: { x: 14, y: -185, w: rw(72), h: 95 },
    pose: 'uppercut',
    strength: 'heavy'
  });

  moves['2LK'] = buildNormalMove({
    id: '2LK',
    name: 'Low Ankle Tap',
    inputNotation: '2 + LK',
    description: 'Fast low attack that must be blocked crouching and chains into 2LP.',
    posture: 'crouching',
    button: 'LK',
    startup: st(4),
    active: 3,
    recovery: 8,
    hitstun: 13,
    blockstun: 10,
    hitstop: 6,
    damage: dm(28),
    stunDamage: 40,
    pushbackHit: 20,
    pushbackBlock: 16,
    hitLevel: 'low',
    cancels: ['chain', 'special', 'super', 'ultimate'],
    hitbox: { x: 16, y: -42, w: rw(72), h: 34 },
    pose: 'kick_low',
    strength: 'light'
  });

  moves['2MK'] = buildNormalMove({
    id: '2MK',
    name: 'shin Cutter',
    inputNotation: '2 + MK',
    description: 'Signature low poke that cancels cleanly into specials for bread-and-butter combos.',
    posture: 'crouching',
    button: 'MK',
    startup: st(7),
    active: 4,
    recovery: 13,
    hitstun: 17,
    blockstun: 13,
    hitstop: 8,
    damage: dm(58),
    stunDamage: 80,
    pushbackHit: 36,
    pushbackBlock: 30,
    hitLevel: 'low',
    cancels: ['special', 'super', 'ultimate'],
    hitbox: { x: 18, y: -45, w: rw(92), h: 36 },
    pose: 'kick_low',
    strength: 'medium'
  });

  moves['2HK'] = buildNormalMove({
    id: '2HK',
    name: 'Cyber Sweep',
    inputNotation: '2 + HK',
    description: 'Long-reaching low sweep that inflicts a hard knockdown on hit.',
    posture: 'crouching',
    button: 'HK',
    startup: st(9),
    active: 5,
    recovery: 22,
    hitstun: 25,
    blockstun: 18,
    hitstop: 12,
    damage: dm(88),
    stunDamage: 120,
    pushbackHit: 55,
    pushbackBlock: 45,
    hitLevel: 'low',
    knockdown: 'hard',
    launchVx: 4.5,
    launchVy: -6.0,
    cancels: ['super', 'ultimate'],
    hitbox: { x: 20, y: -48, w: rw(108), h: 42 },
    pose: 'sweep',
    strength: 'heavy'
  });

  // Jumping Normals (all overheads!)
  moves['j.LP'] = buildNormalMove({
    id: 'j.LP',
    name: 'Air Jab',
    inputNotation: 'Air LP',
    description: 'Quick air-to-air jab.',
    posture: 'airborne',
    button: 'LP',
    startup: 4,
    active: 6,
    recovery: 10,
    hitstun: 14,
    blockstun: 11,
    hitstop: 6,
    damage: dm(35),
    stunDamage: 45,
    pushbackHit: 20,
    pushbackBlock: 16,
    hitLevel: 'overhead',
    cancels: ['special'],
    hitbox: { x: 12, y: -120, w: rw(62), h: 38 },
    pose: 'punch_light',
    strength: 'light'
  });

  moves['j.MP'] = buildNormalMove({
    id: 'j.MP',
    name: 'Air Knuckle',
    inputNotation: 'Air MP',
    description: 'Horizontal air-to-air strike that cancels into air specials.',
    posture: 'airborne',
    button: 'MP',
    startup: 6,
    active: 6,
    recovery: 12,
    hitstun: 17,
    blockstun: 13,
    hitstop: 8,
    damage: dm(62),
    stunDamage: 80,
    pushbackHit: 28,
    pushbackBlock: 22,
    hitLevel: 'overhead',
    cancels: ['special'],
    hitbox: { x: 14, y: -115, w: rw(76), h: 44 },
    pose: 'punch_heavy',
    strength: 'medium'
  });

  moves['j.HP'] = buildNormalMove({
    id: 'j.HP',
    name: 'Meteor Fist',
    inputNotation: 'Air HP',
    description: 'Downward-angled heavy jump-in punch for deep combo starters.',
    posture: 'airborne',
    button: 'HP',
    startup: 8,
    active: 6,
    recovery: 14,
    hitstun: 21,
    blockstun: 16,
    hitstop: 10,
    damage: dm(88),
    stunDamage: 120,
    pushbackHit: 34,
    pushbackBlock: 28,
    hitLevel: 'overhead',
    cancels: [],
    hitbox: { x: 10, y: -95, w: rw(84), h: 58 },
    pose: 'punch_heavy',
    strength: 'heavy'
  });

  moves['j.LK'] = buildNormalMove({
    id: 'j.LK',
    name: 'Air Knee Cross',
    inputNotation: 'Air LK',
    description: 'Compact jumping knee capable of crossing up standing opponents.',
    posture: 'airborne',
    button: 'LK',
    startup: 4,
    active: 7,
    recovery: 10,
    hitstun: 15,
    blockstun: 11,
    hitstop: 6,
    damage: dm(36),
    stunDamage: 50,
    pushbackHit: 18,
    pushbackBlock: 14,
    hitLevel: 'overhead',
    cancels: ['special'],
    hitbox: { x: -16, y: -90, w: rw(74), h: 46 },
    pose: 'kick_low',
    strength: 'light'
  });

  moves['j.MK'] = buildNormalMove({
    id: 'j.MK',
    name: 'Flying Cross Kick',
    inputNotation: 'Air MK',
    description: 'Versatile jump-in kick with cross-up hitbox behind the knee.',
    posture: 'airborne',
    button: 'MK',
    startup: 6,
    active: 6,
    recovery: 12,
    hitstun: 18,
    blockstun: 14,
    hitstop: 8,
    damage: dm(64),
    stunDamage: 85,
    pushbackHit: 26,
    pushbackBlock: 20,
    hitLevel: 'overhead',
    cancels: ['special'],
    hitbox: { x: -14, y: -95, w: rw(88), h: 48 },
    pose: 'kick_high',
    strength: 'medium'
  });

  moves['j.HK'] = buildNormalMove({
    id: 'j.HK',
    name: 'Sky Drop Kick',
    inputNotation: 'Air HK',
    description: 'Long-reaching jumping heavy kick that dominates air-to-ground approaches.',
    posture: 'airborne',
    button: 'HK',
    startup: 8,
    active: 6,
    recovery: 14,
    hitstun: 22,
    blockstun: 17,
    hitstop: 11,
    damage: dm(92),
    stunDamage: 125,
    pushbackHit: 38,
    pushbackBlock: 30,
    hitLevel: 'overhead',
    cancels: [],
    hitbox: { x: 14, y: -100, w: rw(96), h: 54 },
    pose: 'kick_high',
    strength: 'heavy'
  });

  // Command Normals
  moves['6MP'] = buildNormalMove({
    id: '6MP',
    name: opts.cmd6mpName,
    inputNotation: '6 + MP',
    description: opts.cmd6mpDesc,
    posture: 'standing',
    button: 'MP',
    commandDir: 6,
    startup: st(16),
    active: 4,
    recovery: 14,
    hitstun: 19,
    blockstun: 13,
    hitstop: 10,
    damage: dm(74),
    stunDamage: 105,
    pushbackHit: 36,
    pushbackBlock: 28,
    hitLevel: 'overhead',
    cancels: ['super', 'ultimate'],
    hitbox: { x: 18, y: -150, w: rw(86), h: 55 },
    vx: 3.8,
    pose: 'punch_heavy',
    strength: 'medium'
  });

  moves['3HK'] = buildNormalMove({
    id: '3HK',
    name: opts.cmd3hkName,
    inputNotation: '3 + HK',
    description: opts.cmd3hkDesc,
    posture: 'crouching',
    button: 'HK',
    commandDir: 3,
    startup: st(11),
    active: 6,
    recovery: 17,
    hitstun: 21,
    blockstun: 15,
    hitstop: 10,
    damage: dm(82),
    stunDamage: 115,
    pushbackHit: 48,
    pushbackBlock: 38,
    hitLevel: 'low',
    knockdown: 'soft',
    launchVx: 4.0,
    launchVy: -5.5,
    cancels: ['special', 'super', 'ultimate'],
    hitbox: { x: 20, y: -55, w: rw(102), h: 48 },
    vx: 5.5,
    pose: 'sweep',
    strength: 'heavy'
  });

  return moves;
}

// ============================================================================
// 1. HAYATE — Balanced Cyber-Ronin All-Rounder
// ============================================================================
function createHayate(): CharacterDef {
  const normals = buildCharacterNormals({
    reachScale: 1.02,
    dmgScale: 0.98,
    speedOffset: 0,
    cmd6mpName: 'Kabuto Splitter',
    cmd6mpDesc: 'Advancing overhead hilt strike that hits crouching opponents.',
    cmd3hkName: 'Jet Slide Kick',
    cmd3hkDesc: 'Low-profiling sliding kick that advances forward and cancels into specials.'
  });
  const throws = buildStandardThrows('Hayate', 'Izuna Whip Throw', 'Shadow Reverse Toss', 115, 72);

  // Special 1: Arc Kunai (QCF + P) — Fireball projectile
  const makeKunaiProj = (speed: number, dmg: number, hits: number, isEx: boolean) => ({
    id: isEx ? 'hayate_kunai_ex' : 'hayate_kunai',
    name: isEx ? 'Overclocked Arc Shuriken' : 'Arc Shuriken',
    spawnFrame: 11,
    offsetX: 52,
    offsetY: -115,
    vx: speed,
    vy: 0,
    width: isEx ? 54 : 44,
    height: isEx ? 44 : 34,
    damage: dmg,
    chipDamage: Math.round(dmg * 0.16),
    stunDamage: isEx ? 130 : 85,
    hitstun: isEx ? 22 : 18,
    blockstun: isEx ? 16 : 14,
    hitstop: isEx ? 9 : 7,
    pushbackHit: 42,
    pushbackBlock: 34,
    hitLevel: 'mid' as const,
    knockdown: isEx ? ('soft' as const) : ('none' as const),
    launchVx: isEx ? 5.5 : 0,
    launchVy: isEx ? -6.5 : 0,
    hits,
    lifetime: 140,
    color: isEx ? '#ff00aa' : '#00f0ff',
    coreColor: '#ffffff',
    style: 'shuriken' as const
  });

  const arcKunai = buildSpecialVariants({
    baseId: 'arc_kunai',
    baseName: 'Arc Shuriken',
    baseNotation: '236',
    description: 'Hurls an ionized plasma shuriken across the arena.',
    motion: 'QCF',
    buttonType: 'P',
    startup: [11, 12, 13, 9],
    active: [4, 4, 4, 5],
    recovery: [20, 21, 22, 17],
    damage: [68, 72, 78, 116],
    stunDamage: [85, 90, 95, 140],
    hitstun: [18, 18, 19, 22],
    blockstun: [14, 14, 15, 17],
    hitstop: [7, 7, 8, 9],
    pushbackHit: 40,
    pushbackBlock: 32,
    hitLevel: 'mid',
    knockdown: ['none', 'none', 'none', 'soft'],
    projectiles: [
      makeKunaiProj(9.5, 68, 1, false),
      makeKunaiProj(12.0, 72, 1, false),
      makeKunaiProj(15.0, 78, 1, false),
      makeKunaiProj(16.5, 58, 2, true)
    ],
    pose: 'punch_heavy'
  });

  // Special 2: Rising Raijin (DP + P) — Invincible rising katana uppercut
  const risingRaijin = buildSpecialVariants({
    baseId: 'rising_raijin',
    baseName: 'Rising Raijin',
    baseNotation: '623',
    description: 'Invincible ascending plasma-blade uppercut that destroys airborne approaches.',
    motion: 'DP',
    buttonType: 'P',
    startup: [5, 6, 7, 4],
    active: [10, 12, 14, 15],
    recovery: [22, 25, 28, 22],
    damage: [95, 108, 120, 148],
    stunDamage: [130, 145, 165, 195],
    hitstun: [25, 27, 29, 33],
    blockstun: [15, 16, 17, 19],
    hitstop: [11, 12, 13, 14],
    pushbackHit: 55,
    pushbackBlock: 45,
    hitLevel: 'mid',
    knockdown: ['launch', 'launch', 'hard', 'hard'],
    launchVx: [4.5, 5.2, 6.0, 6.5],
    launchVy: [-10.5, -11.5, -12.5, -13.5],
    vx: [4.5, 5.5, 6.5, 7.5],
    vy: [-9.0, -10.5, -12.0, -13.0],
    invuln: [
      [{ startFrame: 1, endFrame: 8, type: 'airborne' }],
      [{ startFrame: 1, endFrame: 9, type: 'strike' }],
      [{ startFrame: 1, endFrame: 10, type: 'full' }],
      [{ startFrame: 1, endFrame: 14, type: 'full' }]
    ],
    hitbox: { x: 10, y: -195, w: 94, h: 145 },
    pose: 'uppercut'
  });

  // Special 3: Tempest Whirlwind (QCB + K) — Spinning advancing kick
  const tempestWhirl = buildSpecialVariants({
    baseId: 'tempest_whirl',
    baseName: 'Tempest Cyclone',
    baseNotation: '214',
    description: 'Spinning cyber-heel advancing kick that carries the opponent toward the corner.',
    motion: 'QCB',
    buttonType: 'K',
    startup: [9, 10, 12, 7],
    active: [10, 14, 18, 18],
    recovery: [16, 18, 19, 14],
    damage: [78, 46, 36, 44],
    stunDamage: [105, 65, 52, 65],
    hitstun: [21, 22, 24, 27],
    blockstun: [14, 15, 16, 18],
    hitstop: [9, 8, 8, 9],
    pushbackHit: 48,
    pushbackBlock: 36,
    hitLevel: 'mid',
    knockdown: ['soft', 'soft', 'hard', 'launch'],
    launchVx: [5.5, 6.0, 6.5, 4.5],
    launchVy: [-6.5, -7.0, -7.5, -10.5],
    multiHitFrames: [undefined, [10, 17], [12, 18, 24], [7, 13, 19]],
    vx: [8.0, 9.0, 10.0, 11.5],
    vy: [-1.5, -1.8, -2.0, -2.2],
    invuln: [
      [{ startFrame: 2, endFrame: 15, type: 'projectile' }],
      [{ startFrame: 2, endFrame: 18, type: 'projectile' }],
      [{ startFrame: 2, endFrame: 22, type: 'projectile' }],
      [{ startFrame: 1, endFrame: 22, type: 'projectile' }]
    ],
    hitbox: { x: -10, y: -145, w: 112, h: 95 },
    pose: 'kick_spin'
  });

  // Super Art (Level 1, 100 meter)
  const superArt: MoveDef = {
    id: 'super_art',
    name: 'Ion Storm Barrage',
    inputNotation: '236236 + P',
    description: 'SUPER ART: Unleashes a hyper-velocity multi-slash katana storm enveloped in cyan lightning.',
    category: 'super',
    posture: 'standing',
    motion: 'DQCF',
    button: 'LP', // Triggered by any P with DQCF
    meterCost: 100,
    startup: 7,
    active: 22,
    recovery: 24,
    totalFrames: 53,
    hitstun: 32,
    blockstun: 20,
    hitstop: 8,
    damage: 72, // x4 hits = ~260 scaled
    chipDamage: 14,
    stunDamage: 65,
    meterGainWhiff: 0,
    meterGainHit: 0,
    meterGainBlock: 0,
    pushbackHit: 36,
    pushbackBlock: 30,
    hitLevel: 'mid',
    knockdown: 'hard',
    launchVx: 7.5,
    launchVy: -10.5,
    juggleCost: 1,
    juggleLimit: 10,
    multiHitFrames: [7, 12, 17, 23],
    cinematicFreeze: 28,
    cancelWindows: [],
    invincibility: [{ startFrame: 1, endFrame: 15, type: 'full' }],
    movement: [{ startFrame: 7, endFrame: 26, vx: 10.5 }],
    boxes: {
      startupHurtboxes: DEFAULT_STAND_HURTBOXES,
      activeHurtboxes: DEFAULT_STAND_HURTBOXES,
      recoveryHurtboxes: DEFAULT_STAND_HURTBOXES,
      hitboxes: [{ x: 10, y: -175, w: 135, h: 145 }]
    },
    hitSparkStrength: 'super',
    pose: 'super_cast'
  };

  // Ultimate Art (200 meter, requires HP <= 35%)
  const ultimateArt: MoveDef = {
    id: 'ultimate_art',
    name: 'Kusanagi Zero Protocol',
    inputNotation: '236236 + PP (Low HP)',
    description: 'ULTIMATE ART: Overclocks cybernetic implants to sever space-time in a five-hit judgment slash.',
    category: 'ultimate',
    posture: 'standing',
    motion: 'DQCF',
    button: 'PP',
    meterCost: 200,
    requiresLowHealth: true,
    startup: 5,
    active: 28,
    recovery: 26,
    totalFrames: 59,
    hitstun: 38,
    blockstun: 24,
    hitstop: 10,
    damage: 86, // x5 hits = ~380 scaled
    chipDamage: 18,
    stunDamage: 80,
    meterGainWhiff: 0,
    meterGainHit: 0,
    meterGainBlock: 0,
    pushbackHit: 40,
    pushbackBlock: 35,
    hitLevel: 'mid',
    knockdown: 'hard',
    launchVx: 8.5,
    launchVy: -12.5,
    juggleCost: 1,
    juggleLimit: 15,
    multiHitFrames: [5, 10, 15, 20, 27],
    cinematicFreeze: 42,
    cancelWindows: [],
    invincibility: [{ startFrame: 1, endFrame: 22, type: 'full' }],
    movement: [{ startFrame: 5, endFrame: 30, vx: 12.5 }],
    boxes: {
      startupHurtboxes: DEFAULT_STAND_HURTBOXES,
      activeHurtboxes: DEFAULT_STAND_HURTBOXES,
      recoveryHurtboxes: DEFAULT_STAND_HURTBOXES,
      hitboxes: [{ x: 10, y: -190, w: 160, h: 165 }]
    },
    hitSparkStrength: 'super',
    pose: 'super_cast'
  };

  const moves: Record<string, MoveDef> = {
    ...normals,
    ...throws,
    ...arcKunai,
    ...risingRaijin,
    ...tempestWhirl,
    super_art: superArt,
    ultimate_art: ultimateArt
  };

  const moveOrder = [
    'ultimate_art',
    'super_art',
    'rising_raijin_ex',
    'arc_kunai_ex',
    'tempest_whirl_ex',
    'rising_raijin_h',
    'rising_raijin_m',
    'rising_raijin_l',
    'arc_kunai_h',
    'arc_kunai_m',
    'arc_kunai_l',
    'tempest_whirl_h',
    'tempest_whirl_m',
    'tempest_whirl_l',
    'throw_b',
    'throw_f',
    '6MP',
    '3HK',
    'j.HP',
    'j.HK',
    'j.MP',
    'j.MK',
    'j.LP',
    'j.LK',
    '2HP',
    '2HK',
    '5HP',
    '5HK',
    '2MP',
    '2MK',
    '5MP',
    '5MK',
    '2LP',
    '2LK',
    '5LP',
    '5LK'
  ];

  return {
    id: 'hayate',
    name: 'HAYATE',
    title: 'THE NEON RONIN',
    archetype: 'ALL-ROUNDER',
    origin: 'SECTOR 7 // SHIN-GION',
    bio: 'An exiled cyber-samurai wielding a high-frequency plasma katana. Enters the Neon Tempest tournament to dismantle the Zaibatsu syndicate from within.',
    arcadeIntro: 'Rain hisses against Hayate’s heated plasma blade as the holographic gates of the Neo-Kyoto Underground ignite.',
    arcadeEnding: 'With the syndicate’s final champion defeated, Hayate severs the central neural spire—freeing Sector 7 into the neon dawn.',
    quoteWin: 'Your reflexes lag by three milliseconds. In Neo-Kyoto, that is eternity.',
    maxHp: 1000,
    maxStun: 1000,
    walkForwardSpeed: 5.0,
    walkBackwardSpeed: 3.9,
    dashForwardVx: 11.5,
    dashForwardFrames: 15,
    dashBackwardVx: -9.5,
    dashBackwardVy: -3.5,
    dashBackwardFrames: 16,
    jumpVx: 5.2,
    jumpVy: -15.2,
    gravity: 0.72,
    preJumpFrames: 3,
    maxAirJumps: 0,
    maxAirDashes: 0,
    airDashVx: 0,
    airDashFrames: 0,
    standPushbox: DEFAULT_STAND_PUSHBOX,
    crouchPushbox: DEFAULT_CROUCH_PUSHBOX,
    airPushbox: DEFAULT_AIR_PUSHBOX,
    standHurtboxes: DEFAULT_STAND_HURTBOXES,
    crouchHurtboxes: DEFAULT_CROUCH_HURTBOXES,
    airHurtboxes: DEFAULT_AIR_HURTBOXES,
    stats: { power: 7, speed: 7, range: 7, technique: 8, defense: 7 },
    palette: {
      primary: '#00f0ff',
      secondary: '#0b2244',
      accent: '#ff007f',
      glow: '#00f0ff',
      skin: '#e0c0a8',
      clothDark: '#0a1224'
    },
    altPalette: {
      primary: '#ffbe00',
      secondary: '#2b123a',
      accent: '#00ffaa',
      glow: '#ffbe00',
      skin: '#d8b498',
      clothDark: '#1a0a24'
    },
    moves,
    moveOrder,
    trials: [
      {
        id: 'hayate_trial_1',
        name: 'TRIAL 01 // STREET RONIN',
        difficulty: 'BASIC',
        description: 'Confirm a crouching medium kick into Arc Shuriken.',
        steps: [
          { moveId: '2MK', label: 'Shin Cutter', notation: '2 + MK' },
          { moveId: 'arc_kunai_l', label: 'Arc Shuriken', notation: '236 + P' }
        ]
      },
      {
        id: 'hayate_trial_2',
        name: 'TRIAL 02 // STORM ASCENSION',
        difficulty: 'INTERMEDIATE',
        description: 'Jump-in heavy punch into standing medium punch and Rising Raijin.',
        steps: [
          { moveId: 'j.HP', label: 'Meteor Fist', notation: 'Air HP' },
          { moveId: '5MP', label: 'Cyber Straight', notation: 'MP' },
          { moveId: 'rising_raijin_h', label: 'Rising Raijin', notation: '623 + P' }
        ]
      },
      {
        id: 'hayate_trial_3',
        name: 'TRIAL 03 // ION OVERCLOCK',
        difficulty: 'ADVANCED',
        description: 'Cancel Heavy Breaker into EX Tempest Cyclone, then Super Cancel into Ion Storm Barrage.',
        steps: [
          { moveId: '5HP', label: 'Heavy Breaker', notation: 'HP' },
          { moveId: 'tempest_whirl_ex', label: 'Tempest Cyclone (EX)', notation: '214 + KK' },
          { moveId: 'super_art', label: 'Ion Storm Barrage', notation: '236236 + P' }
        ]
      }
    ]
  };
}

// ============================================================================
// 2. MAGNUS — Heavy Cyber-Juggernaut Grappler
// ============================================================================
function createMagnus(): CharacterDef {
  const normals = buildCharacterNormals({
    reachScale: 1.05,
    dmgScale: 1.06,
    speedOffset: 1,
    cmd6mpName: 'Anvil Hammer',
    cmd6mpDesc: 'Crushing two-handed overhead piston smash that breaks crouching guards.',
    cmd3hkName: 'Tremor Slide',
    cmd3hkDesc: 'Heavy hydraulic leg sweep that knocks opponents off their feet.'
  });
  const throws = buildStandardThrows('Magnus', 'Spine Breaker Slam', 'Suplex Catapult', 134, 82);

  // Special 1: Tectonic Crusher (360 + P) — Unblockable Command Grab!
  const tectonicCrusher = buildSpecialVariants({
    baseId: 'tectonic_crusher',
    baseName: 'Tectonic Buster',
    baseNotation: '360',
    description: 'UNBLOCKABLE 360 command grab that hoists the opponent high and pile-drives them into the floor.',
    motion: '360',
    buttonType: 'P',
    startup: [6, 7, 8, 5],
    active: [3, 3, 4, 4],
    recovery: [25, 27, 29, 23],
    damage: [140, 154, 168, 195],
    stunDamage: [175, 190, 205, 235],
    hitstun: [35, 35, 35, 40],
    blockstun: [0, 0, 0, 0],
    hitstop: [16, 16, 18, 20],
    pushbackHit: 130,
    pushbackBlock: 0,
    hitLevel: 'throw',
    knockdown: ['hard', 'hard', 'hard', 'hard'],
    launchVx: [6.0, 6.5, 7.0, 7.5],
    launchVy: [-9.0, -10.0, -11.0, -12.0],
    invuln: [
      undefined,
      undefined,
      [{ startFrame: 1, endFrame: 6, type: 'throw' }],
      [{ startFrame: 1, endFrame: 8, type: 'throw' }]
    ],
    armor: [
      undefined,
      undefined,
      { startFrame: 1, endFrame: 6, hits: 1 },
      { startFrame: 1, endFrame: 8, hits: 2 }
    ],
    throwbox: { x: 10, y: -165, w: 102, h: 136 },
    pose: 'command_grab'
  });

  // Special 2: Juggernaut Rush (HCF + P) — Armored charging tackle
  const juggernautRush = buildSpecialVariants({
    baseId: 'juggernaut_rush',
    baseName: 'Juggernaut Charge',
    baseNotation: '41236',
    description: 'Armored hydraulic shoulder charge that powers through enemy pokes and blasts them backward.',
    motion: 'HCF',
    buttonType: 'P',
    startup: [10, 12, 13, 8],
    active: [10, 11, 13, 13],
    recovery: [20, 22, 24, 18],
    damage: [94, 104, 116, 142],
    stunDamage: [130, 145, 160, 190],
    hitstun: [22, 24, 26, 30],
    blockstun: [14, 15, 16, 18],
    hitstop: [13, 14, 15, 16],
    pushbackHit: 88,
    pushbackBlock: 54,
    hitLevel: 'mid',
    knockdown: ['soft', 'hard', 'hard', 'launch'],
    launchVx: [7.2, 8.2, 9.2, 6.2],
    launchVy: [-6.5, -7.5, -8.5, -11.0],
    vx: [8.8, 10.0, 11.2, 12.8],
    armor: [
      { startFrame: 2, endFrame: 16, hits: 1 },
      { startFrame: 2, endFrame: 17, hits: 1 },
      { startFrame: 2, endFrame: 19, hits: 1 },
      { startFrame: 1, endFrame: 19, hits: 2 }
    ],
    hitbox: { x: 10, y: -155, w: 110, h: 115 },
    pose: 'shoulder_charge'
  });

  // Special 3: Seismic Vice (QCB + K) — Ground shockwave & lariat
  const seismicVice = buildSpecialVariants({
    baseId: 'seismic_vice',
    baseName: 'Seismic Lariat',
    baseNotation: '214',
    description: 'Spinning double-arm piston lariat that crushes jump-ins and close attackers.',
    motion: 'QCB',
    buttonType: 'K',
    startup: [8, 9, 11, 6],
    active: [10, 12, 14, 14],
    recovery: [19, 21, 23, 17],
    damage: [94, 106, 118, 146],
    stunDamage: [122, 138, 158, 188],
    hitstun: [22, 24, 26, 30],
    blockstun: [14, 15, 16, 18],
    hitstop: [11, 12, 13, 14],
    pushbackHit: 66,
    pushbackBlock: 48,
    hitLevel: 'mid',
    knockdown: ['soft', 'soft', 'hard', 'launch'],
    launchVx: [5.5, 6.5, 7.5, 4.5],
    launchVy: [-7.0, -8.0, -9.0, -11.5],
    vx: [5.0, 6.0, 7.0, 8.0],
    invuln: [
      [{ startFrame: 2, endFrame: 14, type: 'projectile' }],
      [{ startFrame: 2, endFrame: 15, type: 'projectile' }],
      [{ startFrame: 1, endFrame: 16, type: 'airborne' }],
      [{ startFrame: 1, endFrame: 16, type: 'strike' }]
    ],
    hitbox: { x: -20, y: -175, w: 136, h: 125 },
    pose: 'lariat'
  });

  const superArt: MoveDef = {
    id: 'super_art',
    name: 'Vulcan Pilebunker',
    inputNotation: '236236 + P',
    description: 'SUPER ART: Fires twin pneumatic furnace pistons across the torso in a three-stage seismic eruption.',
    category: 'super',
    posture: 'standing',
    motion: 'DQCF',
    button: 'LP',
    meterCost: 100,
    startup: 8,
    active: 20,
    recovery: 24,
    totalFrames: 52,
    hitstun: 34,
    blockstun: 22,
    hitstop: 11,
    damage: 92, // x3 hits
    chipDamage: 16,
    stunDamage: 90,
    meterGainWhiff: 0,
    meterGainHit: 0,
    meterGainBlock: 0,
    pushbackHit: 55,
    pushbackBlock: 45,
    hitLevel: 'mid',
    knockdown: 'hard',
    launchVx: 9.0,
    launchVy: -11.0,
    juggleCost: 1,
    juggleLimit: 10,
    multiHitFrames: [8, 15, 22],
    cinematicFreeze: 28,
    cancelWindows: [],
    invincibility: [{ startFrame: 1, endFrame: 14, type: 'full' }],
    movement: [{ startFrame: 8, endFrame: 22, vx: 8.5 }],
    boxes: {
      startupHurtboxes: DEFAULT_STAND_HURTBOXES,
      activeHurtboxes: DEFAULT_STAND_HURTBOXES,
      recoveryHurtboxes: DEFAULT_STAND_HURTBOXES,
      hitboxes: [{ x: 10, y: -180, w: 155, h: 155 }]
    },
    hitSparkStrength: 'super',
    pose: 'super_cast'
  };

  const ultimateArt: MoveDef = {
    id: 'ultimate_art',
    name: 'Omega Meteor Drop',
    inputNotation: '236236 + PP (Low HP)',
    description: 'ULTIMATE ART: Overloads fusion core and delivers an earth-shattering hyper-impact cataclysm.',
    category: 'ultimate',
    posture: 'standing',
    motion: 'DQCF',
    button: 'PP',
    meterCost: 200,
    requiresLowHealth: true,
    startup: 6,
    active: 24,
    recovery: 26,
    totalFrames: 56,
    hitstun: 42,
    blockstun: 26,
    hitstop: 14,
    damage: 106, // x4 hits
    chipDamage: 20,
    stunDamage: 105,
    meterGainWhiff: 0,
    meterGainHit: 0,
    meterGainBlock: 0,
    pushbackHit: 65,
    pushbackBlock: 50,
    hitLevel: 'mid',
    knockdown: 'hard',
    launchVx: 10.0,
    launchVy: -13.5,
    juggleCost: 1,
    juggleLimit: 15,
    multiHitFrames: [6, 12, 18, 25],
    cinematicFreeze: 42,
    cancelWindows: [],
    invincibility: [{ startFrame: 1, endFrame: 20, type: 'full' }],
    movement: [{ startFrame: 6, endFrame: 26, vx: 10.5 }],
    boxes: {
      startupHurtboxes: DEFAULT_STAND_HURTBOXES,
      activeHurtboxes: DEFAULT_STAND_HURTBOXES,
      recoveryHurtboxes: DEFAULT_STAND_HURTBOXES,
      hitboxes: [{ x: 10, y: -195, w: 175, h: 175 }]
    },
    hitSparkStrength: 'super',
    pose: 'super_cast'
  };

  const moves: Record<string, MoveDef> = {
    ...normals,
    ...throws,
    ...tectonicCrusher,
    ...juggernautRush,
    ...seismicVice,
    super_art: superArt,
    ultimate_art: ultimateArt
  };

  const moveOrder = [
    'ultimate_art',
    'super_art',
    'tectonic_crusher_ex',
    'juggernaut_rush_ex',
    'seismic_vice_ex',
    'tectonic_crusher_h',
    'tectonic_crusher_m',
    'tectonic_crusher_l',
    'juggernaut_rush_h',
    'juggernaut_rush_m',
    'juggernaut_rush_l',
    'seismic_vice_h',
    'seismic_vice_m',
    'seismic_vice_l',
    'throw_b',
    'throw_f',
    '6MP',
    '3HK',
    'j.HP',
    'j.HK',
    'j.MP',
    'j.MK',
    'j.LP',
    'j.LK',
    '2HP',
    '2HK',
    '5HP',
    '5HK',
    '2MP',
    '2MK',
    '5MP',
    '5MK',
    '2LP',
    '2LK',
    '5LP',
    '5LK'
  ];

  return {
    id: 'magnus',
    name: 'MAGNUS',
    title: 'THE CHROME TITAN',
    archetype: 'GRAPPLER',
    origin: 'DOCKS // IRON FOUNDRY 09',
    bio: 'A towering former industrial loader augmented with military-grade hydraulic pistons. Fights to buy freedom for the dockworkers of Neo-Kyoto.',
    arcadeIntro: 'Steam vents roar from Magnus’s chrome shoulders as his heavy boots crack the neon-lit concrete.',
    arcadeEnding: 'Magnus tears down the syndicate’s debt vaults with his bare hydraulic gauntlets, returning the Docks to the workers.',
    quoteWin: 'Steel bends. Neon shatters. Only the Foundry endures!',
    maxHp: 1075,
    maxStun: 1085,
    walkForwardSpeed: 3.7,
    walkBackwardSpeed: 2.9,
    dashForwardVx: 9.5,
    dashForwardFrames: 16,
    dashBackwardVx: -7.8,
    dashBackwardVy: -2.8,
    dashBackwardFrames: 18,
    jumpVx: 4.4,
    jumpVy: -14.2,
    gravity: 0.75,
    preJumpFrames: 4,
    maxAirJumps: 0,
    maxAirDashes: 0,
    airDashVx: 0,
    airDashFrames: 0,
    standPushbox: { x: -40, y: -165, w: 80, h: 165 },
    crouchPushbox: { x: -42, y: -115, w: 84, h: 115 },
    airPushbox: { x: -38, y: -150, w: 76, h: 120 },
    standHurtboxes: [
      { x: -32, y: -190, w: 64, h: 48 },
      { x: -44, y: -142, w: 88, h: 78 },
      { x: -40, y: -64, w: 80, h: 64 }
    ],
    crouchHurtboxes: [
      { x: -36, y: -130, w: 72, h: 45 },
      { x: -46, y: -85, w: 92, h: 85 }
    ],
    airHurtboxes: [{ x: -38, y: -165, w: 76, h: 125 }],
    stats: { power: 10, speed: 4, range: 8, technique: 6, defense: 10 },
    palette: {
      primary: '#ff5500',
      secondary: '#2b1b18',
      accent: '#00f0ff',
      glow: '#ff6600',
      skin: '#c69076',
      clothDark: '#1a1110'
    },
    altPalette: {
      primary: '#00ff66',
      secondary: '#142822',
      accent: '#ff00aa',
      glow: '#00ff66',
      skin: '#b88268',
      clothDark: '#0b1814'
    },
    moves,
    moveOrder,
    trials: [
      {
        id: 'magnus_trial_1',
        name: 'TRIAL 01 // HYDRAULIC RUSH',
        difficulty: 'BASIC',
        description: 'Combo Standing Medium Punch into Juggernaut Charge.',
        steps: [
          { moveId: '5MP', label: 'Cyber Straight', notation: 'MP' },
          { moveId: 'juggernaut_rush_l', label: 'Juggernaut Charge', notation: '41236 + P' }
        ]
      },
      {
        id: 'magnus_trial_2',
        name: 'TRIAL 02 // SEISMIC CRUSHER',
        difficulty: 'INTERMEDIATE',
        description: 'Land a jumping heavy punch into Heavy Breaker and Seismic Lariat.',
        steps: [
          { moveId: 'j.HP', label: 'Meteor Fist', notation: 'Air HP' },
          { moveId: '5HP', label: 'Heavy Breaker', notation: 'HP' },
          { moveId: 'seismic_vice_h', label: 'Seismic Lariat', notation: '214 + K' }
        ]
      },
      {
        id: 'magnus_trial_3',
        name: 'TRIAL 03 // VULCAN MELTDOWN',
        difficulty: 'ADVANCED',
        description: 'Cancel Crouching Medium Punch into EX Seismic Lariat, then Super Cancel into Vulcan Pilebunker.',
        steps: [
          { moveId: '2MP', label: 'Low Cross', notation: '2 + MP' },
          { moveId: 'seismic_vice_ex', label: 'Seismic Lariat (EX)', notation: '214 + KK' },
          { moveId: 'super_art', label: 'Vulcan Pilebunker', notation: '236236 + P' }
        ]
      }
    ]
  };
}

// ============================================================================
// 3. SABLE — Fast Rushdown Assassin (Double Jump + Air Dash + Teleport)
// ============================================================================
function createSable(): CharacterDef {
  const normals = buildCharacterNormals({
    reachScale: 0.97,
    dmgScale: 0.90,
    speedOffset: -1,
    cmd6mpName: 'Mantis Hop Slash',
    cmd6mpDesc: 'Quick acrobatic flip-slash that hits overhead against crouching foes.',
    cmd3hkName: 'Shadow Razor Slide',
    cmd3hkDesc: 'Ultra-fast low slide that closes distance instantly and cancels into specials.'
  });
  const throws = buildStandardThrows('Sable', 'Wraith Neck Scissor', 'Mirage Backflip Throw', 104, 68);

  // Special 1: Viper Flurry (QCF + P) — Multi-hit advancing blade string
  const viperFlurry = buildSpecialVariants({
    baseId: 'viper_flurry',
    baseName: 'Viper Twin-Fang',
    baseNotation: '236',
    description: 'Lunging twin-vibroblade rush that shreds defenses with multi-hit pressure.',
    motion: 'QCF',
    buttonType: 'P',
    startup: [6, 7, 8, 5],
    active: [10, 14, 18, 18],
    recovery: [15, 17, 18, 13],
    damage: [74, 44, 35, 44],
    stunDamage: [95, 56, 46, 56],
    hitstun: [20, 22, 24, 28],
    blockstun: [13, 14, 15, 18],
    hitstop: [8, 8, 8, 8],
    pushbackHit: 40,
    pushbackBlock: 32,
    hitLevel: 'mid',
    knockdown: ['none', 'soft', 'hard', 'launch'],
    launchVx: [0, 5.0, 6.0, 4.5],
    launchVy: [0, -6.5, -7.5, -11.0],
    multiHitFrames: [undefined, [7, 14], [8, 14, 20], [5, 11, 17]],
    vx: [8.4, 9.6, 10.8, 12.4],
    hitbox: { x: 12, y: -150, w: 100, h: 96 },
    pose: 'blade_slash'
  });

  // Special 2: Phantom Blink (QCB + K) — Optical camo teleport cross-up strike!
  const phantomBlink = buildSpecialVariants({
    baseId: 'phantom_blink',
    baseName: 'Phantom Blink',
    baseNotation: '214',
    description: 'Cloaks in holographic static to warp forward (L) or directly behind the opponent (M/H/EX) with a cross-up slash.',
    motion: 'QCB',
    buttonType: 'K',
    startup: [11, 13, 15, 9],
    active: [6, 6, 6, 8],
    recovery: [16, 18, 20, 14],
    damage: [72, 78, 86, 110],
    stunDamage: [90, 100, 112, 145],
    hitstun: [20, 22, 24, 28],
    blockstun: [12, 13, 14, 17],
    hitstop: [8, 9, 10, 11],
    pushbackHit: 36,
    pushbackBlock: 28,
    hitLevel: 'mid',
    knockdown: ['none', 'soft', 'hard', 'launch'],
    launchVx: [0, 5.0, 6.0, 4.5],
    launchVy: [0, -6.5, -7.5, -10.5],
    teleportOffsetX: [160, 0, 0, 0],
    teleportBehind: [false, true, true, true],
    invuln: [
      [{ startFrame: 2, endFrame: 9, type: 'projectile' }],
      [{ startFrame: 2, endFrame: 10, type: 'projectile' }],
      [{ startFrame: 2, endFrame: 11, type: 'strike' }],
      [{ startFrame: 1, endFrame: 10, type: 'full' }]
    ],
    hitbox: { x: -14, y: -150, w: 102, h: 106 },
    pose: 'teleport'
  });

  // Special 3: Nightfall Dive (QCF + K, posture: 'any') — Divekick / Crescent Blitz
  const nightfallDive = buildSpecialVariants({
    baseId: 'nightfall_dive',
    baseName: 'Nightfall Crescent',
    baseNotation: '236',
    description: 'Acrobatic plasma-heel dive slash usable on the ground or in mid-air for relentless rushdown.',
    motion: 'QCF',
    buttonType: 'K',
    posture: 'any',
    startup: [8, 9, 10, 6],
    active: [10, 10, 11, 12],
    recovery: [13, 14, 15, 11],
    damage: [82, 92, 100, 128],
    stunDamage: [102, 115, 128, 160],
    hitstun: [20, 22, 24, 28],
    blockstun: [13, 14, 15, 18],
    hitstop: [9, 10, 11, 12],
    pushbackHit: 42,
    pushbackBlock: 30,
    hitLevel: 'mid',
    knockdown: ['soft', 'soft', 'hard', 'launch'],
    launchVx: [4.5, 5.0, 5.8, 4.0],
    launchVy: [-6.5, -7.0, -8.0, -10.5],
    vx: [9.2, 10.5, 11.8, 13.2],
    vy: [4.5, 5.0, 5.5, 6.0],
    hitbox: { x: 10, y: -125, w: 100, h: 98 },
    pose: 'kick_spin'
  });

  const superArt: MoveDef = {
    id: 'super_art',
    name: 'Mirage Dance',
    inputNotation: '236236 + P',
    description: 'SUPER ART: Splits into magenta holo-clones that carve the target in a five-hit phantom blitz.',
    category: 'super',
    posture: 'standing',
    motion: 'DQCF',
    button: 'LP',
    meterCost: 100,
    startup: 6,
    active: 24,
    recovery: 22,
    totalFrames: 52,
    hitstun: 32,
    blockstun: 20,
    hitstop: 7,
    damage: 58, // x5 hits
    chipDamage: 11,
    stunDamage: 55,
    meterGainWhiff: 0,
    meterGainHit: 0,
    meterGainBlock: 0,
    pushbackHit: 32,
    pushbackBlock: 28,
    hitLevel: 'mid',
    knockdown: 'hard',
    launchVx: 7.0,
    launchVy: -10.5,
    juggleCost: 1,
    juggleLimit: 12,
    multiHitFrames: [6, 10, 14, 19, 25],
    cinematicFreeze: 28,
    cancelWindows: [],
    invincibility: [{ startFrame: 1, endFrame: 13, type: 'full' }],
    movement: [{ startFrame: 6, endFrame: 26, vx: 11.5 }],
    boxes: {
      startupHurtboxes: DEFAULT_STAND_HURTBOXES,
      activeHurtboxes: DEFAULT_STAND_HURTBOXES,
      recoveryHurtboxes: DEFAULT_STAND_HURTBOXES,
      hitboxes: [{ x: 10, y: -170, w: 135, h: 140 }]
    },
    hitSparkStrength: 'super',
    pose: 'super_cast'
  };

  const ultimateArt: MoveDef = {
    id: 'ultimate_art',
    name: 'Eclipse Execution',
    inputNotation: '236236 + PP (Low HP)',
    description: 'ULTIMATE ART: Plunges the arena into neon darkness and strikes from every shadow in a six-hit assassination.',
    category: 'ultimate',
    posture: 'standing',
    motion: 'DQCF',
    button: 'PP',
    meterCost: 200,
    requiresLowHealth: true,
    startup: 5,
    active: 30,
    recovery: 24,
    totalFrames: 59,
    hitstun: 38,
    blockstun: 24,
    hitstop: 8,
    damage: 68, // x6 hits
    chipDamage: 14,
    stunDamage: 65,
    meterGainWhiff: 0,
    meterGainHit: 0,
    meterGainBlock: 0,
    pushbackHit: 36,
    pushbackBlock: 32,
    hitLevel: 'mid',
    knockdown: 'hard',
    launchVx: 8.0,
    launchVy: -12.0,
    juggleCost: 1,
    juggleLimit: 15,
    multiHitFrames: [5, 9, 13, 18, 23, 29],
    cinematicFreeze: 42,
    cancelWindows: [],
    invincibility: [{ startFrame: 1, endFrame: 20, type: 'full' }],
    movement: [{ startFrame: 5, endFrame: 31, vx: 12.8 }],
    boxes: {
      startupHurtboxes: DEFAULT_STAND_HURTBOXES,
      activeHurtboxes: DEFAULT_STAND_HURTBOXES,
      recoveryHurtboxes: DEFAULT_STAND_HURTBOXES,
      hitboxes: [{ x: 10, y: -185, w: 158, h: 160 }]
    },
    hitSparkStrength: 'super',
    pose: 'super_cast'
  };

  const moves: Record<string, MoveDef> = {
    ...normals,
    ...throws,
    ...viperFlurry,
    ...phantomBlink,
    ...nightfallDive,
    super_art: superArt,
    ultimate_art: ultimateArt
  };

  const moveOrder = [
    'ultimate_art',
    'super_art',
    'viper_flurry_ex',
    'phantom_blink_ex',
    'nightfall_dive_ex',
    'viper_flurry_h',
    'viper_flurry_m',
    'viper_flurry_l',
    'phantom_blink_h',
    'phantom_blink_m',
    'phantom_blink_l',
    'nightfall_dive_h',
    'nightfall_dive_m',
    'nightfall_dive_l',
    'throw_b',
    'throw_f',
    '6MP',
    '3HK',
    'j.HP',
    'j.HK',
    'j.MP',
    'j.MK',
    'j.LP',
    'j.LK',
    '2HP',
    '2HK',
    '5HP',
    '5HK',
    '2MP',
    '2MK',
    '5MP',
    '5MK',
    '2LP',
    '2LK',
    '5LP',
    '5LK'
  ];

  return {
    id: 'sable',
    name: 'SABLE',
    title: 'THE PHANTOM VIPER',
    archetype: 'RUSHDOWN',
    origin: 'SHIBUYA-9 // BLACKNET',
    bio: 'A phantom courier equipped with optical camouflage and neuro-accelerated thrusters. Uses double jumps, air dashes, and blink teleports to overwhelm targets.',
    arcadeIntro: 'Sable materializes out of a shower of magenta holo-sparks, twin vibroblades humming in the rain.',
    arcadeEnding: 'Having extracted the encrypted syndicate ledger during the final duel, Sable vanishes into the Neo-Kyoto skyline.',
    quoteWin: 'You were swinging at my afterimage two seconds ago.',
    maxHp: 960,
    maxStun: 960,
    walkForwardSpeed: 6.1,
    walkBackwardSpeed: 4.8,
    dashForwardVx: 13.8,
    dashForwardFrames: 13,
    dashBackwardVx: -11.2,
    dashBackwardVy: -3.8,
    dashBackwardFrames: 14,
    jumpVx: 6.0,
    jumpVy: -15.6,
    gravity: 0.72,
    preJumpFrames: 3,
    maxAirJumps: 1,  // Double jump!
    maxAirDashes: 1, // Air dash!
    airDashVx: 12.8,
    airDashFrames: 13,
    standPushbox: DEFAULT_STAND_PUSHBOX,
    crouchPushbox: DEFAULT_CROUCH_PUSHBOX,
    airPushbox: DEFAULT_AIR_PUSHBOX,
    standHurtboxes: DEFAULT_STAND_HURTBOXES,
    crouchHurtboxes: DEFAULT_CROUCH_HURTBOXES,
    airHurtboxes: DEFAULT_AIR_HURTBOXES,
    stats: { power: 6, speed: 10, range: 6, technique: 9, defense: 5 },
    palette: {
      primary: '#ff00aa',
      secondary: '#240b36',
      accent: '#00f0ff',
      glow: '#ff00aa',
      skin: '#ead0c4',
      clothDark: '#140620'
    },
    altPalette: {
      primary: '#00ffcc',
      secondary: '#08282b',
      accent: '#ff3366',
      glow: '#00ffcc',
      skin: '#dfc2b4',
      clothDark: '#051618'
    },
    moves,
    moveOrder,
    trials: [
      {
        id: 'sable_trial_1',
        name: 'TRIAL 01 // VIPER PRESSURE',
        difficulty: 'BASIC',
        description: 'Chain Crouching Light Kick into Crouching Light Punch and Viper Twin-Fang.',
        steps: [
          { moveId: '2LK', label: 'Low Ankle Tap', notation: '2 + LK' },
          { moveId: '2LP', label: 'Crouch Jab', notation: '2 + LP' },
          { moveId: 'viper_flurry_m', label: 'Viper Twin-Fang', notation: '236 + P' }
        ]
      },
      {
        id: 'sable_trial_2',
        name: 'TRIAL 02 // NIGHTFALL BLITZ',
        difficulty: 'INTERMEDIATE',
        description: 'Air-to-ground Flying Cross Kick into Cyber Straight and EX Nightfall Crescent.',
        steps: [
          { moveId: 'j.MK', label: 'Flying Cross Kick', notation: 'Air MK' },
          { moveId: '5MP', label: 'Cyber Straight', notation: 'MP' },
          { moveId: 'nightfall_dive_ex', label: 'Nightfall Crescent (EX)', notation: '236 + KK' }
        ]
      },
      {
        id: 'sable_trial_3',
        name: 'TRIAL 03 // MIRAGE EXECUTION',
        difficulty: 'ADVANCED',
        description: 'Cancel Shadow Razor Slide into EX Viper Twin-Fang, then Super Cancel into Mirage Dance.',
        steps: [
          { moveId: '3HK', label: 'Shadow Razor Slide', notation: '3 + HK' },
          { moveId: 'viper_flurry_ex', label: 'Viper Twin-Fang (EX)', notation: '236 + PP' },
          { moveId: 'super_art', label: 'Mirage Dance', notation: '236236 + P' }
        ]
      }
    ]
  };
}

// ============================================================================
// 4. WARDEN — Charge / Zoner Cyber-Enforcer
// ============================================================================
function createWarden(): CharacterDef {
  const normals = buildCharacterNormals({
    reachScale: 1.07, // Long range shock-baton normals for spacing!
    dmgScale: 0.94,
    speedOffset: 0,
    cmd6mpName: 'Baton Gavel',
    cmd6mpDesc: 'Long-range downward stun-baton overhead strike.',
    cmd3hkName: 'Enforcer Sweep',
    cmd3hkDesc: 'Far-reaching tactical baton low sweep.'
  });
  const throws = buildStandardThrows('Warden', 'Riot Cuffs Takedown', 'Magnetic Back Hurl', 108, 70);

  // Special 1: Rail Pulse ([4]6 + P / CHARGE_BF + P) — Multi-speed electromagnetic projectile!
  const makeRailProj = (speed: number, dmg: number, hits: number, isEx: boolean) => ({
    id: isEx ? 'warden_rail_ex' : 'warden_rail',
    name: isEx ? 'Hyper Rail Pulse' : 'Rail Pulse',
    spawnFrame: 12,
    offsetX: 58,
    offsetY: -120,
    vx: speed,
    vy: 0,
    width: isEx ? 64 : 52,
    height: isEx ? 42 : 32,
    damage: dmg,
    chipDamage: Math.round(dmg * 0.16),
    stunDamage: isEx ? 120 : 75,
    hitstun: isEx ? 21 : 17,
    blockstun: isEx ? 15 : 13,
    hitstop: isEx ? 9 : 7,
    pushbackHit: 48,
    pushbackBlock: 40,
    hitLevel: 'mid' as const,
    knockdown: isEx ? ('soft' as const) : ('none' as const),
    launchVx: isEx ? 6.0 : 0,
    launchVy: isEx ? -6.5 : 0,
    hits,
    lifetime: 160,
    color: isEx ? '#00ffcc' : '#38b6ff',
    coreColor: '#ffffff',
    style: 'rail_beam' as const
  });

  const railPulse = buildSpecialVariants({
    baseId: 'rail_pulse',
    baseName: 'Rail Pulse',
    baseNotation: '[4]6',
    description: 'Charge Back then Forward + Punch: Fires an electromagnetic pulse (L: slow shield, M: medium, H: fast sniper, EX: 2-hit beam).',
    motion: 'CHARGE_BF',
    buttonType: 'P',
    startup: [12, 13, 14, 10],
    active: [4, 4, 4, 5],
    recovery: [23, 24, 25, 19],
    damage: [62, 66, 70, 106],
    stunDamage: [75, 80, 85, 125],
    hitstun: [17, 17, 18, 21],
    blockstun: [13, 13, 14, 16],
    hitstop: [7, 7, 8, 9],
    pushbackHit: 48,
    pushbackBlock: 40,
    hitLevel: 'mid',
    knockdown: ['none', 'none', 'none', 'soft'],
    projectiles: [
      makeRailProj(6.2, 62, 1, false),  // L = slow zoning wall
      makeRailProj(10.5, 66, 1, false), // M = balanced speed
      makeRailProj(15.5, 70, 1, false), // H = fast sniper pulse
      makeRailProj(17.0, 53, 2, true)   // EX = 2-hit hyper beam
    ],
    pose: 'baton_thrust'
  });

  // Special 2: Aegis Arc ([2]8 + K / CHARGE_DU + K) — Sweeping invincible anti-air flash arc!
  const aegisArc = buildSpecialVariants({
    baseId: 'aegis_arc',
    baseName: 'Aegis Flash Arc',
    baseNotation: '[2]8',
    description: 'Charge Down then Up + Kick: Invincible vertical crescent flash-kick that sweeps the sky clean.',
    motion: 'CHARGE_DU',
    buttonType: 'K',
    startup: [6, 7, 8, 5],
    active: [10, 12, 14, 15],
    recovery: [24, 28, 32, 26],
    damage: [95, 108, 120, 148],
    stunDamage: [125, 140, 160, 190],
    hitstun: [24, 26, 28, 32],
    blockstun: [15, 16, 17, 19],
    hitstop: [11, 12, 13, 14],
    pushbackHit: 60,
    pushbackBlock: 48,
    hitLevel: 'mid',
    knockdown: ['launch', 'launch', 'hard', 'hard'],
    launchVx: [5.0, 5.8, 6.5, 7.0],
    launchVy: [-10.5, -11.5, -12.5, -13.5],
    vx: [3.2, 4.0, 4.8, 5.5],
    vy: [-9.5, -11.0, -12.2, -13.2],
    invuln: [
      [{ startFrame: 1, endFrame: 8, type: 'airborne' }],
      [{ startFrame: 1, endFrame: 9, type: 'strike' }],
      [{ startFrame: 1, endFrame: 10, type: 'full' }],
      [{ startFrame: 1, endFrame: 14, type: 'full' }]
    ],
    hitbox: { x: 8, y: -195, w: 98, h: 140 },
    pose: 'flash_kick'
  });

  // Special 3: Suppressor Lance (QCF + K) — Long-range advancing shock-baton thrust
  const suppressorLance = buildSpecialVariants({
    baseId: 'suppressor_lance',
    baseName: 'Suppressor Lance',
    baseNotation: '236',
    description: 'High-voltage telescoping baton thrust that blasts opponents back to full zoning range.',
    motion: 'QCF',
    buttonType: 'K',
    startup: [11, 13, 15, 9],
    active: [6, 7, 8, 9],
    recovery: [19, 21, 23, 17],
    damage: [80, 90, 100, 128],
    stunDamage: [100, 115, 130, 165],
    hitstun: [20, 22, 24, 28],
    blockstun: [14, 15, 16, 18],
    hitstop: [10, 11, 12, 13],
    pushbackHit: 85,
    pushbackBlock: 62,
    hitLevel: 'mid',
    knockdown: ['none', 'soft', 'hard', 'launch'],
    launchVx: [0, 6.5, 8.0, 5.5],
    launchVy: [0, -6.5, -7.5, -11.0],
    vx: [5.2, 6.6, 8.0, 9.5],
    hitbox: { x: 18, y: -145, w: 120, h: 65 },
    pose: 'baton_thrust'
  });

  const superArt: MoveDef = {
    id: 'super_art',
    name: 'Orbital Rail Cannon',
    inputNotation: '236236 + P',
    description: 'SUPER ART: Locks target coordinates and fires a multi-stage electromagnetic plasma beam across the arena.',
    category: 'super',
    posture: 'standing',
    motion: 'DQCF',
    button: 'LP',
    meterCost: 100,
    startup: 7,
    active: 22,
    recovery: 24,
    totalFrames: 53,
    hitstun: 32,
    blockstun: 20,
    hitstop: 8,
    damage: 66, // x4 hits
    chipDamage: 14,
    stunDamage: 60,
    meterGainWhiff: 0,
    meterGainHit: 0,
    meterGainBlock: 0,
    pushbackHit: 55,
    pushbackBlock: 45,
    hitLevel: 'mid',
    knockdown: 'hard',
    launchVx: 8.5,
    launchVy: -10.0,
    juggleCost: 1,
    juggleLimit: 10,
    multiHitFrames: [7, 12, 17, 23],
    cinematicFreeze: 28,
    cancelWindows: [],
    invincibility: [{ startFrame: 1, endFrame: 14, type: 'full' }],
    movement: [{ startFrame: 7, endFrame: 22, vx: 6.5 }],
    boxes: {
      startupHurtboxes: DEFAULT_STAND_HURTBOXES,
      activeHurtboxes: DEFAULT_STAND_HURTBOXES,
      recoveryHurtboxes: DEFAULT_STAND_HURTBOXES,
      hitboxes: [{ x: 15, y: -165, w: 205, h: 120 }]
    },
    hitSparkStrength: 'super',
    pose: 'super_cast'
  };

  const ultimateArt: MoveDef = {
    id: 'ultimate_art',
    name: 'Judgment Protocol',
    inputNotation: '236236 + PP (Low HP)',
    description: 'ULTIMATE ART: Calls down an Aegis satellite ion-beam barrage that obliterates everything in front of Warden.',
    category: 'ultimate',
    posture: 'standing',
    motion: 'DQCF',
    button: 'PP',
    meterCost: 200,
    requiresLowHealth: true,
    startup: 6,
    active: 28,
    recovery: 26,
    totalFrames: 60,
    hitstun: 40,
    blockstun: 25,
    hitstop: 9,
    damage: 78, // x5 hits
    chipDamage: 16,
    stunDamage: 75,
    meterGainWhiff: 0,
    meterGainHit: 0,
    meterGainBlock: 0,
    pushbackHit: 65,
    pushbackBlock: 52,
    hitLevel: 'mid',
    knockdown: 'hard',
    launchVx: 9.5,
    launchVy: -12.5,
    juggleCost: 1,
    juggleLimit: 15,
    multiHitFrames: [6, 11, 16, 21, 27],
    cinematicFreeze: 42,
    cancelWindows: [],
    invincibility: [{ startFrame: 1, endFrame: 20, type: 'full' }],
    movement: [{ startFrame: 6, endFrame: 26, vx: 8.0 }],
    boxes: {
      startupHurtboxes: DEFAULT_STAND_HURTBOXES,
      activeHurtboxes: DEFAULT_STAND_HURTBOXES,
      recoveryHurtboxes: DEFAULT_STAND_HURTBOXES,
      hitboxes: [{ x: 15, y: -185, w: 235, h: 155 }]
    },
    hitSparkStrength: 'super',
    pose: 'super_cast'
  };

  const moves: Record<string, MoveDef> = {
    ...normals,
    ...throws,
    ...railPulse,
    ...aegisArc,
    ...suppressorLance,
    super_art: superArt,
    ultimate_art: ultimateArt
  };

  const moveOrder = [
    'ultimate_art',
    'super_art',
    'aegis_arc_ex',
    'rail_pulse_ex',
    'suppressor_lance_ex',
    'aegis_arc_h',
    'aegis_arc_m',
    'aegis_arc_l',
    'rail_pulse_h',
    'rail_pulse_m',
    'rail_pulse_l',
    'suppressor_lance_h',
    'suppressor_lance_m',
    'suppressor_lance_l',
    'throw_b',
    'throw_f',
    '6MP',
    '3HK',
    'j.HP',
    'j.HK',
    'j.MP',
    'j.MK',
    'j.LP',
    'j.LK',
    '2HP',
    '2HK',
    '5HP',
    '5HK',
    '2MP',
    '2MK',
    '5MP',
    '5MK',
    '2LP',
    '2LK',
    '5LP',
    '5LK'
  ];

  return {
    id: 'warden',
    name: 'WARDEN',
    title: 'THE AEGIS ENFORCER',
    archetype: 'CHARGE / ZONER',
    origin: 'AEGIS CITADEL // PRECINCT 01',
    bio: 'A rogue tactical commander armed with a rail-pulse emitter and telescoping shock baton. Controls space with multi-speed projectiles and invincible flash arcs.',
    arcadeIntro: 'Warden’s tactical visor locks onto the target as electromagnetic coils charge along his Aegis baton.',
    arcadeEnding: 'Broadcasting the syndicate’s crimes across every holo-billboard in Neo-Kyoto, Warden restores true law to the rain-soaked streets.',
    quoteWin: 'Target neutralized. Perimeter secured.',
    maxHp: 980,
    maxStun: 985,
    walkForwardSpeed: 4.5,
    walkBackwardSpeed: 3.8,
    dashForwardVx: 10.6,
    dashForwardFrames: 15,
    dashBackwardVx: -9.8,
    dashBackwardVy: -3.5,
    dashBackwardFrames: 15,
    jumpVx: 4.9,
    jumpVy: -15.0,
    gravity: 0.72,
    preJumpFrames: 3,
    maxAirJumps: 0,
    maxAirDashes: 0,
    airDashVx: 0,
    airDashFrames: 0,
    standPushbox: DEFAULT_STAND_PUSHBOX,
    crouchPushbox: DEFAULT_CROUCH_PUSHBOX,
    airPushbox: DEFAULT_AIR_PUSHBOX,
    standHurtboxes: DEFAULT_STAND_HURTBOXES,
    crouchHurtboxes: DEFAULT_CROUCH_HURTBOXES,
    airHurtboxes: DEFAULT_AIR_HURTBOXES,
    stats: { power: 7, speed: 6, range: 10, technique: 8, defense: 8 },
    palette: {
      primary: '#38b6ff',
      secondary: '#0f1e36',
      accent: '#ffcc00',
      glow: '#38b6ff',
      skin: '#d4b49c',
      clothDark: '#081120'
    },
    altPalette: {
      primary: '#ff3355',
      secondary: '#280c14',
      accent: '#00f0ff',
      glow: '#ff3355',
      skin: '#c8a68e',
      clothDark: '#16060b'
    },
    moves,
    moveOrder,
    trials: [
      {
        id: 'warden_trial_1',
        name: 'TRIAL 01 // PERIMETER CHECK',
        difficulty: 'BASIC',
        description: 'Cancel Side Thrust Kick into Suppressor Lance.',
        steps: [
          { moveId: '5MK', label: 'Side Thrust Kick', notation: 'MK' },
          { moveId: 'suppressor_lance_m', label: 'Suppressor Lance', notation: '236 + K' }
        ]
      },
      {
        id: 'warden_trial_2',
        name: 'TRIAL 02 // AEGIS INTERCEPT',
        difficulty: 'INTERMEDIATE',
        description: 'Charge Down-Back, hit Crouching Medium Punch, and cancel into Aegis Flash Arc.',
        steps: [
          { moveId: '2MP', label: 'Low Cross', notation: '2 + MP' },
          { moveId: 'aegis_arc_h', label: 'Aegis Flash Arc', notation: '[2]8 + K' }
        ]
      },
      {
        id: 'warden_trial_3',
        name: 'TRIAL 03 // ORBITAL LOCKDOWN',
        difficulty: 'ADVANCED',
        description: 'Cancel Heavy Breaker into EX Suppressor Lance, then Super Cancel into Orbital Rail Cannon.',
        steps: [
          { moveId: '5HP', label: 'Heavy Breaker', notation: 'HP' },
          { moveId: 'suppressor_lance_ex', label: 'Suppressor Lance (EX)', notation: '236 + KK' },
          { moveId: 'super_art', label: 'Orbital Rail Cannon', notation: '236236 + P' }
        ]
      }
    ]
  };
}

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  hayate: createHayate(),
  magnus: createMagnus(),
  sable: createSable(),
  warden: createWarden()
};

export const CHARACTER_LIST: CharacterDef[] = [
  CHARACTERS.hayate,
  CHARACTERS.magnus,
  CHARACTERS.sable,
  CHARACTERS.warden
];
