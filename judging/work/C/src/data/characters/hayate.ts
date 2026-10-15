/**
 * HAYATE - balanced all-rounder. Storm-dojo outcast with a lightning-charged fighting style.
 */
import { bx, move, projHit, systemMoves, variants, type StanceBoxes } from '../build';
import type { CharacterDef, MoveDef, ProjectileDef, ThrowDef } from '../schema';

const hurt: StanceBoxes = {
  stand: [bx([-16, 196, 36, 46]), bx([-28, 108, 58, 92]), bx([-32, 0, 62, 110])],
  crouch: [bx([-12, 112, 40, 40]), bx([-34, 0, 76, 118])],
  air: [bx([-26, 40, 56, 150])],
};

const STAND = [4, 5, 6];
const CROUCH = [1, 2, 3];
const LIGHT_CHAIN = ['5LP', '2LP', '5LK', '2LK'];

const orb = (id: string, vx: number, dmg: number, hits: number, style: ProjectileDef['style']): ProjectileDef => ({
  id, vx, vy: 0, life: 150, box: bx([-22, -22, 44, 44]),
  hit: projHit({ dmg, power: 'special', hitstun: 22, blockstun: 17, push: [30, 26], meter: [10, 5], kd: undefined }),
  hits, hitInterval: 8, durability: hits, style, color: '#3ff0ff', size: 24,
});

const throwF: ThrowDef = {
  box: bx([10, 40, 62, 140]), damage: 120, stun: 100, techable: true, swap: false,
  release: 24, duration: 34, releaseVel: { vx: 7, vy: 9 }, knockdown: 'soft', power: 'heavy',
  victim: [{ f: 0, x: 52, y: 0, rot: 0 }, { f: 10, x: 40, y: 40, rot: -30 }, { f: 22, x: 70, y: 70, rot: -110 }, { f: 24, x: 80, y: 40, rot: -160 }],
  anim: [{ f: 0, pose: 'grab' }, { f: 12, pose: 'throw_lift' }, { f: 22, pose: 'throw_toss' }, { f: 34, pose: 'stance' }],
};
const throwB: ThrowDef = {
  ...throwF, swap: true, damage: 130,
  victim: [{ f: 0, x: 52, y: 0, rot: 0 }, { f: 10, x: 10, y: 70, rot: -90 }, { f: 22, x: -60, y: 50, rot: -200 }, { f: 24, x: -70, y: 30, rot: -230 }],
  anim: [{ f: 0, pose: 'grab' }, { f: 10, pose: 'throw_over' }, { f: 22, pose: 'throw_back' }, { f: 34, pose: 'stance' }],
};

const moves: MoveDef[] = [
  // ---- standing normals
  move({ id: '5LP', name: 'Squall Jab', desc: 'Fast jab. Chains into light attacks.', stance: 'stand', input: { btn: 'LP', dirs: STAND },
    s: 3, a: 2, r: 6, pose: 'jab', cancel: 'chain', chainTo: LIGHT_CHAIN,
    hits: [{ dmg: 30, box: [36, 166, 54, 22], onHit: 4, onBlock: 2, power: 'light' }] }, hurt),
  move({ id: '5MP', name: 'Thunder Straight', desc: 'Solid mid-range punch, special cancelable.', stance: 'stand', input: { btn: 'MP', dirs: STAND },
    s: 5, a: 3, r: 9, pose: 'straight', cancel: 'special',
    hits: [{ dmg: 60, box: [40, 160, 64, 24], onHit: 5, onBlock: 1, power: 'medium' }] }, hurt),
  move({ id: '5HP', name: 'Gale Hammer', desc: 'Heavy straight with big reach. Cancelable.', stance: 'stand', input: { btn: 'HP', dirs: STAND },
    s: 7, a: 4, r: 17, pose: 'hook', cancel: 'special', move: [{ f: 3, vx: 2 }, { f: 9, vx: 0 }],
    hits: [{ dmg: 90, box: [44, 148, 76, 32], onHit: 3, onBlock: -3, power: 'heavy' }] }, hurt),
  move({ id: '5LK', name: 'Flick Kick', desc: 'Quick shin kick.', stance: 'stand', input: { btn: 'LK', dirs: STAND },
    s: 4, a: 3, r: 8, pose: 'kick_low', cancel: 'chain', chainTo: LIGHT_CHAIN,
    hits: [{ dmg: 30, box: [30, 40, 66, 28], onHit: 3, onBlock: 0, power: 'light' }] }, hurt),
  move({ id: '5MK', name: 'Crescent Kick', desc: 'Mid roundhouse, good poke.', stance: 'stand', input: { btn: 'MK', dirs: STAND },
    s: 7, a: 3, r: 14, pose: 'kick_mid', cancel: 'special',
    hits: [{ dmg: 70, box: [40, 104, 82, 34], onHit: 2, onBlock: -2, power: 'medium' }] }, hurt),
  move({ id: '5HK', name: 'Thunderhead Kick', desc: 'High kick; ducked by crouching opponents.', stance: 'stand', input: { btn: 'HK', dirs: STAND },
    s: 9, a: 4, r: 19, pose: 'kick_high',
    hits: [{ dmg: 100, box: [44, 166, 86, 38], onHit: 3, onBlock: -4, level: 'high', power: 'heavy' }] }, hurt),
  // ---- crouching normals
  move({ id: '2LP', name: 'Low Jab', desc: 'Crouching jab. Chains.', stance: 'crouch', input: { btn: 'LP', dirs: CROUCH },
    s: 3, a: 2, r: 7, pose: 'c_jab', cancel: 'chain', chainTo: LIGHT_CHAIN,
    hits: [{ dmg: 25, box: [34, 100, 52, 22], onHit: 5, onBlock: 1, power: 'light' }] }, hurt),
  move({ id: '2MP', name: 'Rain Strike', desc: 'Crouching straight, cancelable.', stance: 'crouch', input: { btn: 'MP', dirs: CROUCH },
    s: 5, a: 3, r: 9, pose: 'c_punch', cancel: 'special',
    hits: [{ dmg: 55, box: [36, 94, 64, 24], onHit: 4, onBlock: 1, power: 'medium' }] }, hurt),
  move({ id: '2HP', name: 'Sky Splitter', desc: 'Upward anti-air punch, cancelable.', stance: 'crouch', input: { btn: 'HP', dirs: CROUCH },
    s: 6, a: 5, r: 20, pose: 'c_upper', cancel: 'special',
    hurt: [{ f: 1, boxes: [[-12, 112, 40, 40], [-34, 0, 76, 118]] }, { f: 5, boxes: [[-20, 0, 70, 200]] }, { f: 18, boxes: [[-12, 112, 40, 40], [-34, 0, 76, 118]] }],
    hits: [{ dmg: 90, box: [16, 140, 56, 110], onHit: 2, onBlock: -6, power: 'heavy', launch: [2, 10], jug: [1, 1] }] }, hurt),
  move({ id: '2LK', name: 'Ankle Tap', desc: 'Low kick. Chains.', stance: 'crouch', input: { btn: 'LK', dirs: CROUCH },
    s: 4, a: 2, r: 8, pose: 'c_short', cancel: 'chain', chainTo: LIGHT_CHAIN,
    hits: [{ dmg: 25, box: [30, 2, 62, 22], onHit: 2, onBlock: 0, level: 'low', power: 'light' }] }, hurt),
  move({ id: '2MK', name: 'Ground Current', desc: 'Long low poke, cancelable.', stance: 'crouch', input: { btn: 'MK', dirs: CROUCH },
    s: 6, a: 3, r: 13, pose: 'c_poke', cancel: 'special',
    hits: [{ dmg: 60, box: [36, 2, 96, 24], onHit: 1, onBlock: -3, level: 'low', power: 'medium' }] }, hurt),
  move({ id: '2HK', name: 'Riptide Sweep', desc: 'Sweep. Knocks down. Very unsafe.', stance: 'crouch', input: { btn: 'HK', dirs: CROUCH },
    s: 8, a: 3, r: 24, pose: 'sweep',
    hits: [{ dmg: 90, box: [36, 0, 104, 26], onBlock: -12, level: 'low', power: 'heavy', kd: 'soft', launch: [1, 3] }] }, hurt),
  // ---- jumping normals (overhead)
  move({ id: 'j.LP', name: 'Air Jab', desc: 'Fast air punch.', stance: 'air', input: { btn: 'LP' },
    s: 4, a: 8, r: 6, pose: 'j_punch', cancel: 'none',
    hits: [{ dmg: 35, box: [26, 60, 52, 40], hitstun: 14, blockstun: 10, level: 'overhead', power: 'light' }] }, hurt),
  move({ id: 'j.MP', name: 'Air Straight', desc: 'Horizontal air punch, good air-to-air.', stance: 'air', input: { btn: 'MP' },
    s: 5, a: 6, r: 10, pose: 'j_punch',
    hits: [{ dmg: 60, box: [30, 76, 66, 36], hitstun: 17, blockstun: 13, level: 'overhead', power: 'medium' }] }, hurt),
  move({ id: 'j.HP', name: 'Storm Hammer', desc: 'Downward jump-in punch.', stance: 'air', input: { btn: 'HP' },
    s: 7, a: 6, r: 12, pose: 'j_hammer',
    hits: [{ dmg: 90, box: [24, 14, 74, 60], hitstun: 19, blockstun: 15, level: 'overhead', power: 'heavy' }] }, hurt),
  move({ id: 'j.LK', name: 'Cross Knee', desc: 'Knee that hits behind: cross-up tool.', stance: 'air', input: { btn: 'LK' },
    s: 4, a: 10, r: 6, pose: 'j_knee',
    hits: [{ dmg: 35, box: [-24, 0, 76, 46], hitstun: 15, blockstun: 11, level: 'overhead', power: 'light' }] }, hurt),
  move({ id: 'j.MK', name: 'Air Slice', desc: 'Long horizontal kick.', stance: 'air', input: { btn: 'MK' },
    s: 6, a: 6, r: 10, pose: 'j_kick',
    hits: [{ dmg: 60, box: [28, 20, 78, 36], hitstun: 17, blockstun: 13, level: 'overhead', power: 'medium' }] }, hurt),
  move({ id: 'j.HK', name: 'Falling Bolt', desc: 'Deep jump-in kick.', stance: 'air', input: { btn: 'HK' },
    s: 7, a: 6, r: 12, pose: 'j_flykick',
    hits: [{ dmg: 95, box: [30, 0, 86, 46], hitstun: 19, blockstun: 15, level: 'overhead', power: 'heavy' }] }, hurt),
  // ---- command normal
  move({ id: '6MP', name: 'Gale Elbow', desc: 'Overhead elbow (forward + MP). Must be blocked standing.', type: 'command', stance: 'stand',
    input: { btn: 'MP', dirs: [6] }, s: 19, a: 2, r: 14, pose: 'elbow', move: [{ f: 4, vx: 2.5 }, { f: 19, vx: 0 }],
    hits: [{ dmg: 60, box: [34, 120, 60, 70], onHit: 2, onBlock: -3, level: 'overhead', power: 'medium' }] }, hurt),

  // ---- specials
  ...variants({
    id: 'orb', name: 'Tempest Orb', desc: 'Lightning sphere projectile. L/M/H change speed.', motion: 'qcf', group: 'P',
    stance: 'stand', s: 12, a: 1, r: 32, pose: 'palm', oneProjectile: true, meterWhiff: 4, sfx: 'orb',
    hits: [], noLimbHurt: true,
  }, {
    L: { projectile: { frame: 12, def: orb('orbL', 5, 60, 1, 'orb'), x: 70, y: 150 } },
    M: { projectile: { frame: 12, def: orb('orbM', 7, 60, 1, 'orb'), x: 70, y: 150 } },
    H: { projectile: { frame: 12, def: orb('orbH', 9.5, 60, 1, 'orb'), x: 70, y: 150 } },
    EX: { s: 10, r: 28, projectile: { frame: 10, def: orb('orbEX', 10, 50, 2, 'orbEX'), x: 70, y: 150 } },
  }, hurt),
  ...variants({
    id: 'rise', name: 'Rising Storm', desc: 'Invincible rising uppercut. Anti-air and reversal.', motion: 'dp', group: 'P',
    stance: 'stand', s: 3, a: 10, r: 20, pose: 'rise', windup: 'rise_w', airborne: true, landingLag: 12, sfx: 'rise',
    noLimbHurt: true,
  }, {
    L: { invuln: { strike: [1, 5], throw: [1, 8] }, move: [{ f: 1, vx: 2 }, { f: 3, vy: 13, g: 0.85 }, { f: 12, vx: 1 }],
      hits: [{ dmg: 100, box: [12, 100, 64, 130], frames: [3, 9], power: 'special', onBlock: -20, kd: 'soft', launch: [3, 11], jug: [1, 3] }] },
    M: { invuln: { strike: [1, 7], throw: [1, 8] }, move: [{ f: 1, vx: 2.5 }, { f: 3, vy: 15, g: 0.85 }, { f: 12, vx: 1 }],
      hits: [{ dmg: 40, box: [16, 60, 64, 110], frames: [3, 5], power: 'special', hitstun: 30, onBlock: -24, jug: [0, 3] },
        { dmg: 80, box: [12, 120, 60, 130], frames: [7, 12], power: 'special', onBlock: -22, kd: 'soft', launch: [3, 12], jug: [1, 3] }] },
    H: { invuln: { strike: [1, 9], throw: [1, 10] }, move: [{ f: 1, vx: 3 }, { f: 3, vy: 17, g: 0.85 }, { f: 12, vx: 1.5 }],
      hits: [{ dmg: 50, box: [16, 60, 64, 110], frames: [3, 5], power: 'special', hitstun: 30, onBlock: -26, jug: [0, 3] },
        { dmg: 90, box: [12, 120, 60, 140], frames: [7, 13], power: 'special', onBlock: -24, kd: 'hard', launch: [3, 13], jug: [1, 3] }] },
    EX: { invuln: { strike: [1, 16], throw: [1, 16], proj: [1, 16] }, move: [{ f: 1, vx: 3 }, { f: 3, vy: 17, g: 0.85 }, { f: 12, vx: 1.5 }],
      hits: [{ dmg: 40, box: [16, 60, 64, 110], frames: [3, 5], power: 'special', hitstun: 30, onBlock: -26, jug: [0, 5] },
        { dmg: 40, box: [14, 100, 62, 120], frames: [7, 9], power: 'special', hitstun: 30, onBlock: -26, jug: [0, 5] },
        { dmg: 80, box: [12, 120, 60, 140], frames: [11, 15], power: 'special', onBlock: -24, kd: 'hard', launch: [3, 14], jug: [1, 5] }] },
  }, hurt),
  ...variants({
    id: 'cyclone', name: 'Cyclone Heel', desc: 'Advancing spin kick. H and EX pass through projectiles.', motion: 'qcb', group: 'K',
    stance: 'stand', s: 10, a: 24, r: 14, pose: 'spin', windup: 'spin_w', airborne: true, landingLag: 8, sfx: 'spin',
    hurt: [{ f: 1, boxes: [[-26, 60, 56, 150]] }],
  }, {
    L: { a: 14, move: [{ f: 6, vx: 4, vy: 4, g: 0.3 }], hits: [
      { dmg: 40, box: [-10, 100, 96, 46], frames: [10, 14], power: 'special', hitstun: 20, onBlock: -6, jug: [0, 2] },
      { dmg: 40, box: [-10, 100, 96, 46], frames: [16, 22], power: 'special', onBlock: -6, kd: 'soft', launch: [5, 8], jug: [1, 2] }] },
    M: { a: 20, move: [{ f: 6, vx: 5, vy: 4, g: 0.24 }], hits: [
      { dmg: 35, box: [-10, 100, 96, 46], frames: [10, 14], power: 'special', hitstun: 20, onBlock: -7, jug: [0, 2] },
      { dmg: 35, box: [-10, 100, 96, 46], frames: [16, 20], power: 'special', hitstun: 20, onBlock: -7, jug: [0, 2] },
      { dmg: 40, box: [-10, 100, 96, 46], frames: [22, 28], power: 'special', onBlock: -7, kd: 'soft', launch: [5, 8], jug: [1, 2] }] },
    H: { a: 26, invuln: { proj: [6, 34] }, move: [{ f: 6, vx: 6, vy: 4, g: 0.2 }], hits: [
      { dmg: 30, box: [-10, 100, 96, 46], frames: [10, 14], power: 'special', hitstun: 20, onBlock: -8, jug: [0, 2] },
      { dmg: 30, box: [-10, 100, 96, 46], frames: [16, 20], power: 'special', hitstun: 20, onBlock: -8, jug: [0, 2] },
      { dmg: 30, box: [-10, 100, 96, 46], frames: [22, 26], power: 'special', hitstun: 20, onBlock: -8, jug: [0, 2] },
      { dmg: 40, box: [-10, 100, 96, 46], frames: [28, 34], power: 'special', onBlock: -8, kd: 'soft', launch: [5, 8], jug: [1, 2] }] },
    EX: { a: 28, invuln: { proj: [1, 36], strike: [1, 9] }, move: [{ f: 6, vx: 6, vy: 4, g: 0.2 }], hits: [
      { dmg: 30, box: [-30, 90, 130, 60], frames: [10, 13], power: 'special', hitstun: 22, onBlock: -4, jug: [0, 4], vacuum: true },
      { dmg: 30, box: [-30, 90, 130, 60], frames: [15, 18], power: 'special', hitstun: 22, onBlock: -4, jug: [0, 4], vacuum: true },
      { dmg: 30, box: [-30, 90, 130, 60], frames: [20, 23], power: 'special', hitstun: 22, onBlock: -4, jug: [0, 4], vacuum: true },
      { dmg: 30, box: [-30, 90, 130, 60], frames: [25, 28], power: 'special', hitstun: 22, onBlock: -4, jug: [0, 4], vacuum: true },
      { dmg: 50, box: [-30, 90, 130, 60], frames: [30, 36], power: 'special', onBlock: -4, kd: 'soft', launch: [5, 10], jug: [1, 4] }] },
  }, hurt),

  // ---- Super Art and Ultimate
  move({ id: 'super', name: 'Storm Breaker', type: 'super', desc: 'Super Art (1 stock): invincible lightning rush combo.',
    stance: 'stand', input: { motion: 'qcf2', anyOf: 'P' }, s: 5, a: 26, r: 30, meterCost: 100, superFreeze: 40,
    invuln: { strike: [1, 12], throw: [1, 12], proj: [1, 12] }, sfx: 'super',
    move: [{ f: 1, vx: 12 }, { f: 12, vx: 1 }, { f: 30, vx: 0 }],
    hits: [
      { dmg: 40, box: [10, 60, 90, 150], frames: [5, 8], power: 'super', hitstun: 34, onBlock: -20, jug: [0, 9], vacuum: true },
      { dmg: 30, box: [10, 60, 90, 150], frames: [10, 12], power: 'super', hitstun: 34, jug: [0, 9], vacuum: true },
      { dmg: 30, box: [10, 60, 90, 150], frames: [14, 16], power: 'super', hitstun: 34, jug: [0, 9], vacuum: true },
      { dmg: 30, box: [10, 60, 90, 150], frames: [18, 20], power: 'super', hitstun: 34, jug: [0, 9], vacuum: true },
      { dmg: 30, box: [10, 60, 90, 150], frames: [22, 24], power: 'super', hitstun: 34, jug: [0, 9] },
      { dmg: 140, box: [10, 60, 100, 220], frames: [28, 30], power: 'super', hitstop: 18, kd: 'hard', launch: [6, 15], jug: [1, 9], onBlock: -24 },
    ],
    anim: [{ f: 1, pose: 'dash_f' }, { f: 5, pose: 'straight' }, { f: 9, pose: 'jab' }, { f: 13, pose: 'hook' }, { f: 17, pose: 'kick_mid' },
      { f: 21, pose: 'straight' }, { f: 26, pose: 'rise_w' }, { f: 29, pose: 'rise' }, { f: 46, pose: 'rise' }, { f: 60, pose: 'stance' }] }, hurt),
  move({ id: 'ult', name: "Heaven's Tempest", type: 'ultimate', desc: 'Ultimate (3 stocks, below 35% life): calls down a storm pillar.',
    stance: 'stand', input: { motion: 'qcf2', anyOf: 'K' }, s: 10, a: 40, r: 30, meterCost: 300, lowHp: true, superFreeze: 70,
    invuln: { strike: [1, 30], throw: [1, 30], proj: [1, 30] }, sfx: 'ultimate', noLimbHurt: true,
    hits: [
      ...[10, 14, 18, 22, 26, 30, 34, 38].map((f) => ({ dmg: 40, box: [20, 0, 250, 380] as [number, number, number, number], frames: [f, f + 1] as [number, number], power: 'super' as const, hitstun: 40, onBlock: -10, jug: [0, 20] as [number, number], vacuum: true })),
      { dmg: 180, box: [20, 0, 260, 400], frames: [46, 49], power: 'super', hitstop: 24, kd: 'hard', launch: [5, 17], jug: [1, 20], onBlock: -16 },
    ],
    anim: [{ f: 1, pose: 'ult_w' }, { f: 10, pose: 'ult' }, { f: 44, pose: 'ult' }, { f: 47, pose: 'rise' }, { f: 79, pose: 'stance' }] }, hurt),

  ...systemMoves(hurt, throwF, throwB, { throwF: 'grab', throwB: 'grab' }),
];

export const HAYATE: CharacterDef = {
  id: 'hayate',
  name: 'HAYATE',
  kanji: '疾風',
  epithet: 'The Last Gale',
  archetype: 'Balanced All-Rounder',
  description: 'A disciplined storm-dojo exile. Fireball, invincible uppercut and an advancing spin kick give him an answer for every situation.',
  stats: { power: 3, speed: 3, range: 3, defense: 3, difficulty: 2 },
  maxHp: 1000,
  maxStun: 1000,
  walkF: 4.0,
  walkB: 3.2,
  dashF: { frames: 18, dist: 120 },
  dashB: { frames: 22, dist: 110, invuln: 6 },
  jump: { prejump: 4, vy: 18.5, g: 0.85, vxF: 4.6, vxB: 4.0 },
  airJumps: 0,
  airDashes: 0,
  hurt,
  push: { stand: bx([-24, 0, 48, 200]), crouch: bx([-26, 0, 52, 130]), air: bx([-22, 40, 44, 140]) },
  body: { scale: 1, height: 246, torso: 80, neck: 10, head: 19, shoulder: 15, hipWidth: 12, upperArm: 44, foreArm: 42, thigh: 60, shin: 58, limbWidth: 13, torsoWidth: 36, style: 'hayate' },
  palettes: [
    { name: 'Gale', skin: '#d8a985', body: '#223060', bodyDark: '#111a38', cloth: '#ff2f6e', accent: '#2ff3ff', glow: '#8afcff', hair: '#0d1122', rim: '#5ff6ff' },
    { name: 'Thunderhead', skin: '#c99878', body: '#e9ecf4', bodyDark: '#8c93a8', cloth: '#ffcc33', accent: '#ffd84a', glow: '#fff2a8', hair: '#2b2b33', rim: '#ffe36b' },
  ],
  moves,
  ai: {
    aggression: 0.5, zoning: 0.5, jumpiness: 0.28, grabby: 0.22, antiAirMove: 'rise', preferredRange: 230, meterUse: 0.6,
    pokes: ['2MK', '5MK', '5MP', '2LK', '5LP'],
    combos: [['2LK', '2LP', 'cyclone_L'], ['5MP', 'orb_M'], ['2MK', 'orb_M'], ['5HP', 'rise_H'], ['2MP', 'cyclone_M'], ['5HP', 'super'], ['2MK', 'super']],
    blockstrings: [['2LK', '2LP'], ['5MP', 'orb_L'], ['2MK', 'orb_L']],
  },
  quotes: {
    intro: ['The storm doesn\'t ask permission.', 'Show me your strongest form.', 'Rain\'s heavy tonight. Let\'s make it quick.'],
    win: ['Even lightning bows to discipline.', 'Train harder. The storm will wait.', 'Your stance broke before you did.'],
  },
  arcade: {
    intro: 'Exiled from the Raijin storm-dojo for fighting in the undercity pits, Hayate enters the NEON TEMPEST to reclaim the stolen Storm Seal, his master\'s last legacy.',
    ending: 'The Storm Seal hums in Hayate\'s palm as the rain stops for the first time in a decade. He walks the empty arena alone, then turns toward the rising sun. The dojo will be rebuilt, not as a fortress, but as a place where the lost can learn to stand.',
    rival: 'warden',
  },
  trials: [
    { name: 'First Gale', hint: 'Chain lights, then cancel into a fireball.', steps: [{ move: '2LK', label: '2LK' }, { move: '2LP', label: '2LP' }, { move: 'orb', label: 'QCF+P Tempest Orb' }] },
    { name: 'Rising Fang', hint: 'Jump in deep with HP, then cancel 5HP into Rising Storm.', steps: [{ move: 'j.HP', label: 'Jump HP' }, { move: '5HP', label: '5HP' }, { move: 'rise', label: 'DP+P Rising Storm' }] },
    { name: 'Eye of the Storm', hint: 'Link 5MP after 2LP, then Cyclone Heel.', steps: [{ move: '2LP', label: '2LP' }, { move: '5MP', label: '5MP' }, { move: 'cyclone', label: 'QCB+K Cyclone Heel' }] },
    { name: 'Breaking Point', hint: 'Cancel 5HP into the Super Art (needs 1 stock).', steps: [{ move: 'j.HK', label: 'Jump HK' }, { move: '5HP', label: '5HP' }, { move: 'super', label: 'QCFx2+P Storm Breaker' }] },
  ],
  themeColor: '#2ff3ff',
};
