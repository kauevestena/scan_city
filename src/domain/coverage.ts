/** Cobertura e mapa de calor — domain-math §9. */
import type {
  AircraftKind,
  AoiPoint,
  CameraSensor,
  Contract,
  CoverageResult,
  SensorKind,
  Shot,
} from '@/types';
import { pointInPolygon, polygonBounds } from './geometry';
import { obliqueFootprint, verticalFovRad } from './photogrammetry';

const DEG = Math.PI / 180;

/** Grade de contagem de fotos sobre a AOI: colunas ao longo de `u` (comprimento), linhas em `v`. */
export interface CoverageGrid {
  cols: number;
  rows: number;
  cellLengthM: number;
  cellWidthM: number;
  /** Fotos por célula, índice `row · cols + col`. */
  counts: number[];
}

export function createCoverageGrid(aoi: Contract['aoi'], cols = 64, rows = 64): CoverageGrid {
  return {
    cols,
    rows,
    cellLengthM: aoi.lengthM / cols,
    cellWidthM: aoi.widthM / rows,
    counts: new Array<number>(cols * rows).fill(0),
  };
}

/** Centro da célula `index`, no frame da AOI. */
export function cellCenter(grid: CoverageGrid, index: number): AoiPoint {
  const col = index % grid.cols;
  const row = Math.floor(index / grid.cols);
  return { u: (col + 0.5) * grid.cellLengthM, v: (row + 0.5) * grid.cellWidthM };
}

/**
 * Polígono da pegada no solo. Retângulo H_g (ao longo do rumo) × W_g centrado na foto;
 * na asa fixa o rumo inclui o crab; na oblíqua, a pegada de §2.8 deslocada à frente.
 */
export function footprintPolygon(
  shot: Shot,
  aircraftKind: AircraftKind,
  sensor: CameraSensor,
  focalM: number,
): AoiPoint[] {
  const heading = shot.headingRad + (aircraftKind === 'FIXED_WING_VTOL' ? shot.crabRad : 0);
  let lengthM = shot.footprintHM;
  let widthM = shot.footprintWM;
  let offsetM = 0;
  if (shot.tiltDeg > 0) {
    const o = obliqueFootprint(
      shot.aglM,
      shot.tiltDeg * DEG,
      sensor.sensorWidthMm / 1000,
      focalM,
      verticalFovRad(sensor, focalM),
    );
    lengthM = o.lengthM;
    widthM = o.widthCenterM;
    offsetM = o.centerOffsetM;
  }
  const cos = Math.cos(heading);
  const sin = Math.sin(heading);
  const cu = shot.u + offsetM * cos;
  const cv = shot.v + offsetM * sin;
  const corners: Array<[number, number]> = [
    [-lengthM / 2, -widthM / 2],
    [lengthM / 2, -widthM / 2],
    [lengthM / 2, widthM / 2],
    [-lengthM / 2, widthM / 2],
  ];
  return corners.map(([a, b]) => ({ u: cu + a * cos - b * sin, v: cv + a * sin + b * cos }));
}

/** +1 em cada célula cujo centro esteja dentro do polígono. */
export function accumulateShot(grid: CoverageGrid, polygon: readonly AoiPoint[]): void {
  const box = polygonBounds(polygon);
  const c0 = Math.max(0, Math.floor(box.uMin / grid.cellLengthM));
  const c1 = Math.min(grid.cols - 1, Math.floor(box.uMax / grid.cellLengthM));
  const r0 = Math.max(0, Math.floor(box.vMin / grid.cellWidthM));
  const r1 = Math.min(grid.rows - 1, Math.floor(box.vMax / grid.cellWidthM));
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      const index = row * grid.cols + col;
      if (pointInPolygon(cellCenter(grid, index), polygon)) {
        grid.counts[index] = (grid.counts[index] as number) + 1;
      }
    }
  }
}

export interface ShotRules {
  /** Tipo da câmera que fez as fotos (a névoa só invalida RGB). */
  sensorKind: SensorKind;
  /** Regra especial `SPECULAR_WATER`. */
  specularWater: boolean;
}

/** A foto conta para a cobertura? */
export function isShotValid(shot: Shot, rules: ShotRules): boolean {
  if (shot.blurred) return false;
  if (shot.inFog && rules.sensorKind === 'RGB') return false;
  return !(shot.overWater && rules.specularWater && shot.lighting === 'SUN_HIGH');
}

/** Índices das células cujo centro satisfaz `predicate` (ex.: água). */
export function excludedCellsWhere(
  grid: CoverageGrid,
  predicate: (u: number, v: number) => boolean,
): number[] {
  const out: number[] = [];
  for (let i = 0; i < grid.counts.length; i++) {
    const c = cellCenter(grid, i);
    if (predicate(c.u, c.v)) out.push(i);
  }
  return out;
}

/** Frações verde (≥ 5), amarela (3–4) e vermelha (< 3) sobre as células não excluídas. */
export function summarizeCoverage(
  grid: CoverageGrid,
  excludedCells: readonly number[],
): CoverageResult {
  const excluded = new Set(excludedCells);
  let green = 0;
  let yellow = 0;
  let red = 0;
  let sum = 0;
  let valid = 0;
  grid.counts.forEach((count, i) => {
    if (excluded.has(i)) return;
    valid++;
    sum += count;
    if (count >= 5) green++;
    else if (count >= 3) yellow++;
    else red++;
  });
  const frac = (n: number) => (valid > 0 ? n / valid : 0);
  return {
    cols: grid.cols,
    rows: grid.rows,
    counts: [...grid.counts],
    green: frac(green),
    yellow: frac(yellow),
    red: frac(red),
    excludedCells: [...excludedCells],
    meanCount: frac(sum),
  };
}

export interface CoverageOptions {
  aircraftKind: AircraftKind;
  sensor: CameraSensor;
  focalM: number;
  rules: ShotRules;
  excludedCells: readonly number[];
}

/** Grade de cobertura completa a partir das fotos da missão (só as válidas contam). */
export function buildCoverage(
  shots: readonly Shot[],
  aoi: Contract['aoi'],
  opts: CoverageOptions,
): CoverageResult {
  const grid = createCoverageGrid(aoi);
  for (const shot of shots) {
    if (isShotValid(shot, opts.rules)) {
      accumulateShot(grid, footprintPolygon(shot, opts.aircraftKind, opts.sensor, opts.focalM));
    }
  }
  return summarizeCoverage(grid, opts.excludedCells);
}
