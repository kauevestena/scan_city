import { getVehicle } from '@/data/catalog';
import { C02 } from '@/data/contracts';
import { snapToAccessible } from '@/domain/accessibility';
import { createCoverageGrid } from '@/domain/coverage';
import { mulberry32 } from '@/lib/rng';
import { generateProduct, NDVI_BINS, NDVI_MID } from '@/engines/raster/products';
import type { WorldObject } from '@/types';
import { clearTerrainCache, createTerrain } from '../createTerrain';
import { BIOMES } from './index';
import {
  AGRI_PLATEAU,
  CLOGGED,
  cloggedWeight,
  CUTS_U,
  CUTS_V,
  fieldVigor,
  MAIN_ROAD_V,
  MAIN_ROAD_WIDTH_M,
  PIVOTS,
  RELIEF_M,
  ROAD_WIDTH_M,
  SILOS,
  YARD,
} from './agriPlateau';

const terrain = createTerrain(C02);
const { lengthM, widthM } = C02.aoi;
const of = (kind: WorldObject['kind']) => terrain.objects.filter((o) => o.kind === kind);
const crop = (f: (u: number, v: number) => void) => {
  for (let u = 0; u <= lengthM; u += 6) {
    for (let v = 0; v <= widthM; v += 6) if (terrain.landCover(u, v) === 'CROP') f(u, v);
  }
};

describe('createTerrain — AGRI_PLATEAU (C02)', () => {
  it('a receita está registrada e é a do contrato', () => {
    expect(BIOMES.AGRI_PLATEAU).toBe(AGRI_PLATEAU);
    expect(terrain.biome).toBe('AGRI_PLATEAU');
    expect(terrain.aoi).toEqual({ widthM: 600, lengthM: 1500 });
  });

  it('determinismo: mesma seed → mesmas amostras, objetos e NDVI', () => {
    clearTerrainCache();
    const again = createTerrain(C02);
    expect(again).not.toBe(terrain);
    expect(again.objects).toEqual(terrain.objects);
    const rng = mulberry32(5);
    for (let i = 0; i < 1000; i++) {
      const u = rng.range(-290, 1790);
      const v = rng.range(-110, 710);
      expect(again.elevation(u, v)).toBe(terrain.elevation(u, v));
      expect(again.landCover(u, v)).toBe(terrain.landCover(u, v));
      expect(again.ndvi(u, v)).toBe(terrain.ndvi(u, v));
    }
  });

  it('relevo suave de até 30 m', () => {
    let min = Infinity;
    let max = -Infinity;
    let slope = 0;
    for (let u = 0; u <= lengthM; u += 10) {
      for (let v = 0; v <= widthM; v += 10) {
        const e = terrain.elevation(u, v);
        min = Math.min(min, e);
        max = Math.max(max, e);
        slope = Math.max(slope, terrain.slopePct(u, v));
      }
    }
    expect(min).toBeGreaterThanOrEqual(0);
    expect(max).toBeLessThanOrEqual(RELIEF_M);
    expect(max - min).toBeGreaterThan(20);
    expect(slope).toBeLessThan(20);
    expect(C02.terrainReliefM).toBe(RELIEF_M);
  });

  it('talhões de 190 a 270 m separados por estradas internas de 6 m (a principal, de 9 m)', () => {
    for (const cuts of [CUTS_U, CUTS_V]) {
      for (let k = 1; k < cuts.length; k++) {
        const gap = (cuts[k] as number) - (cuts[k - 1] as number);
        expect(gap).toBeGreaterThanOrEqual(150);
        expect(gap).toBeLessThanOrEqual(300);
      }
    }
    expect(CUTS_U[0]).toBeLessThanOrEqual(terrain.bounds.uMin);
    expect(CUTS_U.at(-1)).toBeGreaterThanOrEqual(terrain.bounds.uMax);
    expect(CUTS_V[0]).toBeLessThanOrEqual(terrain.bounds.vMin);
    expect(CUTS_V.at(-1)).toBeGreaterThanOrEqual(terrain.bounds.vMax);
    expect(terrain.roads).toHaveLength(CUTS_U.length + CUTS_V.length);
    expect(terrain.roads.every((r) => r.kind === 'ROAD')).toBe(true);
    expect(terrain.roads.filter((r) => r.widthM === MAIN_ROAD_WIDTH_M)).toHaveLength(1);
    expect(terrain.roads.filter((r) => r.widthM === ROAD_WIDTH_M)).toHaveLength(
      CUTS_U.length + CUTS_V.length - 1,
    );
    expect(CUTS_V).toContain(MAIN_ROAD_V);
    expect(terrain.landCover(390, 200)).toBe('ROAD');
    expect(terrain.landCover(700, MAIN_ROAD_V)).toBe('ROAD');
    expect(terrain.landCover(700, 200)).toBe('CROP');
  });

  it('cobertura: cultivo por todo lado, pousio só nos cantos dos pivôs e pátio de terra na sede', () => {
    const cover: Record<string, number> = {};
    for (let u = 0; u <= lengthM; u += 10) {
      for (let v = 0; v <= widthM; v += 10) {
        const c = terrain.landCover(u, v);
        cover[c] = (cover[c] ?? 0) + 1;
        if (c === 'GRASS') {
          // O pousio fica fora do círculo de algum pivô.
          const outside = PIVOTS.some((p) => Math.hypot(u - p.u, v - p.v) > p.radiusM);
          expect(outside, `(${u}, ${v})`).toBe(true);
        }
      }
    }
    const total = Object.values(cover).reduce((a, b) => a + b, 0);
    expect((cover.CROP ?? 0) / total).toBeGreaterThan(0.75);
    expect(Object.keys(cover).sort()).toEqual(['CROP', 'GRASS', 'ROAD', 'ROOF', 'URBAN']);
    for (const p of PIVOTS) {
      expect(terrain.landCover(p.u, p.v)).toBe('CROP');
      expect(terrain.landCover(p.u + p.radiusM - 3, p.v)).toBe('CROP');
      expect(terrain.canopy(p.u, p.v)).toBe(0);
    }
    expect(terrain.landCover((YARD.uMin + YARD.uMax) / 2, YARD.vMin + 5)).toBe('URBAN');
  });

  it('NDVI: vigor de 0,55 a 0,85 por talhão, menos manchas de estresse de até −0,4', () => {
    for (let k = 0; k + 1 < CUTS_U.length; k++) {
      for (let j = 0; j + 1 < CUTS_V.length; j++) {
        expect(fieldVigor(k, j)).toBeGreaterThanOrEqual(0.55);
        expect(fieldVigor(k, j)).toBeLessThanOrEqual(0.85);
      }
    }
    let total = 0;
    let stressed = 0;
    let severe = 0;
    let lo = Infinity;
    let hi = -Infinity;
    crop((u, v) => {
      const nd = terrain.ndvi(u, v);
      total++;
      lo = Math.min(lo, nd);
      hi = Math.max(hi, nd);
      if (nd < 0.45) stressed++;
      if (nd < 0.3) severe++;
    });
    expect(hi).toBeLessThanOrEqual(0.85 + 1e-9);
    expect(lo).toBeGreaterThanOrEqual(-0.2);
    // Manchas visíveis: de uma décima parte a um terço do cultivo está abaixo de 0,45.
    expect(stressed / total).toBeGreaterThan(0.1);
    expect(stressed / total).toBeLessThan(0.35);
    expect(severe / total).toBeGreaterThan(0.03);
    // Fora do cultivo o NDVI é baixo.
    expect(terrain.ndvi(390, 200)).toBeLessThan(0.15);
  });

  it('pivô 3 entupido: o setor de 30° a 80° fica bem abaixo do resto do círculo', () => {
    const p = PIVOTS[CLOGGED.pivot];
    if (!p) throw new Error('sem pivô 3');
    expect(cloggedWeight(p.u + 200, p.v)).toBe(0); // fora do círculo
    expect(cloggedWeight(p.u + 60, p.v - 60)).toBe(0); // fora do setor
    let wedge = 0;
    let wedgeN = 0;
    let rest = 0;
    let restN = 0;
    for (let u = p.u - p.radiusM; u <= p.u + p.radiusM; u += 4) {
      for (let v = p.v - p.radiusM; v <= p.v + p.radiusM; v += 4) {
        if (Math.hypot(u - p.u, v - p.v) > p.radiusM) continue;
        const w = cloggedWeight(u, v);
        if (w > 0.95) {
          wedge += terrain.ndvi(u, v);
          wedgeN++;
        } else if (w === 0) {
          rest += terrain.ndvi(u, v);
          restN++;
        }
      }
    }
    expect(wedgeN).toBeGreaterThan(100);
    expect(rest / restN - wedge / wedgeN).toBeGreaterThan(0.2);
    // O setor "amarelo": NDVI entre o vermelho e o verde da rampa do produto.
    expect(wedge / wedgeN).toBeLessThan(NDVI_MID + 0.1);
  });

  it('o produto NDVI mostra as manchas: faixas baixas do histograma cheias, ramp vermelho-amarelo', () => {
    const cells = createCoverageGrid(C02.aoi);
    const r = generateProduct('NDVI', {
      terrain,
      coverage: {
        cols: cells.cols,
        rows: cells.rows,
        counts: cells.counts.map(() => 6),
        excludedCells: [],
      },
      lighting: 'SUN_HIGH',
      rmseZM: 0.1,
      seed: 9,
    });
    const bins = r.histogram as number[];
    expect(bins).toHaveLength(NDVI_BINS);
    const total = bins.reduce((a, b) => a + b, 0);
    // Faixas abaixo do NDVI médio (0,3): estresse forte, estradas e pousio.
    const lowBins = Math.floor(((NDVI_MID - -0.2) / (0.9 - -0.2)) * NDVI_BINS);
    const low = bins.slice(0, lowBins).reduce((a, b) => a + b, 0);
    expect(low / total).toBeGreaterThan(0.05);
    // Há pixels vermelhos/amarelos (R alto, B baixo) e verdes no raster.
    let warm = 0;
    let green = 0;
    for (let k = 0; k < r.rgba.length; k += 4) {
      const [R, G, B] = [r.rgba[k] as number, r.rgba[k + 1] as number, r.rgba[k + 2] as number];
      if (R > 200 && B < 80) warm++;
      if (G > R && G > B) green++;
    }
    expect(warm / (r.width * r.height)).toBeGreaterThan(0.04);
    expect(green / (r.width * r.height)).toBeGreaterThan(0.3);
  });

  it('3 pivôs de braço radial de 8 postes não sólidos e a sede com 4 silos, 2 galpões e a casa', () => {
    const poles = of('POLE');
    expect(poles).toHaveLength(PIVOTS.length * 9);
    expect(poles.every((p) => !p.solid)).toBe(true);
    for (const p of PIVOTS) {
      const arm = poles.filter((o) => Math.hypot(o.u - p.u, o.v - p.v) <= p.radiusM + 1e-6);
      expect(arm.length).toBeGreaterThanOrEqual(9);
      // O último poste do braço fica na borda do círculo, no ângulo do braço.
      const tip = arm.reduce((a, b) =>
        Math.hypot(b.u - p.u, b.v - p.v) > Math.hypot(a.u - p.u, a.v - p.v) ? b : a,
      );
      expect(Math.hypot(tip.u - p.u, tip.v - p.v)).toBeCloseTo(p.radiusM, 6);
      expect(Math.atan2(tip.v - p.v, tip.u - p.u)).toBeCloseTo((p.armDeg * Math.PI) / 180, 6);
    }
    const silos = of('PIPE');
    expect(silos).toHaveLength(SILOS.length);
    for (const s of silos) {
      expect(s.solid).toBe(true);
      expect(s.heightM).toBeGreaterThanOrEqual(16);
      expect(s.heightM).toBeLessThanOrEqual(22);
      expect(s.u).toBeGreaterThan(YARD.uMin);
      expect(s.u).toBeLessThan(YARD.uMax);
      expect(s.v).toBeGreaterThan(YARD.vMin);
      expect(s.v).toBeLessThan(YARD.vMax);
    }
    const buildings = of('BUILDING');
    expect(buildings).toHaveLength(3);
    expect(terrain.landCover(buildings[0]?.u as number, buildings[0]?.v as number)).toBe('ROOF');
  });

  it('os pontos de referência encaixam num ponto acessível de quem vai a campo', () => {
    const vehicles = [getVehicle(C02.minVehicle), getVehicle(C02.recommended.vehicle)];
    const ref = C02.referencePlan;
    for (const p of [...ref.gcps, ...ref.cps]) {
      expect(snapToAccessible(p, terrain, vehicles, { paintMarkers: false }, 30)).not.toBeNull();
    }
  });

  it('a AOI grande cria o terreno em poucas centenas de ms; elevation custa < 2 µs', () => {
    clearTerrainCache();
    const t0 = performance.now();
    const fresh = createTerrain(C02);
    expect(performance.now() - t0).toBeLessThan(1500);
    const start = performance.now();
    let acc = 0;
    for (let i = 0; i < 100_000; i++) acc += fresh.elevation(i % 1500, (i * 7) % 600);
    expect(acc).toBeGreaterThan(0);
    expect(performance.now() - start).toBeLessThan(200);
  });
});
