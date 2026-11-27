/**
 * Esboços a lápis e a nanquim das faces (catalog §11.1): o croqui do sítio, o Atlas, a Estação
 * Total, o GSD, o museu, a flor de ipê prensada, o croqui da costa de 1890 e a rede de
 * triangulação. Os rótulos vêm dos dados (`labels`), na ordem de `SKETCH_LABELS`.
 */
import type { Rng } from '@/lib/rng';
import type { SouvenirSketchId } from '@/types';
import {
  charMeasure,
  drawLine,
  fontFor,
  INKS,
  parseMarkup,
  wrapSpans,
  type InkStyle,
} from './hand';
import type { Box } from './paper';

/** Quantos rótulos cada esboço posiciona. */
export const SKETCH_LABELS: Record<SouvenirSketchId, number> = {
  SITE_SURVEY: 9,
  ATLAS: 4,
  TOTAL_STATION: 4,
  GSD: 4,
  MUSEUM: 3,
  IPE_FLOWER: 1,
  COAST_1890: 5,
  TRIANGULATION: 3,
};

export interface PencilStyle {
  color?: string;
  width?: number;
  alpha?: number;
  passes?: number;
}

const GRAPHITE = '#45423d';
const SEPIA = '#5a3b1a';

/** Traço a lápis: duas passadas tortas que passam um pouco das pontas. */
export function pencilLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rng: Rng,
  { color = GRAPHITE, width = 1.2, alpha = 0.72, passes = 2 }: PencilStyle = {},
): void {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  for (let p = 0; p < passes; p++) {
    const over = rng.range(0.5, 2.2);
    const bend = rng.range(-0.9, 0.9) * Math.min(1, len / 60);
    ctx.globalAlpha = alpha * (p === 0 ? 1 : 0.55);
    ctx.lineWidth = width * (p === 0 ? 1 : 0.7);
    ctx.beginPath();
    ctx.moveTo(x1 - ux * over + rng.range(-0.5, 0.5), y1 - uy * over + rng.range(-0.5, 0.5));
    ctx.quadraticCurveTo(
      (x1 + x2) / 2 - uy * bend,
      (y1 + y2) / 2 + ux * bend,
      x2 + ux * over + rng.range(-0.5, 0.5),
      y2 + uy * over + rng.range(-0.5, 0.5),
    );
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export function pencilPath(
  ctx: CanvasRenderingContext2D,
  pts: readonly (readonly [number, number])[],
  rng: Rng,
  closed = false,
  style: PencilStyle = {},
): void {
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const a = pts[i] as readonly [number, number];
    const b = pts[(i + 1) % pts.length] as readonly [number, number];
    pencilLine(ctx, a[0], a[1], b[0], b[1], rng, style);
  }
}

/** Curva suave por pontos (para costas, córregos e contornos), a lápis. */
export function pencilCurve(
  ctx: CanvasRenderingContext2D,
  pts: readonly (readonly [number, number])[],
  rng: Rng,
  { color = GRAPHITE, width = 1.2, alpha = 0.72 }: PencilStyle = {},
): void {
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let pass = 0; pass < 2; pass++) {
    ctx.globalAlpha = alpha * (pass === 0 ? 1 : 0.5);
    ctx.lineWidth = width * (pass === 0 ? 1 : 0.7);
    ctx.beginPath();
    pts.forEach(([x, y], i) => {
      const jx = x + rng.range(-0.6, 0.6);
      const jy = y + rng.range(-0.6, 0.6);
      if (i === 0) ctx.moveTo(jx, jy);
      else {
        const [px, py] = pts[i - 1] as readonly [number, number];
        ctx.quadraticCurveTo(px, py, (px + jx) / 2, (py + jy) / 2);
      }
    });
    const last = pts[pts.length - 1];
    if (last) ctx.lineTo(last[0], last[1]);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export function pencilEllipse(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rng: Rng,
  style: PencilStyle = {},
  loops = 1.08,
): void {
  const pts: Array<[number, number]> = [];
  const start = rng.range(0, Math.PI * 2);
  const steps = 28;
  for (let i = 0; i <= steps * loops; i++) {
    const a = start + (i / steps) * Math.PI * 2;
    const wobble = 1 + Math.sin(a * 3 + start) * 0.03 + rng.range(-0.02, 0.02);
    pts.push([cx + Math.cos(a) * rx * wobble, cy + Math.sin(a) * ry * wobble]);
  }
  pencilCurve(ctx, pts, rng, style);
}

/** Hachura em diagonal dentro de um polígono. */
export function hatch(
  ctx: CanvasRenderingContext2D,
  poly: readonly (readonly [number, number])[],
  rng: Rng,
  spacing = 5,
  style: PencilStyle = {},
): void {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  ctx.save();
  ctx.beginPath();
  poly.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.clip();
  for (let d = minX - (maxY - minY); d < maxX; d += spacing) {
    pencilLine(ctx, d, maxY, d + (maxY - minY), minY, rng, {
      width: 0.7,
      alpha: 0.4,
      passes: 1,
      ...style,
    });
  }
  ctx.restore();
}

interface LabelOptions {
  px?: number;
  align?: 'left' | 'center' | 'right';
  maxW?: number;
  ink?: InkStyle;
}

/** Rótulo à mão; devolve a caixa ocupada (para a linha de chamada). */
export function handLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  rng: Rng,
  { px = 14, align = 'left', maxW = 170, ink = INKS.PENCIL }: LabelOptions = {},
): Box {
  const font = fontFor(ctx, 'HAND', px);
  const measure = charMeasure(ctx, font);
  const lines = wrapSpans(parseMarkup(text), maxW, measure);
  const step = px * 1.18;
  let width = 0;
  lines.forEach((line, i) => {
    width = Math.max(width, line.width);
    const lx = align === 'center' ? x - line.width / 2 : align === 'right' ? x - line.width : x;
    drawLine(ctx, line, lx, y + i * step, { ink, font, px, measure, rng });
  });
  const left = align === 'center' ? x - width / 2 : align === 'right' ? x - width : x;
  return { x: left, y: y - px * 0.8, w: width, h: lines.length * step };
}

/** Linha de chamada do rótulo até o ponto, com um pontinho na ponta. */
function leader(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rng: Rng,
): void {
  pencilLine(ctx, x1, y1, x2, y2, rng, { width: 0.8, alpha: 0.55, passes: 1 });
  ctx.fillStyle = GRAPHITE;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.arc(x2, y2, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** Marco de estação: o triângulo da topografia. */
function station(ctx: CanvasRenderingContext2D, x: number, y: number, rng: Rng, s = 5): void {
  pencilPath(
    ctx,
    [
      [x, y - s],
      [x + s, y + s * 0.8],
      [x - s, y + s * 0.8],
    ],
    rng,
    true,
    { width: 1.1 },
  );
  ctx.fillStyle = GRAPHITE;
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  ctx.arc(x, y + 1, 1.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function northArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rng: Rng,
  n: string,
): void {
  pencilLine(ctx, x, y + 26, x, y, rng, { width: 1.3 });
  pencilPath(
    ctx,
    [
      [x - 6, y + 10],
      [x, y],
      [x + 6, y + 10],
    ],
    rng,
    false,
    { width: 1.3 },
  );
  handLabel(ctx, n, x, y - 6, rng, { px: 15, align: 'center', ink: INKS.INK });
}

const L = (labels: readonly string[], i: number) => labels[i] ?? '';

// --- os esboços ----------------------------------------------------------------

function siteSurvey(
  ctx: CanvasRenderingContext2D,
  b: Box,
  labels: readonly string[],
  rng: Rng,
): void {
  const P = (fx: number, fy: number): [number, number] => [b.x + fx * b.w, b.y + fy * b.h];
  const E = [P(0.13, 0.84), P(0.86, 0.8), P(0.82, 0.25), P(0.16, 0.21)];
  // O córrego corta o canto de baixo, à direita.
  const creek = (offset: number): Array<[number, number]> =>
    Array.from({ length: 13 }, (_, i) => {
      const t = i / 12;
      return [
        b.x + b.w * (0.5 + t * 0.5) + Math.sin(t * 9) * 5,
        b.y + b.h * (1 - t * 0.42) + offset + Math.cos(t * 7) * 3,
      ];
    });
  pencilCurve(ctx, creek(0), rng, { width: 1 });
  pencilCurve(ctx, creek(7), rng, { width: 1 });
  pencilPath(ctx, E, rng, true, { width: 1.4, color: '#2f2c28' });
  E.forEach(([x, y], i) => {
    station(ctx, x, y, rng);
    const dx = i === 0 || i === 3 ? -14 : 12;
    const dy = i < 2 ? 18 : -10;
    handLabel(ctx, L(labels, i), x + dx, y + dy, rng, {
      px: 14,
      align: dx < 0 ? 'right' : 'left',
      ink: INKS.INK,
    });
  });
  // Casa.
  const [hx, hy] = P(0.3, 0.46);
  pencilPath(
    ctx,
    [
      [hx, hy],
      [hx + 44, hy],
      [hx + 44, hy + 28],
      [hx, hy + 28],
    ],
    rng,
    true,
  );
  pencilPath(
    ctx,
    [
      [hx - 5, hy + 1],
      [hx + 22, hy - 17],
      [hx + 49, hy + 1],
    ],
    rng,
  );
  pencilPath(
    ctx,
    [
      [hx + 18, hy + 28],
      [hx + 18, hy + 14],
      [hx + 27, hy + 14],
      [hx + 27, hy + 28],
    ],
    rng,
  );
  hatch(
    ctx,
    [
      [hx - 5, hy + 1],
      [hx + 22, hy - 17],
      [hx + 49, hy + 1],
    ],
    rng,
    4,
  );
  handLabel(ctx, L(labels, 4), hx + 22, hy + 46, rng, { px: 14, align: 'center' });
  // Mangueira.
  const [tx, ty] = P(0.67, 0.43);
  pencilEllipse(ctx, tx, ty, 26, 21, rng, { width: 1 }, 1.6);
  pencilEllipse(ctx, tx - 9, ty - 4, 12, 10, rng, { width: 0.8, alpha: 0.5 });
  pencilLine(ctx, tx - 3, ty + 20, tx - 4, ty + 38, rng);
  pencilLine(ctx, tx + 3, ty + 20, tx + 4, ty + 38, rng);
  handLabel(ctx, L(labels, 5), tx, ty + 56, rng, { px: 14, align: 'center' });
  // Mimosa, a vaca, no alinhamento.
  const [cx, cy] = P(0.54, 0.69);
  pencilEllipse(ctx, cx, cy, 17, 9, rng, { width: 1.1 });
  pencilEllipse(ctx, cx - 20, cy - 5, 6, 5, rng, { width: 1 });
  pencilLine(ctx, cx - 24, cy - 10, cx - 27, cy - 14, rng, { width: 0.9 });
  pencilLine(ctx, cx - 17, cy - 10, cx - 14, cy - 14, rng, { width: 0.9 });
  for (const lx of [-10, -4, 6, 12])
    pencilLine(ctx, cx + lx, cy + 8, cx + lx, cy + 17, rng, { width: 1 });
  pencilCurve(
    ctx,
    [
      [cx + 17, cy - 2],
      [cx + 23, cy + 2],
      [cx + 22, cy + 9],
    ],
    rng,
    { width: 0.9 },
  );
  ctx.fillStyle = GRAPHITE;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.ellipse(cx - 3, cy - 2, 4, 3, 0.4, 0, Math.PI * 2);
  ctx.ellipse(cx + 8, cy + 2, 3, 2.4, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  const mimosa = handLabel(ctx, L(labels, 7), cx + 34, cy + 24, rng, { px: 14, ink: INKS.RED });
  leader(ctx, mimosa.x - 2, mimosa.y + 6, cx + 12, cy + 8, rng);
  handLabel(ctx, L(labels, 6), b.x + b.w * 0.97, b.y + b.h * 0.6, rng, { px: 13, align: 'right' });
  northArrow(ctx, b.x + b.w * 0.94, b.y + 12, rng, L(labels, 8));
}

function atlasSketch(
  ctx: CanvasRenderingContext2D,
  b: Box,
  labels: readonly string[],
  rng: Rng,
): void {
  const cx = b.x + b.w * 0.4;
  const cy = b.y + b.h * 0.54;
  // Corpo, cabeça, bico e olho.
  pencilEllipse(ctx, cx, cy, 58, 36, rng, { width: 1.4 });
  pencilEllipse(ctx, cx + 54, cy - 42, 20, 18, rng, { width: 1.3 });
  pencilCurve(
    ctx,
    [
      [cx + 30, cy - 30],
      [cx + 42, cy - 26],
      [cx + 46, cy - 26],
    ],
    rng,
  );
  pencilPath(
    ctx,
    [
      [cx + 72, cy - 46],
      [cx + 86, cy - 41],
      [cx + 72, cy - 37],
    ],
    rng,
    true,
    { width: 1.2 },
  );
  pencilEllipse(ctx, cx + 60, cy - 47, 4.5, 4.5, rng, { width: 1 });
  ctx.fillStyle = GRAPHITE;
  ctx.beginPath();
  ctx.arc(cx + 61, cy - 47, 2, 0, Math.PI * 2);
  ctx.fill();
  // A sobrancelha franzida de quem não se perde.
  pencilLine(ctx, cx + 54, cy - 56, cx + 67, cy - 52, rng, { width: 1.3 });
  // Asa com as barras, hachurada.
  const wing: Array<[number, number]> = [
    [cx - 40, cy - 12],
    [cx + 18, cy - 22],
    [cx + 34, cy - 4],
    [cx - 6, cy + 18],
    [cx - 52, cy + 8],
  ];
  pencilCurve(ctx, [...wing, wing[0] as [number, number]], rng, { width: 1.1 });
  hatch(ctx, wing, rng, 5);
  pencilLine(ctx, cx - 30, cy - 2, cx + 14, cy - 10, rng, { width: 1.6 });
  pencilLine(ctx, cx - 34, cy + 6, cx + 8, cy + 0, rng, { width: 1.6 });
  // Cauda em leque, com a ponta escura, e os pés no poleiro.
  const tail: Array<[number, number]> = [
    [cx - 52, cy - 8],
    [cx - 108, cy - 22],
    [cx - 114, cy + 18],
    [cx - 52, cy + 12],
  ];
  pencilPath(ctx, tail, rng);
  for (const t of [0.3, 0.55, 0.8]) {
    pencilLine(ctx, cx - 54, cy + 2, cx - 108 - t * 6, cy - 22 + t * 40, rng, {
      width: 0.8,
      alpha: 0.5,
      passes: 1,
    });
  }
  hatch(
    ctx,
    [
      [cx - 98, cy - 19],
      [cx - 108, cy - 22],
      [cx - 114, cy + 18],
      [cx - 103, cy + 16],
    ],
    rng,
    3,
  );
  pencilLine(ctx, cx - 4, cy + 34, cx - 8, cy + 56, rng);
  pencilLine(ctx, cx + 12, cy + 34, cx + 12, cy + 56, rng);
  pencilLine(ctx, cx - 60, cy + 58, cx + 60, cy + 58, rng, { width: 2 });
  // A câmera no peito, com a alça.
  const camX = cx + 36;
  const camY = cy + 2;
  pencilPath(
    ctx,
    [
      [camX - 9, camY - 7],
      [camX + 9, camY - 7],
      [camX + 9, camY + 7],
      [camX - 9, camY + 7],
    ],
    rng,
    true,
    { width: 1.2 },
  );
  pencilEllipse(ctx, camX + 2, camY, 3.6, 3.6, rng, { width: 1 });
  pencilCurve(
    ctx,
    [
      [camX - 9, camY - 4],
      [cx, cy - 30],
      [cx - 30, cy - 26],
    ],
    rng,
    { width: 0.8, alpha: 0.5 },
  );
  // Rótulos com as linhas de chamada.
  const right = b.x + b.w;
  const eye = handLabel(ctx, L(labels, 0), right - 2, b.y + 16, rng, {
    px: 13,
    align: 'right',
    maxW: 132,
  });
  leader(ctx, eye.x + 10, eye.y + eye.h, cx + 62, cy - 49, rng);
  const crop = handLabel(ctx, L(labels, 1), right - 2, cy - 2, rng, {
    px: 13,
    align: 'right',
    maxW: 96,
  });
  leader(ctx, crop.x - 3, crop.y + 6, cx + 46, cy - 16, rng);
  const cam = handLabel(ctx, L(labels, 2), right - 2, b.y + b.h - 18, rng, {
    px: 13,
    align: 'right',
    maxW: 110,
  });
  leader(ctx, cam.x - 3, cam.y + 6, camX + 9, camY + 5, rng);
  const wings = handLabel(ctx, L(labels, 3), b.x + 2, b.y + 14, rng, { px: 13, maxW: 128 });
  leader(ctx, wings.x + 30, wings.y + wings.h + 2, cx - 20, cy - 10, rng);
}

function totalStation(
  ctx: CanvasRenderingContext2D,
  b: Box,
  labels: readonly string[],
  rng: Rng,
): void {
  const hx = b.x + b.w * 0.36;
  const hy = b.y + b.h * 0.5;
  const ground = b.y + b.h - 12;
  // Tripé: a perna do meio é mais curta, com uma pedra embaixo.
  for (const [fx, fy] of [
    [-64, ground],
    [6, ground - 12],
    [66, ground],
  ] as const) {
    pencilLine(ctx, hx - 3, hy + 6, hx + fx - 3, fy, rng, { width: 1.3 });
    pencilLine(ctx, hx + 3, hy + 6, hx + fx + 3, fy, rng, { width: 1 });
  }
  pencilEllipse(ctx, hx + 9, ground - 6, 9, 6, rng, { width: 1 });
  hatch(
    ctx,
    [
      [hx, ground - 6],
      [hx + 9, ground - 12],
      [hx + 18, ground - 6],
      [hx + 9, ground],
    ],
    rng,
    3,
  );
  // Base, corpo, alças e a luneta.
  pencilPath(
    ctx,
    [
      [hx - 26, hy + 6],
      [hx + 26, hy + 6],
      [hx + 20, hy - 4],
      [hx - 20, hy - 4],
    ],
    rng,
    true,
  );
  pencilPath(
    ctx,
    [
      [hx - 18, hy - 4],
      [hx - 18, hy - 46],
      [hx + 18, hy - 46],
      [hx + 18, hy - 4],
    ],
    rng,
    true,
    { width: 1.3 },
  );
  pencilEllipse(ctx, hx - 6, hy - 18, 7, 5, rng, { width: 1 });
  ctx.fillStyle = GRAPHITE;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.arc(hx - 4, hy - 19, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  pencilPath(
    ctx,
    [
      [hx - 26, hy - 62],
      [hx + 34, hy - 70],
      [hx + 36, hy - 56],
      [hx - 24, hy - 48],
    ],
    rng,
    true,
    { width: 1.4 },
  );
  pencilEllipse(ctx, hx + 36, hy - 63, 3, 7, rng, { width: 1 });
  pencilCurve(
    ctx,
    [
      [hx - 12, hy - 66],
      [hx, hy - 84],
      [hx + 12, hy - 68],
    ],
    rng,
  );
  // O prisma no bastão e a visada pontilhada.
  const px = b.x + b.w * 0.84;
  const py = b.y + b.h * 0.3;
  pencilLine(ctx, px, py + 10, px, ground, rng, { width: 1.3 });
  pencilEllipse(ctx, px, py, 10, 10, rng, { width: 1.2 });
  pencilPath(
    ctx,
    [
      [px, py - 6],
      [px + 6, py + 4],
      [px - 6, py + 4],
    ],
    rng,
    true,
    { width: 0.9 },
  );
  ctx.setLineDash([3, 5]);
  pencilLine(ctx, hx + 38, hy - 63, px - 11, py, rng, { width: 0.8, alpha: 0.5, passes: 1 });
  ctx.setLineDash([]);
  const scope = handLabel(ctx, L(labels, 0), b.x + 4, b.y + 16, rng, { px: 13 });
  leader(ctx, scope.x + scope.w * 0.6, scope.y + scope.h + 2, hx - 10, hy - 60, rng);
  const level = handLabel(ctx, L(labels, 1), b.x + 4, hy + 2, rng, { px: 13, maxW: 70 });
  leader(ctx, level.x + level.w + 2, level.y + 6, hx - 12, hy - 18, rng);
  const prism = handLabel(ctx, L(labels, 2), px + 4, py - 30, rng, {
    px: 13,
    align: 'center',
    maxW: 104,
  });
  leader(ctx, prism.x + prism.w / 2, prism.y + prism.h, px, py - 11, rng);
  const leg = handLabel(ctx, L(labels, 3), b.x + b.w * 0.62, ground - 26, rng, {
    px: 13,
    maxW: 96,
  });
  leader(ctx, leg.x - 2, leg.y + 8, hx + 8, ground - 22, rng);
}

function gsdDiagram(
  ctx: CanvasRenderingContext2D,
  b: Box,
  labels: readonly string[],
  rng: Rng,
): void {
  const cx = b.x + b.w * 0.5;
  const lensY = b.y + 26;
  const sensorY = b.y + 12;
  const ground = b.y + b.h - 12;
  pencilPath(
    ctx,
    [
      [cx - 16, sensorY - 6],
      [cx + 16, sensorY - 6],
      [cx + 16, lensY],
      [cx - 16, lensY],
    ],
    rng,
    true,
  );
  pencilLine(ctx, cx - 12, sensorY, cx + 12, sensorY, rng, { width: 1.8 });
  pencilLine(ctx, cx - 96, ground, cx + 96, ground, rng, { width: 1.4 });
  pencilLine(ctx, cx, lensY, cx - 84, ground, rng, { width: 0.9 });
  pencilLine(ctx, cx, lensY, cx + 84, ground, rng, { width: 0.9 });
  // H na esquerda, com as setas.
  const hx = cx - 118;
  pencilLine(ctx, hx, lensY, hx, ground, rng, { width: 1 });
  pencilPath(
    ctx,
    [
      [hx - 4, lensY + 7],
      [hx, lensY],
      [hx + 4, lensY + 7],
    ],
    rng,
  );
  pencilPath(
    ctx,
    [
      [hx - 4, ground - 7],
      [hx, ground],
      [hx + 4, ground - 7],
    ],
    rng,
  );
  // O pixel no sensor e o pedaço de chão que ele vê.
  pencilLine(ctx, cx + 3, sensorY - 3, cx + 3, sensorY + 3, rng, { width: 1 });
  pencilLine(ctx, cx + 7, sensorY - 3, cx + 7, sensorY + 3, rng, { width: 1 });
  pencilLine(ctx, cx + 62, ground - 5, cx + 62, ground + 5, rng, { width: 1.3, color: '#a3241c' });
  pencilLine(ctx, cx + 80, ground - 5, cx + 80, ground + 5, rng, { width: 1.3, color: '#a3241c' });
  handLabel(ctx, L(labels, 0), cx - 24, lensY - 2, rng, { px: 14, align: 'right', ink: INKS.INK });
  const pixel = handLabel(ctx, L(labels, 1), cx + 44, sensorY + 4, rng, { px: 13 });
  leader(ctx, pixel.x - 2, pixel.y + 6, cx + 6, sensorY + 1, rng);
  handLabel(ctx, L(labels, 2), hx - 8, (lensY + ground) / 2 + 5, rng, {
    px: 15,
    align: 'right',
    ink: INKS.INK,
  });
  handLabel(ctx, L(labels, 3), cx + 71, ground - 10, rng, {
    px: 13,
    align: 'center',
    ink: INKS.RED,
  });
}

function museumSketch(
  ctx: CanvasRenderingContext2D,
  b: Box,
  labels: readonly string[],
  rng: Rng,
): void {
  const P = (fx: number, fy: number): [number, number] => [b.x + fx * b.w, b.y + fy * b.h];
  const top = [P(0.1, 0.42), P(0.68, 0.36), P(0.76, 0.58), P(0.17, 0.66)];
  pencilPath(ctx, top, rng, true, { width: 1.4 });
  for (const [x, y] of [top[3], top[2], P(0.1, 0.46), P(0.68, 0.4)] as Array<[number, number]>) {
    pencilLine(ctx, x, y, x, y + b.h * 0.3, rng, { width: 1.2 });
  }
  // A maquete: o relevo em curvas de nível, com um rio.
  for (let k = 0; k < 4; k++) {
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const x = b.x + b.w * (0.18 + t * 0.48);
      const y = b.y + b.h * (0.5 - k * 0.045) + Math.sin(t * 8 + k) * (5 + k * 2) - t * 6;
      pts.push([x, y]);
    }
    pencilCurve(ctx, pts, rng, { width: 0.9, alpha: 0.6 });
  }
  pencilPath(ctx, [P(0.36, 0.48), P(0.42, 0.3), P(0.48, 0.45)], rng);
  pencilPath(ctx, [P(0.48, 0.45), P(0.54, 0.24), P(0.61, 0.43)], rng);
  hatch(ctx, [P(0.48, 0.45), P(0.54, 0.24), P(0.61, 0.43)], rng, 4);
  // As setas: a maquete cresce para os lados.
  for (const [x1, y1, x2, y2] of [
    [0.12, 0.38, 0.03, 0.3],
    [0.7, 0.32, 0.8, 0.22],
  ] as const) {
    const [ax, ay] = P(x1, y1);
    const [bx, by] = P(x2, y2);
    pencilLine(ctx, ax, ay, bx, by, rng, { width: 1 });
    const a = Math.atan2(by - ay, bx - ax);
    pencilPath(
      ctx,
      [
        [bx - Math.cos(a - 0.5) * 8, by - Math.sin(a - 0.5) * 8],
        [bx, by],
        [bx - Math.cos(a + 0.5) * 8, by - Math.sin(a + 0.5) * 8],
      ],
      rng,
    );
  }
  // Eu, de chapéu.
  const [fx, fy] = P(0.9, 0.3);
  pencilEllipse(ctx, fx, fy, 7, 7, rng, { width: 1.1 });
  pencilLine(ctx, fx - 13, fy - 6, fx + 13, fy - 6, rng, { width: 1.4 });
  pencilPath(
    ctx,
    [
      [fx - 7, fy - 6],
      [fx - 6, fy - 15],
      [fx + 6, fy - 15],
      [fx + 7, fy - 6],
    ],
    rng,
  );
  pencilLine(ctx, fx, fy + 7, fx, fy + 38, rng);
  pencilLine(ctx, fx, fy + 16, fx - 14, fy + 26, rng);
  pencilLine(ctx, fx, fy + 16, fx + 12, fy + 28, rng);
  pencilLine(ctx, fx, fy + 38, fx - 9, fy + 58, rng);
  pencilLine(ctx, fx, fy + 38, fx + 9, fy + 58, rng);
  handLabel(ctx, L(labels, 0), b.x + b.w * 0.36, b.y + b.h - 4, rng, { px: 13, align: 'center' });
  handLabel(ctx, L(labels, 1), b.x + b.w * 0.34, b.y + 14, rng, {
    px: 13,
    align: 'center',
    maxW: 210,
  });
  handLabel(ctx, L(labels, 2), b.x + b.w, fy + 78, rng, { px: 13, align: 'right', maxW: 104 });
}

function ipeFlower(
  ctx: CanvasRenderingContext2D,
  b: Box,
  labels: readonly string[],
  rng: Rng,
): void {
  const cx = b.x + b.w * 0.28;
  const cy = b.y + b.h * 0.42;
  // O talo seco, para baixo e para a direita.
  ctx.strokeStyle = '#7a5a2a';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx + 6, cy + 10);
  ctx.quadraticCurveTo(cx + 22, cy + 44, cx + 40, cy + 70);
  ctx.stroke();
  // Cinco lobos em volta da garganta, prensados, com a borda secando.
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 5 + rng.range(-0.06, 0.06);
    const r = 24 + rng.range(-2, 2);
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    const petal = ctx.createRadialGradient(cx, cy, 4, px, py, 26);
    petal.addColorStop(0, '#f6c93c');
    petal.addColorStop(0.7, '#f8d958');
    petal.addColorStop(1, '#b07e22');
    ctx.fillStyle = petal;
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.ellipse(px, py, 20, 15, a, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = '#9a6a18';
    ctx.lineWidth = 1;
    ctx.stroke();
    // As listras avermelhadas da garganta do ipê-amarelo.
    ctx.strokeStyle = '#b4532a';
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6);
    ctx.lineTo(cx + Math.cos(a) * 18, cy + Math.sin(a) * 18);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#d49a22';
  ctx.beginPath();
  ctx.arc(cx, cy, 7, 0, Math.PI * 2);
  ctx.fill();
  // A fita que prende a flor na página.
  ctx.save();
  ctx.translate(cx + 30, cy + 52);
  ctx.rotate(0.6);
  ctx.fillStyle = 'rgba(232, 222, 186, 0.66)';
  ctx.fillRect(-26, -9, 52, 18);
  ctx.restore();
  handLabel(ctx, L(labels, 0), b.x + b.w * 0.66, b.y + b.h * 0.42, rng, {
    px: 14,
    align: 'center',
    maxW: 160,
  });
}

function coast1890(
  ctx: CanvasRenderingContext2D,
  b: Box,
  labels: readonly string[],
  rng: Rng,
): void {
  const ink = { color: SEPIA, width: 1.4, alpha: 0.85 };
  const coastX = (t: number) =>
    b.x + b.w * (0.4 + t * 0.12) + Math.sin(t * 11) * 22 + Math.sin(t * 27 + 1) * 6;
  const coast: Array<[number, number]> = Array.from({ length: 30 }, (_, i) => {
    const t = i / 29;
    return [coastX(t), b.y + t * b.h];
  });
  pencilCurve(ctx, coast, rng, ink);
  // Terra à esquerda, pontilhada; mar à direita, em ondinhas.
  ctx.fillStyle = SEPIA;
  for (let i = 0; i < 150; i++) {
    const t = rng.next();
    const x = b.x + rng.range(4, coastX(t) - b.x - 8);
    const y = b.y + t * b.h;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(x, y, 1.4, 1.4);
  }
  ctx.globalAlpha = 1;
  for (let k = 0; k < 9; k++) {
    const y = b.y + 18 + k * (b.h / 9.5);
    const t = (y - b.y) / b.h;
    const x0 = coastX(t) + 26 + rng.range(0, 30);
    pencilCurve(
      ctx,
      [
        [x0, y],
        [x0 + 8, y - 3],
        [x0 + 16, y],
        [x0 + 24, y - 3],
      ],
      rng,
      { color: SEPIA, width: 0.8, alpha: 0.55 },
    );
  }
  // Farol no cabo.
  const fx = coastX(0.22) - 6;
  const fy = b.y + b.h * 0.22;
  pencilPath(
    ctx,
    [
      [fx - 6, fy + 10],
      [fx - 3, fy - 18],
      [fx + 3, fy - 18],
      [fx + 6, fy + 10],
    ],
    rng,
    true,
    ink,
  );
  for (const a of [-0.5, -0.2, 0.15]) {
    pencilLine(ctx, fx + 5, fy - 16, fx + 5 + Math.cos(a) * 26, fy - 16 + Math.sin(a) * 26, rng, {
      ...ink,
      width: 0.8,
      alpha: 0.55,
      passes: 1,
    });
  }
  handLabel(ctx, L(labels, 0), fx - 12, fy + 4, rng, { px: 15, align: 'right', ink: INKS.INK });
  // Praia na enseada.
  const by = b.y + b.h * 0.6;
  for (let i = 0; i < 40; i++) {
    const t = 0.52 + rng.next() * 0.16;
    ctx.fillStyle = SEPIA;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(coastX(t) - rng.range(2, 18), b.y + t * b.h, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  handLabel(ctx, L(labels, 1), coastX(0.6) - 26, by + 4, rng, {
    px: 15,
    align: 'right',
    ink: INKS.INK,
  });
  // O monstro no mar: três corcovas e uma cabeça sorridente.
  const mx = b.x + b.w * 0.74;
  const my = b.y + b.h * 0.48;
  for (let i = 0; i < 3; i++) {
    pencilCurve(
      ctx,
      [
        [mx + i * 24, my],
        [mx + i * 24 + 10, my - 14],
        [mx + i * 24 + 20, my],
      ],
      rng,
      ink,
    );
  }
  pencilEllipse(ctx, mx + 84, my - 14, 10, 8, rng, ink);
  pencilCurve(
    ctx,
    [
      [mx + 72, my],
      [mx + 76, my - 8],
      [mx + 78, my - 8],
    ],
    rng,
    ink,
  );
  ctx.fillStyle = SEPIA;
  ctx.beginPath();
  ctx.arc(mx + 87, my - 16, 1.6, 0, Math.PI * 2);
  ctx.fill();
  pencilCurve(
    ctx,
    [
      [mx + 82, my - 10],
      [mx + 87, my - 8],
      [mx + 92, my - 11],
    ],
    rng,
    { ...ink, width: 0.9 },
  );
  handLabel(ctx, L(labels, 2), mx + 40, my + 26, rng, { px: 15, align: 'center', ink: INKS.INK });
  // A capivara na terra, logo atrás da praia.
  const kx = b.x + b.w * 0.2;
  const ky = b.y + b.h * 0.7;
  pencilEllipse(ctx, kx, ky, 20, 12, rng, ink);
  pencilEllipse(ctx, kx + 22, ky - 6, 9, 7, rng, ink);
  pencilLine(ctx, kx + 18, ky - 13, kx + 17, ky - 16, rng, ink);
  for (const lx of [-12, -4, 8, 14]) pencilLine(ctx, kx + lx, ky + 10, kx + lx, ky + 17, rng, ink);
  ctx.fillStyle = SEPIA;
  ctx.beginPath();
  ctx.arc(kx + 25, ky - 8, 1.3, 0, Math.PI * 2);
  ctx.fill();
  handLabel(ctx, L(labels, 3), kx, ky + 34, rng, { px: 14, align: 'center', ink: INKS.INK });
  // Rosa dos ventos.
  const rx = b.x + b.w - 34;
  const ry = b.y + 40;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = i % 2 === 0 ? 24 : 12;
    pencilLine(ctx, rx, ry, rx + Math.sin(a) * r, ry - Math.cos(a) * r, rng, {
      ...ink,
      width: i % 2 === 0 ? 1.3 : 0.8,
    });
  }
  pencilEllipse(ctx, rx, ry, 6, 6, rng, ink);
  handLabel(ctx, L(labels, 4), rx, ry - 30, rng, { px: 16, align: 'center', ink: INKS.INK });
}

function triangulation(
  ctx: CanvasRenderingContext2D,
  b: Box,
  labels: readonly string[],
  rng: Rng,
): void {
  const P = (fx: number, fy: number): [number, number] => [b.x + fx * b.w, b.y + fy * b.h];
  const V = [P(0.14, 0.86), P(0.86, 0.86), P(0.5, 0.12)];
  const mid = [P(0.32, 0.5), P(0.68, 0.5), P(0.5, 0.86), P(0.5, 0.6)];
  pencilPath(ctx, V, rng, true, { width: 1.5, color: '#2f2c28' });
  const edges: Array<[[number, number], [number, number]]> = [
    [mid[0] as [number, number], mid[1] as [number, number]],
    [mid[1] as [number, number], mid[2] as [number, number]],
    [mid[2] as [number, number], mid[0] as [number, number]],
    [mid[3] as [number, number], V[0] as [number, number]],
    [mid[3] as [number, number], V[1] as [number, number]],
    [mid[3] as [number, number], V[2] as [number, number]],
  ];
  ctx.setLineDash([4, 4]);
  for (const [a, c] of edges)
    pencilLine(ctx, a[0], a[1], c[0], c[1], rng, { width: 0.9, alpha: 0.55, passes: 1 });
  ctx.setLineDash([]);
  for (const [x, y] of mid) station(ctx, x, y, rng, 3.5);
  V.forEach(([x, y], i) => {
    station(ctx, x, y, rng, 6);
    const dy = i === 2 ? -12 : 20;
    handLabel(ctx, L(labels, i), x, y + dy, rng, { px: 14, align: 'center', ink: INKS.INK });
  });
}

const SKETCHES: Record<
  SouvenirSketchId,
  (ctx: CanvasRenderingContext2D, b: Box, labels: readonly string[], rng: Rng) => void
> = {
  SITE_SURVEY: siteSurvey,
  ATLAS: atlasSketch,
  TOTAL_STATION: totalStation,
  GSD: gsdDiagram,
  MUSEUM: museumSketch,
  IPE_FLOWER: ipeFlower,
  COAST_1890: coast1890,
  TRIANGULATION: triangulation,
};

/** Desenha o esboço `id` na caixa, com os rótulos dados. */
export function drawSketch(
  ctx: CanvasRenderingContext2D,
  id: SouvenirSketchId,
  box: Box,
  labels: readonly string[],
  rng: Rng,
): void {
  ctx.save();
  SKETCHES[id](ctx, box, labels, rng);
  ctx.restore();
}
