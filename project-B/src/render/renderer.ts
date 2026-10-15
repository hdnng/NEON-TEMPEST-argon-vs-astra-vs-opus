import { StageArt, STAGES } from "./stages";
import { drawFighter } from "./sprite-cache";
import { Particles } from "../vfx/particles";
import { CHARACTERS } from "../characters/data";
import { activeBoxes } from "../core/sim";
import { type SimState, type FighterId, type SimEvent } from "../core/types";
import { lerp, clamp } from "../utils/math";
export interface RenderSettings {
  shake: boolean;
  flashes: boolean;
  colorblind: boolean;
  scale: number;
  hitboxes: boolean;
  inputs: boolean;
  hud: boolean;
}
export class Renderer {
  c: CanvasRenderingContext2D;
  art: StageArt;
  particles = new Particles();
  camera = 740;
  zoom = 1.25;
  shake = 0;
  flash = 0;
  cutin = 0;
  cutinPlayer = 0;
  cutinText = "";
  announcement = "";
  announcementLife = 0;
  width = 1280;
  height = 720;
  hudSurface = document.createElement("canvas");
  hudKey = "";
  hudFrame = -99;
  hasFrame = false;
  portraits = {} as Record<FighterId, HTMLCanvasElement>;
  projectileImages = new Map<string, CanvasImageSource>();
  settings: RenderSettings = {
    shake: true,
    flashes: true,
    colorblind: false,
    scale: 1,
    hitboxes: false,
    inputs: false,
    hud: true,
  };
  constructor(public canvas: HTMLCanvasElement) {
    this.c = canvas.getContext("2d", { alpha: false })!;
    this.art = new StageArt();
    this.hudSurface.width = 1280;
    this.hudSurface.height = 720;
    for (const id of ["hayate", "magnus", "sable", "warden"] as FighterId[]) {
      const portrait = document.createElement("canvas");
      portrait.width = 64;
      portrait.height = 64;
      const pc = portrait.getContext("2d")!;
      pc.fillStyle = "#183043";
      pc.fillRect(0, 0, 64, 64);
      drawFighter(pc, id, 28, 226, 1.25, 1, 0);
      pc.strokeStyle = CHARACTERS[id].color;
      pc.strokeRect(0.5, 0.5, 63, 63);
      this.portraits[id] = portrait;
    }
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }
  resize() {
    const fit = Math.min(innerWidth / 1280, innerHeight / 720),
      dpr = Math.min(devicePixelRatio, 2) * this.settings.scale;
    const w = Math.round(1280 * fit * dpr),
      h = Math.round(720 * fit * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.hasFrame = false;
    }
  }
  projectileImage(id: FighterId, size: number) {
    const key = `${id}:${size}`;
    let image = this.projectileImages.get(key);
    if (image) return image;
    const surface = document.createElement("canvas");
    surface.width = 160;
    surface.height = 120;
    const c = surface.getContext("2d")!,
      color = CHARACTERS[id].color;
    c.shadowBlur = 25;
    c.shadowColor = color;
    const glow = c.createRadialGradient(80, 60, 0, 80, 60, size * 2);
    glow.addColorStop(0, "#ffffff");
    glow.addColorStop(0.35, color);
    glow.addColorStop(1, color + "00");
    c.fillStyle = glow;
    c.beginPath();
    c.ellipse(80, 60, size * 2.2, size * 1.4, 0, 0, 7);
    c.fill();
    this.projectileImages.set(key, surface);
    void createImageBitmap(surface).then((bitmap) =>
      this.projectileImages.set(key, bitmap),
    );
    return surface;
  }
  handle(e: SimEvent) {
    if (["hit", "throw", "block", "parry"].includes(e.type)) {
      const color =
        e.type === "block"
          ? "#75caff"
          : e.type === "parry"
            ? "#f9f6c1"
            : e.strength > 1
              ? "#ffd7a8"
              : "#e7fdff";
      this.particles.emit(
        e.x,
        e.y,
        color,
        16 + e.strength * 14,
        1 + e.strength * 0.4,
      );
      this.particles.emit(e.x, e.y, color, 1, 1, 1);
      this.shake = e.type === "block" ? 2 : 4 + e.strength * 2;
      this.flash = e.type === "hit" ? e.strength + 1 : 0;
    }
    if (e.type === "dash")
      this.particles.emit(e.x, e.y + 65, "#91dce1", 10, 0.7);
    if (e.type === "super") {
      this.cutin = 60;
      this.cutinPlayer = e.player;
      this.cutinText = e.text ?? "SUPER ART";
      this.announce("SUPER ART", 90);
    }
    if (["round", "fight", "ko", "dizzy", "tech", "drive"].includes(e.type))
      this.announce(
        e.text ?? e.type.toUpperCase(),
        e.type === "ko" ? 130 : e.type === "round" ? 90 : 65,
      );
  }
  announce(text: string, life = 70) {
    this.announcement = text;
    this.announcementLife = life;
  }
  render(
    time: number,
    dt: number,
    scene: string,
    stage: number,
    s: SimState | null,
    selected: [FighterId, FighterId],
  ) {
    const c = this.c;
    c.setTransform(
      this.canvas.width / 1280,
      0,
      0,
      this.canvas.height / 720,
      0,
      0,
    );
    c.clearRect(0, 0, 1280, 720);
    const isMatch =
      !!s && ["match", "pause", "moves", "training", "replay"].includes(scene);
    this.art.draw(c, stage, time, this.camera - 740);
    if (isMatch && s) {
      this.camera = lerp(
        this.camera,
        (s.fighters[0].x + s.fighters[1].x) / 2,
        0.07,
      );
      const distance = Math.abs(s.fighters[0].x - s.fighters[1].x);
      this.zoom = lerp(
        this.zoom,
        clamp(1050 / (distance + 420), 0.88, 1.48) +
          (s.phase === "ko" ? 0.15 : 0),
        0.035,
      );
      this.camera = clamp(this.camera, 640 / this.zoom, 1480 - 640 / this.zoom);
      c.save();
      if (this.settings.shake && this.shake > 0)
        c.translate(
          Math.sin(time * 140) * this.shake,
          Math.cos(time * 180) * this.shake * 0.5,
        );
      c.translate(640, 570);
      c.scale(this.zoom, this.zoom);
      c.translate(-this.camera, 0);
      for (let i = 0; i < 2; i++) {
        const p = s.fighters[i],
          ch = CHARACTERS[p.id];
        c.fillStyle = "#00000070";
        c.beginPath();
        c.ellipse(p.x, 3, 43 - Math.min(15, -p.y * 0.1), 9, 0, 0, 7);
        c.fill();
        c.save();
        c.globalAlpha = 0.12;
        c.translate(p.x, 10);
        c.scale(1, -0.25);
        drawFighter(c, p.id, 0, -p.y, 0.98, p.facing, time, p);
        c.restore();
        drawFighter(c, p.id, p.x, p.y, 0.98, p.facing, time, p);
        if (this.settings.hitboxes) {
          for (const kind of ["hurtboxes", "hitboxes", "throwboxes"] as const) {
            c.fillStyle =
              kind === "hurtboxes"
                ? "#54d8ff25"
                : kind === "throwboxes"
                  ? "#ffc46555"
                  : "#ff397b55";
            c.strokeStyle =
              kind === "hurtboxes"
                ? "#54d8ff"
                : kind === "throwboxes"
                  ? "#ffc465"
                  : "#ff397b";
            c.lineWidth = 1;
            for (const b of activeBoxes(p, kind)) {
              c.fillRect(b.x, b.y, b.w, b.h);
              c.strokeRect(b.x, b.y, b.w, b.h);
            }
          }
          c.strokeStyle = "#76fb83";
          for (const b of activeBoxes(p, "pushboxes"))
            c.strokeRect(b.x, b.y, b.w, b.h);
        }
      }
      for (const p of s.projectiles)
        if (p.active) {
          const col = CHARACTERS[s.fighters[p.owner].id].color;
          c.save();
          c.globalCompositeOperation = "lighter";
          c.drawImage(
            this.projectileImage(s.fighters[p.owner].id, p.size),
            p.x - 80,
            p.y - 60,
          );
          c.strokeStyle = col;
          c.lineWidth = 2;
          c.beginPath();
          c.ellipse(p.x, p.y, p.size * 0.75, p.size * 1.2, time * 10, 0, 7);
          c.stroke();
          c.restore();
        }
      this.particles.update(dt * 60);
      this.particles.draw(c);
      c.restore();
      if (this.settings.hud) {
        const key =
          s.fighters
            .map((p) => `${p.id}:${p.hp}:${p.wins}:${p.combo}:${p.comboDamage}`)
            .join("|") +
          s.rules.mode +
          this.settings.colorblind;
        if (
          key !== this.hudKey ||
          s.frame - this.hudFrame >= 4 ||
          s.frame < this.hudFrame
        ) {
          const hc = this.hudSurface.getContext("2d")!;
          hc.clearRect(0, 0, 1280, 720);
          this.hud(s, time, hc);
          this.hudKey = key;
          this.hudFrame = s.frame;
        }
        const hs = this.hudSurface;
        c.drawImage(hs, 0, 0, 1280, 130, 0, 0, 1280, 130);
        c.drawImage(hs, 0, 630, 1280, 90, 0, 630, 1280, 90);
        if (s.fighters[0].combo >= 2)
          c.drawImage(hs, 40, 185, 320, 140, 40, 185, 320, 140);
        if (s.fighters[1].combo >= 2)
          c.drawImage(hs, 920, 185, 320, 140, 920, 185, 320, 140);
      }
      if (this.settings.inputs) this.inputs(s);
      if (this.announcementLife > 0 && this.cutin <= 0) {
        this.announcementLife -= dt * 60;
        const t = this.announcementLife,
          cx = 640,
          large = ["FIGHT", "K.O.", "DOUBLE K.O."].includes(this.announcement);
        c.save();
        c.globalAlpha = Math.min(1, t / 12);
        c.translate(cx, large ? 325 : 247);
        c.transform(1, 0, -0.12, 1, 0, 0);
        c.font = `900 ${large ? 104 : 46}px "Arial Black", sans-serif`;
        c.textAlign = "center";
        c.shadowBlur = 30;
        c.shadowColor = large ? "#ff648d" : "#70f6e6";
        c.strokeStyle = "#122338";
        c.lineWidth = 8;
        c.strokeText(this.announcement, 0, 0);
        c.fillStyle = "#eefcff";
        c.fillText(this.announcement, 0, 0);
        c.restore();
      }
      if (this.cutin > 0) this.drawCutin(s, time, dt);
      if (
        s.fighters.some((p) => p.hp / CHARACTERS[p.id].hp < 0.25) &&
        s.phase === "fight"
      ) {
        const grad = c.createRadialGradient(640, 360, 300, 640, 360, 740);
        grad.addColorStop(0, "#fb325a00");
        grad.addColorStop(
          1,
          `rgba(225,30,73,${0.13 + Math.sin(time * 4) * 0.05})`,
        );
        c.fillStyle = grad;
        c.fillRect(0, 0, 1280, 720);
      }
    } else {
      c.fillStyle = "#050c20aa";
      c.fillRect(0, 0, 1280, 720);
      if (scene === "character") {
        for (let i = 0; i < 2; i++) {
          const col = CHARACTERS[selected[i]].color;
          this.halo(c, i ? 1010 : 270, 390, 220, col);
          drawFighter(
            c,
            selected[i],
            i ? 970 : 310,
            591,
            2.0,
            i ? -1 : 1,
            time,
          );
        }
      } else if (scene === "versus") {
        for (let i = 0; i < 2; i++) {
          this.halo(c, i ? 1030 : 250, 370, 300, CHARACTERS[selected[i]].color);
          drawFighter(
            c,
            selected[i],
            i ? 1010 : 270,
            670,
            3.0,
            i ? -1 : 1,
            time,
          );
        }
      } else if (scene !== "stage") {
        this.halo(c, 965, 365, 360, "#68e8e8");
        c.save();
        c.globalAlpha = 0.12;
        c.fillStyle = "#70f7f0";
        c.transform(1, 0, -0.22, 1, 0, 0);
        c.fillRect(945, 0, 240, 720);
        c.restore();
        const showcase =
          scene === "results" && s && s.winner >= 0
            ? s.fighters[s.winner].id
            : selected[0];
        drawFighter(c, showcase, 990, 690, 3.22, -1, time);
        c.fillStyle = "#0b122235";
        c.fillRect(0, 0, 1280, 720);
      }
    }
    if (this.flash > 0) {
      if (this.settings.flashes) {
        c.fillStyle = `rgba(220,250,255,${this.flash * 0.025})`;
        c.fillRect(0, 0, 1280, 720);
      }
      this.flash = Math.max(0, this.flash - dt * 20);
    }
    this.shake = Math.max(0, this.shake - dt * 25);
    // The static vignette is baked into the stage composite; keep the HUD crisp.
    this.hasFrame = true;
  }
  halo(
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    col: string,
  ) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col + "27");
    g.addColorStop(0.6, col + "11");
    g.addColorStop(1, col + "00");
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
    c.strokeStyle = col + "30";
    c.lineWidth = 1;
    c.beginPath();
    c.arc(x, y, r * 0.7, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.arc(x, y, r * 0.75, -0.4, 2);
    c.stroke();
  }
  hud(s: SimState, time: number, c = this.c) {
    for (let i = 0; i < 2; i++) {
      const p = s.fighters[i],
        ch = CHARACTERS[p.id],
        left = i === 0,
        x = left ? 54 : 752,
        w = 474,
        hp = p.hp / ch.hp,
        col = this.settings.colorblind
          ? left
            ? "#54b9ff"
            : "#ffcd63"
          : ch.color;
      c.textAlign = left ? "left" : "right";
      c.font = '900 24px "Arial Black",sans-serif';
      c.fillStyle = "#edf6fa";
      c.fillText(ch.name, left ? 108 : 1173, 51);
      c.drawImage(this.portraits[p.id], left ? 54 : 1184, 16, 42, 42);
      c.font = "10px monospace";
      c.fillStyle = "#94aabd";
      c.fillText(
        left
          ? "01 / " + (s.rules.mode === "versus" ? "PLAYER ONE" : "CHALLENGER")
          : "02 / " + (s.rules.mode === "versus" ? "PLAYER TWO" : "OPPONENT"),
        left ? 108 : 1173,
        26,
      );
      c.fillStyle = "#080f24cc";
      c.fillRect(x - 4, 63, w + 8, 34);
      c.strokeStyle = "#61718165";
      c.strokeRect(x - 4, 63, w + 8, 34);
      c.fillStyle = "#f5acb4";
      c.fillRect(
        left ? x : x + w - (w * p.white) / ch.hp,
        68,
        (w * p.white) / ch.hp,
        22,
      );
      const grad = c.createLinearGradient(x, 0, x + w, 0);
      grad.addColorStop(0, left ? "#a3f5e5" : col);
      grad.addColorStop(1, left ? col : "#e4d8c7");
      c.fillStyle = grad;
      c.fillRect(left ? x : x + w * (1 - hp), 68, w * hp, 22);
      c.fillStyle = "#ffffff35";
      c.fillRect(left ? x : x + w * (1 - hp), 68, w * hp, 3);
      for (let j = 1; j < 10; j++) {
        c.fillStyle = "#00162840";
        c.fillRect(x + (w * j) / 10, 68, 1, 22);
      }
      c.fillStyle = "#d0dbe3";
      c.font = "10px monospace";
      c.fillText(`${Math.ceil(p.hp)} / ${ch.hp}`, left ? 54 : 1226, 116);
      c.fillStyle = "#203044";
      c.fillRect(left ? 161 : 852, 108, 267, 3);
      c.fillStyle = p.stun < ch.stun * 0.25 ? "#ff779c" : col + "80";
      c.fillRect(
        left ? 161 : 1119 - (267 * p.stun) / ch.stun,
        108,
        (267 * p.stun) / ch.stun,
        3,
      );
      for (let n = 0; n < 2; n++) {
        c.fillStyle = p.wins > n ? col : "#304353";
        const px = left ? 449 + n * 27 : 804 - n * 27;
        c.save();
        c.translate(px, 111);
        c.rotate(Math.PI / 4);
        c.fillRect(-5, -5, 10, 10);
        c.restore();
      }
      // Stocks are spatially separated and numerically labelled for readability without color.
      const mx = left ? 54 : 887;
      c.font = "10px monospace";
      c.fillStyle = "#88a5b7";
      c.textAlign = left ? "left" : "right";
      c.fillText(
        p.drive
          ? "OVERDRIVE · DAMAGE +18% / RISK +12%"
          : "RESONANCE / SUPER GAUGE",
        left ? 54 : 1226,
        650,
      );
      for (let j = 0; j < 3; j++) {
        const sx = left ? mx + j * 111 : mx + (2 - j) * 111;
        c.fillStyle = "#17283b";
        c.fillRect(sx, 661, 105, 12);
        c.fillStyle = p.drive ? "#ff8ead" : col;
        c.fillRect(
          left ? sx : sx + 105 * (1 - clamp((p.meter - j * 100) / 100, 0, 1)),
          661,
          105 * clamp((p.meter - j * 100) / 100, 0, 1),
          12,
        );
        c.strokeStyle = col + "66";
        c.strokeRect(sx, 661, 105, 12);
      }
      c.fillStyle = col;
      c.font = "900 28px sans-serif";
      c.fillText(String(Math.floor(p.meter / 100)), left ? 399 : 867, 675);
      if (p.combo >= 2 && p.comboTimer > 0) {
        const cx = left ? 65 : 1215,
          alpha = Math.min(1, p.comboTimer / 20);
        c.save();
        c.globalAlpha = alpha;
        c.textAlign = left ? "left" : "right";
        c.fillStyle = col;
        c.font = 'italic 900 64px "Arial Black",sans-serif';
        c.fillText(String(p.combo), cx, 258);
        c.font = "900 17px sans-serif";
        c.fillStyle = "#eef8ff";
        c.fillText("HIT COMBO", cx, 283);
        c.font = "11px monospace";
        c.fillStyle = "#a5bece";
        c.fillText(
          `${p.comboDamage} DAMAGE · ${Math.round(p.comboScale * 100)}% SCALING`,
          cx,
          306,
        );
        c.restore();
      }
    }
    c.fillStyle = "#0b1729d9";
    c.beginPath();
    c.moveTo(553, 22);
    c.lineTo(727, 22);
    c.lineTo(705, 102);
    c.lineTo(575, 102);
    c.closePath();
    c.fill();
    c.strokeStyle = "#78a1ad66";
    c.stroke();
    c.textAlign = "center";
    c.font = '900 55px "Arial Black",sans-serif';
    c.fillStyle = s.timer < 600 ? "#ff7b91" : "#edf9f8";
    c.fillText(
      s.rules.mode === "training" || s.rules.mode === "trials"
        ? "∞"
        : String(Math.ceil(s.timer / 60)).padStart(2, "0"),
      640,
      77,
    );
    c.font = "9px monospace";
    c.fillStyle = "#9bbac6";
    c.fillText(
      `ROUND ${String(s.round).padStart(2, "0")}  /  FIRST TO 2`,
      640,
      119,
    );
    c.font = "10px monospace";
    c.fillStyle = "#7896ab";
    c.fillText("NEO-KYOTO UNDERGROUND  /  NEON TEMPEST", 640, 690);
  }
  inputs(s: SimState) {
    const c = this.c,
      arrows = ["", "↙", "↓", "↘", "←", "·", "→", "↖", "↑", "↗"];
    for (let n = 0; n < 2; n++) {
      const p = s.fighters[n],
        h = p.input.history
          .filter((f, i, a) => i === 0 || f.dir !== a[i - 1].dir || f.pressed)
          .slice(-8);
      c.textAlign = n ? "right" : "left";
      c.font = "13px monospace";
      h.forEach((f, i) => {
        c.fillStyle = `rgba(205,231,242,${0.35 + i * 0.075})`;
        const keys = ["LP", "MP", "HP", "LK", "MK", "HK"]
          .filter((_, k) => f.held & (1 << k))
          .join("+");
        c.fillText(arrows[f.dir] + " " + keys, n ? 1220 : 60, 345 + i * 21);
      });
    }
  }
  drawCutin(s: SimState, time: number, dt: number) {
    const c = this.c;
    this.cutin -= dt * 60;
    const p = s.fighters[this.cutinPlayer],
      col = CHARACTERS[p.id].color;
    c.save();
    c.globalAlpha = Math.min(1, this.cutin / 15);
    c.fillStyle = "#060b1be8";
    c.fillRect(0, 170, 1280, 285);
    c.strokeStyle = col;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, 170);
    c.lineTo(1280, 170);
    c.moveTo(0, 455);
    c.lineTo(1280, 455);
    c.stroke();
    c.save();
    c.beginPath();
    c.rect(0, 171, 1280, 283);
    c.clip();
    for (let i = 0; i < 36; i++) {
      const x = ((i * 73 + time * 1500) % 1480) - 200;
      c.strokeStyle = col + (i % 2 ? "40" : "15");
      c.lineWidth = (i % 3) + 1;
      c.beginPath();
      c.moveTo(x, 180 + i * 8);
      c.lineTo(x + 160, 180 + i * 8);
      c.stroke();
    }
    drawFighter(c, p.id, 230, 760, 3.2, 1, time);
    c.restore();
    c.textAlign = "left";
    c.font = "12px monospace";
    c.fillStyle = col;
    c.fillText("RESONANCE RELEASE / " + CHARACTERS[p.id].name, 480, 253);
    c.font = 'italic 900 45px "Arial Black", sans-serif';
    c.fillStyle = "#f2fbff";
    c.fillText(this.cutinText.toUpperCase(), 475, 325, 740);
    c.font = "13px monospace";
    c.fillStyle = "#9cbbca";
    c.fillText("THE STORM HAS A NAME.", 480, 372);
    c.restore();
  }
}
