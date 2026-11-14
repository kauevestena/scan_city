import { CATALOG, getAircraft } from '@/data/catalog';
import { C00 } from '@/data/contracts';
import { thermalLiftMs } from '@/domain/flightPhysics';
import { buildFlightPlan } from '@/domain/flightPlanner';
import { neutralModifiers } from '@/domain/modifiers';
import { referenceParams } from '@/test/fixtures/syntheticMission';
import type { Contract, MissionData, RtkStatus, SpecialZone } from '@/types';
import { createTerrain } from '@/world/terrain/createTerrain';
import { rtkStatusAt } from './cameraSensor';
import {
  driftMultiplier,
  emActive,
  emDisturbance,
  EM_LATERAL_MS,
  windAboveTolerance,
} from './environment';
import { FlightEngine } from './FlightEngine';

const T1 = getAircraft('DRONE_T1');
const T2 = getAircraft('DRONE_T2');

describe('vento e EM (puros)', () => {
  it('acima da tolerância (mean + gust): deriva dobra', () => {
    const wind = { meanMs: 6, gustMs: 3, directionDeg: 0 };
    expect(windAboveTolerance(wind, T1)).toBe(true);
    expect(driftMultiplier(wind, T1)).toBe(2);
    expect(driftMultiplier(wind, T2)).toBe(1);
    expect(windAboveTolerance({ meanMs: 6, gustMs: 2, directionDeg: 0 }, T1)).toBe(false);
  });

  it('EM age em quem não é imune: o Atlas é imune', () => {
    expect(emActive(['EM_INTERFERENCE'], T1)).toBe(true);
    expect(emActive(['EM_INTERFERENCE'], getAircraft('ATLAS'))).toBe(false);
    expect(emActive([], T1)).toBe(false);
  });

  it('ruído de ±0,8 m/s lateral e ±3° de rumo', () => {
    const d = emDisturbance(1, () => 1);
    expect(d.lateralMs).toBe(EM_LATERAL_MS);
    expect(d.headingRad).toBeCloseTo((3 * Math.PI) / 180, 9);
    expect(emDisturbance(1, () => -1).lateralMs).toBe(-EM_LATERAL_MS);
  });

  it('térmicas somam lift (× efeito das skills; metade sem sol a pino)', () => {
    const zones: SpecialZone[] = [
      { kind: 'THERMAL', u: 0, v: 0, radiusM: 40, liftMs: 6 },
      { kind: 'THERMAL', u: 10, v: 0, radiusM: 40, liftMs: 6 },
    ];
    const one = thermalLiftMs(zones.slice(0, 1), 0, 0, 'SUN_HIGH', 1);
    expect(one).toBe(6);
    expect(thermalLiftMs(zones, 0, 0, 'SUN_HIGH', 1)).toBeGreaterThan(one);
    expect(thermalLiftMs(zones.slice(0, 1), 0, 0, 'OVERCAST', 1)).toBe(3);
    expect(thermalLiftMs(zones.slice(0, 1), 0, 0, 'SUN_HIGH', 1.5)).toBe(9);
  });
});

describe('rtkStatusAt com zonas de teste', () => {
  const canyon: SpecialZone[] = [{ kind: 'RTK_CANYON', uMin: 50, uMax: 100, vMin: 0, vMax: 40 }];
  it('FIX com RTK e kit; FLOAT no cânion; NONE sem RTK ou sem kit', () => {
    expect(rtkStatusAt(true, true, canyon, { u: 10, v: 10 })).toBe('FIX');
    expect(rtkStatusAt(true, true, canyon, { u: 60, v: 10 })).toBe('FLOAT');
    expect(rtkStatusAt(false, true, canyon, { u: 60, v: 10 })).toBe('NONE');
    expect(rtkStatusAt(true, false, canyon, { u: 60, v: 10 })).toBe('NONE');
  });
});

/** Missão do C00 com o DRONE_T2 (RTK) e o terreno/contrato adaptados. */
function setup(
  over: {
    zones?: SpecialZone[];
    rules?: Contract['specialRules'];
    wind?: Contract['wind'];
    aircraft?: 'ATLAS' | 'DRONE_T2' | 'DRONE_T1';
    kit?: boolean;
  } = {},
) {
  const aircraft = over.aircraft ?? 'DRONE_T2';
  const sensor =
    aircraft === 'ATLAS' ? 'CAM_PIGEON' : aircraft === 'DRONE_T1' ? 'CAM_20MP_RS' : 'CAM_45MP_FF';
  const contract: Contract = {
    ...C00,
    specialRules: over.rules ?? [],
    wind: over.wind ?? C00.wind,
  };
  const params = {
    ...referenceParams(C00),
    aircraftId: aircraft,
    sensorId: sensor,
    ...(aircraft === 'DRONE_T2' ? { lensId: 'LENS_24' as const } : {}),
    speedMs: getAircraft(aircraft).vCruiseMs,
  };
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
  } as MissionData;
  const base = createTerrain(C00);
  const rtk: RtkStatus[] = [];
  const e = new FlightEngine({
    mission,
    contract,
    terrain: { ...base, zones: over.zones ?? [] } as typeof base,
    catalog: CATALOG,
    input: { axis: () => 0 },
    mods: neutralModifiers(),
    ownsRtkKit: over.kit ?? true,
    autopilot: false,
    quality: () => 'LOW',
    reduceFlashes: () => false,
    colors: { primary: '#fff', secondary: '#000' },
    sortie: 0,
    shotOffset: 0,
    onRtkChange: (s) => rtk.push(s),
  });
  return { e, rtk };
}

const run = (e: FlightEngine, s: number) => {
  for (let t = 0; t < s; t += 1 / 60) e.update(1 / 60);
};

describe('FlightEngine — vento, térmicas, EM e RTK (§5.13)', () => {
  it('deriva proporcional ao driftFactor × windDrift, e dobrada acima da tolerância', () => {
    // Vento de 0° (do norte, para +v) sobre uma linha para +u: o cruzado é o vento inteiro.
    const mild = setup({ aircraft: 'DRONE_T1', wind: { meanMs: 3, gustMs: 0, directionDeg: 0 } });
    const strong = setup({
      aircraft: 'DRONE_T1',
      wind: { meanMs: 8, gustMs: 2, directionDeg: 0 },
    });
    run(mild.e, 6);
    run(strong.e, 6);
    expect(Math.abs(strong.e.ac.x)).toBeGreaterThan(Math.abs(mild.e.ac.x) * 4);
    expect(strong.e.alerts().map((a) => a.id)).toContain('WIND_LIMIT');
    expect(mild.e.alerts().map((a) => a.id)).not.toContain('WIND_LIMIT');
    const snap = strong.e.snapshot();
    expect(Math.abs(snap.windCrossMs)).toBeGreaterThan(3);
    expect(Math.abs(snap.crabDeg)).toBeGreaterThan(0);
  });

  it('térmica sob a rota empurra a aeronave para cima', () => {
    const calm = { meanMs: 0, gustMs: 0, directionDeg: 0 };
    const none = setup({ wind: calm });
    const hot = setup({
      wind: calm,
      zones: [{ kind: 'THERMAL', u: -1000, v: -1000, radiusM: 5000, liftMs: 3 }],
    });
    run(none.e, 2.6);
    run(hot.e, 2.6);
    run(none.e, 1);
    run(hot.e, 1);
    expect(hot.e.ac.alt).toBeGreaterThan(none.e.ac.alt + 1);
  });

  it('EM: tremor lateral nos não imunes; o Atlas fica imune', () => {
    const calm = { meanMs: 0, gustMs: 0, directionDeg: 0 };
    const t2 = setup({ rules: ['EM_INTERFERENCE'], wind: calm });
    const atlas = setup({ aircraft: 'ATLAS', rules: ['EM_INTERFERENCE'], wind: calm });
    run(t2.e, 8);
    run(atlas.e, 8);
    expect(Math.abs(t2.e.ac.x)).toBeGreaterThan(0.05);
    expect(atlas.e.ac.x).toBe(0);
    expect(t2.e.snapshot().emGlitch).toBe(true);
    expect(atlas.e.snapshot().emGlitch).toBe(false);
  });

  it('RTK: fotos FIX; dentro do cânion, FLOAT, com callback e alerta; sem kit, NONE', () => {
    const calm = { meanMs: 0, gustMs: 0, directionDeg: 0 };
    const canyon: SpecialZone[] = [{ kind: 'RTK_CANYON', uMin: 40, uMax: 90, vMin: -50, vMax: 50 }];
    const { e, rtk } = setup({ zones: canyon, wind: calm });
    run(e, 14);
    const status = new Set(e.shots.map((s) => s.rtk));
    expect(status).toEqual(new Set(['FIX', 'FLOAT']));
    expect(rtk).toContain('FLOAT');
    expect(rtk[0]).toBe('FIX');
    const noKit = setup({ kit: false, wind: calm });
    run(noKit.e, 8);
    expect(new Set(noKit.e.shots.map((s) => s.rtk))).toEqual(new Set(['NONE']));
  });
});

describe('FlightEngine — energia, RTH e múltiplas surtidas (§5.12)', () => {
  it('RTH recomendado com energia baixa: alerta crítico e bip a cada 1,5 s', () => {
    const calm = { meanMs: 0, gustMs: 0, directionDeg: 0 };
    let beeps = 0;
    const { e } = setup({ wind: calm });
    (e as unknown as { opts: { onRthBeep: () => void } }).opts.onRthBeep = () => beeps++;
    run(e, 3);
    expect(e.snapshot().rthAlert).toBe(false);
    expect(beeps).toBe(0);
    e.energy = 0.15;
    run(e, 3.2);
    expect(e.alerts().map((a) => a.id)).toContain('RTH');
    expect(e.snapshot().rthAlert).toBe(true);
    // 3,2 s com bip a cada 1,5 s: 3 bips (em 0; 1,5; 3,0).
    expect(beeps).toBe(3);
  });

  it('RTH pede confirmação (3 s): 2º acionamento confirma, o tempo ou o cancelamento desistem', () => {
    const { e } = setup();
    expect(e.requestRth()).toBe('IGNORED');
    run(e, 3);
    expect(e.requestRth()).toBe('ASK');
    expect(e.rthConfirming).toBe(true);
    expect(e.snapshot().rthConfirm).toBe(true);
    run(e, 3.1);
    expect(e.rthConfirming).toBe(false);
    expect(e.requestRth()).toBe('ASK');
    e.cancelRth();
    expect(e.rthConfirming).toBe(false);
    expect(e.requestRth()).toBe('ASK');
    expect(e.requestRth()).toBe('CONFIRMED');
    expect(e.phase).toBe('RETURNING');
  });

  it('RTH confirmado: retorna por 3 s e termina como RTH, com os dados mantidos e a linha incompleta', () => {
    const results: Array<{ outcome: string; completedLines: number[]; photos: number }> = [];
    const calm = { meanMs: 0, gustMs: 0, directionDeg: 0 };
    const { e } = setup({ wind: calm });
    (e as unknown as { opts: { onSortieEnd: (r: (typeof results)[0]) => void } }).opts.onSortieEnd =
      (r) => results.push(r);
    run(e, 8);
    const photos = e.shots.length;
    e.requestRth();
    e.requestRth();
    run(e, 3.2);
    expect(results[0]).toMatchObject({ outcome: 'RTH', completedLines: [], photos });
    expect(photos).toBeGreaterThan(0);
  });

  it('com poucas baterias, o autopilot completa o plano em 2 surtidas (RTH + nova surtida)', () => {
    const t1 = getAircraft('DRONE_T1');
    const params = {
      ...referenceParams(C00),
      aircraftId: 'DRONE_T1' as const,
      sensorId: 'CAM_20MP_RS',
      speedMs: 8,
    };
    const plan = buildFlightPlan(params, C00, CATALOG);
    const mods = { ...neutralModifiers(), endurance: 0.3 };
    let done: number[] = [];
    const outcomes: string[] = [];
    for (let sortie = 0; sortie < 3 && done.length < plan.lines.length; sortie++) {
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
        sorties: Array.from({ length: sortie }, () => ({})),
        completedLines: done,
        shots: [],
        events: {
          collisions: 0,
          crashes: 0,
          detected: false,
          featuresCaptured: [],
          ringsCollected: 0,
        },
        status: 'IN_FLIGHT',
      } as unknown as MissionData;
      // "Nova surtida" só existe com bateria sobrando (1 + reservas).
      expect(1 + t1.spareBatteries - sortie).toBeGreaterThan(0);
      let result: { outcome: string; completedLines: number[] } | null = null;
      const eng = new FlightEngine({
        mission,
        contract: C00,
        terrain: createTerrain(C00),
        catalog: CATALOG,
        input: { axis: () => 0 },
        mods,
        ownsRtkKit: false,
        autopilot: true,
        quality: () => 'LOW',
        reduceFlashes: () => false,
        colors: { primary: '#fff', secondary: '#000' },
        sortie,
        shotOffset: 0,
        onSortieEnd: (r) => (result = r),
      });
      for (let t = 0; t < 900 && eng.phase !== 'POST_FLIGHT'; t += 1 / 60) eng.update(1 / 60);
      const r = result as unknown as { outcome: string; completedLines: number[] };
      outcomes.push(r.outcome);
      done = [...new Set([...done, ...r.completedLines])];
    }
    expect(outcomes).toEqual(['RTH', 'COMPLETED']);
    expect(done).toEqual([0, 1, 2, 3, 4, 5]);
  });
});
