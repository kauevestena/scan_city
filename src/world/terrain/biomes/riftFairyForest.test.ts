import { CATALOG, getVehicle } from '@/data/catalog';
import { R04 } from '@/data/contracts/rifts';
import { isAccessible, MAX_GCP_CANOPY } from '@/domain/accessibility';
import { createCoverageGrid } from '@/domain/coverage';
import { buildFlightPlan } from '@/domain/flightPlanner';
import { referenceParams } from '@/domain/referencePlan';
import { resolveRuleEffects, RULE_PARAMS } from '@/domain/specialRules';
import { meanAoiElevation } from '@/engines/flight/FlightEngine';
import { generateProduct } from '@/engines/raster/products';
import type { LandCover } from '@/types';
import { clearTerrainCache, createTerrain } from '../createTerrain';
import { createNoiseKit, type NoiseKit } from '../noise';
import { BIOMES } from './index';
import {
  CAP,
  CLEARING_RAMP_M,
  CLEARINGS,
  clearingAt,
  FOREST_CANOPY,
  MUSHROOMS_PER_CLEARING,
  RELIEF_M,
  RIFT_FAIRY_FOREST,
  STALK,
  TEMPLE_AT,
  TEMPLE_FEATURE,
  TEMPLE_HEIGHT_M,
  TEMPLE_RADIUS_M,
  TRAIL_MUSHROOMS,
  TRAIL_WIDTH_M,
  TREE_CROWN_M,
  TREE_HEIGHT_M,
  templeWeight,
} from './riftFairyForest';

const terrain = createTerrain(R04);
const { lengthM, widthM } = R04.aoi;
const trees = terrain.objects.filter((o) => o.kind === 'TREE');
const pipes = terrain.objects.filter((o) => o.kind === 'PIPE');
const ground = (u: number, v: number) => terrain.elevation(u, v);

/** Ruído zerado: sem o relevo sobra só o platô do templo (a 0 m em volta). */
const flat = { ...createNoiseKit(R04.seed), fbm: () => 0 } as NoiseKit;
const bare = (u: number, v: number) => RIFT_FAIRY_FOREST.baseElevation(u, v, flat);

function survey(step = 4) {
  let lo = Infinity;
  let hi = -Infinity;
  const covers: Partial<Record<LandCover, number>> = {};
  const canopies: number[] = [];
  let n = 0;
  for (let u = 0; u <= lengthM; u += step) {
    for (let v = 0; v <= widthM; v += step) {
      const e = ground(u, v);
      lo = Math.min(lo, e);
      hi = Math.max(hi, e);
      const c = terrain.landCover(u, v);
      covers[c] = (covers[c] ?? 0) + 1;
      canopies.push(terrain.canopy(u, v));
      n++;
    }
  }
  canopies.sort((a, b) => a - b);
  return { lo, hi, covers, canopies, n };
}
const stats = survey();

describe('createTerrain — RIFT_FAIRY_FOREST (R04)', () => {
  it('a receita está registrada e é a do contrato', () => {
    expect(BIOMES.RIFT_FAIRY_FOREST).toBe(RIFT_FAIRY_FOREST);
    expect(terrain.biome).toBe('RIFT_FAIRY_FOREST');
    expect(terrain.aoi).toEqual({ widthM: 400, lengthM: 600 });
  });

  it('determinismo: mesma seed → mesmas árvores, cogumelos e amostras de cota, cobertura e dossel', () => {
    clearTerrainCache();
    const again = createTerrain(R04);
    expect(again).not.toBe(terrain);
    expect(again.objects).toEqual(terrain.objects);
    expect(again.roads).toEqual(terrain.roads);
    expect(again.features).toEqual(terrain.features);
    for (let u = -80; u <= 680; u += 41) {
      for (let v = -60; v <= 460; v += 37) {
        expect(again.elevation(u, v)).toBe(terrain.elevation(u, v));
        expect(again.landCover(u, v)).toBe(terrain.landCover(u, v));
        expect(again.canopy(u, v)).toBe(terrain.canopy(u, v));
      }
    }
  });

  it('relevo de 0 a 30 m, com o platô do templo por cima', () => {
    expect(RELIEF_M).toBe(R04.terrainReliefM);
    expect(stats.lo).toBeGreaterThanOrEqual(0);
    expect(stats.hi).toBeLessThanOrEqual(RELIEF_M + TEMPLE_HEIGHT_M);
    expect(stats.hi - stats.lo).toBeGreaterThan(RELIEF_M * 0.8);
  });

  it('o templo soterrado: platô de +3 m, r = 30 m em (300, 200), com 6 m de rampa; só o chão o tem', () => {
    expect([TEMPLE_AT.u, TEMPLE_AT.v, TEMPLE_RADIUS_M, TEMPLE_HEIGHT_M]).toEqual([300, 200, 30, 3]);
    // Com o ruído zerado o terreno é plano (15 m) e sobra só o platô: +3 m até r − 6, rampa até r, nada fora.
    const base = bare(TEMPLE_AT.u + 200, TEMPLE_AT.v);
    expect(base).toBeCloseTo(RELIEF_M / 2, 9);
    for (let a = 0; a < 2 * Math.PI; a += Math.PI / 6) {
      const at = (d: number) =>
        bare(TEMPLE_AT.u + d * Math.cos(a), TEMPLE_AT.v + d * Math.sin(a)) - base;
      expect(at(0)).toBeCloseTo(TEMPLE_HEIGHT_M, 9);
      expect(at(TEMPLE_RADIUS_M - 6)).toBeCloseTo(TEMPLE_HEIGHT_M, 9);
      expect(at(TEMPLE_RADIUS_M - 3)).toBeGreaterThan(0.5);
      expect(at(TEMPLE_RADIUS_M - 3)).toBeLessThan(TEMPLE_HEIGHT_M - 0.5);
      expect(at(TEMPLE_RADIUS_M)).toBeCloseTo(0, 9);
      expect(at(TEMPLE_RADIUS_M + 0.5)).toBe(0);
    }
    expect(templeWeight(TEMPLE_AT.u, TEMPLE_AT.v)).toBe(1);
    expect(templeWeight(TEMPLE_AT.u + TEMPLE_RADIUS_M, TEMPLE_AT.v)).toBe(0);
    expect(templeWeight(TEMPLE_AT.u + 100, TEMPLE_AT.v)).toBe(0);
    // O alvo `TEMPLE` cobre o platô e pede LiDAR.
    expect(terrain.features).toEqual([TEMPLE_FEATURE]);
    expect(TEMPLE_FEATURE).toMatchObject({
      id: 'TEMPLE',
      u: 300,
      v: 200,
      radiusM: 30,
      needs: 'LIDAR',
    });
    expect(TEMPLE_FEATURE.sensorKind).toBeUndefined();
  });

  it('sob a floresta o platô só aparece no MDT: o MDS tem cópias de 30–50 m que escondem 3 m; sem LiDAR o MDT fica sem dados', () => {
    // Dispersão da copa sobre o chão no disco do templo (o que o MDS soma ao solo) contra os 3 m do platô.
    const scatter: number[] = [];
    for (let u = TEMPLE_AT.u - 28; u <= TEMPLE_AT.u + 28; u += 4) {
      for (let v = TEMPLE_AT.v - 28; v <= TEMPLE_AT.v + 28; v += 4) {
        if (Math.hypot(u - TEMPLE_AT.u, v - TEMPLE_AT.v) > 28) continue;
        scatter.push(terrain.surface(u, v) - ground(u, v));
      }
    }
    const mean = scatter.reduce((s, x) => s + x, 0) / scatter.length;
    const std = Math.sqrt(scatter.reduce((s, x) => s + (x - mean) ** 2, 0) / scatter.length);
    expect(std).toBeGreaterThan(TEMPLE_HEIGHT_M * 2);
    expect(mean).toBeGreaterThan(TREE_HEIGHT_M[0] * 0.5);
    // O MDT dos retornos de solo é liso: nada daquela dispersão.
    const grid = createCoverageGrid(R04.aoi);
    const inputs = (over: object = {}) => ({
      terrain,
      coverage: {
        cols: grid.cols,
        rows: grid.rows,
        counts: grid.counts.map(() => 6),
        excludedCells: [],
      },
      lighting: 'MAGIC_FOG' as const,
      rmseZM: 0.1,
      seed: 7,
      ...over,
    });
    const hatchedInDisc = (raster: { hatched: Uint8Array; width: number }) => {
      const du = lengthM / raster.width;
      const dv = widthM / raster.width;
      let inside = 0;
      let hatched = 0;
      for (let j = 0; j < raster.width; j++) {
        for (let i = 0; i < raster.width; i++) {
          const u = (i + 0.5) * du;
          const v = (j + 0.5) * dv;
          if (Math.hypot(u - TEMPLE_AT.u, v - TEMPLE_AT.v) > TEMPLE_RADIUS_M) continue;
          inside++;
          hatched += raster.hatched[j * raster.width + i] as number;
        }
      }
      return hatched / inside;
    };
    const withLidar = generateProduct(
      'DTM',
      inputs({ lidarGroundDensity: grid.counts.map(() => 50) }),
    );
    const without = generateProduct('DTM', inputs());
    expect(hatchedInDisc(withLidar)).toBe(0);
    expect(hatchedInDisc(without)).toBeGreaterThan(0.95);
  });
});

describe('RIFT_FAIRY_FOREST: floresta, clareiras e trilhas', () => {
  it('floresta de dossel 0,95 em ~96 % da AOI; só as 5 clareiras (dossel 0) abrem a mata', () => {
    const share = (c: LandCover) => (stats.covers[c] ?? 0) / stats.n;
    expect(Object.keys(stats.covers).sort()).toEqual(['FOREST', 'GRASS']);
    expect(share('FOREST')).toBeGreaterThan(0.93);
    expect(FOREST_CANOPY).toBe(0.95);
    const dense = RULE_PARAMS.denseCanopy;
    // A mata fica entre 0,94 e 0,96; as clareiras, sem nenhuma copa por cima, em 0.
    for (let u = 0; u <= lengthM; u += 4) {
      for (let v = 0; v <= widthM; v += 4) {
        const c = terrain.canopy(u, v);
        if (terrain.landCover(u, v) === 'FOREST') {
          expect(c).toBeGreaterThanOrEqual(dense.minCanopy);
          expect(c).toBeLessThanOrEqual(dense.maxCanopy);
        } else {
          expect(c).toBe(0);
        }
      }
    }
    expect(stats.canopies[stats.canopies.length >> 1]).toBeCloseTo(0.95, 2);
    // DENSE_CANOPY: clareiras circulares de 20 a 35 m de raio, sem dossel.
    expect(CLEARINGS).toHaveLength(5);
    for (const c of CLEARINGS) {
      expect(c.r).toBeGreaterThanOrEqual(dense.clearingRadiusM[0]);
      expect(c.r).toBeLessThanOrEqual(dense.clearingRadiusM[1]);
      expect(terrain.landCover(c.u, c.v)).toBe('GRASS');
      expect(terrain.canopy(c.u, c.v)).toBe(0);
      expect(clearingAt(c.u + c.r * 0.9, c.v)).toBe(c);
      expect(clearingAt(c.u + c.r * 1.1, c.v)).toBeUndefined();
      expect(c.u - c.r).toBeGreaterThan(0);
      expect(c.u + c.r).toBeLessThan(lengthM);
      expect(c.v - c.r).toBeGreaterThan(0);
      expect(c.v + c.r).toBeLessThan(widthM);
    }
    expect(resolveRuleEffects(R04.specialRules).terrain.denseCanopy).toEqual(dense);
  });

  it('um GCP só vale nas clareiras (dossel > 0,6 invalida o ponto); a pé se chega a todas', () => {
    const foot = getVehicle('FOOT_BIKE');
    const rules = { paintMarkers: false };
    expect(terrain.guaranteedAccessible).toEqual(CLEARINGS.map((c) => ({ u: c.u, v: c.v })));
    for (const c of CLEARINGS) {
      expect(isAccessible(c.u, c.v, terrain, [foot], rules)).toEqual({ ok: true });
      // A clareira é um disco plano (a mesma cota em todo o raio) e termina numa rampa de 12 m.
      const e0 = ground(c.u, c.v);
      for (let a = 0; a < 2 * Math.PI; a += Math.PI / 4) {
        for (const f of [0.3, 0.7, 0.99]) {
          expect(ground(c.u + f * c.r * Math.cos(a), c.v + f * c.r * Math.sin(a))).toBeCloseTo(
            e0,
            9,
          );
        }
      }
      expect(terrain.slopePct(c.u, c.v)).toBeLessThan(1);
      // A rampa de fora não passa de ~70° de declive (a cota muda suave entre r e r + 12 m).
      for (let a = 0; a < 2 * Math.PI; a += Math.PI / 4) {
        const at = (d: number) => ground(c.u + d * Math.cos(a), c.v + d * Math.sin(a));
        for (let d = c.r; d < c.r + CLEARING_RAMP_M; d += 1) {
          expect(Math.abs(at(d + 1) - at(d))).toBeLessThan(2.75);
        }
      }
    }
    const inForest = isAccessible(300, 200, terrain, [foot], rules);
    expect(inForest).toEqual({ ok: false, reason: 'CANOPY' });
    expect(terrain.canopy(300, 200)).toBeGreaterThan(MAX_GCP_CANOPY);
  });

  it('4 trilhas de terra de 3 m ligam as clareiras: toda a AOI fica a ≤ 150 m de uma', () => {
    expect(terrain.roads).toHaveLength(4);
    expect(terrain.roads.every((r) => r.kind === 'TRAIL' && r.widthM === TRAIL_WIDTH_M)).toBe(true);
    for (const c of CLEARINGS) expect(terrain.distanceToTrack(c.u, c.v)).toBeLessThan(35);
    let far = 0;
    for (let u = 0; u <= lengthM; u += 10) {
      for (let v = 0; v <= widthM; v += 10) far = Math.max(far, terrain.distanceToTrack(u, v));
    }
    expect(far).toBeLessThan(getVehicle('FOOT_BIKE').gcpReachM);
  });
});

describe('RIFT_FAIRY_FOREST: árvores gigantes, cogumelos e névoa', () => {
  it('~1.700 árvores gigantes de 30 a 50 m e copa de 14 a 20 m, longe das clareiras e das trilhas', () => {
    expect(trees.length).toBeGreaterThan(1500);
    expect(trees.length).toBeLessThan(1900);
    for (const t of trees) {
      expect(t.heightM).toBeGreaterThanOrEqual(TREE_HEIGHT_M[0]);
      expect(t.heightM).toBeLessThanOrEqual(TREE_HEIGHT_M[1]);
      expect(t.widthM).toBeGreaterThanOrEqual(TREE_CROWN_M[0]);
      expect(t.widthM).toBeLessThanOrEqual(TREE_CROWN_M[1]);
      expect(t.solid).toBe(true);
      expect(clearingAt(t.u, t.v)).toBeUndefined();
      expect(terrain.distanceToTrack(t.u, t.v)).toBeGreaterThan(TRAIL_WIDTH_M / 2);
    }
  });

  it('o plano de referência (H = 80 m, sem TF) passa por cima das copas: ≥ 10 m acima da mais alta', () => {
    const planAlt = meanAoiElevation(terrain) + R04.referencePlan.heightM;
    let highest = -Infinity;
    for (const t of trees) highest = Math.max(highest, ground(t.u, t.v) + t.heightM);
    expect(planAlt - highest).toBeGreaterThan(10);
    expect(buildFlightPlan(referenceParams(R04), R04, CATALOG).stats.nLines).toBe(9);
  });

  it('cerca de 60 cogumelos luminosos (caule e chapéu), de cor viva e sem colisão, só nas clareiras e à beira das trilhas', () => {
    const mushrooms = pipes.length / 2;
    // 6 por clareira (30) e até 30 à beira das trilhas (os sorteados dentro de uma clareira não entram).
    expect(mushrooms).toBeGreaterThanOrEqual(CLEARINGS.length * MUSHROOMS_PER_CLEARING);
    expect(mushrooms).toBeLessThanOrEqual(
      CLEARINGS.length * MUSHROOMS_PER_CLEARING + TRAIL_MUSHROOMS,
    );
    expect(pipes.length % 2).toBe(0);
    const stalks = pipes.filter((p) => p.widthM === STALK.widthM);
    const caps = pipes.filter((p) => p.widthM === CAP.widthM);
    expect(stalks).toHaveLength(caps.length);
    for (const p of pipes) expect(p.solid).toBe(false);
    for (const s of stalks) expect(s.heightM).toBe(STALK.heightM);
    for (const c of caps) {
      expect(c.heightM).toBe(CAP.heightM);
      expect(c.baseM).toBe(STALK.heightM);
      // Cada chapéu está sobre o seu caule.
      expect(stalks.some((s) => s.u === c.u && s.v === c.v)).toBe(true);
      // Cor viva: um canal passa de 200.
      expect(Math.max(...c.color)).toBeGreaterThan(200);
      // Na clareira ou a ≤ 8 m de uma trilha.
      expect(clearingAt(c.u, c.v) !== undefined || terrain.distanceToTrack(c.u, c.v) <= 8).toBe(
        true,
      );
    }
  });

  it('a zona FOG de densidade 0,9 cobre o bosque', () => {
    expect(terrain.zones).toEqual([{ kind: 'FOG', density: 0.9 }]);
    expect(resolveRuleEffects(R04.specialRules).coverage.fog).toBe(true);
    expect(resolveRuleEffects(R04.specialRules).flight.visibilityM).toBe(
      RULE_PARAMS.magicFog.visibilityM,
    );
  });
});

describe('RIFT_FAIRY_FOREST: custo', () => {
  it('criação em poucas centenas de ms e a cota custa poucos µs por chamada', () => {
    clearTerrainCache();
    const t0 = performance.now();
    const fresh = createTerrain(R04);
    expect(performance.now() - t0).toBeLessThan(2500);
    const start = performance.now();
    let acc = 0;
    for (let i = 0; i < 100_000; i++) acc += fresh.elevation(i % 600, (i * 7) % 400);
    expect(acc).toBeGreaterThan(0);
    expect(performance.now() - start).toBeLessThan(600);
  });
});
