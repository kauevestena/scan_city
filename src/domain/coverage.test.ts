import { getSensor } from '@/data/catalog';
import type { Shot } from '@/types';
import {
  accumulateShot,
  buildCoverage,
  createCoverageGrid,
  excludedCellsWhere,
  footprintPolygon,
  isShotValid,
  summarizeCoverage,
} from './coverage';
import { polygonArea } from './geometry';
import { realFocalM } from './photogrammetry';

const AOI = { widthM: 160, lengthM: 240 };
const FF = getSensor('CAM_45MP_FF');

function shot(overrides: Partial<Shot> = {}): Shot {
  return {
    i: 0,
    t: 0,
    sortie: 0,
    lineIndex: 0,
    u: 60,
    v: 40,
    aglM: 60,
    altM: 60,
    speedMs: 10,
    headingRad: 0,
    crabRad: 0,
    tiltDeg: 0,
    footprintWM: 80,
    footprintHM: 120,
    blurPx: 0.2,
    skewPx: 0,
    blurred: false,
    lighting: 'SUN_HIGH',
    rtk: 'NONE',
    manual: false,
    overWater: false,
    inFog: false,
    ...overrides,
  };
}

describe('grade e rasterização', () => {
  it('a grade padrão é 64 × 64 sobre a AOI', () => {
    const grid = createCoverageGrid(AOI);
    expect(grid).toMatchObject({ cols: 64, rows: 64, cellLengthM: 240 / 64, cellWidthM: 160 / 64 });
    expect(grid.counts).toHaveLength(64 * 64);
  });

  it('uma pegada que cobre exatamente 1/4 da AOI marca ≈ 1/4 das células (± 2 %)', () => {
    const grid = createCoverageGrid(AOI);
    // Retângulo de 120 × 80 m (metade × metade) centrado no primeiro quadrante.
    accumulateShot(grid, footprintPolygon(shot(), 'MULTIROTOR', FF, 0.035));
    const marked = grid.counts.filter((c) => c > 0).length / grid.counts.length;
    expect(Math.abs(marked - 0.25)).toBeLessThanOrEqual(0.02);
  });

  it('5 pegadas sobrepostas na mesma área dão células verdes', () => {
    const grid = createCoverageGrid(AOI);
    for (let k = 0; k < 5; k++)
      accumulateShot(grid, footprintPolygon(shot({ u: 60 + k }), 'MULTIROTOR', FF, 0.035));
    const result = summarizeCoverage(grid, []);
    expect(result.green).toBeGreaterThan(0.2);
    expect(Math.max(...result.counts)).toBe(5);
  });

  it('células de água são excluídas das frações', () => {
    const grid = createCoverageGrid(AOI);
    accumulateShot(
      grid,
      footprintPolygon(
        shot({ u: 120, v: 80, footprintHM: 1000, footprintWM: 1000 }),
        'MULTIROTOR',
        FF,
        0.035,
      ),
    );
    // Metade direita (u > 120) é água: só a metade esquerda conta.
    const water = excludedCellsWhere(grid, (u) => u > 120);
    expect(water).toHaveLength(32 * 64);
    const all = summarizeCoverage(grid, []);
    const dry = summarizeCoverage(grid, water);
    expect(all.red).toBe(1);
    expect(dry.excludedCells).toEqual(water);
    expect(dry.red).toBe(1);
    expect(dry.meanCount).toBe(1);
    expect(dry.green + dry.yellow + dry.red).toBeCloseTo(1, 12);
  });

  it('classes: verde ≥ 5, amarelo 3–4, vermelho < 3', () => {
    const grid = createCoverageGrid({ widthM: 4, lengthM: 4 }, 2, 2);
    grid.counts.splice(0, 4, 5, 4, 3, 2);
    const r = summarizeCoverage(grid, []);
    expect([r.green, r.yellow, r.red]).toEqual([0.25, 0.5, 0.25]);
    expect(r.meanCount).toBe(3.5);
    // Tudo excluído: frações zeradas, sem divisão por zero.
    expect(summarizeCoverage(grid, [0, 1, 2, 3])).toMatchObject({
      green: 0,
      yellow: 0,
      red: 0,
      meanCount: 0,
    });
  });
});

describe('footprintPolygon', () => {
  it('retângulo H_g × W_g girado pelo rumo da linha', () => {
    const along = footprintPolygon(shot({ headingRad: 0 }), 'MULTIROTOR', FF, 0.035);
    const across = footprintPolygon(shot({ headingRad: Math.PI / 2 }), 'MULTIROTOR', FF, 0.035);
    expect(polygonArea(along)).toBeCloseTo(120 * 80, 9);
    const span = (poly: typeof along, k: 'u' | 'v') =>
      Math.max(...poly.map((p) => p[k])) - Math.min(...poly.map((p) => p[k]));
    expect(span(along, 'u')).toBeCloseTo(120, 9);
    expect(span(across, 'u')).toBeCloseTo(80, 9);
  });

  it('asa fixa soma o crab ao rumo; multirrotor ignora', () => {
    const s = shot({ crabRad: Math.PI / 2 });
    const wing = footprintPolygon(s, 'FIXED_WING_VTOL', FF, 0.035);
    const rotor = footprintPolygon(s, 'MULTIROTOR', FF, 0.035);
    const spanU = (poly: typeof wing) =>
      Math.max(...poly.map((p) => p.u)) - Math.min(...poly.map((p) => p.u));
    expect(spanU(wing)).toBeCloseTo(80, 9);
    expect(spanU(rotor)).toBeCloseTo(120, 9);
  });

  it('oblíqua: deslocada à frente, pela pegada de §2.8', () => {
    const focal = realFocalM(FF, { id: 'LENS_35', name: '', equivFocalMm: 35, priceBRL: 0 });
    const poly = footprintPolygon(shot({ tiltDeg: 45, u: 0, v: 0 }), 'MULTIROTOR', FF, focal);
    const us = poly.map((p) => p.u);
    // G13: near 29,362 m e far 122,609 m à frente da aeronave.
    expect(Math.min(...us)).toBeCloseTo(29.362, 2);
    expect(Math.max(...us)).toBeCloseTo(122.609, 2);
  });
});

describe('isShotValid e buildCoverage', () => {
  const rgb = { sensorKind: 'RGB' as const, specularWater: false };

  it('fotos borradas e de névoa (RGB) não contam', () => {
    expect(isShotValid(shot(), rgb)).toBe(true);
    expect(isShotValid(shot({ blurred: true }), rgb)).toBe(false);
    expect(isShotValid(shot({ inFog: true }), rgb)).toBe(false);
    expect(isShotValid(shot({ inFog: true }), { ...rgb, sensorKind: 'THERMAL' })).toBe(true);
  });

  it('reflexo especular só invalida sobre a água, com SPECULAR_WATER e sol a pino', () => {
    const wet = shot({ overWater: true });
    expect(isShotValid(wet, rgb)).toBe(true);
    expect(isShotValid(wet, { ...rgb, specularWater: true })).toBe(false);
    expect(isShotValid({ ...wet, lighting: 'OVERCAST' }, { ...rgb, specularWater: true })).toBe(
      true,
    );
  });

  it('buildCoverage acumula só as fotos válidas', () => {
    const shots = [shot(), shot({ blurred: true }), shot({ inFog: true })];
    const result = buildCoverage(shots, AOI, {
      aircraftKind: 'MULTIROTOR',
      sensor: FF,
      focalM: 0.035,
      rules: rgb,
      excludedCells: [],
    });
    expect(Math.max(...result.counts)).toBe(1);
    expect(result.cols).toBe(64);
  });
});
