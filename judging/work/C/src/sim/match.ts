/**
 * Match orchestration: the fixed 60 Hz step function, round flow (intro, fight, KO slow motion,
 * time over, round end, match end), training refills and frame-advantage tracking.
 *
 * stepMatch(state, [p1Bits, p2Bits]) is the ONLY way the simulation advances. It is pure with
 * respect to its inputs: the same initial state and input sequence always yields the same state.
 */
import { resolveStrikes, resolveThrows, updateProjectiles, updateThrowHolds } from './combat';
import {
  createFighter, isActionable, isGroundNeutral, physics, resetFighterForRound, resolvePush, setState, updateFighter,
} from './fighter';
import { pushInput, resetInput } from './input';
import { getChar } from './registry';
import { METER_MAX, type FighterState, type MatchConfig, type MatchState, type RoundResult } from './types';
import { ev, fx } from './util';

export const START_X = 210;
export const INTRO_FIRST = 170;
export const INTRO_NEXT = 110;
export const ROUND_END_FRAMES = 170;
export const KO_SLOWMO = 84;

export function defaultConfig(partial: Partial<MatchConfig> = {}): MatchConfig {
  return {
    chars: ['hayate', 'hayate'],
    palettes: [0, 1],
    stage: 'rooftop',
    seed: 12345,
    roundsToWin: 2,
    roundTime: 99,
    training: false,
    trainingOpts: { infiniteHp: true, infiniteMeter: true, noStun: false },
    skipIntro: false,
    ...partial,
  };
}

export function createMatch(config: MatchConfig): MatchState {
  const s: MatchState = {
    frame: 0,
    rng: config.seed | 0,
    phase: 'intro',
    phaseFrame: 0,
    round: 1,
    timer: config.roundTime,
    timerSub: 0,
    wins: [0, 0],
    results: [],
    freeze: 0,
    freezeOwner: -1,
    freezeKind: '',
    slowmo: 0,
    matchWinner: -2,
    roundWinner: -2,
    timeOver: false,
    fighters: [createFighter(0, config.chars[0], config.palettes[0]), createFighter(1, config.chars[1], config.palettes[1])],
    projectiles: [],
    nextProjId: 1,
    events: [],
    config,
    finalRound: false,
    adv: { active: false, attacker: 0, af: -1, vf: -1, move: '', blocked: false },
    neutralFrames: 0,
  };
  startRound(s);
  if (config.training) {
    for (const f of s.fighters) f.meter = METER_MAX;
  }
  return s;
}

function introLength(s: MatchState): number {
  if (s.config.skipIntro) return 1;
  return s.round === 1 ? INTRO_FIRST : INTRO_NEXT;
}

function startRound(s: MatchState): void {
  const intro = !s.config.skipIntro;
  resetFighterForRound(s.fighters[0], -START_X, 1, intro);
  resetFighterForRound(s.fighters[1], START_X, -1, intro);
  for (const f of s.fighters) resetInput(f);
  s.projectiles.length = 0;
  s.phase = 'intro';
  s.phaseFrame = 0;
  s.timer = s.config.roundTime;
  s.timerSub = 0;
  s.freeze = 0;
  s.slowmo = 0;
  s.roundWinner = -2;
  s.timeOver = false;
  s.adv.active = false;
  s.neutralFrames = 0;
}

/** Advance the match by one 60 Hz frame. */
export function stepMatch(s: MatchState, inputs: readonly [number, number] | number[]): void {
  s.events.length = 0;
  s.frame++;
  const [a, b] = s.fighters;
  const skipWorld = s.freeze > 0 || (s.slowmo > 0 && (s.slowmo - 1) % 3 !== 0);
  pushInput(a, inputs[0] | 0, skipWorld || a.hitstop > 0);
  pushInput(b, inputs[1] | 0, skipWorld || b.hitstop > 0);

  if (s.phase === 'matchEnd') { s.phaseFrame++; return; }

  if (s.freeze > 0) {
    s.freeze--;
    if (s.freeze === 0) ev(s, 'freezeEnd', s.freezeOwner);
    return;
  }
  if (s.slowmo > 0) {
    s.slowmo--;
    if (s.slowmo % 3 !== 0) return;
  }
  s.phaseFrame++;

  if (s.phase === 'intro') {
    if (s.phaseFrame === 1) ev(s, 'roundStart', -1, 0, 0, s.finalRound ? 'final' : '', s.round);
    if (s.phaseFrame === 50 && !s.config.skipIntro && s.round === 1) {
      for (const f of s.fighters) if (f.state === 'intro') setState(f, 'idle');
    }
    if (s.phaseFrame >= introLength(s)) {
      for (const f of s.fighters) if (f.state === 'intro') setState(f, 'idle');
      s.phase = 'fight';
      s.phaseFrame = 0;
      ev(s, 'fight', -1);
    }
  }

  const canAct = s.phase === 'fight';
  const prevX: [number, number] = [a.x, b.x];
  const frozen = [a.hitstop > 0, b.hitstop > 0];
  for (let i = 0; i < 2; i++) {
    const f = s.fighters[i], o = s.fighters[1 - i];
    if (frozen[i]) {
      f.hitstop--;
      if (f.shake > 0) f.shake--;
      continue;
    }
    if (f.state === 'thrown') { f.sf++; continue; }
    updateFighter(s, f, o, canAct && !f.koed && !(s.phase === 'ko' && s.roundWinner !== -2));
  }
  for (let i = 0; i < 2; i++) {
    if (!frozen[i]) physics(s, s.fighters[i], s.fighters[1 - i]);
  }
  resolvePush(s, prevX);
  updateThrowHolds(s);
  if (s.phase === 'fight' || s.phase === 'ko') {
    resolveThrows(s);
    resolveStrikes(s);
  }
  updateProjectiles(s);
  trackAdvantage(s);
  roundLogic(s);
  if (s.config.training) trainingLogic(s);
}

function trackAdvantage(s: MatchState): void {
  const t = s.adv;
  if (!t.active) return;
  const att = s.fighters[t.attacker], vic = s.fighters[1 - t.attacker];
  if (t.af < 0 && isActionable(att)) t.af = s.frame;
  if (t.vf < 0 && isActionable(vic)) t.vf = s.frame;
  if (t.af >= 0 && t.vf >= 0) {
    t.active = false;
    ev(s, 'adv', t.attacker, 0, 0, t.move, t.vf - t.af);
  }
}

function settled(f: FighterState): boolean {
  if (f.koed) return f.state === 'ko';
  return isGroundNeutral(f) || f.state === 'land' || f.state === 'win' || f.state === 'lose' || f.state === 'dizzy';
}

function roundLogic(s: MatchState): void {
  const [a, b] = s.fighters;
  if (s.phase === 'fight') {
    // KO
    const koA = a.hp <= 0, koB = b.hp <= 0;
    if (koA || koB) {
      if (s.config.training && s.config.trainingOpts.infiniteHp) {
        for (const f of s.fighters) if (f.hp <= 0) f.hp = 1;
        return;
      }
      s.phase = 'ko';
      s.phaseFrame = 0;
      s.slowmo = KO_SLOWMO;
      s.roundWinner = koA && koB ? -1 : koA ? 1 : 0;
      for (const f of s.fighters) if (f.hp <= 0) koFighter(f);
      ev(s, 'ko', s.roundWinner, 0, 0, koA && koB ? 'double' : '');
      return;
    }
    // Timer
    if (!s.config.training && s.config.roundTime > 0) {
      if (++s.timerSub >= 60) {
        s.timerSub = 0;
        s.timer--;
        if (s.timer <= 10 && s.timer > 0) ev(s, 'timerWarn', -1, 0, 0, '', s.timer);
        if (s.timer <= 0) {
          s.timer = 0;
          s.phase = 'ko';
          s.phaseFrame = 0;
          s.timeOver = true;
          const ra = a.hp * 10000 / getChar(a.char).maxHp, rb = b.hp * 10000 / getChar(b.char).maxHp;
          s.roundWinner = ra > rb ? 0 : rb > ra ? 1 : -1;
          ev(s, 'timeover', s.roundWinner);
        }
      }
    }
    return;
  }
  if (s.phase === 'ko') {
    const done = (s.phaseFrame > 70 && settled(a) && settled(b)) || s.phaseFrame > 260;
    if (!done) return;
    let kind: RoundResult['kind'];
    const w = s.roundWinner;
    if (s.timeOver) kind = w === -1 ? 'draw' : 'timeout';
    else if (w === -1) kind = 'double';
    else kind = s.fighters[w].hp >= getChar(s.fighters[w].char).maxHp ? 'perfect' : 'ko';
    s.results.push({ winner: w, kind });
    if (w === -1) { s.wins[0]++; s.wins[1]++; }
    else s.wins[w]++;
    for (const f of s.fighters) {
      f.move = ''; f.vx = 0; f.pushV = 0;
      if (f.koed) continue;
      if (w === f.idx) setState(f, 'win');
      else if (s.timeOver) setState(f, 'lose');
    }
    s.projectiles.length = 0;
    for (const f of s.fighters) f.proj = 0;
    s.phase = 'roundEnd';
    s.phaseFrame = 0;
    ev(s, 'roundEnd', w, 0, 0, kind, w);
    return;
  }
  if (s.phase === 'roundEnd') {
    if (s.phaseFrame < ROUND_END_FRAMES) return;
    if (s.config.training) { s.round++; startRound(s); return; }
    const need = s.config.roundsToWin;
    const [wa, wb] = s.wins;
    let over = false;
    if (wa >= need && wb >= need) {
      if (s.round >= 5) { s.matchWinner = -1; over = true; }
      else s.finalRound = true;
      if (!over) { s.wins = [need - 1, need - 1]; }
    } else if (wa >= need) { s.matchWinner = 0; over = true; }
    else if (wb >= need) { s.matchWinner = 1; over = true; }
    if (over) {
      s.phase = 'matchEnd';
      s.phaseFrame = 0;
      ev(s, 'matchEnd', s.matchWinner);
      return;
    }
    s.round++;
    startRound(s);
  }
}

function koFighter(f: FighterState): void {
  f.koed = true;
  f.hp = 0;
  f.dizzyPending = false;
  f.grabbedBy = -1;
  if (f.state !== 'juggle') {
    setState(f, 'juggle');
    f.air = true;
    f.y = Math.max(f.y, 1);
    f.vx = -fx(4) * f.facing;
    f.vy = fx(9);
    f.g = fx(0.6);
  } else {
    f.vy = Math.max(f.vy, fx(6));
  }
  f.kd = 2;
}

function trainingLogic(s: MatchState): void {
  const o = s.config.trainingOpts;
  const [a, b] = s.fighters;
  const neutral = isGroundNeutral(a) && isGroundNeutral(b) && a.combo === 0 && b.combo === 0;
  s.neutralFrames = neutral ? s.neutralFrames + 1 : 0;
  for (const f of s.fighters) {
    if (o.infiniteMeter && f.burnout <= 0) f.meter = METER_MAX;
    if (o.noStun) { f.stun = 0; f.dizzyPending = false; }
  }
  if (o.infiniteHp && s.neutralFrames === 40) {
    for (const f of s.fighters) f.hp = getChar(f.char).maxHp;
    ev(s, 'refill', -1);
  }
}
