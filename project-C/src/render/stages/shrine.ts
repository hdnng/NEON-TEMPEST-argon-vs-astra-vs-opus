/**
 * KITSUNE ALLEY - a narrow back alley that ends at a tiny neon shrine.
 * Layers: rain sky slit, distant shrine + glowing torii (vanishing point), receding alley walls
 * with protruding signs and lantern strings, building facades with balconies full of spectators,
 * street level (vending machines, ramen stall, umbrellas crowd), wet stone floor, swaying
 * foreground lanterns. A holographic fox mask floats above the alley entrance.
 */
import { H, W } from '../../core/view';
import { rgba } from '../../ui/theme';
import { parallaxZoom, psx, psy, sy, type Camera } from '../camera';
import {
  Crowd, DISPLAY_FONT, JP_FONT, Puffs, Rain, Rng, Ripples, TAU, ctx2d, drawBand, drawFloor, drawLayer, fadeSprite,
  flicker, freeCanvas, glowSprite, hasDOM, hazeBand, hologram, layerSpan, makeCanvas, mixWhite, neonStroke, neonText,
  paintFloor, paintLayer, screenGradient, vgrad, type Floor, type Layer,
} from './common';
import type { Stage, StageInfo, StageLight, StageOptions } from './types';

const RED = '#ff3b3b';
const TORII = '#ff5a36';
const CYAN = '#38f0ff';
const MAGENTA = '#ff36b0';
const AMBER = '#ffb44a';
const TEAL = '#3dffc8';

interface Lantern { x: number; y: number; p: number; len: number; ph: number; size: number; img: number }
interface Reflect { x: number; p: number; img: string; w: number; a: number; ph: number }
/** Flickering neon drawn per frame: world rect (left, top, w, h) on layer p. */
interface Flick { img: string; x: number; y: number; p: number; w: number; h: number; seed: number; rate: number }

export class ShrineStage implements Stage {
  readonly info: StageInfo = {
    id: 'shrine',
    name: 'KITSUNE ALLEY',
    location: 'Inari Backstreet, Old Gion Ward',
    description: 'A rain-slick alley that dead-ends at a forgotten fox shrine. The neighbours watch from their balconies; the fox mask watches everyone.',
    music: 'stage_shrine',
    ambience: 'rain',
    accent: TORII,
    accent2: CYAN,
  };
  readonly light: StageLight = { rim: '#ff8a7a', ambient: '#2a1230', reflection: 0.3, shadow: '#05030a' };

  private ready = false;
  private layers: Layer[] = [];
  private skyL!: Layer;
  private shrineL!: Layer;
  private alleyL!: Layer;
  private facadeL!: Layer;
  private streetL!: Layer;
  private floor!: Floor;
  private rain!: Rain;
  private ripples!: Ripples;
  private puffs!: Puffs;
  private crowd!: Crowd;
  private sprites: Record<string, HTMLCanvasElement> = {};
  private lanterns: Lantern[] = [];
  private fgLanterns: Lantern[] = [];
  private reflects: Reflect[] = [];
  private flicks: Flick[] = [];
  private vents: { x: number; y: number; rate: number; acc: number; p: number }[] = [];
  private wind = 0;
  private hype = 0;
  private quality = 2;

  constructor(private opts: StageOptions) {}

  init(pixelRatio: number, quality: number): void {
    if (!hasDOM || this.ready) return;
    this.quality = quality;
    const rFar = Math.min(pixelRatio, 1) * (quality === 0 ? 0.7 : 0.9);
    const rMid = Math.min(pixelRatio, 1.25) * (quality === 0 ? 0.75 : 1);
    const rNear = Math.min(pixelRatio, 1.5) * (quality === 0 ? 0.75 : 1);
    const rng = new Rng(4127);

    // ---------------- sky slit
    {
      const [x0, x1] = layerSpan(0.03);
      this.skyL = paintLayer(0.03, x0, x1, 150, 800, 0.5, (g, Y) => {
        g.fillStyle = vgrad(g, Y(800), Y(150), [[0, '#05060f'], [0.5, '#0d1028'], [0.85, '#271338'], [1, '#3a1a3a']]);
        g.fillRect(x0, Y(800), x1 - x0, 650);
        const cr = new Rng(8);
        for (let i = 0; i < 40; i++) {
          const cx = cr.range(x0, x1), cy = cr.range(420, 780), rx = cr.range(80, 220);
          const gr = g.createRadialGradient(cx, Y(cy), 0, cx, Y(cy), rx);
          gr.addColorStop(0, rgba('#3a1f4a', 0.5));
          gr.addColorStop(1, rgba('#3a1f4a', 0));
          g.fillStyle = gr;
          g.beginPath(); g.ellipse(cx, Y(cy), rx, rx * 0.25, 0, 0, TAU); g.fill();
        }
        hazeBand(g, x0, x1, Y(420), Y(150), '#ff6a3a', 0.12);
      });
    }

    // ---------------- distant shrine + torii (vanishing point)
    {
      const [x0, x1] = layerSpan(0.12);
      this.shrineL = paintLayer(0.12, x0, x1, 120, 760, rFar, (g, Y) => {
        // distant buildings closing the alley end
        g.fillStyle = vgrad(g, Y(760), Y(120), [[0, '#0b0a1c'], [1, '#140d22']]);
        g.fillRect(x0, Y(760), x1 - x0, 640);
        const br = new Rng(12);
        for (let i = 0; i < 260; i++) {
          g.fillStyle = br.pick(['rgba(255,190,120,0.35)', 'rgba(140,220,255,0.25)', 'rgba(255,120,160,0.25)']);
          g.fillRect(br.range(x0, x1), Y(br.range(300, 740)), 3, 4);
        }
        // warm glow behind the shrine
        const gr = g.createRadialGradient(0, Y(260), 0, 0, Y(260), 330);
        gr.addColorStop(0, rgba('#ff7a3a', 0.5));
        gr.addColorStop(0.4, rgba('#ff3a5a', 0.18));
        gr.addColorStop(1, rgba('#ff3a5a', 0));
        g.fillStyle = gr;
        g.fillRect(-340, Y(600), 680, 520);
        // stone steps
        for (let i = 0; i < 6; i++) {
          g.fillStyle = i % 2 ? '#1a1220' : '#22172a';
          g.fillRect(-120 + i * 6, Y(130 + i * 9), 240 - i * 12, 9);
        }
        // shrine hall
        const sb = 184;
        g.fillStyle = '#120b16';
        g.fillRect(-90, Y(sb + 80), 180, 80);
        g.fillStyle = rgba('#ffb060', 0.55);
        g.fillRect(-50, Y(sb + 58), 100, 52);
        g.fillStyle = '#2a120e';
        for (let k = -40; k <= 40; k += 16) g.fillRect(k, Y(sb + 58), 3, 52);
        // curved roof
        g.fillStyle = '#0d0910';
        g.beginPath();
        g.moveTo(-140, Y(sb + 84));
        g.quadraticCurveTo(-100, Y(sb + 92), -70, Y(sb + 130));
        g.lineTo(70, Y(sb + 130));
        g.quadraticCurveTo(100, Y(sb + 92), 140, Y(sb + 84));
        g.closePath();
        g.fill();
        g.strokeStyle = rgba(AMBER, 0.5); g.lineWidth = 2;
        g.beginPath(); g.moveTo(-140, Y(sb + 84)); g.quadraticCurveTo(-100, Y(sb + 92), -70, Y(sb + 130)); g.lineTo(70, Y(sb + 130)); g.quadraticCurveTo(100, Y(sb + 92), 140, Y(sb + 84)); g.stroke();
        // stone lanterns
        for (const lx of [-120, 120]) {
          g.fillStyle = '#1c1420';
          g.fillRect(lx - 5, Y(160), 10, 34);
          g.fillRect(lx - 14, Y(176), 28, 8);
          g.fillRect(lx - 12, Y(198), 24, 14);
          g.fillStyle = rgba('#ffc070', 0.8);
          g.fillRect(lx - 6, Y(194), 12, 8);
          g.beginPath(); g.moveTo(lx - 18, Y(198)); g.lineTo(lx, Y(212)); g.lineTo(lx + 18, Y(198)); g.fillStyle = '#1c1420'; g.fill();
        }
        // torii gate in neon
        const tb = 128, th = 210, tw = 150;
        g.fillStyle = '#1a0a0a';
        g.fillRect(-tw / 2 - 8, Y(tb + th), 16, th);
        g.fillRect(tw / 2 - 8, Y(tb + th), 16, th);
        neonStroke(g, () => {
          g.beginPath();
          g.moveTo(-tw / 2, Y(tb)); g.lineTo(-tw / 2 + 4, Y(tb + th - 10));
          g.moveTo(tw / 2, Y(tb)); g.lineTo(tw / 2 - 4, Y(tb + th - 10));
          g.moveTo(-tw / 2 - 26, Y(tb + th - 40)); g.lineTo(tw / 2 + 26, Y(tb + th - 40));
          g.moveTo(-tw / 2 - 46, Y(tb + th + 4)); g.quadraticCurveTo(0, Y(tb + th - 10), tw / 2 + 46, Y(tb + th + 4));
          g.moveTo(-tw / 2 - 36, Y(tb + th - 10)); g.lineTo(tw / 2 + 36, Y(tb + th - 10));
          g.moveTo(0, Y(tb + th - 10)); g.lineTo(0, Y(tb + th - 40));
        }, TORII, 5, 22);
        hazeBand(g, x0, x1, Y(260), Y(120), '#3a1530', 0.4);
      });
    }

    // ---------------- receding alley walls with signs and lantern strings
    {
      const [x0, x1] = layerSpan(0.28);
      this.alleyL = paintLayer(0.28, x0, x1, 60, 820, rMid, (g, Y) => {
        const wall = (side: number) => {
          const outer = side * 330, inner = side * 96;
          g.fillStyle = vgrad(g, Y(820), Y(60), [[0, '#0b0a18'], [0.6, '#130f22'], [1, '#0a0812']]);
          g.beginPath();
          g.moveTo(outer, Y(820)); g.lineTo(inner, Y(620)); g.lineTo(inner, Y(150)); g.lineTo(outer, Y(60));
          g.lineTo(side * 1400, Y(60)); g.lineTo(side * 1400, Y(820));
          g.closePath();
          g.fill();
          // receding floor lines / windows
          for (let k = 0; k < 9; k++) {
            const t = k / 9;
            const xa = outer + (inner - outer) * t;
            const yTop = 820 + (620 - 820) * t, yBot = 60 + (150 - 60) * t;
            g.fillStyle = rgba('#05040a', 0.6);
            g.fillRect(xa, Y(yTop), side * 2, yTop - yBot);
            if (k % 2 === 0) {
              const wy = yBot + (yTop - yBot) * 0.55;
              g.fillStyle = rgba(rng.pick(['#ffb46a', '#7ae8ff', '#ff7ab8']), 0.35);
              g.beginPath();
              const xb = outer + (inner - outer) * (t + 0.07);
              g.moveTo(xa, Y(wy)); g.lineTo(xb, Y(wy - 6)); g.lineTo(xb, Y(wy + 30)); g.lineTo(xa, Y(wy + 40)); g.fill();
            }
          }
          // pipes running into the depth
          g.strokeStyle = rgba('#3a3060', 0.7); g.lineWidth = 3;
          g.beginPath(); g.moveTo(outer, Y(520)); g.lineTo(inner, Y(450)); g.stroke();
          g.beginPath(); g.moveTo(outer, Y(200)); g.lineTo(inner, Y(220)); g.stroke();
        };
        wall(-1);
        wall(1);
        // protruding vertical signs
        const vs = (x: number, top: number, text: string, color: string, size: number) => {
          const img = neonText(text, size, color, { vertical: true, ratio: 1, glow: size * 0.4 });
          g.fillStyle = '#07060e';
          g.fillRect(x - img.width * 0.32, Y(top), img.width * 0.64, img.height * 0.82);
          g.drawImage(img, x - img.width / 2, Y(top) - img.height * 0.08);
        };
        vs(-250, 640, '稲荷通り', RED, 26);
        vs(240, 600, '雨宿り', CYAN, 24);
        vs(-150, 520, '酒', AMBER, 22);
        vs(160, 470, '占い', MAGENTA, 20);
        // overhead cables
        g.strokeStyle = 'rgba(10,8,20,0.95)'; g.lineWidth = 2;
        for (let k = 0; k < 7; k++) {
          const ya = rng.range(560, 760), yb = rng.range(520, 700);
          g.beginPath(); g.moveTo(-340, Y(ya)); g.quadraticCurveTo(0, Y(Math.min(ya, yb) - 60), 340, Y(yb)); g.stroke();
        }
        hazeBand(g, x0, x1, Y(330), Y(60), '#1a0d22', 0.6);
      });
      this.reflects.push({ x: -250, p: 0.28, img: 'reflRed', w: 40, a: 0.4, ph: 0 });
      this.reflects.push({ x: 240, p: 0.28, img: 'reflCyan', w: 36, a: 0.35, ph: 1 });
      this.reflects.push({ x: 0, p: 0.12, img: 'reflTorii', w: 220, a: 0.45, ph: 2 });
      // lantern strings across the alley (drawn per frame, sway)
      for (let k = 0; k < 9; k++) {
        const x = -260 + k * 65;
        const sag = Math.sin((k / 8) * Math.PI) * 26;
        this.lanterns.push({ x, y: 440 - sag, p: 0.28, len: 10, ph: k * 0.7, size: 22, img: k % 3 });
      }
    }

    // ---------------- building facades with balconies
    const balconies: [number, number, number][] = [];
    {
      const [x0, x1] = layerSpan(0.45);
      this.facadeL = paintLayer(0.45, x0, x1, 40, 860, rMid, (g, Y) => {
        const facade = (fx0: number, fx1: number, top: number, tone: string) => {
          g.fillStyle = vgrad(g, Y(top), Y(40), [[0, tone], [1, '#07060e']]);
          g.fillRect(fx0, Y(top), fx1 - fx0, top - 40);
          // floor separators
          g.fillStyle = 'rgba(255,255,255,0.04)';
          for (let yy = 150; yy < top; yy += 130) g.fillRect(fx0, Y(yy), fx1 - fx0, 3);
          // windows with warm light and blinds
          const wr = new Rng(Math.floor(fx0));
          for (let yy = 190; yy < top - 60; yy += 130) {
            for (let xx = fx0 + 40; xx < fx1 - 80; xx += 110) {
              if (wr.chance(0.25)) continue;
              const lit = wr.chance(0.55);
              const col = wr.pick(['#ffaa5a', '#ffc98a', '#6ad6ff', '#ff6aa8', '#c08aff']);
              if (lit) {
                g.fillStyle = vgrad(g, Y(yy + 74), Y(yy), [[0, rgba(col, 0.34)], [1, rgba(col, 0.14)]]);
              } else g.fillStyle = '#0a0912';
              g.fillRect(xx, Y(yy + 74), 70, 74);
              if (lit) {
                g.fillStyle = rgba('#000000', 0.45);
                for (let b = 0; b < 74; b += 7) g.fillRect(xx, Y(yy + 74) + b, 70, 2.5);
                // silhouette in some windows
                if (wr.chance(0.35)) {
                  g.fillStyle = 'rgba(10,6,14,0.85)';
                  g.beginPath(); g.arc(xx + 35, Y(yy + 42), 9, 0, TAU); g.fill();
                  g.fillRect(xx + 22, Y(yy + 32), 26, 32);
                }
              }
              g.strokeStyle = '#05040a'; g.lineWidth = 3; g.strokeRect(xx, Y(yy + 74), 70, 74);
            }
          }
          // AC units hanging on walls
          for (let k = 0; k < 4; k++) {
            const ax = wr.range(fx0 + 20, fx1 - 80), ay = wr.range(220, top - 80);
            g.fillStyle = '#1b1a2e'; g.fillRect(ax, Y(ay + 34), 56, 34);
            g.fillStyle = '#0b0a16'; g.beginPath(); g.arc(ax + 18, Y(ay + 17), 12, 0, TAU); g.fill();
          }
        };
        facade(x0, -300, 820, '#160f24');
        facade(300, x1, 780, '#120f26');
        // balconies with railings (crowd stands here)
        const balcony = (bx0: number, bx1: number, by: number) => {
          g.fillStyle = '#0b0914';
          g.fillRect(bx0, Y(by), bx1 - bx0, 10);
          g.fillStyle = 'rgba(255,140,120,0.25)';
          g.fillRect(bx0, Y(by + 46), bx1 - bx0, 2);
          balconies.push([bx0, bx1, by]);
        };
        balcony(-760, -420, 300);
        balcony(470, 820, 290);
        balcony(-1100, -860, 420);
        balcony(880, 1150, 430);
        // neon shop signs
        const sign = (x: number, y: number, text: string, color: string, size: number, font = JP_FONT, flickKey = '') => {
          const img = neonText(text, size, color, { ratio: 1, glow: size * 0.45, font });
          g.fillStyle = '#06050c';
          g.fillRect(x - 8, Y(y) - 4, img.width * 0.7 + 16, img.height * 0.62 + 8);
          if (flickKey) {
            this.flicks.push({ img: flickKey, x: x - img.width * 0.15, y: y + img.height * 0.19, p: 0.45, w: img.width, h: img.height, seed: 2.2, rate: 1 });
          } else {
            g.drawImage(img, x - img.width * 0.15, Y(y) - img.height * 0.19, img.width, img.height);
          }
        };
        sign(-700, 250, '狐ラーメン', AMBER, 30, JP_FONT, 'flickRamen');
        sign(520, 238, 'カラオケ 歌', MAGENTA, 26);
        sign(-1080, 360, '薬 24h', TEAL, 22);
        sign(860, 370, 'BAR KOHAKU', CYAN, 22, DISPLAY_FONT);
        // noren curtain over a shop door (left)
        g.fillStyle = '#2a0c18';
        for (let k = 0; k < 4; k++) g.fillRect(-640 + k * 34, Y(200), 30, 56);
        g.fillStyle = 'rgba(255,220,200,0.6)';
        g.font = `700 20px ${JP_FONT}`;
        g.fillText('狐', -633, Y(162));
        // fire escape on the right facade
        g.strokeStyle = '#0a0812'; g.lineWidth = 3;
        for (let yy = 520; yy < 780; yy += 120) {
          g.beginPath(); g.moveTo(400, Y(yy)); g.lineTo(560, Y(yy)); g.moveTo(400, Y(yy)); g.lineTo(560, Y(yy + 120)); g.stroke();
          for (let r = 0; r < 160; r += 12) { g.beginPath(); g.moveTo(400 + r, Y(yy)); g.lineTo(400 + r, Y(yy + 30)); g.stroke(); }
        }
        hazeBand(g, x0, x1, Y(240), Y(40), '#0d0716', 0.55);
      });
      this.reflects.push({ x: -600, p: 0.45, img: 'reflAmber', w: 160, a: 0.35, ph: 3 });
      this.reflects.push({ x: 600, p: 0.45, img: 'reflMag', w: 150, a: 0.35, ph: 4 });
      this.reflects.push({ x: -1000, p: 0.45, img: 'reflTeal', w: 100, a: 0.3, ph: 5 });
      this.reflects.push({ x: 940, p: 0.45, img: 'reflCyan', w: 110, a: 0.3, ph: 6 });
    }

    // ---------------- street level props
    {
      const [x0, x1] = layerSpan(0.72);
      this.streetL = paintLayer(0.72, x0, x1, 20, 330, rNear, (g, Y) => {
        const base = 60;
        // vending machines
        const vend = (x: number, glow: string, label: string) => {
          g.fillStyle = vgrad(g, Y(base + 170), Y(base), [[0, '#8e9db4'], [1, '#3c4458']]);
          g.fillRect(x, Y(base + 170), 80, 170);
          g.fillStyle = vgrad(g, Y(base + 162), Y(base + 72), [[0, mixWhite(glow, 0.35)], [1, rgba(glow, 0.45)]]);
          g.fillRect(x + 6, Y(base + 162), 68, 90);
          const pr = new Rng(Math.floor(x));
          for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
            g.fillStyle = pr.pick(['#d23a5a', '#2a88d0', '#d0aa3a', '#3ad07a', '#d07a2a', '#c8d0e0']);
            g.fillRect(x + 10 + c * 13, Y(base + 152 - r * 21), 8, 14);
          }
          g.fillStyle = '#20263a'; g.fillRect(x + 8, Y(base + 64), 64, 26);
          g.fillStyle = '#0c0f1c'; g.fillRect(x + 10, Y(base + 30), 60, 18);
          g.fillStyle = glow; g.font = `700 10px ${DISPLAY_FONT}`; g.fillText(label, x + 12, Y(base + 166) + 1);
          const halo = g.createRadialGradient(x + 40, Y(base + 90), 10, x + 40, Y(base + 90), 140);
          halo.addColorStop(0, rgba(glow, 0.22)); halo.addColorStop(1, rgba(glow, 0));
          g.fillStyle = halo; g.fillRect(x - 100, Y(base + 230), 280, 260);
        };
        vend(-640, '#7ae8ff', 'COLD');
        vend(-552, '#ff8ac0', 'HOT/COLD');
        vend(560, '#7affc8', 'NEO-COLA');
        // ramen stall (right)
        const sx = 760;
        g.fillStyle = '#1a1018'; g.fillRect(sx, Y(base + 110), 240, 110);
        g.fillStyle = '#3a0c18';
        for (let k = 0; k < 6; k++) g.fillRect(sx + 8 + k * 38, Y(base + 168), 34, 44);
        g.fillStyle = 'rgba(255,230,210,0.7)'; g.font = `700 22px ${JP_FONT}`;
        g.fillText('ら', sx + 18, Y(base + 138)); g.fillText('ー', sx + 56, Y(base + 138)); g.fillText('め', sx + 94, Y(base + 138)); g.fillText('ん', sx + 132, Y(base + 138));
        g.fillStyle = '#0c0810'; g.fillRect(sx - 6, Y(base + 176), 252, 10);
        const lamp = g.createRadialGradient(sx + 120, Y(base + 100), 4, sx + 120, Y(base + 100), 160);
        lamp.addColorStop(0, 'rgba(255,190,110,0.35)'); lamp.addColorStop(1, 'rgba(255,190,110,0)');
        g.fillStyle = lamp; g.fillRect(sx - 60, Y(base + 260), 360, 280);
        // bicycles (left)
        const bike = (x: number) => {
          g.strokeStyle = '#0d0b18'; g.lineWidth = 3;
          g.beginPath(); g.arc(x, Y(base + 24), 22, 0, TAU); g.stroke();
          g.beginPath(); g.arc(x + 70, Y(base + 24), 22, 0, TAU); g.stroke();
          g.beginPath(); g.moveTo(x, Y(base + 24)); g.lineTo(x + 30, Y(base + 60)); g.lineTo(x + 70, Y(base + 24)); g.lineTo(x + 40, Y(base + 26)); g.lineTo(x + 30, Y(base + 60)); g.stroke();
          g.beginPath(); g.moveTo(x + 30, Y(base + 60)); g.lineTo(x + 26, Y(base + 72)); g.moveTo(x + 64, Y(base + 56)); g.lineTo(x + 58, Y(base + 76)); g.stroke();
        };
        bike(-1000); bike(-900);
        // trash bags and crates
        g.fillStyle = '#0c0b16';
        for (const bx of [-420, -380, 420, 1100]) { g.beginPath(); g.ellipse(bx, Y(base + 18), 26, 22, 0, 0, TAU); g.fill(); }
        g.fillStyle = '#16121e'; g.fillRect(450, Y(base + 40), 50, 40); g.fillRect(470, Y(base + 72), 40, 32);
        // A-frame sign
        g.fillStyle = '#0e0c18'; g.beginPath(); g.moveTo(-300, Y(base)); g.lineTo(-282, Y(base + 70)); g.lineTo(-250, Y(base + 70)); g.lineTo(-232, Y(base)); g.fill();
        const af = neonText('営業中', 12, TEAL, { ratio: 1, glow: 5 });
        g.drawImage(af, -292, Y(base + 58));
        // steam grates
        for (const gx of [-200, 330]) {
          g.fillStyle = '#0a0812'; g.fillRect(gx - 30, Y(base + 4), 60, 6);
          this.vents.push({ x: gx, y: base + 8, rate: 0.16, acc: 0, p: 0.72 });
        }
        this.vents.push({ x: sx + 120, y: base + 180, rate: 0.1, acc: 0, p: 0.72 });
      });
      this.reflects.push({ x: -596, p: 0.72, img: 'reflCyan', w: 180, a: 0.4, ph: 7 });
      this.reflects.push({ x: 600, p: 0.72, img: 'reflTeal', w: 90, a: 0.35, ph: 8 });
      this.reflects.push({ x: 880, p: 0.72, img: 'reflAmber', w: 200, a: 0.3, ph: 9 });
    }

    // ---------------- sprites
    const S = this.sprites;
    S.flickRamen = neonText('狐ラーメン', 30, AMBER, { ratio: rMid, glow: 30 * 0.45 });
    S.reflRed = fadeSprite(RED, 0.5, 0, 128);
    S.reflTorii = fadeSprite(TORII, 0.55, 0, 128);
    S.reflCyan = fadeSprite(CYAN, 0.5, 0, 128);
    S.reflMag = fadeSprite(MAGENTA, 0.5, 0, 128);
    S.reflAmber = fadeSprite(AMBER, 0.5, 0, 128);
    S.reflTeal = fadeSprite(TEAL, 0.45, 0, 128);
    S.puff = glowSprite('#d8c8e8', 64, 1.6);
    S.glowWarm = glowSprite('#ff8a4a', 64);
    S.scanBar = fadeSprite('#c8fbff', 0, 0.55, 64, true);
    S.vignette = screenGradient([[0, 'rgba(4,2,10,0.6)'], [0.22, 'rgba(4,2,10,0)'], [0.8, 'rgba(4,2,10,0)'], [1, 'rgba(4,2,10,0.5)']]);
    for (let i = 0; i < 3; i++) {
      const col = [RED, '#ff8a3a', '#ff4a8a'][i];
      const c = makeCanvas(60, 84);
      const g = ctx2d(c);
      g.translate(30, 10);
      g.fillStyle = '#1a0a0a';
      g.fillRect(-9, 0, 18, 6);
      g.fillRect(-9, 62, 18, 6);
      g.shadowColor = col; g.shadowBlur = 18;
      g.fillStyle = col;
      g.beginPath(); g.ellipse(0, 34, 22, 29, 0, 0, TAU); g.fill();
      g.shadowBlur = 0;
      g.fillStyle = 'rgba(255,230,180,0.45)';
      g.beginPath(); g.ellipse(-5, 30, 10, 20, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(80,10,10,0.5)'; g.lineWidth = 1;
      for (let k = -18; k <= 18; k += 6) { g.beginPath(); g.moveTo(-22, 34 + k); g.lineTo(22, 34 + k); g.stroke(); }
      g.fillStyle = 'rgba(40,0,0,0.75)'; g.font = `700 16px ${JP_FONT}`; g.textAlign = 'center';
      g.fillText(['祭', '狐', '雨'][i], 0, 40);
      S['lantern' + i] = c;
    }
    S.mask = hologram(200, 230, rMid, CYAN, (g) => this.paintMask(g));
    S.maskGlow = glowSprite('#7af0ff', 128);

    // ---------------- floor
    const puddles: { x: number; v: number; rx: number; rv: number }[] = [];
    this.floor = paintFloor(-1500, 1500, 72, 112, Math.min(pixelRatio, 1.25) * (quality === 0 ? 0.75 : 1), 0.36, (g, F) => {
      const D = F.back + F.front;
      g.fillStyle = vgrad(g, 0, D, [[0, '#1a1220'], [0.35, '#110c18'], [1, '#09070f']]);
      g.fillRect(-1500, 0, 3000, D);
      // stone pavers: staggered rows, rows taller toward the camera
      const rowsV = [0, 8, 18, 30, 45, 63, 84, 108, 136, 168, D];
      const nr = new Rng(3);
      for (let r = 0; r < rowsV.length - 1; r++) {
        const v0 = rowsV[r], v1 = rowsV[r + 1];
        const pw = 60 + r * 8;
        const off = (r % 2) * pw * 0.5;
        for (let x = -1500 - off; x < 1500; x += pw) {
          const shade = nr.range(0, 1);
          g.fillStyle = shade > 0.7 ? 'rgba(255,255,255,0.025)' : shade < 0.2 ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0)';
          g.fillRect(x + 1, v0 + 1, pw - 2, v1 - v0 - 2);
          g.fillStyle = 'rgba(0,0,0,0.45)';
          g.fillRect(x, v0, 1.5, v1 - v0);
        }
        g.fillStyle = 'rgba(0,0,0,0.5)';
        g.fillRect(-1500, v0, 3000, 1.2);
        g.fillStyle = 'rgba(255,160,140,0.05)';
        g.fillRect(-1500, v0 + 1.2, 3000, 1);
      }
      // drain channel and manhole
      g.fillStyle = '#07050b'; g.fillRect(-1500, 4, 3000, 5);
      g.fillStyle = 'rgba(120,120,160,0.12)';
      for (let x = -1500; x < 1500; x += 12) g.fillRect(x, 4, 6, 5);
      g.save(); g.translate(260, F.back + 40); g.scale(1, 0.2);
      g.fillStyle = '#0b0a12'; g.beginPath(); g.arc(0, 0, 60, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(160,150,200,0.25)'; g.lineWidth = 6; g.stroke();
      g.restore();
      // faded crosswalk stripes toward the camera
      g.fillStyle = 'rgba(225,225,245,0.07)';
      for (let x = -560; x < -120; x += 56) g.fillRect(x, F.back + 18, 30, F.front - 26);
      // puddles
      const pr = new Rng(21);
      for (let i = 0; i < 26; i++) {
        const x = pr.range(-1400, 1400), v = pr.range(14, D - 8), rx = pr.range(40, 160), rv = rx * 0.12 * (0.7 + v / D);
        const col = pr.pick([TORII, CYAN, MAGENTA, AMBER]);
        const gr = g.createRadialGradient(x, v, 0, x, v, rx);
        gr.addColorStop(0, rgba(col, 0.18));
        gr.addColorStop(0.75, rgba('#05030a', 0.4));
        gr.addColorStop(1, rgba('#05030a', 0));
        g.fillStyle = gr;
        g.save(); g.translate(x, v); g.scale(1, rv / rx); g.translate(-x, -v);
        g.beginPath(); g.arc(x, v, rx, 0, TAU); g.fill();
        g.restore();
        puddles.push({ x, v, rx, rv });
      }
      // warm sheen at the back from the shrine
      g.fillStyle = vgrad(g, 0, 60, [[0, 'rgba(255,110,70,0.2)'], [1, 'rgba(255,110,70,0)']]);
      g.fillRect(-700, 0, 1400, 60);
    });

    // ---------------- crowd: balconies + street
    const crowdSpecs = [
      ...balconies.map(([b0, b1, by]) => ({ p: 0.45, base: by + 40, x0: b0 + 20, x1: b1 - 10, spacing: 44, scale: 0.62, body: '#0b0812', rim: '#ff8a8a', phone: 0.2 })),
      { p: 0.74, base: 70, x0: -1150, x1: 1150, spacing: 58, scale: 0.86, body: '#08060d', rim: '#7ae8ff', umbrella: 0.5,
        umbrellaColors: [CYAN, MAGENTA, '#ffffff', TORII], gaps: [[-330, 330] as [number, number], [-700, -500] as [number, number], [540, 660] as [number, number]], phone: 0.3 },
    ];
    this.crowd = new Crowd(crowdSpecs, 777, Math.min(pixelRatio, 1.25));

    // foreground lanterns hanging from the top (p > 1)
    [-1250, -430, 430, 1250].forEach((x, k) => {
      this.fgLanterns.push({ x, y: 690, p: 1.35, len: 50 + (k % 3) * 22, ph: k * 1.3, size: 40, img: k % 3 });
    });

    const q = [0.45, 0.75, 1][quality] ?? 1;
    this.rain = new Rain([
      { count: Math.round(220 * q), p: 0.3, speed: 13, len: 14, width: 1, color: '#c8a8ff', alpha: 0.2 },
      { count: Math.round(170 * q), p: 0.7, speed: 18, len: 22, width: 1.1, color: '#d8c8ff', alpha: 0.27 },
      { count: Math.round(70 * q), p: 1.2, speed: 26, len: 38, width: 1.5, color: '#f0e8ff', alpha: 0.32 },
      { count: Math.round(14 * q), p: 1.8, speed: 34, len: 80, width: 2.4, color: '#ffffff', alpha: 0.16 },
    ], 0.05, 919, 1.8 * q);
    this.ripples = new Ripples(Math.round(70 * q) + 10, 5, puddles);
    this.puffs = new Puffs(48, 17, S.puff);
    this.layers = [this.skyL, this.shrineL, this.alleyL, this.facadeL, this.streetL];
    this.ready = true;
  }

  /** Kitsune mask: white face, pointed ears, red markings, cyan holographic contour. */
  private paintMask(g: CanvasRenderingContext2D): void {
    const cx = 100;
    const face = () => {
      g.beginPath();
      g.moveTo(cx, 214);
      g.quadraticCurveTo(cx - 34, 190, cx - 58, 120);
      g.lineTo(cx - 74, 20);
      g.lineTo(cx - 36, 64);
      g.quadraticCurveTo(cx, 50, cx + 36, 64);
      g.lineTo(cx + 74, 20);
      g.lineTo(cx + 58, 120);
      g.quadraticCurveTo(cx + 34, 190, cx, 214);
      g.closePath();
    };
    face();
    g.fillStyle = vgrad(g, 20, 214, [[0, 'rgba(230,250,255,0.55)'], [1, 'rgba(160,230,255,0.35)']]);
    g.fill();
    g.shadowColor = CYAN; g.shadowBlur = 16;
    g.strokeStyle = rgba(CYAN, 0.95); g.lineWidth = 2.5;
    face(); g.stroke();
    g.shadowBlur = 0;
    // inner ears
    g.fillStyle = rgba('#ff3b6b', 0.75);
    g.beginPath(); g.moveTo(cx - 66, 34); g.lineTo(cx - 44, 66); g.lineTo(cx - 58, 82); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(cx + 66, 34); g.lineTo(cx + 44, 66); g.lineTo(cx + 58, 82); g.closePath(); g.fill();
    // red markings
    g.strokeStyle = rgba('#ff2f5a', 0.95); g.lineWidth = 4; g.lineCap = 'round';
    g.shadowColor = '#ff2f5a'; g.shadowBlur = 10;
    g.beginPath(); g.moveTo(cx - 50, 108); g.quadraticCurveTo(cx - 30, 92, cx - 12, 110); g.stroke();
    g.beginPath(); g.moveTo(cx + 50, 108); g.quadraticCurveTo(cx + 30, 92, cx + 12, 110); g.stroke();
    g.beginPath(); g.moveTo(cx - 6, 76); g.lineTo(cx, 92); g.lineTo(cx + 6, 76); g.stroke();
    g.beginPath(); g.moveTo(cx - 40, 150); g.lineTo(cx - 26, 146); g.moveTo(cx + 40, 150); g.lineTo(cx + 26, 146); g.stroke();
    g.shadowBlur = 0;
    // eye slits
    g.fillStyle = 'rgba(5,10,30,0.9)';
    g.beginPath(); g.moveTo(cx - 46, 118); g.quadraticCurveTo(cx - 30, 110, cx - 14, 120); g.quadraticCurveTo(cx - 30, 124, cx - 46, 118); g.fill();
    g.beginPath(); g.moveTo(cx + 46, 118); g.quadraticCurveTo(cx + 30, 110, cx + 14, 120); g.quadraticCurveTo(cx + 30, 124, cx + 46, 118); g.fill();
    // glowing pupils
    g.fillStyle = '#ffe36b'; g.shadowColor = '#ffe36b'; g.shadowBlur = 10;
    g.beginPath(); g.arc(cx - 30, 117, 3, 0, TAU); g.fill();
    g.beginPath(); g.arc(cx + 30, 117, 3, 0, TAU); g.fill();
    g.shadowBlur = 0;
    // muzzle and mouth
    g.strokeStyle = rgba('#203050', 0.8); g.lineWidth = 2;
    g.beginPath(); g.moveTo(cx - 10, 184); g.quadraticCurveTo(cx, 192, cx + 10, 184); g.stroke();
    g.fillStyle = 'rgba(20,30,60,0.9)';
    g.beginPath(); g.ellipse(cx, 172, 7, 4, 0, 0, TAU); g.fill();
    // tech HUD ticks around
    g.strokeStyle = rgba(CYAN, 0.5); g.lineWidth = 1;
    g.beginPath(); g.arc(cx, 118, 104, -2.6, -0.54); g.stroke();
    g.beginPath(); g.arc(cx, 118, 110, 0.6, 2.5); g.stroke();
    g.font = `600 9px ${DISPLAY_FONT}`; g.fillStyle = rgba(CYAN, 0.7);
    g.fillText('INARI//NET  WARD 3', cx - 50, 228);
  }

  update(t: number, cam: Camera): void {
    if (!this.ready) return;
    const floorTop = sy(cam, 0) - this.floor.back * cam.zoom;
    this.wind = Math.sin(t * 0.5) * 0.06 + Math.sin(t * 1.7) * 0.02;
    this.rain.gust = this.wind * 0.6;
    this.rain.update(cam, floorTop);
    this.ripples.update(1.3 * (this.quality + 1) / 3);
    for (const v of this.vents) {
      v.acc += v.rate;
      while (v.acc >= 1) { v.acc -= 1; this.puffs.emit(v.x, v.y, 54, 0.15, 0.55); }
    }
    this.puffs.update(0.2 + this.wind * 2);
    this.crowd.update(1 / 60);
    if (this.hype > 0) this.hype = Math.max(0, this.hype - 1 / 60);
  }

  drawBack(ctx: CanvasRenderingContext2D, cam: Camera, t: number): void {
    if (!this.ready) { ctx.fillStyle = '#05030a'; ctx.fillRect(0, 0, W, H); return; }
    const S = this.sprites;
    ctx.fillStyle = '#05040c';
    ctx.fillRect(0, 0, W, H);
    drawLayer(ctx, this.skyL, cam);
    drawLayer(ctx, this.shrineL, cam);
    // torii pulse glow
    ctx.globalCompositeOperation = 'lighter';
    {
      const zp = parallaxZoom(cam, 0.12);
      const pulse = 0.35 + 0.08 * Math.sin(t * 1.6) + this.hype * 0.3;
      ctx.globalAlpha = pulse;
      ctx.drawImage(S.glowWarm, psx(cam, 0, 0.12) - 230 * zp, psy(cam, 300, 0.12) - 170 * zp, 460 * zp, 340 * zp);
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = 'source-over';
    this.rain.draw(ctx, 0, 1);
    drawLayer(ctx, this.alleyL, cam);
    this.drawLanterns(ctx, cam, this.lanterns, t, 0.6);
    this.drawMask(ctx, cam, t);
    drawLayer(ctx, this.facadeL, cam);
    ctx.globalCompositeOperation = 'lighter';
    for (const f of this.flicks) {
      const zp = parallaxZoom(cam, f.p);
      ctx.globalAlpha = flicker(t, f.seed, f.rate);
      ctx.drawImage(S[f.img], psx(cam, f.x, f.p), psy(cam, f.y, f.p), f.w * zp, f.h * zp);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    for (let r = 0; r < this.crowd.rows.length - 1; r++) this.crowd.drawRow(ctx, cam, r);
    this.rain.draw(ctx, 1, 2);
    drawLayer(ctx, this.streetL, cam);
    this.puffs.draw(ctx, cam, 0.72, 0.3);
    this.crowd.drawRow(ctx, cam, this.crowd.rows.length - 1);
    drawFloor(ctx, this.floor, cam);
    this.drawReflections(ctx, cam, t);
    this.ripples.draw(ctx, cam, this.floor, '#e0c8ff');
    this.rain.drawSplashes(ctx, '#e6d8ff');
  }

  drawFront(ctx: CanvasRenderingContext2D, cam: Camera, t: number): void {
    if (!this.ready) return;
    this.rain.draw(ctx, 2, 4);
    this.drawLanterns(ctx, cam, this.fgLanterns, t, 1);
    drawBand(ctx, this.sprites.vignette, 0, H, 1);
  }

  private drawLanterns(ctx: CanvasRenderingContext2D, cam: Camera, list: Lantern[], t: number, glowA: number): void {
    const S = this.sprites;
    // strings
    ctx.beginPath();
    for (const l of list) {
      const X = psx(cam, l.x, l.p), Yv = psy(cam, l.y, l.p);
      const zp = parallaxZoom(cam, l.p);
      const ang = Math.sin(t * 1.3 + l.ph) * 0.12 + this.wind * 1.5;
      const len = l.len * zp;
      ctx.moveTo(X, Yv - (l.p > 1 ? 400 : 4));
      ctx.lineTo(X + Math.sin(ang) * len, Yv + Math.cos(ang) * len);
    }
    ctx.strokeStyle = '#0a0610';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    for (const l of list) {
      const X = psx(cam, l.x, l.p), Yv = psy(cam, l.y, l.p);
      const zp = parallaxZoom(cam, l.p);
      const ang = Math.sin(t * 1.3 + l.ph) * 0.12 + this.wind * 1.5;
      const len = l.len * zp;
      const ax = X + Math.sin(ang) * len, ay = Yv + Math.cos(ang) * len;
      const s = l.size * zp;
      if (ax < -s * 2 || ax > W + s * 2) continue;
      const img = S['lantern' + l.img];
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = glowA * (0.5 + 0.1 * Math.sin(t * 3 + l.ph));
      ctx.drawImage(S.glowWarm, ax - s * 1.6, ay - s * 0.4, s * 3.2, s * 3.2);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      const w = s * 1.25, h = w * 1.4;
      ctx.translate(ax, ay);
      ctx.rotate(-ang * 0.6);
      ctx.drawImage(img, -w / 2, -h * 0.12, w, h);
      ctx.rotate(ang * 0.6);
      ctx.translate(-ax, -ay);
    }
  }

  private drawMask(ctx: CanvasRenderingContext2D, cam: Camera, t: number): void {
    const S = this.sprites;
    const p = 0.3;
    const zp = parallaxZoom(cam, p);
    const bob = Math.sin(t * 0.9) * 10;
    const w = 200 * zp * 0.9, h = 230 * zp * 0.9;
    const pad = 24 * zp * 0.9;
    const X = psx(cam, 0, p) - w / 2, Yv = psy(cam, 610 + bob, p);
    const fl = flicker(t, 9.3, 0.8);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.3 * fl + this.hype * 0.2;
    ctx.drawImage(S.maskGlow, X - w * 0.4, Yv - h * 0.3, w * 1.8, h * 1.6);
    ctx.globalAlpha = 0.85 * fl;
    const glitch = !this.opts.flashReduction && (Math.sin(t * 2.1) > 0.97 || this.hype > 0.6);
    if (glitch) {
      // horizontal slice offsets
      const iw = S.mask.width, ih = S.mask.height;
      const slices = 6;
      for (let i = 0; i < slices; i++) {
        const sy0 = (ih / slices) * i;
        const off = Math.sin(t * 40 + i * 2.3) * 10 * zp;
        ctx.drawImage(S.mask, 0, sy0, iw, ih / slices, X - pad + off, Yv - pad + ((h + pad * 2) / slices) * i, w + pad * 2, (h + pad * 2) / slices);
      }
    } else {
      ctx.drawImage(S.mask, X - pad, Yv - pad, w + pad * 2, h + pad * 2);
    }
    // scan bar
    const sb = Yv + ((t * 50) % (h + 30)) - 15;
    ctx.globalAlpha = 0.25 * fl;
    ctx.drawImage(S.scanBar, X, sb, w, 14 * zp);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawReflections(ctx: CanvasRenderingContext2D, cam: Camera, t: number): void {
    const S = this.sprites;
    const top = sy(cam, 0) - this.floor.back * cam.zoom;
    const h = (this.floor.back + this.floor.front) * cam.zoom;
    ctx.globalCompositeOperation = 'lighter';
    for (const r of this.reflects) {
      const X = psx(cam, r.x, r.p);
      const w = r.w * parallaxZoom(cam, r.p) * 1.1;
      if (X + w < 0 || X - w > W) continue;
      ctx.globalAlpha = r.a * (0.75 + 0.25 * Math.sin(t * 2.1 + r.ph));
      ctx.drawImage(S[r.img], X - w / 2, top, w, h);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  onEvent(kind: string, intensity: number): void {
    if (kind === 'hit_heavy') this.crowd.cheer(0.25 * intensity);
    else if (kind === 'super') { this.crowd.cheer(0.6 * intensity); this.hype = 1; }
    else if (kind === 'ko' || kind === 'perfect') { this.crowd.cheer(1.2); this.hype = 1; }
    else if (kind === 'round_start') this.crowd.cheer(0.45);
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
