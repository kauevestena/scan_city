import { CATALOG, getAircraft, getVehicle } from '@/data/catalog';
import { C06 } from '@/data/contracts';
import { isAccessible, snapToAccessible } from '@/domain/accessibility';
import { buildFlightPlan } from '@/domain/flightPlanner';
import {
  buildCoverage,
  createCoverageGrid,
  excludedCellsWhere,
  isShotValid,
} from '@/domain/coverage';
import { referenceParams, syntheticMission } from '@/domain/referencePlan';
import { resolveRuleEffects } from '@/domain/specialRules';
import { cameraModel, recordShot } from '@/engines/flight/cameraSensor';
import { windAboveTolerance } from '@/engines/flight/environment';
import { runFrame } from '@/engines/flight/runFrame';
import { mulberry32 } from '@/lib/rng';
import type { LightingId, WorldObject } from '@/types';
import { clearTerrainCache, createTerrain } from '../createTerrain';
import { BIOMES } from './index';
import {
  CHANNEL,
  channelDistance,
  channelHalfWidth,
  channelU,
  CLIFF_M,
  COASTAL_ESTUARY,
  LIGHTHOUSE,
  ROAD_V_M,
  SEA_FLOOR_M,
  SHORE_V_M,
  shoreV,
} from './coastalEstuary';

const terrain = createTerrain(C06);
const { lengthM, widthM } = C06.aoi;
const of = (kind: WorldObject['kind']) => terrain.objects.filter((o) => o.kind === kind);
const grid = (step: number, f: (u: number, v: number) => void) => {
  for (let u = 0; u <= lengthM; u += step) for (let v = 0; v <= widthM; v += step) f(u, v);
};

describe('createTerrain — COASTAL_ESTUARY (C06)', () => {
  it('a receita está registrada e é a do contrato', () => {
    expect(BIOMES.COASTAL_ESTUARY).toBe(COASTAL_ESTUARY);
    expect(terrain.biome).toBe('COASTAL_ESTUARY');
    expect(terrain.aoi).toEqual({ widthM: 300, lengthM: 800 });
  });

  it('determinismo: mesma seed → mesmo litoral, objetos e amostras', () => {
    clearTerrainCache();
    const again = createTerrain(C06);
    expect(again).not.toBe(terrain);
    expect(again.objects).toEqual(terrain.objects);
    expect(again.roads).toEqual(terrain.roads);
    const rng = mulberry32(3);
    for (let i = 0; i < 1000; i++) {
      const u = rng.range(-150, 950);
      const v = rng.range(-55, 355);
      expect(again.elevation(u, v)).toBe(terrain.elevation(u, v));
      expect(again.landCover(u, v)).toBe(terrain.landCover(u, v));
    }
    expect(createTerrain({ ...C06, id: 'C06-OUTRA', seed: 1 }).objects).not.toEqual(
      terrain.objects,
    );
  });

  it('mar a −2 m depois da costa (v > 170), ocupando ~40 % da AOI; relevo de dunas até ~20 m', () => {
    let water = 0;
    let total = 0;
    let max = -Infinity;
    let min = Infinity;
    grid(5, (u, v) => {
      total++;
      const e = terrain.elevation(u, v);
      max = Math.max(max, e);
      min = Math.min(min, e);
      if (terrain.landCover(u, v) === 'WATER') water++;
      if (v > shoreV(u)) {
        expect(terrain.landCover(u, v)).toBe('WATER');
        expect(e).toBeCloseTo(v >= shoreV(u) + 6 ? SEA_FLOOR_M : e, 9);
      }
    });
    expect(water / total).toBeGreaterThan(0.38);
    expect(water / total).toBeLessThan(0.46);
    expect(min).toBe(SEA_FLOOR_M);
    expect(max).toBeGreaterThan(15);
    expect(max).toBeLessThanOrEqual(C06.terrainReliefM + 2);
  });

  it('faixa de terra garantida em v ∈ [0, 170]: a costa nunca recua dela e só o canal tem água', () => {
    for (let u = -160; u <= 960; u += 10) {
      expect(shoreV(u)).toBeGreaterThanOrEqual(SHORE_V_M);
      expect(shoreV(u)).toBeLessThanOrEqual(SHORE_V_M + 6);
    }
    let strip = 0;
    let wet = 0;
    for (let u = 0; u <= lengthM; u += 4) {
      for (let v = 0; v <= SHORE_V_M; v += 4) {
        strip++;
        if (terrain.landCover(u, v) !== 'WATER') continue;
        wet++;
        // Água na faixa de terra é o canal, e nada mais.
        expect(channelDistance(u, v), `(${u}, ${v})`).toBeLessThan(
          channelHalfWidth(v, shoreV(u)) + 1e-9,
        );
      }
    }
    expect(wet / strip).toBeLessThan(0.04);
    // Os pontos de referência do contrato (e os garantidos) são terra acessível a pé.
    const foot = [getVehicle('FOOT_BIKE')];
    const points = [
      ...C06.referencePlan.gcps,
      ...C06.referencePlan.cps,
      ...terrain.guaranteedAccessible,
    ];
    for (const p of points) {
      expect(p.v).toBeLessThan(SHORE_V_M);
      expect(
        isAccessible(p.u, p.v, terrain, foot, { paintMarkers: false }),
        `(${p.u}, ${p.v})`,
      ).toEqual({
        ok: true,
      });
    }
  });

  it('cobertura: areia na praia, rocha na falésia baixa, restinga, manguezal de dossel 0,7 e água', () => {
    const seen = new Set<string>();
    grid(4, (u, v) => seen.add(terrain.landCover(u, v)));
    expect([...seen].sort()).toEqual(['FOREST', 'GRASS', 'ROAD', 'ROCK', 'SAND', 'WATER']);
    // A praia (areia) vem logo antes da água; a falésia baixa, atrás dela.
    const u = 100;
    const shore = shoreV(u);
    expect(terrain.landCover(u, shore - 6)).toBe('SAND');
    expect(terrain.landCover(u, shore - 20)).toBe('ROCK');
    const cliff = terrain.elevation(u, shore - 26) - terrain.elevation(u, shore - 16);
    expect(cliff).toBeGreaterThan(CLIFF_M - 2);
    expect(cliff).toBeLessThan(CLIFF_M + 1);
    // O mangue só nasce junto ao canal, com dossel de 0,7, e ali o GCP não vale.
    let mangrove = 0;
    grid(2, (x, y) => {
      if (terrain.landCover(x, y) !== 'FOREST') return;
      mangrove++;
      expect(terrain.canopy(x, y)).toBeGreaterThanOrEqual(0.7);
      expect(channelDistance(x, y)).toBeLessThan(
        channelHalfWidth(y, shoreV(x)) + CHANNEL.mangroveBandM + 1e-9,
      );
    });
    expect(mangrove).toBeGreaterThan(100);
    expect(terrain.ndvi(100, 40)).toBeGreaterThanOrEqual(0);
    expect(terrain.ndvi(300, 250)).toBe(-0.3);
  });

  it('canal sinuoso: serpenteia por mais de 50 m, se abre na foz e termina antes da estrada', () => {
    const us = [];
    for (let v = CHANNEL.endV; v <= SHORE_V_M; v += 2) us.push(channelU(v));
    expect(Math.max(...us) - Math.min(...us)).toBeGreaterThan(50);
    const wide = (v: number) => channelHalfWidth(v, shoreV(channelU(v)));
    expect(wide(CHANNEL.endV - 12)).toBe(0);
    expect(wide(CHANNEL.endV + 4)).toBeGreaterThan(CHANNEL.inlandHalfM - 1);
    expect(wide(SHORE_V_M)).toBeGreaterThan(wide(CHANNEL.endV + 40) + 4);
    // O eixo é água e, no fundo, o leito fica a −2 m.
    for (const v of [120, 140, 160]) {
      expect(terrain.landCover(channelU(v), v)).toBe('WATER');
      expect(terrain.elevation(channelU(v), v)).toBeLessThan(-1.5);
    }
    // O canal acaba antes da estrada: a estrada é terra firme em todo o comprimento.
    for (let u = 0; u <= lengthM; u += 10) {
      expect(terrain.landCover(u, ROAD_V_M + 0)).not.toBe('WATER');
    }
    // Sem degrau na ponta do canal: o terreno varia suave ao longo do eixo.
    for (let v = CHANNEL.endV - 80; v < CHANNEL.endV + 60; v += 1) {
      const du = Math.abs(
        terrain.elevation(channelU(v) + 30, v + 1) - terrain.elevation(channelU(v) + 30, v),
      );
      expect(du, `v = ${v}`).toBeLessThan(3);
    }
  });

  it('estrada de terra e trilha na praia: toda a terra da faixa fica a ≤ 150 m de uma via', () => {
    expect(terrain.roads.map((r) => r.kind)).toEqual(['ROAD', 'TRAIL', 'ROAD']);
    let worst = 0;
    for (let u = 0; u <= lengthM; u += 20) {
      for (let v = 0; v <= SHORE_V_M; v += 10) {
        worst = Math.max(worst, terrain.distanceToTrack(u, v));
      }
    }
    expect(worst).toBeLessThanOrEqual(150);
    // Os GCPs de referência a pé e de carro (só estradas) também alcançam.
    const car = getVehicle('COMPACT_CAR');
    for (const p of C06.referencePlan.gcps) {
      expect(terrain.distanceToRoad(p.u, p.v)).toBeLessThanOrEqual(car.gcpReachM);
    }
  });

  it('dunas de até ~30 % de declive (o resto é falésia e margem de canal)', () => {
    let slope = 0;
    grid(5, (u, v) => {
      const s = shoreV(u);
      const away = channelDistance(u, v) > channelHalfWidth(v, s) + 90;
      if (v < s - 30 && away) slope = Math.max(slope, terrain.slopePct(u, v));
    });
    expect(slope).toBeLessThan(35);
  });

  it('farol de 25 m na duna e 14 barcos não sólidos sobre a água', () => {
    const [tower] = of('TOWER') as [WorldObject];
    expect(of('TOWER')).toHaveLength(1);
    expect([tower.u, tower.v, tower.heightM]).toEqual([LIGHTHOUSE.u, LIGHTHOUSE.v, 25]);
    expect(tower.solid).toBe(true);
    expect(terrain.landCover(tower.u, tower.v)).not.toBe('WATER');
    const boats = of('CUBE_BLOCK');
    expect(boats).toHaveLength(14);
    for (const b of boats) {
      expect(b.solid).toBe(false);
      expect(terrain.landCover(b.u, b.v)).toBe('WATER');
    }
    // Árvores do mangue e da restinga, nenhuma na água, na estrada ou no farol.
    const trees = of('TREE');
    expect(trees.length).toBeGreaterThan(100);
    for (const t of trees) {
      expect(terrain.landCover(t.u, t.v)).not.toBe('WATER');
      expect(Math.abs(t.v - ROAD_V_M)).toBeGreaterThan(3);
    }
  });

  it('água fora da cobertura: ~43 % das células saem do cálculo, e a verde conta só a terra', () => {
    const covGrid = createCoverageGrid(C06.aoi);
    const excluded = excludedCellsWhere(covGrid, (u, v) => terrain.landCover(u, v) === 'WATER');
    expect(excluded.length / covGrid.counts.length).toBeGreaterThan(0.38);
    expect(excluded.length / covGrid.counts.length).toBeLessThan(0.46);
    const mission = syntheticMission(C06, terrain, CATALOG);
    const plan = mission.plan;
    const { camera, focalM } = {
      camera: CATALOG.sensors.find((s) => s.id === 'CAM_45MP_FF')!,
      focalM: 0.024,
    };
    const opts = {
      aircraftKind: getAircraft(plan.params.aircraftId).kind,
      sensor: camera as never,
      focalM,
      rules: { sensorKind: 'RGB' as const, specularWater: true },
    };
    const withExclusion = buildCoverage(mission.shots, C06.aoi, {
      ...opts,
      excludedCells: excluded,
    });
    expect(withExclusion.excludedCells).toHaveLength(excluded.length);
    expect(withExclusion.green + withExclusion.yellow + withExclusion.red).toBeCloseTo(1, 9);
    const without = buildCoverage(mission.shots, C06.aoi, { ...opts, excludedCells: [] });
    expect(without.excludedCells).toHaveLength(0);
    // Frações sobre as células de terra são independentes do mar (denominador diferente).
    expect(withExclusion.counts).toEqual(without.counts);
  });

  it('com SUN_HIGH as fotos sobre a água ficam inválidas; com OVERCAST valem', () => {
    const fx = resolveRuleEffects(C06.specialRules);
    expect(fx.coverage.specularWater).toBe(true);
    const plan = buildFlightPlan(referenceParams(C06), C06, CATALOG);
    const camera = cameraModel(plan, CATALOG);
    const shotAt = (lineIndex: number, lighting: LightingId) => {
      const frame = runFrame(plan.lines[lineIndex]!);
      return recordShot({
        index: 0,
        tS: 0,
        sortie: 0,
        lineIndex,
        frame,
        s: frame.aoiStartS + 400,
        x: 0,
        altM: 110 + 8,
        speedMs: 12,
        crabRad: 0,
        tiltDeg: 0,
        lighting,
        rtk: 'FIX',
        manual: false,
        camera,
        terrain,
      });
    };
    const rules = { sensorKind: 'RGB' as const, specularWater: fx.coverage.specularWater };
    const lastLine = plan.lines.length - 1; // a última linha voa sobre o mar
    const sea = shotAt(lastLine, 'SUN_HIGH');
    expect(sea.overWater).toBe(true);
    expect(isShotValid(sea, rules)).toBe(false);
    expect(isShotValid(shotAt(lastLine, 'OVERCAST'), rules)).toBe(true);
    expect(isShotValid(shotAt(lastLine, 'GOLDEN_HOUR'), rules)).toBe(true);
    // Sobre a terra, o sol alto não atrapalha.
    const land = shotAt(0, 'SUN_HIGH');
    expect(land.overWater).toBe(false);
    expect(isShotValid(land, rules)).toBe(true);
  });

  it('vento cruzado de 9 m/s com rajada de 4: passa da tolerância do T1 e do próprio T2', () => {
    expect(resolveRuleEffects(C06.specialRules).flight.strongWind?.minMeanMs).toBeLessThanOrEqual(
      C06.wind.meanMs,
    );
    expect(windAboveTolerance(C06.wind, getAircraft('DRONE_T2'))).toBe(true);
    expect(windAboveTolerance(C06.wind, getAircraft('DRONE_T1'))).toBe(true);
    expect(windAboveTolerance(C06.wind, getAircraft('VTOL_T3'))).toBe(false);
  });

  it('snapToAccessible acha terra perto de um ponto no mar; elevation custa < 2 µs', () => {
    const foot = [getVehicle('FOOT_BIKE')];
    const snapped = snapToAccessible(
      { u: 400, v: 190 },
      terrain,
      foot,
      { paintMarkers: false },
      60,
    );
    expect(snapped).not.toBeNull();
    expect(snapped?.v as number).toBeLessThan(shoreV(snapped?.u as number));
    const start = performance.now();
    let acc = 0;
    for (let i = 0; i < 100_000; i++) acc += terrain.elevation(i % 800, (i * 7) % 300);
    expect(acc).not.toBe(0);
    expect(performance.now() - start).toBeLessThan(200);
  });
});
