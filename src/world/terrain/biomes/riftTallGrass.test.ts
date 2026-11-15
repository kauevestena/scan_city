import { CATALOG, getVehicle } from '@/data/catalog';
import { R09 } from '@/data/contracts/rifts';
import { isAccessible } from '@/domain/accessibility';
import { buildFlightPlan } from '@/domain/flightPlanner';
import { referenceParams } from '@/domain/referencePlan';
import { meanAoiElevation } from '@/engines/flight/FlightEngine';
import type { LandCover } from '@/types';
import { clearTerrainCache, createTerrain } from '../createTerrain';
import { createNoiseKit, type NoiseKit } from '../noise';
import { BIOMES } from './index';
import {
  crossU,
  LAKE,
  lakeDistance,
  NDVI_SHORT,
  NDVI_TALL,
  RELIEF_M,
  RIFT_TALL_GRASS,
  TREE_COUNT,
  TREE_CROWN_M,
  TREE_HEIGHT_M,
  trailV1,
  trailV2,
} from './riftTallGrass';

const terrain = createTerrain(R09);
const { lengthM, widthM } = R09.aoi;
const trees = terrain.objects.filter((o) => o.kind === 'TREE');

/** Amostra a AOI inteira numa grade de 4 m: cobertura e NDVI de cada ponto. */
function survey(step = 4) {
  const covers: Partial<Record<LandCover, number>> = {};
  const ndvi: Partial<Record<LandCover, number[]>> = {};
  let n = 0;
  for (let u = 0; u <= lengthM; u += step) {
    for (let v = 0; v <= widthM; v += step) {
      const c = terrain.landCover(u, v);
      covers[c] = (covers[c] ?? 0) + 1;
      (ndvi[c] ??= []).push(terrain.ndvi(u, v));
      n++;
    }
  }
  return { covers, ndvi, n };
}

describe('createTerrain — RIFT_TALL_GRASS (R09)', () => {
  it('a receita está registrada e é a do contrato', () => {
    expect(BIOMES.RIFT_TALL_GRASS).toBe(RIFT_TALL_GRASS);
    expect(terrain.biome).toBe('RIFT_TALL_GRASS');
    expect(terrain.aoi).toEqual({ widthM: 400, lengthM: 800 });
  });

  it('determinismo: mesma seed → mesmas árvores e amostras de cota, cobertura e NDVI', () => {
    clearTerrainCache();
    const again = createTerrain(R09);
    expect(again).not.toBe(terrain);
    expect(again.objects).toEqual(terrain.objects);
    expect(again.roads).toEqual(terrain.roads);
    for (let u = -100; u <= 900; u += 53) {
      for (let v = -60; v <= 460; v += 37) {
        expect(again.elevation(u, v)).toBe(terrain.elevation(u, v));
        expect(again.landCover(u, v)).toBe(terrain.landCover(u, v));
        expect(again.ndvi(u, v)).toBe(terrain.ndvi(u, v));
      }
    }
  });

  it('relevo de até 20 m, com mais várzea que morro, e a bacia do lago afundada', () => {
    let lo = Infinity;
    let hi = -Infinity;
    const all: number[] = [];
    for (let u = 0; u <= lengthM; u += 5) {
      for (let v = 0; v <= widthM; v += 5) {
        const e = terrain.elevation(u, v);
        all.push(e);
        lo = Math.min(lo, e);
        hi = Math.max(hi, e);
      }
    }
    expect(RELIEF_M).toBe(R09.terrainReliefM);
    expect(lo).toBeGreaterThanOrEqual(-LAKE.basinM - 0.01);
    expect(hi).toBeLessThanOrEqual(RELIEF_M + 0.01);
    expect(hi - lo).toBeGreaterThan(RELIEF_M * 0.6);
    // Mais baixada que morro: a cota mediana fica abaixo da média (o voo é a média + 120 m).
    all.sort((a, b) => a - b);
    const mean = all.reduce((s, e) => s + e, 0) / all.length;
    expect(all[all.length >> 1] as number).toBeLessThan(mean + 0.5);
    expect(mean).toBeLessThan(RELIEF_M / 2);
  });

  it('a bacia do lago afunda 3 m no centro e some na margem (com o ruído zerado, só sobra a bacia)', () => {
    const flat = { ...createNoiseKit(R09.seed), fbm: () => 0 } as NoiseKit;
    const base = (du: number) =>
      RIFT_TALL_GRASS.baseElevation(LAKE.u + du * LAKE.semiU, LAKE.v, flat);
    // Sem ruído w = 0,5 e a cota é RELIEF/4; o centro do lago fica 3 m abaixo disso.
    expect(base(0)).toBeCloseTo(RELIEF_M / 4 - LAKE.basinM, 9);
    expect(base(1.3)).toBeCloseTo(RELIEF_M / 4, 9);
    expect(base(2)).toBeCloseTo(RELIEF_M / 4, 9);
    // Do centro à margem a bacia só sobe.
    let prev = base(0);
    for (let d = 0.1; d <= 1.3; d += 0.1) {
      expect(base(d)).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = base(d);
    }
  });

  it('um lago de 220 × 140 m com margem de areia, e o resto é capim baixo e capim alto', () => {
    expect(lakeDistance(LAKE.u, LAKE.v)).toBe(0);
    expect(terrain.landCover(LAKE.u, LAKE.v)).toBe('WATER');
    expect(terrain.landCover(LAKE.u + LAKE.semiU * 0.99, LAKE.v)).toBe('WATER');
    expect(terrain.landCover(LAKE.u + LAKE.semiU * 1.1, LAKE.v)).toBe('SAND');
    expect(terrain.landCover(LAKE.u, LAKE.v - LAKE.semiV * 1.1)).toBe('SAND');
    const { covers, n } = survey();
    const share = (c: LandCover) => (covers[c] ?? 0) / n;
    expect(share('WATER')).toBeGreaterThan(0.05);
    expect(share('WATER')).toBeLessThan(0.1);
    expect(share('SAND')).toBeGreaterThan(0.02);
    expect(share('SAND')).toBeLessThan(0.07);
    // Capim baixo é a maior parte; o alto vem em manchas de uns 35 % do campo.
    expect(share('GRASS')).toBeGreaterThan(0.4);
    expect(share('CROP')).toBeGreaterThan(0.25);
    expect(share('CROP')).toBeLessThan(0.45);
    expect(share('GRASS') + share('CROP') + share('WATER') + share('SAND')).toBeCloseTo(1, 9);
  });

  it('o capim alto brilha no NDVI (≥ 0,8) e o baixo fica em ~0,5, bem separados; água < 0, areia e estrada baixas', () => {
    const { ndvi } = survey();
    const tall = ndvi.CROP as number[];
    const short = ndvi.GRASS as number[];
    expect(NDVI_TALL).toBeGreaterThanOrEqual(0.8);
    expect(Math.min(...tall)).toBeGreaterThanOrEqual(0.8);
    expect(Math.max(...tall)).toBeLessThanOrEqual(0.9);
    expect(Math.min(...short)).toBeGreaterThan(0.4);
    expect(Math.max(...short)).toBeLessThan(0.6);
    expect(NDVI_SHORT).toBe(0.5);
    // Nenhum pixel de capim baixo se confunde com o alto.
    expect(Math.max(...short)).toBeLessThan(Math.min(...tall));
    expect(Math.max(...(ndvi.WATER as number[]))).toBeLessThan(0);
    expect(Math.max(...(ndvi.SAND as number[]))).toBeLessThan(0.2);
  });

  it('a cor do capim alto é mais viçosa (mais escura e verde) que a do baixo', () => {
    const [sr, sg] = terrain.palette.cover.GRASS;
    const [tr, tg] = terrain.palette.cover.CROP;
    expect(tr + tg).toBeLessThan(sr + sg);
    expect(tr).toBeLessThan(sr);
  });

  it('três trilhas de terra de 3 m: duas ao longo de u e uma cruzando por v, todas dentro da AOI', () => {
    expect(terrain.roads).toHaveLength(3);
    expect(terrain.roads.every((r) => r.kind === 'TRAIL' && r.widthM === 3)).toBe(true);
    // Cada trilha atravessa a AOI inteira (e passa dela, pela margem).
    const [a, b, c] = terrain.roads;
    expect(a?.points[0]?.u).toBeLessThan(0);
    expect(a?.points.at(-1)?.u).toBeGreaterThan(lengthM);
    expect(b?.points[0]?.u).toBeLessThan(0);
    expect(c?.points[0]?.v).toBeLessThan(0);
    expect(c?.points.at(-1)?.v).toBeGreaterThan(widthM);
    // As trilhas seguem as curvas do bioma.
    expect(terrain.distanceToTrack(400, trailV1(400))).toBeLessThan(0.5);
    expect(terrain.distanceToTrack(300, trailV2(300))).toBeLessThan(0.5);
    expect(terrain.distanceToTrack(crossU(200), 200)).toBeLessThan(0.5);
    // O capim alto e o baixo cobrem as trilhas: a cobertura não vira estrada.
    expect(['GRASS', 'CROP']).toContain(terrain.landCover(400, trailV1(400)));
  });

  it('60 árvores isoladas de 8 a 14 m, longe do lago, da margem e das trilhas', () => {
    expect(trees).toHaveLength(TREE_COUNT);
    expect(terrain.objects).toHaveLength(TREE_COUNT);
    for (const t of trees) {
      expect(t.widthM).toBeGreaterThanOrEqual(TREE_CROWN_M[0]);
      expect(t.widthM).toBeLessThanOrEqual(TREE_CROWN_M[1]);
      expect(t.heightM).toBeGreaterThanOrEqual(TREE_HEIGHT_M[0]);
      expect(t.heightM).toBeLessThanOrEqual(TREE_HEIGHT_M[1]);
      expect(lakeDistance(t.u, t.v)).toBeGreaterThanOrEqual(LAKE.shore);
      expect(terrain.distanceToTrack(t.u, t.v)).toBeGreaterThan(t.widthM / 2);
      expect(['GRASS', 'CROP']).toContain(terrain.landCover(t.u, t.v));
    }
  });

  it('só há árvores: as criaturas elétricas não são objetos, os picos vêm do tempo', () => {
    expect(new Set(terrain.objects.map((o) => o.kind))).toEqual(new Set(['TREE']));
    expect(terrain.features).toEqual([]);
    expect(terrain.zones).toEqual([]);
  });

  it('a pé ou de bicicleta chega-se a qualquer ponto de capim: a trilha é chão firme e o lago barra', () => {
    const foot = getVehicle('FOOT_BIKE');
    const options = { paintMarkers: false };
    const trail = terrain.guaranteedAccessible[0] as { u: number; v: number };
    expect(trail).toEqual({ u: 400, v: trailV1(400) });
    expect(isAccessible(trail.u, trail.v, terrain, [foot], options)).toEqual({ ok: true });
    expect(isAccessible(LAKE.u, LAKE.v, terrain, [foot], options).ok).toBe(false);
    expect(isAccessible(LAKE.u, LAKE.v, terrain, [foot], options).reason).toBe('WATER');
    // Um ponto de capim alto qualquer, fora das trilhas e de ladeiras íngremes, é acessível.
    let found = false;
    for (let u = 40; u < lengthM && !found; u += 20) {
      for (let v = 40; v < widthM && !found; v += 20) {
        if (terrain.landCover(u, v) !== 'CROP' || terrain.slopePct(u, v) > 20) continue;
        expect(isAccessible(u, v, terrain, [foot], options), `${u},${v}`).toEqual({ ok: true });
        found = true;
      }
    }
    expect(found).toBe(true);
  });

  it('o plano de referência (H = 120 m) passa por cima de tudo: 30 m acima da copa mais alta', () => {
    const planAlt = meanAoiElevation(terrain) + R09.referencePlan.heightM;
    for (const t of trees) {
      const top = terrain.elevation(t.u, t.v) + t.heightM;
      expect(top, `árvore ${t.id}`).toBeLessThan(planAlt - 30);
    }
    // E por cima do morro mais alto do campo.
    let hi = -Infinity;
    for (let u = 0; u <= lengthM; u += 10) {
      for (let v = 0; v <= widthM; v += 10) hi = Math.max(hi, terrain.elevation(u, v));
    }
    expect(planAlt - hi).toBeGreaterThan(100);
    const plan = buildFlightPlan(referenceParams(R09), R09, CATALOG);
    expect(plan.stats.nLines).toBe(9);
  });
});
