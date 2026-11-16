/**
 * Diagrama de Óptica & GSD (infographic-lab §5.1, REQ-LAB-001): corte transversal com o sensor (a
 * grade de pixels, um deles em âmbar), a lente a `f` (escala exagerada), o cone de raios até o solo
 * a H (escala vertical logarítmica, com régua), o segmento W_g, o pixel projetado em âmbar e uma
 * lupa que mostra o pixel do solo sobre a textura da orto. Pontos de luz percorrem do solo ao sensor.
 *
 * Só desenha: os números (GSD, W_g, FOV) e os rótulos já chegam prontos, calculados pelo domínio.
 */
import { COLORS, withAlpha } from '@/ui/tokens';
import { clamp01, dimension, dot, line, text } from './draw';

export interface OpticsLabels {
  height: string;
  focal: string;
  sensor: string;
  pixel: string;
  ground: string;
  gsd: string;
  lupa: string;
}

export interface OpticsView {
  /** Área de desenho, em px CSS. */
  width: number;
  height: number;
  /** H (m), f e largura do sensor (mm): valores já interpolados. */
  heightM: number;
  focalMm: number;
  sensorWidthMm: number;
  /** Meio ângulo de visão horizontal (rad), vindo de `horizontalFovRad` do domínio. */
  halfFovRad: number;
  /** GSD (m/px), vindo de `gsd()`: dimensiona a lupa. */
  gsdM: number;
  labels: OpticsLabels;
}

/** Faixa do slider de H: a régua logarítmica vai de 20 a 300 m. */
export const H_MIN_M = 20;
export const H_MAX_M = 300;
const RULER_MARKS_M = [20, 50, 100, 200, 300] as const;
/** A lupa mostra 50 cm de chão, com no máximo 40 × 40 células. */
export const LUPA_WINDOW_M = 0.5;
export const LUPA_MAX_CELLS = 40;
const RAYS = 7;

/** Posição na régua logarítmica: 0 em 20 m, 1 em 300 m. */
export function logPosition(heightM: number): number {
  return clamp01(Math.log(heightM / H_MIN_M) / Math.log(H_MAX_M / H_MIN_M));
}

type Rgb = readonly [number, number, number];

/**
 * Textura da orto em metros: pavimento de ladrilhos de 6 cm com juntas de 8 mm e uma faixa pintada
 * diagonal de 5 cm. Os detalhes menores que o GSD somem na lupa, como no sensor de verdade.
 */
export function orthoTexture(xM: number, yM: number): Rgb {
  const tile = 0.06;
  const joint = 0.008;
  const fx = ((xM % tile) + tile) % tile;
  const fy = ((yM % tile) + tile) % tile;
  if (fx < joint || fy < joint) return [38, 44, 58];
  const diagonal = (((xM + yM) % 0.3) + 0.3) % 0.3;
  if (Math.abs(diagonal - 0.15) < 0.025) return [226, 232, 240];
  return (Math.floor(xM / tile) + Math.floor(yM / tile)) & 1 ? [86, 98, 120] : [100, 112, 134];
}

/** Cor de um pixel de GSD `gsdM` centrado em (x, y): média de 3 × 3 amostras (integração do pixel). */
export function pixelColor(xM: number, yM: number, gsdM: number): Rgb {
  let r = 0;
  let g = 0;
  let b = 0;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const c = orthoTexture(xM + (i * gsdM) / 3, yM + (j * gsdM) / 3);
      r += c[0];
      g += c[1];
      b += c[2];
    }
  }
  return [r / 9, g / 9, b / 9];
}

/** Células por lado da lupa: 50 cm de chão divididos pelo GSD, entre 1 e 40. */
export function lupaCells(gsdM: number): number {
  return Math.min(LUPA_MAX_CELLS, Math.max(1, Math.round(LUPA_WINDOW_M / Math.max(gsdM, 1e-6))));
}

function drawLupa(
  ctx: CanvasRenderingContext2D,
  view: OpticsView,
  x: number,
  y: number,
  size: number,
): void {
  const n = lupaCells(view.gsdM);
  const cell = size / n;
  const cellM = LUPA_WINDOW_M / n;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const [r, g, b] = pixelColor((i + 0.5) * cellM, (j + 0.5) * cellM, cellM);
      ctx.fillStyle = `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
      ctx.fillRect(x + i * cell, y + j * cell, Math.ceil(cell), Math.ceil(cell));
    }
  }
  // O pixel do centro, em âmbar.
  const mid = Math.floor(n / 2);
  ctx.strokeStyle = COLORS.warn;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + mid * cell, y + mid * cell, cell, cell);
  ctx.strokeStyle = COLORS.radar;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, size, size);
  text(ctx, view.labels.lupa, x + size / 2, y - 10, { color: COLORS.textMuted, size: 11 });
}

/** Desenha o quadro do diagrama no instante `tS` (s). */
export function renderOptics(ctx: CanvasRenderingContext2D, view: OpticsView, tS: number): void {
  const { width: w, height: h } = view;
  ctx.save();
  ctx.fillStyle = COLORS.bgBase;
  ctx.fillRect(0, 0, w, h);

  const cx = w * 0.4;
  const sensorY = 46;
  const sensorH = 14;
  const halfSensor = Math.min(78, Math.max(26, view.sensorWidthMm * 2.2));
  const focalPx = Math.min(146, Math.max(32, 26 + view.focalMm * 2.4));
  const lensY = sensorY + sensorH + focalPx;
  const groundTop = lensY + 56;
  const groundBottom = Math.max(groundTop + 40, h - 60);
  const groundY = groundTop + logPosition(view.heightM) * (groundBottom - groundTop);
  const dist = groundY - lensY;
  const half = Math.min(dist * Math.tan(view.halfFovRad), w * 0.34);

  // Cone de raios até o solo.
  ctx.fillStyle = withAlpha(COLORS.radar, 0.07);
  ctx.beginPath();
  ctx.moveTo(cx, lensY);
  ctx.lineTo(cx - half, groundY);
  ctx.lineTo(cx + half, groundY);
  ctx.closePath();
  ctx.fill();
  const rayColor = withAlpha(COLORS.radar, 0.6);
  line(ctx, cx, lensY, cx - half, groundY, rayColor, 1.5);
  line(ctx, cx, lensY, cx + half, groundY, rayColor, 1.5);
  // Dentro da câmera, dos cantos do sensor ao centro da lente.
  const bodyColor = withAlpha(COLORS.textMuted, 0.5);
  line(ctx, cx - halfSensor, sensorY + sensorH, cx, lensY, bodyColor);
  line(ctx, cx + halfSensor, sensorY + sensorH, cx, lensY, bodyColor);
  line(ctx, cx - halfSensor, sensorY + sensorH, cx - halfSensor, lensY, bodyColor);
  line(ctx, cx + halfSensor, sensorY + sensorH, cx + halfSensor, lensY, bodyColor);

  // Solo hachurado e o segmento W_g.
  line(ctx, cx - half - 40, groundY, cx + half + 40, groundY, COLORS.textMuted, 2);
  for (let x = cx - half - 40; x < cx + half + 40; x += 14) {
    line(ctx, x, groundY, x - 8, groundY + 8, withAlpha(COLORS.textMuted, 0.4));
  }
  dimension(
    ctx,
    cx - half,
    groundY + 22,
    cx + half,
    groundY + 22,
    view.labels.ground,
    COLORS.radar,
    14,
  );

  // Sensor: grade de pixels com um pixel em âmbar.
  const cols = 14;
  const rows = 2;
  const cellW = (halfSensor * 2) / cols;
  const cellH = sensorH / rows;
  ctx.fillStyle = COLORS.bgPanel;
  ctx.fillRect(cx - halfSensor, sensorY, halfSensor * 2, sensorH);
  ctx.strokeStyle = withAlpha(COLORS.radar, 0.35);
  ctx.lineWidth = 1;
  for (let c = 0; c <= cols; c++) {
    const x = cx - halfSensor + c * cellW;
    ctx.beginPath();
    ctx.moveTo(x, sensorY);
    ctx.lineTo(x, sensorY + sensorH);
    ctx.stroke();
  }
  for (let r = 0; r <= rows; r++) {
    const y = sensorY + r * cellH;
    ctx.beginPath();
    ctx.moveTo(cx - halfSensor, y);
    ctx.lineTo(cx + halfSensor, y);
    ctx.stroke();
  }
  ctx.fillStyle = COLORS.warn;
  ctx.fillRect(cx - cellW / 2, sensorY, cellW, cellH);
  ctx.strokeStyle = COLORS.radar;
  ctx.strokeRect(cx - halfSensor, sensorY, halfSensor * 2, sensorH);
  text(ctx, `${view.labels.sensor} · ${view.labels.pixel}`, cx, sensorY - 14, {
    color: COLORS.textMuted,
    size: 11,
  });

  // Lente.
  ctx.fillStyle = withAlpha(COLORS.radar, 0.15);
  ctx.strokeStyle = COLORS.radar;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(cx, lensY, halfSensor + 12, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  dimension(
    ctx,
    cx + halfSensor + 26,
    sensorY + sensorH,
    cx + halfSensor + 26,
    lensY,
    view.labels.focal,
    COLORS.textMuted,
    10,
  );

  // Régua de H em escala logarítmica, à esquerda.
  const axisX = 44;
  line(ctx, axisX, groundTop, axisX, groundBottom, COLORS.border);
  for (const m of RULER_MARKS_M) {
    const y = groundTop + logPosition(m) * (groundBottom - groundTop);
    line(ctx, axisX - 4, y, axisX + 4, y, COLORS.textMuted);
    text(ctx, `${m} m`, axisX - 8, y, {
      color: COLORS.textMuted,
      size: 10,
      align: 'right',
      mono: true,
    });
  }
  text(ctx, 'H (escala log)', axisX, groundTop - 16, {
    color: COLORS.textMuted,
    size: 10,
    align: 'center',
  });
  dot(ctx, axisX, groundY, 4, COLORS.radar);
  dimension(
    ctx,
    cx - half - 14,
    lensY,
    cx - half - 14,
    groundY,
    view.labels.height,
    COLORS.radar,
    -10,
  );

  // Raio central: do pixel âmbar do sensor, pela lente, ao pixel projetado no solo.
  line(ctx, cx, sensorY + cellH, cx, groundY, withAlpha(COLORS.warn, 0.7), 1, [4, 4]);
  ctx.fillStyle = COLORS.warn;
  ctx.fillRect(cx - 6, groundY - 3, 12, 6);
  text(ctx, view.labels.gsd, cx, groundY - 14, {
    color: COLORS.warn,
    size: 12,
    bold: true,
    mono: true,
  });

  // Pontos de luz: do solo, pela lente, ao sensor (a imagem sai invertida).
  for (let i = 0; i < RAYS; i++) {
    const f = (2 * (i + 0.5)) / RAYS - 1;
    const gx = cx + half * f;
    const sx = cx - halfSensor * f;
    const u = (tS * 0.35 + i / RAYS) % 1;
    const [px, py] =
      u < 0.5
        ? [gx + (cx - gx) * (u * 2), groundY + (lensY - groundY) * (u * 2)]
        : [cx + (sx - cx) * (u * 2 - 1), lensY + (sensorY + sensorH - lensY) * (u * 2 - 1)];
    dot(ctx, px, py, 2.5, COLORS.text);
  }

  // Lupa: o pixel do solo sobre a textura da orto, ligada ao pixel projetado.
  const lupa = 150;
  const lx = w - lupa - 28;
  const ly = 58;
  drawLupa(ctx, view, lx, ly, lupa);
  line(ctx, lx, ly + lupa, cx + 6, groundY, withAlpha(COLORS.warn, 0.45), 1, [3, 4]);
  ctx.restore();
}
