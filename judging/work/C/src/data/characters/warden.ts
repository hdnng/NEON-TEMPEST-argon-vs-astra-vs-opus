/**
 * WARDEN - charge zoner. Charge back-forward projectiles of three speeds, a down-up anti-air
 * disc and sweeping flip kick, long-reaching normals and a charge rush to punish.
 */
import { bx, move, projHit, systemMoves, variants, type StanceBoxes } from '../build';
import type { CharacterDef, MoveDef, ProjectileDef, ThrowDef } from '../schema';

const hurt: StanceBoxes = {
  stand: [bx([-17, 206, 38, 46]), bx([-30, 112, 60, 96]), bx([-32, 0, 64, 114])],
  crouch: [bx([-12, 116, 40, 40]), bx([-34, 0, 76, 122])],
  air: [bx([-26, 40, 54, 156])],
};

const STAND = [4, 5, 6];
const CROUCH = [1, 2, 3];
const LIGHTS = ['5LP', '2LP', '5LK', '2LK'];
const COLOR = '#5dffa5';

const lance = (id: string, vx: number, dmg: number, hits: number, style: ProjectileDef['style']): ProjectileDef => ({
  id, vx, vy: 0, life: 160, box: bx([-34, -14, 68, 28]),
  hit: projHit({ dmg, power: 'special', hitstun: 21, blockstun: 16, push: [30, 26], meter: [10, 5] }),
  hits, hitInterval: 7, durability: hits, style, color: COLOR, size: 20,
});

const disc = (id: string, vx: number, vy: number, dmg: number, hits: number): ProjectileDef => ({
  id, vx, vy, life: 90, box: bx([-26, -26, 52, 52]),
  hit: projHit({ dmg, power: 'special', hitstun: 24, blockstun: 14, push: [20, 20], meter: [10, 5], kd: 'soft', launch: [3, 8], jug: [1, 3] }),
  hits, hitInterval: 8, durability: hits, style: 'disc', color: '#9bffd0', size: 22,
});

const throwF: ThrowDef = {
  box: bx([10, 40, 64, 140]), damage: 120, stun: 100, techable: true, swap: false,
  release: 22, duration: 32, releaseVel: { vx: 9, vy: 7 }, knockdown: 'soft', power: 'heavy',
  victim: [{ f: 0, x: 52, y: 0, rot: 0 }, { f: 10, x: 44, y: 30, rot: -20 }, { f: 22, x: 90, y: 50, rot: -80 }],
  anim: [{ f: 0, pose: 'grab' }, { f: 10, pose: 'war_baton_w' }, { f: 20, pose: 'war_lance' }, { f: 32, pose: 'stance' }],
};
const throwB: ThrowDef = {
  ...throwF, swap: true, damage: 130,
  victim: [{ f: 0, x: 52, y: 0, rot: 0 }, { f: 10, x: 10, y: 80, rot: -100 }, { f: 22, x: -70, y: 30, rot: -220 }],
  anim: [{ f: 0, pose: 'grab' }, { f: 10, pose: 'throw_over' }, { f: 22, pose: 'throw_back' }, { f: 32, pose: 'stance' }],
};

const moves: MoveDef[] = [
  move({ id: '5LP', name: 'Gauntlet Jab', desc: 'Quick jab. Chains.', stance: 'stand', input: { btn: 'LP', dirs: STAND },
    s: 4, a: 2, r: 7, pose: 'jab', cancel: 'chain', chainTo: LIGHTS,
    hits: [{ dmg: 30, box: [36, 170, 58, 22], onHit: 4, onBlock: 1, power: 'light' }] }, hurt),
  move({ id: '5MP', name: 'Baton Jab', desc: 'Long baton thrust. Cancelable.', stance: 'stand', input: { btn: 'MP', dirs: STAND },
    s: 6, a: 3, r: 10, pose: 'war_lance', windup: 'war_lance_w', cancel: 'special',
    hits: [{ dmg: 60, box: [40, 156, 84, 26], onHit: 3, onBlock: 0, power: 'medium' }] }, hurt),
  move({ id: '5HP', name: 'Riot Baton', desc: 'Huge-reach baton swing. Cancelable.', stance: 'stand', input: { btn: 'HP', dirs: STAND },
    s: 9, a: 4, r: 18, pose: 'war_baton', windup: 'war_baton_w', cancel: 'special',
    hits: [{ dmg: 90, box: [44, 140, 100, 56], onHit: 2, onBlock: -3, power: 'heavy' }] }, hurt),
  move({ id: '5LK', name: 'Boot Check', desc: 'Short kick.', stance: 'stand', input: { btn: 'LK', dirs: STAND },
    s: 5, a: 3, r: 9, pose: 'kick_low', cancel: 'chain', chainTo: LIGHTS,
    hits: [{ dmg: 32, box: [30, 40, 74, 28], onHit: 2, onBlock: -1, power: 'light' }] }, hurt),
  move({ id: '5MK', name: 'Long Shin', desc: 'Excellent long-range poke. Cancelable.', stance: 'stand', input: { btn: 'MK', dirs: STAND },
    s: 7, a: 3, r: 15, pose: 'kick_mid', cancel: 'special',
    hits: [{ dmg: 60, box: [40, 90, 100, 34], onHit: 1, onBlock: -3, power: 'medium' }] }, hurt),
  move({ id: '5HK', name: 'Barrier Kick', desc: 'Very long high kick.', stance: 'stand', input: { btn: 'HK', dirs: STAND },
    s: 11, a: 4, r: 20, pose: 'war_longkick',
    hits: [{ dmg: 100, box: [44, 100, 116, 46], onHit: 2, onBlock: -4, power: 'heavy' }] }, hurt),
  move({ id: '2LP', name: 'Low Jab', desc: 'Crouching jab. Chains.', stance: 'crouch', input: { btn: 'LP', dirs: CROUCH },
    s: 4, a: 2, r: 7, pose: 'c_jab', cancel: 'chain', chainTo: LIGHTS,
    hits: [{ dmg: 28, box: [34, 104, 54, 22], onHit: 4, onBlock: 1, power: 'light' }] }, hurt),
  move({ id: '2MP', name: 'Stun Prod', desc: 'Crouching baton poke. Cancelable.', stance: 'crouch', input: { btn: 'MP', dirs: CROUCH },
    s: 6, a: 3, r: 10, pose: 'c_punch', cancel: 'special',
    hits: [{ dmg: 55, box: [36, 98, 78, 24], onHit: 3, onBlock: 0, power: 'medium' }] }, hurt),
  move({ id: '2HP', name: 'Halo Swat', desc: 'Wide anti-air swat.', stance: 'crouch', input: { btn: 'HP', dirs: CROUCH },
    s: 7, a: 6, r: 20, pose: 'c_upper', cancel: 'special',
    hurt: [{ f: 1, boxes: [[-12, 116, 40, 40], [-34, 0, 76, 122]] }, { f: 6, boxes: [[-22, 0, 74, 210]] }, { f: 20, boxes: [[-12, 116, 40, 40], [-34, 0, 76, 122]] }],
    hits: [{ dmg: 90, box: [6, 150, 84, 104], onHit: 2, onBlock: -6, power: 'heavy', launch: [2, 10], jug: [1, 1] }] }, hurt),
  move({ id: '2LK', name: 'Ankle Check', desc: 'Low kick. Chains.', stance: 'crouch', input: { btn: 'LK', dirs: CROUCH },
    s: 5, a: 2, r: 8, pose: 'c_short', cancel: 'chain', chainTo: LIGHTS,
    hits: [{ dmg: 26, box: [30, 2, 66, 22], onHit: 2, onBlock: -1, level: 'low', power: 'light' }] }, hurt),
  move({ id: '2MK', name: 'Patrol Sweep', desc: 'Long low poke. Cancelable.', stance: 'crouch', input: { btn: 'MK', dirs: CROUCH },
    s: 7, a: 3, r: 14, pose: 'c_poke', cancel: 'special',
    hits: [{ dmg: 55, box: [36, 2, 110, 24], onHit: 1, onBlock: -3, level: 'low', power: 'medium' }] }, hurt),
  move({ id: '2HK', name: 'Lockdown Sweep', desc: 'Sweep. Knocks down.', stance: 'crouch', input: { btn: 'HK', dirs: CROUCH },
    s: 9, a: 3, r: 24, pose: 'sweep',
    hits: [{ dmg: 90, box: [36, 0, 112, 26], onBlock: -12, level: 'low', power: 'heavy', kd: 'soft', launch: [1, 3] }] }, hurt),
  move({ id: 'j.LP', name: 'Air Jab', desc: 'Air jab.', stance: 'air', input: { btn: 'LP' },
    s: 4, a: 7, r: 6, pose: 'j_punch',
    hits: [{ dmg: 32, box: [26, 60, 54, 40], hitstun: 14, blockstun: 10, level: 'overhead', power: 'light' }] }, hurt),
  move({ id: 'j.MP', name: 'Air Baton', desc: 'Long air-to-air baton.', stance: 'air', input: { btn: 'MP' },
    s: 6, a: 6, r: 10, pose: 'war_lance',
    hits: [{ dmg: 60, box: [30, 80, 84, 32], hitstun: 17, blockstun: 13, level: 'overhead', power: 'medium' }] }, hurt),
  move({ id: 'j.HP', name: 'Gavel', desc: 'Downward baton strike.', stance: 'air', input: { btn: 'HP' },
    s: 8, a: 6, r: 12, pose: 'j_hammer', windup: 'j_hammer_w',
    hits: [{ dmg: 90, box: [24, 10, 80, 64], hitstun: 19, blockstun: 15, level: 'overhead', power: 'heavy' }] }, hurt),
  move({ id: 'j.LK', name: 'Air Knee', desc: 'Cross-up knee.', stance: 'air', input: { btn: 'LK' },
    s: 4, a: 9, r: 6, pose: 'j_knee',
    hits: [{ dmg: 32, box: [-22, 0, 78, 46], hitstun: 15, blockstun: 11, level: 'overhead', power: 'light' }] }, hurt),
  move({ id: 'j.MK', name: 'Air Boot', desc: 'Long horizontal kick.', stance: 'air', input: { btn: 'MK' },
    s: 6, a: 6, r: 10, pose: 'j_kick',
    hits: [{ dmg: 60, box: [28, 16, 92, 36], hitstun: 17, blockstun: 13, level: 'overhead', power: 'medium' }] }, hurt),
  move({ id: 'j.HK', name: 'Riot Boot', desc: 'Jump-in kick.', stance: 'air', input: { btn: 'HK' },
    s: 7, a: 6, r: 12, pose: 'j_flykick',
    hits: [{ dmg: 90, box: [30, 0, 88, 46], hitstun: 19, blockstun: 15, level: 'overhead', power: 'heavy' }] }, hurt),
  move({ id: '6HK', name: 'Breach Kick', desc: 'Forward + HK: stepping long kick.', type: 'command', stance: 'stand', input: { btn: 'HK', dirs: [6] },
    s: 13, a: 3, r: 18, pose: 'war_longkick', move: [{ f: 3, vx: 3 }, { f: 13, vx: 0 }],
    hits: [{ dmg: 80, box: [48, 80, 124, 44], onHit: 1, onBlock: -4, power: 'heavy' }] }, hurt),

  // ---- specials (charge)
  ...variants({
    id: 'lance', name: 'Pulse Lance', desc: 'Charge back, then forward + P: energy lance. L slow, M medium, H fast.', motion: 'chargeBF', group: 'P',
    stance: 'stand', s: 12, a: 1, r: 31, pose: 'war_lance', windup: 'war_lance_w', oneProjectile: true, meterWhiff: 4, noLimbHurt: true,
  }, {
    L: { projectile: { frame: 12, def: lance('lanceL', 4.5, 50, 1, 'lance'), x: 84, y: 158 } },
    M: { projectile: { frame: 12, def: lance('lanceM', 7, 50, 1, 'lance'), x: 84, y: 158 } },
    H: { projectile: { frame: 12, def: lance('lanceH', 9.5, 50, 1, 'lance'), x: 84, y: 158 } },
    EX: { s: 9, r: 26, projectile: { frame: 9, def: lance('lanceEX', 11, 42, 2, 'lanceEX'), x: 84, y: 158 } },
  }, hurt),
  ...variants({
    id: 'disc', name: 'Halo Disc', desc: 'Charge down, then up + P: disc that rises at an angle. Anti-air zoning.', motion: 'chargeDU', group: 'P',
    stance: 'stand', s: 10, a: 1, r: 30, pose: 'war_disc', windup: 'war_disc_w', oneProjectile: true, meterWhiff: 4, noLimbHurt: true,
  }, {
    L: { projectile: { frame: 10, def: disc('discL', 4, 2.5, 60, 1), x: 70, y: 200 } },
    M: { projectile: { frame: 10, def: disc('discM', 4.5, 4, 60, 1), x: 70, y: 200 } },
    H: { projectile: { frame: 10, def: disc('discH', 5, 6, 60, 1), x: 70, y: 200 } },
    EX: { s: 8, r: 26, projectile: { frame: 8, def: disc('discEX', 6, 4.5, 45, 2), x: 70, y: 200 } },
  }, hurt),
  ...variants({
    id: 'arc', name: 'Arc Sentry', desc: 'Charge down, then up + K: sweeping flip kick. Invincible anti-air.', motion: 'chargeDU', group: 'K',
    stance: 'stand', s: 4, a: 8, r: 24, pose: 'war_arc', windup: 'war_arc_w', airborne: true, landingLag: 12, sfx: 'rise', noLimbHurt: true,
  }, {
    L: { invuln: { strike: [1, 5], throw: [1, 6] }, move: [{ f: 2, vx: 1.5, vy: 12, g: 0.85 }],
      hits: [{ dmg: 95, box: [-10, 60, 100, 150], frames: [4, 10], power: 'special', onBlock: -18, kd: 'soft', launch: [3, 11], jug: [1, 3] }] },
    M: { invuln: { strike: [1, 7], throw: [1, 6] }, move: [{ f: 2, vx: 2, vy: 13.5, g: 0.85 }],
      hits: [{ dmg: 105, box: [-10, 60, 100, 160], frames: [4, 11], power: 'special', onBlock: -20, kd: 'soft', launch: [3, 12], jug: [1, 3] }] },
    H: { invuln: { strike: [1, 9], throw: [1, 6] }, move: [{ f: 2, vx: 2.5, vy: 15, g: 0.85 }],
      hits: [{ dmg: 105, box: [-10, 60, 100, 170], frames: [4, 12], power: 'special', onBlock: -22, kd: 'hard', launch: [3, 13], jug: [1, 3] }] },
    EX: { invuln: { strike: [1, 14], throw: [1, 14], proj: [1, 14] }, move: [{ f: 2, vx: 2.5, vy: 15, g: 0.85 }],
      hits: [{ dmg: 60, box: [-10, 40, 100, 150], frames: [4, 6], power: 'special', hitstun: 28, onBlock: -20, jug: [0, 5] },
        { dmg: 110, box: [-10, 60, 100, 170], frames: [8, 13], power: 'special', onBlock: -22, kd: 'hard', launch: [3, 13], jug: [1, 5] }] },
  }, hurt),
  ...variants({
    id: 'rush', name: 'Riot Rush', desc: 'Charge back, then forward + K: advancing shield-knee rush.', motion: 'chargeBF', group: 'K',
    stance: 'stand', s: 12, a: 8, r: 16, pose: 'war_rush', windup: 'mag_charge_w', sfx: 'charge',
  }, {
    L: { move: [{ f: 6, vx: 8 }, { f: 20, vx: 0 }], hits: [{ dmg: 75, box: [20, 60, 80, 130], power: 'special', onBlock: -5, kd: 'soft', launch: [5, 7], jug: [1, 2] }] },
    M: { move: [{ f: 6, vx: 9.5 }, { f: 21, vx: 0 }], a: 9, hits: [{ dmg: 85, box: [20, 60, 80, 130], power: 'special', onBlock: -7, kd: 'soft', launch: [5, 7], jug: [1, 2] }] },
    H: { move: [{ f: 6, vx: 11 }, { f: 22, vx: 0 }], a: 10, hits: [{ dmg: 95, box: [20, 60, 80, 130], power: 'special', onBlock: -10, kd: 'soft', launch: [5, 8], jug: [1, 2] }] },
    EX: { s: 9, a: 12, invuln: { proj: [1, 20] }, move: [{ f: 4, vx: 11 }, { f: 21, vx: 0 }],
      hits: [{ dmg: 60, box: [20, 60, 80, 130], power: 'special', hitstun: 22, onBlock: -2, frames: [9, 12], jug: [0, 3], vacuum: true },
        { dmg: 80, box: [20, 60, 90, 150], power: 'special', onBlock: -3, kd: 'hard', launch: [5, 10], jug: [1, 3], frames: [15, 20] }] },
  }, hurt),

  move({ id: 'super', name: 'Containment Grid', type: 'super', desc: 'Super Art (1 stock): charge back, F, B, F + P. A slow multi-hit energy grid that locks down the screen.',
    stance: 'stand', input: { motion: 'chargeBFBF', anyOf: 'P' }, s: 10, a: 1, r: 28, meterCost: 100, superFreeze: 40, sfx: 'super', noLimbHurt: true,
    invuln: { strike: [1, 12], throw: [1, 12], proj: [1, 12] },
    projectile: {
      frame: 10, x: 90, y: 130,
      def: { id: 'grid', vx: 7, vy: 0, life: 150, box: bx([-50, -110, 100, 220]), hits: 6, hitInterval: 5, durability: 6, style: 'grid', color: COLOR, size: 34,
        hit: projHit({ dmg: 55, power: 'super', hitstun: 30, blockstun: 12, push: [8, 10], meter: [0, 0], jug: [0, 20] }) },
    },
    anim: [{ f: 1, pose: 'war_disc_w' }, { f: 10, pose: 'war_grid' }, { f: 38, pose: 'stance' }] }, hurt),
  move({ id: 'ult', name: 'Riot Protocol', type: 'ultimate', desc: 'Ultimate (3 stocks, below 35% life): charge back, F, B, F + K. Unstoppable baton barrage.',
    stance: 'stand', input: { motion: 'chargeBFBF', anyOf: 'K' }, s: 6, a: 36, r: 28, meterCost: 300, lowHp: true, superFreeze: 70, sfx: 'ultimate',
    invuln: { strike: [1, 16], throw: [1, 16], proj: [1, 16] }, move: [{ f: 1, vx: 13 }, { f: 12, vx: 1 }, { f: 36, vx: 0 }],
    hits: [
      ...[6, 10, 14, 18, 22, 26, 30, 34].map((f) => ({ dmg: 36, box: [0, 40, 120, 180] as [number, number, number, number], frames: [f, f + 1] as [number, number], power: 'super' as const, hitstun: 36, onBlock: -10, jug: [0, 20] as [number, number], vacuum: true })),
      { dmg: 220, box: [0, 0, 150, 260], frames: [40, 43], power: 'super', hitstop: 24, kd: 'hard', launch: [6, 17], jug: [1, 20], onBlock: -18 },
    ],
    anim: [{ f: 1, pose: 'war_rush' }, { f: 6, pose: 'war_baton' }, { f: 10, pose: 'war_lance' }, { f: 14, pose: 'war_baton' }, { f: 18, pose: 'war_longkick' }, { f: 22, pose: 'war_baton' }, { f: 26, pose: 'war_lance' }, { f: 32, pose: 'war_arc_w' }, { f: 40, pose: 'war_arc' }, { f: 69, pose: 'stance' }] }, hurt),

  ...systemMoves(hurt, throwF, throwB, { throwF: 'grab', throwB: 'grab' }),
];

export const WARDEN: CharacterDef = {
  id: 'warden',
  name: 'WARDEN',
  kanji: '守衛',
  epithet: 'The Last Patrol',
  archetype: 'Charge Zoner',
  description: 'A decommissioned riot officer who still walks the beat. Charge-input lances, rising discs and a flip kick lock down every angle of approach.',
  stats: { power: 3, speed: 2, range: 5, defense: 3, difficulty: 4 },
  maxHp: 900,
  maxStun: 1000,
  walkF: 3.4,
  walkB: 3.0,
  dashF: { frames: 20, dist: 110 },
  dashB: { frames: 22, dist: 110, invuln: 6 },
  jump: { prejump: 4, vy: 17.5, g: 0.84, vxF: 4.0, vxB: 3.6 },
  airJumps: 0,
  airDashes: 0,
  hurt,
  push: { stand: bx([-25, 0, 50, 206]), crouch: bx([-27, 0, 54, 134]), air: bx([-23, 40, 46, 144]) },
  body: { scale: 1.05, height: 258, torso: 84, neck: 10, head: 19, shoulder: 16, hipWidth: 13, upperArm: 46, foreArm: 44, thigh: 63, shin: 61, limbWidth: 13, torsoWidth: 38, style: 'warden' },
  palettes: [
    { name: 'Patrol', skin: '#c99a7c', body: '#24524a', bodyDark: '#142420', cloth: '#2a5a4e', accent: '#5dffa5', glow: '#c2ffe0', hair: '#0c0c10', rim: '#7dffbe' },
    { name: 'Blackout', skin: '#b88a6e', body: '#3a3a46', bodyDark: '#16161e', cloth: '#5a1a20', accent: '#ff4d5e', glow: '#ffc2c8', hair: '#0c0c10', rim: '#ff7a86' },
  ],
  moves,
  ai: {
    aggression: 0.32, zoning: 0.85, jumpiness: 0.1, grabby: 0.2, antiAirMove: 'arc', preferredRange: 360, meterUse: 0.55,
    pokes: ['5MK', '2MK', '5HP', '6HK', '5MP'],
    combos: [['2LK', '2LP', 'rush_L'], ['2MK', 'lance_H'], ['5MP', 'lance_M'], ['5HP', 'rush_M'], ['2MK', 'super']],
    blockstrings: [['2MK', 'lance_L'], ['5MP', 'lance_M'], ['2LK', '2LP']],
  },
  quotes: {
    intro: ['Step back behind the line.', 'You are in violation.', 'This district is under my protection.'],
    win: ['Order restored.', 'Stay down. That\'s an order.', 'Case closed.'],
  },
  arcade: {
    intro: 'The Neo-Kyoto Riot Bureau was dissolved the night the syndicates bought the city council. Warden never turned in his badge. He enters the tournament to reach the man running it: the commissioner who sold out his squad.',
    ending: 'In the empty VIP box Warden finds the commissioner\'s ledger: every bribe, every name. He walks it straight into the Bureau\'s old precinct, flips the lights back on, and starts writing reports again. Tomorrow, the patrols begin.',
    rival: 'sable',
  },
  trials: [
    { name: 'Pulse Check', hint: 'Hold down-back. 2MK, then forward + HP for a Pulse Lance.', steps: [{ move: '2MK', label: '2MK (hold down-back)' }, { move: 'lance', label: '[4]6+P Pulse Lance' }] },
    { name: 'Riot Response', hint: 'Hold down-back through 2LK > 2LP, then forward + K.', steps: [{ move: '2LK', label: '2LK' }, { move: '2LP', label: '2LP' }, { move: 'rush', label: '[4]6+K Riot Rush' }] },
    { name: 'Arc Light', hint: 'Crouch to charge, chain 2LP > 2LP while holding down-back, then up + K.', steps: [{ move: '2LP', label: '2LP (hold down)' }, { move: '2LP', label: '2LP (hold down)' }, { move: 'arc', label: '[2]8+K Arc Sentry' }] },
    { name: 'Containment', hint: 'Hold down-back, 2MK, then forward, back, forward + P.', steps: [{ move: '2MK', label: '2MK' }, { move: 'super', label: '[4]646+P Containment Grid' }] },
  ],
  themeColor: '#5dffa5',
};
