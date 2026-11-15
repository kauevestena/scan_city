/**
 * Visuais da esteira SfM (processing-results §5.2), num canvas 640 × 360. Tudo é
 * determinístico (RNG seedado pela missão). A etapa 4 desenha a nuvem densa em 3D com o
 * `soft3d`, girando devagar.
 */
import { RULE_PARAMS } from '@/domain/specialRules';
import { formatNumber } from '@/lib/format';
import { mulberry32, type Rng } from '@/lib/rng';
import type { AoiPoint, LensCalibration, WorldObject } from '@/types';
import { COLORS, FONTS, withAlpha } from '@/ui/tokens';
import type { Polyline, TerrainSampler } from '@/world/terrain/TerrainSampler';
import { OrbitCamera } from '../soft3d/OrbitCamera';
import { Soft3DRenderer } from '../soft3d/Renderer';
import { hypsometricColor } from './orthoPreview';

export const VIZ_W = 640;
export const VIZ_H = 360;
/** Fator de tie points e features com `HOMOGENEOUS_TEXTURE` (×0,6). */
const TIE_POINT_FACTOR = RULE_PARAMS.homogeneousTexture.tiePointFactor;
/** Features por imagem com textura normal (×0,6 com textura homogênea). */
export const FEATURES_PER_IMAGE = 8000;

export interface PipelineAssets {
  ortho: CanvasImageSource;
  hypso: CanvasImageSource;
  orthoW: number;
  orthoH: number;
  aoi: { lengthM: number; widthM: number };
  /** Centros das fotos (até 24 viram miniaturas). */
  shots: readonly AoiPoint[];
  /** Ordem das linhas de voo, para o mosaico. */
  lines: ReadonlyArray<{ start: AoiPoint; end: AoiPoint }>;
  cloud: ReadonlyArray<{ u: number; v: number; z: number; color: string }>;
  objects: readonly WorldObject[];
  roads: readonly Polyline[];
  homogeneous: boolean;
  lens?: LensCalibration;
  /** Dados LiDAR da missão (esteira LiDAR). */
  lidar?: LidarAssets;
  seed: number;
}

export interface LidarAssets {
  samples: ReadonlyArray<{
    u: number;
    v: number;
    z: number;
    ret: 'FIRST' | 'INTERMEDIATE' | 'GROUND';
  }>;
  /** σ da trajetória GNSS/IMU, cm. */
  sigmaCm: number;
  /** Pulsos registrados (define o tamanho do arquivo LAS). */
  pulses: number;
}

/** Amostras da nuvem densa: pontos do MDS com a cor da hipsometria. */
export function cloudSamples(
  terrain: TerrainSampler,
  rng: Rng,
  n = 1500,
): Array<{ u: number; v: number; z: number; color: string }> {
  const { lengthM, widthM } = terrain.aoi;
  const pts: Array<{ u: number; v: number; z: number }> = [];
  let lo = Infinity;
  let hi = -Infinity;
  for (let k = 0; k < n; k++) {
    const u = rng.range(0, lengthM);
    const v = rng.range(0, widthM);
    const z = terrain.surface(u, v);
    lo = Math.min(lo, z);
    hi = Math.max(hi, z);
    pts.push({ u, v, z });
  }
  const span = Math.max(1e-6, hi - lo);
  return pts.map((p) => {
    // 12 faixas de cor: a nuvem é desenhada por grupo.
    const [r, g, b] = hypsometricColor(Math.round(((p.z - lo) / span) * 11) / 11);
    return { ...p, color: `rgb(${r | 0}, ${g | 0}, ${b | 0})` };
  });
}

export function easeProgress(p: number): number {
  return Math.min(1, Math.max(0, p));
}

export function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string = COLORS.text,
): void {
  ctx.font = `12px ${FONTS.mono}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(text, x, y);
}

/** Recorte da orto em volta de um centro de foto (miniatura). */
function thumb(
  ctx: CanvasRenderingContext2D,
  a: PipelineAssets,
  p: AoiPoint,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const sx = (p.u / a.aoi.lengthM) * a.orthoW;
  const sy = (p.v / a.aoi.widthM) * a.orthoH;
  const sw = a.orthoW * 0.25;
  const sh = a.orthoH * 0.25;
  ctx.drawImage(a.ortho, Math.max(0, sx - sw / 2), Math.max(0, sy - sh / 2), sw, sh, x, y, w, h);
  ctx.strokeStyle = withAlpha(COLORS.border, 0.9);
  ctx.strokeRect(x, y, w, h);
}

function stageFeatures(
  ctx: CanvasRenderingContext2D,
  a: PipelineAssets,
  p: number,
  texts: VizTexts,
): void {
  const cols = 6;
  const rows = 4;
  const w = 96;
  const h = 64;
  const rng = mulberry32(a.seed);
  const shots = a.shots.slice(0, cols * rows);
  shots.forEach((s, k) => {
    const x = 20 + (k % cols) * (w + 6);
    const y = 40 + Math.floor(k / cols) * (h + 8);
    thumb(ctx, a, s, x, y, w, h);
    const dots = Math.floor(28 * p * (a.homogeneous ? TIE_POINT_FACTOR : 1));
    ctx.fillStyle = COLORS.warn;
    for (let d = 0; d < 28; d++) {
      const px = x + rng.next() * w;
      const py = y + rng.next() * h;
      if (d < dots) ctx.fillRect(px - 1, py - 1, 2, 2);
    }
  });
  const n = Math.round(FEATURES_PER_IMAGE * (a.homogeneous ? TIE_POINT_FACTOR : 1) * p);
  label(ctx, texts.featuresPerImage(formatNumber(n, 0)), 20, 14);
}

function stageTiePoints(
  ctx: CanvasRenderingContext2D,
  a: PipelineAssets,
  p: number,
  timeS: number,
  texts: VizTexts,
): void {
  const pair = Math.floor(timeS * 1.5) % Math.max(1, a.shots.length - 1);
  const left = a.shots[pair] ?? { u: 0, v: 0 };
  const right = a.shots[pair + 1] ?? left;
  const w = 280;
  const h = 210;
  thumb(ctx, a, left, 30, 70, w, h);
  thumb(ctx, a, right, 330, 70, w, h);
  const rng = mulberry32(a.seed + pair);
  const lines = Math.round(30 * (a.homogeneous ? TIE_POINT_FACTOR : 1));
  ctx.strokeStyle = withAlpha(COLORS.ok, 0.8);
  ctx.lineWidth = 1;
  for (let k = 0; k < lines; k++) {
    const y1 = 70 + rng.next() * h;
    const x1 = 30 + 140 + rng.next() * 140;
    const y2 = y1 + (rng.next() - 0.5) * 12;
    const x2 = 330 + rng.next() * 140;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  label(
    ctx,
    texts.tiePoints(
      formatNumber(
        Math.round(a.shots.length * 900 * (a.homogeneous ? TIE_POINT_FACTOR : 1) * p),
        0,
      ),
    ),
    30,
    40,
  );
  if (a.homogeneous) label(ctx, texts.homogeneous, 30, 300, COLORS.warn);
}

function stageBundle(
  ctx: CanvasRenderingContext2D,
  a: PipelineAssets,
  p: number,
  texts: VizTexts,
): void {
  const final = a.lens?.reprojErrorPx ?? 0.35;
  const x0 = 40;
  const y0 = 60;
  const w = 340;
  const h = 240;
  ctx.strokeStyle = COLORS.border;
  ctx.strokeRect(x0, y0, w, h);
  label(ctx, texts.reprojection, x0, y0 - 22);
  const iters = 20;
  const err = (k: number) => final + (4 - final) * Math.exp(-k / 3.5);
  ctx.strokeStyle = COLORS.radar;
  ctx.lineWidth = 2;
  ctx.beginPath();
  const shown = Math.max(1, Math.round(iters * p));
  for (let k = 0; k <= shown; k++) {
    const x = x0 + (k / iters) * w;
    const y = y0 + h - (err(k) / 4) * h;
    if (k === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  label(ctx, `${err(shown).toFixed(2)} px · ${texts.iteration} ${shown}`, x0, y0 + h + 8);
  // Parâmetros "rodando" até os valores finais.
  const lens = a.lens;
  if (lens) {
    const rows: Array<[string, number, number]> = [
      ['f', lens.fPx, 2],
      ['cx', lens.cxPx, 1],
      ['cy', lens.cyPx, 1],
      ['k1', lens.k1, 4],
      ['k2', lens.k2, 4],
      ['p1', lens.p1, 5],
      ['p2', lens.p2, 5],
    ];
    rows.forEach(([name, value, decimals], k) => {
      const shownValue = value * (0.6 + 0.4 * p) + (1 - p) * 0.01 * Math.sin(k + p * 40);
      label(ctx, `${name.padEnd(3)} ${shownValue.toFixed(decimals)}`, 420, 70 + k * 24);
    });
  }
}

const cloudCache = new WeakMap<PipelineAssets, Array<{ color: string; positions: Float32Array }>>();
const cloudRenderer = new Soft3DRenderer();

/** Nuvem em coordenadas normalizadas (lado maior = 2), agrupada por cor. */
function cloudBuckets(a: PipelineAssets): Array<{ color: string; positions: Float32Array }> {
  const hit = cloudCache.get(a);
  if (hit) return hit;
  const side = Math.max(a.aoi.lengthM, a.aoi.widthM);
  const zs = a.cloud.map((p) => p.z);
  const lo = Math.min(...zs);
  const span = Math.max(1e-6, Math.max(...zs) - lo);
  const groups = new Map<string, number[]>();
  for (const p of a.cloud) {
    const list = groups.get(p.color) ?? [];
    list.push(
      ((p.u - a.aoi.lengthM / 2) / side) * 2,
      ((p.z - lo) / span) * 0.35,
      ((p.v - a.aoi.widthM / 2) / side) * 2,
    );
    groups.set(p.color, list);
  }
  const out = [...groups].map(([color, list]) => ({ color, positions: new Float32Array(list) }));
  cloudCache.set(a, out);
  return out;
}

function stageCloud(
  ctx: CanvasRenderingContext2D,
  a: PipelineAssets,
  p: number,
  timeS: number,
  texts: VizTexts,
): void {
  const camera = new OrbitCamera(1.2);
  camera.yaw = timeS * 0.4;
  camera.pitch = (30 * Math.PI) / 180;
  camera.distance = 2.6;
  // A densidade cresce com o progresso: cada grupo mostra a mesma fração dos pontos.
  const points = cloudBuckets(a).map((b) => ({
    color: b.color,
    size: 2,
    positions: b.positions.subarray(0, Math.floor((b.positions.length / 3) * p) * 3),
  }));
  cloudRenderer.render(ctx, VIZ_W, VIZ_H, camera.matrix(VIZ_W / VIZ_H), [], [], points);
  label(ctx, texts.points(formatNumber(Math.round(a.cloud.length * p), 0)), 20, 14);
}

export function stageSweep(
  ctx: CanvasRenderingContext2D,
  a: PipelineAssets,
  image: CanvasImageSource,
  p: number,
): { x: number; y: number; w: number; h: number } {
  const w = 480;
  const h = Math.round((w * a.orthoH) / a.orthoW);
  const x = (VIZ_W - w) / 2;
  const y = (VIZ_H - h) / 2;
  ctx.strokeStyle = COLORS.border;
  ctx.strokeRect(x, y, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w * p, h);
  ctx.clip();
  ctx.drawImage(image, x, y, w, h);
  ctx.restore();
  return { x, y, w, h };
}

function stageMosaic(ctx: CanvasRenderingContext2D, a: PipelineAssets, p: number): void {
  const w = 480;
  const h = Math.round((w * a.orthoH) / a.orthoW);
  const x0 = (VIZ_W - w) / 2;
  const y0 = (VIZ_H - h) / 2;
  const cols = 8;
  const rows = 6;
  ctx.strokeStyle = COLORS.border;
  ctx.strokeRect(x0, y0, w, h);
  // Tiles em ordem de linha de voo (zigue-zague).
  const total = cols * rows;
  const shown = Math.round(total * p);
  for (let k = 0; k < shown; k++) {
    const r = Math.floor(k / cols);
    const c = r % 2 === 0 ? k % cols : cols - 1 - (k % cols);
    const sx = (c / cols) * a.orthoW;
    const sy = (r / rows) * a.orthoH;
    ctx.drawImage(
      a.ortho,
      sx,
      sy,
      a.orthoW / cols,
      a.orthoH / rows,
      x0 + (c * w) / cols,
      y0 + (r * h) / rows,
      w / cols,
      h / rows,
    );
  }
}

function stageVector(ctx: CanvasRenderingContext2D, a: PipelineAssets, p: number): void {
  const w = 480;
  const h = Math.round((w * a.orthoH) / a.orthoW);
  const x0 = (VIZ_W - w) / 2;
  const y0 = (VIZ_H - h) / 2;
  ctx.drawImage(a.ortho, x0, y0, w, h);
  const kx = w / a.aoi.lengthM;
  const ky = h / a.aoi.widthM;
  ctx.strokeStyle = COLORS.radar;
  ctx.lineWidth = 1.5;
  const buildings = a.objects.filter((o) => o.kind === 'BUILDING');
  const n = Math.round(buildings.length * p);
  for (const o of buildings.slice(0, n)) {
    ctx.strokeRect(
      x0 + (o.u - o.widthM / 2) * kx,
      y0 + (o.v - o.depthM / 2) * ky,
      o.widthM * kx,
      o.depthM * ky,
    );
  }
  ctx.strokeStyle = COLORS.warn;
  for (const road of a.roads) {
    ctx.beginPath();
    const pts = road.points.slice(0, Math.max(2, Math.round(road.points.length * p)));
    pts.forEach((pt, k) =>
      k === 0
        ? ctx.moveTo(x0 + pt.u * kx, y0 + pt.v * ky)
        : ctx.lineTo(x0 + pt.u * kx, y0 + pt.v * ky),
    );
    ctx.stroke();
  }
}

export interface VizTexts {
  featuresPerImage: (n: string) => string;
  tiePoints: (n: string) => string;
  homogeneous: string;
  reprojection: string;
  iteration: string;
  points: (n: string) => string;
}

/** Desenha o visual da etapa `stage` (0–6) com o progresso `p` (0–1) da etapa. */
export function drawPipelineStage(
  ctx: CanvasRenderingContext2D,
  a: PipelineAssets,
  stage: number,
  progress: number,
  timeS: number,
  texts: VizTexts,
): void {
  const p = easeProgress(progress);
  ctx.fillStyle = COLORS.bgBase;
  ctx.fillRect(0, 0, VIZ_W, VIZ_H);
  switch (stage) {
    case 0:
      stageFeatures(ctx, a, p, texts);
      break;
    case 1:
      stageTiePoints(ctx, a, p, timeS, texts);
      break;
    case 2:
      stageBundle(ctx, a, p, texts);
      break;
    case 3:
      stageCloud(ctx, a, p, timeS, texts);
      break;
    case 4:
      stageSweep(ctx, a, a.hypso, p);
      break;
    case 5:
      stageMosaic(ctx, a, p);
      break;
    default:
      stageVector(ctx, a, p);
      break;
  }
}
