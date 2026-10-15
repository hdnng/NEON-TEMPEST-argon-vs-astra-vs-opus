import { getFighterBoxes } from '../core/simulation';
import { CHARACTERS } from '../data/characters';
import {
  ActiveProjectile,
  CharacterDef,
  CharacterId,
  CharacterPalette,
  FighterState,
  PoseType
} from '../core/types';
import { lerp } from '../utils/math';

interface JointPose {
  hipX: number;
  hipY: number;
  torsoTilt: number; // radians
  headX: number;
  headY: number;
  frontHandX: number;
  frontHandY: number;
  backHandX: number;
  backHandY: number;
  frontFootX: number;
  frontFootY: number;
  backFootX: number;
  backFootY: number;
  weaponAngle: number;
  weaponGlow: boolean;
}

export class FighterRenderer {
  public renderFighter(
    ctx: CanvasRenderingContext2D,
    fighter: FighterState,
    interpAlpha: number,
    floorY: number,
    frame: number,
    colorblindMode = false
  ): void {
    const charDef = CHARACTERS[fighter.charId];
    const palette = this.resolvePalette(charDef, fighter.useAltPalette, fighter.playerIndex, colorblindMode);

    // Interpolate world position
    let drawX = lerp(fighter.prevX, fighter.x, interpAlpha);
    const drawY = lerp(fighter.prevY, fighter.y, interpAlpha);

    // Hitstop shake when being struck
    if (
      fighter.hitstopFrames > 0 &&
      (fighter.status === 'hitstun_stand' ||
        fighter.status === 'hitstun_crouch' ||
        fighter.status === 'hitstun_air' ||
        fighter.status === 'block_stand' ||
        fighter.status === 'block_crouch')
    ) {
      drawX += (fighter.hitstopFrames % 2 === 0 ? 1 : -1) * 5;
    }

    // 1. Ground Shadow & Neon Floor Glow
    ctx.save();
    const heightFactor = Math.max(0.35, 1 - Math.abs(drawY) / 320);
    const shadowW = (fighter.charId === 'magnus' ? 58 : 44) * heightFactor;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.ellipse(drawX, floorY + 4, shadowW, 10 * heightFactor, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = palette.primary;
    ctx.globalAlpha = 0.35 * heightFactor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(drawX, floorY + 4, shadowW * 0.85, 6 * heightFactor, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 2. Overdrive / EX Afterimage or Aura
    ctx.save();
    ctx.translate(drawX, floorY + drawY);
    ctx.scale(fighter.facing, 1);

    if (fighter.overdriveTimer > 0) {
      ctx.save();
      ctx.strokeStyle = '#ffbe00';
      ctx.shadowColor = '#ffbe00';
      ctx.shadowBlur = 24;
      ctx.globalAlpha = 0.45 + Math.sin(frame * 0.35) * 0.2;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, -85, 52, 92, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 3. Compute Articulated Pose
    const poseType = this.resolvePoseType(fighter, charDef);
    const animT =
      fighter.status === 'attack' && fighter.currentMoveId
        ? fighter.moveFrame / Math.max(1, charDef.moves[fighter.currentMoveId]?.totalFrames ?? 20)
        : fighter.statusFrame;
    const pose = this.computeJointPose(poseType, animT, frame + fighter.playerIndex * 19);

    // 4. Draw Articulated Character Body
    this.drawArticulatedCharacter(ctx, fighter.charId, palette, pose, frame, fighter);

    // 5. Dizzy Stars / Cyber Glitch Ring if Stunned
    if (fighter.status === 'dizzy') {
      ctx.save();
      for (let i = 0; i < 3; i++) {
        const a = frame * 0.14 + (i * Math.PI * 2) / 3;
        const sx = Math.cos(a) * 32;
        const sy = -182 + Math.sin(a) * 9;
        ctx.fillStyle = i % 2 === 0 ? '#ffbe00' : '#00f0ff';
        ctx.shadowColor = '#ffbe00';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(sx, sy, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.restore();
  }

  public renderProjectiles(
    ctx: CanvasRenderingContext2D,
    projectiles: ActiveProjectile[],
    interpAlpha: number,
    floorY: number,
    frame: number
  ): void {
    for (const p of projectiles) {
      const px = lerp(p.prevX, p.x, interpAlpha);
      const py = floorY + lerp(p.prevY, p.y, interpAlpha);

      ctx.save();
      ctx.translate(px, py);
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 18;

      if (p.style === 'shuriken') {
        // Spinning 4-point plasma shuriken with energy ring
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, p.width * 0.48, 0, Math.PI * 2);
        ctx.stroke();

        ctx.rotate(frame * 0.45 * p.facing);
        ctx.fillStyle = p.coreColor;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          const a = (i * Math.PI) / 2;
          ctx.lineTo(Math.cos(a) * (p.width * 0.55), Math.sin(a) * (p.width * 0.55));
          ctx.lineTo(
            Math.cos(a + Math.PI / 4) * (p.width * 0.18),
            Math.sin(a + Math.PI / 4) * (p.width * 0.18)
          );
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        // Rail Pulse Beam / Crescent Wave
        ctx.scale(p.facing, 1);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(-p.width * 0.5, -p.height * 0.35);
        ctx.lineTo(p.width * 0.5, 0);
        ctx.lineTo(-p.width * 0.5, p.height * 0.35);
        ctx.lineTo(-p.width * 0.25, 0);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = p.coreColor;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.width * 0.32, p.height * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  /**
   * Renders Training Mode Hitboxes, Hurtboxes, Pushboxes, and Throwboxes.
   */
  public renderDebugBoxes(
    ctx: CanvasRenderingContext2D,
    fighter: FighterState,
    floorY: number
  ): void {
    const boxes = getFighterBoxes(fighter);
    ctx.save();
    ctx.translate(0, floorY);

    // Pushbox (Green)
    ctx.fillStyle = 'rgba(0, 255, 100, 0.15)';
    ctx.strokeStyle = '#00ff66';
    ctx.lineWidth = 1.5;
    ctx.fillRect(boxes.pushbox.x, boxes.pushbox.y, boxes.pushbox.w, boxes.pushbox.h);
    ctx.strokeRect(boxes.pushbox.x, boxes.pushbox.y, boxes.pushbox.w, boxes.pushbox.h);

    // Hurtboxes (Cyan/Blue)
    ctx.fillStyle = 'rgba(0, 180, 255, 0.22)';
    ctx.strokeStyle = '#00ccff';
    ctx.lineWidth = 1.5;
    for (const b of boxes.hurtboxes) {
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeRect(b.x, b.y, b.w, b.h);
    }

    // Hitboxes (Red) - also display during active frames/hitstop when a single-hit move just connected
    let activeHitboxes = boxes.hitboxes;
    if (
      activeHitboxes.length === 0 &&
      fighter.status === 'attack' &&
      fighter.currentMoveId
    ) {
      const move = CHARACTERS[fighter.charId].moves[fighter.currentMoveId];
      if (
        move &&
        move.boxes.hitboxes &&
        fighter.moveFrame >= move.startup &&
        fighter.moveFrame < move.startup + move.active
      ) {
        activeHitboxes = move.boxes.hitboxes.map((b) => ({
          x: fighter.facing === 1 ? fighter.x + b.x : fighter.x - b.x - b.w,
          y: fighter.y + b.y,
          w: b.w,
          h: b.h
        }));
      }
    }
    ctx.fillStyle = 'rgba(255, 20, 60, 0.42)';
    ctx.strokeStyle = '#ff143c';
    ctx.lineWidth = 2.5;
    for (const b of activeHitboxes) {
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.save();
      ctx.fillStyle = '#ff143c';
      ctx.font = 'bold 10px "Consolas", monospace';
      ctx.fillText('HITBOX', b.x + 4, b.y + 12);
      ctx.restore();
    }

    // Center-of-mass pivot crosshair at (fighter.x, fighter.y)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(fighter.x - 6, fighter.y);
    ctx.lineTo(fighter.x + 6, fighter.y);
    ctx.moveTo(fighter.x, fighter.y - 6);
    ctx.lineTo(fighter.x, fighter.y + 6);
    ctx.stroke();

    // Throwbox (Yellow/Magenta)
    if (boxes.throwbox) {
      ctx.fillStyle = 'rgba(255, 200, 0, 0.35)';
      ctx.strokeStyle = '#ffcc00';
      ctx.lineWidth = 2;
      ctx.fillRect(
        boxes.throwbox.x,
        boxes.throwbox.y,
        boxes.throwbox.w,
        boxes.throwbox.h
      );
      ctx.strokeRect(
        boxes.throwbox.x,
        boxes.throwbox.y,
        boxes.throwbox.w,
        boxes.throwbox.h
      );
    }

    ctx.restore();
  }

  public resolvePalette(
    charDef: CharacterDef,
    useAlt: boolean,
    playerIndex: 0 | 1,
    colorblindMode: boolean
  ): CharacterPalette {
    if (colorblindMode) {
      return playerIndex === 0
        ? {
            primary: '#00aaff',
            secondary: '#0a2246',
            accent: '#ffffff',
            glow: '#00aaff',
            skin: charDef.palette.skin,
            clothDark: '#061326'
          }
        : {
            primary: '#ff9900',
            secondary: '#3b1e06',
            accent: '#ffff00',
            glow: '#ff9900',
            skin: charDef.palette.skin,
            clothDark: '#221004'
          };
    }
    return useAlt ? charDef.altPalette : charDef.palette;
  }

  private resolvePoseType(fighter: FighterState, charDef: CharacterDef): PoseType {
    if (fighter.status === 'attack' && fighter.currentMoveId) {
      const m = charDef.moves[fighter.currentMoveId];
      if (m) return m.pose;
    }
    switch (fighter.status) {
      case 'idle':
        return 'idle';
      case 'walk_f':
        return 'walk_f';
      case 'walk_b':
        return 'walk_b';
      case 'crouch':
        return 'crouch';
      case 'prejump':
        return 'crouch';
      case 'jump':
        return 'jump';
      case 'dash_f':
      case 'air_dash':
        return 'dash_f';
      case 'dash_b':
        return 'dash_b';
      case 'block_stand':
        return 'block_stand';
      case 'block_crouch':
        return 'block_crouch';
      case 'hitstun_stand':
      case 'thrown':
        return 'hit_stand';
      case 'hitstun_crouch':
        return 'hit_crouch';
      case 'hitstun_air':
      case 'knockdown':
      case 'defeat':
        return 'knockdown';
      case 'wakeup':
        return 'crouch';
      case 'dizzy':
        return 'dizzy';
      case 'parry_stance':
      case 'parry_success':
        return 'parry';
      case 'overdrive_burst':
        return 'overdrive';
      case 'victory':
        return 'victory';
      default:
        return 'idle';
    }
  }

  private computeJointPose(pose: PoseType, animT: number, frame: number): JointPose {
    const breath = Math.sin(frame * 0.1) * 3;
    const base: JointPose = {
      hipX: 0,
      hipY: -72 + breath * 0.5,
      torsoTilt: 0.08,
      headX: 6,
      headY: -152 + breath,
      frontHandX: 34,
      frontHandY: -122 + breath,
      backHandX: -18,
      backHandY: -116 + breath,
      frontFootX: 24,
      frontFootY: -4,
      backFootX: -24,
      backFootY: -4,
      weaponAngle: -0.4,
      weaponGlow: false
    };

    switch (pose) {
      case 'walk_f': {
        const stride = Math.sin(frame * 0.25) * 24;
        base.frontFootX = 12 + stride;
        base.backFootX = -12 - stride;
        base.frontFootY = -4 - Math.max(0, Math.cos(frame * 0.25) * 10);
        base.backFootY = -4 - Math.max(0, -Math.cos(frame * 0.25) * 10);
        base.torsoTilt = 0.16;
        break;
      }
      case 'walk_b': {
        const stride = Math.sin(frame * 0.22) * 20;
        base.frontFootX = 12 - stride;
        base.backFootX = -12 + stride;
        base.torsoTilt = -0.05;
        break;
      }
      case 'crouch': {
        base.hipY = -48;
        base.headY = -112 + breath * 0.5;
        base.torsoTilt = 0.22;
        base.frontHandX = 32;
        base.frontHandY = -88;
        base.backHandX = -14;
        base.backHandY = -82;
        base.frontFootX = 28;
        base.backFootX = -22;
        break;
      }
      case 'jump': {
        base.hipY = -82;
        base.headY = -158;
        base.frontFootX = 20;
        base.frontFootY = -32;
        base.backFootX = -18;
        base.backFootY = -42;
        base.frontHandX = 34;
        base.frontHandY = -135;
        break;
      }
      case 'dash_f': {
        base.torsoTilt = 0.42;
        base.headX = 26;
        base.headY = -138;
        base.frontHandX = 44;
        base.frontHandY = -115;
        base.backHandX = -38;
        base.backHandY = -110;
        base.frontFootX = 36;
        base.backFootX = -42;
        break;
      }
      case 'dash_b': {
        base.torsoTilt = -0.25;
        base.headX = -14;
        base.frontFootX = 32;
        base.frontFootY = -18;
        base.backFootX = -28;
        base.backFootY = -12;
        break;
      }
      case 'block_stand': {
        base.torsoTilt = -0.1;
        base.frontHandX = 24;
        base.frontHandY = -142;
        base.backHandX = 14;
        base.backHandY = -132;
        break;
      }
      case 'block_crouch': {
        base.hipY = -46;
        base.headY = -108;
        base.frontHandX = 24;
        base.frontHandY = -102;
        base.backHandX = 14;
        base.backHandY = -92;
        break;
      }
      case 'hit_stand': {
        base.torsoTilt = -0.35;
        base.headX = -18;
        base.headY = -146;
        base.frontHandX = -10;
        base.frontHandY = -135;
        break;
      }
      case 'hit_crouch': {
        base.hipY = -46;
        base.torsoTilt = -0.28;
        base.headX = -14;
        base.headY = -105;
        break;
      }
      case 'knockdown': {
        base.hipX = -10;
        base.hipY = -18;
        base.headX = -56;
        base.headY = -24;
        base.frontHandX = -25;
        base.frontHandY = -12;
        base.backHandX = -45;
        base.backHandY = -28;
        base.frontFootX = 48;
        base.frontFootY = -8;
        base.backFootX = 28;
        base.backFootY = -14;
        break;
      }
      case 'dizzy': {
        const sway = Math.sin(frame * 0.18) * 14;
        base.headX = sway;
        base.torsoTilt = sway * 0.015;
        base.frontHandX = 20 + sway * 0.5;
        base.frontHandY = -98;
        break;
      }
      case 'parry': {
        base.torsoTilt = 0.15;
        base.frontHandX = 52;
        base.frontHandY = -138;
        base.backHandX = -24;
        base.backHandY = -125;
        base.weaponGlow = true;
        break;
      }
      case 'overdrive':
      case 'victory': {
        base.torsoTilt = -0.12;
        base.headY = -158;
        base.frontHandX = 38;
        base.frontHandY = -168;
        base.backHandX = -36;
        base.backHandY = -162;
        base.weaponGlow = true;
        break;
      }
      case 'punch_light': {
        const ext = Math.sin(clamp01(animT) * Math.PI);
        base.torsoTilt = 0.18;
        base.frontHandX = 34 + ext * 54;
        base.frontHandY = -132;
        break;
      }
      case 'punch_heavy':
      case 'baton_thrust':
      case 'blade_slash': {
        const ext = Math.sin(clamp01(animT) * Math.PI);
        base.torsoTilt = 0.28;
        base.headX = 16;
        base.frontHandX = 36 + ext * 76;
        base.frontHandY = -128;
        base.weaponAngle = 0.15;
        base.weaponGlow = true;
        break;
      }
      case 'uppercut': {
        const ext = Math.sin(clamp01(animT) * Math.PI);
        base.torsoTilt = -0.15;
        base.frontHandX = 34 + ext * 28;
        base.frontHandY = -130 - ext * 68;
        base.weaponAngle = -1.2;
        base.weaponGlow = true;
        break;
      }
      case 'kick_low': {
        const ext = Math.sin(clamp01(animT) * Math.PI);
        base.hipY = -54;
        base.headY = -118;
        base.frontFootX = 26 + ext * 64;
        base.frontFootY = -18;
        break;
      }
      case 'kick_high':
      case 'flash_kick': {
        const ext = Math.sin(clamp01(animT) * Math.PI);
        base.torsoTilt = -0.22;
        base.frontFootX = 26 + ext * 72;
        base.frontFootY = -20 - ext * 110;
        base.weaponGlow = pose === 'flash_kick';
        break;
      }
      case 'kick_spin': {
        const spin = Math.cos(frame * 0.55);
        base.hipY = -84;
        base.frontFootX = spin * 74;
        base.frontFootY = -78;
        base.backFootX = -spin * 54;
        base.backFootY = -64;
        base.weaponGlow = true;
        break;
      }
      case 'sweep': {
        const ext = Math.sin(clamp01(animT) * Math.PI);
        base.hipY = -36;
        base.headY = -92;
        base.frontFootX = 30 + ext * 78;
        base.frontFootY = -8;
        break;
      }
      case 'throw_grab':
      case 'command_grab': {
        base.torsoTilt = 0.3;
        base.frontHandX = 68;
        base.frontHandY = -136;
        base.backHandX = 58;
        base.backHandY = -114;
        base.weaponGlow = pose === 'command_grab';
        break;
      }
      case 'lariat':
      case 'shoulder_charge': {
        base.torsoTilt = 0.36;
        base.headX = 24;
        base.frontHandX = 78;
        base.frontHandY = -126;
        base.backHandX = -65;
        base.backHandY = -126;
        base.weaponGlow = true;
        break;
      }
      case 'teleport':
      case 'super_cast': {
        const ext = Math.sin(clamp01(animT) * Math.PI);
        base.torsoTilt = 0.32;
        base.frontHandX = 48 + ext * 68;
        base.frontHandY = -134;
        base.weaponAngle = 0.05;
        base.weaponGlow = true;
        break;
      }
    }

    return base;
  }

  private drawArticulatedCharacter(
    ctx: CanvasRenderingContext2D,
    charId: CharacterId,
    palette: CharacterPalette,
    p: JointPose,
    frame: number,
    fighter: FighterState
  ): void {
    const isMagnus = charId === 'magnus';
    const isSable = charId === 'sable';
    const torsoW = isMagnus ? 48 : isSable ? 28 : 35;
    const limbW = isMagnus ? 18 : isSable ? 11 : 14;

    const shoulderX = p.hipX + Math.sin(p.torsoTilt) * 58;
    const shoulderY = p.hipY - Math.cos(p.torsoTilt) * 58;

    // 1. Flowing Cyber Scarf / Trench Coat / Back Scabbards behind character
    if (charId === 'hayate' || charId === 'sable') {
      ctx.save();
      ctx.strokeStyle = palette.accent;
      ctx.shadowColor = palette.accent;
      ctx.shadowBlur = 14;
      ctx.lineWidth = charId === 'hayate' ? 8 : 5;
      ctx.lineCap = 'round';
      const wave1 = Math.sin(frame * 0.18) * 14;
      const wave2 = Math.cos(frame * 0.15) * 18;
      ctx.beginPath();
      ctx.moveTo(shoulderX - 8, shoulderY + 4);
      ctx.quadraticCurveTo(
        shoulderX - 44,
        shoulderY + 10 + wave1,
        shoulderX - 78,
        shoulderY + 24 + wave2
      );
      ctx.stroke();

      // Secondary lower scarf tail / hologram ribbon
      ctx.lineWidth = charId === 'hayate' ? 4 : 3;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.moveTo(shoulderX - 10, shoulderY + 10);
      ctx.quadraticCurveTo(
        shoulderX - 36,
        shoulderY + 26 - wave1 * 0.7,
        shoulderX - 64,
        shoulderY + 42 - wave2 * 0.7
      );
      ctx.stroke();

      if (charId === 'hayate') {
        // Cyber-scabbard strapped across back
        ctx.globalAlpha = 1;
        ctx.strokeStyle = palette.primary;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(shoulderX - 18, shoulderY - 22);
        ctx.lineTo(p.hipX - 34, p.hipY + 14);
        ctx.stroke();
      }
      ctx.restore();
    } else if (charId === 'warden') {
      // Tactical enforcer coat tail with neon trim
      ctx.save();
      ctx.fillStyle = palette.clothDark;
      ctx.strokeStyle = palette.primary;
      ctx.lineWidth = 2.5;
      const wave = Math.sin(frame * 0.14) * 8;
      ctx.beginPath();
      ctx.moveTo(p.hipX - 16, p.hipY - 4);
      ctx.lineTo(p.hipX - 48 + wave, p.hipY + 54);
      ctx.lineTo(p.hipX - 14 + wave * 0.5, p.hipY + 58);
      ctx.lineTo(p.hipX + 8, p.hipY + 44);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else if (charId === 'magnus') {
      // Twin exhaust vents on Magnus's back
      ctx.save();
      ctx.fillStyle = palette.clothDark;
      ctx.strokeStyle = palette.primary;
      ctx.lineWidth = 2;
      ctx.fillRect(shoulderX - 30, shoulderY - 22, 12, 26);
      ctx.strokeRect(shoulderX - 30, shoulderY - 22, 12, 26);
      ctx.restore();
    }

    // 2. Back Leg & Back Arm (shaded darker for depth separation)
    this.drawLimb(
      ctx,
      p.hipX - 8,
      p.hipY,
      p.backFootX,
      p.backFootY,
      limbW,
      palette.clothDark,
      palette.secondary,
      true
    );
    this.drawLimb(
      ctx,
      shoulderX - 10,
      shoulderY + 6,
      p.backHandX,
      p.backHandY,
      limbW * 0.85,
      palette.clothDark,
      palette.primary,
      false
    );

    // Back-hand weapon / gauntlet for dual-wielders (Sable / Magnus)
    if (charId === 'sable') {
      ctx.save();
      ctx.translate(p.backHandX, p.backHandY);
      ctx.strokeStyle = palette.accent;
      ctx.shadowColor = palette.accent;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-26, 10);
      ctx.stroke();
      ctx.restore();
    } else if (charId === 'magnus') {
      ctx.save();
      ctx.translate(p.backHandX, p.backHandY);
      ctx.fillStyle = palette.secondary;
      ctx.strokeStyle = palette.primary;
      ctx.lineWidth = 2;
      ctx.fillRect(-10, -10, 20, 20);
      ctx.strokeRect(-10, -10, 20, 20);
      ctx.restore();
    }

    // 3. Armored Torso & Pelvis Belt
    ctx.save();
    ctx.fillStyle = palette.secondary;
    ctx.strokeStyle = palette.primary;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = palette.glow;
    ctx.shadowBlur = 12;

    // Upper chest plate
    ctx.beginPath();
    ctx.moveTo(shoulderX - torsoW * 0.68, shoulderY - 2);
    ctx.lineTo(shoulderX + torsoW * 0.68, shoulderY - 2);
    ctx.lineTo(p.hipX + torsoW * 0.46, p.hipY + 4);
    ctx.lineTo(p.hipX - torsoW * 0.46, p.hipY + 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Inner abdominal armor ribs
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.7;
    const midTorsoX = (shoulderX + p.hipX) * 0.5;
    const midTorsoY = (shoulderY + p.hipY) * 0.5;
    ctx.beginPath();
    ctx.moveTo(midTorsoX - torsoW * 0.35, midTorsoY + 4);
    ctx.lineTo(midTorsoX + torsoW * 0.35, midTorsoY + 4);
    ctx.moveTo(midTorsoX - torsoW * 0.28, midTorsoY + 12);
    ctx.lineTo(midTorsoX + torsoW * 0.28, midTorsoY + 12);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Pelvis / Tactical Belt + Buckle
    ctx.fillStyle = palette.clothDark;
    ctx.strokeStyle = palette.primary;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.hipX - torsoW * 0.5, p.hipY - 2);
    ctx.lineTo(p.hipX + torsoW * 0.5, p.hipY - 2);
    ctx.lineTo(p.hipX + torsoW * 0.38, p.hipY + 12);
    ctx.lineTo(p.hipX - torsoW * 0.38, p.hipY + 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Chest Core / Cyber Reactor Detail
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = palette.primary;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(
      midTorsoX + 4,
      midTorsoY - 8,
      isMagnus ? 8 : 5.5,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // 4. Front Leg (with knee pad & cyber boot)
    this.drawLimb(
      ctx,
      p.hipX + 6,
      p.hipY + 2,
      p.frontFootX,
      p.frontFootY,
      limbW,
      palette.secondary,
      palette.primary,
      true
    );

    // 5. Head, Helmet, Shoulder Pauldrons, and Glowing Cyber Visor
    ctx.save();
    const headRadius = isMagnus ? 19 : 16;

    // High tech collar behind head
    ctx.fillStyle = palette.clothDark;
    ctx.strokeStyle = palette.primary;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(shoulderX - 16, shoulderY + 2);
    ctx.lineTo(p.headX - 14, p.headY + 6);
    ctx.lineTo(p.headX + 12, p.headY + 8);
    ctx.lineTo(shoulderX + 14, shoulderY + 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Helmet Dome
    ctx.fillStyle = palette.clothDark;
    ctx.strokeStyle = palette.primary;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(p.headX, p.headY, headRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Faceplate / Jaw guard
    ctx.fillStyle = palette.secondary;
    ctx.beginPath();
    ctx.arc(p.headX + 2, p.headY + 3, headRadius * 0.75, 0, Math.PI);
    ctx.fill();

    // Glowing Visor / Eyes
    ctx.fillStyle = palette.accent;
    ctx.shadowColor = palette.accent;
    ctx.shadowBlur = 14;
    ctx.fillRect(p.headX + 1, p.headY - 5, headRadius * 0.92, 5.5);

    // Character-Specific Headgear & Shoulder Pauldrons
    if (charId === 'hayate') {
      // Cyber-samurai horn crest + shoulder guard
      ctx.fillStyle = palette.primary;
      ctx.beginPath();
      ctx.moveTo(p.headX + 3, p.headY - 12);
      ctx.lineTo(p.headX + 24, p.headY - 26);
      ctx.lineTo(p.headX + 10, p.headY - 7);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = palette.secondary;
      ctx.strokeStyle = palette.primary;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(shoulderX - 6, shoulderY - 8);
      ctx.lineTo(shoulderX + 20, shoulderY - 4);
      ctx.lineTo(shoulderX + 16, shoulderY + 10);
      ctx.lineTo(shoulderX - 6, shoulderY + 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (charId === 'magnus') {
      // Heavy hydraulic shoulder pauldrons with hazard trim
      ctx.fillStyle = palette.primary;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.fillRect(shoulderX - 28, shoulderY - 16, 24, 20);
      ctx.strokeRect(shoulderX - 28, shoulderY - 16, 24, 20);
      ctx.fillRect(shoulderX + 6, shoulderY - 16, 26, 20);
      ctx.strokeRect(shoulderX + 6, shoulderY - 16, 26, 20);
    } else if (charId === 'sable') {
      // Sleek assassin hood crest & swept hair spikes
      ctx.fillStyle = palette.primary;
      ctx.beginPath();
      ctx.moveTo(p.headX - 8, p.headY - 13);
      ctx.lineTo(p.headX - 26, p.headY - 6);
      ctx.lineTo(p.headX - 18, p.headY + 4);
      ctx.closePath();
      ctx.fill();
    } else if (charId === 'warden') {
      // Tactical Aegis helmet crest & shoulder coil
      ctx.fillStyle = palette.accent;
      ctx.beginPath();
      ctx.moveTo(p.headX - 10, p.headY - 15);
      ctx.lineTo(p.headX + 14, p.headY - 19);
      ctx.lineTo(p.headX + 8, p.headY - 11);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = palette.secondary;
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = 2;
      ctx.fillRect(shoulderX + 2, shoulderY - 10, 18, 14);
      ctx.strokeRect(shoulderX + 2, shoulderY - 10, 18, 14);
    }
    ctx.restore();

    // 6. Front Arm & Character Weapon
    this.drawLimb(
      ctx,
      shoulderX + 8,
      shoulderY + 6,
      p.frontHandX,
      p.frontHandY,
      limbW * 0.92,
      palette.secondary,
      palette.primary,
      false
    );

    // Weapon / Gauntlet rendering at front hand
    this.drawCharacterWeapon(ctx, charId, palette, p, fighter);
  }

  private drawLimb(
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    width: number,
    fillColor: string,
    strokeColor: string,
    isLeg = false
  ): void {
    const midX = (x1 + x2) * 0.5 + (isLeg ? 5 : y2 > y1 ? 4 : -3);
    const midY = (y1 + y2) * 0.5;

    ctx.save();
    // Outer neon border stroke
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = width + 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(midX, midY);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Inner armor fill stroke
    ctx.strokeStyle = fillColor;
    ctx.lineWidth = width - 1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(midX, midY);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Center cyber-conduit line
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(midX, midY);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Glowing knee / elbow joint node
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(midX, midY, width * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Cyber boot / gauntlet cuff at extremity
    if (isLeg) {
      ctx.fillStyle = fillColor;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x2 - 8, y2 - 6);
      ctx.lineTo(x2 + 16, y2 - 2);
      ctx.lineTo(x2 + 18, y2 + 4);
      ctx.lineTo(x2 - 10, y2 + 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillStyle = strokeColor;
      ctx.beginPath();
      ctx.arc(x2, y2, width * 0.38, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawCharacterWeapon(
    ctx: CanvasRenderingContext2D,
    charId: CharacterId,
    palette: CharacterPalette,
    p: JointPose,
    fighter: FighterState
  ): void {
    const isAttacking = fighter.status === 'attack' || p.weaponGlow;

    ctx.save();
    ctx.translate(p.frontHandX, p.frontHandY);
    ctx.rotate(p.weaponAngle);

    if (charId === 'hayate') {
      // Plasma Katana (always visible in hand with glowing edge, flares during attacks!)
      const bladeLen = isAttacking ? 68 : 48;
      // Hilt & guard
      ctx.fillStyle = palette.accent;
      ctx.fillRect(-10, -3, 12, 6);
      ctx.fillStyle = palette.primary;
      ctx.fillRect(0, -8, 4, 16);

      // Blade glow & core
      ctx.strokeStyle = palette.primary;
      ctx.shadowColor = palette.primary;
      ctx.shadowBlur = isAttacking ? 20 : 10;
      ctx.lineWidth = isAttacking ? 6 : 4;
      ctx.beginPath();
      ctx.moveTo(2, 0);
      ctx.lineTo(bladeLen, -14);
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(2, 0);
      ctx.lineTo(bladeLen, -14);
      ctx.stroke();
    } else if (charId === 'magnus') {
      // Oversized Hydraulic Piston Gauntlet
      ctx.fillStyle = palette.primary;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.shadowColor = palette.primary;
      ctx.shadowBlur = isAttacking ? 20 : 8;
      ctx.fillRect(-12, -13, 26, 26);
      ctx.strokeRect(-12, -13, 26, 26);
      // Knuckle studs
      ctx.fillStyle = palette.accent;
      ctx.fillRect(10, -10, 5, 6);
      ctx.fillRect(10, 4, 5, 6);
    } else if (charId === 'sable') {
      // Twin Magenta Vibro-Dagger
      const bladeLen = isAttacking ? 44 : 30;
      ctx.strokeStyle = palette.primary;
      ctx.shadowColor = palette.primary;
      ctx.shadowBlur = isAttacking ? 18 : 10;
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(-4, 0);
      ctx.lineTo(bladeLen, -8);
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(bladeLen, -8);
      ctx.stroke();
    } else if (charId === 'warden') {
      // Telescoping Electric Shock-Baton
      const batonLen = isAttacking ? 62 : 38;
      ctx.strokeStyle = palette.accent;
      ctx.shadowColor = palette.primary;
      ctx.shadowBlur = 16;
      ctx.lineWidth = 5.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(batonLen, -6);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(batonLen, -6, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Renders a detailed, multi-layered cyberpunk character portrait for Character Select,
   * Versus Splash, Super Cut-In, and Match HUD.
   */
  public renderCharacterPortrait(
    ctx: CanvasRenderingContext2D,
    charId: CharacterId,
    x: number,
    y: number,
    w: number,
    h: number,
    useAlt = false,
    frame = 0
  ): void {
    const charDef = CHARACTERS[charId];
    const pal = useAlt ? charDef.altPalette : charDef.palette;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    // 1. Deep Cyberpunk Background Gradient + Radial Aura
    const bg = ctx.createLinearGradient(x, y, x + w, y + h);
    bg.addColorStop(0, '#040816');
    bg.addColorStop(0.6, pal.clothDark);
    bg.addColorStop(1, pal.secondary);
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);

    const cx = x + w * 0.5;
    const cy = y + h * 0.58;
    const scale = Math.min(w, h) / 92;

    const aura = ctx.createRadialGradient(cx, cy - 8 * scale, 4, cx, cy - 8 * scale, 46 * scale);
    aura.addColorStop(0, pal.primary + '55');
    aura.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = aura;
    ctx.fillRect(x, y, w, h);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // 2. Character-Specific Weapon / Back Silhouette
    if (charId === 'hayate') {
      // Diagonal Katana Hilt behind right shoulder
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(14, 10);
      ctx.lineTo(36, -34);
      ctx.stroke();
      ctx.strokeStyle = pal.primary;
      ctx.lineWidth = 2;
      ctx.strokeRect(24, -22, 10, 4);
    } else if (charId === 'magnus') {
      // Massive Shoulder Furnace Stacks
      ctx.fillStyle = pal.clothDark;
      ctx.strokeStyle = pal.primary;
      ctx.lineWidth = 2.5;
      ctx.fillRect(-40, -10, 16, 26);
      ctx.strokeRect(-40, -10, 16, 26);
      ctx.fillRect(24, -10, 16, 26);
      ctx.strokeRect(24, -10, 16, 26);
    } else if (charId === 'warden') {
      // Shoulder Rail-Pulse Coils
      ctx.fillStyle = pal.secondary;
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-38, 12);
      ctx.lineTo(-26, -6);
      ctx.lineTo(-18, 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(38, 12);
      ctx.lineTo(26, -6);
      ctx.lineTo(18, 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // 3. Armored Shoulders & High Cyber Collar
    ctx.fillStyle = pal.clothDark;
    ctx.strokeStyle = pal.primary;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-42, 38);
    ctx.lineTo(-28, 6);
    ctx.lineTo(-14, 0);
    ctx.lineTo(14, 0);
    ctx.lineTo(28, 6);
    ctx.lineTo(42, 38);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Chest Reactor / Collar Trim
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-20, 12);
    ctx.lineTo(0, 24);
    ctx.lineTo(20, 12);
    ctx.stroke();

    ctx.fillStyle = pal.primary;
    ctx.beginPath();
    ctx.arc(0, 26, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // 4. Sculpted Head / Helmet / Hood Silhouette
    ctx.fillStyle = pal.secondary;
    ctx.strokeStyle = pal.primary;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-20, -22);
    ctx.lineTo(0, -34);
    ctx.lineTo(20, -22);
    ctx.lineTo(22, -4);
    ctx.lineTo(12, 10);
    ctx.lineTo(-12, 10);
    ctx.lineTo(-22, -4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Lower Oni Mask / Respirator Jawplate
    ctx.fillStyle = pal.clothDark;
    ctx.strokeStyle = pal.primary;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-16, -4);
    ctx.lineTo(0, -1);
    ctx.lineTo(16, -4);
    ctx.lineTo(11, 10);
    ctx.lineTo(0, 13);
    ctx.lineTo(-11, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 5. Character-Specific Visor, Eyes & Crest
    const pulse = 0.85 + Math.sin(frame * 0.1) * 0.15;
    ctx.fillStyle = pal.accent;
    ctx.shadowColor = pal.accent;
    ctx.shadowBlur = 14 * pulse;

    if (charId === 'hayate') {
      // Cyber-Ronin V-Visor + Forehead Horn Crest
      ctx.beginPath();
      ctx.moveTo(-15, -15);
      ctx.lineTo(0, -9);
      ctx.lineTo(15, -15);
      ctx.lineTo(13, -19);
      ctx.lineTo(0, -14);
      ctx.lineTo(-13, -19);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = pal.primary;
      ctx.beginPath();
      ctx.moveTo(-5, -24);
      ctx.lineTo(0, -40);
      ctx.lineTo(5, -24);
      ctx.closePath();
      ctx.fill();
    } else if (charId === 'magnus') {
      // Juggernaut Dual Optic Slits + Glowing Respirator Grill
      ctx.fillRect(-15, -16, 11, 5);
      ctx.fillRect(4, -16, 11, 5);
      ctx.strokeStyle = pal.primary;
      ctx.lineWidth = 2;
      for (let gx = -8; gx <= 8; gx += 4) {
        ctx.beginPath();
        ctx.moveTo(gx, 1);
        ctx.lineTo(gx, 9);
        ctx.stroke();
      }
    } else if (charId === 'sable') {
      // Assassin Hood Cowl + Swept Cyber-Bangs + Twin Angular Eyes
      ctx.beginPath();
      ctx.moveTo(-15, -13);
      ctx.lineTo(-3, -10);
      ctx.lineTo(-5, -17);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(15, -13);
      ctx.lineTo(3, -10);
      ctx.lineTo(5, -17);
      ctx.closePath();
      ctx.fill();

      // Swept neon hair strand
      ctx.strokeStyle = pal.primary;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-8, -28);
      ctx.lineTo(18, -20);
      ctx.stroke();
    } else {
      // Warden Full-Width Tactical Gold HUD Visor + Center Reticle
      ctx.fillRect(-17, -18, 34, 8);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-3, -16, 6, 4);
    }

    ctx.restore();
    ctx.restore();

    // Outer Border Frame
    ctx.save();
    ctx.strokeStyle = pal.primary;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
