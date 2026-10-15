/**
 * SHINSEI ROOFTOP - a rain-lashed skyscraper roof, 88 floors above Neo-Kyoto.
 * Layers (back to front): storm sky, hazy far skyline, far skyline, searchlights, mid towers with
 * holographic billboards (koi, rotating logo, scrolling ad strip), flying traffic, near rooftop
 * structures, railing + AC units + steam, wet helipad floor with neon reflections, foreground rain.
 */
import { H, W } from '../../core/view';
import { rgba } from '../../ui/theme';
import { parallaxZoom, psx, psy, sy, type Camera } from '../camera';
import {
  DISPLAY_FONT, JP_FONT, Puffs, Rain, Rng, Ripples, TAU, coneSprite, ctx2d, drawBand, drawFloor, drawLayer,
  drawRotated, fadeSprite, flicker, freeCanvas, glowSprite, hasDOM, hazeBand, hologram, layerSpan,
  makeCanvas, mixWhite, neonStroke, neonText, paintFloor, paintLayer, paintSkyline, rgbaCached, screenGradient, vgrad,
  type Floor, type Layer,
} from './common';
import type { Stage, StageInfo, StageLight, StageOptions } from './types';

const CYAN = '#2ee8ff';
const MAGENTA = '#ff2fa0';
const VIOLET = '#8d5cff';
const AMBER = '#ffb347';

interface Blinker { x: number; y: number; p: number; ph: number; color: string; size: number }
interface Car { lane: number; x: number; speed: number; dir: number; color: string }
interface Reflect { x: number; p: number; color: string; w: number; a: number; ph: number }
interface Flick { img: HTMLCanvasElement; x: number; y: number; p: number; w: number; h: number; seed: number }

export class RooftopStage implements Stage {
  readonly info: StageInfo = {
    id: 'rooftop',
    name: 'SHINSEI ROOFTOP',
    location: 'Shinsei Tower, Helipad 88F',
    description: 'Eighty-eight floors above the flooded streets, the storm never stops. Holograms swim between the towers while the city bets on who falls first.',
    music: 'stage_rooftop',
    ambience: 'storm',
    accent: CYAN,
    accent2: MAGENTA,
  };
  readonly light: StageLight = { rim: '#7fe9ff', ambient: '#241a52', reflection: 0.32, shadow: '#03040c' };

  private ready = false;
  private layers: Layer[] = [];
  private sky!: Layer;
  private haze!: Layer;
  private far!: Layer;
  private mid!: Layer;
  private near!: Layer;
  private rail!: Layer;
  private floor!: Floor;
  private rain!: Rain;
  private ripples!: Ripples;
  private puffs!: Puffs;
  private sprites: Record<string, HTMLCanvasElement> = {};
  private blinkers: Blinker[] = [];
  private cars: Car[] = [];
  private reflects: Reflect[] = [];
  private flicks: Flick[] = [];
  private vents: { x: number; y: number; rate: number; acc: number }[] = [];
  private rng = new Rng(8801);
  private lightning = 0;
  private lightningNext = 6;
  private bolt: number[] = [];
  private boltX = 0;
  private superPulse = 0;
  private quality = 2;

  constructor(private opts: StageOptions) {}

  init(pixelRatio: number, quality: number): void {
    if (!hasDOM || this.ready) return;
    this.quality = quality;
    const rFar = Math.min(pixelRatio, 1) * (quality === 0 ? 0.7 : 0.9);
    const rMid = Math.min(pixelRatio, 1.25) * (quality === 0 ? 0.75 : 1);
    const rNear = Math.min(pixelRatio, 1.5) * (quality === 0 ? 0.75 : 1);
    const rng = new Rng(1988);

    // ---------------- sky
    {
      const [x0, x1] = layerSpan(0.02);
      this.sky = paintLayer(0.02, x0, x1, 60, 820, Math.min(0.6, rFar), (g, Y) => {
        g.fillStyle = vgrad(g, Y(820), Y(60), [[0, '#03030c'], [0.35, '#0a0922'], [0.62, '#1d0c36'], [0.82, '#3d1048'], [1, '#5a1a55']]);
        g.fillRect(x0, Y(820), x1 - x0, 760);
        // storm clouds: dark masses lit from below by the city
        const cr = new Rng(77);
        for (let i = 0; i < 70; i++) {
          const cx = cr.range(x0, x1), cy = cr.range(330, 760), rx = cr.range(90, 260), ry = cr.range(22, 60);
          const gr = g.createRadialGradient(cx, Y(cy), 0, cx, Y(cy), rx);
          const lit = cy < 480 ? '#4a1752' : '#1a1236';
          gr.addColorStop(0, rgba(lit, 0.55));
          gr.addColorStop(1, rgba(lit, 0));
          g.fillStyle = gr;
          g.beginPath(); g.ellipse(cx, Y(cy), rx, ry, 0, 0, TAU); g.fill();
          // dark top
          g.fillStyle = rgba('#05040f', 0.35);
          g.beginPath(); g.ellipse(cx, Y(cy + ry * 0.5), rx * 0.8, ry * 0.6, 0, 0, TAU); g.fill();
        }
        // cyan underglow band at the horizon
        hazeBand(g, x0, x1, Y(330), Y(120), '#3a2a7a', 0.6);
        hazeBand(g, x0, x1, Y(220), Y(100), '#ff3fa0', 0.18);
      });
    }

    // ---------------- hazy far skyline
    {
      const [x0, x1] = layerSpan(0.06);
      this.haze = paintLayer(0.06, x0, x1, 100, 520, rFar * 0.8, (g, Y) => {
        paintSkyline(g, Y, rng, { x0, x1, base: 100, minH: 70, maxH: 300, minW: 40, maxW: 110, gap: 18,
          body: '#1b0f36', body2: '#24134a', windows: ['#ff7ad0', '#8fe9ff'], windowDensity: 0.4, win: 1.6, litFraction: 0.25 });
        hazeBand(g, x0, x1, Y(380), Y(100), '#3a1656', 0.75);
      });
    }

    // ---------------- far skyline
    const farTowers: { x: number; w: number; h: number }[] = [];
    {
      const [x0, x1] = layerSpan(0.12);
      this.far = paintLayer(0.12, x0, x1, 110, 640, rFar, (g, Y) => {
        paintSkyline(g, Y, rng, { x0, x1, base: 110, minH: 110, maxH: 310, minW: 46, maxW: 120, gap: 30,
          body: '#0b0a20', body2: '#151233', edge: 'rgba(120,90,220,0.25)', windows: ['#9ff0ff', '#ffd08a', '#e6e9ff', '#ff8fd6'],
          windowDensity: 0.75, win: 2.1, litFraction: 0.32, antennaChance: 0.35, out: farTowers });
        hazeBand(g, x0, x1, Y(300), Y(110), '#2b1650', 0.65);
        // a few tiny neon kanji on far towers
        const words = ['薬', '酒', '宿', '夜', '電'];
        g.font = `700 14px ${JP_FONT}`;
        for (let i = 0; i < 9; i++) {
          const tw = farTowers[rng.int(farTowers.length)];
          const col = rng.pick([MAGENTA, CYAN, AMBER]);
          g.shadowColor = col; g.shadowBlur = 8; g.fillStyle = mixWhite(col, 0.3);
          g.fillText(words[i % words.length], tw.x + 4, Y(110 + tw.h * rng.range(0.5, 0.9)));
        }
        g.shadowBlur = 0;
      });
      for (const tw of farTowers) {
        if (tw.h > 240 && this.rng.chance(0.6)) this.blinkers.push({ x: tw.x + tw.w / 2, y: 110 + tw.h + 2, p: 0.12, ph: this.rng.next() * TAU, color: '#ff2a3a', size: 10 });
      }
    }

    // ---------------- mid towers with billboards
    {
      const [x0, x1] = layerSpan(0.3);
      this.mid = paintLayer(0.3, x0, x1, 100, 820, rMid, (g, Y) => {
        const towers: { x: number; w: number; h: number }[] = [];
        paintSkyline(g, Y, rng, { x0, x1, base: 100, minH: 170, maxH: 340, minW: 90, maxW: 190, gap: 80,
          body: '#07081a', body2: '#0f0f2a', edge: 'rgba(255,60,170,0.18)', windows: ['#7ee8ff', '#ffc97a', '#cfd6ff'],
          windowDensity: 0.55, win: 3, litFraction: 0.22, antennaChance: 0.4, out: towers });
        // hero towers (overdraw)
        const hero = (x: number, w: number, h: number) => {
          g.fillStyle = vgrad(g, Y(100 + h), Y(100), [[0, '#121232'], [1, '#06071a']]);
          g.fillRect(x, Y(100 + h), w, h);
          g.fillStyle = 'rgba(140,110,255,0.18)';
          g.fillRect(x, Y(100 + h), 2, h);
          g.fillRect(x + w - 2, Y(100 + h), 2, h);
          // floor bands
          g.fillStyle = 'rgba(160,190,255,0.06)';
          for (let yy = 120; yy < 100 + h; yy += 22) g.fillRect(x, Y(yy), w, 2);
        };
        hero(-560, 300, 560);   // koi tower
        hero(340, 210, 500);    // logo tower
        hero(-40, 110, 520);    // ad strip tower
        // billboard frames
        g.fillStyle = '#05050f';
        g.fillRect(-546, Y(608), 252, 296);
        g.fillRect(356, Y(588), 178, 170);
        g.fillRect(-30, Y(596), 90, 332);
        // vertical neon sign on the koi tower
        const sign = neonText('雷鳴通り', 30, MAGENTA, { vertical: true, ratio: 1 });
        g.drawImage(sign, -604, Y(540), sign.width * 0.9, sign.height * 0.9);
        const sign2 = neonText('新世重工', 22, CYAN, { vertical: true, ratio: 1 });
        g.drawImage(sign2, 548, Y(520), sign2.width * 0.9, sign2.height * 0.9);
        const sign3 = neonText('夜市', 26, AMBER, { ratio: 1 });
        g.drawImage(sign3, 150, Y(400), sign3.width * 0.9, sign3.height * 0.9);
        const sign4 = neonText('電脳街', 20, VIOLET, { ratio: 1 });
        g.drawImage(sign4, -900, Y(380), sign4.width, sign4.height);
        // fog toward the bottom keeps the fighter plane calm
        hazeBand(g, x0, x1, Y(360), Y(100), '#1a1040', 0.85);
        hazeBand(g, x0, x1, Y(240), Y(100), '#0a0820', 0.6);
      });
      this.reflects.push({ x: -410, p: 0.3, color: CYAN, w: 180, a: 0.35, ph: 0 });
      this.reflects.push({ x: 445, p: 0.3, color: MAGENTA, w: 140, a: 0.3, ph: 1 });
      this.reflects.push({ x: -575, p: 0.3, color: MAGENTA, w: 40, a: 0.4, ph: 2 });
      this.reflects.push({ x: 590, p: 0.3, color: CYAN, w: 34, a: 0.35, ph: 3 });
      this.reflects.push({ x: 15, p: 0.3, color: AMBER, w: 60, a: 0.25, ph: 4 });
      this.blinkers.push({ x: -410, y: 100 + 560 + 4, p: 0.3, ph: 0, color: '#ff3040', size: 16 });
      this.blinkers.push({ x: 445, y: 100 + 500 + 4, p: 0.3, ph: 1.5, color: '#ff3040', size: 16 });
      this.blinkers.push({ x: 15, y: 100 + 520 + 4, p: 0.3, ph: 2.7, color: '#ff3040', size: 12 });
    }

    // ---------------- hologram sprites
    this.sprites.koiFrame = hologram(240, 280, rMid, CYAN, (g) => {
      g.strokeStyle = rgba(CYAN, 0.8); g.lineWidth = 2;
      g.shadowColor = CYAN; g.shadowBlur = 12;
      g.strokeRect(2, 2, 236, 276);
      g.shadowBlur = 0;
      g.fillStyle = vgrad(g, 0, 280, [[0, rgba('#0c3a6a', 0.5)], [1, rgba('#2a0d4a', 0.5)]]);
      g.fillRect(4, 4, 232, 272);
      // water ripples rings
      g.strokeStyle = rgba('#7ff6ff', 0.2); g.lineWidth = 1.2;
      for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(120, 190, 26 + i * 20, 9 + i * 6.5, 0, 0, TAU); g.stroke(); }
      g.font = `700 18px ${JP_FONT}`; g.fillStyle = rgba('#bff9ff', 0.85);
      g.fillText('錦鯉 ・ 幸運', 14, 30);
      g.font = `600 11px ${DISPLAY_FONT}`; g.fillStyle = rgba('#bff9ff', 0.6);
      g.fillText('KOI FORTUNE  //  SECTOR 7', 14, 266);
    });
    this.sprites.logo = (() => {
      const c = makeCanvas(200 * rMid, 200 * rMid);
      const g = ctx2d(c);
      g.scale(rMid, rMid);
      neonStroke(g, () => {
        g.beginPath();
        for (let i = 0; i <= 6; i++) {
          const a = (i / 6) * TAU - Math.PI / 2;
          const x = 100 + Math.cos(a) * 70, y = 92 + Math.sin(a) * 70;
          if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
      }, MAGENTA, 4, 16);
      const t = neonText('新世', 52, '#ff7ad0', { ratio: 1, glow: 14 });
      g.drawImage(t, 100 - t.width / 2, 92 - t.height / 2);
      return c;
    })();
    this.sprites.logoText = neonText('SHINSEI HEAVY INDUSTRIES', 13, MAGENTA, { font: DISPLAY_FONT, ratio: rMid, glow: 6, spacing: 1.5 });
    this.sprites.adStrip = (() => {
      const text = 'ネオンテンペスト・今夜開幕・新世重工・雨の夜に輝け・第七区・';
      const t = neonText(text, 34, CYAN, { vertical: true, ratio: rMid, glow: 10 });
      return t;
    })();
    this.sprites.scanBar = fadeSprite('#bdfaff', 0, 0.5, 64, true);
    this.sprites.glowRed = glowSprite('#ff2a3a', 64);
    this.sprites.glowCyan = glowSprite(CYAN, 64);
    this.sprites.glowMag = glowSprite(MAGENTA, 64);
    this.sprites.glowAmber = glowSprite(AMBER, 64);
    this.sprites.beam = coneSprite('#cfe8ff', 160, 900, 0.22);
    this.sprites.puff = glowSprite('#c9c3ff', 64, 1.6);
    this.sprites.reflCyan = fadeSprite(CYAN, 0.55, 0, 128);
    this.sprites.reflMag = fadeSprite(MAGENTA, 0.55, 0, 128);
    this.sprites.reflAmber = fadeSprite(AMBER, 0.5, 0, 128);
    this.sprites.reflViolet = fadeSprite(VIOLET, 0.5, 0, 128);
    this.sprites.car = (() => {
      const c = makeCanvas(150, 50);
      const g = ctx2d(c);
      g.translate(20, 13);
      g.fillStyle = '#0d0e24';
      g.beginPath(); g.moveTo(6, 16); g.lineTo(20, 6); g.lineTo(62, 4); g.lineTo(96, 13); g.lineTo(100, 19); g.lineTo(6, 21); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(140,180,255,0.5)'; g.lineWidth = 1; g.stroke();
      g.fillStyle = 'rgba(120,230,255,0.75)'; g.fillRect(28, 8, 36, 4);
      g.shadowBlur = 14;
      g.fillStyle = '#ff2848'; g.shadowColor = '#ff2848'; g.fillRect(2, 13, 9, 4);
      g.fillStyle = '#f4fdff'; g.shadowColor = '#bff3ff'; g.fillRect(96, 14, 9, 3);
      g.shadowBlur = 0;
      g.fillStyle = 'rgba(255,60,170,0.6)'; g.fillRect(14, 21, 76, 2);
      return c;
    })();
    this.sprites.fog = screenGradient([[0, 'rgba(30,14,60,0)'], [1, 'rgba(30,14,60,0.55)']]);
    this.sprites.vignette = screenGradient([[0, 'rgba(2,2,10,0.55)'], [0.25, 'rgba(2,2,10,0)'], [0.8, 'rgba(2,2,10,0)'], [1, 'rgba(2,2,10,0.45)']]);

    // ---------------- near structures
    {
      const [x0, x1] = layerSpan(0.55);
      this.near = paintLayer(0.55, x0, x1, 40, 720, rNear, (g, Y) => {
        // neighbouring roof parapets
        g.fillStyle = '#060714';
        g.fillRect(x0, Y(150), x1 - x0, 110);
        g.fillStyle = 'rgba(120,140,255,0.12)';
        g.fillRect(x0, Y(150), x1 - x0, 2);
        // water tank on stilts (left)
        const tx = -880;
        g.fillStyle = '#05060f';
        for (const lx of [-40, 40]) g.fillRect(tx + lx - 4, Y(330), 8, 190);
        g.beginPath(); g.moveTo(tx - 44, Y(150)); g.lineTo(tx + 44, Y(330)); g.moveTo(tx + 44, Y(150)); g.lineTo(tx - 44, Y(330));
        g.strokeStyle = '#05060f'; g.lineWidth = 4; g.stroke();
        g.fillStyle = vgrad(g, Y(470), Y(330), [[0, '#14122e'], [1, '#090918']]);
        g.beginPath(); g.moveTo(tx - 70, Y(330)); g.lineTo(tx - 70, Y(450)); g.quadraticCurveTo(tx, Y(500), tx + 70, Y(450)); g.lineTo(tx + 70, Y(330)); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,60,170,0.25)'; g.fillRect(tx + 66, Y(450), 4, 120);
        g.strokeStyle = 'rgba(30,30,70,0.9)'; g.lineWidth = 2;
        for (let yy = 350; yy < 450; yy += 24) { g.beginPath(); g.moveTo(tx - 70, Y(yy)); g.lineTo(tx + 70, Y(yy)); g.stroke(); }
        // lattice antenna mast (right)
        const mx = 860;
        g.strokeStyle = '#07081a'; g.lineWidth = 3;
        g.beginPath();
        g.moveTo(mx - 30, Y(150)); g.lineTo(mx - 6, Y(640)); g.moveTo(mx + 30, Y(150)); g.lineTo(mx + 6, Y(640));
        for (let yy = 150; yy < 620; yy += 34) {
          const k = (yy - 150) / 490, w1 = 30 - 24 * k, w2 = 30 - 24 * ((yy + 34 - 150) / 490);
          g.moveTo(mx - w1, Y(yy)); g.lineTo(mx + w2, Y(yy + 34)); g.moveTo(mx + w1, Y(yy)); g.lineTo(mx - w2, Y(yy + 34));
        }
        g.stroke();
        g.fillStyle = '#07081a'; g.fillRect(mx - 2, Y(720), 4, 90);
        // dish
        g.beginPath(); g.ellipse(mx + 34, Y(470), 26, 34, -0.4, 0, TAU); g.fillStyle = '#0b0c22'; g.fill();
        g.strokeStyle = 'rgba(46,232,255,0.3)'; g.lineWidth = 1.5; g.stroke();
        // giant storm kanji sign in a steel frame (left of center)
        const sx0 = -320, sw = 100, sh = 210, sb = 290;
        g.fillStyle = '#05050d';
        g.fillRect(sx0 - 10, Y(sb + sh + 10), sw + 20, sh + 20);
        g.fillRect(sx0 + 20, Y(sb), 8, sb - 140);
        g.fillRect(sx0 + sw - 28, Y(sb), 8, sb - 140);
        g.strokeStyle = 'rgba(255,47,160,0.35)'; g.lineWidth = 2;
        g.strokeRect(sx0 - 6, Y(sb + sh + 6), sw + 12, sh + 12);
        // small billboard frame (right of center)
        g.fillStyle = '#05050d';
        g.fillRect(220, Y(470), 230, 120);
        g.fillRect(250, Y(350), 8, 200);
        g.fillRect(410, Y(350), 8, 200);
        const bb = neonText('TEMPEST', 44, CYAN, { font: DISPLAY_FONT, weight: '800', ratio: 1, glow: 14, spacing: 4 });
        g.drawImage(bb, 335 - bb.width * 0.42, Y(445), bb.width * 0.84, bb.height * 0.84);
        g.fillStyle = rgba(CYAN, 0.5);
        g.font = `600 12px ${DISPLAY_FONT}`;
        g.fillText('UNDERGROUND TOURNAMENT  //  TONIGHT', 238, Y(362));
        // pipes along the parapet
        g.fillStyle = '#0a0b1c';
        g.fillRect(x0, Y(176), x1 - x0, 8);
        g.fillRect(x0, Y(196), x1 - x0, 5);
        hazeBand(g, x0, x1, Y(260), Y(150), '#0c0a24', 0.6);
      });
      this.flicks.push({ img: neonText('嵐', 120, MAGENTA, { ratio: rNear * 0.8, glow: 26 }), x: -270, y: 396, p: 0.55, w: 128, h: 0, seed: 1.7 });
      this.reflects.push({ x: -270, p: 0.55, color: MAGENTA, w: 110, a: 0.45, ph: 5 });
      this.reflects.push({ x: 335, p: 0.55, color: CYAN, w: 160, a: 0.3, ph: 6 });
      this.blinkers.push({ x: 860, y: 724, p: 0.55, ph: 0.4, color: '#ff3040', size: 22 });
      this.blinkers.push({ x: 860, y: 520, p: 0.55, ph: 2.4, color: '#ff3040', size: 14 });
    }

    // ---------------- railing, AC units, stair hut (stands on the floor's back edge)
    {
      const [x0, x1] = layerSpan(0.8);
      const base = 78;
      this.rail = paintLayer(0.8, x0, x1, 30, 330, rNear, (g, Y) => {
        // AC units
        const ac = (x: number, w: number, h: number) => {
          g.fillStyle = vgrad(g, Y(base + h), Y(base), [[0, '#1c1d36'], [1, '#0b0c1c']]);
          g.fillRect(x, Y(base + h), w, h);
          g.fillStyle = 'rgba(140,170,255,0.18)';
          g.fillRect(x, Y(base + h), w, 2);
          g.fillStyle = '#05060f';
          const r = Math.min(w, h) * 0.32;
          g.beginPath(); g.arc(x + w * 0.3, Y(base + h * 0.5), r, 0, TAU); g.fill();
          g.strokeStyle = 'rgba(120,140,220,0.3)'; g.lineWidth = 1;
          for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x + w * 0.3, Y(base + h * 0.5), r * (0.3 + k * 0.22), 0, TAU); g.stroke(); }
          g.fillStyle = 'rgba(80,90,150,0.25)';
          for (let k = 0; k < 6; k++) g.fillRect(x + w * 0.62, Y(base + h * 0.8) + k * h * 0.11, w * 0.3, 2);
        };
        ac(-620, 110, 70);
        ac(420, 130, 78);
        ac(-1100, 120, 66);
        ac(980, 100, 60);
        // vent stacks
        for (const vx of [-360, 610, -1240]) {
          g.fillStyle = '#0d0e20';
          g.fillRect(vx, Y(base + 120), 22, 120);
          g.fillRect(vx - 6, Y(base + 128), 34, 10);
          this.vents.push({ x: vx + 11, y: base + 132, rate: 0.12, acc: 0 });
        }
        // stairwell hut (right)
        g.fillStyle = vgrad(g, Y(base + 190), Y(base), [[0, '#14142c'], [1, '#08091a']]);
        g.fillRect(1120, Y(base + 190), 230, 190);
        g.fillStyle = '#04040c'; g.fillRect(1180, Y(base + 120), 64, 120);
        g.fillStyle = rgba('#ffcf7a', 0.6); g.fillRect(1186, Y(base + 114), 52, 4);
        const ex = neonText('非常口', 14, '#6dff9e', { ratio: 1, glow: 6 });
        g.drawImage(ex, 1190, Y(base + 160));
        // railing: posts + rails + LED strip
        g.fillStyle = '#0a0b1a';
        for (let x = Math.ceil(x0 / 90) * 90; x < x1; x += 90) g.fillRect(x - 3, Y(base + 92), 6, 92);
        g.fillRect(x0, Y(base + 94), x1 - x0, 6);
        g.fillRect(x0, Y(base + 50), x1 - x0, 3);
        g.fillRect(x0, Y(base + 18), x1 - x0, 3);
        g.shadowColor = CYAN; g.shadowBlur = 8;
        g.fillStyle = rgba(CYAN, 0.75);
        g.fillRect(x0, Y(base + 95), x1 - x0, 1.5);
        g.shadowBlur = 0;
        // hazard stripe at the base of the railing
        g.fillStyle = '#121220';
        g.fillRect(x0, Y(base + 8), x1 - x0, 12);
        g.fillStyle = 'rgba(255,190,60,0.32)';
        for (let x = x0; x < x1; x += 28) {
          g.beginPath(); g.moveTo(x, Y(base + 8)); g.lineTo(x + 12, Y(base + 8)); g.lineTo(x + 20, Y(base - 4)); g.lineTo(x + 8, Y(base - 4)); g.fill();
        }
      });
      this.blinkers.push({ x: 1300, y: base + 196, p: 0.8, ph: 1, color: '#ff3040', size: 14 });
    }

    // ---------------- floor
    const puddles: { x: number; v: number; rx: number; rv: number }[] = [];
    this.floor = paintFloor(-1500, 1500, 78, 112, Math.min(pixelRatio, 1.25) * (quality === 0 ? 0.75 : 1), 0.34, (g, F) => {
      const D = F.back + F.front;
      g.fillStyle = vgrad(g, 0, D, [[0, '#121329'], [0.4, '#0b0c1f'], [1, '#07081a']]);
      g.fillRect(-1500, 0, 3000, D);
      // concrete slabs
      g.strokeStyle = 'rgba(120,130,200,0.10)';
      g.lineWidth = 1;
      for (let x = -1500; x <= 1500; x += 120) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, D); g.stroke(); }
      for (const v of [14, 34, 60, 92, 130, 172]) { g.beginPath(); g.moveTo(-1500, v); g.lineTo(1500, v); g.stroke(); }
      // grime noise
      const nr = new Rng(55);
      for (let i = 0; i < 2600; i++) {
        g.fillStyle = nr.chance(0.5) ? 'rgba(0,0,0,0.18)' : 'rgba(140,150,220,0.035)';
        g.fillRect(nr.range(-1500, 1500), nr.range(0, D), nr.range(2, 14), nr.range(1, 3));
      }
      // helipad: worn yellow circle and H, flattened for perspective
      const cy = F.back + 12;
      g.lineWidth = 7;
      g.strokeStyle = 'rgba(255,196,64,0.28)';
      g.beginPath(); g.ellipse(0, cy, 300, 46, 0, 0, TAU); g.stroke();
      g.lineWidth = 2;
      g.strokeStyle = 'rgba(255,196,64,0.18)';
      g.beginPath(); g.ellipse(0, cy, 340, 54, 0, 0, TAU); g.stroke();
      g.fillStyle = 'rgba(255,196,64,0.24)';
      g.fillRect(-80, cy - 30, 26, 60);
      g.fillRect(54, cy - 30, 26, 60);
      g.fillRect(-54, cy - 6, 108, 12);
      g.font = `800 22px ${DISPLAY_FONT}`;
      g.fillStyle = 'rgba(255,196,64,0.2)';
      g.fillText('88F', 360, cy + 40);
      g.fillText('88F', -420, cy - 22);
      // edge lights at the back of the floor
      for (let x = -1480; x < 1500; x += 160) {
        g.fillStyle = 'rgba(46,232,255,0.5)';
        g.fillRect(x, 3, 10, 3);
      }
      // puddles: glossy darker ellipses with neon tints
      const pr = new Rng(91);
      for (let i = 0; i < 22; i++) {
        const x = pr.range(-1400, 1400), v = pr.range(18, D - 8), rx = pr.range(40, 150), rv = rx * 0.13 * (0.7 + v / D);
        const col = pr.pick([CYAN, MAGENTA, VIOLET]);
        const gr = g.createRadialGradient(x, v, 0, x, v, rx);
        gr.addColorStop(0, rgba(col, 0.16));
        gr.addColorStop(0.7, rgba('#04040c', 0.35));
        gr.addColorStop(1, rgba('#04040c', 0));
        g.fillStyle = gr;
        g.save(); g.translate(x, v); g.scale(1, rv / rx); g.translate(-x, -v);
        g.beginPath(); g.arc(x, v, rx, 0, TAU); g.fill();
        g.restore();
        puddles.push({ x, v, rx, rv });
      }
      // glossy sheen near the back (reflected city glow)
      g.fillStyle = vgrad(g, 0, 50, [[0, 'rgba(120,70,200,0.22)'], [1, 'rgba(120,70,200,0)']]);
      g.fillRect(-1500, 0, 3000, 50);
    });

    // ---------------- particles
    const q = [0.45, 0.75, 1][quality] ?? 1;
    this.rain = new Rain([
      { count: Math.round(260 * q), p: 0.3, speed: 15, len: 16, width: 1, color: '#9aa8ff', alpha: 0.22 },
      { count: Math.round(200 * q), p: 0.7, speed: 21, len: 26, width: 1.2, color: '#b8d6ff', alpha: 0.3 },
      { count: Math.round(90 * q), p: 1.2, speed: 30, len: 46, width: 1.6, color: '#d6ecff', alpha: 0.38 },
      { count: Math.round(22 * q), p: 1.8, speed: 40, len: 90, width: 2.6, color: '#e8f4ff', alpha: 0.2 },
    ], 0.16, 4242, 2.2 * q);
    this.ripples = new Ripples(Math.round(70 * q) + 10, 99, puddles);
    this.puffs = new Puffs(40, 31, this.sprites.puff);
    // flying cars
    for (let i = 0; i < 9; i++) {
      this.cars.push({ lane: i % 3, x: this.rng.range(-1400, 1400), speed: this.rng.range(2.2, 5.5), dir: i % 2 ? 1 : -1, color: i % 3 === 0 ? MAGENTA : CYAN });
    }
    this.layers = [this.sky, this.haze, this.far, this.mid, this.near, this.rail];
    this.ready = true;
  }

  update(t: number, cam: Camera): void {
    if (!this.ready) return;
    const dt = 1 / 60;
    const floorTop = sy(cam, 0) - this.floor.back * cam.zoom;
    this.rain.gust = Math.sin(t * 0.37) * 0.06 + Math.sin(t * 1.3) * 0.02;
    this.rain.update(cam, floorTop);
    this.ripples.update(1.4 * (this.quality + 1) / 3);
    for (const v of this.vents) {
      v.acc += v.rate;
      while (v.acc >= 1) { v.acc -= 1; this.puffs.emit(v.x, v.y, 46, 0.25, 0.7); }
    }
    this.puffs.update(0.25 + this.rain.gust * 3);
    for (const c of this.cars) {
      c.x += c.speed * c.dir;
      if (c.x > 1500) c.x = -1500;
      if (c.x < -1500) c.x = 1500;
    }
    // lightning
    if (this.lightning > 0) this.lightning -= dt;
    this.lightningNext -= dt;
    if (this.lightningNext <= 0) this.strike();
    if (this.superPulse > 0) this.superPulse = Math.max(0, this.superPulse - dt * 1.5);
  }

  private strike(): void {
    this.lightningNext = this.rng.range(7, 16);
    this.lightning = 0.55;
    this.boltX = this.rng.range(-500, 500);
    const pts: number[] = [];
    let x = 0, y = 820;
    while (y > 300) {
      pts.push(x, y);
      x += this.rng.range(-26, 26);
      y -= this.rng.range(18, 44);
    }
    pts.push(x, 300);
    this.bolt = pts;
  }

  drawBack(ctx: CanvasRenderingContext2D, cam: Camera, t: number): void {
    if (!this.ready) { ctx.fillStyle = '#05060f'; ctx.fillRect(0, 0, W, H); return; }
    const S = this.sprites;
    ctx.fillStyle = '#03030c';
    ctx.fillRect(0, 0, W, H);
    drawLayer(ctx, this.sky, cam);
    drawLayer(ctx, this.haze, cam);
    this.drawLightning(ctx, cam);
    drawLayer(ctx, this.far, cam);
    // searchlights from behind the far skyline
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 2; i++) {
      const bx = psx(cam, i === 0 ? -520 : 600, 0.1), by = psy(cam, 140, 0.1);
      const ang = Math.PI + Math.sin(t * (0.21 + i * 0.07) + i * 2) * 0.42 + (i === 0 ? -0.15 : 0.15);
      ctx.globalAlpha = 0.55;
      drawRotated(ctx, S.beam, bx, by, 150, 900 * parallaxZoom(cam, 0.1), ang, 0.5, 0);
    }
    ctx.globalAlpha = 1;
    this.drawBlinkers(ctx, cam, 0.12, t);
    ctx.globalCompositeOperation = 'source-over';
    drawLayer(ctx, this.mid, cam);
    this.drawHolograms(ctx, cam, t);
    this.drawCars(ctx, cam);
    // rain far layer
    this.rain.draw(ctx, 0, 1);
    drawLayer(ctx, this.near, cam);
    ctx.globalCompositeOperation = 'lighter';
    for (const f of this.flicks) {
      const zp = parallaxZoom(cam, f.p);
      const w = f.w * zp * 0.95, h = (f.img.height / f.img.width) * w;
      ctx.globalAlpha = flicker(t, f.seed) * (0.85 + this.superPulse * 0.3);
      ctx.drawImage(f.img, psx(cam, f.x, f.p) - w / 2, psy(cam, f.y, f.p) - h / 2, w, h);
    }
    ctx.globalAlpha = 1;
    this.drawBlinkers(ctx, cam, 0.55, t);
    ctx.globalCompositeOperation = 'source-over';
    this.rain.draw(ctx, 1, 2);
    drawLayer(ctx, this.rail, cam);
    this.puffs.draw(ctx, cam, 0.8, 0.35);
    ctx.globalCompositeOperation = 'lighter';
    this.drawBlinkers(ctx, cam, 0.8, t);
    ctx.globalCompositeOperation = 'source-over';
    drawFloor(ctx, this.floor, cam);
    this.drawReflections(ctx, cam, t);
    this.ripples.draw(ctx, cam, this.floor, '#b9c8ff');
    this.rain.drawSplashes(ctx, '#c9d8ff');
  }

  drawFront(ctx: CanvasRenderingContext2D, cam: Camera, t: number): void {
    if (!this.ready) return;
    this.rain.draw(ctx, 2, 4);
    // bottom fog + vignette
    drawBand(ctx, this.sprites.vignette, 0, H, 1);
    if (this.lightning > 0 && !this.opts.flashReduction) {
      const k = this.lightning / 0.55;
      const a = (k > 0.8 ? 0.22 : k > 0.6 ? 0.04 : k > 0.45 ? 0.15 : 0) * 1;
      if (a > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = rgbaCached('#b8c8ff', a);
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    void t;
  }

  private drawLightning(ctx: CanvasRenderingContext2D, cam: Camera): void {
    if (this.lightning <= 0 || this.bolt.length < 4) return;
    const k = this.lightning / 0.55;
    const vis = k > 0.8 || (k > 0.45 && k < 0.6);
    if (!vis) return;
    const p = 0.03;
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath();
    for (let i = 0; i < this.bolt.length; i += 2) {
      const X = psx(cam, this.boltX + this.bolt[i], p), Yv = psy(cam, this.bolt[i + 1], p);
      if (i === 0) ctx.moveTo(X, Yv); else ctx.lineTo(X, Yv);
    }
    const dim = this.opts.flashReduction ? 0.35 : 1;
    ctx.strokeStyle = rgbaCached('#9fb4ff', 0.35 * dim);
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.strokeStyle = rgbaCached('#f2f5ff', 0.9 * dim);
    ctx.lineWidth = 2;
    ctx.stroke();
    // cloud glow around the bolt
    const gx = psx(cam, this.boltX, p), gy = psy(cam, 640, p);
    ctx.globalAlpha = 0.5 * dim;
    ctx.drawImage(this.sprites.glowCyan, gx - 260, gy - 180, 520, 360);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawBlinkers(ctx: CanvasRenderingContext2D, cam: Camera, p: number, t: number): void {
    const img = this.sprites.glowRed;
    for (const b of this.blinkers) {
      if (b.p !== p) continue;
      const on = Math.sin(t * 2.2 + b.ph) > 0.55;
      if (!on) continue;
      const s = b.size * parallaxZoom(cam, p);
      ctx.drawImage(img, psx(cam, b.x, p) - s, psy(cam, b.y, p) - s, s * 2, s * 2);
    }
  }

  private drawHolograms(ctx: CanvasRenderingContext2D, cam: Camera, t: number): void {
    const S = this.sprites;
    const p = 0.3;
    const zp = parallaxZoom(cam, p);
    ctx.globalCompositeOperation = 'lighter';
    // ---- koi billboard
    {
      const fx = psx(cam, -540, p), fy = psy(cam, 602, p);
      const fw = 240 * zp, fh = 280 * zp;
      const pad = 24 * zp;
      const fl = flicker(t, 3.3, 0.7);
      ctx.globalAlpha = 0.85 * fl;
      ctx.drawImage(S.koiFrame, fx - pad, fy - pad, fw + pad * 2, fh + pad * 2);
      // koi swimming in a lazy figure-eight
      const cx = fx + fw * 0.5 + Math.sin(t * 0.5) * fw * 0.26;
      const cy = fy + fh * 0.55 + Math.sin(t * 1.0) * fh * 0.2;
      const heading = Math.atan2(Math.cos(t * 1.0) * fh * 0.2, Math.cos(t * 0.5) * fw * 0.26 * 0.5);
      ctx.globalAlpha = 0.9 * fl;
      this.drawKoi(ctx, cx, cy, heading, 0.95 * zp, t);
      // second, smaller koi
      const cx2 = fx + fw * 0.5 - Math.sin(t * 0.43 + 2) * fw * 0.3;
      const cy2 = fy + fh * 0.4 - Math.sin(t * 0.86 + 2) * fh * 0.18;
      const h2 = Math.atan2(-Math.cos(t * 0.86 + 2) * fh * 0.18 * 0.86, -Math.cos(t * 0.43 + 2) * fw * 0.3 * 0.43);
      ctx.globalAlpha = 0.6 * fl;
      this.drawKoi(ctx, cx2, cy2, h2, 0.6 * zp, t + 1.3);
      // moving scan bar
      const sbY = fy + ((t * 60) % (fh + 40)) - 20;
      ctx.globalAlpha = 0.25 * fl;
      ctx.drawImage(S.scanBar, fx, sbY, fw, 18 * zp);
    }
    // ---- rotating logo
    {
      const cx = psx(cam, 445, p), cy = psy(cam, 512, p);
      const ang = t * 0.9 + this.superPulse * 4;
      const sx = Math.cos(ang);
      const s = 150 * zp;
      ctx.globalAlpha = 0.9 * flicker(t, 7.1);
      if (Math.abs(sx) > 0.04) ctx.drawImage(S.logo, cx - (s * Math.abs(sx)) / 2, cy - s / 2, s * Math.abs(sx), s);
      ctx.globalAlpha = 0.35;
      ctx.drawImage(S.glowMag, cx - s * 0.7, cy - s * 0.7, s * 1.4, s * 1.4);
      ctx.globalAlpha = 0.85;
      const lw = S.logoText.width / S.logoText.height;
      const th = 22 * zp;
      ctx.drawImage(S.logoText, cx - (th * lw) / 2, psy(cam, 432, p), th * lw, th);
    }
    // ---- scrolling vertical ad strip (wraps)
    {
      const x = psx(cam, -26, p), top = psy(cam, 592, p);
      const w = 82 * zp, h = 324 * zp;
      const img = S.adStrip;
      const scale = w / img.width * 1.0;
      const imgH = img.height * scale;
      const off = (t * 40 * zp) % imgH;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, top, w, h);
      ctx.clip();
      ctx.globalAlpha = 0.9 * flicker(t, 5.5);
      ctx.drawImage(img, x, top - off, w, imgH);
      ctx.drawImage(img, x, top - off + imgH, w, imgH);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    this.drawBlinkers(ctx, cam, 0.3, t);
    ctx.globalCompositeOperation = 'source-over';
  }

  /** Holographic koi: an undulating body made of a tapered spine, tail and fins. */
  private drawKoi(ctx: CanvasRenderingContext2D, x: number, y: number, heading: number, s: number, t: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(heading);
    ctx.scale(s, s);
    const N = 9;
    const seg = 9;
    // spine from head (i=0, +x) to tail
    const sw = (i: number) => Math.sin(t * 5 - i * 0.7) * (i * 1.4);
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const w = i === 0 ? 7 : 13 * Math.sin(((i + 0.6) / (N + 1.2)) * Math.PI) * (1 - i / (N * 1.6));
      const px = 40 - i * seg, py = sw(i) - w;
      if (i === 0) ctx.moveTo(px + 6, sw(0)); else ctx.lineTo(px, py);
    }
    for (let i = N; i >= 1; i--) {
      const w = 13 * Math.sin(((i + 0.6) / (N + 1.2)) * Math.PI) * (1 - i / (N * 1.6));
      ctx.lineTo(40 - i * seg, sw(i) + w);
    }
    ctx.closePath();
    ctx.fillStyle = '#ff8a3a';
    ctx.fill();
    ctx.strokeStyle = '#8ff6ff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // white patches
    ctx.fillStyle = 'rgba(255,240,230,0.7)';
    ctx.beginPath(); ctx.ellipse(26, sw(1.5) - 2, 7, 4, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(6, sw(4), 6, 3.5, 0, 0, TAU); ctx.fill();
    // tail fin
    const tx = 40 - N * seg, ty = sw(N);
    const fl = Math.sin(t * 5 - N * 0.7) * 8;
    ctx.beginPath();
    ctx.moveTo(tx + 4, ty);
    ctx.quadraticCurveTo(tx - 16, ty - 18 + fl, tx - 26, ty - 14 + fl);
    ctx.quadraticCurveTo(tx - 14, ty + fl * 0.3, tx - 26, ty + 14 + fl);
    ctx.quadraticCurveTo(tx - 16, ty + 18 + fl, tx + 4, ty);
    ctx.fillStyle = 'rgba(255,170,110,0.6)';
    ctx.fill();
    ctx.stroke();
    // pectoral fins
    ctx.fillStyle = 'rgba(160,240,255,0.5)';
    const pf = Math.sin(t * 6) * 4;
    ctx.beginPath(); ctx.moveTo(24, sw(2) + 8); ctx.quadraticCurveTo(18, sw(2) + 20 + pf, 10, sw(2) + 16); ctx.fill();
    ctx.beginPath(); ctx.moveTo(24, sw(2) - 8); ctx.quadraticCurveTo(18, sw(2) - 20 - pf, 10, sw(2) - 16); ctx.fill();
    ctx.restore();
  }

  private drawCars(ctx: CanvasRenderingContext2D, cam: Camera): void {
    const lanes = [[0.36, 450], [0.42, 545], [0.47, 360]];
    const img = this.sprites.car;
    ctx.beginPath();
    for (const c of this.cars) {
      const [p, y] = lanes[c.lane];
      const X = psx(cam, c.x, p), Yv = psy(cam, y, p);
      if (X < -120 || X > W + 120) continue;
      const len = 40 + c.speed * 14;
      ctx.moveTo(X - c.dir * 30, Yv);
      ctx.lineTo(X - c.dir * (30 + len), Yv + 1);
    }
    ctx.strokeStyle = rgbaCached('#ff3a5a', 0.35);
    ctx.lineWidth = 2;
    ctx.globalCompositeOperation = 'lighter';
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    for (const c of this.cars) {
      const [p, y] = lanes[c.lane];
      const zp = parallaxZoom(cam, p) * (0.45 + p * 0.5);
      const X = psx(cam, c.x, p), Yv = psy(cam, y, p);
      if (X < -120 || X > W + 120) continue;
      const w = 150 * zp, h = 50 * zp;
      if (c.dir > 0) ctx.drawImage(img, X - w / 2, Yv - h / 2, w, h);
      else {
        ctx.save();
        ctx.translate(X, Yv);
        ctx.scale(-1, 1);
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
        ctx.restore();
      }
    }
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
      const img = r.color === CYAN ? S.reflCyan : r.color === MAGENTA ? S.reflMag : r.color === AMBER ? S.reflAmber : S.reflViolet;
      ctx.globalAlpha = r.a * (0.75 + 0.25 * Math.sin(t * 2.3 + r.ph)) * (1 + this.superPulse * 0.5);
      ctx.drawImage(img, X - w / 2, top, w, h);
    }
    // lightning reflection
    if (this.lightning > 0.25 && !this.opts.flashReduction) {
      ctx.globalAlpha = 0.18;
      ctx.drawImage(S.reflCyan, 0, top, W, h);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  onEvent(kind: string, intensity: number): void {
    if (kind === 'super') this.superPulse = Math.min(1, this.superPulse + 0.8 * intensity);
    if (kind === 'ko' && this.lightning <= 0) this.strike();
    if (kind === 'round_start') this.lightningNext = Math.min(this.lightningNext, 1.2);
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

