/**
 * Diagrama de LiDAR vs. Fotogrametria no dossel (infographic-lab §5.3, REQ-LAB-003), em perfil e
 * em duas metades sobre a mesma floresta.
 *
 * - Esquerda, LiDAR: pulsos em leque descendo; cada um atravessa a copa e deixa o 1º retorno
 *   (ciano), os intermediários (violeta) e, só às vezes, o último no solo (emerald). Embaixo, o
 *   MDS (ciano, pelos 1ºs retornos) e o MDT (emerald, só pelos retornos de solo).
 * - Direita, câmera RGB: raios que param na copa. O MDS segue a copa, e o "MDT fotogramétrico" só
 *   existe nos buracos vistos em duas fotos, pontilhado e interpolado.
 *
 * Só desenha: as probabilidades (de solo e de visibilidade) vêm do domínio.
 */
import { hash2 } from '@/lib/rng';
import { COLORS, withAlpha } from '@/ui/tokens';
import { dot, line, text } from './draw';

export interface CanopyLabels {
  lidar: string;
  camera: string;
  first: string;
  middle: string;
  last: string;
  dsm: string;
  dtm: string;
  photoDtm: string;
}

export interface CanopyView {
  /** Área de desenho, em px CSS. */
  width: number;
  height: number;
  /** Cobertura do dossel, de 0 a 0,98. */
  canopy: number;
  /** Número máximo de retornos por pulso, de 1 a 5. */
  maxReturns: number;
  /** Probabilidade de um pulso chegar ao solo sob um dossel fechado: `groundReturnProbability(1, n)`. */
  closedGroundProbability: number;
  /** Fração do solo visível em duas fotos: `photoGroundVisibility(c)`. */
  photoVisibility: number;
  labels: CanopyLabels;
}

/** Colunas de árvores por metade do diagrama e pulsos/raios por metade. */
export const COLUMNS = 16;
export const BEAMS = 13;
/** Os pulsos são disparados a cada ciclo; o ciclo dura 3,2 s. */
export const CYCLE_S = 3.2;
const SEED = 0x7a11;

/** Uma coluna da floresta é copa (e não buraco) quando o sorteio dela cai abaixo da cobertura. */
export function isCrown(column: number, canopy: number): boolean {
  return hash2(column, 1, SEED) < canopy;
}

/** Altura da copa da coluna (px acima do solo): de 46 a 92. */
export function crownHeight(column: number): number {
  return 46 + hash2(column, 2, SEED) * 46;
}

/** O solo ondula suavemente (px de variação em torno da linha de base). */
export function groundWave(xFrac: number): number {
  return 9 * Math.sin(xFrac * 9) + 5 * Math.sin(xFrac * 23 + 1);
}

interface Half {
  x: number;
  w: number;
  top: number;
  groundY: number;
  bottom: number;
}

function columnX(half: Half, column: number): number {
  return half.x + ((column + 0.5) / COLUMNS) * half.w;
}

function groundAt(half: Half, x: number): number {
  return half.groundY - groundWave((x - half.x) / half.w);
}

function drawForest(ctx: CanvasRenderingContext2D, half: Half, canopy: number): void {
  const colW = half.w / COLUMNS;
  // Solo.
  ctx.strokeStyle = COLORS.textMuted;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= 60; i++) {
    const x = half.x + (i / 60) * half.w;
    if (i === 0) ctx.moveTo(x, groundAt(half, x));
    else ctx.lineTo(x, groundAt(half, x));
  }
  ctx.stroke();
  // Árvores: tronco e copa nas colunas com copa; os buracos ficam vazios.
  for (let c = 0; c < COLUMNS; c++) {
    if (!isCrown(c, canopy)) continue;
    const x = columnX(half, c);
    const g = groundAt(half, x);
    const hgt = crownHeight(c);
    line(ctx, x, g, x, g - hgt * 0.55, withAlpha(COLORS.textMuted, 0.7), 2);
    ctx.fillStyle = withAlpha(COLORS.ok, 0.28);
    ctx.strokeStyle = withAlpha(COLORS.ok, 0.7);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x, g - hgt * 0.68, colW * 0.62, hgt * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

interface Beam {
  /** Onde o raio encontra a copa (ou o solo, num buraco) e o solo sob a coluna dele. */
  hitX: number;
  hitY: number;
  groundX: number;
  groundY: number;
  crown: boolean;
  column: number;
}

/** O leque ocupa 46 % da largura da metade: o ângulo real (70°) seria mais largo que o quadro. */
const FAN_REACH = 0.46;

function beams(half: Half, view: CanopyView): Beam[] {
  const cx = half.x + half.w / 2;
  const originY = half.top;
  return Array.from({ length: BEAMS }, (_, j) => {
    const t = ((j + 0.5) / BEAMS) * 2 - 1;
    const groundX = cx + t * half.w * FAN_REACH;
    const column = Math.min(
      COLUMNS - 1,
      Math.max(0, Math.floor(((groundX - half.x) / half.w) * COLUMNS)),
    );
    const crown = isCrown(column, view.canopy);
    const g = groundAt(half, groundX);
    const hitY = crown ? g - crownHeight(column) * 0.9 : g;
    // O ponto de encontro com a copa está mais alto que o solo, sobre o mesmo raio.
    const hitX = cx + (groundX - cx) * ((hitY - originY) / (half.groundY - originY));
    return { hitX, hitY, groundX, groundY: g, crown, column };
  });
}

function drawAircraft(ctx: CanvasRenderingContext2D, x: number, y: number, name: string): void {
  ctx.fillStyle = COLORS.text;
  ctx.beginPath();
  ctx.moveTo(x, y - 10);
  ctx.lineTo(x + 12, y + 4);
  ctx.lineTo(x - 12, y + 4);
  ctx.closePath();
  ctx.fill();
  text(ctx, name, x, y - 24, { color: COLORS.text, size: 12, bold: true });
}

/** Perfis reconstruídos numa faixa sob o solo: cada polilinha liga os pontos dados. */
function drawProfile(
  ctx: CanvasRenderingContext2D,
  half: Half,
  points: ReadonlyArray<{ x: number; y: number }>,
  color: string,
  dash: readonly number[] = [],
): void {
  if (points.length < 2) {
    for (const p of points) dot(ctx, p.x, p.y, 2.5, color);
    return;
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([...dash]);
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
  ctx.setLineDash([]);
  void half;
}

/** Desenha o quadro do diagrama no instante `tS` (s). */
export function renderCanopy(ctx: CanvasRenderingContext2D, view: CanopyView, tS: number): void {
  const { width: w, height: h, labels } = view;
  ctx.save();
  ctx.fillStyle = COLORS.bgBase;
  ctx.fillRect(0, 0, w, h);

  const pad = w * 0.03;
  const halves: [Half, Half] = [
    { x: pad, w: w / 2 - pad * 1.5, top: 64, groundY: h - 130, bottom: h - 22 },
    { x: w / 2 + pad * 0.5, w: w / 2 - pad * 1.5, top: 64, groundY: h - 130, bottom: h - 22 },
  ];
  const [lidar, camera] = halves;
  line(ctx, w / 2, 20, w / 2, h - 16, COLORS.border, 1, [4, 6]);
  text(ctx, labels.lidar, lidar.x + lidar.w / 2, 22, { color: COLORS.radar, size: 13, bold: true });
  text(ctx, labels.camera, camera.x + camera.w / 2, 22, {
    color: COLORS.warn,
    size: 13,
    bold: true,
  });

  drawForest(ctx, lidar, view.canopy);
  drawForest(ctx, camera, view.canopy);
  drawAircraft(ctx, lidar.x + lidar.w / 2, lidar.top - 6, '');
  drawAircraft(ctx, camera.x + camera.w / 2, camera.top - 6, '');

  const cycle = Math.floor(tS / CYCLE_S);
  const phase = (tS % CYCLE_S) / CYCLE_S;
  const lidarBeams = beams(lidar, view);
  const cameraBeams = beams(camera, view);

  // --- LiDAR: pulsos descendo e retornos ----------------------------------------------------
  const lcx = lidar.x + lidar.w / 2;
  const dsm: Array<{ x: number; y: number }> = [];
  const dtm: Array<{ x: number; y: number }> = [];
  lidarBeams.forEach((b, j) => {
    const fire = Math.min(1, phase / 0.45);
    line(ctx, lcx, lidar.top, b.hitX, b.hitY, withAlpha(COLORS.ok, 0.35), 1);
    // O pulso desce até o 1º retorno.
    const px = lcx + (b.hitX - lcx) * fire;
    const py = lidar.top + (b.hitY - lidar.top) * fire;
    if (fire < 1) dot(ctx, px, py, 2.5, COLORS.ok);
    else {
      dot(ctx, b.hitX, b.hitY, 3.5, COLORS.radar);
      dsm.push({ x: b.hitX, y: b.hitY });
    }
    if (fire < 1) return;
    if (!b.crown) {
      // Buraco: o primeiro e último retorno são o próprio solo.
      dot(ctx, b.hitX, b.hitY, 3.5, COLORS.ok);
      dtm.push({ x: b.hitX, y: b.hitY });
      return;
    }
    // Sob a copa: retornos intermediários (violeta) e, às vezes, o do solo (emerald).
    const middle = Math.max(0, Math.min(3, view.maxReturns - 2));
    for (let m = 1; m <= middle; m++) {
      const f = (m / (middle + 1)) * 0.6;
      dot(
        ctx,
        b.hitX + (b.groundX - b.hitX) * f,
        b.hitY + (b.groundY - b.hitY) * f,
        3,
        COLORS.rift,
      );
    }
    if (view.maxReturns > 1 && hash2(j, cycle, SEED + 7) < view.closedGroundProbability) {
      dot(ctx, b.groundX, b.groundY, 3.5, COLORS.ok);
      line(ctx, b.hitX, b.hitY, b.groundX, b.groundY, withAlpha(COLORS.ok, 0.4), 1, [3, 3]);
      dtm.push({ x: b.groundX, y: b.groundY });
    }
  });

  // --- Câmera: raios que param na copa ------------------------------------------------------
  const ccx = camera.x + camera.w / 2;
  const photoDsm: Array<{ x: number; y: number }> = [];
  const visible: Array<{ x: number; y: number }> = [];
  cameraBeams.forEach((b, j) => {
    const fire = Math.min(1, phase / 0.45);
    line(ctx, ccx, camera.top, b.hitX, b.hitY, withAlpha(COLORS.warn, 0.35), 1);
    const px = ccx + (b.hitX - ccx) * fire;
    const py = camera.top + (b.hitY - camera.top) * fire;
    if (fire < 1) dot(ctx, px, py, 2.5, COLORS.warn);
    else {
      dot(ctx, b.hitX, b.hitY, 3.5, COLORS.warn);
      photoDsm.push({ x: b.hitX, y: b.hitY });
      // O solo só aparece nos buracos que duas fotos enxergam: fração (1 − c)².
      if (!b.crown && hash2(j, 9, SEED) < view.photoVisibility / Math.max(0.05, 1 - view.canopy)) {
        visible.push({ x: b.hitX, y: b.hitY });
      }
    }
  });

  // --- Perfis reconstruídos (faixa sob o solo) ----------------------------------------------
  const strip = (half: Half, points: Array<{ x: number; y: number }>, base: number) =>
    points.map((p) => ({ x: p.x, y: half.bottom - 36 + (p.y - base) * 0.45 }));
  const lidarBase = lidar.groundY;
  const cameraBase = camera.groundY;
  text(ctx, labels.dsm, lidar.x + 4, lidar.bottom - 74, {
    color: COLORS.radar,
    size: 11,
    align: 'left',
  });
  drawProfile(ctx, lidar, strip(lidar, dsm, lidarBase), COLORS.radar);
  drawProfile(
    ctx,
    lidar,
    strip(lidar, dtm, lidarBase).map((p) => ({ x: p.x, y: p.y + 14 })),
    COLORS.ok,
  );
  text(ctx, labels.dtm, lidar.x + 4, lidar.bottom - 8, {
    color: COLORS.ok,
    size: 11,
    align: 'left',
  });
  drawProfile(ctx, camera, strip(camera, photoDsm, cameraBase), COLORS.warn);
  text(ctx, labels.dsm, camera.x + 4, camera.bottom - 74, {
    color: COLORS.warn,
    size: 11,
    align: 'left',
  });
  drawProfile(
    ctx,
    camera,
    strip(camera, visible, cameraBase).map((p) => ({ x: p.x, y: p.y + 14 })),
    COLORS.ok,
    [3, 5],
  );
  text(ctx, labels.photoDtm, camera.x + 4, camera.bottom - 8, {
    color: COLORS.ok,
    size: 11,
    align: 'left',
  });

  // --- Legenda --------------------------------------------------------------------------------
  const legend: Array<[string, string]> = [
    [COLORS.radar, labels.first],
    [COLORS.rift, labels.middle],
    [COLORS.ok, labels.last],
  ];
  legend.forEach(([color, label], i) => {
    const x = lidar.x + 8 + i * 150;
    dot(ctx, x, 46, 4, color);
    text(ctx, label, x + 10, 46, { color: COLORS.textMuted, size: 11, align: 'left' });
  });
  ctx.restore();
}
