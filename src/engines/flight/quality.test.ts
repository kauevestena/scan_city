import { CATALOG, getAircraft } from '@/data/catalog';
import { C00 } from '@/data/contracts';
import { buildFlightPlan } from '@/domain/flightPlanner';
import { neutralModifiers } from '@/domain/modifiers';
import { referenceParams } from '@/test/fixtures/syntheticMission';
import type { LightingId, MissionData, PlanParams } from '@/types';
import { createTerrain } from '@/world/terrain/createTerrain';
import { cameraModel, shearCorners } from './cameraSensor';
import { FlightEngine } from './FlightEngine';
import { makeAlert, MAX_ALERTS, topAlerts } from './hudPublisher';
import { runFrame } from './runFrame';

type Axes = Partial<
  Record<'MOVE_X' | 'MOVE_Y' | 'ALT_UP' | 'ALT_DOWN' | 'TURN_LEFT' | 'TURN_RIGHT', number>
>;

function setup(
  over: Partial<PlanParams> = {},
  axes: Axes = {},
  opts: { aircraft?: 'ATLAS' | 'DRONE_T1' | 'VTOL_T3'; reduce?: boolean } = {},
) {
  const aircraft = opts.aircraft ?? 'ATLAS';
  const sensor =
    aircraft === 'ATLAS' ? 'CAM_PIGEON' : aircraft === 'DRONE_T1' ? 'CAM_20MP_RS' : 'CAM_45MP_FF';
  const lightings: LightingId[] = ['SUN_HIGH', 'OVERCAST', 'GOLDEN_HOUR'];
  const contract = {
    ...C00,
    lightingOptions: lightings,
    wind: { meanMs: 0, gustMs: 0, directionDeg: 0 },
  };
  const params: PlanParams = {
    ...referenceParams(C00),
    aircraftId: aircraft,
    sensorId: sensor,
    ...(aircraft === 'VTOL_T3' ? { lensId: 'LENS_24' as const, heightM: 100, speedMs: 20 } : {}),
    ...over,
  };
  const plan = buildFlightPlan(params, contract, CATALOG);
  const mission = {
    id: 'q',
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
  const e = new FlightEngine({
    mission,
    contract,
    terrain: createTerrain(C00),
    catalog: CATALOG,
    input: { axis: (a) => axes[a] ?? 0 },
    mods: neutralModifiers(),
    ownsRtkKit: false,
    autopilot: false,
    calm: true,
    quality: () => 'LOW',
    reduceFlashes: () => opts.reduce ?? false,
    colors: { primary: '#fff', secondary: '#000' },
    sortie: 0,
    shotOffset: 0,
  });
  return { e, plan };
}
const run = (e: FlightEngine, s: number) => {
  for (let t = 0; t < s; t += 1 / 60) e.update(1 / 60);
};
const ids = (e: FlightEngine) => e.alertList().map((a) => a.id);

describe('fila de alertas (§5.17)', () => {
  it('no máximo 2, ordenados por prioridade', () => {
    const all = [
      makeAlert('RTK_FLOAT'),
      makeAlert('OVERLAP', 55),
      makeAlert('RTH'),
      makeAlert('MOTION_BLUR'),
    ];
    const top = topAlerts(all);
    expect(top).toHaveLength(MAX_ALERTS);
    expect(top.map((a) => a.id)).toEqual(['RTH', 'OVERLAP']);
    expect(makeAlert('CRASH_IMMINENT')).toMatchObject({ priority: 1, level: 'critical' });
    expect(topAlerts([makeAlert('ATLAS_DISTRACTED'), makeAlert('CRASH_IMMINENT')])[0]?.id).toBe(
      'CRASH_IMMINENT',
    );
  });
});

describe('critério 3: velocidade 30 % acima do plano', () => {
  it('p_real fica abaixo do mínimo e aparece "OVERLAP INSUFICIENTE"', () => {
    const plan = buildFlightPlan(referenceParams(C00), C00, CATALOG);
    const faster = Math.min(getAircraft('ATLAS').vMaxMs, plan.params.speedMs * 1.3);
    // MOVE_Y = 0,5 leva de 10 m/s (plano) a 13 m/s (+30 %): lerp(10, 16, 0,5).
    const { e } = setup({ speedMs: plan.params.speedMs }, { MOVE_Y: 0.5 });
    run(e, 22);
    // O Atlas chega a 13 m/s (+30 %), com base fixa pelo intervalo do plano: sobreposição cai.
    expect(e.ac.v).toBeCloseTo(faster, 0);
    expect(e.pRealPct()).toBeLessThan(Math.max(60, 65));
    expect(ids(e)).toContain('OVERLAP');
    expect(e.snapshot().alerts.map((a) => a.id)).toContain('OVERLAP');
  });

  it('velocidade do plano mantida: sem alerta de overlap', () => {
    const { e } = setup();
    run(e, 22);
    expect(ids(e)).not.toContain('OVERLAP');
    expect(e.pRealPct()).toBeGreaterThan(60);
  });
});

describe('critério 6: reduceFlashes', () => {
  it('nenhum overlay branco no disparo; sem a opção, há o flash', () => {
    const fullScreenFills = (reduce: boolean) => {
      const { e } = setup({}, {}, { reduce });
      const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
      e.attach({ ctx, width: 1280, height: 720, dpr: 1 });
      run(e, 4);
      e.manualShot();
      const fills: number[] = [];
      const spy = vi.spyOn(ctx, 'fillRect').mockImplementation((_x, _y, w, h) => {
        if (w === 1280 && h === 720 && String(ctx.fillStyle).startsWith('rgba(255, 255, 255'))
          fills.push(1);
      });
      e.render();
      spy.mockRestore();
      return fills.length;
    };
    expect(fullScreenFills(true)).toBe(0);
    expect(fullScreenFills(false)).toBe(1);
  });
});

describe('disparo manual e blur', () => {
  it('cooldown de 0,3 s; os disparos manuais ficam marcados', () => {
    const { e } = setup();
    run(e, 3);
    expect(e.manualShot()).toBe(true);
    expect(e.manualShot()).toBe(false);
    run(e, 0.31);
    expect(e.manualShot()).toBe(true);
    expect(e.shots.filter((s) => s.manual)).toHaveLength(2);
  });

  it('hora dourada com velocidade alta: "POUCA LUZ" ou "MOTION BLUR"; sol a pino: nenhum', () => {
    const golden = setup({ lighting: 'GOLDEN_HOUR', speedMs: 16, heightM: 20 }, { MOVE_Y: 1 });
    run(golden.e, 12);
    const found = ids(golden.e);
    expect(found.includes('LOW_LIGHT') || found.includes('MOTION_BLUR')).toBe(true);
    const sun = setup({ lighting: 'SUN_HIGH' });
    run(sun.e, 12);
    expect(ids(sun.e)).not.toContain('MOTION_BLUR');
    expect(ids(sun.e)).not.toContain('LOW_LIGHT');
  });
});

describe('rolling shutter', () => {
  it('o skew é registrado nas fotos de câmera com leitura por linha; Atlas (global) tem skew 0', () => {
    const rs = setup({}, {}, { aircraft: 'DRONE_T1' });
    run(rs.e, 8);
    expect(cameraModel(rs.plan, CATALOG).readoutS).toBeGreaterThan(0);
    expect(rs.e.shots.length).toBeGreaterThan(0);
    expect(rs.e.shots.every((s) => s.skewPx > 0)).toBe(true);
    const global = setup();
    run(global.e, 8);
    expect(global.e.shots.every((s) => s.skewPx === 0)).toBe(true);
  });

  it('shearCorners desloca a borda da frente de shearM para o lado', () => {
    const frame = runFrame({
      index: 0,
      pass: 'PRIMARY',
      start: { u: 0, v: 0 },
      end: { u: 100, v: 0 },
      aoiStartS: 0,
      aoiEndS: 100,
      direction: 1,
    });
    const box = [
      { u: 10, v: -5 },
      { u: 10, v: 5 },
      { u: 0, v: 5 },
      { u: 0, v: -5 },
    ];
    const sheared = shearCorners(box, frame, 2);
    expect(sheared[0]).toEqual({ u: 10 + frame.right.u * 2, v: -5 + frame.right.v * 2 });
    expect(sheared[2]).toEqual(box[2]);
    expect(sheared[3]).toEqual(box[3]);
    expect(shearCorners(box, frame, 0)).toEqual(box);
  });
});

describe('queda iminente e velocidade mínima', () => {
  it('AGL < 5 m descendo: alerta crítico; casco 1 também', () => {
    const { e } = setup();
    run(e, 3.5);
    expect(ids(e)).not.toContain('CRASH_IMMINENT');
    e.hull = 1;
    expect(ids(e)).toContain('CRASH_IMMINENT');
    e.hull = 3;
    e.ac = { ...e.ac, alt: e.ac.alt - 70, vz: -2 };
    expect(ids(e)).toContain('CRASH_IMMINENT');
  });

  it('asa fixa no mínimo: "VELOCIDADE MÍNIMA" (stall não modelado)', () => {
    const { e } = setup({}, { MOVE_Y: -1 }, { aircraft: 'VTOL_T3' });
    run(e, 20);
    expect(e.ac.v).toBeCloseTo(getAircraft('VTOL_T3').vMinMs, 1);
    expect(ids(e)).toContain('MIN_SPEED');
  });
});
