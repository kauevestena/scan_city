/**
 * O motor com a execução do voo (T088): rajadas, corredor, erro de entrada, nota de cada
 * amostra, aceitação da linha e revoo (survey-flight §5.7, §5.13, §5.19 e §5.20).
 */
import { CATALOG } from '@/data/catalog';
import { C00 } from '@/data/contracts';
import { plannedSamples } from '@/domain/corridor';
import { countSamples, missionExecution } from '@/domain/execution';
import { buildFlightPlan } from '@/domain/flightPlanner';
import { GUST_WARN_S } from '@/domain/gusts';
import { neutralModifiers } from '@/domain/modifiers';
import { referenceParams } from '@/test/fixtures/syntheticMission';
import { resetGameStore } from '@/test/resetStore';
import { useGameStore } from '@/state/store';
import type { LinePass, MissionData, PlanParams } from '@/types';
import { createTerrain } from '@/world/terrain/createTerrain';
import {
  FlightEngine,
  type FlightEngineOptions,
  type GradeEvent,
  type LineReport,
  type SortieResult,
} from './FlightEngine';
import { beginLinePass, passSeed } from './linePass';
import { runFrame } from './runFrame';

const terrain = createTerrain(C00);

function mission(over: Partial<PlanParams> = {}, id = 'X1'): MissionData {
  return {
    id,
    contractId: 'C00',
    createdAt: 0,
    rivalAdjustment: 1,
    isReplay: false,
    plan: buildFlightPlan({ ...referenceParams(C00), ...over }, C00, CATALOG),
    groundPoints: [],
    fieldEquipmentId: 'TOTAL_STATION',
    minigames: {},
    atlasCalibrated: false,
    sorties: [],
    completedLines: [],
    shots: [],
    events: { collisions: 0, crashes: 0, detected: false, featuresCaptured: [], ringsCollected: 0 },
    status: 'IN_FLIGHT',
  };
}

function engine(m: MissionData, over: Partial<FlightEngineOptions> = {}) {
  const results: SortieResult[] = [];
  const reports: LineReport[] = [];
  const grades: GradeEvent[] = [];
  const e = new FlightEngine({
    mission: m,
    contract: C00,
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
    onLinePass: (r) => reports.push(r),
    onGrade: (g) => grades.push(g),
    ...over,
  });
  return { e, results, reports, grades };
}

function fly(e: FlightEngine, maxS = 1200) {
  for (let t = 0; t < maxS && e.phase !== 'POST_FLIGHT'; t += 1 / 60) e.update(1 / 60);
}

const plannedOf = (m: MissionData) =>
  m.plan.lines.map((l) => plannedSamples(l, m.plan.stats.baseM));

describe('o piloto bom (autopilot) no C00', () => {
  it('6 linhas aceitas de primeira, 96 ± 6 fotos, nenhuma rejeitada na contagem e execução ≥ 0,9', () => {
    const m = mission();
    const { e, results, reports } = engine(m);
    fly(e);
    const r = results[0];
    expect(r?.outcome).toBe('COMPLETED');
    expect(r?.completedLines).toEqual([0, 1, 2, 3, 4, 5]);
    expect(r?.refly).toEqual([]);
    expect(Math.abs((r?.photos ?? 0) - 96)).toBeLessThanOrEqual(6);
    expect(r?.linePasses).toHaveLength(6);
    for (const p of r?.linePasses ?? []) {
      expect(p.complete).toBe(true);
      expect(p.pass).toBe(0);
      expect(p.counts[3]).toBe(0);
    }
    expect(reports.map((x) => x.accepted)).toEqual([true, true, true, true, true, true]);
    expect(missionExecution(r?.linePasses, plannedOf(m))).toBeGreaterThanOrEqual(0.9);
    // Cada foto automática tem nota; a velocidade gravada é a do solo.
    expect(e.shots.every((s) => s.grade !== undefined)).toBe(true);
  });
});

describe('o jogador parado no C00', () => {
  it('nenhuma linha aceita, cada uma revoada uma vez e execução < 0,4', () => {
    const m = mission();
    const { e, results, reports } = engine(m, { autopilot: false });
    fly(e);
    const r = results[0];
    expect(r?.completedLines).toEqual([]);
    expect(reports.every((x) => !x.accepted)).toBe(true);
    // As 6 linhas e o revoo de cada uma, no máximo uma vez por surtida.
    const lines = (r?.linePasses ?? []).map((p) => `${p.lineIndex}:${p.pass}`);
    expect(new Set(lines).size).toBe(lines.length);
    expect((r?.linePasses ?? []).filter((p) => p.pass === 1).length).toBeGreaterThan(0);
    for (const p of r?.linePasses ?? []) expect(p.pass).toBeLessThanOrEqual(1);
    expect(missionExecution(r?.linePasses ?? [], plannedOf(m))).toBeLessThan(0.4);
  });
});

describe('determinismo e erro de entrada', () => {
  it('a mesma missão e a mesma surtida repetem as rajadas e os erros de entrada', () => {
    const m = mission();
    const a = engine(m);
    const b = engine(m);
    expect(a.e.ac.x).toBe(b.e.ac.x);
    expect(Math.abs(a.e.ac.x)).toBeGreaterThan(0);
    fly(a.e);
    fly(b.e);
    expect(a.results[0]?.linePasses).toEqual(b.results[0]?.linePasses);
    expect(a.e.shots.map((s) => [s.u, s.v, s.grade])).toEqual(
      b.e.shots.map((s) => [s.u, s.v, s.grade]),
    );
    // Outra surtida da mesma missão sorteia outra coisa.
    const c = engine(m, { sortie: 1 });
    expect(c.e.ac.x).not.toBe(a.e.ac.x);
  });

  it('a passada sorteia de 30 % a 40 % de S, o corredor e as rajadas, pela semente da passada', () => {
    const m = mission();
    const line = m.plan.lines[0]!;
    const frame = runFrame(line);
    const input = {
      missionId: 'X1',
      sortie: 0,
      pass: 0,
      line,
      frame,
      plan: m.plan,
      aircraft: CATALOG.aircraft.find((x) => x.id === 'ATLAS')!,
      contract: C00,
      elevationAlong: () => 100,
      calm: false,
    };
    const p = beginLinePass(input);
    expect(Math.abs(p.entryOffsetM) / m.plan.stats.spacingM).toBeGreaterThanOrEqual(0.3);
    expect(Math.abs(p.entryOffsetM) / m.plan.stats.spacingM).toBeLessThan(0.4);
    expect(p.gusts.length).toBeGreaterThanOrEqual(1);
    expect(p.gates).toHaveLength(16);
    expect(p.planned).toBe(15);
    expect(p.profile.alts.every((a) => a === 100 + m.plan.params.heightM)).toBe(true);
    expect(beginLinePass({ ...input, pass: 1 }).entryOffsetM).not.toBe(p.entryOffsetM);
    const calm = beginLinePass({ ...input, calm: true });
    expect(calm.gusts).toEqual([]);
    expect(calm.entryOffsetM).toBe(0);
    expect(passSeed('X1', 0, 0, 0)).not.toBe(passSeed('X1', 0, 0, 1));
  });
});

describe('rajadas no voo', () => {
  it('o alerta vem 1,5 s antes, com o lado; depois a rajada empurra a aeronave', () => {
    const m = mission();
    const { e } = engine(m, { autopilot: false });
    // Decolagem até o RUN.
    while (e.phase !== 'RUN') e.update(1 / 60);
    const gust = (e as unknown as { pass: { gusts: Array<{ startS: number; angleRad: number }> } })
      .pass.gusts[0]!;
    const side = Math.sin(gust.angleRad) < 0 ? -1 : 1;
    // Até um pouco antes do aviso: nada.
    for (let t = 0; t < gust.startS - GUST_WARN_S - 0.1; t += 1 / 60) e.update(1 / 60);
    expect(e.gustNow()).toBeNull();
    expect(e.alertList().map((a) => a.id)).not.toContain('GUST');
    for (let t = 0; t < 0.2; t += 1 / 60) e.update(1 / 60);
    const warned = e.alertList().find((a) => a.id === 'GUST');
    expect(warned?.side).toBe(side);
    expect(warned?.value ?? 0).toBeGreaterThan(0);
    expect(e.snapshot().gust).toMatchObject({ side, active: false });
    const x0 = e.ac.x;
    for (let t = 0; t < GUST_WARN_S + 1.5; t += 1 / 60) e.update(1 / 60);
    expect(e.snapshot().gust?.active).toBe(true);
    expect(Math.sign(e.ac.x - x0)).toBe(side);
  });
});

describe('notas, aceitação e revoo', () => {
  it('cada amostra da contagem gera um evento de nota com a sequência', () => {
    const m = mission();
    const { e, grades, results } = engine(m);
    fly(e);
    const total = (results[0]?.linePasses ?? []).reduce((n, p) => n + countSamples(p.counts), 0);
    expect(grades).toHaveLength(total);
    expect(Math.max(...grades.map((g) => g.streak))).toBeGreaterThan(10);
    // A sequência cresce de 1 em 1 e zera nas notas fracas ou rejeitadas.
    for (let i = 1; i < grades.length; i++) {
      const g = grades[i]!;
      const ok = g.grade === 'PERFECT' || g.grade === 'GOOD';
      expect(g.streak).toBe(ok ? grades[i - 1]!.streak + 1 : 0);
    }
  });

  it('o boletim fica no HUD durante a curva e some na linha seguinte', () => {
    const m = mission();
    const { e } = engine(m);
    const phase = () => e.phase;
    while (phase() !== 'TURN') e.update(1 / 60);
    const report = e.snapshot().lineReport;
    expect(report).toMatchObject({ lineNumber: 1, pass: 0, accepted: true });
    expect(report?.letter).toMatch(/^[SA]$/);
    while (phase() !== 'RUN') e.update(1 / 60);
    expect(e.snapshot().lineReport).toBeNull();
  });

  it('linha recusada vai para o fim da fila; na segunda passada o autopilot a aceita', () => {
    // O jogador parado na linha 0 e o autopilot no resto: troca a entrada no meio do voo.
    const m = mission();
    let auto = false;
    const { e, results, reports } = engine(m, { autopilot: false });
    const opts = (e as unknown as { opts: { autopilot: boolean } }).opts;
    opts.autopilot = auto;
    for (let t = 0; t < 1200 && e.phase !== 'POST_FLIGHT'; t += 1 / 60) {
      e.update(1 / 60);
      if (!auto && e.phase === 'TURN') {
        auto = true;
        opts.autopilot = true;
      }
    }
    expect(reports[0]).toMatchObject({ lineNumber: 1, accepted: false, pass: 0 });
    const last = reports.at(-1);
    expect(last).toMatchObject({ lineNumber: 1, accepted: true, pass: 1 });
    expect(results[0]?.completedLines).toEqual([0, 1, 2, 3, 4, 5]);
    expect(results[0]?.refly).toEqual([]);
    expect(reports).toHaveLength(7);
  });

  it('RTH no meio da linha: a passada fecha incompleta e não é aceita', () => {
    const m = mission();
    const { e, results } = engine(m);
    while (e.phase !== 'RUN') e.update(1 / 60);
    for (let t = 0; t < 12; t += 1 / 60) e.update(1 / 60);
    e.requestRth();
    expect(e.requestRth()).toBe('CONFIRMED');
    fly(e);
    const p = results[0]?.linePasses[0];
    expect(p?.complete).toBe(false);
    expect(countSamples(p?.counts ?? [0, 0, 0, 0])).toBeGreaterThan(0);
    expect(results[0]?.completedLines).toEqual([]);
  });

  it('com o LiDAR, cada portal é uma amostra e os pulsos fora da tolerância não contam', () => {
    const params = {
      aircraftId: 'DRONE_T2' as const,
      sensorId: 'POD_LIDAR' as const,
      primarySensor: 'LIDAR' as const,
      heightM: 60,
      speedMs: 8,
      sideOverlapPct: 60,
    };
    const base = mission(params, 'LX');
    const m = {
      ...base,
      plan: { ...base.plan, params: { ...base.plan.params, lensId: undefined } },
    };
    const good = engine(m as MissionData);
    fly(good.e);
    const lines = good.results[0]?.linePasses ?? [];
    expect(lines.length).toBe(m.plan.lines.length);
    expect(countSamples(lines[0]!.counts)).toBe(plannedOf(m as MissionData)[0]);
    expect(good.results[0]?.completedLines).toHaveLength(m.plan.lines.length);
    // Parado e fora da faixa: as amostras saem rejeitadas e quase nenhum pulso entra.
    const idle = engine(m as MissionData, { autopilot: false });
    fly(idle.e, 60);
    const pulses = (g: FlightEngine) => g.lidar!.grid.pulses.reduce((a, b) => a + b, 0);
    expect(pulses(idle.e)).toBeLessThan(pulses(good.e) * 0.2);
  });
});

describe('store: as passadas entram na missão', () => {
  const get = () => useGameStore.getState();
  beforeEach(() => resetGameStore());
  const pass = (lineIndex: number): LinePass => ({
    lineIndex,
    pass: 0,
    sortie: 0,
    counts: [10, 2, 1, 0],
    complete: true,
  });

  it('surtida concluída soma as passadas; surtida perdida as descarta junto com as fotos', () => {
    get().startMission('C00', 1);
    expect(get().mission.active?.linePasses).toBeUndefined();
    get().endSortie({
      outcome: 'RTH',
      durationS: 5,
      completedLines: [0],
      linePasses: [pass(0), { ...pass(1), complete: false }],
    });
    expect(get().mission.active?.linePasses).toHaveLength(2);
    get().endSortie({
      outcome: 'CRASH',
      durationS: 5,
      completedLines: [],
      linePasses: [pass(2)],
    });
    expect(get().mission.active?.linePasses).toHaveLength(2);
    get().endSortie({ outcome: 'COMPLETED', durationS: 5, completedLines: [1], linePasses: [] });
    expect(get().mission.active?.linePasses).toHaveLength(2);
    // Quem não manda passadas (relatórios antigos) não mexe no campo.
    get().endSortie({ outcome: 'RTH', durationS: 5, completedLines: [] });
    expect(get().mission.active?.linePasses).toHaveLength(2);
  });
});
