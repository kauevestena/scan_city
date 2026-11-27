/**
 * Os 18 objetos da Estante (catalog §11, ADR-036), desenhados em Canvas num espaço canônico de
 * 560 × 460 centrado em (0, 0), e a capa de couro da caderneta (400 × 580). O mesmo desenho serve
 * ao exame e às miniaturas. Um lado com blocos (o verso do azulejo, o fundo da caixa) devolve a
 * área onde o texto vai, já nas coordenadas da caixa pedida.
 *
 * Os objetos das fendas são motivos genéricos (constitution §6): nenhum copia o desenho
 * característico de um item de franquia.
 */
import type { Rng } from '@/lib/rng';
import { roundRect, type Box } from './paper';

export const OBJECT_W = 560;
export const OBJECT_H = 460;
export const COVER_W = 400;
export const COVER_H = 580;

type C = CanvasRenderingContext2D;
type Pt = readonly [number, number];

// --- primitivas ----------------------------------------------------------------

function linear(
  ctx: C,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stops: readonly (readonly [number, string])[],
): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [at, color] of stops) g.addColorStop(at, color);
  return g;
}

function radial(
  ctx: C,
  x0: number,
  y0: number,
  r0: number,
  x1: number,
  y1: number,
  r1: number,
  stops: readonly (readonly [number, string])[],
): CanvasGradient {
  const g = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1);
  for (const [at, color] of stops) g.addColorStop(at, color);
  return g;
}

function poly(ctx: C, pts: readonly Pt[]): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
}

/** Sombra de contato no tampo da mesa. */
function contactShadow(ctx: C, cx: number, cy: number, rx: number, ry: number, alpha = 0.5): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  ctx.fillStyle = radial(ctx, 0, 0, rx * 0.15, 0, 0, rx, [
    [0, `rgba(0, 0, 0, ${alpha})`],
    [1, 'rgba(0, 0, 0, 0)'],
  ]);
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Brilho de quatro pontas. */
function glint(ctx: C, x: number, y: number, r: number, color = 'rgba(255, 255, 255, 0.9)'): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + r * 0.12, y - r * 0.12, x + r, y);
  ctx.quadraticCurveTo(x + r * 0.12, y + r * 0.12, x, y + r);
  ctx.quadraticCurveTo(x - r * 0.12, y + r * 0.12, x - r, y);
  ctx.quadraticCurveTo(x - r * 0.12, y - r * 0.12, x, y - r);
  ctx.fill();
}

const GOLD: readonly (readonly [number, string])[] = [
  [0, '#fff3b8'],
  [0.35, '#f0c64e'],
  [0.65, '#b98318'],
  [1, '#f3d06a'],
];

// --- os objetos -------------------------------------------------------------------

function cityKey(ctx: C): null {
  contactShadow(ctx, 10, 150, 250, 40, 0.45);
  ctx.save();
  ctx.rotate(-0.3);
  ctx.lineJoin = 'round';
  const stroke = '#6e4a0c';
  // Haste, anéis do colar e o palhetão com dois dentes.
  ctx.fillStyle = linear(ctx, 0, -12, 0, 12, GOLD);
  roundRect(ctx, { x: -96, y: -11, w: 300, h: 22 }, 6);
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  for (const x of [-92, -64]) {
    ctx.fillStyle = linear(ctx, 0, -20, 0, 20, GOLD);
    roundRect(ctx, { x, y: -19, w: 16, h: 38 }, 5);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = linear(ctx, 150, 0, 210, 80, GOLD);
  poly(ctx, [
    [150, 8],
    [206, 8],
    [206, 78],
    [190, 78],
    [190, 56],
    [176, 56],
    [176, 78],
    [150, 78],
  ]);
  ctx.fill();
  ctx.stroke();
  // O arco, com o trevo vazado.
  ctx.fillStyle = radial(ctx, -170, -24, 8, -150, 0, 72, [
    [0, '#fff6c8'],
    [0.5, '#e8b83a'],
    [1, '#9a6a10'],
  ]);
  ctx.beginPath();
  ctx.arc(-152, 0, 66, 0, Math.PI * 2);
  for (const [dx, dy] of [
    [0, -22],
    [20, 12],
    [-20, 12],
  ] as const) {
    ctx.moveTo(-152 + dx + 17, dy);
    ctx.arc(-152 + dx, dy, 17, 0, Math.PI * 2);
  }
  ctx.fill('evenodd');
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 248, 210, 0.7)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(-152, 0, 56, Math.PI * 1.05, Math.PI * 1.55);
  ctx.stroke();
  // A fita vermelha amarrada no arco.
  ctx.fillStyle = linear(ctx, -230, -90, -170, -40, [
    [0, '#ef4444'],
    [1, '#991b1b'],
  ]);
  for (const [cx, cy, rx, ry, rot] of [
    [-222, -78, 30, 15, -0.7],
    [-188, -96, 30, 14, 0.5],
  ] as const) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
    ctx.fill();
  }
  poly(ctx, [
    [-206, -84],
    [-246, -10],
    [-232, -6],
    [-200, -70],
  ]);
  ctx.fill();
  poly(ctx, [
    [-200, -84],
    [-196, 2],
    [-182, -2],
    [-192, -74],
  ]);
  ctx.fill();
  ctx.fillStyle = '#7f1d1d';
  ctx.beginPath();
  ctx.ellipse(-203, -84, 11, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  glint(ctx, -130, -54, 14);
  glint(ctx, 120, -60, 9);
  return null;
}

function goldenCorn(ctx: C, rng: Rng): null {
  contactShadow(ctx, 0, 180, 170, 30, 0.45);
  ctx.save();
  ctx.rotate(-0.28);
  const top = -190;
  const bottom = 150;
  const halfW = (y: number) => {
    const t = (y - top) / (bottom - top);
    return (
      56 * Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.5 + 0.25) * (1 - Math.max(0, t - 0.85) * 2)
    );
  };
  // O sabugo, com os grãos em fileiras; um grão falta (o Atlas).
  ctx.beginPath();
  for (let y = top; y <= bottom; y += 6) ctx.lineTo(halfW(y), y);
  for (let y = bottom; y >= top; y -= 6) ctx.lineTo(-halfW(y), y);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, -60, 0, 60, 0, [
    [0, '#8a5a08'],
    [0.4, '#e8b628'],
    [0.6, '#f7d55a'],
    [1, '#9a6a0c'],
  ]);
  ctx.fill();
  const missing = { row: 7, col: 2 };
  for (let row = 0; row < 15; row++) {
    const y = top + 20 + row * 21;
    const w = halfW(y);
    for (let col = -3; col <= 3; col++) {
      const u = col / 3.4;
      const x = Math.sin(u * 1.2) * w * 0.92 + (row % 2) * 3;
      const kw = 15 * Math.cos(u * 1.1);
      if (kw < 4) continue;
      if (row === missing.row && col === missing.col) {
        ctx.fillStyle = '#4a2e05';
        roundRect(ctx, { x: x - kw / 2, y: y - 8, w: kw, h: 16 }, 4);
        ctx.fill();
        continue;
      }
      ctx.fillStyle = linear(ctx, x - kw / 2, y - 8, x + kw / 2, y + 8, [
        [0, '#fff0a0'],
        [0.5, '#f2c437'],
        [1, '#b8860b'],
      ]);
      roundRect(ctx, { x: x - kw / 2, y: y - 8, w: kw, h: 16 }, 5);
      ctx.fill();
      if (rng.next() < 0.5) {
        ctx.fillStyle = 'rgba(255, 255, 240, 0.7)';
        ctx.fillRect(x - kw / 4, y - 5, 3, 3);
      }
    }
  }
  // A palha na base, também com respingos de tinta dourada.
  const straw = linear(ctx, -80, 100, 80, 200, [
    [0, '#efe1a8'],
    [1, '#b39552'],
  ]);
  for (const side of [-1, 1, 0]) {
    ctx.fillStyle = straw;
    ctx.beginPath();
    ctx.moveTo(side * 6, 210);
    ctx.bezierCurveTo(
      side * 80 - 10,
      170,
      side * 70,
      40,
      side * 30 + side * 4,
      -10 + Math.abs(side) * 30,
    );
    ctx.bezierCurveTo(side * 40, 60, side * 26, 150, side * 6 + 16, 210);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(120, 92, 40, 0.5)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  ctx.restore();
  glint(ctx, -30, -120, 12);
  return null;
}

function brazilNut(ctx: C, rng: Rng): null {
  contactShadow(ctx, -40, 130, 170, 34, 0.5);
  // O ouriço, cortado no alto, com as castanhas dentro.
  const ox = -70;
  const oy = 10;
  ctx.fillStyle = radial(ctx, ox - 40, oy - 50, 10, ox, oy, 120, [
    [0, '#a7743f'],
    [0.6, '#6e4520'],
    [1, '#3d240e'],
  ]);
  ctx.beginPath();
  ctx.arc(ox, oy, 115, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 90; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = Math.sqrt(rng.next()) * 108;
    ctx.fillStyle = rng.next() < 0.5 ? 'rgba(40, 22, 8, 0.35)' : 'rgba(200, 160, 110, 0.22)';
    ctx.fillRect(ox + Math.cos(a) * r, oy + Math.sin(a) * r, 2.5, 2.5);
  }
  ctx.fillStyle = '#24140a';
  ctx.beginPath();
  ctx.ellipse(ox, oy - 62, 76, 32, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const sx = ox + Math.cos(a) * 34;
    const sy = oy - 62 + Math.sin(a) * 13;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillStyle = linear(ctx, -12, -18, 12, 18, [
      [0, '#9a6a3c'],
      [1, '#4b2c12'],
    ]);
    poly(ctx, [
      [0, -20],
      [13, 10],
      [-13, 10],
    ]);
    ctx.fill();
    ctx.restore();
  }
  ctx.strokeStyle = 'rgba(230, 200, 150, 0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(ox, oy - 62, 76, 32, 0, Math.PI, Math.PI * 2);
  ctx.stroke();
  // Uma semente na frente, já brotando.
  ctx.save();
  ctx.translate(150, 96);
  ctx.rotate(-0.4);
  ctx.fillStyle = linear(ctx, -30, -40, 30, 40, [
    [0, '#a97848'],
    [0.5, '#6b4220'],
    [1, '#3e2410'],
  ]);
  ctx.beginPath();
  ctx.moveTo(0, -48);
  ctx.quadraticCurveTo(36, -8, 30, 34);
  ctx.quadraticCurveTo(0, 48, -30, 34);
  ctx.quadraticCurveTo(-36, -8, 0, -48);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 220, 170, 0.4)';
  ctx.lineWidth = 2;
  for (const dx of [-14, 0, 14]) {
    ctx.beginPath();
    ctx.moveTo(dx * 0.3, -40);
    ctx.quadraticCurveTo(dx, 0, dx * 1.3, 36);
    ctx.stroke();
  }
  ctx.strokeStyle = '#3f8f2a';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -46);
  ctx.bezierCurveTo(-4, -80, 18, -96, 10, -124);
  ctx.stroke();
  ctx.fillStyle = '#65a30d';
  for (const [x, y, rot] of [
    [-12, -112, -0.8],
    [28, -118, 0.7],
  ] as const) {
    ctx.beginPath();
    ctx.ellipse(x, y, 22, 9, rot, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  return null;
}

function oreNugget(ctx: C, rng: Rng): null {
  // A base de madeira com a plaquinha de latão.
  contactShadow(ctx, 0, 182, 200, 24, 0.5);
  ctx.fillStyle = linear(ctx, 0, 120, 0, 180, [
    [0, '#8a5a32'],
    [1, '#4a2c15'],
  ]);
  roundRect(ctx, { x: -150, y: 124, w: 300, h: 56 }, 10);
  ctx.fill();
  ctx.fillStyle = '#a06c3c';
  roundRect(ctx, { x: -150, y: 116, w: 300, h: 18 }, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40, 20, 6, 0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const y = 140 + i * 6;
    ctx.beginPath();
    ctx.moveTo(-140, y + rng.range(-1, 1));
    ctx.bezierCurveTo(-60, y + 3, 40, y - 3, 140, y + rng.range(-1, 1));
    ctx.stroke();
  }
  ctx.fillStyle = linear(ctx, -36, 0, 36, 0, GOLD);
  roundRect(ctx, { x: -36, y: 146, w: 72, h: 18 }, 3);
  ctx.fill();
  // A pepita: uma pedra irregular de hematita, com a luz do alto à esquerda, as facetas lascadas
  // e o brilho metálico.
  const cx = 0;
  const cy = 36;
  const n = 16;
  const rim: Pt[] = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const r = 1 + Math.sin(a * 3 + 0.7) * 0.09 + rng.range(-0.06, 0.06);
    return [cx + Math.cos(a) * 128 * r, cy + Math.sin(a) * 82 * r - Math.max(0, -Math.sin(a)) * 20];
  });
  const blob = () => {
    ctx.beginPath();
    rim.forEach((p, i) => {
      const q = rim[(i + 1) % n] as Pt;
      const mid: Pt = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      if (i === 0) ctx.moveTo(mid[0], mid[1]);
      else ctx.quadraticCurveTo(p[0], p[1], mid[0], mid[1]);
    });
    const first = rim[0] as Pt;
    const second = rim[1] as Pt;
    ctx.quadraticCurveTo(
      first[0],
      first[1],
      (first[0] + second[0]) / 2,
      (first[1] + second[1]) / 2,
    );
    ctx.closePath();
  };
  blob();
  ctx.fillStyle = radial(ctx, cx - 50, cy - 50, 10, cx, cy, 150, [
    [0, '#8e5a48'],
    [0.45, '#5a3328'],
    [1, '#24130f'],
  ]);
  ctx.fill();
  ctx.save();
  blob();
  ctx.clip();
  // Facetas: planos mais claros e mais escuros, lascados.
  for (let i = 0; i < 9; i++) {
    const fx = cx + rng.range(-100, 100);
    const fy = cy + rng.range(-60, 50);
    const size = rng.range(24, 46);
    const a = rng.range(0, Math.PI);
    const lightSide = fx + fy < cx + cy;
    ctx.fillStyle = lightSide ? 'rgba(220, 170, 150, 0.18)' : 'rgba(10, 4, 2, 0.28)';
    poly(ctx, [
      [fx + Math.cos(a) * size, fy + Math.sin(a) * size * 0.7],
      [fx + Math.cos(a + 2.1) * size, fy + Math.sin(a + 2.1) * size * 0.7],
      [fx + Math.cos(a + 4.2) * size * 0.8, fy + Math.sin(a + 4.2) * size * 0.6],
    ]);
    ctx.fill();
  }
  // A ferrugem nas reentrâncias.
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(170, 72, 30, ${rng.range(0.2, 0.45)})`;
    ctx.beginPath();
    ctx.arc(cx + rng.range(-120, 120), cy + rng.range(-70, 70), rng.range(1.5, 5), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(20, 8, 4, 0.6)';
  ctx.lineWidth = 2;
  blob();
  ctx.stroke();
  for (let i = 0; i < 22; i++) {
    const a = rng.range(Math.PI * 0.9, Math.PI * 1.7);
    const r = rng.range(0.2, 0.85);
    glint(
      ctx,
      cx + Math.cos(a) * 120 * r,
      cy + Math.sin(a) * 76 * r,
      rng.range(1.5, 5),
      'rgba(235, 240, 250, 0.85)',
    );
  }
  return null;
}

function azulejo(ctx: C, side: number, rng: Rng): Box | null {
  contactShadow(ctx, 10, 176, 200, 26, 0.45);
  ctx.save();
  ctx.rotate(-0.05);
  const s = 300;
  const x0 = -s / 2;
  const y0 = -s / 2 - 10;
  // O canto lascado (de baixo, à direita; no verso, de baixo, à esquerda).
  const chip = (mirror: boolean): Pt[] => {
    const cx = mirror ? x0 : x0 + s;
    const sx = mirror ? 1 : -1;
    return [
      [cx + sx * 46, y0 + s],
      [cx + sx * 30, y0 + s - 10],
      [cx + sx * 20, y0 + s - 26],
      [cx + sx * 6, y0 + s - 34],
      [cx, y0 + s - 50],
    ];
  };
  const outline = (mirror: boolean): Pt[] =>
    mirror
      ? [[x0 + s, y0], [x0 + s, y0 + s], ...chip(true), [x0, y0]]
      : [[x0, y0], [x0 + s, y0], ...chip(false).reverse(), [x0, y0 + s]];
  // Espessura do azulejo.
  ctx.fillStyle = '#a65a2e';
  poly(
    ctx,
    outline(side === 1).map(([x, y]) => [x + 7, y + 9] as Pt),
  );
  ctx.fill();
  if (side === 0) {
    ctx.fillStyle = linear(ctx, x0, y0, x0 + s, y0 + s, [
      [0, '#fbfcfd'],
      [1, '#e6ecf2'],
    ]);
    poly(ctx, outline(false));
    ctx.fill();
    ctx.save();
    poly(ctx, outline(false));
    ctx.clip();
    const blue = '#1d4ed8';
    const navy = '#1e3a8a';
    const cx = 0;
    const cy = y0 + s / 2;
    // Quartos de círculo nos cantos (fecham o desenho com os vizinhos).
    for (const [qx, qy] of [
      [x0, y0],
      [x0 + s, y0],
      [x0, y0 + s],
      [x0 + s, y0 + s],
    ] as const) {
      ctx.fillStyle = blue;
      ctx.beginPath();
      ctx.arc(qx, qy, 70, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f4f7fb';
      ctx.beginPath();
      ctx.arc(qx, qy, 52, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = navy;
      ctx.beginPath();
      ctx.arc(qx, qy, 30, 0, Math.PI * 2);
      ctx.fill();
    }
    // A flor de oito pétalas no centro.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.fillStyle = i % 2 === 0 ? blue : navy;
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * 44, cy + Math.sin(a) * 44, 36, 15, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#f4f7fb';
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = navy;
    ctx.beginPath();
    ctx.arc(cx, cy, 11, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      ctx.fillStyle = blue;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * 92, cy + Math.sin(a) * 92, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = navy;
    ctx.lineWidth = 4;
    ctx.strokeRect(x0 + 6, y0 + 6, s - 12, s - 12);
    // Craquelê e o brilho do vidrado.
    ctx.strokeStyle = 'rgba(80, 90, 110, 0.22)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 9; i++) {
      let x = rng.range(x0, x0 + s);
      let y = rng.range(y0, y0 + s);
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        x += rng.range(-30, 30);
        y += rng.range(-30, 30);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.fillStyle = linear(ctx, x0, y0, x0 + s * 0.6, y0 + s * 0.6, [
      [0, 'rgba(255, 255, 255, 0.55)'],
      [0.5, 'rgba(255, 255, 255, 0)'],
    ]);
    ctx.fillRect(x0, y0, s, s);
    ctx.restore();
    ctx.fillStyle = '#c0703f';
    poly(ctx, [...chip(false), [x0 + s, y0 + s]]);
    ctx.fill();
    ctx.restore();
    return null;
  }
  // O verso (tardoz): barro cru, os frisos e restos de argamassa.
  ctx.fillStyle = linear(ctx, x0, y0, x0 + s, y0 + s, [
    [0, '#c77b48'],
    [1, '#9e5530'],
  ]);
  poly(ctx, outline(true));
  ctx.fill();
  ctx.save();
  poly(ctx, outline(true));
  ctx.clip();
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = rng.next() < 0.5 ? 'rgba(80, 36, 14, 0.28)' : 'rgba(240, 190, 150, 0.22)';
    ctx.fillRect(rng.range(x0, x0 + s), rng.range(y0, y0 + s), rng.range(1, 3), rng.range(1, 3));
  }
  // Restos de argamassa, nas bordas (o meio ficou livre para o bilhete da Helena).
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = 'rgba(168, 162, 158, 0.75)';
    ctx.beginPath();
    const edge = i % 4;
    const along = rng.range(x0 + 30, x0 + s - 30);
    const mx = edge === 0 ? along : edge === 1 ? x0 + 16 : edge === 2 ? along : x0 + s - 16;
    const my =
      edge === 0
        ? y0 + 16
        : edge === 1
          ? rng.range(y0 + 30, y0 + s - 30)
          : edge === 2
            ? y0 + s - 16
            : rng.range(y0 + 30, y0 + s - 30);
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      const r = rng.range(10, 26);
      if (k === 0) ctx.moveTo(mx + Math.cos(a) * r, my + Math.sin(a) * r);
      else ctx.lineTo(mx + Math.cos(a) * r, my + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(70, 30, 10, 0.4)';
  ctx.lineWidth = 6;
  for (const f of [0.1, 0.9]) {
    ctx.beginPath();
    ctx.moveTo(x0 + 14, y0 + s * f);
    ctx.lineTo(x0 + s - 14, y0 + s * f);
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
  return { x: x0 + 30, y: y0 + 44, w: s - 60, h: s - 88 };
}

function bottleMap(ctx: C, rng: Rng): null {
  contactShadow(ctx, -10, 120, 250, 34, 0.5);
  // Areia e uma conchinha.
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(214, 186, 128, ${rng.range(0.3, 0.7)})`;
    ctx.fillRect(rng.range(-220, 160), rng.range(112, 150), 2, 2);
  }
  ctx.fillStyle = '#f2d4c0';
  ctx.beginPath();
  ctx.moveTo(-200, 150);
  ctx.arc(-200, 150, 18, Math.PI, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(160, 100, 80, 0.6)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const a = Math.PI + ((i + 0.5) / 5) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(-200, 150);
    ctx.lineTo(-200 + Math.cos(a) * 18, 150 + Math.sin(a) * 18);
    ctx.stroke();
  }
  ctx.save();
  ctx.rotate(-0.18);
  // O rolo de papel dentro, amarrado com barbante.
  ctx.fillStyle = linear(ctx, 0, -32, 0, 32, [
    [0, '#f3e3b8'],
    [0.5, '#e2cc94'],
    [1, '#b99c5c'],
  ]);
  roundRect(ctx, { x: -150, y: -32, w: 230, h: 64 }, 10);
  ctx.fill();
  ctx.strokeStyle = '#9a7c40';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(-150, 0, 12, 31, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  for (let a = 0; a < Math.PI * 5; a += 0.3) {
    const r = 2 + a * 1.6;
    ctx.lineTo(-150 + Math.cos(a) * r * 0.35, Math.sin(a) * r);
  }
  ctx.stroke();
  ctx.fillStyle = '#b91c1c';
  ctx.fillRect(-40, -33, 8, 66);
  // O vidro verde: corpo, gargalo e a rolha.
  ctx.fillStyle = linear(ctx, 0, -70, 0, 70, [
    [0, 'rgba(110, 200, 150, 0.55)'],
    [0.5, 'rgba(22, 110, 70, 0.42)'],
    [1, 'rgba(8, 60, 36, 0.7)'],
  ]);
  ctx.beginPath();
  ctx.moveTo(-200, -66);
  ctx.lineTo(80, -66);
  ctx.bezierCurveTo(120, -66, 120, -26, 150, -26);
  ctx.lineTo(196, -26);
  ctx.lineTo(196, 26);
  ctx.lineTo(150, 26);
  ctx.bezierCurveTo(120, 26, 120, 66, 80, 66);
  ctx.lineTo(-200, 66);
  ctx.quadraticCurveTo(-232, 66, -232, 0);
  ctx.quadraticCurveTo(-232, -66, -200, -66);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(4, 40, 22, 0.7)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = 'rgba(30, 120, 80, 0.75)';
  roundRect(ctx, { x: 190, y: -31, w: 14, h: 62 }, 4);
  ctx.fill();
  ctx.fillStyle = linear(ctx, 0, -24, 0, 24, [
    [0, '#c99a62'],
    [1, '#7a5228'],
  ]);
  roundRect(ctx, { x: 204, y: -23, w: 44, h: 46 }, 6);
  ctx.fill();
  for (let i = 0; i < 18; i++) {
    ctx.fillStyle = 'rgba(70, 40, 16, 0.5)';
    ctx.fillRect(rng.range(208, 244), rng.range(-20, 20), 2, 2);
  }
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-190, -50);
  ctx.lineTo(60, -50);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(130, -18);
  ctx.lineTo(186, -18);
  ctx.stroke();
  ctx.restore();
  return null;
}

function goldRing(ctx: C): null {
  contactShadow(ctx, 0, 160, 150, 26, 0.5);
  ctx.save();
  ctx.translate(0, -6);
  ctx.fillStyle = linear(ctx, -120, -120, 120, 120, GOLD);
  ctx.beginPath();
  ctx.ellipse(0, 0, 128, 132, 0, 0, Math.PI * 2);
  ctx.ellipse(0, -2, 90, 94, 0, 0, Math.PI * 2);
  ctx.fill('evenodd');
  // O lado de dentro do aro, mais escuro, e o brilho de fora.
  ctx.strokeStyle = 'rgba(120, 80, 10, 0.75)';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.ellipse(0, 2, 92, 95, 0, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 250, 220, 0.85)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(0, 0, 118, 122, 0, Math.PI * 1.08, Math.PI * 1.45);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(110, 70, 8, 0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 128, 132, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  glint(ctx, -88, -84, 22);
  glint(ctx, 104, 52, 12);
  glint(ctx, 30, -126, 9);
  return null;
}

function greenPipe(ctx: C): null {
  contactShadow(ctx, 0, 178, 160, 22, 0.5);
  ctx.fillStyle = linear(ctx, 0, 150, 0, 182, [
    [0, '#4b5563'],
    [1, '#1f2937'],
  ]);
  roundRect(ctx, { x: -120, y: 150, w: 240, h: 30 }, 8);
  ctx.fill();
  const body = (x: number, w: number) =>
    linear(ctx, x, 0, x + w, 0, [
      [0, '#0f3d22'],
      [0.25, '#4ade80'],
      [0.45, '#22c55e'],
      [1, '#0f4d28'],
    ]);
  ctx.fillStyle = body(-72, 144);
  ctx.fillRect(-72, -64, 144, 216);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(-72, -64, 144, 12);
  ctx.fillStyle = body(-94, 188);
  roundRect(ctx, { x: -94, y: -126, w: 188, h: 70 }, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(5, 40, 18, 0.7)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = radial(ctx, 0, -126, 4, 0, -126, 86, [
    [0, '#020604'],
    [1, '#0b2a17'],
  ]);
  ctx.beginPath();
  ctx.ellipse(0, -126, 84, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(180, 255, 200, 0.5)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-52, -112);
  ctx.lineTo(-52, -66);
  ctx.moveTo(-40, -50);
  ctx.lineTo(-40, 140);
  ctx.stroke();
  return null;
}

function orangeSphere(ctx: C): null {
  contactShadow(ctx, 0, 168, 140, 22, 0.5);
  // O suporte de madeira.
  ctx.fillStyle = linear(ctx, 0, 118, 0, 168, [
    [0, '#8b5a2b'],
    [1, '#4a2c12'],
  ]);
  ctx.beginPath();
  ctx.ellipse(0, 130, 96, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-70, 130, 140, 30);
  ctx.beginPath();
  ctx.ellipse(0, 160, 70, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = radial(ctx, -44, -60, 10, 0, -20, 128, [
    [0, '#fff3cf'],
    [0.28, '#fdba74'],
    [0.7, '#f97316'],
    [1, '#b8400c'],
  ]);
  ctx.beginPath();
  ctx.arc(0, -20, 124, 0, Math.PI * 2);
  ctx.fill();
  // Brilhos soltos lá dentro (genéricos, sem estrelas desenhadas).
  for (const [x, y, r] of [
    [-46, -36, 18],
    [30, -66, 12],
    [40, 4, 15],
    [-10, 34, 10],
  ] as const) {
    glint(ctx, x, y, r, 'rgba(255, 251, 235, 0.92)');
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.beginPath();
  ctx.ellipse(-52, -88, 36, 18, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 220, 140, 0.55)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, -20, 114, 0.1, 1.3);
  ctx.stroke();
  return null;
}

function geodeticTriangle(ctx: C): null {
  contactShadow(ctx, 0, 150, 200, 26, 0.45);
  const A: Pt = [-170, 120];
  const B: Pt = [170, 120];
  const T: Pt = [0, -178];
  // O canto de baixo, à direita, quebrado.
  const broken: Pt[] = [
    [126, 120],
    [118, 104],
    [134, 92],
    [128, 74],
    [146, 64],
  ];
  const shape: Pt[] = [A, ...broken, T];
  ctx.fillStyle = '#8a6210';
  poly(
    ctx,
    shape.map(([x, y]) => [x + 6, y + 8] as Pt),
  );
  ctx.fill();
  ctx.fillStyle = linear(ctx, -150, -150, 150, 150, GOLD);
  poly(ctx, shape);
  ctx.fill();
  ctx.strokeStyle = '#7a5208';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 246, 200, 0.75)';
  ctx.lineWidth = 2;
  poly(ctx, [
    [-146, 106],
    [104, 106],
    [0, -150],
  ]);
  ctx.stroke();
  // A rede de triangulação gravada.
  const mid = (p: Pt, q: Pt): Pt => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const ab = mid(A, B);
  const at = mid(A, T);
  const bt = mid(B, T);
  const c: Pt = [0, 20];
  const engrave = (p: Pt, q: Pt) => {
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 244, 190, 0.8)';
    ctx.beginPath();
    ctx.moveTo(p[0], p[1] + 1);
    ctx.lineTo(q[0], q[1] + 1);
    ctx.stroke();
    ctx.strokeStyle = '#7a5208';
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    ctx.lineTo(q[0], q[1]);
    ctx.stroke();
  };
  engrave(ab, at);
  engrave(at, bt);
  engrave(bt, [116, 94]);
  for (const v of [A, T, ab, at, bt]) engrave(c, v);
  for (const [x, y] of [ab, at, bt, c]) {
    ctx.fillStyle = '#7a5208';
    poly(ctx, [
      [x, y - 7],
      [x + 7, y + 5],
      [x - 7, y + 5],
    ]);
    ctx.fill();
  }
  glint(ctx, -60, -40, 16);
  glint(ctx, 40, -120, 9);
  return null;
}

function cubicOre(ctx: C, rng: Rng): null {
  contactShadow(ctx, 0, 196, 190, 30, 0.5);
  const top: Pt[] = [
    [0, -170],
    [150, -84],
    [0, 2],
    [-150, -84],
  ];
  const left: Pt[] = [
    [-150, -84],
    [0, 2],
    [0, 176],
    [-150, 90],
  ];
  const right: Pt[] = [
    [0, 2],
    [150, -84],
    [150, 90],
    [0, 176],
  ];
  const faces: Array<[Pt[], string, string]> = [
    [top, '#a8a29e', '#d6d3d1'],
    [left, '#78716c', '#a8a29e'],
    [right, '#57534e', '#78716c'],
  ];
  for (const [face, dark, light] of faces) {
    const [p0, , p2] = face as [Pt, Pt, Pt, Pt];
    ctx.fillStyle = linear(ctx, p0[0], p0[1], p2[0], p2[1], [
      [0, light],
      [1, dark],
    ]);
    poly(ctx, face);
    ctx.fill();
    ctx.save();
    poly(ctx, face);
    ctx.clip();
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = rng.next() < 0.5 ? 'rgba(40, 36, 32, 0.25)' : 'rgba(250, 250, 245, 0.18)';
      ctx.fillRect(rng.range(-150, 150), rng.range(-170, 176), rng.range(1, 4), rng.range(1, 4));
    }
    // Veios de cristal azul que atravessam a face.
    for (let v = 0; v < 3; v++) {
      ctx.strokeStyle = v === 0 ? 'rgba(186, 230, 253, 0.85)' : 'rgba(56, 189, 248, 0.8)';
      ctx.lineWidth = v === 0 ? 2 : 4;
      ctx.beginPath();
      let x = rng.range(-150, 150);
      let y = rng.range(-170, 176);
      ctx.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        x += rng.range(-40, 40);
        y += rng.range(-30, 30);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  // Arestas perfeitas: claras em cima, escuras embaixo.
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 255, 250, 0.7)';
  poly(ctx, top);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(28, 25, 23, 0.6)';
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.lineTo(0, 176);
  ctx.moveTo(-150, 90);
  ctx.lineTo(0, 176);
  ctx.lineTo(150, 90);
  ctx.stroke();
  return null;
}

function theodoliteSword(ctx: C): null {
  contactShadow(ctx, 10, 150, 240, 26, 0.42);
  ctx.save();
  ctx.rotate(-0.42);
  ctx.translate(20, 0);
  // Lâmina graduada, com o sulco no meio.
  ctx.fillStyle = linear(ctx, 0, -17, 0, 17, [
    [0, '#f8fafc'],
    [0.45, '#cbd5e1'],
    [0.55, '#94a3b8'],
    [1, '#e2e8f0'],
  ]);
  ctx.beginPath();
  ctx.moveTo(-110, -17);
  ctx.lineTo(214, -17);
  ctx.lineTo(262, 0);
  ctx.lineTo(214, 17);
  ctx.lineTo(-110, 17);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(71, 85, 105, 0.6)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-100, 0);
  ctx.lineTo(200, 0);
  ctx.stroke();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.2;
  for (let i = 0; i <= 30; i++) {
    const x = -96 + i * 10;
    const len = i % 5 === 0 ? 9 : 5;
    ctx.beginPath();
    ctx.moveTo(x, -17);
    ctx.lineTo(x, -17 + len);
    ctx.stroke();
  }
  // Guarda com o nível de bolha e a luneta em cima.
  ctx.fillStyle = linear(ctx, -128, -64, -110, 64, [
    [0, '#e9c46a'],
    [0.5, '#b7862e'],
    [1, '#7a5418'],
  ]);
  roundRect(ctx, { x: -130, y: -66, w: 22, h: 132 }, 8);
  ctx.fill();
  ctx.strokeStyle = '#5c3d0e';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = 'rgba(132, 204, 22, 0.85)';
  roundRect(ctx, { x: -126, y: -26, w: 14, h: 52 }, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.beginPath();
  ctx.ellipse(-119, -6, 4, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = linear(ctx, 0, -92, 0, -66, [
    [0, '#475569'],
    [1, '#1e293b'],
  ]);
  roundRect(ctx, { x: -152, y: -92, w: 66, h: 22 }, 6);
  ctx.fill();
  ctx.fillStyle = '#93c5fd';
  ctx.beginPath();
  ctx.ellipse(-86, -81, 5, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  // Punho de couro e o pomo com o vernier.
  ctx.fillStyle = '#5b3a1e';
  roundRect(ctx, { x: -214, y: -13, w: 84, h: 26 }, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(20, 10, 4, 0.6)';
  ctx.lineWidth = 2;
  for (let x = -208; x < -134; x += 10) {
    ctx.beginPath();
    ctx.moveTo(x, -13);
    ctx.lineTo(x + 8, 13);
    ctx.stroke();
  }
  ctx.fillStyle = radial(ctx, -238, -6, 2, -232, 0, 26, [
    [0, '#fbe7a1'],
    [1, '#9a6b1e'],
  ]);
  ctx.beginPath();
  ctx.arc(-234, 0, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#5c3d0e';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const r1 = i % 6 === 0 ? 12 : 17;
    ctx.beginPath();
    ctx.moveTo(-234 + Math.cos(a) * r1, Math.sin(a) * r1);
    ctx.lineTo(-234 + Math.cos(a) * 21, Math.sin(a) * 21);
    ctx.stroke();
  }
  ctx.restore();
  glint(ctx, 110, -80, 12);
  return null;
}

function cardboardBox(ctx: C, side: number, rng: Rng): Box | null {
  contactShadow(ctx, 0, 186, 230, 32, 0.5);
  if (side === 0) {
    const top: Pt[] = [
      [0, -168],
      [196, -92],
      [0, -16],
      [-196, -92],
    ];
    const left: Pt[] = [
      [-196, -92],
      [0, -16],
      [0, 170],
      [-196, 94],
    ];
    const right: Pt[] = [
      [0, -16],
      [196, -92],
      [196, 94],
      [0, 170],
    ];
    for (const [face, color] of [
      [top, '#cfa26a'],
      [left, '#b8874f'],
      [right, '#94683a'],
    ] as const) {
      ctx.fillStyle = color;
      poly(ctx, face);
      ctx.fill();
      ctx.strokeStyle = 'rgba(70, 44, 18, 0.55)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // Junta das abas e a fita.
    ctx.strokeStyle = 'rgba(80, 50, 20, 0.6)';
    ctx.beginPath();
    ctx.moveTo(-98, -130);
    ctx.lineTo(98, -54);
    ctx.stroke();
    ctx.fillStyle = 'rgba(232, 206, 150, 0.85)';
    poly(ctx, [
      [-118, -122],
      [-80, -138],
      [118, -62],
      [80, -46],
    ]);
    ctx.fill();
    poly(ctx, [
      [80, -46],
      [118, -62],
      [118, 0],
      [80, 16],
    ]);
    ctx.fill();
    // Pictogramas genéricos: "este lado para cima" e "frágil".
    ctx.strokeStyle = '#3f2a12';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.save();
    ctx.transform(1, 0.39, 0, 1, -150, 10);
    for (const dx of [0, 22]) {
      ctx.beginPath();
      ctx.moveTo(dx + 10, 40);
      ctx.lineTo(dx + 10, 4);
      ctx.moveTo(dx + 2, 14);
      ctx.lineTo(dx + 10, 4);
      ctx.lineTo(dx + 18, 14);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(0, 46);
    ctx.lineTo(30, 46);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(70, 4);
    ctx.lineTo(96, 4);
    ctx.quadraticCurveTo(94, 26, 83, 28);
    ctx.quadraticCurveTo(72, 26, 70, 4);
    ctx.moveTo(83, 28);
    ctx.lineTo(83, 44);
    ctx.moveTo(74, 46);
    ctx.lineTo(92, 46);
    ctx.stroke();
    ctx.restore();
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = 'rgba(70, 44, 18, 0.18)';
      ctx.fillRect(rng.range(-180, 180), rng.range(-150, 160), 2, 2);
    }
    return null;
  }
  // Aberta, vista de cima: as abas para fora e o fundo, com o bilhete.
  const inner: Box = { x: -150, y: -126, w: 300, h: 260 };
  ctx.fillStyle = '#b8874f';
  for (const flap of [
    [
      [inner.x, inner.y],
      [inner.x + inner.w, inner.y],
      [inner.x + inner.w - 30, inner.y - 70],
      [inner.x + 30, inner.y - 70],
    ],
    [
      [inner.x, inner.y + inner.h],
      [inner.x + inner.w, inner.y + inner.h],
      [inner.x + inner.w - 30, inner.y + inner.h + 60],
      [inner.x + 30, inner.y + inner.h + 60],
    ],
    [
      [inner.x, inner.y],
      [inner.x, inner.y + inner.h],
      [inner.x - 80, inner.y + inner.h - 30],
      [inner.x - 80, inner.y + 30],
    ],
    [
      [inner.x + inner.w, inner.y],
      [inner.x + inner.w, inner.y + inner.h],
      [inner.x + inner.w + 80, inner.y + inner.h - 30],
      [inner.x + inner.w + 80, inner.y + 30],
    ],
  ] as Pt[][]) {
    poly(ctx, flap);
    ctx.fill();
    ctx.strokeStyle = 'rgba(70, 44, 18, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.fillStyle = '#7a532a';
  ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
  ctx.fillStyle = linear(ctx, inner.x, inner.y, inner.x, inner.y + 60, [
    [0, 'rgba(20, 10, 2, 0.55)'],
    [1, 'rgba(20, 10, 2, 0)'],
  ]);
  ctx.fillRect(inner.x, inner.y, inner.w, 60);
  const note: Box = { x: -116, y: -92, w: 232, h: 196 };
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(note.x + 5, note.y + 6, note.w, note.h);
  ctx.fillStyle = '#f2ead6';
  ctx.fillRect(note.x, note.y, note.w, note.h);
  return { x: note.x + 14, y: note.y + 12, w: note.w - 28, h: note.h - 24 };
}

function bmx(ctx: C): null {
  contactShadow(ctx, 0, 160, 230, 20, 0.5);
  const wheel = (cx: number) => {
    ctx.lineWidth = 13;
    ctx.strokeStyle = '#1f2937';
    ctx.beginPath();
    ctx.arc(cx, 74, 76, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.arc(cx, 74, 66, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.85)';
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, 74);
      ctx.lineTo(cx + Math.cos(a) * 65, 74 + Math.sin(a) * 65);
      ctx.stroke();
    }
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.arc(cx, 74, 8, 0, Math.PI * 2);
    ctx.fill();
  };
  wheel(-128);
  wheel(128);
  const tube = (pts: readonly Pt[], color = '#dc2626', width = 12) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.stroke();
  };
  const bb: Pt = [-8, 84];
  const seatTop: Pt = [-46, -18];
  const head: Pt = [96, -34];
  const headLow: Pt = [102, 4];
  tube([[-128, 74], bb, seatTop, [-128, 74]]);
  tube([seatTop, head]);
  tube([headLow, bb]);
  tube([head, headLow], '#b91c1c', 14);
  tube([headLow, [128, 74]], '#cbd5e1', 9);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(seatTop[0] + 8, seatTop[1] - 4);
  ctx.lineTo(head[0] - 8, head[1] - 5);
  ctx.stroke();
  // Guidão, banco, coroa, pedivela e corrente.
  tube([head, [92, -80]], '#9ca3af', 8);
  tube(
    [
      [56, -74],
      [92, -80],
      [124, -94],
    ],
    '#9ca3af',
    7,
  );
  tube(
    [
      [48, -76],
      [62, -73],
    ],
    '#111827',
    11,
  );
  ctx.fillStyle = '#111827';
  ctx.beginPath();
  ctx.ellipse(-50, -30, 32, 10, -0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#6b7280';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(bb[0], bb[1]);
  ctx.lineTo(-128, 70);
  ctx.moveTo(bb[0], bb[1] + 16);
  ctx.lineTo(-128, 80);
  ctx.stroke();
  ctx.fillStyle = '#9ca3af';
  ctx.beginPath();
  ctx.arc(bb[0], bb[1], 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4b5563';
  ctx.beginPath();
  ctx.arc(bb[0], bb[1], 10, 0, Math.PI * 2);
  ctx.fill();
  tube([bb, [26, 118]], '#4b5563', 7);
  tube(
    [
      [14, 120],
      [40, 120],
    ],
    '#111827',
    8,
  );
  return null;
}

function backwardsCap(ctx: C): null {
  contactShadow(ctx, 0, 112, 230, 30, 0.5);
  // A aba vai para trás (à direita).
  ctx.fillStyle = linear(ctx, 60, 10, 250, 60, [
    [0, '#b91c1c'],
    [1, '#7f1d1d'],
  ]);
  ctx.beginPath();
  ctx.moveTo(70, 34);
  ctx.bezierCurveTo(150, 10, 240, 26, 262, 58);
  ctx.bezierCurveTo(220, 84, 140, 80, 64, 66);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(60, 10, 10, 0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 220, 220, 0.5)';
  ctx.beginPath();
  ctx.moveTo(84, 44);
  ctx.bezierCurveTo(150, 26, 220, 36, 250, 58);
  ctx.stroke();
  // A copa em gomos.
  ctx.fillStyle = radial(ctx, -60, -80, 10, -10, -10, 190, [
    [0, '#f87171'],
    [0.5, '#dc2626'],
    [1, '#8f1717'],
  ]);
  ctx.beginPath();
  ctx.moveTo(-160, 66);
  ctx.bezierCurveTo(-170, -70, -60, -140, 0, -140);
  ctx.bezierCurveTo(80, -140, 150, -70, 120, 66);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(70, 8, 8, 0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(80, 10, 10, 0.5)';
  ctx.lineWidth = 2.5;
  for (const x of [-96, -30, 44]) {
    ctx.beginPath();
    ctx.moveTo(-6, -138);
    ctx.quadraticCurveTo(x * 1.1, -60, x, 64);
    ctx.stroke();
  }
  ctx.fillStyle = '#7f1d1d';
  ctx.beginPath();
  ctx.ellipse(-6, -140, 14, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  // Na frente, a abertura da regulagem (o boné está virado).
  ctx.fillStyle = '#3f0d0d';
  ctx.beginPath();
  ctx.moveTo(-150, 66);
  ctx.quadraticCurveTo(-130, 10, -96, 12);
  ctx.quadraticCurveTo(-76, 30, -76, 66);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(-142, 40, 60, 10);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(-10, -10, 120, Math.PI * 1.15, Math.PI * 1.4);
  ctx.stroke();
  return null;
}

function exhaustPort(ctx: C, rng: Rng): null {
  contactShadow(ctx, 0, 190, 220, 26, 0.5);
  // A base de chapa com rebites.
  ctx.fillStyle = linear(ctx, -170, -170, 170, 170, [
    [0, '#94a3b8'],
    [1, '#334155'],
  ]);
  roundRect(ctx, { x: -176, y: -178, w: 352, h: 352 }, 10);
  ctx.fill();
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 3;
  ctx.stroke();
  for (let i = 0; i < 9; i++) {
    for (const [x, y] of [
      [-160 + i * 40, -162],
      [-160 + i * 40, 158],
      [-162, -160 + i * 40],
      [158, -160 + i * 40],
    ] as const) {
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.18)';
    ctx.fillRect(rng.range(-170, 170), rng.range(-170, 170), rng.range(2, 10), 1);
  }
  // O anel de parafusos, a grade e o furo.
  ctx.fillStyle = radial(ctx, -40, -40, 10, 0, -2, 130, [
    [0, '#64748b'],
    [1, '#1e293b'],
  ]);
  ctx.beginPath();
  ctx.arc(0, -2, 128, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 110, -2 + Math.sin(a) * 110, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 110, -2 + Math.sin(a) * 110, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(0, -2, 90, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 5;
  for (const r of [80, 60, 40]) {
    ctx.beginPath();
    ctx.arc(0, -2, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 26, -2 + Math.sin(a) * 26);
    ctx.lineTo(Math.cos(a) * 84, -2 + Math.sin(a) * 84);
    ctx.stroke();
  }
  ctx.fillStyle = radial(ctx, 0, -2, 2, 0, -2, 26, [
    [0, 'rgba(251, 146, 60, 0.55)'],
    [1, 'rgba(2, 6, 23, 1)'],
  ]);
  ctx.beginPath();
  ctx.arc(0, -2, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.45)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, -2, 124, Math.PI * 1.1, Math.PI * 1.45);
  ctx.stroke();
  return null;
}

function paintPistol(ctx: C, rng: Rng): null {
  contactShadow(ctx, 0, 176, 210, 26, 0.5);
  // Respingos rosa no tampo, à frente do bico.
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = `rgba(236, 72, 153, ${rng.range(0.55, 0.9)})`;
    ctx.beginPath();
    ctx.arc(rng.range(120, 250), rng.range(150, 196), rng.range(2, 9), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(-20, 10);
  // O cabo, inclinado para trás, com as estrias da empunhadura.
  ctx.fillStyle = linear(ctx, -150, 0, -80, 0, [
    [0, '#111827'],
    [0.5, '#374151'],
    [1, '#111827'],
  ]);
  ctx.beginPath();
  ctx.moveTo(-96, -18);
  ctx.lineTo(-52, -18);
  ctx.lineTo(-92, 140);
  ctx.quadraticCurveTo(-112, 156, -138, 146);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 6; i++) {
    const t = 0.2 + i * 0.12;
    ctx.beginPath();
    ctx.moveTo(-96 + (-138 + 96) * t + 6, -18 + 164 * t);
    ctx.lineTo(-52 + (-92 + 52) * t - 4, -18 + 158 * t);
    ctx.stroke();
  }
  // O gatilho.
  ctx.strokeStyle = '#9ca3af';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-40, 0);
  ctx.quadraticCurveTo(-26, 40, -44, 76);
  ctx.stroke();
  // O corpo de metal e o bico de latão.
  ctx.fillStyle = linear(ctx, 0, -40, 0, 10, [
    [0, '#e5e7eb'],
    [0.5, '#9ca3af'],
    [1, '#4b5563'],
  ]);
  roundRect(ctx, { x: -110, y: -42, w: 210, h: 44 }, 14);
  ctx.fill();
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = linear(ctx, 0, -32, 0, -6, GOLD);
  poly(ctx, [
    [100, -34],
    [150, -26],
    [150, -14],
    [100, -6],
  ]);
  ctx.fill();
  ctx.fillStyle = '#ec4899';
  ctx.beginPath();
  ctx.ellipse(154, -20, 6, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // O copo de tinta rosa, em cima (alimentação por gravidade).
  ctx.fillStyle = linear(ctx, -30, 0, 50, 0, [
    [0, '#9d174d'],
    [0.35, '#f9a8d4'],
    [0.55, '#ec4899'],
    [1, '#831843'],
  ]);
  roundRect(ctx, { x: -34, y: -168, w: 84, h: 116 }, 14);
  ctx.fill();
  ctx.fillStyle = '#4b5563';
  roundRect(ctx, { x: -40, y: -180, w: 96, h: 18 }, 6);
  ctx.fill();
  ctx.fillRect(-4, -54, 24, 14);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillRect(-34, -126, 84, 26);
  ctx.fillStyle = '#ec4899';
  ctx.fillRect(-34, -118, 84, 6);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.fillRect(-24, -160, 8, 100);
  // Pingos que escorrem do bico.
  ctx.fillStyle = '#f472b6';
  for (const [x, y, r] of [
    [150, 2, 5],
    [140, 20, 4],
  ] as const) {
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.75, r * 1.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  return null;
}

type ObjectDraw = (ctx: C, side: number, rng: Rng) => Box | null;

/** Os desenhos, por souvenir; os lados com blocos devolvem a área do texto. */
export const OBJECT_DRAWINGS: Readonly<Record<string, ObjectDraw>> = {
  SV_CITY_KEY: (ctx) => cityKey(ctx),
  SV_CORN_GOLD: (ctx, _side, rng) => goldenCorn(ctx, rng),
  SV_BRAZIL_NUT: (ctx, _side, rng) => brazilNut(ctx, rng),
  SV_ORE_NUGGET: (ctx, _side, rng) => oreNugget(ctx, rng),
  SV_TILE: (ctx, side, rng) => azulejo(ctx, side, rng),
  SV_BOTTLE_MAP: (ctx, _side, rng) => bottleMap(ctx, rng),
  SV_GOLD_RING: (ctx) => goldRing(ctx),
  SV_GREEN_PIPE: (ctx) => greenPipe(ctx),
  SV_STAR_SPHERE: (ctx) => orangeSphere(ctx),
  SV_TRIANGLE: (ctx) => geodeticTriangle(ctx),
  SV_CUBE_ORE: (ctx, _side, rng) => cubicOre(ctx, rng),
  SV_THEODOLITE_SWORD: (ctx) => theodoliteSword(ctx),
  SV_CARDBOARD_BOX: (ctx, side, rng) => cardboardBox(ctx, side, rng),
  SV_BMX: (ctx) => bmx(ctx),
  SV_CAP: (ctx) => backwardsCap(ctx),
  SV_EXHAUST_PORT: (ctx, _side, rng) => exhaustPort(ctx, rng),
  SV_PAINT_PISTOL: (ctx, _side, rng) => paintPistol(ctx, rng),
};

/**
 * Desenha o lado `side` do objeto `id` ajustado à caixa (proporção mantida, centrado) e devolve
 * a área dos blocos nas coordenadas da caixa, ou `null`. Sem desenho, nada é desenhado.
 */
export function drawObject(ctx: C, id: string, box: Box, side: number, rng: Rng): Box | null {
  const draw = OBJECT_DRAWINGS[id];
  if (!draw) return null;
  const u = Math.min(box.w / OBJECT_W, box.h / OBJECT_H);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(u, u);
  const area = draw(ctx, side, rng);
  ctx.restore();
  return area ? { x: cx + area.x * u, y: cy + area.y * u, w: area.w * u, h: area.h * u } : null;
}

// --- a caderneta -------------------------------------------------------------------

/**
 * A capa (ou a contracapa, `back`) de couro da caderneta, em 400 × 580: lombada, costura,
 * elástico, cantos gastos, a fita marcadora e a etiqueta de papel. Devolve a área da etiqueta.
 */
export function drawNotebookCover(ctx: C, back: boolean, rng: Rng): Box {
  const w = COVER_W;
  const h = COVER_H;
  ctx.save();
  if (back) {
    // Na contracapa, a lombada fica à direita.
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.fillStyle = linear(ctx, 0, 0, w, h, [
    [0, '#6a5236'],
    [0.5, '#54402a'],
    [1, '#3e2f1f'],
  ]);
  roundRect(ctx, { x: 0, y: 0, w, h }, 16);
  ctx.fill();
  ctx.save();
  roundRect(ctx, { x: 0, y: 0, w, h }, 16);
  ctx.clip();
  for (let i = 0; i < 700; i++) {
    ctx.fillStyle = rng.next() < 0.5 ? 'rgba(20, 12, 4, 0.18)' : 'rgba(210, 180, 130, 0.08)';
    ctx.fillRect(rng.range(0, w), rng.range(0, h), rng.range(1, 3), rng.range(1, 3));
  }
  for (const [x, y] of [
    [0, 0],
    [w, 0],
    [0, h],
    [w, h],
  ] as const) {
    ctx.fillStyle = radial(ctx, x, y, 2, x, y, 70, [
      [0, 'rgba(196, 164, 116, 0.5)'],
      [1, 'rgba(196, 164, 116, 0)'],
    ]);
    ctx.fillRect(x - 70, y - 70, 140, 140);
  }
  // Lombada.
  ctx.fillStyle = linear(ctx, 0, 0, 30, 0, [
    [0, '#2b2016'],
    [1, '#4a3826'],
  ]);
  ctx.fillRect(0, 0, 30, h);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.lineWidth = 1.5;
  for (let y = 40; y < h; y += 130) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(30, y);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(222, 202, 156, 0.75)';
  ctx.lineWidth = 1.6;
  ctx.setLineDash([8, 6]);
  roundRect(ctx, { x: 42, y: 14, w: w - 56, h: h - 28 }, 10);
  ctx.stroke();
  ctx.setLineDash([]);
  // Elástico e a fita marcadora.
  ctx.fillStyle = linear(ctx, w - 64, 0, w - 46, 0, [
    [0, '#1a130c'],
    [0.5, '#3b2e20'],
    [1, '#1a130c'],
  ]);
  ctx.fillRect(w - 64, 0, 18, h);
  ctx.fillStyle = '#a11d1d';
  ctx.beginPath();
  ctx.moveTo(70, h - 2);
  ctx.lineTo(70, h - 26);
  ctx.lineTo(84, h - 26);
  ctx.lineTo(84, h - 2);
  ctx.lineTo(77, h - 9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // A etiqueta (no lugar certo também na contracapa).
  const label: Box = back ? { x: 96, y: 392, w: 208, h: 104 } : { x: 82, y: 118, w: 236, h: 166 };
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(label.x + 3, label.y + 4, label.w, label.h);
  ctx.fillStyle = '#eadcb8';
  ctx.fillRect(label.x, label.y, label.w, label.h);
  ctx.strokeStyle = 'rgba(110, 80, 40, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(label.x + 6, label.y + 6, label.w - 12, label.h - 12);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = 'rgba(140, 100, 50, 0.12)';
    ctx.fillRect(
      rng.range(label.x, label.x + label.w),
      rng.range(label.y, label.y + label.h),
      2,
      2,
    );
  }
  ctx.restore();
  return { x: label.x + 14, y: label.y + 12, w: label.w - 28, h: label.h - 24 };
}
