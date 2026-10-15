import { CHARACTER_LIST, CHARACTERS } from '../data/characters';
import { CharacterId, MoveDef } from '../core/types';

export class MoveListRenderer {
  public renderMoveList(
    ctx: CanvasRenderingContext2D,
    charId: CharacterId,
    scrollOffset: number,
    showCharTabs: boolean
  ): number {
    const charDef = CHARACTERS[charId];

    ctx.save();
    // Backdrop
    ctx.fillStyle = 'rgba(3, 7, 18, 0.96)';
    ctx.fillRect(60, 40, 1160, 640);
    ctx.strokeStyle = charDef.palette.primary;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(60, 40, 1160, 640);

    // Header
    ctx.fillStyle = charDef.palette.primary;
    ctx.font = 'bold 22px "Segoe UI", "Orbitron", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(
      `COMMAND ARCHIVE // ${charDef.name} [${charDef.archetype}]`,
      90,
      82
    );

    if (showCharTabs) {
      let tx = 665;
      for (const c of CHARACTER_LIST) {
        const active = c.id === charId;
        ctx.fillStyle = active ? c.palette.primary : 'rgba(15, 28, 52, 0.9)';
        ctx.fillRect(tx, 56, 122, 32);
        ctx.strokeStyle = c.palette.primary;
        ctx.lineWidth = active ? 2 : 1.2;
        ctx.strokeRect(tx, 56, 122, 32);
        ctx.fillStyle = active ? '#020612' : '#d8f0ff';
        ctx.font = 'bold 13px "Segoe UI", "Orbitron", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(c.name, tx + 61, 77);
        tx += 132;
      }
    }

    // System Mechanics Quick Reference Bar
    ctx.fillStyle = 'rgba(10, 22, 46, 0.9)';
    ctx.fillRect(90, 100, 1100, 42);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(90, 100, 1100, 42);

    ctx.fillStyle = '#00f0ff';
    ctx.font = 'bold 12px "Consolas", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(
      'SYSTEM MECHANICS:  [LP+LK] Throw / Tech   |   [MP+MK] Cyber Parry   |   [Block + PP] Pushblock   |   [HP+HK] Tempest Overdrive (150 Meter)',
      106,
      125
    );

    // Filter signature moves to display (Unique Specials, Supers, Ultimates, Command Normals, Throws, Key Normals)
    const displayMoves: MoveDef[] = [];
    const seenBase = new Set<string>();

    for (const moveId of charDef.moveOrder) {
      const m = charDef.moves[moveId];
      if (!m) continue;
      if (m.category === 'special') {
        const base = moveId.replace(/_(l|m|h)$/, '');
        if (seenBase.has(base)) continue;
        seenBase.add(base);
      }
      displayMoves.push(m);
    }

    // Column Headers
    const listTop = 162;
    ctx.fillStyle = '#7ea8cc';
    ctx.font = 'bold 12px "Consolas", monospace';
    ctx.fillText('MOVE NAME & DESCRIPTION', 104, listTop);
    ctx.fillText('COMMAND INPUT', 480, listTop);
    ctx.fillText('DMG / LEVEL', 715, listTop);
    ctx.fillText('FRAME DATA (START / ACT / REC)', 860, listTop);

    // Clip move rows area to fit exactly 8 rows cleanly without cutting a 9th row in half
    const visibleRows = 8;
    const rowH = 54;
    const listAreaY = listTop + 12;
    const listAreaH = visibleRows * rowH;

    ctx.save();
    ctx.beginPath();
    ctx.rect(85, listAreaY, 1100, listAreaH);
    ctx.clip();

    const maxScroll = Math.max(0, displayMoves.length - visibleRows);
    const clampedScroll = Math.max(0, Math.min(maxScroll, scrollOffset));

    for (let i = 0; i < displayMoves.length; i++) {
      const m = displayMoves[i];
      const ry = listAreaY + (i - clampedScroll) * rowH;
      if (ry + rowH <= listAreaY || ry >= listAreaY + listAreaH) continue;

      const isSuper = m.category === 'super' || m.category === 'ultimate';
      const isEx = m.category === 'ex_special';
      const isSpecial = m.category === 'special';

      ctx.fillStyle = isSuper
        ? 'rgba(55, 10, 45, 0.82)'
        : isEx
        ? 'rgba(10, 42, 55, 0.82)'
        : i % 2 === 0
        ? 'rgba(10, 20, 42, 0.78)'
        : 'rgba(6, 13, 28, 0.78)';
      ctx.fillRect(90, ry, 1086, rowH - 6);

      const accent = isSuper
        ? '#ff007f'
        : isEx
        ? '#00ffaa'
        : isSpecial
        ? '#00f0ff'
        : '#38b6ff';
      ctx.fillStyle = accent;
      ctx.fillRect(90, ry, 5, rowH - 6);

      // Name & description (cleanly truncated before command input column at x=480)
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px "Segoe UI", "Orbitron", sans-serif';
      ctx.fillText(m.name.replace(' (L)', ' (L / M / H)'), 108, ry + 20);

      ctx.fillStyle = '#9cc0e0';
      ctx.font = '11px "Segoe UI", sans-serif';
      const descText =
        m.description.length > 58 ? m.description.slice(0, 56) + '…' : m.description;
      ctx.fillText(descText, 108, ry + 39);

      // Command Notation with Arrow Icons
      this.drawNotationIcons(ctx, m.inputNotation, 480, ry + 26, accent);

      // Damage & Hit Level
      ctx.fillStyle = '#ffbe00';
      ctx.font = 'bold 13px "Consolas", monospace';
      ctx.fillText(`${m.damage} DMG  [${m.hitLevel.toUpperCase()}]`, 715, ry + 28);

      // Frame Data
      ctx.fillStyle = '#d8f4ff';
      ctx.font = '13px "Consolas", monospace';
      ctx.fillText(
        `S: ${m.startup}f  |  A: ${m.active}f  |  R: ${m.recovery}f  (Tot: ${m.totalFrames}f)`,
        860,
        ry + 28
      );
    }

    ctx.restore();

    // Neon Scrollbar Track & Thumb on the right
    if (maxScroll > 0) {
      const sbX = 1184;
      const sbY = listAreaY;
      const sbH = listAreaH - 6;
      ctx.fillStyle = 'rgba(10, 24, 48, 0.9)';
      ctx.fillRect(sbX, sbY, 6, sbH);
      const thumbH = Math.max(36, (visibleRows / displayMoves.length) * sbH);
      const thumbY = sbY + (clampedScroll / maxScroll) * (sbH - thumbH);
      ctx.fillStyle = charDef.palette.primary;
      ctx.fillRect(sbX, thumbY, 6, thumbH);
    }

    // Footer instructions
    ctx.fillStyle = '#00f0ff';
    ctx.font = 'bold 13px "Consolas", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      showCharTabs
        ? `[← / →] SWITCH CHARACTER    [↑ / ↓] SCROLL MOVES (${clampedScroll + 1}-${Math.min(displayMoves.length, clampedScroll + visibleRows)}/${displayMoves.length})    [ESC / BACKSPACE] RETURN`
        : '[↑ / ↓] SCROLL MOVES    [ESC / ENTER / BACKSPACE] RETURN TO MATCH',
      640,
      656
    );

    ctx.restore();
    return maxScroll;
  }

  private drawNotationIcons(
    ctx: CanvasRenderingContext2D,
    notation: string,
    x: number,
    y: number,
    color: string
  ): void {
    const pretty = notation
      .replace('236236', '↓ ↘ → ↓ ↘ →')
      .replace('41236', '← ↙ ↓ ↘ →')
      .replace('63214', '→ ↘ ↓ ↙ ←')
      .replace('623', '→ ↓ ↘')
      .replace('236', '↓ ↘ →')
      .replace('214', '↓ ↙ ←')
      .replace('[4]6', '[Hold ←] →')
      .replace('[2]8', '[Hold ↓] ↑')
      .replace('360', '↻ 360°');

    ctx.save();
    ctx.fillStyle = 'rgba(0, 240, 255, 0.14)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    const w = Math.min(225, Math.max(90, pretty.length * 9 + 18));
    ctx.fillRect(x, y - 16, w, 24);
    ctx.strokeRect(x, y - 16, w, 24);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px "Segoe UI", "Consolas", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(pretty, x + 8, y + 1);
    ctx.restore();
  }
}
