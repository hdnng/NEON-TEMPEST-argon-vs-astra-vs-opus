/**
 * MAGNUS - heavy grappler. Huge life and stun, slow walk, devastating command grabs (360 and
 * half-circle), an armored shoulder charge and the strongest throws in the game.
 */
import { bx, move, systemMoves, variants, type StanceBoxes } from '../build';
import type { CharacterDef, MoveDef, ThrowDef } from '../schema';

const hurt: StanceBoxes = {
  stand: [bx([-18, 222, 40, 46]), bx([-40, 118, 84, 108]), bx([-40, 0, 80, 120])],
  crouch: [bx([-14, 128, 42, 40]), bx([-44, 0, 94, 132])],
  air: [bx([-34, 40, 70, 170])],
};

const STAND = [4, 5, 6];
const CROUCH = [1, 2, 3];
const LIGHTS = ['5LP', '2LP', '5LK', '2LK'];

const piledriver = (dmg: number, range: number, power: ThrowDef['power']): ThrowDef => ({
  box: bx([0, 0, range, 180]), damage: dmg, stun: 160, techable: false, swap: false,
  release: 40, duration: 58, releaseVel: { vx: 3, vy: 7 }, knockdown: 'hard', power,
  victim: [{ f: 0, x: 62, y: 0, rot: 0 }, { f: 12, x: 24, y: 190, rot: -180 }, { f: 30, x: 30, y: 230, rot: -180 }, { f: 40, x: 52, y: 8, rot: -180 }],
  anim: [{ f: 0, pose: 'mag_grab' }, { f: 12, pose: 'mag_lift' }, { f: 30, pose: 'mag_lift' }, { f: 39, pose: 'mag_slam' }, { f: 58, pose: 'stance' }],
});

const hook = (dmg: number): ThrowDef => ({
  box: bx([20, 30, 76, 150]), damage: dmg, stun: 120, techable: false, swap: true,
  release: 26, duration: 40, releaseVel: { vx: 6, vy: 10 }, knockdown: 'soft', power: 'heavy',
  victim: [{ f: 0, x: 66, y: 10, rot: 0 }, { f: 10, x: 30, y: 120, rot: -90 }, { f: 20, x: -40, y: 130, rot: -200 }, { f: 26, x: -70, y: 60, rot: -260 }],
  anim: [{ f: 0, pose: 'mag_grab' }, { f: 10, pose: 'mag_spin' }, { f: 22, pose: 'throw_back' }, { f: 40, pose: 'stance' }],
});

const throwF: ThrowDef = {
  box: bx([10, 40, 80, 150]), damage: 150, stun: 130, techable: true, swap: false,
  release: 28, duration: 40, releaseVel: { vx: 6, vy: 8 }, knockdown: 'soft', power: 'heavy',
  victim: [{ f: 0, x: 60, y: 0, rot: 0 }, { f: 12, x: 40, y: 150, rot: -150 }, { f: 26, x: 70, y: 40, rot: -190 }],
  anim: [{ f: 0, pose: 'mag_grab' }, { f: 12, pose: 'mag_lift' }, { f: 26, pose: 'mag_slam' }, { f: 40, pose: 'stance' }],
};
const throwB: ThrowDef = { ...hook(160), techable: true, stun: 130, release: 26, duration: 40 };

const moves: MoveDef[] = [
  move({ id: '5LP', name: 'Knuckle Jab', desc: 'Heavy-handed jab. Chains into lights.', stance: 'stand', input: { btn: 'LP', dirs: STAND },
    s: 4, a: 2, r: 8, pose: 'jab', cancel: 'chain', chainTo: LIGHTS,
    hits: [{ dmg: 35, box: [40, 182, 58, 24], onHit: 3, onBlock: 1, power: 'light' }] }, hurt),
  move({ id: '5MP', name: 'Piston Palm', desc: 'Open-hand shove with great reach. Cancelable.', stance: 'stand', input: { btn: 'MP', dirs: STAND },
    s: 7, a: 3, r: 12, pose: 'mag_slap', cancel: 'special',
    hits: [{ dmg: 65, box: [44, 168, 80, 32], onHit: 3, onBlock: -2, power: 'medium', push: [26, 30] }] }, hurt),
  move({ id: '5HP', name: 'Wrecking Hammer', desc: 'Double-fist hammer. Huge damage, cancelable.', stance: 'stand', input: { btn: 'HP', dirs: STAND },
    s: 12, a: 4, r: 22, pose: 'mag_hammer', windup: 'mag_hammer_w', cancel: 'special',
    hits: [{ dmg: 130, box: [40, 110, 96, 100], onHit: 4, onBlock: -4, power: 'heavy' }] }, hurt),
  move({ id: '5LK', name: 'Shin Breaker', desc: 'Short low-ish kick.', stance: 'stand', input: { btn: 'LK', dirs: STAND },
    s: 5, a: 3, r: 10, pose: 'kick_low', cancel: 'chain', chainTo: LIGHTS,
    hits: [{ dmg: 35, box: [34, 30, 74, 30], onHit: 2, onBlock: -1, power: 'light' }] }, hurt),
  move({ id: '5MK', name: 'Gate Kick', desc: 'Long front kick. Cancelable.', stance: 'stand', input: { btn: 'MK', dirs: STAND },
    s: 8, a: 3, r: 15, pose: 'kick_mid', cancel: 'special',
    hits: [{ dmg: 80, box: [40, 90, 96, 42], onHit: 2, onBlock: -3, power: 'medium' }] }, hurt),
  move({ id: '5HK', name: 'Foundry Stomp', desc: 'Earth-shaking stomp with heavy pushback.', stance: 'stand', input: { btn: 'HK', dirs: STAND },
    s: 14, a: 4, r: 20, pose: 'mag_stomp', windup: 'mag_stomp_w',
    hits: [{ dmg: 120, box: [40, 0, 100, 70], onHit: 3, onBlock: -5, power: 'heavy', push: [30, 40] }] }, hurt),
  move({ id: '2LP', name: 'Low Knuckle', desc: 'Crouching jab. Chains.', stance: 'crouch', input: { btn: 'LP', dirs: CROUCH },
    s: 4, a: 2, r: 8, pose: 'c_jab', cancel: 'chain', chainTo: LIGHTS,
    hits: [{ dmg: 30, box: [36, 108, 58, 22], onHit: 3, onBlock: 1, power: 'light' }] }, hurt),
  move({ id: '2MP', name: 'Rivet Punch', desc: 'Crouching straight. Cancelable.', stance: 'crouch', input: { btn: 'MP', dirs: CROUCH },
    s: 7, a: 3, r: 11, pose: 'c_punch', cancel: 'special',
    hits: [{ dmg: 65, box: [40, 98, 76, 28], onHit: 3, onBlock: 0, power: 'medium' }] }, hurt),
  move({ id: '2HP', name: 'Skyhook', desc: 'Rising uppercut anti-air.', stance: 'crouch', input: { btn: 'HP', dirs: CROUCH },
    s: 8, a: 5, r: 22, pose: 'c_upper', cancel: 'special',
    hurt: [{ f: 1, boxes: [[-14, 128, 42, 40], [-44, 0, 94, 132]] }, { f: 7, boxes: [[-30, 0, 84, 220]] }, { f: 22, boxes: [[-14, 128, 42, 40], [-44, 0, 94, 132]] }],
    hits: [{ dmg: 110, box: [10, 150, 72, 120], onHit: 2, onBlock: -8, power: 'heavy', launch: [2, 10], jug: [1, 1] }] }, hurt),
  move({ id: '2LK', name: 'Ankle Crush', desc: 'Low kick. Chains.', stance: 'crouch', input: { btn: 'LK', dirs: CROUCH },
    s: 5, a: 2, r: 9, pose: 'c_short', cancel: 'chain', chainTo: LIGHTS,
    hits: [{ dmg: 30, box: [30, 2, 70, 22], onHit: 2, onBlock: -1, level: 'low', power: 'light' }] }, hurt),
  move({ id: '2MK', name: 'Dock Sweep', desc: 'Low poke. Cancelable.', stance: 'crouch', input: { btn: 'MK', dirs: CROUCH },
    s: 9, a: 3, r: 15, pose: 'c_poke', cancel: 'special',
    hits: [{ dmg: 55, box: [36, 2, 100, 26], onHit: 1, onBlock: -4, level: 'low', power: 'medium' }] }, hurt),
  move({ id: '2HK', name: 'Ground Quake', desc: 'Long sweep. Knocks down.', stance: 'crouch', input: { btn: 'HK', dirs: CROUCH },
    s: 11, a: 3, r: 28, pose: 'sweep',
    hits: [{ dmg: 110, box: [40, 0, 112, 30], onBlock: -14, level: 'low', power: 'heavy', kd: 'soft', launch: [1, 3] }] }, hurt),
  move({ id: 'j.LP', name: 'Air Knuckle', desc: 'Quick air punch.', stance: 'air', input: { btn: 'LP' },
    s: 5, a: 7, r: 6, pose: 'j_punch',
    hits: [{ dmg: 35, box: [26, 60, 58, 44], hitstun: 14, blockstun: 10, level: 'overhead', power: 'light' }] }, hurt),
  move({ id: 'j.MP', name: 'Air Ram', desc: 'Horizontal air punch.', stance: 'air', input: { btn: 'MP' },
    s: 6, a: 6, r: 10, pose: 'j_punch',
    hits: [{ dmg: 70, box: [28, 64, 76, 44], hitstun: 17, blockstun: 13, level: 'overhead', power: 'medium' }] }, hurt),
  move({ id: 'j.HP', name: 'Meteor Fist', desc: 'Crushing jump-in hammer.', stance: 'air', input: { btn: 'HP' },
    s: 9, a: 6, r: 12, pose: 'j_hammer', windup: 'j_hammer_w',
    hits: [{ dmg: 110, box: [24, 0, 88, 72], hitstun: 19, blockstun: 15, level: 'overhead', power: 'heavy' }] }, hurt),
  move({ id: 'j.LK', name: 'Cross Knee', desc: 'Knee that hits behind.', stance: 'air', input: { btn: 'LK' },
    s: 5, a: 8, r: 6, pose: 'j_knee',
    hits: [{ dmg: 35, box: [-20, 0, 84, 50], hitstun: 15, blockstun: 11, level: 'overhead', power: 'light' }] }, hurt),
  move({ id: 'j.MK', name: 'Air Boot', desc: 'Long air kick.', stance: 'air', input: { btn: 'MK' },
    s: 7, a: 6, r: 10, pose: 'j_kick',
    hits: [{ dmg: 70, box: [26, 10, 86, 42], hitstun: 17, blockstun: 13, level: 'overhead', power: 'medium' }] }, hurt),
  move({ id: 'j.HK', name: 'Body Splash', desc: 'Full-body splash with a huge hitbox.', stance: 'air', input: { btn: 'HK' },
    s: 8, a: 8, r: 10, pose: 'mag_jumpsplash',
    hits: [{ dmg: 105, box: [-10, -10, 112, 74], hitstun: 19, blockstun: 15, level: 'overhead', power: 'heavy' }] }, hurt),
  move({ id: '6HP', name: 'Anvil Drop', desc: 'Overhead hammer (forward + HP).', type: 'command', stance: 'stand', input: { btn: 'HP', dirs: [6] },
    s: 20, a: 3, r: 16, pose: 'mag_hammer', windup: 'mag_hammer_w',
    hits: [{ dmg: 90, box: [40, 80, 92, 116], onHit: 3, onBlock: -3, level: 'overhead', power: 'heavy' }] }, hurt),

  // ---- specials
  ...variants({
    id: 'cradle', name: 'Iron Cradle', desc: 'Command grab (360 + P). Unblockable, untechable piledriver. H grabs farther.', motion: '360', group: 'P',
    stance: 'stand', s: 5, a: 2, r: 32, pose: 'mag_grab', sfx: 'grab', noLimbHurt: true, cancel: 'none',
    anim: [{ f: 1, pose: 'stance' }, { f: 5, pose: 'mag_grab' }, { f: 38, pose: 'stance' }],
  }, {
    L: { s: 6, throw: piledriver(160, 80, 'heavy') },
    M: { s: 7, throw: piledriver(175, 90, 'heavy') },
    H: { s: 8, throw: piledriver(195, 100, 'super') },
    EX: { s: 5, invuln: { strike: [1, 5] }, throw: piledriver(235, 126, 'super') },
  }, hurt),
  ...variants({
    id: 'hook', name: 'Harbor Hook', desc: 'Lunging command grab (HCF + K) that hurls the opponent behind.', motion: 'hcf', group: 'K',
    stance: 'stand', s: 14, a: 8, r: 26, pose: 'mag_grab', windup: 'mag_charge_w', sfx: 'charge', noLimbHurt: true, cancel: 'none',
    anim: [{ f: 1, pose: 'mag_charge_w' }, { f: 12, pose: 'mag_grab' }, { f: 30, pose: 'mag_grab' }, { f: 47, pose: 'stance' }],
  }, {
    L: { move: [{ f: 8, vx: 6 }, { f: 21, vx: 0 }], throw: hook(125) },
    M: { move: [{ f: 8, vx: 7.5 }, { f: 21, vx: 0 }], throw: hook(135) },
    H: { move: [{ f: 8, vx: 9 }, { f: 21, vx: 0 }], throw: hook(145) },
    EX: { s: 10, move: [{ f: 5, vx: 10 }, { f: 17, vx: 0 }], invuln: { proj: [1, 18] }, throw: hook(170) },
  }, hurt),
  ...variants({
    id: 'charge', name: 'Bulwark Charge', desc: 'Armored shoulder charge (HCB + P). Absorbs one hit (EX: two).', motion: 'hcb', group: 'P',
    stance: 'stand', s: 14, a: 10, r: 20, pose: 'mag_charge', windup: 'mag_charge_w', sfx: 'charge',
  }, {
    L: { armor: { frames: [3, 20], hits: 1 }, move: [{ f: 6, vx: 7 }, { f: 24, vx: 0 }],
      hits: [{ dmg: 80, box: [20, 60, 70, 150], power: 'special', onBlock: -8, kd: 'soft', launch: [6, 7], jug: [1, 2] }] },
    M: { armor: { frames: [3, 22], hits: 1 }, move: [{ f: 6, vx: 8.5 }, { f: 25, vx: 0 }], a: 12,
      hits: [{ dmg: 100, box: [20, 60, 70, 150], power: 'special', onBlock: -9, kd: 'soft', launch: [6, 7], jug: [1, 2] }] },
    H: { armor: { frames: [3, 24], hits: 1 }, move: [{ f: 6, vx: 10 }, { f: 27, vx: 0 }], a: 14,
      hits: [{ dmg: 130, box: [20, 60, 70, 150], power: 'special', onBlock: -10, kd: 'soft', launch: [6, 8], jug: [1, 2] }] },
    EX: { s: 11, armor: { frames: [1, 24], hits: 2 }, move: [{ f: 4, vx: 11 }, { f: 22, vx: 0 }], a: 12,
      hits: [{ dmg: 70, box: [20, 60, 70, 150], power: 'special', hitstun: 22, onBlock: -2, jug: [0, 3], vacuum: true, frames: [11, 15] },
        { dmg: 90, box: [20, 60, 80, 160], power: 'special', onBlock: -4, kd: 'hard', launch: [6, 10], jug: [1, 3], frames: [17, 22] }] },
  }, hurt),
  ...variants({
    id: 'crown', name: 'Crown Breaker', desc: 'Rising headbutt anti-air (DP + K). Upper body invincible.', motion: 'dp', group: 'K',
    stance: 'stand', s: 6, a: 6, r: 24, pose: 'mag_headbutt', windup: 'mag_headbutt_w', airborne: true, landingLag: 12, sfx: 'rise',
  }, {
    L: { invuln: { strike: [1, 4], throw: [1, 4] }, move: [{ f: 4, vx: 1.5, vy: 8, g: 0.8 }],
      hits: [{ dmg: 85, box: [10, 140, 74, 120], power: 'special', onBlock: -18, kd: 'soft', launch: [3, 10], jug: [1, 3] }] },
    M: { invuln: { strike: [1, 6], throw: [1, 4] }, move: [{ f: 4, vx: 2, vy: 9, g: 0.8 }],
      hits: [{ dmg: 95, box: [10, 140, 74, 130], power: 'special', onBlock: -20, kd: 'soft', launch: [3, 11], jug: [1, 3] }] },
    H: { invuln: { strike: [1, 8], throw: [1, 4] }, move: [{ f: 4, vx: 2.5, vy: 10, g: 0.8 }],
      hits: [{ dmg: 105, box: [10, 140, 74, 140], power: 'special', onBlock: -22, kd: 'hard', launch: [3, 12], jug: [1, 3] }] },
    EX: { invuln: { strike: [1, 14], throw: [1, 14], proj: [1, 14] }, move: [{ f: 4, vx: 2.5, vy: 11, g: 0.8 }],
      hits: [{ dmg: 70, box: [10, 100, 74, 130], power: 'special', hitstun: 26, onBlock: -20, jug: [0, 4], frames: [6, 8] },
        { dmg: 110, box: [10, 140, 74, 140], power: 'special', onBlock: -22, kd: 'hard', launch: [3, 13], jug: [1, 4], frames: [10, 14] }] },
  }, hurt),

  move({ id: 'super', name: 'Meltdown Piledriver', type: 'super', desc: 'Super Art (1 stock): invincible super command grab with enormous range.',
    stance: 'stand', input: { motion: 'qcf2', anyOf: 'P' }, s: 2, a: 3, r: 44, meterCost: 100, superFreeze: 40, sfx: 'grab',
    invuln: { strike: [1, 4], proj: [1, 4] }, noLimbHurt: true,
    throw: {
      ...piledriver(340, 150, 'super'), release: 64, duration: 84, releaseVel: { vx: 4, vy: 9 },
      victim: [{ f: 0, x: 62, y: 0, rot: 0 }, { f: 14, x: 24, y: 220, rot: -180 }, { f: 30, x: 0, y: 420, rot: -540 }, { f: 52, x: 10, y: 420, rot: -720 }, { f: 64, x: 52, y: 8, rot: -900 }],
      anim: [{ f: 0, pose: 'mag_grab' }, { f: 14, pose: 'mag_lift' }, { f: 30, pose: 'mag_suplex' }, { f: 52, pose: 'mag_lift' }, { f: 63, pose: 'mag_slam' }, { f: 84, pose: 'stance' }],
    },
    anim: [{ f: 1, pose: 'mag_grab' }, { f: 48, pose: 'stance' }] }, hurt),
  move({ id: 'ult', name: 'Atlas Crusher', type: 'ultimate', desc: 'Ultimate (3 stocks, below 35% life): unstoppable armored rush that ends in a crater.',
    stance: 'stand', input: { motion: 'qcf2', anyOf: 'K' }, s: 8, a: 34, r: 30, meterCost: 300, lowHp: true, superFreeze: 70, sfx: 'ultimate',
    invuln: { strike: [1, 14], throw: [1, 14], proj: [1, 14] }, armor: { frames: [1, 40], hits: 9 },
    move: [{ f: 1, vx: 11 }, { f: 16, vx: 1 }, { f: 40, vx: 0 }],
    hits: [
      ...[8, 12, 16, 20, 24, 28].map((f) => ({ dmg: 45, box: [10, 40, 100, 180] as [number, number, number, number], frames: [f, f + 2] as [number, number], power: 'super' as const, hitstun: 40, onBlock: -8, jug: [0, 20] as [number, number], vacuum: true })),
      { dmg: 230, box: [0, 0, 150, 260], frames: [38, 41], power: 'super', hitstop: 24, kd: 'hard', launch: [4, 18], jug: [1, 20], onBlock: -20 },
    ],
    anim: [{ f: 1, pose: 'mag_charge' }, { f: 8, pose: 'mag_slap' }, { f: 12, pose: 'mag_lariat' }, { f: 16, pose: 'mag_slap' }, { f: 20, pose: 'mag_lariat' }, { f: 24, pose: 'mag_slap' }, { f: 30, pose: 'mag_hammer_w' }, { f: 38, pose: 'mag_hammer' }, { f: 71, pose: 'stance' }] }, hurt),

  ...systemMoves(hurt, throwF, throwB, { throwF: 'mag_grab', throwB: 'mag_grab' }),
];

export const MAGNUS: CharacterDef = {
  id: 'magnus',
  name: 'MAGNUS',
  kanji: '鉄塔',
  epithet: 'The Iron Tower',
  archetype: 'Heavy Grappler',
  description: 'A dockyard titan rebuilt with salvaged war-machine parts. Slow and enormous, but one read is all he needs: his command grabs end rounds.',
  stats: { power: 5, speed: 1, range: 3, defense: 5, difficulty: 3 },
  maxHp: 1020,
  maxStun: 1100,
  walkF: 2.5,
  walkB: 2.3,
  dashF: { frames: 22, dist: 110 },
  dashB: { frames: 24, dist: 90, invuln: 4 },
  jump: { prejump: 5, vy: 16.5, g: 0.82, vxF: 3.6, vxB: 3.2 },
  airJumps: 0,
  airDashes: 0,
  hurt,
  push: { stand: bx([-34, 0, 68, 220]), crouch: bx([-36, 0, 72, 150]), air: bx([-30, 40, 60, 160]) },
  body: { scale: 1.12, height: 275, torso: 92, neck: 12, head: 18, shoulder: 22, hipWidth: 16, upperArm: 50, foreArm: 48, thigh: 64, shin: 60, limbWidth: 18, torsoWidth: 46, style: 'magnus' },
  palettes: [
    { name: 'Foundry', skin: '#b67a58', body: '#646e84', bodyDark: '#2a2d3c', cloth: '#7a2c1c', accent: '#ffad2e', glow: '#ffd27a', hair: '#2a1a14', rim: '#ffb84d' },
    { name: 'Coldsteel', skin: '#8f6a55', body: '#7d8aa8', bodyDark: '#141a2a', cloth: '#1d3a5c', accent: '#4fd8ff', glow: '#b8f2ff', hair: '#d8d8d8', rim: '#7fe6ff' },
  ],
  moves,
  ai: {
    aggression: 0.55, zoning: 0.05, jumpiness: 0.22, grabby: 0.75, antiAirMove: 'crown', preferredRange: 120, meterUse: 0.6,
    pokes: ['5MK', '2MK', '5MP', '5LP', '5HK'],
    combos: [['2LK', '2LP', 'charge_L'], ['5MP', 'charge_M'], ['5HP', 'charge_H'], ['2MK', 'charge_L'], ['2MP', 'charge_M']],
    blockstrings: [['2LK', '2LP'], ['5MP', 'charge_L'], ['5LP', '5LP']],
  },
  quotes: {
    intro: ['Come closer. I don\'t bite. I crush.', 'The docks taught me one thing: everything breaks.', 'Your speed means nothing once I have you.'],
    win: ['Gravity always wins.', 'Get up. Oh... you can\'t.', 'The tower stands. You don\'t.'],
  },
  arcade: {
    intro: 'Once the pride of the Harbor Union, Magnus was crushed under a collapsing crane and rebuilt by black-market cyber-surgeons. He fights for the purse that will buy back the docks from the syndicate that left his crew to drown.',
    ending: 'Magnus slams the winner\'s cheque onto the syndicate boss\'s desk and tears the deed to the docks in half. By dawn the cranes are moving again, and every worker on the harbor knows whose iron hands rebuilt it.',
    rival: 'hayate',
  },
  trials: [
    { name: 'Iron Will', hint: 'Cancel 5MP into Bulwark Charge.', steps: [{ move: '5MP', label: '5MP' }, { move: 'charge', label: 'HCB+P Bulwark Charge' }] },
    { name: 'Foundry Rhythm', hint: 'Deep jump-in HP, land into 5MP, cancel into the charge.', steps: [{ move: 'j.HP', label: 'Jump HP' }, { move: '5MP', label: '5MP' }, { move: 'charge', label: 'HCB+P Bulwark Charge' }] },
    { name: 'Crown Rule', hint: 'Chain lights, then cancel into Crown Breaker.', steps: [{ move: '2LK', label: '2LK' }, { move: '2LP', label: '2LP' }, { move: 'crown', label: 'DP+K Crown Breaker' }] },
  ],
  themeColor: '#ffad2e',
};
