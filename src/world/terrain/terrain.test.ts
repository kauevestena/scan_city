import type { BiomeId } from '@/types';
import { mulberry32 } from '@/lib/rng';
import { createDistanceField } from './distanceField';
import { domainWarp, fbm, ridged, valueNoise2D } from './noise';
import { insideFootprint, makeObject, objectTopAt } from './objects';
import { createSpatialHash } from './spatialHash';
import { HOUSE, ORCHARD, ORCHARD_CANOPY, POND, RURAL_TUTORIAL } from './biomes/ruralTutorial';
import { clearTerrainCache, createTerrain } from './createTerrain';
import {
  buildTerrain,
  distanceToSegment,
  terrainSeed,
  type BiomeRecipe,
  type PlacementCtx,
  type TerrainContract,
} from './TerrainSampler';

const C00: TerrainContract = {
  id: 'C00',
  seed: 1001,
  biome: 'RURAL_TUTORIAL',
  aoi: { widthM: 160, lengthM: 240 },
  terrainReliefM: 15,
};

beforeEach(() => clearTerrainCache());

describe('ruído', () => {
  it('valueNoise2D fica em [−1, 1], é contínuo e determinístico', () => {
    const n = valueNoise2D(42);
    const m = valueNoise2D(42);
    const rng = mulberry32(1);
    for (let i = 0; i < 2000; i++) {
      const x = rng.range(-100, 100);
      const y = rng.range(-100, 100);
      const value = n(x, y);
      expect(value).toBeGreaterThanOrEqual(-1);
      expect(value).toBeLessThanOrEqual(1);
      expect(m(x, y)).toBe(value);
      expect(Math.abs(n(x + 1e-4, y) - value)).toBeLessThan(1e-3);
    }
    expect(valueNoise2D(43)(3.3, 4.4)).not.toBe(n(3.3, 4.4));
  });

  it('fbm, ridged e domainWarp', () => {
    const n = valueNoise2D(7);
    const f = fbm(n, 1.5, 2.5, { octaves: 4 });
    expect(Math.abs(f)).toBeLessThanOrEqual(1);
    expect(fbm(n, 1.5, 2.5, { octaves: 1 })).toBeCloseTo(n(1.5, 2.5), 12);
    const r = ridged(n, 1.5, 2.5, 3);
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(1);
    const [wx, wy] = domainWarp(n, 1, 1, 0);
    expect([wx, wy]).toEqual([1, 1]);
    expect(domainWarp(n, 1, 1, 5)).not.toEqual([1, 1]);
  });
});

describe('campo de distâncias (chamfer)', () => {
  it('aproxima a distância euclidiana a uma linha (< 8 %) e é 0 na semente', () => {
    const bounds = { uMin: 0, uMax: 200, vMin: 0, vMax: 200 };
    const field = createDistanceField(bounds, 4, (u) => Math.abs(u - 100) <= 2);
    expect(field.sample(100, 50)).toBe(0);
    for (const u of [40, 60, 150, 190]) {
      const expected = Math.abs(u - 100) - 2;
      expect(Math.abs(field.sample(u, 120) - expected)).toBeLessThanOrEqual(
        Math.max(4, expected * 0.08),
      );
    }
    // Fora do raster, soma a distância à borda.
    expect(field.sample(-50, 100)).toBeGreaterThan(field.sample(0, 100) + 49);
  });
});

describe('objetos e hash espacial', () => {
  let id = 1;
  const next = () => id++;
  const house = makeObject(next, {
    kind: 'BUILDING',
    u: 10,
    v: 10,
    widthM: 12,
    depthM: 10,
    heightM: 6,
    color: [0, 0, 0],
  });
  const rotated = makeObject(next, {
    kind: 'BUILDING',
    u: 100,
    v: 100,
    widthM: 20,
    depthM: 2,
    heightM: 3,
    color: [0, 0, 0],
    rotationRad: Math.PI / 2,
    baseM: 1,
  });
  const tree = makeObject(next, {
    kind: 'TREE',
    u: 50,
    v: 50,
    widthM: 6,
    depthM: 6,
    heightM: 8,
    color: [0, 0, 0],
    solid: false,
  });

  it('footprint rotacionado e topo dos objetos', () => {
    expect(insideFootprint(house, 15, 14)).toBe(true);
    expect(insideFootprint(house, 17, 10)).toBe(false);
    expect(insideFootprint(rotated, 100, 109)).toBe(true);
    expect(insideFootprint(rotated, 109, 100)).toBe(false);
    expect(objectTopAt(house, 10, 10)).toBe(6);
    expect(objectTopAt(rotated, 100, 105)).toBe(4);
    expect(objectTopAt(tree, 50, 50)).toBe(8);
    expect(objectTopAt(tree, 53, 50)).toBeCloseTo(6, 9);
    expect(objectTopAt(tree, 60, 50)).toBeNull();
    expect(tree.solid).toBe(false);
  });

  it('o hash devolve os objetos próximos', () => {
    const wire = {
      ...makeObject(next, {
        kind: 'WIRE',
        u: 0,
        v: 0,
        widthM: 1,
        depthM: 40,
        heightM: 10,
        color: [0, 0, 0],
      }),
      u2: 40,
      v2: 0,
    };
    const hash = createSpatialHash([house, tree, wire]);
    expect(hash.near(10, 10)).toContain(house);
    expect(hash.near(50, 50)).toContain(tree);
    expect(hash.near(30, 0)).toContain(wire);
    expect(hash.near(500, 500)).toEqual([]);
  });

  it('distância a segmento', () => {
    expect(distanceToSegment({ u: 5, v: 3 }, { u: 0, v: 0 }, { u: 10, v: 0 })).toBe(3);
    expect(distanceToSegment({ u: -3, v: 4 }, { u: 0, v: 0 }, { u: 10, v: 0 })).toBe(5);
    expect(distanceToSegment({ u: 3, v: 4 }, { u: 0, v: 0 }, { u: 0, v: 0 })).toBe(5);
  });
});

describe('zonas de uma receita', () => {
  it('recebem o mesmo contexto de `placeObjects`: a cota, os limites e as vias (a lava da R05 sai daí)', () => {
    const seen: PlacementCtx[] = [];
    const recipe: BiomeRecipe = {
      ...RURAL_TUTORIAL,
      placeObjects(ctx, rng) {
        seen.push(ctx);
        return RURAL_TUTORIAL.placeObjects(ctx, rng);
      },
      zones(_objects, aoi, _rng, ctx) {
        seen.push(ctx);
        return [
          { kind: 'THERMAL', u: aoi.lengthM / 2, v: ctx.elevation(10, 10), radiusM: 5, liftMs: 1 },
        ];
      },
    };
    const t = buildTerrain(C00, recipe);
    expect(seen).toHaveLength(2);
    expect(seen[1]).toBe(seen[0]);
    expect(seen[1]?.aoi).toEqual(C00.aoi);
    expect(seen[1]?.bounds).toEqual(t.bounds);
    expect(seen[1]?.roads).toEqual(t.roads);
    expect(t.zones).toEqual([
      { kind: 'THERMAL', u: 120, v: t.elevation(10, 10), radiusM: 5, liftMs: 1 },
    ]);
  });

  it('uma receita de `zones` com três parâmetros (as de antes) segue valendo', () => {
    const recipe: BiomeRecipe = {
      ...RURAL_TUTORIAL,
      zones: (_objects, _aoi, rng) => [
        { kind: 'THERMAL', u: rng.range(0, 10), v: 0, radiusM: 1, liftMs: 1 },
      ],
    };
    const a = buildTerrain(C00, recipe);
    const b = buildTerrain(C00, recipe);
    expect(a.zones).toHaveLength(1);
    expect(a.zones).toEqual(b.zones);
  });
});

describe('createTerrain — RURAL_TUTORIAL (C00)', () => {
  it('determinismo: mesma seed → mesmas amostras em 1.000 pontos e mesmos objetos', () => {
    const a = buildTerrain(C00, RURAL_TUTORIAL);
    const b = buildTerrain(C00, RURAL_TUTORIAL);
    const rng = mulberry32(11);
    for (let i = 0; i < 1000; i++) {
      const u = rng.range(-48, 288);
      const v = rng.range(-32, 192);
      expect(b.elevation(u, v)).toBe(a.elevation(u, v));
      expect(b.surface(u, v)).toBe(a.surface(u, v));
      expect(b.landCover(u, v)).toBe(a.landCover(u, v));
      expect(b.canopy(u, v)).toBe(a.canopy(u, v));
      expect(b.ndvi(u, v)).toBe(a.ndvi(u, v));
    }
    expect(b.objects).toEqual(a.objects);
    // Outra seed muda o relevo.
    const other = buildTerrain({ ...C00, seed: 1002 }, RURAL_TUTORIAL);
    expect(other.elevation(50, 50)).not.toBe(a.elevation(50, 50));
    expect(terrainSeed(C00)).toBe(terrainSeed({ id: 'C00', seed: 1001 }));
  });

  it('é memoizado por contrato', () => {
    const t = createTerrain(C00);
    expect(createTerrain(C00)).toBe(t);
    // Bioma sem receita (aqui, um id que nunca existirá): erro claro, sem terreno parcial.
    expect(() => createTerrain({ ...C00, id: 'X', biome: 'NAO_EXISTE' as BiomeId })).toThrow(
      RangeError,
    );
  });

  it('relevo de até 15 m, margem de 20 % e dimensões', () => {
    const t = createTerrain(C00);
    expect(t.bounds).toEqual({ uMin: -48, uMax: 288, vMin: -32, vMax: 192 });
    expect(t.lengthM).toBeCloseTo(336, 9);
    expect(t.widthM).toBeCloseTo(224, 9);
    const rng = mulberry32(5);
    for (let i = 0; i < 500; i++) {
      const e = t.elevation(rng.range(-48, 288), rng.range(-32, 192));
      expect(e).toBeGreaterThanOrEqual(-2);
      expect(e).toBeLessThanOrEqual(15);
    }
  });

  it('cobertura: açude, pomar, estrada, telhado e pasto', () => {
    const t = createTerrain(C00);
    expect(t.landCover(POND.u, POND.v)).toBe('WATER');
    expect(t.landCover(ORCHARD.uMin + 2, ORCHARD.vMin + 2)).toBe('FOREST');
    expect(t.canopy(ORCHARD.uMin + 1, ORCHARD.vMin + 1)).toBe(ORCHARD_CANOPY);
    expect(t.landCover(120, 80)).toBe('ROAD');
    expect(t.landCover(HOUSE.u, HOUSE.v)).toBe('ROOF');
    expect(t.landCover(25, 140)).toBe('GRASS');
    expect(t.ndvi(POND.u, POND.v)).toBeLessThan(0);
    expect(t.ndvi(25, 140)).toBeGreaterThan(0.4);
    expect(t.ndvi(HOUSE.u, HOUSE.v)).toBeLessThan(0.2);
    expect(t.ndvi(120, 80)).toBeLessThan(0.2);
    expect(t.ndvi(ORCHARD.uMin + 2, ORCHARD.vMin + 2)).toBeGreaterThan(0.6);
  });

  it('distanceToRoad é 0 sobre a estrada e cresce ao se afastar', () => {
    const t = createTerrain(C00);
    expect(t.distanceToRoad(120, 80)).toBe(0);
    expect(t.distanceToRoad(0, 0)).toBe(0);
    const perp = { u: 120 - 0.5547 * 50, v: 80 + 0.83205 * 50 };
    expect(Math.abs(t.distanceToRoad(perp.u, perp.v) - (50 - 2.5))).toBeLessThan(4);
    expect(t.distanceToTrack(120, 80)).toBe(0);
  });

  it('casa (12 × 10 × 6), 25 árvores e cerca não sólida; MDS sobre a casa', () => {
    const t = createTerrain(C00);
    const kinds = (k: string) => t.objects.filter((o) => o.kind === k);
    expect(kinds('BUILDING')).toHaveLength(1);
    expect(kinds('TREE')).toHaveLength(25);
    expect(kinds('POLE').every((p) => !p.solid && p.heightM < 2)).toBe(true);
    expect(t.surface(HOUSE.u, HOUSE.v) - t.elevation(HOUSE.u, HOUSE.v)).toBeCloseTo(6, 9);
    expect(t.surface(25, 140)).toBe(t.elevation(25, 140));
    for (let i = 1; i < t.objects.length; i++) {
      expect((t.objects[i] as { u: number }).u).toBeGreaterThanOrEqual(
        (t.objects[i - 1] as { u: number }).u,
      );
    }
  });

  it('objectsInRange devolve os objetos da faixa de u', () => {
    const t = createTerrain(C00);
    const inRange = t.objectsInRange(ORCHARD.uMin, ORCHARD.uMax);
    expect(inRange.filter((o) => o.kind === 'TREE').length).toBeGreaterThanOrEqual(15);
    expect(inRange.every((o) => o.u >= ORCHARD.uMin - 10 && o.u <= ORCHARD.uMax + 10)).toBe(true);
    expect(t.objectsInRange(1000, 2000)).toEqual([]);
  });

  it('slopePct por diferenças finitas', () => {
    const t = createTerrain(C00);
    const s = t.slopePct(30, 30);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThan(60);
    expect(t.features).toEqual([]);
    expect(t.zones).toEqual([]);
    expect(t.guaranteedAccessible).toEqual([]);
    expect(t.palette.cover.GRASS).toHaveLength(3);
  });

  it('elevation custa < 2 µs por chamada (100.000 chamadas < 200 ms)', () => {
    const t = createTerrain(C00);
    let sink = 0;
    for (let i = 0; i < 20_000; i++) sink += t.elevation(i % 240, (i * 7) % 160);
    const start = performance.now();
    for (let i = 0; i < 100_000; i++)
      sink += t.elevation(((i * 0.37) % 300) - 40, ((i * 0.91) % 200) - 30);
    const elapsed = performance.now() - start;
    expect(sink).not.toBeNaN();
    expect(elapsed).toBeLessThan(200);
  });
});
