import { FLIGHT_TEMPO } from './tempo';
import { CATALOG } from '@/data/catalog';
import { C00 } from '@/data/contracts';
import { buildFlightPlan } from '@/domain/flightPlanner';
import { neutralModifiers } from '@/domain/modifiers';
import { mulberry32 } from '@/lib/rng';
import { referenceParams } from '@/test/fixtures/syntheticMission';
import type { Contract, MissionData, PlanParams, SpecialZone } from '@/types';
import { buildTestArena, type ArenaOptions } from '@/world/terrain/biomes/testArena';
import {
  detectionProgress,
  ElectricSchedule,
  initialDetection,
  insideSearchlight,
  nearestSearchlightM,
  RING_COLLECT_M,
  ringCollected,
  searchlightSpot,
  SPIKE_FORCE_MS,
  stepDetection,
} from './fieldElements';
import { FlightEngine, type SortieResult } from './FlightEngine';

const light: Extract<SpecialZone, { kind: 'SEARCHLIGHT' }> = {
  kind: 'SEARCHLIGHT',
  u: 120,
  v: 80,
  radiusM: 40,
  sweepRad: 1,
  periodS: 8,
};

describe('holofote (puro)', () => {
  it('a mancha oscila em torno do poste: raio 35 % e centro a 50 % do raio da zona', () => {
    const s0 = searchlightSpot(light, 0);
    expect(s0).toEqual({ u: 140, v: 80, r: 14 });
    const s2 = searchlightSpot(light, 2);
    expect(Math.hypot(s2.u - 120, s2.v - 80)).toBeCloseTo(20, 9);
    expect(insideSearchlight([light], 140, 80, 0)).toBe(true);
    expect(insideSearchlight([light], 0, 0, 0)).toBe(false);
    expect(
      insideSearchlight([{ kind: 'THERMAL', u: 0, v: 0, radiusM: 5, liftMs: 1 }], 0, 0, 0),
    ).toBe(false);
    expect(nearestSearchlightM([light], 120, 180)).toBe(100);
    expect(nearestSearchlightM([], 0, 0)).toBe(Infinity);
  });

  it('detecção: 1,5 s seguidos no cone (Atlas: 3 s); sair do cone zera', () => {
    const run = (atlas: boolean, seconds: number) => {
      let s = initialDetection();
      for (let t = 0; t < seconds; t += 0.05) s = stepDetection(s, true, 0.05, atlas);
      return s;
    };
    expect(run(false, 1.4).detected).toBe(false);
    expect(run(false, 1.6).detected).toBe(true);
    expect(run(true, 2.9).detected).toBe(false);
    expect(run(true, 3.1).detected).toBe(true);
    const out = stepDetection(run(false, 1), false, 0.05, false);
    expect(out.inS).toBe(0);
    expect(detectionProgress(run(false, 0.75), false)).toBeCloseTo(0.5, 6);
    // A detecção é permanente na surtida.
    expect(stepDetection(run(false, 2), false, 1, false).detected).toBe(true);
  });
});

describe('anéis, picos elétricos e time warp (puros)', () => {
  it('anel coletado a menos de 3 m do centro, em 3D', () => {
    const ring = { u: 50, v: 50, baseM: 10, heightM: 6 };
    expect(RING_COLLECT_M).toBe(3);
    expect(ringCollected(ring, { u: 50, v: 50, alt: 13 }, () => 0)).toBe(true);
    expect(ringCollected(ring, { u: 52, v: 50, alt: 13 }, () => 0)).toBe(true);
    expect(ringCollected(ring, { u: 54, v: 50, alt: 13 }, () => 0)).toBe(false);
    expect(ringCollected(ring, { u: 50, v: 50, alt: 20 }, () => 0)).toBe(false);
  });

  it('picos seedados: a cada 8–12 s, 2 s de 3 m/s para o lado sorteado', () => {
    const a = new ElectricSchedule(mulberry32(7));
    const b = new ElectricSchedule(mulberry32(7));
    const starts: number[] = [];
    for (let t = 0; t < 80; t += 0.05) {
      expect(a.lateralMs(t)).toBe(b.lateralMs(t));
      const on = a.at(t);
      if (on && !starts.includes(on.startS)) starts.push(on.startS);
      if (on) expect(Math.abs(a.lateralMs(t))).toBe(SPIKE_FORCE_MS);
    }
    expect(starts.length).toBeGreaterThanOrEqual(5);
    expect(starts[0]).toBeGreaterThanOrEqual(8);
    expect(starts[0]).toBeLessThanOrEqual(12);
    for (let k = 1; k < starts.length; k++) {
      const gap = (starts[k] as number) - (starts[k - 1] as number) - 2;
      expect(gap).toBeGreaterThanOrEqual(8);
      expect(gap).toBeLessThanOrEqual(12);
    }
    expect(a.lateralMs(0)).toBe(0);
  });
});

// --- Cenas de teste (arena sintética) ---------------------------------------------------

const calm = { meanMs: 0, gustMs: 0, directionDeg: 0 };

function arena(
  options: ArenaOptions,
  over: {
    rules?: Contract['specialRules'];
    aircraft?: 'ATLAS' | 'DRONE_T1';
    params?: Partial<PlanParams>;
    autopilot?: boolean;
  } = {},
) {
  const terrain = buildTestArena(options);
  const aircraft = over.aircraft ?? 'DRONE_T1';
  const sensor = aircraft === 'ATLAS' ? 'CAM_PIGEON' : 'CAM_20MP_RS';
  const contract: Contract = { ...C00, specialRules: over.rules ?? [], wind: calm };
  const params: PlanParams = {
    ...referenceParams(C00),
    aircraftId: aircraft,
    sensorId: sensor,
    speedMs: aircraft === 'ATLAS' ? 10 : 8,
    ...over.params,
  };
  const plan = buildFlightPlan(params, contract, CATALOG);
  const mission = {
    id: 'arena',
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
  const events = { ring: 0, detected: 0 };
  const e = new FlightEngine({
    mission,
    contract,
    terrain,
    catalog: CATALOG,
    input: { axis: () => 0 },
    mods: neutralModifiers(),
    ownsRtkKit: false,
    autopilot: over.autopilot ?? true,
    calm: true,
    quality: () => 'LOW',
    reduceFlashes: () => false,
    colors: { primary: '#fff', secondary: '#000' },
    sortie: 0,
    shotOffset: 0,
    onSortieEnd: (r) => results.push(r),
    onRing: () => events.ring++,
    onDetected: () => events.detected++,
  });
  return { e, results, events, terrain, plan };
}
const run = (e: FlightEngine, s: number) => {
  for (let t = 0; t < s; t += 1 / 60) e.update(1 / 60);
};
const fly = (e: FlightEngine) => {
  for (let t = 0; t < 900 && e.phase !== 'POST_FLIGHT'; t += 1 / 60) e.update(1 / 60);
};
/** `v` da primeira linha do plano (a rota do autopilot) para cada aeronave. */
function laneV(aircraft: 'ATLAS' | 'DRONE_T1', params: Partial<PlanParams> = {}): number {
  const sensor = aircraft === 'ATLAS' ? 'CAM_PIGEON' : 'CAM_20MP_RS';
  const plan = buildFlightPlan(
    {
      ...referenceParams(C00),
      aircraftId: aircraft,
      sensorId: sensor,
      speedMs: aircraft === 'ATLAS' ? 10 : 8,
      ...params,
    },
    { ...C00, wind: calm },
    CATALOG,
  );
  return (plan.lines[0] as { start: { v: number } }).start.v;
}
const ON_LINE = laneV('DRONE_T1');

describe('SEARCHLIGHTS: cena de teste', () => {
  it('ficar no cone por mais de 1,5 s detecta (alerta, som, evento); o voo continua', () => {
    // Poste fixo de mancha larga sobre a linha: o aeroplano atravessa o cone.
    const zone: SpecialZone = {
      kind: 'SEARCHLIGHT',
      u: 100,
      v: ON_LINE,
      radiusM: 120,
      sweepRad: 0,
      periodS: 10,
    };
    const { e, events, results } = arena({ zones: [zone] }, { rules: ['SEARCHLIGHTS'] });
    fly(e);
    expect(events.detected).toBe(1);
    expect(results[0]?.detected).toBe(true);
    expect(results[0]?.outcome).toBe('COMPLETED');
  });

  it('o Atlas (3 s) atravessa um cone curto sem ser detectado; o drone (1,5 s), não', () => {
    // Mancha de r = 14 m: 28 m de corda a 10 m/s (Atlas) = 2,8 s; a 8 m/s (drone) = 3,5 s.
    const zone: SpecialZone = {
      kind: 'SEARCHLIGHT',
      u: 100,
      v: ON_LINE,
      radiusM: 40,
      sweepRad: 0,
      periodS: 10,
    };
    const atlas = arena({ zones: [{ ...zone, u: 80 }] }, { aircraft: 'ATLAS' });
    fly(atlas.e);
    expect(atlas.results[0]?.detected).toBe(false);
    const drone = arena({ zones: [{ ...zone, u: 80 }] });
    fly(drone.e);
    expect(drone.results[0]?.detected).toBe(true);
  });

  it('snapshot: a barra de detecção avança e DETECTED vira alerta crítico', () => {
    const zone: SpecialZone = {
      kind: 'SEARCHLIGHT',
      // Mancha de r = 70 m centrada em u = 0, sobre o início da rota.
      u: -100,
      v: ON_LINE,
      radiusM: 200,
      sweepRad: 0,
      periodS: 10,
    };
    const { e } = arena({ zones: [zone] }, { autopilot: true });
    run(e, 5.5);
    expect(e.snapshot().detectedProgress).toBeGreaterThan(0);
    run(e, 2);
    expect(e.snapshot().alerts.map((a) => a.id)).toContain('DETECTED');
  });
});

describe('COLLECTIBLE_RINGS: cena de teste', () => {
  it('anéis no caminho são coletados e somam; os fora do caminho, não', () => {
    const ring = (u: number, v: number) => ({
      kind: 'RING' as const,
      u,
      v,
      widthM: 6,
      depthM: 6,
      heightM: 6,
      baseM: 55,
      solid: false,
      collectible: true,
      color: [250, 204, 21] as [number, number, number],
    });
    const { e, events, results } = arena(
      { objects: [ring(60, ON_LINE), ring(120, ON_LINE), ring(180, 70)] },
      { rules: ['COLLECTIBLE_RINGS'], params: { heightM: 60 } },
    );

    fly(e);
    expect(events.ring).toBe(2);
    expect(results[0]?.rings).toBe(2);
    expect(e.snapshot().rings).toBe(2);
  });

  it('o bônus entra no total só com anéis coletados (evaluateMission) e a queda não os conta', async () => {
    const { useGameStore } = await import('@/state/store');
    useGameStore.getState().startMission('C00', 1);
    useGameStore
      .getState()
      .endSortie({ outcome: 'CRASH', durationS: 5, completedLines: [], rings: 3 });
    expect(useGameStore.getState().mission.active?.events.ringsCollected).toBe(0);
    useGameStore.getState().endSortie({
      outcome: 'RTH',
      durationS: 5,
      completedLines: [0],
      rings: 3,
      detected: true,
      featuresCaptured: ['T1'],
    });
    expect(useGameStore.getState().mission.active?.events).toMatchObject({
      ringsCollected: 3,
      detected: true,
      featuresCaptured: ['T1'],
    });
  });
});

describe('ELECTRIC_CREATURES: cena de teste', () => {
  it('picos seedados empurram o drone para o lado; o Atlas é imune', () => {
    const peak = (a: ReturnType<typeof arena>) => {
      let worst = 0;
      for (let t = 0; t < 40; t += 1 / 60) {
        a.e.update(1 / 60);
        worst = Math.max(worst, Math.abs(a.e.ac.x));
      }
      return worst;
    };
    const drone = arena({}, { rules: ['ELECTRIC_CREATURES'], autopilot: false });
    const atlas = arena({}, { rules: ['ELECTRIC_CREATURES'], autopilot: false, aircraft: 'ATLAS' });
    expect(peak(drone)).toBeGreaterThan(4);
    expect(peak(atlas)).toBe(0);
    expect(atlas.e.snapshot().emGlitch).toBe(false);
    // Reprodutível: a mesma missão tem os mesmos picos.
    const again = arena({}, { rules: ['ELECTRIC_CREATURES'], autopilot: false });
    peak(again);
    expect(again.e.ac.x).toBeCloseTo(drone.e.ac.x, 9);
  });
});

describe('MOVING_HAZARDS e ENERGY_BEAMS: estado por t', () => {
  const orange = [200, 50, 50] as [number, number, number];

  it('o perigo móvel bate quando a esfera está sobre a rota, e não quando está fora', () => {
    const hazard = (v: number, amplitudeM: number, phase = 0) => ({
      kind: 'MOVING_HAZARD' as const,
      u: 50,
      v,
      widthM: 8,
      depthM: 8,
      heightM: 8,
      baseM: 56,
      motion: { axis: 'v' as const, amplitudeM, periodS: 8, phase },
      color: orange,
    });
    const hit = arena(
      { objects: [hazard(ON_LINE, 0)] },
      { rules: ['MOVING_HAZARDS'], params: { heightM: 60 } },
    );
    fly(hit.e);
    expect(hit.e.collisions).toBeGreaterThan(0);
    // A mesma esfera parada fora do bloco de linhas (v = −80 m): nunca toca.
    const miss = arena(
      { objects: [hazard(-80, 0)] },
      { rules: ['MOVING_HAZARDS'], params: { heightM: 60 } },
    );
    fly(miss.e);
    expect(miss.e.collisions).toBe(0);
    // Oscilando 40 m, a posição é função de t: duas execuções dão o mesmo resultado.
    const swing = () => {
      const a = arena(
        { objects: [hazard(ON_LINE + 40, 40)] },
        { rules: ['MOVING_HAZARDS'], params: { heightM: 60 } },
      );
      fly(a.e);
      return a.e.collisions;
    };
    expect(swing()).toBe(swing());
  });

  it('o feixe só bate ligado: sempre ligado bate; fora de fase (desligado na passagem), não', () => {
    const beam = (activePeriod?: { onS: number; offS: number; phase: number }) => ({
      kind: 'ENERGY_BEAM' as const,
      u: 100,
      v: ON_LINE,
      widthM: 6,
      depthM: 6,
      heightM: 120,
      ...(activePeriod ? { activePeriod } : {}),
      color: [244, 114, 182] as [number, number, number],
    });
    const on = arena({ objects: [beam()] }, { rules: ['ENERGY_BEAMS'] });
    fly(on.e);
    expect(on.e.collisions).toBeGreaterThan(0);
    // Praticamente sempre desligado.
    const off = arena(
      { objects: [beam({ onS: 0.0001, offS: 1000, phase: 500 })] },
      { rules: ['ENERGY_BEAMS'] },
    );
    fly(off.e);
    expect(off.e.collisions).toBe(0);
  });
});

describe('FEATURE_TARGETS: avaliadas no fim da surtida', () => {
  it('PHOTO: ≥ 3 fotos válidas cobrindo o centro; o alvo fora da AOI não é capturado', () => {
    const features = [
      { id: 'ALVO_A', name: 'A', u: 120, v: 80, radiusM: 8, needs: 'PHOTO' as const },
      { id: 'ALVO_B', name: 'B', u: 120, v: 800, radiusM: 8, needs: 'PHOTO' as const },
    ];
    const { e, results } = arena(
      { features },
      { rules: ['FEATURE_TARGETS'], aircraft: 'ATLAS', params: { heightM: 60 } },
    );
    fly(e);
    expect(results[0]?.featuresCaptured).toEqual(['ALVO_A']);
  });

  it('numa queda a lista fica vazia (dados descartados)', () => {
    const features = [
      { id: 'ALVO_A', name: 'A', u: 120, v: 80, radiusM: 8, needs: 'PHOTO' as const },
    ];
    const { e, results } = arena({ features }, { rules: ['FEATURE_TARGETS'], aircraft: 'ATLAS' });
    run(e, 3);
    e.hull = 1;
    e.ac = { ...e.ac, alt: -10 };
    for (let t = 0; t < 4; t += 1 / 60) e.update(1 / 60);
    expect(results[0]?.outcome).toBe('CRASH');
    expect(results[0]?.featuresCaptured).toEqual([]);
  });
});

describe('cruzeiro automático no motor (survey-flight §5.14)', () => {
  it('estável no corredor, acelera até o fator da linha; perto de um objeto sólido, volta a ×1', () => {
    const wall = {
      kind: 'BUILDING' as const,
      u: 400,
      v: ON_LINE,
      widthM: 10,
      depthM: 10,
      heightM: 5,
      color: [1, 2, 3] as [number, number, number],
    };
    const { e } = arena({ objects: [wall] }, { autopilot: true });
    expect(e.timeWarp).toBe(1);
    // Decolagem, alinhamento e 1,5 s de estabilidade: depois o fator sobe.
    run(e, 9);
    expect(e.timeWarp).toBeGreaterThan(1);
    expect(e.snapshot().cruise).toMatchObject({ on: true });
    expect(e.snapshot().timeScale).toBe(e.timeScale);
    expect(e.timeScale).toBeCloseTo(FLIGHT_TEMPO * e.timeWarp, 9);
    // O prédio em u = 400: a menos de 150 m à frente e no eixo, o cruzeiro cai a ×1.
    for (let t = 0; t < 60 && 400 - e.pos().u > 140; t += 1 / 60) e.update(1 / 60);
    run(e, 0.1);
    expect(e.timeWarp).toBe(1);
  });

  it('na curva o cruzeiro volta a ×1, e o tempo corre só no ritmo da fase', () => {
    const { e } = arena({}, { autopilot: true });
    let accelerated = false;
    for (let t = 0; t < 400 && e.phase !== 'TURN' && e.phase !== 'LANDING'; t += 1 / 60) {
      e.update(1 / 60);
      if (e.timeWarp > 1) accelerated = true;
    }
    expect(accelerated).toBe(true);
    expect(e.timeWarp).toBe(1);
    expect(e.timeScale).toBe(1);
  });

  it('TIME_WARP desliga e religa o cruzeiro; fora do RUN e com alerta crítico fica em ×1', () => {
    const { e } = arena({}, { autopilot: true });
    expect(e.cycleTimeWarp()).toBe(false);
    run(e, 9);
    expect(e.timeWarp).toBe(1);
    expect(e.snapshot().cruise).toEqual({ on: false, factor: 1 });
    expect(e.cycleTimeWarp()).toBe(true);
    run(e, 4);
    expect(e.timeWarp).toBeGreaterThan(1);
    e.hull = 1;
    run(e, 0.1);
    expect(e.timeWarp).toBe(1);
  });
});
