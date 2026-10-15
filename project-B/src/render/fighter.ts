import { CHARACTERS } from "../characters/data";
import { type Fighter, type FighterId } from "../core/types";
const poly = (
  c: CanvasRenderingContext2D,
  pts: number[][],
  fill: string,
  stroke?: string,
) => {
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = 1.5;
    c.stroke();
  }
};
function limb(
  c: CanvasRenderingContext2D,
  a: number[],
  b: number[],
  width: number,
  color: string,
  edge: string,
) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    len = Math.hypot(dx, dy),
    nx = ((-dy / len) * width) / 2,
    ny = ((dx / len) * width) / 2;
  poly(
    c,
    [
      [a[0] + nx, a[1] + ny],
      [b[0] + nx * 0.75, b[1] + ny * 0.75],
      [b[0] - nx * 0.75, b[1] - ny * 0.75],
      [a[0] - nx, a[1] - ny],
    ],
    color,
    edge,
  );
  poly(
    c,
    [
      [a[0] - nx * 0.8, a[1] - ny * 0.8],
      [b[0] - nx * 0.6, b[1] - ny * 0.6],
      [b[0] - nx * 0.18, b[1] - ny * 0.18],
      [a[0] - nx * 0.2, a[1] - ny * 0.2],
    ],
    "#ffffff12",
  );
  poly(
    c,
    [
      [a[0] + nx * 0.8, a[1] + ny * 0.8],
      [b[0] + nx * 0.65, b[1] + ny * 0.65],
      [b[0] + nx * 0.25, b[1] + ny * 0.25],
      [a[0] + nx * 0.3, a[1] + ny * 0.3],
    ],
    "#00000030",
  );
  c.beginPath();
  c.arc(b[0], b[1], width * 0.34, 0, Math.PI * 2);
  c.fillStyle = color;
  c.fill();
  c.strokeStyle = "#9db9cc30";
  c.lineWidth = 0.6;
  c.beginPath();
  c.arc(b[0], b[1], width * 0.22, 0, Math.PI * 1.4);
  c.stroke();
}
export function drawFighter(
  c: CanvasRenderingContext2D,
  id: FighterId,
  x: number,
  y: number,
  scale: number,
  facing: number,
  time: number,
  p?: Fighter,
  portrait = false,
) {
  const ch = CHARACTERS[id],
    col = ch.color,
    heavy = id === "magnus",
    slim = id === "sable";
  c.save();
  c.translate(x, y);
  c.scale(scale * facing, scale);
  const breath = Math.sin(time * 2.5) * 2;
  const moving = p?.pose === "walk" || p?.pose === "dash",
    hit = p?.pose === "hit",
    down = p?.pose === "down",
    crouch = p?.pose === "crouch" || p?.move?.startsWith("crouch"),
    air = p && !p.grounded;
  const m = p?.move ? ch.moves[p.move] : null;
  const attack = m
    ? p!.moveFrame < m.startup
      ? Math.max(0, p!.moveFrame / m.startup) * 0.25
      : p!.moveFrame < m.startup + m.active
        ? 1
        : Math.max(
            0,
            1 -
              (p!.moveFrame - m.startup - m.active) / Math.min(12, m.recovery),
          )
    : 0;
  const kick = m && (m.button.includes("K") || m.id.includes("special2")),
    strikeReach = m?.hitboxes[0]?.box.w ?? 78;
  if (down) {
    c.translate(-20, -10);
    c.rotate(-Math.PI * 0.45);
  }
  if (hit) c.rotate(-0.15);
  if (p?.pose === "block") c.rotate(-0.08);
  if (m?.id.startsWith("special2") && id === "hayate") {
    c.translate(0, -85);
    c.rotate(attack * 0.32);
    c.translate(0, 85);
  }
  if (p?.drive) {
    c.globalAlpha = 0.2;
    for (let i = 0; i < 3; i++) {
      c.fillStyle = col;
      c.beginPath();
      c.ellipse(-i * 8, -77, 43 + i * 8, 84 + i * 8, 0, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
  }
  const stride = moving ? Math.sin(time * 13) * 22 : 0,
    hip = [-5, crouch ? -52 : -83 + breath],
    shoulder = [heavy ? -7 : 0, crouch ? -91 : -132 + breath];
  const frontKnee = [21 + stride * 0.35, crouch ? -24 : -43],
    backKnee = [-31 - stride * 0.35, crouch ? -21 : -45];
  const frontFoot = [35 + stride, 0],
    backFoot = [-40 - stride, 0];
  if (air) {
    frontKnee[1] -= 20;
    frontFoot[1] -= 38;
    backKnee[0] -= 15;
    backFoot[1] -= 12;
  }
  if (kick && attack > 0.1) {
    frontKnee[0] += attack * 40;
    frontKnee[1] -= attack * (crouch ? 0 : 50);
    frontFoot[0] += attack * Math.min(78, strikeReach * 0.75);
    frontFoot[1] -= attack * (crouch ? 12 : 95);
  }
  const armor = heavy
      ? "#28394a"
      : id === "warden"
        ? "#2d4146"
        : slim
          ? "#302746"
          : "#1d3249",
    dark = "#101b2d",
    edge = "#4b6679";
  // Offset silhouettes and hard-edged highlight strips create volume without sprite assets.
  limb(c, hip, backKnee, heavy ? 30 : 22, dark, edge);
  limb(c, backKnee, backFoot, heavy ? 25 : 17, dark, edge);
  poly(
    c,
    [
      [backFoot[0] - 10, backFoot[1] - 9],
      [backFoot[0] + 10, backFoot[1] - 8],
      [backFoot[0] + 19, backFoot[1] + 2],
      [backFoot[0] - 13, backFoot[1] + 2],
    ],
    "#09111f",
    edge,
  );
  const backElbow = [-34, crouch ? -87 : -108 + breath],
    backHand = [-10, crouch ? -108 : -143 + breath];
  limb(
    c,
    [shoulder[0] - 12, shoulder[1] + 5],
    backElbow,
    heavy ? 26 : 17,
    dark,
    edge,
  );
  limb(c, backElbow, backHand, heavy ? 23 : 15, armor, col);
  const w = heavy ? 36 : slim ? 21 : 27;
  poly(
    c,
    [
      [shoulder[0] - w, shoulder[1] - 5],
      [shoulder[0] + w, shoulder[1] - 6],
      [hip[0] + w * 0.65, hip[1] + 9],
      [hip[0] - w * 0.72, hip[1] + 7],
    ],
    armor,
    edge,
  );
  poly(
    c,
    [
      [shoulder[0] - w + 4, shoulder[1]],
      [shoulder[0] + 5, shoulder[1] + 5],
      [hip[0] + 10, hip[1] - 4],
      [hip[0] - w * 0.4, hip[1] - 7],
    ],
    id === "hayate"
      ? "#e2e8e1"
      : heavy
        ? "#45515d"
        : slim
          ? "#51405f"
          : "#5b6861",
  );
  if (id === "hayate") {
    poly(
      c,
      [
        [12, -131 + breath],
        [26, -128 + breath],
        [12, -90 + breath],
        [-1, -92 + breath],
      ],
      "#60f4ef",
    );
    poly(
      c,
      [
        [-25, -126 + breath],
        [-9, -118 + breath],
        [-8, -88 + breath],
        [-22, -95 + breath],
      ],
      "#29435b",
    );
    c.strokeStyle = "#8bb9c0";
    c.lineWidth = 0.6;
    for (let n = 0; n < 3; n++) {
      c.beginPath();
      c.moveTo(-22, -120 + n * 8 + breath);
      c.lineTo(-13, -116 + n * 8 + breath);
      c.stroke();
    }
  }
  if (id === "warden") {
    poly(
      c,
      [
        [-32, -130 + breath],
        [30, -130 + breath],
        [22, -111 + breath],
        [-24, -108 + breath],
      ],
      "#6e7f73",
      col,
    );
    c.fillStyle = col;
    c.fillRect(-13, -123 + breath, 27, 3);
  }
  if (slim) {
    poly(
      c,
      [
        [-20, -127 + breath],
        [-5, -135 + breath],
        [19, -128 + breath],
        [7, -110 + breath],
      ],
      "#ad86ba",
    );
    poly(
      c,
      [
        [-20, -85],
        [-29, -35],
        [-3, -54],
        [12, -86],
      ],
      "#28223e",
      col,
    );
  }
  if (heavy) {
    poly(
      c,
      [
        [-31, shoulder[1] + 3],
        [-18, shoulder[1] + 7],
        [-18, shoulder[1] + 27],
        [-31, shoulder[1] + 23],
      ],
      "#b9926a",
      "#e6b780",
    );
    c.fillStyle = col;
    for (let n = 0; n < 3; n++) c.fillRect(-26, shoulder[1] + 9 + n * 4, 5, 1);
    poly(
      c,
      [
        [6, shoulder[1] + 14],
        [25, shoulder[1] + 11],
        [19, hip[1] - 9],
        [3, hip[1] - 8],
      ],
      "#1b293a",
      "#65737d",
    );
  }
  c.strokeStyle = "#ccd9df33";
  c.lineWidth = 0.7;
  c.beginPath();
  c.moveTo(shoulder[0] - w + 4, shoulder[1] - 1);
  c.lineTo(hip[0] - w * 0.65, hip[1] - 7);
  c.stroke();
  c.fillStyle = col;
  c.fillRect(hip[0] - w * 0.8, hip[1] - 4, w * 1.5, 7);
  c.fillStyle = "#d3e9ec";
  c.fillRect(hip[0] + 1, hip[1] - 3, 8, 5);
  c.fillStyle = "#0a1829";
  c.fillRect(hip[0] + 3, hip[1] - 2, 4, 3);
  limb(c, hip, frontKnee, heavy ? 30 : 21, armor, edge);
  limb(c, frontKnee, frontFoot, heavy ? 25 : 18, armor, edge);
  limb(
    c,
    [frontKnee[0] + 5, frontKnee[1] + 2],
    [frontFoot[0] + 5, frontFoot[1] - 8],
    3,
    col,
    col,
  );
  poly(
    c,
    [
      [frontFoot[0] - 10, frontFoot[1] - 12],
      [frontFoot[0] + 9, frontFoot[1] - 10],
      [frontFoot[0] + 21, frontFoot[1] + 1],
      [frontFoot[0] - 12, frontFoot[1] + 1],
    ],
    "#142030",
    col,
  );
  const head = [shoulder[0] + 4, shoulder[1] - 25];
  c.fillStyle = "#be927f";
  c.fillRect(head[0] - 7, head[1] + 10, 14, 12);
  poly(
    c,
    [
      [head[0] - 13, head[1] - 14],
      [head[0] + 12, head[1] - 15],
      [head[0] + 18, head[1] - 4],
      [head[0] + 15, head[1] + 10],
      [head[0] + 4, head[1] + 17],
      [head[0] - 11, head[1] + 8],
    ],
    heavy ? "#ad8373" : slim ? "#d0a4a5" : "#c7a18e",
    "#6a5962",
  );
  if (id === "hayate") {
    poly(
      c,
      [
        [head[0] - 17, head[1] + 1],
        [head[0] - 18, head[1] - 18],
        [head[0] - 8, head[1] - 15],
        [head[0] + 1, head[1] - 28],
        [head[0] + 8, head[1] - 19],
        [head[0] + 22, head[1] - 23],
        [head[0] + 15, head[1] - 7],
        [head[0] - 3, head[1] - 11],
      ],
      "#e5edf4",
      "#aec2d9",
    );
    c.fillStyle = "#142632";
    c.fillRect(head[0] - 13, head[1] - 5, 30, 5);
  }
  if (heavy) {
    poly(
      c,
      [
        [head[0] - 15, head[1] - 8],
        [head[0] - 14, head[1] - 19],
        [head[0] + 12, head[1] - 18],
        [head[0] + 15, head[1] - 9],
      ],
      "#253340",
    );
    poly(
      c,
      [
        [head[0] - 10, head[1] + 5],
        [head[0] + 14, head[1] + 7],
        [head[0] + 6, head[1] + 19],
        [head[0] - 6, head[1] + 14],
      ],
      "#3d3540",
    );
  }
  if (slim) {
    poly(
      c,
      [
        [head[0] - 18, head[1] + 13],
        [head[0] - 20, head[1] - 14],
        [head[0] - 7, head[1] - 24],
        [head[0] + 13, head[1] - 20],
        [head[0] + 22, head[1] - 6],
        [head[0] + 4, head[1] - 9],
        [head[0] - 6, head[1] + 5],
        [head[0] - 8, head[1] + 25],
      ],
      "#d3b4e2",
      "#f9b5ef",
    );
    poly(
      c,
      [
        [head[0] - 9, head[1] + 2],
        [head[0] + 18, head[1] + 2],
        [head[0] + 12, head[1] + 13],
        [head[0] - 6, head[1] + 12],
      ],
      "#2c2443",
      col,
    );
  }
  if (id === "warden") {
    poly(
      c,
      [
        [head[0] - 16, head[1] + 8],
        [head[0] - 18, head[1] - 17],
        [head[0] + 11, head[1] - 21],
        [head[0] + 20, head[1] - 9],
        [head[0] + 17, head[1] + 8],
      ],
      "#324953",
      "#8aa6a7",
    );
    c.fillStyle = col;
    c.fillRect(head[0] - 8, head[1] - 5, 27, 5);
  }
  if (id !== "warden") {
    poly(
      c,
      [
        [head[0] + 7, head[1]],
        [head[0] + 13, head[1] + 1],
        [head[0] + 10, head[1] + 6],
        [head[0] + 5, head[1] + 4],
      ],
      "#825e60",
    );
    c.strokeStyle = "#5f4c58";
    c.lineWidth = 0.7;
    c.beginPath();
    c.moveTo(head[0] + 1, head[1] + 9);
    c.lineTo(head[0] + 8, head[1] + 10);
    c.stroke();
    poly(
      c,
      [
        [head[0] - 10, head[1] - 2],
        [head[0] - 5, head[1] - 3],
        [head[0] - 4, head[1] + 8],
        [head[0] - 9, head[1] + 5],
      ],
      "#ffffff16",
    );
  }
  c.fillStyle = col;
  c.shadowColor = col;
  c.shadowBlur = 8;
  c.fillRect(head[0] + 7, head[1] - 3, 7, 2);
  c.shadowBlur = 0;
  const elbow = [
      32 + attack * (kick ? 10 : 30),
      shoulder[1] + 22 - attack * 18,
    ],
    hand = [
      38 + attack * (kick ? 5 : Math.min(68, strikeReach * 0.7)),
      shoulder[1] - 12 + attack * 7,
    ];
  if (m?.launch) {
    hand[0] -= attack * 35;
    hand[1] -= attack * 70;
    elbow[1] -= attack * 40;
  }
  if (p?.pose === "block" || p?.pose === "parry") {
    hand[0] = 24;
    hand[1] = shoulder[1] - 23;
    elbow[0] = 36;
    elbow[1] = shoulder[1] + 3;
  }
  if (p?.pose === "win") {
    hand[0] = 28;
    hand[1] = shoulder[1] - 63;
    elbow[0] = 36;
    elbow[1] = shoulder[1] - 25;
  }
  limb(
    c,
    [shoulder[0] + w - 5, shoulder[1] + 4],
    elbow,
    heavy ? 29 : 18,
    armor,
    edge,
  );
  limb(
    c,
    elbow,
    hand,
    heavy ? 30 : 18,
    heavy ? "#796d5b" : id === "warden" ? "#546962" : "#243b50",
    col,
  );
  c.fillStyle = heavy ? "#d9a775" : col;
  c.beginPath();
  c.arc(hand[0], hand[1], heavy ? 13 : 8, 0, Math.PI * 2);
  c.fill();
  poly(
    c,
    [
      [hand[0] - 6, hand[1] - 5],
      [hand[0] + 6, hand[1] - 5],
      [hand[0] + 7, hand[1] + 3],
      [hand[0] - 6, hand[1] + 4],
    ],
    heavy ? "#5d5351" : "#27404e",
    "#9ce3db",
  );
  c.strokeStyle = col;
  c.lineWidth = 0.8;
  for (let n = 0; n < 3; n++) {
    c.beginPath();
    c.moveTo(hand[0] - 4 + n * 3, hand[1] - 3);
    c.lineTo(hand[0] - 4 + n * 3, hand[1] + 1);
    c.stroke();
  }
  if (id === "warden") {
    poly(
      c,
      [
        [elbow[0] - 12, elbow[1] - 18],
        [elbow[0] + 15, elbow[1] - 24],
        [elbow[0] + 22, elbow[1] + 13],
        [elbow[0] - 7, elbow[1] + 22],
      ],
      "#314d50",
      col,
    );
    c.fillStyle = col;
    c.fillRect(elbow[0] + 1, elbow[1] - 15, 4, 27);
  }
  if (id === "hayate" || slim) {
    const ty = shoulder[1] - 6;
    c.beginPath();
    c.moveTo(-12, ty);
    c.bezierCurveTo(
      -35,
      ty + 12,
      -53,
      ty + Math.sin(time * 5) * 9,
      -73,
      ty + 15 + Math.sin(time * 5) * 12,
    );
    c.lineTo(-52, ty + 25 + Math.sin(time * 5) * 8);
    c.lineTo(-12, ty + 5);
    c.closePath();
    c.fillStyle = col;
    c.fill();
  }
  if (p?.pose === "dizzy") {
    c.strokeStyle = "#ffe9a0";
    c.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const a = time * 3 + i * 2.1;
      c.beginPath();
      c.arc(
        head[0] + Math.cos(a) * 22,
        head[1] - 30 + Math.sin(a) * 5,
        3,
        0,
        7,
      );
      c.stroke();
    }
  }
  c.restore();
}
