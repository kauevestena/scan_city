import { CATALOG } from '@/data/catalog';
import { R07 } from '@/data/contracts/rifts';
import { buildFlightPlan } from '@/domain/flightPlanner';
import { referenceParams } from '@/domain/referencePlan';
import { RULE_PARAMS } from '@/domain/specialRules';
import { hitsObject } from '@/engines/flight/collision';
import { insideSearchlight, searchlightSpot } from '@/engines/flight/fieldElements';
import { meanAoiElevation } from '@/engines/flight/FlightEngine';
import { clearTerrainCache, createTerrain } from '../createTerrain';
import { BIOMES } from './index';
import {
  FENCE_HEIGHT_M,
  FENCE_POST_SPACING_M,
  HANGAR_HEIGHT_M,
  HANGARS,
  RELIEF_M,
  RIFT_POLAR_BASE,
  SEARCHLIGHT_PERIOD_S,
  SEARCHLIGHT_RADIUS_M,
  SHEDS,
  TOWER,
  TOWERS,
  WALKER,
  WALKER_AT,
  WALKER_FEATURE,
  YARD,
} from './riftPolarBase';

const terrain = createTerrain(R07);
const { lengthM, widthM } = R07.aoi;
const ground = (u: number, v: number) => terrain.elevation(u, v);
const walker = terrain.objects.filter((o) => o.kind === 'GIANT_WALKER');
const towers = terrain.objects.filter((o) => o.kind === 'TOWER');
const buildings = terrain.objects.filter((o) => o.kind === 'BUILDING');
const posts = terrain.objects.filter((o) => o.kind === 'POLE');
const fences = terrain.objects.filter((o) => o.kind === 'WIRE');
const lights = terrain.zones.filter((z) => z.kind === 'SEARCHLIGHT');

describe('createTerrain — RIFT_POLAR_BASE (R07)', () => {
  it('a receita está registrada e é a do contrato', () => {
    expect(BIOMES.RIFT_POLAR_BASE).toBe(RIFT_POLAR_BASE);
    expect(terrain.biome).toBe('RIFT_POLAR_BASE');
    expect(terrain.aoi).toEqual({ widthM: 240, lengthM: 300 });
  });

  it('determinismo: mesma seed → mesmos objetos, zonas e amostras', () => {
    clearTerrainCache();
    const again = createTerrain(R07);
    expect(again).not.toBe(terrain);
    expect(again.objects).toEqual(terrain.objects);
    expect(again.zones).toEqual(terrain.zones);
    expect(again.features).toEqual(terrain.features);
    for (let u = -50; u <= 350; u += 31) {
      for (let v = -40; v <= 250; v += 23) {
        expect(again.elevation(u, v)).toBe(terrain.elevation(u, v));
        expect(again.landCover(u, v)).toBe(terrain.landCover(u, v));
      }
    }
  });

  it('planície nevada de até 15 m, com o complexo nivelado no meio', () => {
    let lo = Infinity;
    let hi = -Infinity;
    for (let u = 0; u <= lengthM; u += 3) {
      for (let v = 0; v <= widthM; v += 3) {
        const e = ground(u, v);
        lo = Math.min(lo, e);
        hi = Math.max(hi, e);
      }
    }
    expect(lo).toBeGreaterThanOrEqual(-0.01);
    expect(hi).toBeLessThanOrEqual(RELIEF_M + 0.01);
    expect(hi - lo).toBeGreaterThan(RELIEF_M * 0.3);
    // O pátio todo é plano: a mesma cota do centro.
    const e0 = ground(WALKER_AT.u, WALKER_AT.v);
    for (let u = YARD.uMin; u <= YARD.uMax; u += 10) {
      for (let v = YARD.vMin; v <= YARD.vMax; v += 10) {
        expect(ground(u, v), `${u},${v}`).toBeCloseTo(e0, 6);
      }
    }
    // Neve em tudo, menos os telhados e a estrada.
    const covers = new Set<string>();
    for (let u = 0; u <= lengthM; u += 4) {
      for (let v = 0; v <= widthM; v += 4) covers.add(terrain.landCover(u, v));
    }
    expect([...covers].every((c) => ['SNOW', 'ROOF', 'ROAD'].includes(c))).toBe(true);
    expect(covers.has('SNOW')).toBe(true);
    const [r, g, b] = terrain.palette.cover.SNOW;
    expect(Math.min(r, g, b)).toBeGreaterThan(220);
  });

  it('o andador bípede gigante, de 25 m, parado no centro do pátio, e o alvo WALKER (r = 15 m)', () => {
    expect(walker).toHaveLength(1);
    const w = walker[0];
    expect([w?.u, w?.v, w?.heightM]).toEqual([150, 120, 25]);
    expect(w?.widthM).toBe(WALKER.widthM);
    expect(w?.solid).toBe(true);
    expect(terrain.features).toEqual([WALKER_FEATURE]);
    expect(terrain.features[0]).toMatchObject({
      id: 'WALKER',
      u: 150,
      v: 120,
      radiusM: 15,
      needs: 'PHOTO',
    });
    // Sem `sensorKind`: qualquer câmera o fotografa.
    expect(terrain.features[0]?.sensorKind).toBeUndefined();
    // É sólido por dentro e livre por cima.
    const y0 = ground(150, 120);
    const at = (alt: number) => ({ u: 150, v: 120, alt, radiusM: 0.5 });
    expect(hitsObject(at(y0 + 12), w as NonNullable<typeof w>, 0, ground)).toBe(true);
    expect(hitsObject(at(y0 + 27), w as NonNullable<typeof w>, 0, ground)).toBe(false);
  });

  it('4 torres de vigia de 20 m nos cantos do pátio, cada uma com um holofote de r = 15 m', () => {
    expect(towers).toHaveLength(4);
    expect(towers.map((t) => [t.u, t.v]).sort()).toEqual(TOWERS.map((t) => [t.u, t.v]).sort());
    for (const t of towers) {
      expect(t.heightM).toBe(TOWER.heightM);
      expect(t.solid).toBe(true);
    }
    expect(lights).toHaveLength(4);
    for (const z of lights) {
      if (z.kind !== 'SEARCHLIGHT') continue;
      expect(z.radiusM).toBe(SEARCHLIGHT_RADIUS_M);
      expect(z.periodS).toBeGreaterThanOrEqual(SEARCHLIGHT_PERIOD_S[0]);
      expect(z.periodS).toBeLessThanOrEqual(SEARCHLIGHT_PERIOD_S[1]);
      expect(towers.some((t) => t.u === z.u && t.v === z.v)).toBe(true);
    }
    // Períodos de 6 a 9 s, não todos iguais.
    expect(
      new Set(lights.map((z) => (z.kind === 'SEARCHLIGHT' ? z.periodS : 0))).size,
    ).toBeGreaterThan(1);
  });

  it('cada holofote é uma mancha pequena (35 % do raio) que gira em arco: atravessá-la a 9 m/s leva menos de 1,5 s', () => {
    for (const z of lights) {
      if (z.kind !== 'SEARCHLIGHT') continue;
      const spot = searchlightSpot(z, 0);
      expect(spot.r).toBeCloseTo(0.35 * SEARCHLIGHT_RADIUS_M, 9);
      // A mancha gira a 7,5 m da torre e nunca passa de 7,5 m + r do poste.
      for (let t = 0; t < z.periodS; t += 0.25) {
        const s = searchlightSpot(z, t);
        expect(Math.hypot(s.u - z.u, s.v - z.v)).toBeCloseTo(0.5 * SEARCHLIGHT_RADIUS_M, 9);
      }
      // A corda do círculo: 2r / 9 m/s fica abaixo dos 1,5 s da detecção do T2.
      expect((2 * spot.r) / 9).toBeLessThan(RULE_PARAMS.searchlights.detectS);
      expect(insideSearchlight([z], spot.u, spot.v, 0)).toBe(true);
      expect(insideSearchlight([z], z.u + 40, z.v + 40, 0)).toBe(false);
    }
  });

  it('hangares de 36 × 22 × 10 m fora do pátio, 2 galpões dentro e a cerca de 2,5 m em volta do pátio', () => {
    const big = buildings.filter((b) => b.widthM === 36);
    expect(big).toHaveLength(HANGARS.length);
    for (const h of big) {
      expect(h.heightM).toBe(HANGAR_HEIGHT_M);
      const insideYard = h.u > YARD.uMin && h.u < YARD.uMax && h.v > YARD.vMin && h.v < YARD.vMax;
      expect(insideYard).toBe(false);
    }
    const sheds = buildings.filter((b) => b.widthM === 12);
    expect(sheds).toHaveLength(SHEDS.length);
    for (const s of sheds) {
      expect(s.u).toBeGreaterThan(YARD.uMin);
      expect(s.u).toBeLessThan(YARD.uMax);
      expect(s.v).toBeGreaterThan(YARD.vMin);
      expect(s.v).toBeLessThan(YARD.vMax);
    }
    // Perímetro do pátio: 440 m de cerca, um fio por trecho de 10 m e um poste por vão.
    const perimeter = 2 * (YARD.uMax - YARD.uMin + (YARD.vMax - YARD.vMin));
    expect(fences).toHaveLength(perimeter / FENCE_POST_SPACING_M);
    for (const f of fences) {
      expect(f.baseM).toBe(FENCE_HEIGHT_M);
      expect(Math.hypot((f.u2 ?? f.u) - f.u, (f.v2 ?? f.v) - f.v)).toBeCloseTo(
        FENCE_POST_SPACING_M,
        6,
      );
    }
    expect(posts).toHaveLength(fences.length - 4);
    // Os fios correm sobre o perímetro do pátio.
    for (const f of fences) {
      const onEdge =
        [YARD.uMin, YARD.uMax].some(
          (u) => Math.abs(f.u - u) < 1e-6 && Math.abs((f.u2 ?? f.u) - u) < 1e-6,
        ) ||
        [YARD.vMin, YARD.vMax].some(
          (v) => Math.abs(f.v - v) < 1e-6 && Math.abs((f.v2 ?? f.v) - v) < 1e-6,
        );
      expect(onEdge).toBe(true);
    }
  });

  it('uma estrada de serviço em anel contorna o complexo e outra chega pelo oeste, ambas de 8 m', () => {
    expect(terrain.roads).toHaveLength(2);
    expect(terrain.roads.every((r) => r.kind === 'ROAD' && r.widthM === 8)).toBe(true);
    expect(terrain.landCover(150, 20)).toBe('ROAD');
    expect(terrain.landCover(20, 120)).toBe('ROAD');
    expect(terrain.guaranteedAccessible).toEqual([{ u: 30, v: 120 }]);
  });

  it('o plano de referência (H = 110 m) passa por cima de tudo no complexo', () => {
    const planAlt = meanAoiElevation(terrain) + R07.referencePlan.heightM;
    for (const o of terrain.objects) {
      const top = ground(o.u, o.v) + (o.baseM ?? 0) + o.heightM;
      expect(top, `objeto ${o.id}`).toBeLessThan(planAlt - 30);
    }
    const plan = buildFlightPlan(referenceParams(R07), R07, CATALOG);
    expect(plan.stats.nLines).toBe(6);
  });
});
