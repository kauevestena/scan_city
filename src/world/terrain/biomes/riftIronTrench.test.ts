import { CATALOG, getVehicle } from '@/data/catalog';
import { R10 } from '@/data/contracts/rifts';
import { isAccessible } from '@/domain/accessibility';
import { buildFlightPlan } from '@/domain/flightPlanner';
import { referenceParams } from '@/domain/referencePlan';
import { resolveRuleEffects, RULE_PARAMS } from '@/domain/specialRules';
import { hitsObject, isBeamOn } from '@/engines/flight/collision';
import { meanAoiElevation } from '@/engines/flight/FlightEngine';
import { clearTerrainCache, createTerrain } from '../createTerrain';
import { trenchElevation } from '../ruleGenerators';
import { BIOMES } from './index';
import {
  BEACON,
  CENTER_V,
  HATCH_AT,
  HATCH_FEATURE,
  HATCH_RADIUS_M,
  HATCH_SIZE_M,
  inTrench,
  PANEL_M,
  RIFT_IRON_TRENCH,
  SEAM_M,
  SERVICE_TRAIL_V,
  SERVICE_TRAIL_WIDTH_M,
  TOWER,
  TOWER_NORTH_V,
  TOWER_SOUTH_V,
  TOWER_US,
  TRENCH_DEPTH_M,
  TRENCH_WIDTH_M,
  WALL_BAND_M,
} from './riftIronTrench';

const terrain = createTerrain(R10);
const { lengthM, widthM } = R10.aoi;
const towers = terrain.objects.filter((o) => o.kind === 'TOWER');
const beacons = terrain.objects.filter((o) => o.kind === 'ENERGY_BEAM');
const hatches = terrain.objects.filter((o) => o.kind === 'PIPE');
const ground = (u: number, v: number) => terrain.elevation(u, v);

describe('createTerrain — RIFT_IRON_TRENCH (R10)', () => {
  it('a receita está registrada e é a do contrato', () => {
    expect(BIOMES.RIFT_IRON_TRENCH).toBe(RIFT_IRON_TRENCH);
    expect(terrain.biome).toBe('RIFT_IRON_TRENCH');
    expect(terrain.aoi).toEqual({ widthM: 120, lengthM: 900 });
  });

  it('determinismo: mesma seed → mesmos objetos, cobertura e cota', () => {
    clearTerrainCache();
    const again = createTerrain(R10);
    expect(again).not.toBe(terrain);
    expect(again.objects).toEqual(terrain.objects);
    expect(again.features).toEqual(terrain.features);
    for (let u = -170; u <= 1070; u += 53) {
      for (let v = -20; v <= 140; v += 7) {
        expect(again.elevation(u, v)).toBe(terrain.elevation(u, v));
        expect(again.landCover(u, v)).toBe(terrain.landCover(u, v));
      }
    }
  });

  it('NARROW_TRENCH: plano a 0 m e trincheira de 50 m de largura e 40 m de fundo, de ponta a ponta, com paredes verticais', () => {
    expect(RULE_PARAMS.trench).toEqual({ widthM: 50, depthM: 40 });
    expect(resolveRuleEffects(R10.specialRules).terrain.narrowTrench).toEqual(RULE_PARAMS.trench);
    expect([TRENCH_WIDTH_M, TRENCH_DEPTH_M, CENTER_V]).toEqual([50, 40, 60]);
    expect(R10.terrainReliefM).toBe(TRENCH_DEPTH_M);
    for (let u = -170; u <= 1070; u += 31) {
      for (let v = -24; v <= 144; v += 1.5) {
        const expected = trenchElevation(v, CENTER_V);
        expect(ground(u, v)).toBe(expected);
        expect(expected).toBe(inTrench(v) ? -TRENCH_DEPTH_M : 0);
      }
      // A parede é vertical: 40 m de queda entre dois pontos a 0,2 m um do outro.
      expect(
        ground(u, CENTER_V - TRENCH_WIDTH_M / 2 - 0.1) -
          ground(u, CENTER_V - TRENCH_WIDTH_M / 2 + 0.1),
      ).toBe(40);
      expect(
        ground(u, CENTER_V + TRENCH_WIDTH_M / 2 + 0.1) -
          ground(u, CENTER_V + TRENCH_WIDTH_M / 2 - 0.1),
      ).toBe(40);
    }
    // A trincheira ocupa 50 dos 120 m da largura.
    let inside = 0;
    for (let v = 0; v < widthM; v += 0.5) if (inTrench(v)) inside += 0.5;
    expect(inside).toBeGreaterThanOrEqual(49);
    expect(inside).toBeLessThanOrEqual(50);
  });

  it('painéis cinza em grade: emendas de 1 m a cada 15 m e uma faixa escura de 1 m junto de cada parede', () => {
    expect([PANEL_M, SEAM_M, WALL_BAND_M]).toEqual([15, 1, 1]);
    expect(terrain.landCover(7.5, 100)).toBe('METAL');
    expect(terrain.landCover(7.5, 67.5)).toBe('METAL'); // fundo da trincheira
    for (const u of [0.4, 15.4, 300.2, 885.5]) expect(terrain.landCover(u, 100)).toBe('ROCK');
    for (const v of [0.4, 15.4, 105.2]) expect(terrain.landCover(7.5, v)).toBe('ROCK');
    // Junto das paredes (a de v = 35 e a de v = 85), dos dois lados: 1 m escuro.
    for (const wall of [CENTER_V - 25, CENTER_V + 25]) {
      for (const d of [-0.6, 0.6]) expect(terrain.landCover(8.2, wall + d)).toBe('ROCK');
      for (const d of [-3, 3]) expect(terrain.landCover(8.2, wall + d)).toBe('METAL');
    }
    expect(terrain.ndvi(100, 100)).toBeLessThan(0.1);
    expect(terrain.canopy(100, 100)).toBe(0);
    // Painéis claros e emendas escuras.
    const [mr, mg] = terrain.palette.cover.METAL;
    const [rr, rg] = terrain.palette.cover.ROCK;
    expect(mr + mg).toBeGreaterThan(rr + rg);
  });
});

describe('RIFT_IRON_TRENCH: torres, luzes e escotilha', () => {
  it('12 torres de 20 m, seis de cada lado da trincheira, fora dela', () => {
    expect(towers).toHaveLength(12);
    expect(towers.map((t) => t.u).sort((a, b) => a - b)).toEqual(
      [...TOWER_US, ...TOWER_US].sort((a, b) => a - b),
    );
    for (const t of towers) {
      expect([t.widthM, t.depthM, t.heightM]).toEqual([TOWER.widthM, TOWER.widthM, TOWER.heightM]);
      expect(t.solid).toBe(true);
      expect([TOWER_SOUTH_V, TOWER_NORTH_V]).toContain(t.v);
      // O pé da torre fica no plano, a ≥ 3 m da borda da trincheira.
      expect(inTrench(t.v)).toBe(false);
      expect(Math.abs(t.v - CENTER_V) - t.depthM / 2 - TRENCH_WIDTH_M / 2).toBeGreaterThanOrEqual(
        3,
      );
      expect(ground(t.u, t.v)).toBe(0);
    }
    expect(towers.filter((t) => t.v === TOWER_SOUTH_V)).toHaveLength(6);
    expect(towers.filter((t) => t.v === TOWER_NORTH_V)).toHaveLength(6);
  });

  it('cada torre tem uma luz de navegação que pisca (0,6 s acesa, 0,6 s apagada): vermelha ao sul e verde ao norte, sem colisão', () => {
    expect(beacons).toHaveLength(12);
    const phases = new Set<number>();
    for (const b of beacons) {
      const tower = towers.find((t) => t.u === b.u && t.v === b.v);
      expect(tower, `torre em ${b.u},${b.v}`).toBeDefined();
      expect([b.widthM, b.heightM, b.baseM]).toEqual([
        BEACON.widthM,
        BEACON.heightM,
        TOWER.heightM,
      ]);
      expect(b.color).toEqual(b.v === TOWER_SOUTH_V ? [239, 68, 68] : [34, 197, 94]);
      expect(b.solid).toBe(false);
      expect(b.activePeriod).toMatchObject({ onS: 0.6, offS: 0.6 });
      phases.add(b.activePeriod?.phase ?? -1);
      // Metade do tempo acesa.
      let on = 0;
      for (let k = 0; k < 1200; k++) if (isBeamOn(b, k * 0.01)) on++;
      expect(on / 1200).toBeCloseTo(0.5, 1);
      // A luz não fere: nem acesa, no meio dela.
      const body = { u: b.u, v: b.v, alt: TOWER.heightM + 1.5, radiusM: 0.8 };
      for (let k = 0; k < 24; k++) expect(hitsObject(body, b, k * 0.1, ground)).toBe(false);
    }
    expect(phases.size).toBe(12);
    expect(new Set(beacons.map((b) => b.color.join(','))).size).toBe(2);
  });

  it('a escotilha de exaustão de 2 m fica no fundo, em (860, 60), e o alvo EXHAUST_PORT (r = 2 m) só se captura com LiDAR', () => {
    expect([HATCH_AT.u, HATCH_AT.v, HATCH_SIZE_M, HATCH_RADIUS_M]).toEqual([860, 60, 2, 2]);
    expect(terrain.features).toEqual([HATCH_FEATURE]);
    expect(HATCH_FEATURE).toMatchObject({
      id: 'EXHAUST_PORT',
      u: 860,
      v: 60,
      radiusM: 2,
      needs: 'LIDAR',
    });
    expect(HATCH_FEATURE.sensorKind).toBeUndefined();
    expect(inTrench(HATCH_AT.v)).toBe(true);
    expect(ground(HATCH_AT.u, HATCH_AT.v)).toBe(-TRENCH_DEPTH_M);
    expect(hatches).toHaveLength(1);
    const [h] = hatches;
    expect([h?.u, h?.v, h?.widthM, h?.solid]).toEqual([860, 60, 2, false]);
    // Longe das torres (a mais próxima, a ≥ 25 m).
    for (const t of towers)
      expect(Math.hypot(t.u - HATCH_AT.u, t.v - HATCH_AT.v)).toBeGreaterThan(25);
    expect(terrain.guaranteedAccessible).toEqual([]);
  });

  it('o plano de referência (H = 60 m) passa por cima das torres: o T2 voa a ~44 m e as torres têm 20 m', () => {
    const planAlt = meanAoiElevation(terrain) + R10.referencePlan.heightM;
    expect(planAlt).toBeGreaterThan(TOWER.heightM + 20);
    const plan = buildFlightPlan(referenceParams(R10), R10, CATALOG);
    expect(plan.stats.nLines).toBe(4);
    // No fundo da trincheira o AGL passa dos 80 m: a densidade do LiDAR cai ali, e é isso que o requisito de 100 pts/m² vigia.
    expect(planAlt - ground(HATCH_AT.u, HATCH_AT.v)).toBeGreaterThan(R10.referencePlan.heightM);
    expect(lengthM).toBeGreaterThan(HATCH_AT.u);
  });
});

describe('RIFT_IRON_TRENCH: trilha de manutenção', () => {
  it('uma trilha de 3 m pela borda sul: a pé se chega a qualquer ponto da AOI (≤ 150 m) e um GCP vale no plano', () => {
    expect(terrain.roads).toHaveLength(1);
    expect(terrain.roads[0]).toMatchObject({ kind: 'TRAIL', widthM: SERVICE_TRAIL_WIDTH_M });
    expect(terrain.distanceToTrack(450, SERVICE_TRAIL_V)).toBeLessThan(0.5);
    let far = 0;
    for (let u = 0; u <= lengthM; u += 15) {
      for (let v = 0; v <= widthM; v += 5) far = Math.max(far, terrain.distanceToTrack(u, v));
    }
    expect(far).toBeLessThan(getVehicle('FOOT_BIKE').gcpReachM);
    const foot = getVehicle('FOOT_BIKE');
    const rules = { paintMarkers: false };
    // No plano (e no fundo, plano) o ponto é válido; na água e no telhado não há nada aqui.
    expect(isAccessible(300, 100, terrain, [foot], rules)).toEqual({ ok: true });
    expect(isAccessible(300, 20, terrain, [foot], rules)).toEqual({ ok: true });
    expect(isAccessible(300, 60, terrain, [foot], rules)).toEqual({ ok: true });
    // A faixa de 2 m da parede (queda de 40 m) passa do declive de 30 % da bicicleta.
    expect(isAccessible(300, 35, terrain, [foot], rules)).toEqual({
      ok: false,
      reason: 'TOO_STEEP',
    });
  });
});

describe('RIFT_IRON_TRENCH: custo', () => {
  it('criação em poucos ms e a cota custa menos de 1 µs por chamada', () => {
    clearTerrainCache();
    const t0 = performance.now();
    const fresh = createTerrain(R10);
    expect(performance.now() - t0).toBeLessThan(500);
    const start = performance.now();
    let acc = 0;
    for (let i = 0; i < 100_000; i++) acc += fresh.elevation(i % 900, (i * 7) % 120);
    expect(acc).toBeLessThan(0);
    expect(performance.now() - start).toBeLessThan(250);
  });
});
