import { getVehicle } from '@/data/catalog';
import { R06 } from '@/data/contracts/rifts';
import { isAccessible } from '@/domain/accessibility';
import { clearTerrainCache, createTerrain } from '../createTerrain';
import { BIOMES } from './index';
import {
  DEAD_TREE_COUNT,
  DEAD_TREE_CROWN_M,
  DEAD_TREE_HEIGHT_M,
  DENS,
  RELIEF_M,
  RIFT_GREY_SWAMP,
  RUIN_WALL_HEIGHT_M,
  RUINS,
} from './riftGreySwamp';

const terrain = createTerrain(R06);
const { lengthM, widthM } = R06.aoi;
const trees = terrain.objects.filter((o) => o.kind === 'TREE');
const walls = terrain.objects.filter((o) => o.kind === 'BUILDING');

describe('createTerrain — RIFT_GREY_SWAMP (R06)', () => {
  it('a receita está registrada e é a do contrato', () => {
    expect(BIOMES.RIFT_GREY_SWAMP).toBe(RIFT_GREY_SWAMP);
    expect(terrain.biome).toBe('RIFT_GREY_SWAMP');
    expect(terrain.aoi).toEqual({ widthM: 200, lengthM: 300 });
  });

  it('determinismo: mesma seed → mesmas árvores, ruínas e amostras', () => {
    clearTerrainCache();
    const again = createTerrain(R06);
    expect(again).not.toBe(terrain);
    expect(again.objects).toEqual(terrain.objects);
    expect(again.features).toEqual(terrain.features);
    for (let u = -50; u <= 350; u += 27) {
      for (let v = -30; v <= 230; v += 21) {
        expect(again.elevation(u, v)).toBe(terrain.elevation(u, v));
        expect(again.landCover(u, v)).toBe(terrain.landCover(u, v));
      }
    }
  });

  it('brejo quase plano, de 0 a 8 m, com poças e ilhotas de capim', () => {
    let lo = Infinity;
    let hi = -Infinity;
    const covers: Record<string, number> = {};
    let n = 0;
    for (let u = 0; u <= lengthM; u += 3) {
      for (let v = 0; v <= widthM; v += 3) {
        const e = terrain.elevation(u, v);
        lo = Math.min(lo, e);
        hi = Math.max(hi, e);
        const c = terrain.landCover(u, v);
        covers[c] = (covers[c] ?? 0) + 1;
        n++;
      }
    }
    expect(RELIEF_M).toBe(R06.terrainReliefM);
    expect(lo).toBeGreaterThanOrEqual(-0.01);
    expect(hi).toBeLessThanOrEqual(RELIEF_M + 0.01);
    expect(hi - lo).toBeGreaterThan(RELIEF_M * 0.6);
    // Brejo na maior parte, com poças (5–20 %) e ilhotas de capim.
    expect((covers.SWAMP ?? 0) / n).toBeGreaterThan(0.55);
    expect((covers.WATER ?? 0) / n).toBeGreaterThan(0.05);
    expect((covers.WATER ?? 0) / n).toBeLessThan(0.2);
    expect((covers.GRASS ?? 0) / n).toBeGreaterThan(0.03);
  });

  it('3 tocas quentes (r = 8 m) que só o sensor termal enxerga: DEN_A, DEN_B e DEN_C', () => {
    expect(terrain.features).toEqual([
      {
        id: 'DEN_A',
        name: 'Toca A',
        u: 80,
        v: 60,
        radiusM: 8,
        needs: 'PHOTO',
        sensorKind: 'THERMAL',
      },
      {
        id: 'DEN_B',
        name: 'Toca B',
        u: 220,
        v: 150,
        radiusM: 8,
        needs: 'PHOTO',
        sensorKind: 'THERMAL',
      },
      {
        id: 'DEN_C',
        name: 'Toca C',
        u: 150,
        v: 40,
        radiusM: 8,
        needs: 'PHOTO',
        sensorKind: 'THERMAL',
      },
    ]);
    expect(DENS.map((d) => d.id)).toEqual(['DEN_A', 'DEN_B', 'DEN_C']);
    for (const d of terrain.features) {
      expect(d.u).toBeGreaterThan(0);
      expect(d.u).toBeLessThan(lengthM);
      expect(d.v).toBeGreaterThan(0);
      expect(d.v).toBeLessThan(widthM);
    }
  });

  it('no RGB a toca não existe: em volta dela só há brejo, sem água, árvore, muro ou marca', () => {
    for (const d of terrain.features) {
      // Brejo puro num raio de 14 m (a toca é uma mancha quente sem nada visível).
      for (let du = -14; du <= 14; du += 2) {
        for (let dv = -14; dv <= 14; dv += 2) {
          if (Math.hypot(du, dv) >= 14) continue;
          expect(terrain.landCover(d.u + du, d.v + dv), `${d.id} (${du}, ${dv})`).toBe('SWAMP');
        }
      }
      for (const o of terrain.objects) {
        expect(Math.hypot(o.u - d.u, o.v - d.v), `${d.id} × objeto ${o.id}`).toBeGreaterThan(14);
      }
    }
  });

  it('90 árvores mortas, cinzentas e finas, longe das tocas e da calçada', () => {
    expect(trees).toHaveLength(DEAD_TREE_COUNT);
    for (const t of trees) {
      expect(t.widthM).toBeGreaterThanOrEqual(DEAD_TREE_CROWN_M[0]);
      expect(t.widthM).toBeLessThanOrEqual(DEAD_TREE_CROWN_M[1]);
      expect(t.heightM).toBeGreaterThanOrEqual(DEAD_TREE_HEIGHT_M[0]);
      expect(t.heightM).toBeLessThanOrEqual(DEAD_TREE_HEIGHT_M[1]);
      // Cinza: os três canais quase iguais.
      expect(Math.max(...t.color) - Math.min(...t.color)).toBeLessThan(12);
      expect(terrain.distanceToTrack(t.u, t.v)).toBeGreaterThan(t.widthM / 2);
    }
  });

  it('4 ruínas de pedra: muros baixos de 2 a 4 m em volta de um pátio', () => {
    expect(RUINS).toHaveLength(4);
    expect(walls.length).toBeGreaterThanOrEqual(8);
    expect(walls.length).toBeLessThanOrEqual(16);
    for (const w of walls) {
      expect(w.heightM).toBeGreaterThanOrEqual(RUIN_WALL_HEIGHT_M[0]);
      expect(w.heightM).toBeLessThanOrEqual(RUIN_WALL_HEIGHT_M[1]);
      expect(Math.min(w.widthM, w.depthM)).toBeLessThanOrEqual(1);
      // Cada muro pertence a uma ruína (a menos de 8 m do centro dela).
      expect(RUINS.some((r) => Math.hypot(w.u - r.u, w.v - r.v) < 8)).toBe(true);
      expect(Math.max(...w.color) - Math.min(...w.color)).toBeLessThan(12);
    }
    // E todas as quatro ruínas têm ao menos um muro de pé.
    for (const r of RUINS) {
      expect(walls.some((w) => Math.hypot(w.u - r.u, w.v - r.v) < 8)).toBe(true);
    }
  });

  it('só de picape 4x4: o brejo barra o carro e a bicicleta, a calçada de pedra é chão firme', () => {
    const pick = getVehicle('PICKUP_4X4');
    const foot = getVehicle('FOOT_BIKE');
    expect(terrain.roads).toHaveLength(1);
    expect(terrain.roads[0]?.kind).toBe('TRAIL');
    const road = terrain.guaranteedAccessible[0] as { u: number; v: number };
    expect(isAccessible(road.u, road.v, terrain, [pick], { paintMarkers: false })).toEqual({
      ok: true,
    });
    // Um ponto de brejo qualquer, fora da calçada e das tocas: a picape alcança e a pé não.
    let found = false;
    for (let u = 20; u < lengthM && !found; u += 10) {
      for (let v = 20; v < widthM && !found; v += 10) {
        if (terrain.landCover(u, v) !== 'SWAMP' || terrain.distanceToTrack(u, v) < 6) continue;
        if (terrain.slopePct(u, v) > 25) continue;
        expect(isAccessible(u, v, terrain, [pick], { paintMarkers: false }), `${u},${v}`).toEqual({
          ok: true,
        });
        expect(isAccessible(u, v, terrain, [foot], { paintMarkers: false }).reason).toBe('SWAMP');
        found = true;
      }
    }
    expect(found).toBe(true);
  });
});
