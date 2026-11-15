/**
 * Visuais da esteira LiDAR (processing-results §5.3), no mesmo canvas 640 × 360 da SfM:
 * 1 trajetória GNSS/IMU (SBET), 2 georreferenciamento, 3 ajuste entre faixas, 4 classificação
 * solo/vegetação, 5 MDT/MDS e 6 exportação (LAS). Determinístico pela seed da missão.
 */
import { formatNumber } from '@/lib/format';
import { mulberry32 } from '@/lib/rng';
import { COLORS, withAlpha } from '@/ui/tokens';
import { hypsometricColor } from './orthoPreview';
import {
  VIZ_H,
  VIZ_W,
  easeProgress,
  label,
  stageSweep,
  type LidarAssets,
  type PipelineAssets,
} from './pipelineViz';
import { RETURN_COLORS } from './pointCloud';

/** Bytes por ponto do LAS 1.4 (formato 6, sem RGB). */
export const LAS_BYTES_PER_POINT = 30;
/** Cabeçalho do LAS. */
export const LAS_HEADER_BYTES = 375;
/** Número de etapas da esteira LiDAR. */
export const LIDAR_STAGES = 6;

export interface LidarVizTexts {
  trajectory: (sigmaCm: string) => string;
  georef: (n: string) => string;
  discrepancy: string;
  discrepancyRms: (cm: string) => string;
  classes: { FIRST: string; INTERMEDIATE: string; GROUND: string };
  las: (size: string) => string;
}

/** Tamanho estimado do arquivo LAS, em bytes. */
export function lasSizeBytes(pulses: number): number {
  return LAS_HEADER_BYTES + Math.round(pulses) * LAS_BYTES_PER_POINT;
}

/** Mapeamento da AOI para uma área de 480 × h no centro do canvas. */
function frame(a: PipelineAssets): {
  x: number;
  y: number;
  w: number;
  h: number;
  kx: number;
  ky: number;
} {
  const w = 480;
  const h = Math.round((w * a.aoi.widthM) / a.aoi.lengthM);
  return {
    x: (VIZ_W - w) / 2,
    y: (VIZ_H - h) / 2,
    w,
    h,
    kx: w / a.aoi.lengthM,
    ky: h / a.aoi.widthM,
  };
}

function stageTrajectory(
  ctx: CanvasRenderingContext2D,
  a: PipelineAssets,
  lidar: LidarAssets,
  p: number,
  texts: LidarVizTexts,
): void {
  const f = frame(a);
  ctx.strokeStyle = COLORS.border;
  ctx.strokeRect(f.x, f.y, f.w, f.h);
  // As linhas em ordem de voo, com o desvio GNSS/IMU (ruído de fração do σ).
  const rng = mulberry32(a.seed ^ 0x5be7);
  const segs = a.lines;
  const drawn = Math.max(0, p * segs.length);
  ctx.lineWidth = 1.5;
  segs.forEach((line, i) => {
    if (i >= Math.ceil(drawn)) return;
    const t = Math.min(1, drawn - i);
    ctx.strokeStyle = COLORS.radar;
    ctx.beginPath();
    ctx.moveTo(f.x + line.start.u * f.kx, f.y + line.start.v * f.ky);
    ctx.lineTo(
      f.x + (line.start.u + (line.end.u - line.start.u) * t) * f.kx,
      f.y + (line.start.v + (line.end.v - line.start.v) * t) * f.ky,
    );
    ctx.stroke();
    // O "desvio" do SBET em torno da linha: pontos com ruído proporcional ao σ.
    ctx.fillStyle = withAlpha(COLORS.warn, 0.7);
    for (let k = 0; k < 14 * t; k++) {
      const s = (k + 0.5) / 14;
      const u = line.start.u + (line.end.u - line.start.u) * s;
      const v = line.start.v + (line.end.v - line.start.v) * s;
      ctx.fillRect(f.x + u * f.kx + 4 * rng.normal(), f.y + v * f.ky + 4 * rng.normal(), 1.5, 1.5);
    }
  });
  label(ctx, texts.trajectory(formatNumber(lidar.sigmaCm, 1)), 12, 12, COLORS.warn);
}

function stageGeoref(
  ctx: CanvasRenderingContext2D,
  a: PipelineAssets,
  lidar: LidarAssets,
  p: number,
  texts: LidarVizTexts,
): void {
  const f = frame(a);
  ctx.strokeStyle = COLORS.border;
  ctx.strokeRect(f.x, f.y, f.w, f.h);
  const zs = lidar.samples.map((s) => s.z);
  const lo = Math.min(...zs, 0);
  const hi = Math.max(...zs, lo + 1e-6);
  const n = Math.floor(lidar.samples.length * p);
  for (let i = 0; i < n; i++) {
    const s = lidar.samples[i] as LidarAssets['samples'][number];
    const [r, g, b] = hypsometricColor((s.z - lo) / (hi - lo));
    ctx.fillStyle = `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
    ctx.fillRect(f.x + s.u * f.kx, f.y + s.v * f.ky, 2, 2);
  }
  label(ctx, texts.georef(formatNumber(Math.round(lidar.pulses * p), 0)), 12, 12);
}

/** Histograma de discrepâncias entre faixas: a largura cai de 12 para 3 cm com o ajuste. */
function stageStripAdjust(ctx: CanvasRenderingContext2D, p: number, texts: LidarVizTexts): void {
  const bins = 31;
  const sigma = 12 - 9 * p;
  const x0 = 80;
  const w = VIZ_W - 160;
  const base = VIZ_H - 60;
  const maxH = 200;
  ctx.fillStyle = COLORS.radar;
  for (let k = 0; k < bins; k++) {
    const d = ((k - (bins - 1) / 2) / ((bins - 1) / 2)) * 30; // −30…+30 cm
    // Com a área conservada, a curva estreita fica mais alta (de 30 % a 100 % da altura máxima).
    const peak = Math.min(1, (0.3 * 12) / sigma);
    const h = maxH * peak * Math.exp(-(d * d) / (2 * sigma * sigma));
    ctx.fillRect(x0 + (k * w) / bins, base - h, w / bins - 2, h);
  }
  ctx.strokeStyle = COLORS.border;
  ctx.beginPath();
  ctx.moveTo(x0, base + 0.5);
  ctx.lineTo(x0 + w, base + 0.5);
  ctx.stroke();
  label(ctx, texts.discrepancy, 12, 12);
  label(ctx, texts.discrepancyRms(formatNumber(sigma, 1)), 12, 30, COLORS.warn);
}

/** A nuvem muda de cinza para a cor do retorno, em ordem de u, com a legenda. */
function stageClassify(
  ctx: CanvasRenderingContext2D,
  a: PipelineAssets,
  lidar: LidarAssets,
  p: number,
  texts: LidarVizTexts,
): void {
  const f = frame(a);
  ctx.strokeStyle = COLORS.border;
  ctx.strokeRect(f.x, f.y, f.w, f.h);
  const front = p * a.aoi.lengthM;
  for (const s of lidar.samples) {
    ctx.fillStyle = s.u <= front ? RETURN_COLORS[s.ret] : COLORS.textMuted;
    ctx.fillRect(f.x + s.u * f.kx, f.y + s.v * f.ky, 2, 2);
  }
  // A linha de varredura da classificação.
  ctx.strokeStyle = COLORS.warn;
  ctx.beginPath();
  ctx.moveTo(f.x + front * f.kx, f.y);
  ctx.lineTo(f.x + front * f.kx, f.y + f.h);
  ctx.stroke();
  (['FIRST', 'INTERMEDIATE', 'GROUND'] as const).forEach((ret, k) =>
    label(ctx, texts.classes[ret], 12, 12 + k * 16, RETURN_COLORS[ret]),
  );
}

function stageExport(
  ctx: CanvasRenderingContext2D,
  lidar: LidarAssets,
  p: number,
  texts: LidarVizTexts,
): void {
  const total = lasSizeBytes(lidar.pulses);
  const x = 80;
  const w = VIZ_W - 160;
  const y = VIZ_H / 2 - 12;
  ctx.strokeStyle = COLORS.border;
  ctx.strokeRect(x, y, w, 24);
  ctx.fillStyle = COLORS.ok;
  ctx.fillRect(x + 1, y + 1, (w - 2) * p, 22);
  label(ctx, texts.las(formatBytes(total * p)), x, y - 24);
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1e6) return `${formatNumber(bytes / 1e6, 1)} MB`;
  if (bytes >= 1e3) return `${formatNumber(bytes / 1e3, 1)} kB`;
  return `${formatNumber(bytes, 0)} B`;
}

/** Desenha o visual da etapa `stage` (0–5) da esteira LiDAR com o progresso `progress`. */
export function drawLidarStage(
  ctx: CanvasRenderingContext2D,
  a: PipelineAssets,
  stage: number,
  progress: number,
  texts: LidarVizTexts,
): void {
  const p = easeProgress(progress);
  const lidar = a.lidar ?? { samples: [], sigmaCm: 0, pulses: 0 };
  ctx.fillStyle = COLORS.bgBase;
  ctx.fillRect(0, 0, VIZ_W, VIZ_H);
  switch (stage) {
    case 0:
      stageTrajectory(ctx, a, lidar, p, texts);
      break;
    case 1:
      stageGeoref(ctx, a, lidar, p, texts);
      break;
    case 2:
      stageStripAdjust(ctx, p, texts);
      break;
    case 3:
      stageClassify(ctx, a, lidar, p, texts);
      break;
    case 4:
      stageSweep(ctx, a, a.hypso, p);
      break;
    default:
      stageExport(ctx, lidar, p, texts);
      break;
  }
}
