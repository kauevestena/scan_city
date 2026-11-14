import { CATALOG, HARDWARE } from '@/data/catalog';
import { mulberry32 } from '@/lib/rng';
import { C00_FIXTURE } from '@/test/fixtures/c00';
import { syntheticMission } from '@/test/fixtures/syntheticMission';
import type {
  Contract,
  ContractRequirement,
  LidarGrid,
  MissionData,
  PaymentBreakdown,
} from '@/types';
import { clearTerrainCache, createTerrain } from '@/world/terrain/createTerrain';
import {
  estimatedSideOverlapPct,
  evaluateMission,
  lidarCoverage,
  lidarStats,
  medianForwardOverlapPct,
  qualityFactor,
  qualityScore,
  toleranceScore,
  type MissionContext,
  type PaymentInput,
} from './mission';
import { neutralModifiers } from './modifiers';

/** Stub de pagamento: ecoa o qualityFactor recebido (o cálculo real vem em T019). */
const paymentStub = (input: PaymentInput): PaymentBreakdown => ({
  baseBRL: input.baseBRL,
  replayFactor: input.isReplay ? 0.4 : 1,
  qualityFactor: input.qualityFactor,
  rivalFactor: input.rivalFactor,
  managementBonus: input.contractPaymentMod,
  staffBonus: 1,
  staffCostBRL: 0,
  penaltiesBRL: input.penaltiesBRL,
  totalBRL: Math.round(input.baseBRL * input.qualityFactor),
});

function context(over: Partial<MissionContext> = {}): MissionContext {
  return {
    catalog: CATALOG,
    terrain: createTerrain(C00_FIXTURE),
    ownsRtkKit: false,
    modifiers: neutralModifiers(),
    staff: { INTERN: 0, JUNIOR_ENG: 0 },
    hardware: HARDWARE[0] as (typeof HARDWARE)[number],
    inField: false,
    firstApproval: true,
    rng: mulberry32(1234),
    deps: {
      computePayment: paymentStub,
      computeRewards: (r) => ({
        xp: r.critical ? 1 : r.xp,
        reputationDelta: r.critical ? -10 : r.reputationReward,
      }),
    },
    ...over,
  };
}

beforeEach(() => clearTerrainCache());

describe('cenário golden — missão sintética do C00', () => {
  const run = (
    mission?: MissionData,
    contract: Contract = C00_FIXTURE,
    over: Partial<MissionContext> = {},
  ) => {
    const ctx = context(over);
    return evaluateMission(mission ?? syntheticMission(contract, ctx.terrain), contract, ctx);
  };

  it('o plano de referência é aprovado com score ≥ 0,85', () => {
    const report = run();
    expect(report.critical).toBe(false);
    expect(report.approved).toBe(true);
    expect(report.qualityScore).toBeGreaterThanOrEqual(0.85);
    expect(report.requirements.every((r) => r.pass)).toBe(true);
    expect(report.coverage.green).toBeGreaterThanOrEqual(0.7);
    expect(report.pec?.planimetric.achieved).toBe('A');
    expect(report.rmse.cp).not.toBeNull();
    expect(report.souvenirAwarded).toBe('SV_NOTEBOOK');
    expect(report.xp).toBe(150);
    // 96 fotos no notebook: 6 + 0,08·96 = 13,68 s.
    expect(report.processingTimeS).toBeCloseTo(13.68, 9);
    // Classe A melhor que a exigida (C): +0,10 no Q.
    expect(report.payment.qualityFactor).toBeCloseTo(0.6 + 0.4 * report.qualityScore + 0.1, 12);
    // Câmera do avô: o multiplicador de câmera aparece.
    expect(report.multipliers.map((m) => m.key)).toContain('camera');
  });

  it('é determinístico: mesmo terreno e mesma seed → relatório idêntico (REQ-CORE-006)', () => {
    expect(run()).toEqual(run());
    expect(run().residuals).not.toEqual(
      run(undefined, C00_FIXTURE, { rng: mulberry32(99) }).residuals,
    );
  });

  it('com só 2 GCPs, MIN_GCP(3) falha (MAJOR): aprovada, ×0,85 no Q e multiplicador gcpCount', () => {
    const ctx = context();
    const base = syntheticMission(C00_FIXTURE, ctx.terrain);
    const points = base.groundPoints.filter(
      (p) => p.kind === 'CP' || p.id === 'GCP1' || p.id === 'GCP4',
    );
    const report = evaluateMission({ ...base, groundPoints: points }, C00_FIXTURE, ctx);
    const gcpReq = report.requirements.find((r) => r.id === 'C00-gcp');
    expect(gcpReq).toMatchObject({ pass: false, severity: 'MAJOR', valueText: '2 de 3' });
    expect(report.approved).toBe(true);
    expect(report.multipliers.find((m) => m.key === 'gcpCount')).toMatchObject({ xy: 4, z: 6 });
    const betterClass =
      report.pec?.planimetric.achieved === 'A' || report.pec?.planimetric.achieved === 'B'
        ? 0.1
        : 0;
    const otherFailures = report.requirements.filter((r) => !r.pass && r.id !== 'C00-gcp');
    const extra = otherFailures.reduce((f, r) => f * (r.severity === 'MAJOR' ? 0.85 : 0.95), 1);
    expect(report.payment.qualityFactor).toBeCloseTo(
      (0.6 + 0.4 * report.qualityScore) * 0.85 * extra + betterClass,
      12,
    );
  });

  it('sem nenhum dado é reprovação crítica', () => {
    const ctx = context();
    const empty = syntheticMission(C00_FIXTURE, ctx.terrain, {
      shots: [],
      sorties: [{ index: 0, outcome: 'CRASH', durationS: 30 }],
      events: {
        collisions: 1,
        crashes: 1,
        detected: false,
        featuresCaptured: [],
        ringsCollected: 0,
      },
    });
    const report = evaluateMission(empty, C00_FIXTURE, ctx);
    expect(report.critical).toBe(true);
    expect(report.approved).toBe(false);
    expect(report.qualityScore).toBe(0);
    expect(report.payment.qualityFactor).toBe(0.1);
    expect(report.souvenirAwarded).toBeUndefined();
    expect(report.reputationDelta).toBe(-10);
    // Atlas não cobra reparo (0 %).
    expect(report.payment.penaltiesBRL).toBe(0);
  });

  it('falha crítica de cobertura reprova', () => {
    const ctx = context();
    const base = syntheticMission(C00_FIXTURE, ctx.terrain);
    const report = evaluateMission(
      { ...base, shots: base.shots.filter((s) => s.lineIndex < 2) },
      C00_FIXTURE,
      ctx,
    );
    expect(report.requirements.find((r) => r.id === 'C00-cov')?.pass).toBe(false);
    expect(report.critical).toBe(true);
  });

  it('replay e segunda aprovação não dão souvenir', () => {
    const ctx = context({ firstApproval: false });
    expect(
      evaluateMission(syntheticMission(C00_FIXTURE, ctx.terrain), C00_FIXTURE, ctx).souvenirAwarded,
    ).toBeUndefined();
    const ctx2 = context();
    const replay = evaluateMission(
      syntheticMission(C00_FIXTURE, ctx2.terrain, { isReplay: true }),
      C00_FIXTURE,
      ctx2,
    );
    expect(replay.souvenirAwarded).toBeUndefined();
    expect(replay.payment.replayFactor).toBe(0.4);
  });
});

describe('cada check.type é avaliado', () => {
  const req = (
    id: string,
    severity: ContractRequirement['severity'],
    check: ContractRequirement['check'],
  ): ContractRequirement => ({
    id,
    label: id,
    severity,
    check,
  });
  const ALL: Contract = {
    ...C00_FIXTURE,
    specialRules: ['FEATURE_TARGETS'],
    requirements: [
      req('gsd', 'MINOR', { type: 'MAX_GSD_CM', value: 5 }),
      req('p', 'MINOR', { type: 'MIN_FORWARD_OVERLAP', value: 65 }),
      req('q', 'MINOR', { type: 'MIN_SIDE_OVERLAP', value: 55 }),
      req('cov', 'MINOR', { type: 'MIN_COVERAGE_GREEN', value: 0.7 }),
      req('kind', 'MINOR', { type: 'SENSOR_KIND', value: 'RGB' }),
      req('tier', 'MINOR', { type: 'MIN_AIRCRAFT_TIER', value: 1 }),
      req('akind', 'MINOR', { type: 'AIRCRAFT_KIND', value: 'BIRD' }),
      req('mode', 'MINOR', { type: 'FLIGHT_MODE', value: 'CROSS_GRID' }),
      req('pec', 'MINOR', {
        type: 'ACCURACY_PEC',
        cls: 'A',
        scaleDenominator: 1000,
        contourIntervalM: 1,
      }),
      req('asprs', 'MINOR', { type: 'ACCURACY_ASPRS', horizontalCm: 1, verticalCm: 50 }),
      req('gcp', 'MINOR', { type: 'MIN_GCP', value: 5 }),
      req('cp', 'MINOR', { type: 'MIN_CP', value: 3 }),
      req('dens', 'MINOR', { type: 'MIN_LIDAR_DENSITY', value: 5 }),
      req('ground', 'MINOR', { type: 'MIN_GROUND_DENSITY', value: 5 }),
      req('vol', 'MINOR', { type: 'MAX_VOLUME_ERROR_PCT', value: 50 }),
      req('blur', 'MINOR', { type: 'MAX_BLUR_FRACTION', value: 0.05 }),
      req('stealth', 'MINOR', { type: 'NOT_DETECTED' }),
      req('feat', 'MINOR', { type: 'FEATURE_CAPTURED', featureId: 'WELL' }),
    ],
  };

  function lidarGrid(density: number): LidarGrid {
    const n = 64 * 64;
    const cellAreaM2 = (240 / 64) * (160 / 64);
    const pulses = new Array<number>(n).fill(density * cellAreaM2);
    return {
      cols: 64,
      rows: 64,
      pulses,
      firstAbove: new Array<number>(n).fill(0),
      ground: [...pulses],
      cellAreaM2,
    };
  }

  it('todos os 18 tipos aparecem com o resultado esperado', () => {
    const ctx = context();
    const mission = syntheticMission(ALL, ctx.terrain, {
      lidar: { grid: lidarGrid(10), samples: [] },
      events: {
        collisions: 0,
        crashes: 0,
        detected: true,
        featuresCaptured: ['WELL'],
        ringsCollected: 0,
      },
    });
    const report = evaluateMission(mission, ALL, ctx);
    const byId = Object.fromEntries(report.requirements.map((r) => [r.id, r]));
    expect(report.requirements).toHaveLength(18);
    expect(byId.gsd?.pass).toBe(true);
    expect(byId.p?.pass).toBe(true);
    expect(byId.q?.pass).toBe(true);
    expect(byId.cov?.pass).toBe(true);
    expect(byId.kind).toMatchObject({ pass: true, valueText: 'RGB + LiDAR' });
    expect(byId.tier?.pass).toBe(false);
    expect(byId.akind?.pass).toBe(true);
    expect(byId.mode?.pass).toBe(false);
    expect(byId.pec?.valueText).toMatch(/^Classe [A-D]|^Fora/);
    expect(byId.asprs?.pass).toBe(false);
    expect(byId.gcp?.pass).toBe(true);
    expect(byId.cp?.pass).toBe(false);
    expect(byId.dens?.pass).toBe(true);
    expect(byId.ground?.pass).toBe(true);
    expect(byId.vol?.pass).toBe(true);
    expect(byId.blur?.pass).toBe(true);
    expect(byId.stealth).toMatchObject({ pass: false, valueText: 'Detectado' });
    expect(byId.feat).toMatchObject({ pass: true, valueText: 'Capturado' });
    expect(report.volume?.referenceM3).toBeGreaterThan(0);
    expect(report.lidarStats?.meanDensity).toBeCloseTo(10, 9);
    expect(report.asprs).toBeDefined();
    expect(report.pec?.altimetric).toBeDefined();
  });
});

describe('medições', () => {
  it('mediana da sobreposição longitudinal e sobreposição lateral estimada', () => {
    const terrain = createTerrain(C00_FIXTURE);
    const m = syntheticMission(C00_FIXTURE, terrain);
    const p = medianForwardOverlapPct(m.shots) as number;
    expect(p).toBeGreaterThan(65);
    expect(p).toBeLessThan(75);
    const q = estimatedSideOverlapPct(m) as number;
    expect(q).toBeGreaterThan(55);
    expect(medianForwardOverlapPct([])).toBeNull();
    expect(estimatedSideOverlapPct({ ...m, shots: [] })).toBeNull();
    // Uma linha desviada 10 m reduz a sobreposição lateral estimada.
    const shifted = {
      ...m,
      shots: m.shots.map((s) => (s.lineIndex === 2 ? { ...s, v: s.v + 10 } : s)),
    };
    expect(estimatedSideOverlapPct(shifted) as number).toBeLessThan(q);
  });

  it('densidades LiDAR médias e cobertura derivada do LiDAR (OQ-008)', () => {
    const grid: LidarGrid = {
      cols: 64,
      rows: 64,
      pulses: new Array<number>(4096).fill(20),
      firstAbove: [],
      ground: new Array<number>(4096).fill(5),
      cellAreaM2: 2,
    };
    expect(lidarStats({}, [])).toBeUndefined();
    expect(lidarStats({ lidar: { grid, samples: [] } }, [])).toEqual({
      meanDensity: 10,
      meanGroundDensity: 2.5,
    });
    expect(lidarStats({ lidar: { grid, samples: [] } }, [...Array(4096).keys()])).toEqual({
      meanDensity: 0,
      meanGroundDensity: 0,
    });
    const cov = lidarCoverage(
      { lidar: { grid, samples: [] } },
      { widthM: 128, lengthM: 128 },
      [],
      10,
    );
    expect(cov.green).toBe(1);
    expect(
      lidarCoverage({ lidar: { grid, samples: [] } }, { widthM: 128, lengthM: 128 }, [], 40).green,
    ).toBe(0);
    expect(lidarCoverage({}, { widthM: 128, lengthM: 128 }, [], 10).red).toBe(1);
  });
});

describe('score e fator de qualidade', () => {
  it('score = 0,4·acc + 0,3·cov + 0,2·gsd + 0,1·clean', () => {
    expect(qualityScore({ acc: 1, cov: 1, gsd: 1, clean: 1 })).toBeCloseTo(1, 12);
    expect(qualityScore({ acc: 0.5, cov: 0, gsd: 1, clean: 0 })).toBeCloseTo(0.4, 12);
    expect(toleranceScore(0.17, 0.17)).toBe(0.5);
    expect(toleranceScore(0.34, 0.17)).toBe(1);
    expect(toleranceScore(0.1, 0.4)).toBe(0);
    expect(toleranceScore(1, 0)).toBe(1);
  });

  it('Q: crítico 0,10; MAJOR ×0,85, MINOR ×0,95; +0,10 com classe melhor', () => {
    const r = (severity: 'MAJOR' | 'MINOR' | 'CRITICAL', pass: boolean) => ({
      id: 'x',
      label: 'x',
      severity,
      pass,
      valueText: '',
    });
    expect(qualityFactor(0.8, true, [], true)).toBe(0.1);
    expect(qualityFactor(0.8, false, [], false)).toBeCloseTo(0.92, 12);
    expect(
      qualityFactor(0.8, false, [r('MAJOR', false), r('MINOR', false), r('MAJOR', true)], false),
    ).toBeCloseTo(0.92 * 0.85 * 0.95, 12);
    expect(qualityFactor(1, false, [], true)).toBeCloseTo(1.1, 12);
  });
});
