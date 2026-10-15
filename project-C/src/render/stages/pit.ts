/**
 * UNDERCITY PIT - an underground cage arena inside an abandoned subway station.
 * Layers: tunnel (trains pass every ~20 s), tiled station wall with arches and graffiti, a floating
 * holographic scoreboard, pillars + platform crowd, scaffold crowd, front crowd, chain-link cage,
 * concrete ring floor, swaying work lights with light cones, sparks and dripping water.
 */
import { H, W } from '../../core/view';
import { rgba } from '../../ui/theme';
import { parallaxZoom, psx, psy, sy, type Camera } from '../camera';
import {
  Crowd, DISPLAY_FONT, JP_FONT, Rng, Ripples, Sparks, TAU, coneSprite, ctx2d, drawBand, drawFloor, drawLayer,
  fadeSprite, flicker, freeCanvas, glowSprite, hasDOM, hazeBand, hologram, layerSpan, makeCanvas, neonText, paintFloor,
  paintLayer, rgbaCached, screenGradient, vgrad, type Floor, type Layer,
} from './common';
import type { Stage, StageInfo, StageLight, StageOptions } from './types';

const AMBER = '#ffb15a';
const CYAN = '#36ecff';
const MAGENTA = '#ff3aa8';
const LIME = '#8dff5a';

interface Lamp { x: number; y: number; p: number; len: number; ph: number; amp: number; cone: number; w: number; h: number; broken: boolean }
interface Drip { x: number; p: number; y: number; v: number; wait: number; period: number }
interface Reflect { x: number; p: number; img: string; w: number; a: number; ph: number }

export class PitStage implements Stage {
  readonly info: StageInfo = {
    id: 'pit',
    name: 'UNDERCITY PIT',
    location: 'Old Line 7 Station, B4 Level',
    description: 'The trains still run past the sealed platforms. Down here the crowd pays in cash, the cage has no door, and the only rule is to keep standing.',
    music: 'stage_pit',
    ambience: 'crowd',
    accent: AMBER,
    accent2: MAGENTA,
  };
  readonly light: StageLight = { rim: '#ffbf80', ambient: '#24161c', reflection: 0.18, shadow: '#040306' };

  private ready = false;
  private layers: Layer[] = [];
  private tunnelL!: Layer;
  private wallL!: Layer;
  private pillarL!: Layer;
  private scaffoldL!: Layer;
  private cageL!: Layer;
  private floor!: Floor;
  private crowd!: Crowd;
  private sparks!: Sparks;
  private ripples!: Ripples;
  private sprites: Record<string, HTMLCanvasElement> = {};
  private lamps: Lamp[] = [];
  private ringLamps: Lamp[] = [];
  private drips: Drip[] = [];
  private reflects: Reflect[] = [];
  private rng = new Rng(616);
  private trainX = -99999;
  private trainNext = 6;
  private trainDir = 1;
  private hype = 0;
  private flash = 0;
  private sparkTimer = 3;

  constructor(private opts: StageOptions) {}

  init(pixelRatio: number, quality: number): void {
    if (!hasDOM || this.ready) return;
    const rFar = Math.min(pixelRatio, 1) * (quality === 0 ? 0.7 : 0.9);
    const rMid = Math.min(pixelRatio, 1.25) * (quality === 0 ? 0.75 : 1);
    const rNear = Math.min(pixelRatio, 1.5) * (quality === 0 ? 0.75 : 1);
    const rng = new Rng(3131);

    // ---------------- tunnel interior
    {
      const [x0, x1] = layerSpan(0.06);
      this.tunnelL = paintLayer(0.06, x0, x1, 100, 520, rFar * 0.7, (g, Y) => {
        g.fillStyle = vgrad(g, Y(520), Y(100), [[0, '#030308'], [0.5, '#07070f'], [1, '#0c0a10']]);
        g.fillRect(x0, Y(520), x1 - x0, 420);
        // tunnel ribs and dim service lights
        for (let x = x0; x < x1; x += 70) {
          g.fillStyle = 'rgba(40,40,60,0.35)';
          g.fillRect(x, Y(470), 6, 340);
          g.fillStyle = 'rgba(120,255,140,0.35)';
          g.fillRect(x + 20, Y(360), 4, 4);
        }
        // rails
        g.fillStyle = 'rgba(140,140,170,0.35)';
        g.fillRect(x0, Y(160), x1 - x0, 2);
        g.fillRect(x0, Y(150), x1 - x0, 2);
      });
    }

    // ---------------- station wall with arches (arches cut out to reveal the tunnel)
    {
      const [x0, x1] = layerSpan(0.1);
      this.wallL = paintLayer(0.1, x0, x1, 110, 780, rFar, (g, Y) => {
        g.fillStyle = vgrad(g, Y(780), Y(110), [[0, '#07070c'], [0.4, '#121219'], [1, '#18161c']]);
        g.fillRect(x0, Y(780), x1 - x0, 670);
        // tiles
        const tr = new Rng(5);
        for (let yy = 110; yy < 620; yy += 16) {
          for (let x = x0 + ((yy / 16) % 2) * 12; x < x1; x += 24) {
            const v = tr.next();
            g.fillStyle = v < 0.1 ? 'rgba(0,0,0,0.35)' : v > 0.85 ? 'rgba(200,210,230,0.07)' : 'rgba(150,160,190,0.04)';
            g.fillRect(x + 1, Y(yy + 15), 22, 14);
          }
        }
        // grime streaks
        for (let i = 0; i < 90; i++) {
          const x = tr.range(x0, x1), h = tr.range(40, 260);
          g.fillStyle = vgrad(g, Y(620), Y(620 - h), [[0, 'rgba(0,0,0,0.4)'], [1, 'rgba(0,0,0,0)']]);
          g.fillRect(x, Y(620), tr.range(3, 14), h);
        }
        // band with station name
        g.fillStyle = '#1d1a22';
        g.fillRect(x0, Y(560), x1 - x0, 46);
        g.fillStyle = 'rgba(255,190,90,0.18)';
        g.fillRect(x0, Y(560), x1 - x0, 2);
        g.fillRect(x0, Y(516), x1 - x0, 2);
        g.font = `700 26px ${JP_FONT}`;
        g.fillStyle = 'rgba(225,225,235,0.55)';
        for (const cx of [-700, 200]) {
          g.fillText('旧 第七地下駅', cx, Y(528));
          g.font = `600 14px ${DISPLAY_FONT}`;
          g.fillText('OLD LINE 7  ·  SEALED 2061', cx + 190, Y(530));
          g.font = `700 26px ${JP_FONT}`;
        }
        // ceiling beams
        g.fillStyle = '#050508';
        g.fillRect(x0, Y(780), x1 - x0, 110);
        for (let x = x0; x < x1; x += 160) g.fillRect(x, Y(780), 22, 170);
        // graffiti tags (original abstract tags)
        const tag = (x: number, y: number, col: string, word: string, size: number, rot: number) => {
          g.save();
          g.translate(x, Y(y));
          g.rotate(rot);
          g.font = `900 italic ${size}px ${DISPLAY_FONT}`;
          g.shadowColor = col; g.shadowBlur = 6;
          g.lineWidth = size * 0.07;
          g.strokeStyle = rgba(col, 0.3);
          g.strokeText(word, 0, 0);
          g.fillStyle = rgba(col, 0.1);
          g.fillText(word, 0, 0);
          g.restore();
        };
        tag(-960, 340, MAGENTA, 'RIOTKIDS', 54, -0.08);
        tag(-170, 250, LIME, 'NO GODS', 34, 0.05);
        tag(720, 360, CYAN, 'ZER0', 64, -0.1);
        tag(330, 260, AMBER, 'B4 LIVES', 34, 0.03);
        // pipes
        g.fillStyle = '#0c0b12';
        g.fillRect(x0, Y(640), x1 - x0, 10);
        g.fillRect(x0, Y(660), x1 - x0, 6);
        // arch openings into the tunnel
        g.globalCompositeOperation = 'destination-out';
        for (const ax of [-430, 430]) {
          g.beginPath();
          g.moveTo(ax - 190, Y(110));
          g.lineTo(ax - 190, Y(330));
          g.ellipse(ax, Y(330), 190, 110, 0, Math.PI, 0);
          g.lineTo(ax + 190, Y(110));
          g.closePath();
          g.fill();
        }
        g.globalCompositeOperation = 'source-over';
        // arch trims
        g.strokeStyle = 'rgba(200,190,170,0.18)';
        g.lineWidth = 6;
        for (const ax of [-430, 430]) {
          g.beginPath();
          g.moveTo(ax - 193, Y(110)); g.lineTo(ax - 193, Y(330));
          g.ellipse(ax, Y(330), 193, 113, 0, Math.PI, 0);
          g.lineTo(ax + 193, Y(110));
          g.stroke();
        }
        hazeBand(g, x0, x1, Y(300), Y(110), '#1a1014', 0.5);
      });
    }

    // ---------------- pillars + platform (crowd row 0 stands here)
    {
      const [x0, x1] = layerSpan(0.36);
      this.pillarL = paintLayer(0.36, x0, x1, 60, 820, rMid, (g, Y) => {
        // platform edge
        g.fillStyle = vgrad(g, Y(150), Y(60), [[0, '#1c1a20'], [1, '#0b0a0e']]);
        g.fillRect(x0, Y(150), x1 - x0, 90);
        g.fillStyle = 'rgba(255,200,70,0.35)';
        for (let x = x0; x < x1; x += 30) g.fillRect(x, Y(150), 16, 5);
        // pillars
        for (const px of [-1100, -620, 620, 1100]) {
          g.fillStyle = vgrad(g, Y(820), Y(60), [[0, '#0a090e'], [0.5, '#17151c'], [1, '#0c0b10']]);
          g.fillRect(px - 44, Y(820), 88, 760);
          g.fillStyle = 'rgba(255,255,255,0.05)';
          g.fillRect(px - 44, Y(820), 6, 760);
          g.fillStyle = 'rgba(0,0,0,0.4)';
          g.fillRect(px + 30, Y(820), 14, 760);
          // torn posters
          const pr = new Rng(Math.floor(px + 2000));
          for (let k = 0; k < 3; k++) {
            const py = pr.range(220, 420);
            g.fillStyle = pr.pick(['rgba(255,60,120,0.25)', 'rgba(60,220,255,0.2)', 'rgba(255,200,80,0.2)']);
            g.fillRect(px - 34 + pr.range(-4, 4), Y(py + 70), 60, 70);
            g.fillStyle = 'rgba(0,0,0,0.45)';
            g.fillRect(px - 30, Y(py + 50), 50, 4);
            g.fillRect(px - 30, Y(py + 36), 36, 3);
          }
          // number plate
          g.fillStyle = 'rgba(230,230,240,0.5)';
          g.font = `800 20px ${DISPLAY_FONT}`;
          g.fillText(String(7), px - 6, Y(480));
        }
        // hanging cables
        g.strokeStyle = 'rgba(5,5,8,0.95)';
        g.lineWidth = 2.5;
        for (let k = 0; k < 10; k++) {
          const a = rng.range(x0, x1 - 300), b = a + rng.range(200, 600), yy = rng.range(700, 800);
          g.beginPath(); g.moveTo(a, Y(yy)); g.quadraticCurveTo((a + b) / 2, Y(yy - rng.range(60, 140)), b, Y(yy)); g.stroke();
        }
      });
    }

    // ---------------- scaffold bleachers (crowd row 1)
    {
      const [x0, x1] = layerSpan(0.5);
      this.scaffoldL = paintLayer(0.5, x0, x1, 40, 320, rMid, (g, Y) => {
        const top = 150;
        g.strokeStyle = '#0d0c12';
        g.lineWidth = 5;
        // deck
        g.fillStyle = '#15131a';
        g.fillRect(x0, Y(top), x1 - x0, 10);
        // scaffold frame
        g.beginPath();
        for (let x = Math.ceil(x0 / 120) * 120; x < x1; x += 120) {
          g.moveTo(x, Y(top)); g.lineTo(x, Y(40));
          g.moveTo(x, Y(top)); g.lineTo(x + 120, Y(40));
        }
        g.stroke();
        // railing in front of the standing crowd
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(x0, Y(top + 50)); g.lineTo(x1, Y(top + 50));
        for (let x = Math.ceil(x0 / 60) * 60; x < x1; x += 60) { g.moveTo(x, Y(top + 50)); g.lineTo(x, Y(top)); }
        g.strokeStyle = '#100f16';
        g.stroke();
        g.fillStyle = 'rgba(255,58,168,0.4)';
        g.fillRect(x0, Y(top + 51), x1 - x0, 1.5);
      });
    }

    // ---------------- chain-link cage behind the ring
    {
      const [x0, x1] = layerSpan(0.84);
      this.cageL = paintLayer(0.84, x0, x1, 40, 380, rNear, (g, Y) => {
        const base = 70, top = 330;
        // mesh
        g.strokeStyle = 'rgba(160,170,200,0.12)';
        g.lineWidth = 1;
        g.beginPath();
        const step = 16;
        for (let x = x0 - (top - base); x < x1; x += step) {
          g.moveTo(x, Y(base)); g.lineTo(x + (top - base), Y(top));
          g.moveTo(x + (top - base), Y(base)); g.lineTo(x, Y(top));
        }
        g.stroke();
        // posts + rails
        g.fillStyle = '#0b0b10';
        for (let x = Math.ceil(x0 / 260) * 260; x < x1; x += 260) {
          g.fillRect(x - 5, Y(top + 10), 10, top + 10 - base + 20);
          g.fillStyle = 'rgba(255,190,110,0.18)';
          g.fillRect(x - 5, Y(top + 10), 2, top + 10 - base + 20);
          g.fillStyle = '#0b0b10';
        }
        g.fillRect(x0, Y(top), x1 - x0, 6);
        g.fillRect(x0, Y(base + 120), x1 - x0, 4);
        // barbed wire coil on top
        g.strokeStyle = 'rgba(150,150,170,0.4)';
        g.lineWidth = 1.2;
        g.beginPath();
        for (let x = x0; x < x1; x += 22) g.ellipse(x, Y(top + 18), 13, 11, 0, 0, TAU);
        g.stroke();
        // torn section
        g.globalCompositeOperation = 'destination-out';
        g.beginPath(); g.moveTo(-420, Y(base + 40)); g.lineTo(-380, Y(base + 150)); g.lineTo(-330, Y(base + 60)); g.closePath(); g.fill();
        g.globalCompositeOperation = 'source-over';
        // caution tape
        g.save();
        g.translate(560, Y(base + 150));
        g.rotate(-0.06);
        g.fillStyle = 'rgba(255,205,60,0.75)';
        g.fillRect(0, 0, 300, 14);
        g.fillStyle = 'rgba(10,10,10,0.9)';
        g.font = `800 11px ${DISPLAY_FONT}`;
        g.fillText('KEEP OUT  ·  立入禁止  ·  KEEP OUT', 6, 11);
        g.restore();
      });
    }

    // ---------------- sprites
    const S = this.sprites;
    S.board = hologram(440, 200, rMid, CYAN, (g) => {
      g.fillStyle = 'rgba(10,40,70,0.45)';
      g.fillRect(0, 0, 440, 200);
      g.shadowColor = CYAN; g.shadowBlur = 14;
      g.strokeStyle = rgba(CYAN, 0.9); g.lineWidth = 2;
      g.strokeRect(2, 2, 436, 196);
      g.shadowBlur = 0;
      g.strokeStyle = rgba(CYAN, 0.4);
      g.beginPath(); g.moveTo(10, 56); g.lineTo(430, 56); g.moveTo(10, 150); g.lineTo(430, 150); g.stroke();
      const title = neonText('UNDERCITY PIT', 34, '#9ff6ff', { font: DISPLAY_FONT, weight: '800', ratio: 1, glow: 10, spacing: 4 });
      g.drawImage(title, 220 - title.width / 2, 30 - title.height / 2);
      g.font = `700 15px ${DISPLAY_FONT}`;
      g.fillStyle = rgba('#ff8ad0', 0.95);
      g.fillText('TONIGHT  //  NEON TEMPEST  //  NO ROUND LIMIT', 38, 80);
      // odds bars
      g.fillStyle = rgba(CYAN, 0.7); g.fillRect(30, 96, 220, 16);
      g.fillStyle = rgba(MAGENTA, 0.7); g.fillRect(250, 96, 160, 16);
      g.font = `700 13px ${DISPLAY_FONT}`;
      g.fillStyle = '#e8fbff';
      g.fillText('RED CORNER  3.2', 34, 132);
      g.fillText('BLUE CORNER  1.8', 300, 132);
      g.font = `700 13px ${JP_FONT}`;
      g.fillStyle = rgba('#9ff6ff', 0.8);
      g.fillText('賭けは締め切り', 300, 188);
    });
    S.ticker = neonText('◆ BETS CLOSED ◆ NO RULES ◆ LAST ONE STANDING ◆ 地下七番線 ◆ KEEP THE CAGE SHUT ◆ ', 14, AMBER, { font: DISPLAY_FONT, ratio: rMid, glow: 5 });
    S.scanBar = fadeSprite('#c8fbff', 0, 0.5, 64, true);
    S.cone = coneSprite('#ffd9a0', 260, 520, 0.3);
    S.coneSmall = coneSprite('#ffd9a0', 160, 300, 0.26);
    S.glowAmber = glowSprite(AMBER, 64);
    S.glowWhite = glowSprite('#fff3dc', 64);
    S.glowCyan = glowSprite(CYAN, 64);
    S.pool = (() => {
      const c = makeCanvas(256, 64);
      const g = ctx2d(c);
      const gr = g.createRadialGradient(128, 32, 0, 128, 32, 128);
      gr.addColorStop(0, 'rgba(255,214,160,0.35)');
      gr.addColorStop(1, 'rgba(255,214,160,0)');
      g.save(); g.scale(1, 0.25); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); g.restore();
      return c;
    })();
    S.lamp = (() => {
      const c = makeCanvas(60, 40);
      const g = ctx2d(c);
      g.fillStyle = '#1c1b22';
      g.beginPath(); g.moveTo(10, 30); g.lineTo(20, 6); g.lineTo(40, 6); g.lineTo(50, 30); g.closePath(); g.fill();
      g.fillStyle = '#fff1d0'; g.shadowColor = '#ffd9a0'; g.shadowBlur = 10;
      g.beginPath(); g.ellipse(30, 30, 18, 5, 0, 0, TAU); g.fill();
      return c;
    })();
    S.train = (() => {
      const len = 1500;
      const c = makeCanvas(len * rFar, 140 * rFar);
      const g = ctx2d(c);
      g.scale(rFar, rFar);
      g.fillStyle = '#1a1c26';
      g.fillRect(0, 20, len, 110);
      g.fillStyle = '#0c0d14';
      for (let x = 0; x < len; x += 300) g.fillRect(x, 20, 6, 110);
      for (let x = 20; x < len - 40; x += 46) {
        g.fillStyle = 'rgba(255,240,200,0.85)';
        g.fillRect(x, 44, 32, 30);
        g.fillStyle = 'rgba(30,30,40,0.5)';
        g.fillRect(x + 4, 56, 10, 18);
      }
      g.fillStyle = 'rgba(255,58,90,0.9)';
      g.fillRect(0, 96, len, 6);
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.shadowColor = '#fff'; g.shadowBlur = 16;
      g.fillRect(len - 14, 80, 10, 8);
      return c;
    })();
    S.archGlow = glowSprite('#fff0d8', 128);
    S.reflAmber = fadeSprite(AMBER, 0.45, 0, 128);
    S.reflCyan = fadeSprite(CYAN, 0.4, 0, 128);
    S.reflMag = fadeSprite(MAGENTA, 0.4, 0, 128);
    S.haze = screenGradient([[0, 'rgba(40,24,20,0)'], [1, 'rgba(40,24,20,0.45)']]);
    S.vignette = screenGradient([[0, 'rgba(3,2,4,0.7)'], [0.25, 'rgba(3,2,4,0)'], [0.8, 'rgba(3,2,4,0)'], [1, 'rgba(3,2,4,0.55)']]);
    this.reflects.push({ x: 0, p: 0.18, img: 'reflCyan', w: 360, a: 0.25, ph: 0 });
    this.reflects.push({ x: -960, p: 0.1, img: 'reflMag', w: 120, a: 0.2, ph: 1 });
    this.reflects.push({ x: 760, p: 0.1, img: 'reflCyan', w: 120, a: 0.2, ph: 2 });

    // ---------------- lamps
    for (let k = 0; k < 7; k++) {
      this.lamps.push({ x: -1050 + k * 350 + this.rng.range(-40, 40), y: 820, p: 0.42, len: this.rng.range(90, 170), ph: this.rng.next() * TAU,
        amp: this.rng.range(0.04, 0.09), cone: 1, w: 46, h: 30, broken: k === 5 });
    }
    for (const x of [-300, 300]) {
      this.ringLamps.push({ x, y: 790, p: 0.98, len: 70, ph: x * 0.01, amp: 0.035, cone: 1, w: 70, h: 46, broken: false });
    }
    for (let k = 0; k < 6; k++) {
      this.drips.push({ x: this.rng.range(-900, 900), p: this.rng.range(0.5, 0.95), y: 760, v: 0, wait: this.rng.range(0, 3), period: this.rng.range(1.6, 4) });
    }

    // ---------------- floor
    const puddles: { x: number; v: number; rx: number; rv: number }[] = [];
    this.floor = paintFloor(-1500, 1500, 70, 112, Math.min(pixelRatio, 1.25) * (quality === 0 ? 0.75 : 1), 0.32, (g, F) => {
      const D = F.back + F.front;
      g.fillStyle = vgrad(g, 0, D, [[0, '#1b1818'], [0.4, '#141214'], [1, '#0a090b']]);
      g.fillRect(-1500, 0, 3000, D);
      const nr = new Rng(77);
      // stains and cracks
      for (let i = 0; i < 160; i++) {
        const x = nr.range(-1500, 1500), v = nr.range(0, D), r = nr.range(10, 70);
        const gr = g.createRadialGradient(x, v, 0, x, v, r);
        gr.addColorStop(0, nr.chance(0.85) ? 'rgba(0,0,0,0.3)' : 'rgba(120,40,30,0.18)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr;
        g.save(); g.translate(x, v); g.scale(1, 0.3); g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill(); g.restore();
      }
      g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1;
      for (let i = 0; i < 40; i++) {
        let x = nr.range(-1500, 1500), v = nr.range(0, D);
        g.beginPath(); g.moveTo(x, v);
        for (let k = 0; k < 5; k++) { x += nr.range(-30, 30); v += nr.range(-4, 6); g.lineTo(x, v); }
        g.stroke();
      }
      // painted ring: faded red circle and center line
      const cy = F.back + 10;
      g.strokeStyle = 'rgba(220,50,50,0.28)'; g.lineWidth = 9;
      g.beginPath(); g.ellipse(0, cy, 620, 60, 0, 0, TAU); g.stroke();
      g.strokeStyle = 'rgba(240,240,240,0.12)'; g.lineWidth = 3;
      g.beginPath(); g.ellipse(0, cy, 660, 66, 0, 0, TAU); g.stroke();
      g.fillStyle = 'rgba(240,240,240,0.10)';
      g.fillRect(-4, cy - 50, 8, 100);
      g.fillStyle = 'rgba(220,50,50,0.22)';
      g.font = `900 34px ${DISPLAY_FONT}`;
      g.save(); g.translate(-430, cy + 44); g.scale(1, 0.45); g.fillText('PIT', 0, 0); g.restore();
      g.save(); g.translate(360, cy + 44); g.scale(1, 0.45); g.fillText('B4', 0, 0); g.restore();
      // drain grate
      g.fillStyle = '#060506'; g.fillRect(560, F.back + 50, 90, 14);
      g.fillStyle = 'rgba(150,150,160,0.2)'; for (let x = 562; x < 650; x += 8) g.fillRect(x, F.back + 52, 4, 10);
      // puddles
      const pr = new Rng(13);
      for (let i = 0; i < 16; i++) {
        const x = pr.range(-1400, 1400), v = pr.range(16, D - 8), rx = pr.range(40, 130), rv = rx * 0.11 * (0.7 + v / D);
        const gr = g.createRadialGradient(x, v, 0, x, v, rx);
        gr.addColorStop(0, rgba(pr.pick([AMBER, CYAN, MAGENTA]), 0.14));
        gr.addColorStop(0.75, 'rgba(4,3,5,0.45)');
        gr.addColorStop(1, 'rgba(4,3,5,0)');
        g.fillStyle = gr;
        g.save(); g.translate(x, v); g.scale(1, rv / rx); g.translate(-x, -v);
        g.beginPath(); g.arc(x, v, rx, 0, TAU); g.fill();
        g.restore();
        puddles.push({ x, v, rx, rv });
      }
    });

    // ---------------- crowd
    this.crowd = new Crowd([
      { p: 0.36, base: 152, x0: -1200, x1: 1200, spacing: 44, scale: 0.58, body: '#0b090c', rim: '#ffb070', gaps: [[-1150, -1050], [-670, -570], [570, 670], [1050, 1150]] },
      { p: 0.5, base: 196, x0: -1300, x1: 1300, spacing: 48, scale: 0.7, body: '#09070a', rim: '#ff5ab8', phone: 0.25 },
      { p: 0.66, base: 100, x0: -1350, x1: 1350, spacing: 54, scale: 0.86, body: '#070608', rim: '#ffc08a', phone: 0.3 },
    ], 2024, Math.min(pixelRatio, 1.25));
    this.sparks = new Sparks(80, 9);
    this.ripples = new Ripples(30, 4, puddles);
    this.layers = [this.tunnelL, this.wallL, this.pillarL, this.scaffoldL, this.cageL];
    this.ready = true;
  }

  update(t: number, cam: Camera): void {
    if (!this.ready) return;
    const dt = 1 / 60;
    this.crowd.update(dt);
    this.sparks.update();
    this.ripples.update(0.08);
    // train
    this.trainNext -= dt;
    if (this.trainNext <= 0 && this.trainX < -9999) {
      this.trainDir = this.rng.chance(0.5) ? 1 : -1;
      this.trainX = this.trainDir > 0 ? -2600 : 2600;
      this.trainNext = this.rng.range(18, 24);
    }
    if (this.trainX > -9999) {
      this.trainX += 34 * this.trainDir;
      if (Math.abs(this.trainX) > 2700) this.trainX = -99999;
    }
    // broken lamp sparks
    this.sparkTimer -= dt;
    if (this.sparkTimer <= 0) {
      this.sparkTimer = this.rng.range(2.5, 6);
      const l = this.lamps.find((x) => x.broken);
      if (l) this.sparks.burst(l.x, l.y - l.len, 14, 1);
    }
    // drips
    for (const d of this.drips) {
      if (d.wait > 0) { d.wait -= dt; continue; }
      d.v += 0.5;
      d.y -= d.v;
      if (d.y <= 0) {
        d.y = 760; d.v = 0; d.wait = d.period;
      }
    }
    if (this.hype > 0) this.hype = Math.max(0, this.hype - dt);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3);
    void t; void cam;
  }

  drawBack(ctx: CanvasRenderingContext2D, cam: Camera, t: number): void {
    if (!this.ready) { ctx.fillStyle = '#040306'; ctx.fillRect(0, 0, W, H); return; }
    const S = this.sprites;
    ctx.fillStyle = '#030305';
    ctx.fillRect(0, 0, W, H);
    drawLayer(ctx, this.tunnelL, cam);
    // train in the tunnel
    if (this.trainX > -9999) {
      const p = 0.07;
      const zp = parallaxZoom(cam, p);
      const len = 1500;
      const X = psx(cam, this.trainX - len / 2, p);
      const Yv = psy(cam, 405, p);
      ctx.drawImage(S.train, X, Yv, len * zp, 140 * zp);
    }
    drawLayer(ctx, this.wallL, cam);
    // arches light up while the train passes
    if (this.trainX > -9999) {
      ctx.globalCompositeOperation = 'lighter';
      for (const ax of [-430, 430]) {
        const d = Math.abs(this.trainX - ax);
        if (d > 900) continue;
        const a = (1 - d / 900) * 0.45;
        const zp = parallaxZoom(cam, 0.1);
        ctx.globalAlpha = a;
        ctx.drawImage(S.archGlow, psx(cam, ax, 0.1) - 260 * zp, psy(cam, 360, 0.1) - 200 * zp, 520 * zp, 400 * zp);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    this.drawBoard(ctx, cam, t);
    drawLayer(ctx, this.pillarL, cam);
    this.crowd.drawRow(ctx, cam, 0);
    this.drawLamps(ctx, cam, this.lamps, t, S.coneSmall);
    this.sparks.draw(ctx, cam, 0.42, '#ffd27a');
    drawLayer(ctx, this.scaffoldL, cam);
    this.crowd.drawRow(ctx, cam, 1);
    this.crowd.drawRow(ctx, cam, 2);
    drawBand(ctx, S.haze, psy(cam, 260, 0.6), psy(cam, 60, 0.6), 1);
    drawLayer(ctx, this.cageL, cam);
    drawFloor(ctx, this.floor, cam);
    this.drawReflections(ctx, cam, t);
    // light pools from the ring lamps
    ctx.globalCompositeOperation = 'lighter';
    for (const l of this.ringLamps) {
      const ang = Math.sin(t * 0.9 + l.ph) * l.amp;
      const X = psx(cam, l.x + Math.sin(ang) * 420, 1), Yv = sy(cam, 0);
      const w = 520 * cam.zoom;
      ctx.globalAlpha = 0.8;
      ctx.drawImage(S.pool, X - w / 2, Yv - w * 0.12, w, w * 0.25);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    this.ripples.draw(ctx, cam, this.floor, '#d8c8b8');
    this.drawDrips(ctx, cam);
    // ring lamp cones behind fighters
    this.drawLamps(ctx, cam, this.ringLamps, t, S.cone);
  }

  drawFront(ctx: CanvasRenderingContext2D, cam: Camera, t: number): void {
    if (!this.ready) return;
    drawBand(ctx, this.sprites.vignette, 0, H, 1);
    if (this.flash > 0 && !this.opts.flashReduction) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = rgbaCached('#ffe0b0', this.flash * 0.12);
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
    void t; void cam;
  }

  private drawBoard(ctx: CanvasRenderingContext2D, cam: Camera, t: number): void {
    const S = this.sprites;
    const p = 0.18;
    const zp = parallaxZoom(cam, p);
    const w = 440 * zp, h = 200 * zp, pad = 24 * zp;
    const X = psx(cam, 0, p) - w / 2, Yv = psy(cam, 612, p);
    const fl = flicker(t, 4.4, 0.6);
    ctx.globalCompositeOperation = 'lighter';
    // kept fairly subtle: it sits right behind the match timer
    ctx.globalAlpha = 0.16 * fl + this.hype * 0.2;
    ctx.drawImage(S.glowCyan, X - w * 0.2, Yv - h * 0.4, w * 1.4, h * 1.8);
    ctx.globalAlpha = 0.55 * fl;
    ctx.drawImage(S.board, X - pad, Yv - pad, w + pad * 2, h + pad * 2);
    // ticker inside the bottom band
    const tk = S.ticker;
    const th = 22 * zp;
    const tw = (tk.width / tk.height) * th;
    const off = (t * 60 * zp) % tw;
    ctx.save();
    ctx.beginPath();
    ctx.rect(X + 6 * zp, Yv + 152 * zp, w - 12 * zp, 26 * zp);
    ctx.clip();
    ctx.drawImage(tk, X - off, Yv + 154 * zp, tw, th);
    ctx.drawImage(tk, X - off + tw, Yv + 154 * zp, tw, th);
    ctx.restore();
    // scan bar
    ctx.globalAlpha = 0.22 * fl;
    ctx.drawImage(S.scanBar, X, Yv + ((t * 45) % (h + 20)) - 10, w, 12 * zp);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawLamps(ctx: CanvasRenderingContext2D, cam: Camera, list: Lamp[], t: number, cone: HTMLCanvasElement): void {
    const S = this.sprites;
    // cables
    ctx.beginPath();
    for (const l of list) {
      const zp = parallaxZoom(cam, l.p);
      const ang = Math.sin(t * 0.9 + l.ph) * l.amp;
      const ax = psx(cam, l.x, l.p), ay = psy(cam, l.y, l.p);
      ctx.moveTo(ax, ay - 200);
      ctx.lineTo(ax + Math.sin(ang) * l.len * zp, ay + Math.cos(ang) * l.len * zp);
    }
    ctx.strokeStyle = '#050507';
    ctx.lineWidth = 2;
    ctx.stroke();
    for (const l of list) {
      const zp = parallaxZoom(cam, l.p);
      const ang = Math.sin(t * 0.9 + l.ph) * l.amp;
      const ax = psx(cam, l.x, l.p), ay = psy(cam, l.y, l.p);
      const lx = ax + Math.sin(ang) * l.len * zp, ly = ay + Math.cos(ang) * l.len * zp;
      let on = 1;
      if (l.broken) {
        const f = Math.sin(t * 23) * Math.sin(t * 7.7 + 1);
        on = f > 0.2 ? 1 : 0.15;
      }
      const w = l.w * zp, h = l.h * zp;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.55 * on;
      ctx.translate(lx, ly);
      ctx.rotate(-ang);
      ctx.drawImage(cone, -cone.width * zp * 0.5 * (l.w / 46), h * 0.5, cone.width * zp * (l.w / 46), cone.height * zp * (l.w / 46));
      ctx.rotate(ang);
      ctx.translate(-lx, -ly);
      ctx.globalAlpha = 0.6 * on;
      ctx.drawImage(S.glowWhite, lx - w, ly - w * 0.4, w * 2, w * 2);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.translate(lx, ly);
      ctx.rotate(-ang);
      ctx.drawImage(S.lamp, -w / 2, -h * 0.4, w, h);
      ctx.rotate(ang);
      ctx.translate(-lx, -ly);
    }
  }

  private drawDrips(ctx: CanvasRenderingContext2D, cam: Camera): void {
    ctx.beginPath();
    for (const d of this.drips) {
      if (d.wait > 0) continue;
      const X = psx(cam, d.x, d.p), Yv = psy(cam, d.y, d.p);
      ctx.moveTo(X, Yv);
      ctx.lineTo(X, Yv - 6 - d.v * 0.6);
    }
    ctx.strokeStyle = rgbaCached('#cfe0ff', 0.55);
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  private drawReflections(ctx: CanvasRenderingContext2D, cam: Camera, t: number): void {
    const S = this.sprites;
    const top = sy(cam, 0) - this.floor.back * cam.zoom;
    const h = (this.floor.back + this.floor.front) * cam.zoom;
    ctx.globalCompositeOperation = 'lighter';
    for (const r of this.reflects) {
      const X = psx(cam, r.x, r.p);
      const w = r.w * parallaxZoom(cam, r.p);
      if (X + w < 0 || X - w > W) continue;
      ctx.globalAlpha = r.a * (0.8 + 0.2 * Math.sin(t * 1.7 + r.ph)) * (1 + this.hype * 0.4);
      ctx.drawImage(S[r.img], X - w / 2, top, w, h);
    }
    // ring lamps reflect too
    for (const l of this.ringLamps) {
      const X = psx(cam, l.x, 1);
      const w = 120 * cam.zoom;
      ctx.globalAlpha = 0.3;
      ctx.drawImage(S.reflAmber, X - w / 2, top, w, h);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  onEvent(kind: string, intensity: number): void {
    if (kind === 'hit_heavy') this.crowd.cheer(0.3 * intensity);
    else if (kind === 'super') { this.crowd.cheer(0.7 * intensity); this.hype = 1; this.flash = 0.6; }
    else if (kind === 'ko' || kind === 'perfect') {
      this.crowd.cheer(1.4); this.hype = 1.5; this.flash = 1;
      const l = this.lamps[this.rng.int(this.lamps.length)];
      this.sparks.burst(l.x, l.y - l.len, 18, 1.2);
    } else if (kind === 'round_start') this.crowd.cheer(0.5);
  }

  dispose(): void {
    for (const L of this.layers) freeCanvas(L.c);
    if (this.floor) freeCanvas(this.floor.c);
    for (const k in this.sprites) freeCanvas(this.sprites[k]);
    this.layers = [];
    this.sprites = {};
    this.ready = false;
  }
}
