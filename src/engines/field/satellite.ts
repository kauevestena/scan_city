/**
 * Funções puras da vista de satélite (field-setup §5.1): raster, máscara de acessibilidade,
 * posições de disparo e transformação de vista. Sem DOM, para teste direto.
 */
import { isAccessible, type AccessRules } from '@/domain/accessibility';
import { photosPerLine } from '@/domain/photogrammetry';
import { clamp } from '@/lib/math';
import type { AoiPoint, FlightLine, FlightPlan, GroundPoint, Vehicle } from '@/types';
import type { TerrainSampler } from '@/world/terrain/TerrainSampler';

/** Lado maior do raster, em pixels; o outro segue a proporção da área. */
export const RASTER_PX = 512;
/** Iluminação do hillshade: azimute 315° (NO), elevação 45°. */
export const HILLSHADE = { azimuthDeg: 315, elevationDeg: 45 } as const;
/** Grade da máscara de acessibilidade. */
export const ACCESS_GRID = 64;

export interface RasterSize {
  width: number;
  height: number;
}

export function rasterSize(
  terrain: Pick<TerrainSampler, 'bounds'>,
  longSide = RASTER_PX,
): RasterSize {
  const { uMin, uMax, vMin, vMax } = terrain.bounds;
  const du = uMax - uMin;
  const dv = vMax - vMin;
  return du >= dv
    ? { width: longSide, height: Math.max(1, Math.round((longSide * dv) / du)) }
    : { width: Math.max(1, Math.round((longSide * du) / dv)), height: longSide };
}

/** Vetor da luz do hillshade em (leste = +u, sul = +v, cima). */
function lightVector(): [number, number, number] {
  const az = (HILLSHADE.azimuthDeg * Math.PI) / 180;
  const el = (HILLSHADE.elevationDeg * Math.PI) / 180;
  return [Math.sin(az) * Math.cos(el), -Math.cos(az) * Math.cos(el), Math.sin(el)];
}

/** Fator de sombreamento do relevo: 1 no plano, < 1 nas encostas de costas para a luz. */
export function hillshadeFactor(dzdu: number, dzdv: number): number {
  const [lx, ly, lz] = lightVector();
  const len = Math.hypot(dzdu, dzdv, 1);
  const dot = (-dzdu * lx - dzdv * ly + lz) / len;
  return clamp(dot / lz, 0.45, 1.25);
}

/**
 * Raster RGBA da área (AOI + margem): `cor(landCover) × hillshade`. As estradas e os
 * telhados já vêm da cobertura do solo do sampler.
 */
export function buildRaster(
  terrain: TerrainSampler,
  size: RasterSize = rasterSize(terrain),
): Uint8ClampedArray {
  const { uMin, uMax, vMin, vMax } = terrain.bounds;
  const { width, height } = size;
  const du = (uMax - uMin) / width;
  const dv = (vMax - vMin) / height;
  const data = new Uint8ClampedArray(width * height * 4);
  // Elevações nos cantos dos pixels, para as derivadas do hillshade.
  const elev = new Float32Array((width + 1) * (height + 1));
  for (let j = 0; j <= height; j++) {
    for (let i = 0; i <= width; i++)
      elev[j * (width + 1) + i] = terrain.elevation(uMin + i * du, vMin + j * dv);
  }
  const at = (i: number, j: number) => elev[j * (width + 1) + i] as number;
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const u = uMin + (i + 0.5) * du;
      const v = vMin + (j + 0.5) * dv;
      const cover = terrain.landCover(u, v);
      const dzdu = (at(i + 1, j) + at(i + 1, j + 1) - at(i, j) - at(i, j + 1)) / (2 * du);
      const dzdv = (at(i, j + 1) + at(i + 1, j + 1) - at(i, j) - at(i + 1, j)) / (2 * dv);
      const k = cover === 'WATER' ? 1 : hillshadeFactor(dzdu, dzdv);
      const [r, g, b] = terrain.palette.cover[cover];
      const o = (j * width + i) * 4;
      data[o] = r * k;
      data[o + 1] = g * k;
      data[o + 2] = b * k;
      data[o + 3] = 255;
    }
  }
  return data;
}

/**
 * Máscara de acessibilidade em `n × n` células sobre a área: 1 = nenhum veículo possuído
 * alcança o centro da célula (ou é água/telhado).
 */
export function accessMask(
  terrain: TerrainSampler,
  vehicles: readonly Vehicle[],
  rules: AccessRules,
  n = ACCESS_GRID,
): Uint8Array {
  const { uMin, uMax, vMin, vMax } = terrain.bounds;
  const mask = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const u = uMin + ((i + 0.5) * (uMax - uMin)) / n;
      const v = vMin + ((j + 0.5) * (vMax - vMin)) / n;
      mask[j * n + i] = isAccessible(u, v, terrain, vehicles, rules).ok ? 0 : 1;
    }
  }
  return mask;
}

/**
 * Posições estimadas de disparo de uma linha: a cada base, na janela da câmera
 * (AOI ± 1 base), como em `photosPerLine` (domain-math §2).
 */
export function shotPositions(line: FlightLine, plan: FlightPlan): AoiPoint[] {
  const { baseM } = plan.stats;
  const len = Math.hypot(line.end.u - line.start.u, line.end.v - line.start.v);
  if (len === 0 || baseM <= 0) return [];
  const du = (line.end.u - line.start.u) / len;
  const dv = (line.end.v - line.start.v) / len;
  const count = photosPerLine(line.aoiEndS - line.aoiStartS, baseM);
  const shots: AoiPoint[] = [];
  for (let k = 0; k < count; k++) {
    const s = line.aoiStartS + (k - 1) * baseM;
    shots.push({ u: line.start.u + du * s, v: line.start.v + dv * s });
  }
  return shots;
}

/** Ponto de apoio sob o cursor (o mais próximo dentro do raio). */
export function pickPoint(
  points: readonly GroundPoint[],
  u: number,
  v: number,
  radiusM: number,
): GroundPoint | null {
  let best: GroundPoint | null = null;
  let bestD = radiusM;
  for (const p of points) {
    const d = Math.hypot(p.u - u, p.v - v);
    if (d <= bestD) {
      best = p;
      bestD = d;
    }
  }
  return best;
}

/** Vista: centro (u, v) em metros e zoom 1×–4× sobre o enquadramento que cabe na tela. */
export interface SatView {
  centerU: number;
  centerV: number;
  zoom: number;
}

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 4;

export interface ViewTransform {
  /** px por metro. */
  scale: number;
  offsetX: number;
  offsetY: number;
}

/** Escala que enquadra a área inteira em `width × height`, com 16 px de folga. */
export function fitScale(
  terrain: Pick<TerrainSampler, 'bounds'>,
  width: number,
  height: number,
): number {
  const { uMin, uMax, vMin, vMax } = terrain.bounds;
  const pad = 16;
  return Math.max(
    1e-6,
    Math.min((width - 2 * pad) / (uMax - uMin), (height - 2 * pad) / (vMax - vMin)),
  );
}

export function viewTransform(
  terrain: Pick<TerrainSampler, 'bounds'>,
  view: SatView,
  width: number,
  height: number,
): ViewTransform {
  const scale = fitScale(terrain, width, height) * view.zoom;
  return {
    scale,
    offsetX: width / 2 - view.centerU * scale,
    offsetY: height / 2 - view.centerV * scale,
  };
}

export function toScreen(t: ViewTransform, u: number, v: number): { x: number; y: number } {
  return { x: t.offsetX + u * t.scale, y: t.offsetY + v * t.scale };
}

export function toWorld(t: ViewTransform, x: number, y: number): { u: number; v: number } {
  return { u: (x - t.offsetX) / t.scale, v: (y - t.offsetY) / t.scale };
}

/** Mantém o centro dentro da área. */
export function clampView(view: SatView, terrain: Pick<TerrainSampler, 'bounds'>): SatView {
  const { uMin, uMax, vMin, vMax } = terrain.bounds;
  return {
    zoom: clamp(view.zoom, ZOOM_MIN, ZOOM_MAX),
    centerU: clamp(view.centerU, uMin, uMax),
    centerV: clamp(view.centerV, vMin, vMax),
  };
}

/** Zoom em torno do ponto da tela (x, y): o ponto do mundo sob o cursor fica parado. */
export function zoomAt(
  view: SatView,
  terrain: Pick<TerrainSampler, 'bounds'>,
  width: number,
  height: number,
  x: number,
  y: number,
  factor: number,
): SatView {
  const before = viewTransform(terrain, view, width, height);
  const anchor = toWorld(before, x, y);
  const zoom = clamp(view.zoom * factor, ZOOM_MIN, ZOOM_MAX);
  const scale = fitScale(terrain, width, height) * zoom;
  // Novo centro tal que `anchor` continue em (x, y).
  const centerU = anchor.u - (x - width / 2) / scale;
  const centerV = anchor.v - (y - height / 2) / scale;
  return clampView({ zoom, centerU, centerV }, terrain);
}

/** Arrasta a vista em pixels de tela. */
export function panBy(
  view: SatView,
  terrain: Pick<TerrainSampler, 'bounds'>,
  width: number,
  height: number,
  dx: number,
  dy: number,
): SatView {
  const scale = fitScale(terrain, width, height) * view.zoom;
  return clampView(
    { ...view, centerU: view.centerU - dx / scale, centerV: view.centerV - dy / scale },
    terrain,
  );
}

/** Vista inicial: a área inteira, centrada na AOI. */
export function initialView(terrain: Pick<TerrainSampler, 'aoi'>): SatView {
  return { centerU: terrain.aoi.lengthM / 2, centerV: terrain.aoi.widthM / 2, zoom: 1 };
}

/** Comprimento "redondo" da escala gráfica para cerca de `targetPx`. */
export function scaleBarMeters(scalePxPerM: number, targetPx = 100): number {
  const raw = targetPx / scalePxPerM;
  const pow = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 5, 10]) if (m * pow >= raw * 0.75) return m * pow;
  return 10 * pow;
}

const canopyCache = new WeakMap<TerrainSampler, number>();

/** Dossel médio da AOI (grade de 20 × 20), para a densidade de solo prevista do LiDAR. */
export function meanCanopy(terrain: TerrainSampler): number {
  const cached = canopyCache.get(terrain);
  if (cached !== undefined) return cached;
  const { lengthM, widthM } = terrain.aoi;
  let sum = 0;
  const n = 20;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++)
      sum += terrain.canopy(((i + 0.5) * lengthM) / n, ((j + 0.5) * widthM) / n);
  }
  const mean = sum / (n * n);
  canopyCache.set(terrain, mean);
  return mean;
}
