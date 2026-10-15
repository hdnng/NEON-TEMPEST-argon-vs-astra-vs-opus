export const STAGES = [
  {
    id: "ame",
    name: "AME DISTRICT",
    subtitle: "AFTER HOURS · LOWER NEO-KYOTO",
    label: "01",
    accent: "#57e6e9",
    bpm: 112,
    notes: [38, 41, 45, 48],
    description: "Rain on asphalt. Neon in your veins.",
  },
  {
    id: "sanctum",
    name: "SKYLINE SANCTUM",
    subtitle: "ABOVE THE CLOUDS · EASTERN SPIRE",
    label: "02",
    accent: "#fc81b5",
    bpm: 100,
    notes: [42, 45, 49, 52],
    description: "A quiet shrine above a restless city.",
  },
  {
    id: "terminal",
    name: "TERMINAL 09",
    subtitle: "LAST TRAIN · UNDERCITY TRANSIT",
    label: "03",
    accent: "#a6e5a1",
    bpm: 124,
    notes: [34, 38, 41, 45],
    description: "No destination. Nothing left to lose.",
  },
];
function rand(n: number) {
  return ((Math.sin(n * 127.1 + 311.7) * 43758.5453) % 1) * 0.5 + 0.5;
}
function glow(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  col: string,
) {
  c.fillStyle = col;
  c.shadowColor = col;
  c.shadowBlur = 18;
  c.fillRect(x, y, w, h);
  c.shadowBlur = 0;
}
function sign(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  col: string,
  vertical = false,
) {
  c.fillStyle = "#111c36";
  c.fillRect(x - 6, y - 6, w + 12, h + 12);
  c.strokeStyle = col;
  c.shadowColor = col;
  c.shadowBlur = 12;
  c.lineWidth = 2;
  c.strokeRect(x, y, w, h);
  c.fillStyle = col;
  c.font = `700 ${vertical ? 29 : Math.min(30, h * 0.5)}px monospace`;
  c.textAlign = "center";
  if (vertical) {
    [...text].forEach((s, i) => c.fillText(s, x + w / 2, y + 37 + i * 36));
  } else c.fillText(text, x + w / 2, y + h * 0.65);
  c.shadowBlur = 0;
}
export class StageArt {
  layers: CanvasImageSource[][] = [];
  composites: HTMLCanvasElement[] = [];
  snapshots: Array<ImageBitmap | undefined> = [];
  pans: number[] = [NaN, NaN, NaN];
  versions: number[] = [0, 0, 0];
  ripples: CanvasImageSource[] = [];
  effects = { rain: true, ripples: true, beam: true, petals: true };
  constructor() {
    for (let i = 0; i < 12; i++) {
      const ripple = document.createElement("canvas");
      ripple.width = 64;
      ripple.height = 24;
      const rc = ripple.getContext("2d")!,
        phase = i / 12;
      rc.strokeStyle = `rgba(127,218,231,${(1 - phase) * 0.14})`;
      rc.lineWidth = 0.8;
      rc.beginPath();
      rc.ellipse(32, 12, phase * 21, phase * 3, 0, 0, 7);
      rc.stroke();
      this.ripples.push(ripple);
      void createImageBitmap(ripple).then((bitmap) => {
        this.ripples[i] = bitmap;
      });
    }
    for (let stage = 0; stage < 3; stage++) {
      this.layers[stage] = [];
      for (let layer = 0; layer < 2; layer++) {
        const canvas = document.createElement("canvas");
        canvas.width = 1800;
        canvas.height = 720;
        const c = canvas.getContext("2d")!;
        this.paint(c, stage, layer);
        this.layers[stage].push(canvas);
        // Snapshot the procedural painting. Software Chromium can otherwise
        // replay the source canvas's vector display list on every parallax blit.
        void createImageBitmap(canvas).then((bitmap) => {
          this.layers[stage][layer] = bitmap;
        });
      }
    }
  }
  paint(c: CanvasRenderingContext2D, s: number, l: number) {
    const accent = STAGES[s].accent;
    if (l === 0) {
      const sky = c.createLinearGradient(0, 0, 0, 600);
      sky.addColorStop(0, s === 1 ? "#14152f" : "#071226");
      sky.addColorStop(0.62, s === 1 ? "#3b2546" : "#17243b");
      sky.addColorStop(1, "#172134");
      c.fillStyle = sky;
      c.fillRect(0, 0, 1800, 720);
      const haze = c.createRadialGradient(1050, 270, 10, 1050, 270, 650);
      haze.addColorStop(0, s === 1 ? "#a7686e66" : "#448caa50");
      haze.addColorStop(1, "#00000000");
      c.fillStyle = haze;
      c.fillRect(0, 0, 1800, 650);
      c.fillStyle = s === 1 ? "#f3c5b4" : "#86a9cb";
      c.shadowColor = c.fillStyle;
      c.shadowBlur = 35;
      c.beginPath();
      c.arc(s === 1 ? 1000 : 1150, 135, s === 1 ? 64 : 43, 0, 7);
      c.fill();
      c.shadowBlur = 0;
      for (let n = 0; n < 38; n++) {
        const x = n * 51 - 10,
          h = 80 + rand(n + 44) * 280,
          w = 38 + rand(n + 3) * 38;
        c.fillStyle = n % 2 ? "#122239" : "#101c32";
        c.fillRect(x, 440 - h, w, h);
        for (let j = 0; j < h / 15; j++)
          for (let k = 0; k < w / 12; k++)
            if (rand(n * 190 + j * 12 + k) > 0.53) {
              c.fillStyle = rand(n * 94 + j) > 0.6 ? "#65c7d246" : "#d69ca52b";
              c.fillRect(x + k * 12 + 5, 445 - h + j * 15, 3, 5);
            }
      }
      c.strokeStyle = "#64778835";
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(0, 342);
      c.bezierCurveTo(500, 225, 1100, 365, 1800, 270);
      c.stroke();
      return;
    }
    if (s === 0) {
      for (const [x, w, h] of [
        [-10, 220, 440],
        [220, 155, 320],
        [1380, 240, 460],
        [1600, 230, 380],
      ]) {
        c.fillStyle = "#0b1527";
        c.fillRect(x, 520 - h, w, h);
        c.fillStyle = "#20334b";
        c.fillRect(x + 6, 524 - h, w - 12, 6);
        for (let j = 0; j < h / 45; j++) {
          c.fillStyle = "#1e3047";
          c.fillRect(x + 10, 535 - h + j * 45, w - 20, 2);
          for (let k = 0; k < 3; k++) {
            c.fillStyle = j % 3 === 0 ? "#416074" : "#14283c";
            c.fillRect(x + 15 + k * (w / 3), 544 - h + j * 45, w / 3 - 24, 25);
          }
        }
      }
      sign(c, 74, 142, 58, 214, "雨夜市場", "#fb6bba", true);
      sign(c, 1490, 100, 64, 246, "地下闘技場", "#58e9df", true);
      sign(c, 248, 270, 110, 48, "24 / 7", "#eeb97c");
      sign(c, 1290, 328, 160, 48, "夜行 · YAKŌ", "#8da5ff");
      for (const x of [382, 1295]) {
        c.fillStyle = "#263347";
        c.fillRect(x, 235, 9, 337);
        c.fillRect(x - 22, 232, 55, 8);
        glow(c, x - 18, 239, 45, 4, "#c4e7f1");
      }
      c.strokeStyle = "#050c1b";
      c.lineWidth = 4;
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.moveTo(0, 120 + i * 50);
        c.quadraticCurveTo(800, 380 + i * 12, 1800, 80 + i * 30);
        c.stroke();
      }
      sign(
        c,
        565,
        330,
        670,
        53,
        "N E O - K Y O T O   /   U N D E R G R O U N D",
        "#8fbfd4",
      );
      c.fillStyle = "#0c192b";
      c.fillRect(400, 430, 890, 134);
      for (let i = 0; i < 16; i++) {
        const x = 420 + i * 54;
        c.fillStyle = "#07101f";
        c.beginPath();
        c.arc(x, 447 + rand(i) * 10, 8, 0, 7);
        c.fill();
        c.fillRect(x - 9, 456, 18, 64);
        c.fillStyle = i % 3 ? "#1f4252" : "#4d2549";
        c.fillRect(x - 5, 463, 10, 20);
      }
    } else if (s === 1) {
      c.fillStyle = "#1d2336";
      c.fillRect(0, 498, 1800, 76);
      c.strokeStyle = "#8892a455";
      for (let i = 0; i < 28; i++) {
        c.lineWidth = 4;
        c.beginPath();
        c.moveTo(i * 70, 502);
        c.lineTo(i * 70, 448);
        c.stroke();
      }
      c.fillStyle = "#1d263d";
      c.fillRect(0, 448, 1800, 7);
      for (const x of [390, 1390]) {
        c.fillStyle = "#351c35";
        c.fillRect(x - 13, 286, 26, 280);
        glow(c, x - 3, 302, 3, 250, "#ee779e");
      }
      c.fillStyle = "#4a2541";
      c.fillRect(325, 273, 1145, 24);
      c.fillRect(357, 321, 1080, 17);
      polyRoof(c);
      for (const x of [200, 1550]) {
        c.strokeStyle = "#242335";
        c.lineWidth = 25;
        c.beginPath();
        c.moveTo(x, 570);
        c.bezierCurveTo(x + 30, 430, x - 10, 300, x + 70, 210);
        c.stroke();
        for (let i = 0; i < 45; i++) {
          c.fillStyle = i % 2 ? "#6b385a80" : "#9e527480";
          c.beginPath();
          c.arc(
            x - 90 + rand(i * 8 + x) * 250,
            225 + rand(i * 9 + x) * 155,
            20 + rand(i) * 22,
            0,
            7,
          );
          c.fill();
        }
      }
      for (const x of [520, 1250]) {
        c.fillStyle = "#2f263c";
        c.fillRect(x - 12, 452, 24, 105);
        glow(c, x - 22, 434, 44, 35, "#ec9ba2");
      }
    } else {
      c.fillStyle = "#0a1824";
      c.fillRect(0, 95, 1800, 96);
      for (let x = 0; x < 1800; x += 180) {
        c.fillStyle = "#273b48";
        c.fillRect(x, 100, 9, 430);
        c.fillRect(x, 130, 180, 6);
        glow(c, x + 20, 161, 120, 3, "#8cddd8");
      }
      c.fillStyle = "#1b3443";
      c.fillRect(70, 335, 1660, 170);
      c.fillStyle = "#294c59";
      c.fillRect(70, 338, 1660, 6);
      for (let i = 0; i < 13; i++) {
        c.fillStyle = "#071522";
        c.fillRect(100 + i * 123, 361, 98, 65);
        c.fillStyle = "#77b6c638";
        c.fillRect(105 + i * 123, 366, 88, 54);
        c.fillStyle = "#779498";
        c.fillRect(100 + i * 123, 441, 95, 2);
      }
      glow(c, 70, 475, 1660, 5, "#a2d890");
      sign(c, 670, 206, 450, 72, "09  /  LAST DEPARTURE", "#ade8ac");
      sign(c, 300, 222, 170, 52, "NO EXIT", "#e49b7b");
      c.fillStyle = "#0c1826";
      c.fillRect(0, 507, 1800, 63);
      for (let i = 0; i < 80; i++) {
        c.fillStyle = "#c6caa3";
        c.fillRect(i * 25, 540, 15, 5);
      }
    }
    const ground = c.createLinearGradient(0, 565, 0, 720);
    ground.addColorStop(0, "#15253b");
    ground.addColorStop(1, "#090e20");
    c.fillStyle = ground;
    c.fillRect(0, 566, 1800, 154);
    c.fillStyle = accent + "45";
    c.fillRect(0, 567, 1800, 2);
    c.strokeStyle = "#59829327";
    c.lineWidth = 1;
    for (let i = 0; i < 22; i++) {
      c.beginPath();
      c.moveTo(900 + (i - 11) * 55, 568);
      c.lineTo(900 + (i - 11) * 180, 720);
      c.stroke();
    }
    for (let i = 0; i < 5; i++) {
      c.beginPath();
      c.moveTo(0, 576 + i * i * 7);
      c.lineTo(1800, 576 + i * i * 7);
      c.stroke();
    }
    for (let i = 0; i < 90; i++) {
      const x = rand(i * 4 + 3) * 1800,
        y = 580 + rand(i * 11) * 130,
        w = 12 + rand(i) * 90;
      c.fillStyle = i % 3 ? "#57dce917" : "#f071b023";
      c.fillRect(x, y, w, 1 + rand(i * 3) * 4);
    }
  }
  draw(c: CanvasRenderingContext2D, s: number, time: number, pan: number) {
    const snapped = Math.round(pan / 12) * 12;
    if (this.pans[s] !== snapped) {
      let surface = this.composites[s];
      if (!surface) {
        surface = document.createElement("canvas");
        surface.width = 1280;
        surface.height = 720;
        this.composites[s] = surface;
      }
      const sc = surface.getContext("2d", { alpha: false })!;
      sc.drawImage(this.layers[s][0], Math.round(-260 - snapped * 0.12), 0);
      sc.drawImage(this.layers[s][1], Math.round(-260 - snapped * 0.32), 0);
      const vignette = sc.createRadialGradient(640, 350, 310, 640, 350, 830);
      vignette.addColorStop(0, "#00000000");
      vignette.addColorStop(1, "#030713b0");
      sc.fillStyle = vignette;
      sc.fillRect(0, 0, 1280, 720);
      this.pans[s] = snapped;
      this.snapshots[s]?.close();
      this.snapshots[s] = undefined;
      const version = ++this.versions[s];
      void createImageBitmap(surface).then((bitmap) => {
        if (this.versions[s] === version) this.snapshots[s] = bitmap;
        else bitmap.close();
      });
    }
    c.drawImage(this.snapshots[s] ?? this.composites[s], 0, 0);
    c.save();
    c.globalAlpha = this.effects.beam ? 0.12 + Math.sin(time * 1.1) * 0.035 : 0;
    c.fillStyle = STAGES[s].accent;
    c.beginPath();
    c.moveTo(250, 100);
    c.lineTo(450 + Math.sin(time * 0.25) * 200, 570);
    c.lineTo(590 + Math.sin(time * 0.25) * 200, 570);
    c.closePath();
    c.fill();
    c.restore();
    if (s === 2) {
      const tx = ((time * 140) % 2100) - 650;
      c.fillStyle = "#adf9df14";
      c.fillRect(tx, 367, 430, 50);
    }
    if (this.effects.rain) {
      c.fillStyle = "#b8dbf12b";
      for (let i = 0; i < (s === 1 ? 65 : 150); i++) {
        const y = (i * 47.7 + time * 620) % 740,
          raw = (i * 89.3 - time * 130) % 1380,
          x = raw < 0 ? raw + 1380 : raw;
        c.fillRect(Math.round(x), Math.round(y), 1, 20);
      }
    }
    for (let i = 0; i < (this.effects.ripples ? 18 : 0); i++) {
      const x = (i * 173 + time * 8) % 1280,
        y = 580 + (i % 5) * 22,
        phase = (time * 1.7 + i * 0.18) % 1;
      c.drawImage(
        this.ripples[Math.floor(phase * 12)],
        Math.round(x) - 32,
        y - 12,
      );
    }
    if (s === 1 && this.effects.petals) {
      c.fillStyle = "#f6b0c7";
      for (let i = 0; i < 25; i++) {
        c.globalAlpha = 0.3;
        c.fillRect(
          (i * 71 + time * 22) % 1280,
          (i * 41 + time * 19) % 630,
          4,
          2,
        );
      }
      c.globalAlpha = 1;
    }
  }
}
function polyRoof(c: CanvasRenderingContext2D) {
  c.fillStyle = "#241c32";
  c.beginPath();
  c.moveTo(300, 268);
  c.quadraticCurveTo(550, 282, 890, 233);
  c.quadraticCurveTo(1220, 282, 1500, 268);
  c.lineTo(1470, 289);
  c.lineTo(330, 289);
  c.closePath();
  c.fill();
}
