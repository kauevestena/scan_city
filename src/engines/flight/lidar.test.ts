import { CATALOG, getAircraft } from '@/data/catalog';
import { C00 } from '@/data/contracts';
import { lidarDensity, lidarDensityWithOverlap } from '@/domain/lidar';
import { buildFlightPlan } from '@/domain/flightPlanner';
import { neutralModifiers } from '@/domain/modifiers';
import { referenceParams } from '@/test/fixtures/syntheticMission';
import { resetGameStore } from '@/test/resetStore';
import { useGameStore } from '@/state/store';
import type { MissionData, PlanParams } from '@/types';
import { createTerrain } from '@/world/terrain/createTerrain';
import { FlightEngine, type SortieResult } from './FlightEngine';
import { LidarSensor, MAX_SAMPLES, scanAngle, SAMPLES_PER_STEP } from './lidarSensor';
import { runFrame } from './runFrame';

const POD = CATALOG.payloads[0]!;
const terrain = createTerrain(C00);

function lidarMission(over: Partial<PlanParams> = {}): MissionData {
  const params: PlanParams = {
    ...referenceParams(C00),
    aircraftId: 'DRONE_T2',
    sensorId: 'POD_LIDAR',
    primarySensor: 'LIDAR',
    lensId: undefined as never,
    heightM: 60,
    speedMs: 8,
    sideOverlapPct: 60,
    ...over,
  };
  delete (params as { lensId?: unknown }).lensId;
  const plan = buildFlightPlan(params, C00, CATALOG);
  return {
    id: 'L1',
    contractId: 'C00',
    createdAt: 0,
    rivalAdjustment: 1,
    isReplay: false,
    plan,
    groundPoints: [],
    fieldEquipmentId: 'TOTAL_STATION',
    minigames: {},
    atlasCalibrated: false,
    sorties: [],
    completedLines: [],
    shots: [],
    events: { collisions: 0, crashes: 0, detected: false, featuresCaptured: [], ringsCollected: 0 },
    status: 'IN_FLIGHT',
  } as unknown as MissionData;
}

function engine(
  mission = lidarMission(),
  over: Partial<ConstructorParameters<typeof FlightEngine>[0]> = {},
) {
  const results: SortieResult[] = [];
  const hints: string[] = [];
  const sensors: string[] = [];
  const e = new FlightEngine({
    mission,
    contract: C00,
    terrain,
    catalog: CATALOG,
    input: { axis: () => 0 },
    mods: neutralModifiers(),
    ownsRtkKit: false,
    autopilot: true,
    calm: true,
    quality: () => 'LOW',
    reduceFlashes: () => false,
    colors: { primary: '#fff', secondary: '#000' },
    sortie: 0,
    shotOffset: 0,
    onSortieEnd: (r) => results.push(r),
    onHint: (t) => hints.push(t),
    onSensorChange: (s) => sensors.push(s),
    ...over,
  });
  return { e, results, hints, sensors };
}
const fly = (e: FlightEngine) => {
  for (let t = 0; t < 900 && e.phase !== 'POST_FLIGHT'; t += 1 / 60) e.update(1 / 60);
};

describe('LidarSensor (§5.9)', () => {
  it('ângulo de varredura senoidal em ±FOV/2', () => {
    const fov = (70 * Math.PI) / 180;
    expect(scanAngle(fov, 2, 0)).toBe(0);
    expect(scanAngle(fov, 2, 0.125)).toBeCloseTo(fov / 2, 9);
    expect(scanAngle(fov, 2, 0.375)).toBeCloseTo(-fov / 2, 9);
  });

  it('sweep reparte PRR·dt pulsos e soma na célula; fora da AOI nada entra', () => {
    const s = new LidarSensor(POD, terrain, C00.aoi);
    const frame = runFrame({
      index: 0,
      pass: 'PRIMARY',
      start: { u: -30, v: 80 },
      end: { u: 270, v: 80 },
      aoiStartS: 30,
      aoiEndS: 270,
      direction: 1,
    });
    const inside = s.sweep({ frame, s0: 100, s1: 100.1, x: 0, aglM: 5, dtS: 0.0125 });
    expect(inside).toBeGreaterThan(0);
    expect(inside).toBeLessThanOrEqual(POD.prrHz * 0.0125 + 1e-6);
    expect(s.grid.pulses.reduce((a, b) => a + b, 0)).toBeCloseTo(inside, 6);
    const batch = s.drainBatch();
    expect(batch.cells.length).toBeGreaterThan(0);
    expect(batch.samples).toHaveLength(SAMPLES_PER_STEP);
    expect(s.drainBatch().cells).toEqual([]);
    // Antes do início da AOI (lead-in), os pulsos caem fora da grade.
    expect(s.sweep({ frame, s0: 0, s1: 0.1, x: 0, aglM: 5, dtS: 0.0125 })).toBe(0);
  });

  it('as amostras param em 50.000', () => {
    const s = new LidarSensor(POD, terrain, C00.aoi);
    const frame = runFrame({
      index: 0,
      pass: 'PRIMARY',
      start: { u: 0, v: 80 },
      end: { u: 240, v: 80 },
      aoiStartS: 0,
      aoiEndS: 240,
      direction: 1,
    });
    for (let i = 0; i < 9000 && s.samples.length < MAX_SAMPLES; i++)
      s.sweep({ frame, s0: 50, s1: 50.1, x: 0, aglM: 30, dtS: 1 / 60 });
    for (let i = 0; i < 200; i++) s.sweep({ frame, s0: 50, s1: 50.1, x: 0, aglM: 30, dtS: 1 / 60 });
    expect(s.samples).toHaveLength(MAX_SAMPLES);
  });

  it('densidade do HUD = lidarDensity(); a de solo cai com o dossel', () => {
    const s = new LidarSensor(POD, terrain, C00.aoi);
    const fov = (POD.fovDeg * Math.PI) / 180;
    const h = s.hud(8, 60, 0);
    expect(h.density).toBeCloseTo(lidarDensity(POD.prrHz, 8, 60, fov), 9);
    expect(h.ground).toBeCloseTo(h.density, 9);
    expect(s.hud(8, 60, 0.9).ground).toBeLessThan(h.density * 0.3);
  });
});

describe('FlightEngine com o Pod LiDAR (§5.10, critério 4)', () => {
  it('alterna RGB ↔ LiDAR com cooldown de 0,5 s; no LiDAR os disparos param e a densidade aparece', () => {
    const { e, sensors } = engine(lidarMission({ primarySensor: 'RGB' }), { autopilot: false });
    for (let t = 0; t < 4; t += 1 / 60) e.update(1 / 60);
    expect(e.activeSensor).toBe('RGB');
    const photos = e.shots.length;
    expect(photos).toBeGreaterThan(0);
    expect(e.toggleSensor()).toBe('TOGGLED');
    expect(e.toggleSensor()).toBe('COOLDOWN');
    expect(e.activeSensor).toBe('LIDAR');
    expect(sensors).toEqual(['LIDAR']);
    for (let t = 0; t < 3; t += 1 / 60) e.update(1 / 60);
    // Sem disparos automáticos no LiDAR, e a densidade mostrada é a de `lidarDensity()`.
    expect(e.shots).toHaveLength(photos);
    const snap = e.snapshot();
    const fov = (POD.fovDeg * Math.PI) / 180;
    expect(snap.activeSensor).toBe('LIDAR');
    expect(snap.lidarDensity).toBeCloseTo(lidarDensity(POD.prrHz, e.ac.v, snap.aglM, fov), 6);
    expect(e.lidar?.grid.pulses.some((p) => p > 0)).toBe(true);
    // E volta: a câmera dispara de novo.
    for (let t = 0; t < 0.6; t += 1 / 60) e.update(1 / 60);
    expect(e.toggleSensor()).toBe('TOGGLED');
    for (let t = 0; t < 3; t += 1 / 60) e.update(1 / 60);
    expect(e.shots.length).toBeGreaterThan(photos);
  });

  it('LiDAR ativo desliga o disparo manual com a dica "Ative a câmera [Tab]"', () => {
    const { e, hints } = engine(lidarMission(), { autopilot: false });
    for (let t = 0; t < 3; t += 1 / 60) e.update(1 / 60);
    expect(e.activeSensor).toBe('LIDAR');
    expect(e.manualShot()).toBe(false);
    expect(hints).toEqual(['Ative a câmera [Tab]']);
  });

  it('sem o Pod, alternar é um no-op com "Sem LiDAR a bordo"', () => {
    const atlas = {
      ...lidarMission(),
      plan: buildFlightPlan(referenceParams(C00), C00, CATALOG),
    } as MissionData;
    const { e, hints } = engine(atlas, { autopilot: false });
    for (let t = 0; t < 3; t += 1 / 60) e.update(1 / 60);
    expect(e.lidar).toBeNull();
    expect(e.toggleSensor()).toBe('NO_POD');
    expect(hints).toEqual(['Sem LiDAR a bordo']);
    expect(e.activeSensor).toBe('RGB');
    expect(getAircraft('ATLAS').compatibleSensors).not.toContain('POD_LIDAR');
  });

  it('voo de autopilot: a densidade na grade (centro da AOI) bate com lidarDensityWithOverlap ± 10 %', () => {
    const mission = lidarMission();
    const { e, results } = engine(mission);
    fly(e);
    expect(results[0]?.outcome).toBe('COMPLETED');
    expect(results[0]?.completedLines.length).toBe(mission.plan.lines.length);
    const grid = e.lidar!.grid;
    const fov = (POD.fovDeg * Math.PI) / 180;
    const expected = lidarDensityWithOverlap(POD.prrHz, 8, 60, fov, 60);
    // Bloco central da AOI (evita as bordas, cobertas por menos faixas).
    let sum = 0;
    let n = 0;
    for (let row = 24; row < 40; row++) {
      for (let col = 24; col < 40; col++) {
        sum += (grid.pulses[row * grid.cols + col] as number) / grid.cellAreaM2;
        n++;
      }
    }
    expect(sum / n).toBeGreaterThan(expected * 0.9);
    expect(sum / n).toBeLessThan(expected * 1.1);
    // O lote da surtida vai no resultado.
    expect(results[0]?.lidar?.cells.length).toBeGreaterThan(1000);
  }, 60000);
});

describe('mergeLidar e descarte na queda (store)', () => {
  const get = () => useGameStore.getState();
  beforeEach(() => resetGameStore());

  it('surtida concluída funde o lote na missão; queda descarta', () => {
    get().startMission('C00', 1);
    const batch = {
      cells: [[5, 100, 40, 60]] as Array<[number, number, number, number]>,
      samples: [{ u: 1, v: 2, z: 3, ret: 'GROUND' as const }],
    };
    get().endSortie({ outcome: 'CRASH', durationS: 5, completedLines: [], lidar: batch });
    expect(get().mission.active?.lidar).toBeUndefined();
    get().endSortie({ outcome: 'RTH', durationS: 5, completedLines: [0], lidar: batch });
    get().mergeLidar(batch);
    const lidar = get().mission.active?.lidar;
    expect(lidar?.grid.cols).toBe(64);
    expect(lidar?.grid.pulses[5]).toBe(200);
    expect(lidar?.grid.firstAbove[5]).toBe(80);
    expect(lidar?.grid.ground[5]).toBe(120);
    expect(lidar?.samples).toHaveLength(2);
    expect(lidar?.grid.cellAreaM2).toBeCloseTo((240 / 64) * (160 / 64), 9);
  });

  it('as amostras ficam limitadas a 50.000', () => {
    get().startMission('C00', 1);
    const many = Array.from({ length: 30_000 }, () => ({
      u: 0,
      v: 0,
      z: 0,
      ret: 'GROUND' as const,
    }));
    get().mergeLidar({ cells: [], samples: many });
    get().mergeLidar({ cells: [], samples: many });
    expect(get().mission.active?.lidar?.samples).toHaveLength(50_000);
    useGameStore.setState((s) => ({ mission: { ...s.mission, active: null } }));
    get().mergeLidar({ cells: [], samples: many });
    expect(get().mission.active).toBeNull();
  });
});
