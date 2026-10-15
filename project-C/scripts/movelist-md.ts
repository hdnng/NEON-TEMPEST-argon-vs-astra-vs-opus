/**
 * Prints every fighter's move list (with frame data) as Markdown, straight from the data files.
 *   npx tsx scripts/movelist-md.ts > movelist.md
 */
import { CHARACTER_LIST } from '../src/data/characters';
import type { MoveDef } from '../src/data/schema';
import { moveTotal } from '../src/sim/registry';

const MOTION: Record<string, string> = {
  qcf: '↓↘→', qcb: '↓↙←', dp: '→↓↘', rdp: '←↓↙', hcf: '←↙↓↘→', hcb: '→↘↓↙←', '360': '360°',
  qcf2: '↓↘→↓↘→', qcb2: '↓↙←↓↙←', hcf2: '←↓→←↓→', chargeBF: '[←] →', chargeDU: '[↓] ↑', chargeBFBF: '[←] → ← →',
};
const DIR: Record<number, string> = { 1: '↙', 2: '↓', 3: '↘', 4: '←', 6: '→', 7: '↖', 8: '↑', 9: '↗' };

function input(m: MoveDef): string {
  const r = m.input;
  let btn = r.btn ?? '';
  if (r.anyOf) btn = r.anyOf;
  if (r.two) btn = r.two + r.two;
  if (r.combo) btn = r.combo.join('+');
  let pre = '';
  if (r.motion) pre = MOTION[r.motion] + ' ';
  else if (m.stance === 'air') pre = r.dirs ? `(air) ${DIR[r.dirs[1] ?? r.dirs[0]]} ` : '(air) ';
  else if (r.dirs && r.dirs.length === 1) pre = DIR[r.dirs[0]] + ' ';
  else if (r.dirs && r.dirs.every((d) => d <= 3)) pre = '↓ ';
  else if (r.dirs && r.dirs.includes(4) && !r.dirs.includes(5)) pre = '← ';
  return `${pre}${btn}`.trim();
}

function adv(m: MoveDef): [string, string] {
  if (!m.hits.length) return m.projectile ? ['proj', 'proj'] : ['-', '-'];
  const last = m.hits[m.hits.length - 1];
  if (m.airborne || m.stance === 'air') return [last.knockdown ? 'KD' : '-', '-'];
  const left = moveTotal(m) - last.frames[0];
  const s = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  return [last.knockdown ? 'KD' : s(last.hitstun - left), s(last.blockstun - left)];
}

const out: string[] = [];
for (const c of CHARACTER_LIST) {
  out.push(`### ${c.name} (${c.kanji}) — ${c.archetype}`, '', `*${c.epithet}.* ${c.description}`, '');
  out.push(`Life ${c.maxHp} · Stun ${c.maxStun} · Walk ${c.walkF}/${c.walkB} px/f${c.airJumps ? ' · Double jump' : ''}${c.airDashes ? ' · Air dash' : ''}`, '');
  out.push('| Move | Input | Startup | Active | Recovery | On hit | On block | Damage | Level | Notes |', '|---|---|---|---|---|---|---|---|---|---|');
  const order = ['super', 'ultimate', 'special', 'ex', 'command', 'throw', 'normal'];
  const moves = c.moves.filter((m) => !['drive', 'guardcancel', 'pushblock'].includes(m.type))
    .sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  for (const m of moves) {
    const [h, b] = adv(m);
    const dmg = m.throw ? m.throw.damage : m.projectile ? m.projectile.def.hit.damage * m.projectile.def.hits : m.hits.reduce((x, y) => x + y.damage, 0);
    const lvl = m.throw ? 'throw' : m.hits[0]?.level ?? (m.projectile ? 'mid' : '-');
    const notes: string[] = [];
    if (m.meterCost) notes.push(`${m.meterCost / 100} stock${m.meterCost === 100 ? '' : 's'}`);
    if (m.lowHp) notes.push('life ≤ 35%');
    if (m.invuln?.strike) notes.push(`strike inv ${m.invuln.strike[0]}-${m.invuln.strike[1]}`);
    if (m.armor) notes.push(`armor ×${m.armor.hits} (${m.armor.frames[0]}-${m.armor.frames[1]})`);
    if (m.throw && !m.throw.techable) notes.push('untechable');
    if (m.followFrom) notes.push(`after ${m.followFrom.join('/')}`);
    if (m.cancel?.into.includes('special')) notes.push('special-cancelable');
    out.push(`| ${m.name}${m.id.includes('_') ? ` (${m.id.split('_')[1]})` : ''} | \`${input(m)}\` | ${m.projectile ? m.projectile.frame : m.startup} | ${m.projectile ? '-' : m.active} | ${m.recovery} | ${h} | ${b} | ${dmg} | ${lvl} | ${notes.join(', ')} |`);
  }
  out.push('');
}
console.log(out.join('\n'));
