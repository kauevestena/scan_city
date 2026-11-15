import { getVehicle } from '@/data/catalog';
import { C01 } from '@/data/contracts';
import { isAccessible } from '@/domain/accessibility';
import { mulberry32 } from '@/lib/rng';
import type { WorldObject } from '@/types';
import { rtkStatusAt } from '@/engines/flight/cameraSensor';
import { clearTerrainCache, createTerrain } from '../createTerrain';
import { BIOMES } from './index';
import { RURAL_TUTORIAL } from './ruralTutorial';
import {
  buildingHeightM,
  PLAZA,
  PLAZA_CENTER,
  STREET_SPACING_M,
  STREET_WIDTH_M,
  streetPositions,
  TALL_MIN_M,
  TALLEST_BUILDING_M,
  URBAN_VERTICAL,
} from './urbanVertical';
import { rtkCanyonZones } from '../ruleGenerators';

const terrain = createTerrain(C01);
const buildings = terrain.objects.filter((o) => o.kind === 'BUILDING');
const inAoi = (o: { u: number; v: number }) =>
  o.u >= 0 && o.u <= C01.aoi.lengthM && o.v >= 0 && o.v <= C01.aoi.widthM;
const share = (list: readonly WorldObject[]) =>
  list.filter((b) => b.heightM > TALL_MIN_M).length / list.length;

/** Posições das ruas ao longo de cada eixo, lidas da rede viária. */
const streets = {
  us: terrain.roads
    .filter((r) => r.points[0]?.u === r.points[1]?.u)
    .map((r) => r.points[0]?.u as number)
    .sort((a, b) => a - b),
  vs: terrain.roads
    .filter((r) => r.points[0]?.v === r.points[1]?.v)
    .map((r) => r.points[0]?.v as number)
    .sort((a, b) => a - b),
};

describe('createTerrain — URBAN_VERTICAL (C01)', () => {
  it('a receita está registrada e é a do contrato', () => {
    expect(BIOMES.URBAN_VERTICAL).toBe(URBAN_VERTICAL);
    expect(terrain.biome).toBe('URBAN_VERTICAL');
    expect(terrain.aoi).toEqual({ widthM: 240, lengthM: 360 });
  });

  it('determinismo: a mesma seed gera as mesmas ruas, prédios, zonas e amostras', () => {
    clearTerrainCache();
    const again = createTerrain(C01);
    expect(again).not.toBe(terrain);
    expect(again.objects).toEqual(terrain.objects);
    expect(again.zones).toEqual(terrain.zones);
    expect(again.roads).toEqual(terrain.roads);
    const rng = mulberry32(99);
    for (let i = 0; i < 1000; i++) {
      const u = rng.range(-70, 430);
      const v = rng.range(-45, 285);
      expect(again.elevation(u, v)).toBe(terrain.elevation(u, v));
      expect(again.landCover(u, v)).toBe(terrain.landCover(u, v));
      expect(again.surface(u, v)).toBe(terrain.surface(u, v));
    }
    // Outra seed, outra cidade.
    const other = createTerrain({ ...C01, id: 'C01-OUTRA', seed: 777 });
    expect(other.objects).not.toEqual(terrain.objects);
  });

  it('grade de ruas: 60–80 m entre ruas paralelas, ancorada nas ruas da praça e cobrindo a margem', () => {
    for (const axis of [streets.us, streets.vs]) {
      for (let k = 1; k < axis.length; k++) {
        const gap = (axis[k] as number) - (axis[k - 1] as number);
        expect(gap).toBeGreaterThanOrEqual(STREET_SPACING_M[0]);
        expect(gap).toBeLessThanOrEqual(STREET_SPACING_M[1]);
      }
    }
    const half = STREET_WIDTH_M / 2;
    expect(streets.us).toEqual(expect.arrayContaining([PLAZA.uMin - half, PLAZA.uMax + half]));
    expect(streets.vs).toEqual(expect.arrayContaining([PLAZA.vMin - half, PLAZA.vMax + half]));
    // Uma rua além de cada borda da margem de 20 %: as quadras cobrem tudo.
    expect(streets.us[0]).toBeLessThanOrEqual(terrain.bounds.uMin);
    expect(streets.us.at(-1)).toBeGreaterThanOrEqual(terrain.bounds.uMax);
    expect(streets.vs[0]).toBeLessThanOrEqual(terrain.bounds.vMin);
    expect(streets.vs.at(-1)).toBeGreaterThanOrEqual(terrain.bounds.vMax);
    expect(terrain.roads.every((r) => r.kind === 'ROAD' && r.widthM === STREET_WIDTH_M)).toBe(true);
  });

  it('streetPositions parte das âncoras e anda de 60 a 80 m para os dois lados', () => {
    const out = streetPositions(-100, 500, 200, 270, mulberry32(5));
    expect(out).toContain(200);
    expect(out).toContain(270);
    expect(out[0]).toBeLessThanOrEqual(-100);
    expect(out.at(-1)).toBeGreaterThanOrEqual(500);
    expect([...out].sort((a, b) => a - b)).toEqual(out);
  });

  it('cobertura: rua, praça de grama, telhado sob os prédios e concreto nas calçadas', () => {
    const street = streets.us[2] as number;
    expect(terrain.landCover(street, 40)).toBe('ROAD');
    expect(terrain.landCover(PLAZA_CENTER.u, PLAZA_CENTER.v)).toBe('GRASS');
    const b = buildings[10] as WorldObject;
    expect(terrain.landCover(b.u, b.v)).toBe('ROOF');
    // A calçada: 1 m depois do meio-fio, fora de qualquer prédio.
    expect(terrain.landCover(street + STREET_WIDTH_M / 2 + 1, 40)).toBe('URBAN');
    // O NDVI é baixo na cidade e alto na praça.
    expect(terrain.ndvi(street, 40)).toBeLessThan(0.1);
    expect(terrain.ndvi(PLAZA_CENTER.u + 12, PLAZA_CENTER.v)).toBeGreaterThan(0.45);
    expect(terrain.canopy(street, 40)).toBe(0);
  });

  it('quadras com 2–6 prédios, a praça sem nenhum', () => {
    let blocks = 0;
    for (let k = 0; k + 1 < streets.us.length; k++) {
      for (let j = 0; j + 1 < streets.vs.length; j++) {
        const uMin = streets.us[k] as number;
        const uMax = streets.us[k + 1] as number;
        const vMin = streets.vs[j] as number;
        const vMax = streets.vs[j + 1] as number;
        const inside = buildings.filter(
          (o) => o.u > uMin && o.u < uMax && o.v > vMin && o.v < vMax,
        );
        const center = { u: (uMin + uMax) / 2, v: (vMin + vMax) / 2 };
        const isPlaza = center.u === 180 && center.v === 120;
        if (isPlaza) {
          expect(inside).toHaveLength(0);
          continue;
        }
        // Quadras parcialmente fora dos limites perdem lotes: só as inteiramente dentro contam.
        const whole =
          uMin >= terrain.bounds.uMin &&
          uMax <= terrain.bounds.uMax &&
          vMin >= terrain.bounds.vMin &&
          vMax <= terrain.bounds.vMax;
        if (!whole) continue;
        blocks++;
        expect(inside.length, `quadra (${center.u}, ${center.v})`).toBeGreaterThanOrEqual(2);
        expect(inside.length, `quadra (${center.u}, ${center.v})`).toBeLessThanOrEqual(6);
      }
    }
    expect(blocks).toBeGreaterThanOrEqual(8);
  });

  it('alturas de 10 + 80·r³: 10–90 m, ≥ 20 % acima de 60 m (também dentro da AOI) e um de 90 m', () => {
    expect(buildingHeightM(0)).toBe(10);
    expect(buildingHeightM(1)).toBe(90);
    expect(buildingHeightM(0.5)).toBe(20);
    const heights = buildings.map((b) => b.heightM);
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(10);
    expect(Math.max(...heights)).toBe(TALLEST_BUILDING_M);
    expect(share(buildings)).toBeGreaterThanOrEqual(0.2);
    const aoi = buildings.filter(inAoi);
    expect(aoi.length).toBeGreaterThanOrEqual(30);
    expect(share(aoi)).toBeGreaterThanOrEqual(0.2);
    // O mais alto da AOI tem exatamente 90 m e é único: a nota do briefing.
    expect(Math.max(...aoi.map((b) => b.heightM))).toBe(TALLEST_BUILDING_M);
    expect(buildings.filter((b) => b.heightM === TALLEST_BUILDING_M)).toHaveLength(1);
    // Os baixos nunca passam de 60 m por acaso: são só os altos que formam o cânion.
    const lowest = buildings.filter((b) => b.heightM <= TALL_MIN_M);
    expect(Math.max(...lowest.map((b) => b.heightM))).toBeLessThan(TALL_MIN_M);
  });

  it('prédios sólidos, sem sobreposição, com beco entre vizinhos e calçada até a rua', () => {
    expect(buildings.every((b) => b.solid)).toBe(true);
    for (let i = 0; i < buildings.length; i++) {
      const a = buildings[i] as WorldObject;
      for (let j = i + 1; j < buildings.length; j++) {
        const b = buildings[j] as WorldObject;
        const gapU = Math.abs(a.u - b.u) - (a.widthM + b.widthM) / 2;
        const gapV = Math.abs(a.v - b.v) - (a.depthM + b.depthM) / 2;
        expect(Math.max(gapU, gapV), `${a.id} × ${b.id}`).toBeGreaterThanOrEqual(3 - 1e-9);
      }
      // Fora das ruas: o meio-fio (5 m do eixo) mais a calçada de 2 m.
      for (const u of streets.us) {
        expect(Math.abs(a.u - u) - a.widthM / 2).toBeGreaterThanOrEqual(7 - 1e-9);
      }
      for (const v of streets.vs) {
        expect(Math.abs(a.v - v) - a.depthM / 2).toBeGreaterThanOrEqual(7 - 1e-9);
      }
    }
  });

  it('relevo plano, de até 10 m, com variação suave', () => {
    let min = Infinity;
    let max = -Infinity;
    let slope = 0;
    for (let u = 0; u <= C01.aoi.lengthM; u += 5) {
      for (let v = 0; v <= C01.aoi.widthM; v += 5) {
        const e = terrain.elevation(u, v);
        min = Math.min(min, e);
        max = Math.max(max, e);
        slope = Math.max(slope, terrain.slopePct(u, v));
      }
    }
    expect(min).toBeGreaterThanOrEqual(0);
    expect(max).toBeLessThanOrEqual(C01.terrainReliefM);
    expect(max - min).toBeGreaterThan(3);
    expect(slope).toBeLessThan(15);
  });

  it('zonas RTK_CANYON (≥ 2): uma por par de prédios > 60 m a < 40 m, e o RTK vira FLOAT dentro', () => {
    expect(terrain.zones.length).toBeGreaterThanOrEqual(2);
    expect(terrain.zones.every((z) => z.kind === 'RTK_CANYON')).toBe(true);
    expect(terrain.zones).toEqual(rtkCanyonZones(buildings));
    const tall = buildings.filter((b) => b.heightM > TALL_MIN_M);
    // Cada par de altos a < 40 m tem uma zona que cobre as duas pegadas.
    let pairs = 0;
    for (let i = 0; i < tall.length; i++) {
      for (let j = i + 1; j < tall.length; j++) {
        const a = tall[i] as WorldObject;
        const b = tall[j] as WorldObject;
        const gap = Math.hypot(
          Math.max(
            0,
            Math.abs(a.u - b.u) - (Math.max(a.widthM, a.depthM) + Math.max(b.widthM, b.depthM)) / 2,
          ),
          Math.max(
            0,
            Math.abs(a.v - b.v) - (Math.max(a.widthM, a.depthM) + Math.max(b.widthM, b.depthM)) / 2,
          ),
        );
        if (gap >= 40) continue;
        pairs++;
        const covered = terrain.zones.some(
          (z) =>
            z.kind === 'RTK_CANYON' &&
            z.uMin <= Math.min(a.u, b.u) &&
            z.uMax >= Math.max(a.u, b.u) &&
            z.vMin <= Math.min(a.v, b.v) &&
            z.vMax >= Math.max(a.v, b.v),
        );
        expect(covered, `${a.id} × ${b.id}`).toBe(true);
      }
    }
    expect(pairs).toBe(terrain.zones.length);
    const zone = terrain.zones[0];
    if (zone?.kind !== 'RTK_CANYON') throw new Error('zona inesperada');
    const inside = { u: (zone.uMin + zone.uMax) / 2, v: (zone.vMin + zone.vMax) / 2 };
    expect(rtkStatusAt(true, true, terrain.zones, inside)).toBe('FLOAT');
    // O cânion é local: há ponto da AOI com RTK FIX, longe de qualquer zona.
    let fix: { u: number; v: number } | null = null;
    for (let u = 0; u <= C01.aoi.lengthM && !fix; u += 5) {
      for (let v = 0; v <= C01.aoi.widthM && !fix; v += 5) {
        if (rtkStatusAt(true, true, terrain.zones, { u, v }) === 'FIX') fix = { u, v };
      }
    }
    expect(fix).not.toBeNull();
  });

  it('a praça tem 10 árvores, com o miolo livre e acessível a pé', () => {
    const trees = terrain.objects.filter((o) => o.kind === 'TREE');
    expect(trees).toHaveLength(10);
    for (const t of trees) {
      expect(t.u).toBeGreaterThan(PLAZA.uMin);
      expect(t.u).toBeLessThan(PLAZA.uMax);
      expect(t.v).toBeGreaterThan(PLAZA.vMin);
      expect(t.v).toBeLessThan(PLAZA.vMax);
      expect(Math.hypot(t.u - PLAZA_CENTER.u, t.v - PLAZA_CENTER.v)).toBeGreaterThanOrEqual(10);
    }
    expect(terrain.guaranteedAccessible).toEqual([PLAZA_CENTER]);
    const foot = [getVehicle('FOOT_BIKE')];
    for (const p of terrain.guaranteedAccessible) {
      expect(isAccessible(p.u, p.v, terrain, foot, { paintMarkers: false })).toEqual({ ok: true });
    }
    // Telhado não serve de ponto de apoio.
    const roof = buildings[0] as WorldObject;
    expect(isAccessible(roof.u, roof.v, terrain, foot, { paintMarkers: false })).toEqual({
      ok: false,
      reason: 'ROOF',
    });
  });

  it('a cidade continua na margem de 20 %, e a paleta é a de asfalto e concreto', () => {
    expect(buildings.some((b) => b.u < 0)).toBe(true);
    expect(buildings.some((b) => b.u > C01.aoi.lengthM)).toBe(true);
    expect(buildings.some((b) => b.v < 0)).toBe(true);
    expect(buildings.some((b) => b.v > C01.aoi.widthM)).toBe(true);
    expect(terrain.palette.cover.ROAD).not.toEqual(RURAL_TUTORIAL.palette.cover.ROAD);
    expect(terrain.palette.cover.ROAD.every((c) => c < 100)).toBe(true);
  });

  it('o MDS sobre o prédio mais alto passa de 90 m; elevation custa < 2 µs por chamada', () => {
    const tower = buildings.find((b) => b.heightM === TALLEST_BUILDING_M) as WorldObject;
    expect(terrain.surface(tower.u, tower.v) - terrain.elevation(tower.u, tower.v)).toBe(90);
    const start = performance.now();
    let acc = 0;
    for (let i = 0; i < 100_000; i++) acc += terrain.elevation(i % 360, (i * 7) % 240);
    expect(acc).toBeGreaterThan(0);
    expect(performance.now() - start).toBeLessThan(200);
  });
});
