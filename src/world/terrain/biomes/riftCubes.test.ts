import { getVehicle } from '@/data/catalog';
import { R05 } from '@/data/contracts/rifts';
import { isAccessible } from '@/domain/accessibility';
import { resolveRuleEffects, RULE_PARAMS } from '@/domain/specialRules';
import { meanAoiElevation } from '@/engines/flight/FlightEngine';
import type { LandCover, WorldObject } from '@/types';
import { clearTerrainCache, createTerrain } from '../createTerrain';
import { lavaThermalZones } from '../ruleGenerators';
import { BIOMES } from './index';
import {
  BLOCK_COUNT,
  BLOCK_M,
  CELL_M,
  CROWN,
  GCP_PADS,
  LAVA_BELOW_M,
  PAD_RADIUS_M,
  RELIEF_M,
  RIFT_CUBES,
  STACKED_BLOCKS,
  STEP_M,
  TRAIL_WIDTH_M,
  TREE_COUNT,
  TRUNK,
  trailV,
} from './riftCubes';

const terrain = createTerrain(R05);
const { lengthM, widthM } = R05.aoi;
const cubes = terrain.objects.filter((o) => o.kind === 'CUBE_BLOCK');
const blocks = cubes.filter((o) => o.widthM === BLOCK_M);
const trunks = cubes.filter((o) => o.widthM === TRUNK.widthM);
const crowns = cubes.filter((o) => o.widthM === CROWN.widthM);
const ground = (u: number, v: number) => terrain.elevation(u, v);

/** Declive "de talude" (graus): diferença central numa linha de base de 12 m (três colunas). */
function macroSlopeDeg(u: number, v: number): number {
  const gx = (ground(u + 6, v) - ground(u - 6, v)) / 12;
  const gy = (ground(u, v + 6) - ground(u, v - 6)) / 12;
  return (Math.atan(Math.hypot(gx, gy)) * 180) / Math.PI;
}

function survey(step = 2) {
  let lo = Infinity;
  let hi = -Infinity;
  const levels = new Set<number>();
  const covers: Partial<Record<LandCover, number>> = {};
  let n = 0;
  for (let u = 0; u <= lengthM; u += step) {
    for (let v = 0; v <= widthM; v += step) {
      const e = ground(u, v);
      lo = Math.min(lo, e);
      hi = Math.max(hi, e);
      levels.add(e);
      const c = terrain.landCover(u, v);
      covers[c] = (covers[c] ?? 0) + 1;
      n++;
    }
  }
  let maxSlope = 0;
  for (let u = 6; u <= lengthM - 6; u += 3) {
    for (let v = 6; v <= widthM - 6; v += 3) maxSlope = Math.max(maxSlope, macroSlopeDeg(u, v));
  }
  return { lo, hi, levels, covers, n, maxSlope };
}
const stats = survey();

/** Pontos de lava dentro da AOI, uma amostra por coluna de 4 m. */
const lavaCells = (() => {
  const cells: { u: number; v: number }[] = [];
  for (let u = CELL_M / 2; u < lengthM; u += CELL_M) {
    for (let v = CELL_M / 2; v < widthM; v += CELL_M)
      if (ground(u, v) < LAVA_BELOW_M) cells.push({ u, v });
  }
  return cells;
})();

describe('createTerrain — RIFT_CUBES (R05)', () => {
  it('a receita está registrada e é a do contrato', () => {
    expect(BIOMES.RIFT_CUBES).toBe(RIFT_CUBES);
    expect(terrain.biome).toBe('RIFT_CUBES');
    expect(terrain.aoi).toEqual({ widthM: 240, lengthM: 320 });
  });

  it('determinismo: mesma seed → mesmos objetos, zonas e amostras de cota e cobertura', () => {
    clearTerrainCache();
    const again = createTerrain(R05);
    expect(again).not.toBe(terrain);
    expect(again.objects).toEqual(terrain.objects);
    expect(again.zones).toEqual(terrain.zones);
    expect(again.roads).toEqual(terrain.roads);
    for (let u = -60; u <= 380; u += 31) {
      for (let v = -40; v <= 280; v += 23) {
        expect(again.elevation(u, v)).toBe(terrain.elevation(u, v));
        expect(again.landCover(u, v)).toBe(terrain.landCover(u, v));
      }
    }
  });

  it('terreno quantizado: toda cota é múltipla de 4 m (`floor(h/4)·4`), de 0 a 80 m', () => {
    expect(RELIEF_M).toBe(R05.terrainReliefM);
    expect(STEP_M).toBe(4);
    expect([...stats.levels].every((e) => e % STEP_M === 0)).toBe(true);
    expect(stats.lo).toBe(0);
    expect(stats.hi).toBe(RELIEF_M);
    // Os 21 degraus possíveis (0, 4, …, 80) aparecem quase todos.
    expect(stats.levels.size).toBeGreaterThanOrEqual(18);
    // Fora da AOI (a margem de 20 %) também.
    for (let u = -60; u <= 380; u += 7) {
      for (let v = -40; v <= 280; v += 7) expect(ground(u, v) % STEP_M).toBe(0);
    }
  });

  it('cada coluna de 4 × 4 m é plana: a cota só muda na fronteira, e os vizinhos diferem em múltiplos de 4 m', () => {
    for (let i = 0; i < lengthM / CELL_M; i += 3) {
      for (let j = 0; j < widthM / CELL_M; j += 3) {
        const h = ground((i + 0.5) * CELL_M, (j + 0.5) * CELL_M);
        for (const [du, dv] of [
          [0.05, 0.05],
          [3.95, 0.05],
          [0.05, 3.95],
          [3.95, 3.95],
          [2, 2],
        ] as const) {
          expect(ground(i * CELL_M + du, j * CELL_M + dv), `coluna ${i},${j}`).toBe(h);
        }
        const east = ground((i + 1.5) * CELL_M, (j + 0.5) * CELL_M);
        expect(Math.abs(east - h) % STEP_M).toBe(0);
      }
    }
  });

  it('STEEP_RELIEF: alívio de 80 m e taludes de 35° a 70° (12 m de base)', () => {
    const effects = resolveRuleEffects(R05.specialRules);
    expect(effects.terrain.steepRelief).toMatchObject({ minReliefM: 60, slopeDeg: [35, 70] });
    expect(stats.hi - stats.lo).toBeGreaterThanOrEqual(
      effects.terrain.steepRelief?.minReliefM ?? 0,
    );
    expect(stats.maxSlope).toBeGreaterThanOrEqual(35);
    expect(stats.maxSlope).toBeLessThanOrEqual(70);
  });

  it('em altitude constante o AGL varia 80 m ou mais: o plano pede Terrain Following', () => {
    const alt = meanAoiElevation(terrain) + R05.referencePlan.heightM;
    expect(alt - stats.hi).toBeLessThan(R05.referencePlan.heightM);
    expect(alt - stats.lo).toBeGreaterThan(R05.referencePlan.heightM);
    expect(stats.hi - stats.lo).toBeGreaterThanOrEqual(80);
  });
});

describe('RIFT_CUBES: lava e térmicas', () => {
  it('a lava enche as baixadas (abaixo de 8 m, ~12 % da AOI) e só elas', () => {
    const share = (stats.covers.LAVA ?? 0) / stats.n;
    expect(share).toBeGreaterThan(0.08);
    expect(share).toBeLessThan(0.2);
    for (let u = 0; u <= lengthM; u += 3) {
      for (let v = 0; v <= widthM; v += 3) {
        expect(terrain.landCover(u, v) === 'LAVA', `${u},${v}`).toBe(ground(u, v) < LAVA_BELOW_M);
      }
    }
    expect(terrain.ndvi(lavaCells[0]?.u ?? 0, lavaCells[0]?.v ?? 0)).toBeLessThan(0.05);
  });

  it('LAVA_THERMALS: uma térmica de 6 m/s e r = 40 m por aglomerado de lava, cobrindo toda célula de lava da AOI', () => {
    const fx = resolveRuleEffects(R05.specialRules);
    expect(fx.terrain.lavaThermals).toEqual(RULE_PARAMS.lava);
    expect(fx.terrain.lavaThermals).toEqual({ liftMs: 6, radiusM: 40 });
    expect(fx.flight.thermalGlow).toBe(true);
    expect(terrain.zones.length).toBeGreaterThan(3);
    expect(terrain.zones.every((z) => z.kind === 'THERMAL')).toBe(true);
    expect(terrain.zones).toEqual(lavaThermalZones(lavaCells));
    for (const z of terrain.zones) {
      if (z.kind !== 'THERMAL') continue;
      expect(z.radiusM).toBe(40);
      expect(z.liftMs).toBe(6);
    }
    for (const c of lavaCells) {
      const covered = terrain.zones.some(
        (z) => z.kind === 'THERMAL' && Math.hypot(c.u - z.u, c.v - z.v) <= z.radiusM,
      );
      expect(covered, `lava em ${c.u},${c.v}`).toBe(true);
    }
  });
});

describe('RIFT_CUBES: cobertura e textura', () => {
  it('grama no topo (xadrez de 1 m em dois verdes), rocha na borda de cada degrau e lava embaixo', () => {
    const share = (c: LandCover) => (stats.covers[c] ?? 0) / stats.n;
    expect(Object.keys(stats.covers).sort()).toEqual(['CROP', 'GRASS', 'LAVA', 'ROCK']);
    expect(share('GRASS') + share('CROP')).toBeGreaterThan(0.5);
    // Os dois verdes se misturam: o escuro (CROP) é ~38 % do topo.
    const top = share('GRASS') + share('CROP');
    expect(share('CROP') / top).toBeGreaterThan(0.3);
    expect(share('CROP') / top).toBeLessThan(0.45);
    // O pixel de 1 m: dentro dele a cobertura não muda.
    for (let u = 100; u < 140; u += 5) {
      for (let v = 100; v < 140; v += 5) {
        const c = terrain.landCover(u + 0.1, v + 0.1);
        if (c === 'ROCK' || c === 'LAVA') continue;
        expect(terrain.landCover(u + 0.9, v + 0.9)).toBe(c);
      }
    }
    // Rocha é a faixa de 1 m junto de uma vizinha mais baixa (ou de um patamar de borda).
    let rock = 0;
    for (let u = 0; u <= lengthM; u += 1.5) {
      for (let v = 0; v <= widthM; v += 1.5) {
        if (terrain.landCover(u, v) !== 'ROCK') continue;
        rock++;
        const h = ground(u, v);
        const lower = [
          [CELL_M, 0],
          [-CELL_M, 0],
          [0, CELL_M],
          [0, -CELL_M],
        ].some(([du, dv]) => ground(u + (du as number), v + (dv as number)) < h);
        expect(lower, `${u},${v}`).toBe(true);
      }
    }
    expect(rock).toBeGreaterThan(1000);
    const [gr, gg] = terrain.palette.cover.GRASS;
    const [cr, cg] = terrain.palette.cover.CROP;
    expect(cr + cg).toBeLessThan(gr + gg);
  });
});

describe('RIFT_CUBES: patamares, trilha e objetos', () => {
  it('5 patamares planos nos GCPs: nunca lava, na cota da coluna do centro, e a picape chega a todos', () => {
    expect(GCP_PADS).toEqual(R05.referencePlan.gcps);
    expect(terrain.guaranteedAccessible).toEqual(GCP_PADS);
    const pickup = getVehicle('PICKUP_4X4');
    for (const p of GCP_PADS) {
      const e0 = ground(p.u, p.v);
      expect(e0).toBeGreaterThanOrEqual(LAVA_BELOW_M);
      for (let a = 0; a < 2 * Math.PI; a += Math.PI / 8) {
        const r = PAD_RADIUS_M - CELL_M * 0.8;
        expect(ground(p.u + r * Math.cos(a), p.v + r * Math.sin(a))).toBe(e0);
      }
      expect(terrain.landCover(p.u, p.v)).not.toBe('LAVA');
      expect(isAccessible(p.u, p.v, terrain, [pickup], { paintMarkers: false })).toEqual({
        ok: true,
      });
    }
  });

  it('uma trilha de terra de 3 m cruza a AOI: a picape chega a 400 m dela (a pé, não: a ficha pede a 4x4)', () => {
    expect(TRAIL_WIDTH_M).toBe(3);
    expect(terrain.roads).toHaveLength(1);
    expect(terrain.roads[0]).toMatchObject({ kind: 'TRAIL', widthM: 3 });
    expect(terrain.roads[0]?.points[0]?.u).toBeLessThan(0);
    expect(terrain.roads[0]?.points.at(-1)?.u).toBeGreaterThan(lengthM);
    expect(terrain.distanceToTrack(150, trailV(150))).toBeLessThan(0.5);
    let far = 0;
    for (let u = 0; u <= lengthM; u += 10) {
      for (let v = 0; v <= widthM; v += 10) far = Math.max(far, terrain.distanceToTrack(u, v));
    }
    expect(far).toBeLessThan(getVehicle('PICKUP_4X4').gcpReachM);
  });

  it('30 blocos soltos de 4 m (8 com outro por cima) e 12 árvores cúbicas (tronco de 6 m e copa de 5 × 5 × 4 m)', () => {
    expect(blocks).toHaveLength(BLOCK_COUNT + STACKED_BLOCKS);
    expect(blocks.filter((b) => (b.baseM ?? 0) === 0)).toHaveLength(BLOCK_COUNT);
    expect(blocks.filter((b) => b.baseM === BLOCK_M)).toHaveLength(STACKED_BLOCKS);
    for (const b of blocks) {
      expect([b.widthM, b.depthM, b.heightM]).toEqual([4, 4, 4]);
      expect(b.solid).toBe(true);
    }
    expect(trunks).toHaveLength(TREE_COUNT);
    expect(crowns).toHaveLength(TREE_COUNT);
    for (const t of trunks) expect(t.heightM).toBe(TRUNK.heightM);
    for (const c of crowns) {
      expect([c.depthM, c.heightM, c.baseM]).toEqual([5, CROWN.heightM, TRUNK.heightM]);
      // Cada copa está sobre um tronco.
      expect(trunks.some((t) => t.u === c.u && t.v === c.v)).toBe(true);
    }
    // Tudo no centro de uma coluna, fora da lava, dos patamares e da trilha.
    const all: WorldObject[] = cubes;
    for (const o of all) {
      expect((o.u / CELL_M - 0.5) % 1).toBeCloseTo(0, 9);
      expect((o.v / CELL_M - 0.5) % 1).toBeCloseTo(0, 9);
      expect(ground(o.u, o.v)).toBeGreaterThanOrEqual(LAVA_BELOW_M);
      for (const p of GCP_PADS)
        expect(Math.hypot(o.u - p.u, o.v - p.v)).toBeGreaterThan(PAD_RADIUS_M);
      expect(terrain.distanceToTrack(o.u, o.v)).toBeGreaterThan(TRAIL_WIDTH_M / 2);
    }
  });
});

describe('RIFT_CUBES: custo', () => {
  it('criação em poucas centenas de ms; cota e cobertura custam poucos µs por chamada', () => {
    clearTerrainCache();
    const t0 = performance.now();
    const fresh = createTerrain(R05);
    expect(performance.now() - t0).toBeLessThan(2000);
    const start = performance.now();
    let acc = 0;
    for (let i = 0; i < 100_000; i++) {
      const u = i % 320;
      const v = (i * 7) % 240;
      acc += fresh.elevation(u, v);
      if (fresh.landCover(u, v) === 'LAVA') acc++;
    }
    expect(acc).toBeGreaterThan(0);
    expect(performance.now() - start).toBeLessThan(1500);
  });
});
