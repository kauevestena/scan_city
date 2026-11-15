import { CATALOG, getAircraft } from '@/data/catalog';
import { C00 } from '@/data/contracts';
import { buildFlightPlan } from '@/domain/flightPlanner';
import { neutralModifiers } from '@/domain/modifiers';
import { obliqueFootprint, verticalFovRad } from '@/domain/photogrammetry';
import { referenceParams } from '@/test/fixtures/syntheticMission';
import type { MissionData, PlanParams } from '@/types';
import { createTerrain } from '@/world/terrain/createTerrain';
import { cameraModel, obliqueCorners } from './cameraSensor';
import { FlightEngine, type SortieResult } from './FlightEngine';
import type { FlightPhase } from './hudPublisher';
import { runFrame } from './runFrame';

function setup(
  aircraft: 'DRONE_T1' | 'DRONE_T2',
  over: Partial<PlanParams> = {},
  terrainOver: (t: ReturnType<typeof createTerrain>) => ReturnType<typeof createTerrain> = (t) => t,
) {
  const sensor = aircraft === 'DRONE_T1' ? 'CAM_20MP_RS' : 'CAM_45MP_FF';
  const params: PlanParams = {
    ...referenceParams(C00),
    aircraftId: aircraft,
    sensorId: sensor,
    speedMs: getAircraft(aircraft).vCruiseMs,
    ...(aircraft === 'DRONE_T2' ? { lensId: 'LENS_24' as const } : {}),
    ...over,
  };
  const contract = { ...C00, wind: { meanMs: 0, gustMs: 0, directionDeg: 0 } };
  const plan = buildFlightPlan(params, contract, CATALOG);
  const mission = {
    id: 'm',
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
  const results: SortieResult[] = [];
  const phases: FlightPhase[] = [];
  const terrain = terrainOver(createTerrain(C00));
  const e = new FlightEngine({
    mission,
    contract,
    terrain,
    catalog: CATALOG,
    input: { axis: () => 0 },
    mods: neutralModifiers(),
    ownsRtkKit: false,
    autopilot: true,
    quality: () => 'LOW',
    reduceFlashes: () => false,
    colors: { primary: '#fff', secondary: '#000' },
    sortie: 0,
    shotOffset: 0,
    onSortieEnd: (r) => results.push(r),
    onPhase: (p) => phases.push(p),
  });
  return { e, plan, results, phases, terrain };
}

describe('Terrain Following (§5.6)', () => {
  it('numa rampa de 10 %, mantém o AGL a ≤ 15 % do alvo; sem TF, o AGL varia muito', () => {
    const ramp = (t: ReturnType<typeof createTerrain>) =>
      ({ ...t, elevation: (u: number) => 0.1 * u, surface: (u: number) => 0.1 * u }) as typeof t;
    const run = (terrainFollowing: boolean) => {
      const { e, terrain } = setup('DRONE_T2', { terrainFollowing, heightM: 60 }, ramp);
      let worst = 0;
      for (let t = 0; t < 60; t += 1 / 60) {
        e.update(1 / 60);
        if (e.phase !== 'RUN' || t < 4) continue;
        const p = e.snapshot().minimap.pos;
        const agl = e.ac.alt - terrain.elevation(p.u, p.v);
        worst = Math.max(worst, Math.abs(agl - 60) / 60);
      }
      return worst;
    };
    expect(run(true)).toBeLessThanOrEqual(0.15);
    expect(run(false)).toBeGreaterThan(0.15);
  });
});

describe('Malha cruzada (§5.7)', () => {
  it('as linhas cruzadas voam depois das primárias, perpendiculares, e todas completam', () => {
    const { e, plan, results, phases } = setup('DRONE_T1', { crossGrid: true });
    const primary = plan.lines.filter((l) => l.pass === 'PRIMARY').length;
    const cross = plan.lines.filter((l) => l.pass === 'CROSS').length;
    expect(cross).toBeGreaterThan(0);
    for (let t = 0; t < 900 && e.phase !== 'POST_FLIGHT'; t += 1 / 60) e.update(1 / 60);
    expect(results[0]?.completedLines).toEqual(plan.lines.map((l) => l.index));
    // Os índices dos disparos nunca voltam: primárias primeiro.
    const order = e.shots.map((s) => s.lineIndex);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order.some((i) => i >= primary)).toBe(true);
    expect(phases.filter((p) => p === 'TURN')).toHaveLength(plan.lines.length - 1);
    // Rumo das cruzadas perpendicular ao das primárias.
    const h0 = e.shots.find((s) => s.lineIndex === 0)!.headingRad;
    const hc = e.shots.find((s) => s.lineIndex === primary)!.headingRad;
    expect(Math.abs(Math.cos(h0 - hc))).toBeLessThan(0.01);
  });
});

describe('Oblíqua (§5.8, domain-math §2.8)', () => {
  it('os disparos registram tiltDeg e a pegada é um trapézio deslocado à frente', () => {
    const { e, plan } = setup('DRONE_T1', { obliqueDeg: 45 });
    for (let t = 0; t < 8; t += 1 / 60) e.update(1 / 60);
    expect(e.shots.length).toBeGreaterThan(0);
    expect(new Set(e.shots.map((s) => s.tiltDeg))).toEqual(new Set([45]));

    const cam = cameraModel(plan, CATALOG);
    const frame = runFrame(plan.lines[0]!);
    const corners = obliqueCorners(frame, 100, 0, 60, 45, cam);
    const vFov = 2 * Math.atan(cam.sensorHeightM / (2 * cam.focalM));
    const o = obliqueFootprint(60, (45 * Math.PI) / 180, cam.sensorWidthM, cam.focalM, vFov);
    // Linha para +u: os cantos ficam à frente (u maior) e o centro deslocado de centerOffsetM.
    const meanU = corners.reduce((s, c) => s + c.u, 0) / 4;
    expect(meanU - (frame.start.u + 100)).toBeCloseTo(o.centerOffsetM, 0);
    expect(corners[0]!.u).toBeGreaterThan(corners[3]!.u);
    const far = Math.abs(corners[1]!.v - corners[0]!.v);
    const near = Math.abs(corners[2]!.v - corners[3]!.v);
    expect(far).toBeGreaterThan(near);
    expect(
      verticalFovRad(
        { sensorHeightMm: cam.sensorHeightM * 1000, sensorWidthMm: 0 } as never,
        cam.focalM,
      ),
    ).toBeGreaterThan(0);
  });
});
