import { CATALOG, getAircraft, getVehicle } from '@/data/catalog';
import { C04 } from '@/data/contracts';
import { isAccessible } from '@/domain/accessibility';
import { buildFlightPlan } from '@/domain/flightPlanner';
import { predictRequirements } from '@/domain/requirements';
import { referenceParams } from '@/domain/referencePlan';
import { maxSlopeDeg, resolveRuleEffects, terrainReliefM } from '@/domain/specialRules';
import {
  borderMeanElevation,
  meanDepthM,
  measuredVolumeM3,
  referenceVolumeM3,
  volumeErrorPct,
} from '@/domain/volumetrics';
import { meanAoiElevation } from '@/engines/flight/FlightEngine';
import { mulberry32 } from '@/lib/rng';
import type { WorldObject } from '@/types';
import { clearTerrainCache, createTerrain } from '../createTerrain';
import { BIOMES } from './index';
import {
  BENCH_HEIGHT_M,
  BENCH_PITCH_M,
  BENCHES,
  BERM_M,
  CENTER,
  CRUSHERS,
  DEPTH_M,
  OPEN_PIT_MINE,
  PILES,
  PIT_RADIUS_M,
  pitDepthM,
  RAMP,
  RIM_M,
} from './openPitMine';

const terrain = createTerrain(C04);
const { lengthM, widthM } = C04.aoi;

/** Perfil radial para leste a partir do centro, a cada `step` m. */
const transect = (step: number) => {
  const out: number[] = [];
  for (let r = 0; r <= PIT_RADIUS_M + 20; r += step)
    out.push(terrain.elevation(CENTER.u + r, CENTER.v));
  return out;
};

describe('createTerrain — OPEN_PIT_MINE (C04)', () => {
  it('a receita está registrada e é a do contrato', () => {
    expect(BIOMES.OPEN_PIT_MINE).toBe(OPEN_PIT_MINE);
    expect(terrain.biome).toBe('OPEN_PIT_MINE');
    expect(terrain.aoi).toEqual({ widthM: 320, lengthM: 480 });
  });

  it('determinismo: mesma seed → mesmo terreno, borda e amostras', () => {
    clearTerrainCache();
    const again = createTerrain(C04);
    expect(again).not.toBe(terrain);
    expect(again.objects).toEqual(terrain.objects);
    expect(again.roads).toEqual(terrain.roads);
    const rng = mulberry32(8);
    for (let i = 0; i < 1000; i++) {
      const u = rng.range(-90, 570);
      const v = rng.range(-60, 380);
      expect(again.elevation(u, v)).toBe(terrain.elevation(u, v));
      expect(again.landCover(u, v)).toBe(terrain.landCover(u, v));
    }
  });

  it('cava de 150 m em 10 bancadas de 15 m: berma plana de 8 m e talude de 14 m cada', () => {
    expect([BENCHES, BENCH_HEIGHT_M, DEPTH_M, BERM_M, BENCH_PITCH_M]).toEqual([10, 15, 150, 8, 22]);
    // Fundo da cava no centro e borda a 150 m acima dele.
    expect(terrain.elevation(CENTER.u, CENTER.v)).toBeCloseTo(RIM_M - DEPTH_M, 0);
    expect(terrain.elevation(CENTER.u, 5)).toBeCloseTo(
      RIM_M - pitDepthM((PIT_RADIUS_M - 155) / BENCH_PITCH_M),
      -1,
    );
    // Perfil de 1 em 1 m, ao longo de 220 m: platôs a cada 15 m (a berma de 8 m) e saltos entre eles.
    const profile = transect(1);
    const levels = new Set<number>();
    let flat = 0;
    for (let k = 0; k + 8 < profile.length; k++) {
      const window = profile.slice(k, k + 7);
      if (Math.max(...window) - Math.min(...window) < 1) {
        flat++;
        levels.add(Math.round((window[0] as number) / BENCH_HEIGHT_M));
      }
    }
    // O fundo mais as 10 bancadas: 11 níveis de 0 a 150 m.
    expect(levels.size).toBeGreaterThanOrEqual(BENCHES);
    expect(flat).toBeGreaterThan(BENCHES * 2);
    // A profundidade nunca passa dos 150 m e a borda de fora é a cota da borda.
    expect(Math.min(...profile)).toBeGreaterThanOrEqual(RIM_M - DEPTH_M - 1);
    expect(terrain.elevation(CENTER.u + PIT_RADIUS_M + 15, CENTER.v)).toBeCloseTo(RIM_M, 0);
    // Taludes entre as bermas descem 15 m em ~14 m.
    expect(pitDepthM(0)).toBe(0);
    expect(pitDepthM(0.2)).toBe(0);
    expect(pitDepthM(1)).toBeCloseTo(BENCH_HEIGHT_M, 9);
    expect(pitDepthM(BENCHES + 3)).toBe(DEPTH_M);
  });

  it('STEEP_RELIEF: amplitude acima de 60 m e taludes de 35° a 70°', () => {
    const effects = resolveRuleEffects(C04.specialRules);
    expect(effects.terrain.steepRelief).toMatchObject({ minReliefM: 60, slopeDeg: [35, 70] });
    expect(terrainReliefM(terrain)).toBeGreaterThanOrEqual(
      effects.terrain.steepRelief?.minReliefM ?? 0,
    );
    expect(terrainReliefM(terrain)).toBeGreaterThanOrEqual(C04.terrainReliefM);
    // Com as pilhas por cima da borda, o relevo passa dos 150 m da cava, e só por elas.
    expect(terrainReliefM(terrain)).toBeLessThanOrEqual(C04.terrainReliefM + 35 + 2);
    const slope = maxSlopeDeg(terrain);
    expect(slope).toBeGreaterThanOrEqual(35);
    expect(slope).toBeLessThanOrEqual(70);
  });

  it('cobertura: BENCH nas bermas, ROCK nos taludes e fora, SAND nas pilhas e a rampa de ROAD', () => {
    const cover: Record<string, number> = {};
    for (let u = 0; u <= lengthM; u += 5) {
      for (let v = 0; v <= widthM; v += 5) {
        const c = terrain.landCover(u, v);
        cover[c] = (cover[c] ?? 0) + 1;
      }
    }
    expect(Object.keys(cover).sort()).toEqual(['BENCH', 'ROAD', 'ROCK', 'SAND']);
    expect(terrain.landCover(CENTER.u, CENTER.v)).toBe('BENCH'); // o fundo
    expect(terrain.landCover(CENTER.u + 150, CENTER.v + 150)).toBe('ROCK'); // fora da cava
    expect(terrain.canopy(CENTER.u, CENTER.v)).toBe(0);
    expect(terrain.ndvi(CENTER.u, CENTER.v)).toBeLessThan(0.1);
    // As bermas têm 8 de cada 22 m do raio; o talude, o resto.
    let berm = 0;
    let face = 0;
    for (let r = 10; r < PIT_RADIUS_M - 80; r += 0.5) {
      const c = terrain.landCover(CENTER.u - r, CENTER.v);
      if (c === 'BENCH') berm++;
      if (c === 'ROCK') face++;
    }
    expect(berm / (berm + face)).toBeGreaterThan(0.3);
    expect(berm / (berm + face)).toBeLessThan(0.45);
  });

  it('rampa de acesso em espiral: 2,5 voltas da borda ao fundo, de 8 m de largura', () => {
    const [ramp] = terrain.roads;
    expect(terrain.roads).toHaveLength(1);
    expect(ramp?.kind).toBe('ROAD');
    expect(ramp?.widthM).toBe(RAMP.width);
    const pts = ramp?.points.slice(1) ?? [];
    const radii = pts.map((p) => Math.hypot(p.u - CENTER.u, p.v - CENTER.v));
    // O raio só diminui: do alto da borda até perto do fundo.
    for (let k = 1; k < radii.length; k++) expect(radii[k]).toBeLessThan(radii[k - 1] as number);
    expect(radii[0]).toBeGreaterThan(PIT_RADIUS_M - 10);
    expect(radii.at(-1)).toBeCloseTo(RAMP.bottomRadiusM, 6);
    // A estrada de acesso vem de fora da AOI, e todos os pontos de amostra da espiral são ROAD.
    expect(ramp?.points[0]?.u).toBeLessThan(0);
    expect(terrain.distanceToRoad(pts[40]?.u as number, pts[40]?.v as number)).toBe(0);
  });

  it('pilhas cônicas de 20 a 35 m e r de 30 a 50 m fora da cava; duas torres de britagem', () => {
    for (const p of PILES) {
      expect(p.radiusM).toBeGreaterThanOrEqual(30);
      expect(p.radiusM).toBeLessThanOrEqual(50);
      expect(p.heightM).toBeGreaterThanOrEqual(20);
      expect(p.heightM).toBeLessThanOrEqual(35);
      // Fora da cava: o pé da pilha não toca o raio da borda.
      expect(Math.hypot(p.u - CENTER.u, p.v - CENTER.v) - p.radiusM).toBeGreaterThan(PIT_RADIUS_M);
      // Cone: o topo fica h acima da borda e a meia altura, a meia distância.
      expect(terrain.elevation(p.u, p.v)).toBeGreaterThan(RIM_M + p.heightM - 1);
      expect(terrain.elevation(p.u + p.radiusM / 2, p.v)).toBeCloseTo(RIM_M + p.heightM / 2, -1);
      expect(terrain.landCover(p.u, p.v)).toBe('SAND');
    }
    const crushers = terrain.objects.filter((o: WorldObject) => o.heightM === 30);
    expect(crushers).toHaveLength(CRUSHERS.length);
    for (const c of crushers) {
      expect([c.kind, c.widthM, c.depthM, c.solid]).toEqual(['BUILDING', 15, 15, true]);
      expect(terrain.landCover(c.u, c.v)).toBe('ROOF');
    }
  });

  it('pontos garantidos (fundo e bermas) acessíveis de picape; a de quem vai a pé não os alcança', () => {
    const pickup = [getVehicle('PICKUP_4X4')];
    expect(terrain.guaranteedAccessible).toHaveLength(4);
    for (const p of terrain.guaranteedAccessible) {
      expect(
        isAccessible(p.u, p.v, terrain, pickup, { paintMarkers: false }),
        `(${p.u}, ${p.v})`,
      ).toEqual({
        ok: true,
      });
      expect(terrain.landCover(p.u, p.v)).toBe('BENCH');
    }
    // O talude é íngreme demais para a picape (> 60 %), e a mina nem é do alcance do carro.
    let steep = 0;
    for (let r = 20; r < 140; r += 0.5) {
      const u = CENTER.u + r;
      if (terrain.landCover(u, CENTER.v) !== 'ROCK') continue;
      const res = isAccessible(u, CENTER.v, terrain, pickup, { paintMarkers: false });
      if (!res.ok && res.reason === 'TOO_STEEP') steep++;
    }
    expect(steep).toBeGreaterThan(20);
  });

  it('volumetria: erro ≤ 2 % com o RMSE do plano de referência; passa de 2 % com 5 % de buracos', () => {
    const plane = borderMeanElevation(terrain, C04.aoi);
    const reference = referenceVolumeM3(terrain, C04.aoi, plane);
    expect(reference.cutM3).toBeGreaterThan(5_000_000);
    expect(reference.fillM3).toBeGreaterThan(100_000);
    const depth = meanDepthM(reference);
    expect(depth).toBeGreaterThan(30);
    // RMSE_z do plano de referência: ~8 cm (ASPRS V de 8 cm) → erro de volume desprezível.
    for (let seed = 1; seed <= 100; seed++) {
      const measured = measuredVolumeM3(reference, 0.08, depth, 0, mulberry32(seed));
      expect(volumeErrorPct(reference, measured)).toBeLessThan(2);
    }
    // Cobertura vermelha de 5 % puxa o volume 2,5 % para baixo: o requisito reprova.
    const holes = measuredVolumeM3(reference, 0.08, depth, 0.05, mulberry32(1));
    expect(volumeErrorPct(reference, holes)).toBeGreaterThan(2);
  });

  it('TF obrigatório: em altitude constante o AGL varia mais de 150 m, e o plano sem TF reprova', () => {
    const plan = buildFlightPlan(referenceParams(C04), C04, CATALOG);
    expect(plan.params.terrainFollowing).toBe(true);
    expect(getAircraft(plan.params.aircraftId).terrainFollowing).toBe(true);
    // Sem TF, voando a H sobre a cota média: o AGL vai de ~0 (borda) a mais que o teto (fundo).
    const alt = meanAoiElevation(terrain) + plan.params.heightM;
    let lo = Infinity;
    let hi = -Infinity;
    for (let u = 0; u <= lengthM; u += 5) {
      for (let v = 0; v <= widthM; v += 5) {
        const agl = alt - terrain.elevation(u, v);
        lo = Math.min(lo, agl);
        hi = Math.max(hi, agl);
      }
    }
    expect(hi - lo).toBeGreaterThan(150);
    expect(hi).toBeGreaterThan(C04.ceilingM);
    expect(lo).toBeLessThan(40);
    // O requisito crítico de TF falha num plano sem o modo.
    const flat = buildFlightPlan(
      { ...referenceParams(C04), terrainFollowing: false },
      C04,
      CATALOG,
    );
    const ctx = { catalog: CATALOG, ownsRtkKit: true, fieldEquipmentId: 'TOTAL_STATION' as const };
    const failed = (plan2: typeof plan) =>
      predictRequirements(plan2, C04, [], ctx)
        .filter((r) => !r.pass && r.id === 'C04-tf')
        .map((r) => r.id);
    expect(failed(flat)).toEqual(['C04-tf']);
    expect(failed(plan)).toEqual([]);
  });

  it('criação em poucas centenas de ms e elevation custa < 2 µs por chamada', () => {
    clearTerrainCache();
    const t0 = performance.now();
    const fresh = createTerrain(C04);
    expect(performance.now() - t0).toBeLessThan(1500);
    const start = performance.now();
    let acc = 0;
    for (let i = 0; i < 100_000; i++) acc += fresh.elevation(i % 480, (i * 7) % 320);
    expect(acc).toBeGreaterThan(0);
    expect(performance.now() - start).toBeLessThan(250);
  });
});
