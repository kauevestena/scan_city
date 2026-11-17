/** Fichas das Fendas Dimensionais (contracts-rifts): uma por tarefa T060–T070. */
import { act } from '@testing-library/react';
import { CATALOG, getAircraft, getSensor, HARDWARE } from '@/data/catalog';
import { MARKER_ACCESS } from '@/data/overworld/map';
import { computePayment, computeRewards } from '@/domain/economy';
import { createCoverageGrid } from '@/domain/coverage';
import { capturedFeatures } from '@/domain/features';
import { classifyPec } from '@/domain/standards';
import {
  borderMeanElevation,
  meanDepthM,
  measuredVolumeM3,
  referenceVolumeM3,
  volumeErrorPct,
} from '@/domain/volumetrics';
import { buildFlightPlan } from '@/domain/flightPlanner';
import { predictRequirements } from '@/domain/requirements';
import {
  estimatedSideOverlapPct,
  evaluateMission,
  medianForwardOverlapPct,
  type MissionContext,
} from '@/domain/mission';
import { neutralModifiers } from '@/domain/modifiers';
import { FlightEngine, type SortieResult } from '@/engines/flight/FlightEngine';
import { generateProduct } from '@/engines/raster/products';
import { referenceParams, referencePoints, syntheticMission } from '@/domain/referencePlan';
import { resolveRuleEffects, RULE_PARAMS } from '@/domain/specialRules';
import { mulberry32 } from '@/lib/rng';
import { useGameStore } from '@/state/store';
import { resetGameStore } from '@/test/resetStore';
import type { Contract, MissionData, Shot, VehicleId } from '@/types';
import { isReachable } from '@/world/overworld/pathfinding';
import { WORLD_MAP } from '@/world/overworld/tiles';
import { createTerrain } from '@/world/terrain/createTerrain';
import { CONTRACTS, getContract } from '.';
import { R01, R02, R03, R04, R05, R06, R07, R08, R09, R10, R11, RIFT_CONTRACTS } from './rifts';

/** Voa o plano de referência inteiro, com o autopilot, a 1×: o resultado da surtida e a energia gasta. */
function fly(
  contract: Contract,
  onFrame?: (e: FlightEngine) => void,
): { result: SortieResult; used: number; shots: Shot[] } {
  const mission: MissionData = {
    id: `${contract.id}-sim`,
    contractId: contract.id,
    createdAt: 0,
    rivalAdjustment: 1,
    isReplay: false,
    plan: buildFlightPlan(referenceParams(contract), contract, CATALOG),
    groundPoints: [],
    fieldEquipmentId: 'TOTAL_STATION',
    minigames: {},
    atlasCalibrated: false,
    sorties: [],
    completedLines: [],
    shots: [],
    events: {
      collisions: 0,
      crashes: 0,
      detected: false,
      featuresCaptured: [],
      ringsCollected: 0,
    },
    status: 'IN_FLIGHT',
  };
  let result: SortieResult | undefined;
  const shots: Shot[] = [];
  let now = 0;
  const e = new FlightEngine({
    mission,
    contract,
    terrain: createTerrain(contract),
    catalog: CATALOG,
    input: { axis: () => 0 },
    mods: neutralModifiers(),
    ownsRtkKit: true,
    autopilot: true,
    quality: () => 'LOW',
    reduceFlashes: () => false,
    colors: { primary: '#64748b', secondary: '#0f172a' },
    sortie: 0,
    shotOffset: 0,
    onSortieEnd: (r) => (result = r),
    onShots: (batch) => shots.push(...batch),
    now: () => (now += 200),
  });
  for (let t = 0; t < 900 && e.phase !== 'POST_FLIGHT'; t += 1 / 60) {
    e.update(1 / 60);
    onFrame?.(e);
  }
  if (!result) throw new Error('o voo não terminou');
  return { result, used: 1 - e.energy, shots };
}

describe('catálogo das fendas', () => {
  it('as fendas do catálogo são só de dimensão RIFT, entram em CONTRACTS e seguem a ordem dos ids', () => {
    expect(RIFT_CONTRACTS.every((c) => c.dimension === 'RIFT')).toBe(true);
    expect(RIFT_CONTRACTS.map((c) => c.id)).toEqual([
      'R01',
      'R02',
      'R03',
      'R04',
      'R05',
      'R06',
      'R07',
      'R08',
      'R09',
      'R10',
      'R11',
    ]);
    for (const c of RIFT_CONTRACTS) expect(CONTRACTS).toContain(c);
    expect(getContract('R01')).toBe(R01);
    expect(getContract('R02')).toBe(R02);
    expect(getContract('R03')).toBe(R03);
    expect(getContract('R04')).toBe(R04);
    expect(getContract('R05')).toBe(R05);
    expect(getContract('R06')).toBe(R06);
    expect(getContract('R07')).toBe(R07);
    expect(getContract('R08')).toBe(R08);
    expect(getContract('R09')).toBe(R09);
    expect(getContract('R10')).toBe(R10);
    expect(getContract('R11')).toBe(R11);
  });

  it('concluir o C01 libera a R01 e a R02 de uma vez: a aba Fendas aparece, com um aviso de anomalia para cada', () => {
    resetGameStore();
    const get = () => useGameStore.getState();
    expect(get().contracts.R01?.status).toBe('LOCKED');
    expect(get().contracts.R02?.status).toBe('LOCKED');
    expect(get().world.discoveredRifts).toEqual([]);
    act(() => {
      useGameStore.setState((s) => ({
        contracts: {
          ...s.contracts,
          C00: { status: 'COMPLETED', completions: 1, bestScore: 0.9 },
          C01: { status: 'COMPLETED', completions: 1, bestScore: 0.9 },
        },
        stats: { ...s.stats, contractsCompleted: 2 },
      }));
      get().refreshUnlocks();
    });
    expect(get().contracts.R01?.status).toBe('AVAILABLE');
    expect(get().contracts.R02?.status).toBe('AVAILABLE');
    expect(get().world.discoveredRifts).toEqual(['R01', 'R02']);
    expect(
      get()
        .session.toasts.filter((t) => t.type === 'rift')
        .map((t) => t.title),
    ).toEqual([
      'Anomalia dimensional detectada: Colinas Verdes dos Espinhos',
      'Anomalia dimensional detectada: Reino dos Encanamentos',
    ]);
  });
});

describe('R01 — Colinas Verdes dos Espinhos', () => {
  const terrain = createTerrain(R01);
  // O Atlas não tem RTK: sem kit GNSS, como o jogador tem no início.
  const context = (): MissionContext => ({
    catalog: CATALOG,
    terrain,
    ownsRtkKit: false,
    modifiers: neutralModifiers(),
    staff: { INTERN: 0, JUNIOR_ENG: 0 },
    hardware: HARDWARE[0] as (typeof HARDWARE)[number],
    inField: false,
    firstApproval: true,
    rng: mulberry32(7),
    deps: { computePayment, computeRewards },
  });
  const events = (ringsCollected: number) => ({
    collisions: 0,
    crashes: 0,
    detected: false,
    featuresCaptured: [],
    ringsCollected,
  });

  it('conforme a ficha: AOI, teto, sol alto, vento, regras, requisitos, recompensa e museu', () => {
    expect(R01.title).toBe('Colinas Verdes dos Espinhos');
    expect(R01.client.name).toBe('Sonisvaldo');
    expect(R01.client.portrait).toEqual({
      shape: 'CIRCLE',
      icon: 'Zap',
      primary: '#2563eb',
      secondary: '#ef4444',
      initials: 'SV',
    });
    expect([R01.dimension, R01.biome, R01.seed]).toEqual(['RIFT', 'RIFT_GREEN_HILLS', 9101]);
    expect(R01.aoi).toEqual({ widthM: 200, lengthM: 400 });
    expect([R01.ceilingM, R01.terrainReliefM]).toEqual([100, 35]);
    expect(R01.lightingOptions).toEqual(['SUN_HIGH']);
    expect(R01.wind).toEqual({ meanMs: 3, gustMs: 2, directionDeg: 90 });
    expect(R01.specialRules).toEqual(['EM_INTERFERENCE', 'COLLECTIBLE_RINGS']);
    expect(R01.requirements.slice(0, -1).map((r) => [r.severity, r.check])).toEqual([
      ['CRITICAL', { type: 'MAX_GSD_CM', value: 3 }],
      ['CRITICAL', { type: 'MIN_COVERAGE_GREEN', value: 0.8 }],
      ['MAJOR', { type: 'MIN_GCP', value: 4 }],
      ['MAJOR', { type: 'ACCURACY_PEC', cls: 'B', scaleDenominator: 1000 }],
    ]);
    expect(R01.recommended).toMatchObject({
      aircraft: ['ATLAS', 'DRONE_T1'],
      vehicle: 'FOOT_BIKE',
    });
    expect(R01.minVehicle).toBe('FOOT_BIKE');
    expect([R01.basePaymentBRL, R01.xp, R01.reputationReward]).toEqual([2_500_000, 500, 5]);
    expect(R01.souvenirId).toBe('SV_GOLD_RING');
    expect(R01.museum).toEqual({ wing: 'RIFT', slot: 0, incomePerMinBRL: 8000 });
    expect(R01.unlock).toEqual({ type: 'CONTRACT_DONE', contractId: 'C01' });
    expect(R01.overworldMarker).toBe('a');
    expect(
      [R01.dialogs.briefing, R01.dialogs.success, R01.dialogs.failure].map((d) => d.length),
    ).toEqual([3, 1, 1]);
  });

  it('o portal `a` é de quem vai a pé ou de bicicleta: o escritório o alcança com o veículo inicial', () => {
    expect(MARKER_ACCESS[R01.overworldMarker]).toBe('FOOT_BIKE');
    const marker = WORLD_MAP.markers.find((m) => m.char === R01.overworldMarker) as {
      kind: string;
      x: number;
      y: number;
    };
    expect(marker.kind).toBe('RIFT');
    const reach = (v: VehicleId) => isReachable(WORLD_MAP, WORLD_MAP.door, marker, v);
    expect(reach('FOOT_BIKE')).toBe(true);
  });

  it('o plano de referência voa o Atlas com a câmera do peito: GSD 2,31 cm, 8 linhas e 473,4 s, dentro da autonomia', () => {
    const ref = R01.referencePlan;
    expect(ref).toMatchObject({
      aircraftId: 'ATLAS',
      sensorId: 'CAM_PIGEON',
      heightM: 55,
      forwardOverlapPct: 70,
      sideOverlapPct: 60,
      speedMs: 9,
      lighting: 'SUN_HIGH',
    });
    expect(ref.gcps).toEqual([
      { u: 30, v: 30 },
      { u: 370, v: 30 },
      { u: 30, v: 170 },
      { u: 370, v: 170 },
      { u: 200, v: 100 },
    ]);
    expect(ref.expected).toEqual({ gsdCm: 2.31, nLines: 8, flightTimeS: 473.4 });
    const plan = buildFlightPlan(referenceParams(R01), R01, CATALOG);
    expect(plan.stats.gsdM * 100).toBeCloseTo(2.31, 2);
    expect(plan.stats.nLines).toBe(8);
    expect(plan.stats.flightTimeS).toBeCloseTo(473.4, 0);
    // O Atlas completa a pista numa só surtida: 473 s de voo para 600 s de autonomia.
    const atlas = getAircraft('ATLAS');
    expect(plan.stats.flightTimeS).toBeLessThan(atlas.enduranceS);
    expect(plan.stats.batteriesNeeded).toBe(1);
    // A altura do plano cabe no teto do Atlas e no do contrato.
    expect(ref.heightM).toBeLessThanOrEqual(atlas.hMaxM);
    expect(ref.heightM).toBeLessThanOrEqual(R01.ceilingM);
  });

  it('a interferência eletromagnética pesa para os drones, mas o Atlas é imune', () => {
    const fx = resolveRuleEffects(R01.specialRules);
    expect(fx.flight.emInterference).not.toBeNull();
    expect(getAircraft('ATLAS').emImmune).toBe(true);
    expect(getAircraft('DRONE_T1').emImmune).toBe(false);
  });

  it('com o plano de referência (missão sintética), o relatório aprova sem anéis', () => {
    const mission = syntheticMission(R01, terrain, CATALOG);
    expect(mission.events.ringsCollected).toBe(0);
    const report = evaluateMission(mission, R01, context());
    expect(report.critical).toBe(false);
    expect(report.approved).toBe(true);
    expect(report.requirements.every((r) => r.pass)).toBe(true);
    expect(report.requirements.slice(0, -1).map((r) => r.id)).toEqual([
      'R01-gsd',
      'R01-cov',
      'R01-gcp',
      'R01-pec',
    ]);
    expect(report.payment.ringBonusBRL).toBeUndefined();
  });

  it('anéis coletáveis somam bônus: R$ 50 por anel ao pagamento (até R$ 2.000 pelos 40)', () => {
    const effects = resolveRuleEffects(R01.specialRules);
    expect(effects.flight.rings?.bonusCents).toBe(5000);
    expect(effects.flight.rings?.bonusCents).toBe(RULE_PARAMS.rings.bonusCents);
    const pay = (rings: number) =>
      evaluateMission(
        syntheticMission(R01, terrain, CATALOG, { events: events(rings) }),
        R01,
        context(),
      ).payment;
    const none = pay(0);
    const seven = pay(7);
    const all = pay(40);
    expect(seven.ringBonusBRL).toBe(35_000);
    expect(all.ringBonusBRL).toBe(200_000);
    // O bônus é somado ao total, sem mexer no resto do pagamento.
    expect(seven.totalBRL - none.totalBRL).toBe(35_000);
    expect(all.totalBRL - none.totalBRL).toBe(200_000);
    expect(seven.baseBRL).toBe(none.baseBRL);
    expect(seven.qualityFactor).toBe(none.qualityFactor);
  });
});

describe('R02 — Reino dos Encanamentos', () => {
  const terrain = createTerrain(R02);
  // O T1 não tem RTK; o jogador começa sem o kit GNSS.
  const context = (): MissionContext => ({
    catalog: CATALOG,
    terrain,
    ownsRtkKit: false,
    modifiers: neutralModifiers(),
    staff: { INTERN: 0, JUNIOR_ENG: 0 },
    hardware: HARDWARE[0] as (typeof HARDWARE)[number],
    inField: false,
    firstApproval: true,
    rng: mulberry32(7),
    deps: { computePayment, computeRewards },
  });

  it('conforme a ficha: AOI, teto, luzes, vento, regras, requisitos, recompensa e museu', () => {
    expect(R02.title).toBe('Reino dos Encanamentos');
    expect(R02.client.name).toBe('Seu Márcio Bross');
    expect(R02.client.portrait).toEqual({
      shape: 'CIRCLE',
      icon: 'Wrench',
      primary: '#dc2626',
      secondary: '#1d4ed8',
      initials: 'MB',
    });
    expect([R02.dimension, R02.biome, R02.seed]).toEqual(['RIFT', 'RIFT_PIPES', 9202]);
    expect(R02.aoi).toEqual({ widthM: 240, lengthM: 300 });
    expect([R02.ceilingM, R02.terrainReliefM]).toEqual([120, 20]);
    expect(R02.lightingOptions).toEqual(['SUN_HIGH', 'OVERCAST']);
    expect(R02.wind).toEqual({ meanMs: 2, gustMs: 1, directionDeg: 0 });
    expect(R02.specialRules).toEqual(['EM_INTERFERENCE', 'MOVING_HAZARDS']);
    expect(R02.requirements.slice(0, -1).map((r) => [r.severity, r.check])).toEqual([
      ['CRITICAL', { type: 'ACCURACY_PEC', cls: 'A', scaleDenominator: 1000, contourIntervalM: 1 }],
      ['CRITICAL', { type: 'MIN_COVERAGE_GREEN', value: 0.8 }],
      ['MAJOR', { type: 'MAX_GSD_CM', value: 3 }],
      ['MAJOR', { type: 'MIN_GCP', value: 5 }],
      ['MINOR', { type: 'MIN_CP', value: 2 }],
    ]);
    expect(R02.recommended).toMatchObject({
      aircraft: ['DRONE_T1', 'ATLAS'],
      vehicle: 'FOOT_BIKE',
    });
    expect(R02.minVehicle).toBe('FOOT_BIKE');
    expect([R02.basePaymentBRL, R02.xp, R02.reputationReward]).toEqual([3_000_000, 600, 5]);
    expect(R02.souvenirId).toBe('SV_GREEN_PIPE');
    expect(R02.museum).toEqual({ wing: 'RIFT', slot: 1, incomePerMinBRL: 9000 });
    expect(R02.unlock).toEqual({ type: 'CONTRACT_DONE', contractId: 'C01' });
    expect(R02.overworldMarker).toBe('b');
    expect(
      [R02.dialogs.briefing, R02.dialogs.success, R02.dialogs.failure].map((d) => d.length),
    ).toEqual([3, 1, 1]);
  });

  it('o portal `b` é de quem vai a pé ou de bicicleta, e as fendas têm setores distintos no museu', () => {
    expect(MARKER_ACCESS[R02.overworldMarker]).toBe('FOOT_BIKE');
    const marker = WORLD_MAP.markers.find((m) => m.char === R02.overworldMarker) as {
      kind: string;
      x: number;
      y: number;
    };
    expect(marker.kind).toBe('RIFT');
    expect(isReachable(WORLD_MAP, WORLD_MAP.door, marker, 'FOOT_BIKE')).toBe(true);
    const slots = RIFT_CONTRACTS.map((c) => c.museum.slot);
    expect(new Set(slots).size).toBe(slots.length);
    for (const c of RIFT_CONTRACTS) expect(c.museum.wing).toBe('RIFT');
  });

  it('o plano de referência voa o Drone T1 com a câmera de 20 MP sob luz nublada: GSD 2,74 cm, 7 linhas, 386,8 s', () => {
    const ref = R02.referencePlan;
    expect(ref).toMatchObject({
      aircraftId: 'DRONE_T1',
      sensorId: 'CAM_20MP_RS',
      heightM: 100,
      forwardOverlapPct: 75,
      sideOverlapPct: 70,
      speedMs: 8,
      lighting: 'OVERCAST',
    });
    expect(ref.heightM).toBeLessThanOrEqual(R02.ceilingM);
    expect(ref.gcps).toHaveLength(5);
    expect(ref.cps).toEqual([
      { u: 90, v: 80 },
      { u: 210, v: 160 },
    ]);
    expect(ref.expected).toEqual({ gsdCm: 2.74, nLines: 7, flightTimeS: 386.8 });
    const plan = buildFlightPlan(referenceParams(R02), R02, CATALOG);
    expect(plan.stats.gsdM * 100).toBeCloseTo(2.74, 2);
    expect(plan.stats.nLines).toBe(7);
    expect(plan.stats.flightTimeS).toBeCloseTo(386.8, 0);
  });

  it('perigos móveis: a regra manda oscilar de 10 a 25 m em ciclos de 3 a 6 s, e o T1 não é imune à interferência', () => {
    const fx = resolveRuleEffects(R02.specialRules);
    expect(fx.flight.movingHazards).toEqual({ amplitudeM: [10, 25], periodS: [3, 6] });
    expect(fx.flight.emInterference).not.toBeNull();
    expect(getAircraft('DRONE_T1').emImmune).toBe(false);
  });

  it('PEC A altimétrico (equidistância de 1 m) é avaliado, e o relatório do plano de referência aprova', () => {
    const mission = syntheticMission(R02, terrain, CATALOG);
    expect(mission.groundPoints.filter((p) => p.kind === 'CP')).toHaveLength(2);
    const report = evaluateMission(mission, R02, context());
    expect(report.critical).toBe(false);
    expect(report.approved).toBe(true);
    expect(report.requirements.every((r) => r.pass)).toBe(true);
    expect(report.requirements.slice(0, -1).map((r) => r.id)).toEqual([
      'R02-pec',
      'R02-cov',
      'R02-gsd',
      'R02-gcp',
      'R02-cp',
    ]);
    // A altimetria entra na classificação: classe A exigida, no limite de 1 m de equidistância.
    const pec = report.pec;
    expect(pec?.scaleDenominator).toBe(1000);
    expect(pec?.requiredClass).toBe('A');
    expect(pec?.altimetric).toBeDefined();
    expect(pec?.altimetric?.pass).toBe(true);
    expect(pec?.altimetric?.achieved).toBe('A');
    expect(pec?.planimetric.pass).toBe(true);
    // Com CPs a acurácia é verificável.
    expect(report.rmse.cp).not.toBeNull();
  });

  it('a altimetria pesa: 30 cm de erro de cota nos pontos de checagem reprovam a classe A (limite de 27 cm)', () => {
    const check = R02.requirements[0]?.check;
    if (check?.type !== 'ACCURACY_PEC') throw new Error('R02-pec deveria ser um requisito PEC');
    const residuals = (dz: number) =>
      ['CP1', 'CP2'].map((pointId) => ({
        pointId,
        kind: 'CP' as const,
        dxM: 0.02,
        dyM: 0.01,
        dzM: dz,
      }));
    const at = (dz: number) =>
      classifyPec(residuals(dz), check.scaleDenominator, check.contourIntervalM, check.cls);
    // A classe A em 1:1.000 com Eq = 1 m: PEC de 27 cm e EP de 16,7 cm na altimetria.
    const ok = at(0.1);
    expect(ok.altimetric?.pecM).toBeCloseTo(0.27, 9);
    expect(ok.altimetric?.epM).toBeCloseTo(1 / 6, 9);
    expect(ok.altimetric?.pass).toBe(true);
    expect(ok.planimetric.pass).toBe(true);
    // Só a cota piora: a planimetria segue na classe A, mas a altimetria cai para a B.
    const bad = at(0.3);
    expect(bad.planimetric.pass).toBe(true);
    expect(bad.altimetric?.pass).toBe(false);
    expect(bad.altimetric?.achieved).toBe('B');
  });
});

describe('R08 — Bairro dos Santos', () => {
  const terrain = createTerrain(R08);
  // O T2 vem em combo com o kit GNSS: o plano de referência conta com ele.
  const context = (): MissionContext => ({
    catalog: CATALOG,
    terrain,
    ownsRtkKit: true,
    modifiers: neutralModifiers(),
    staff: { INTERN: 0, JUNIOR_ENG: 0 },
    hardware: HARDWARE[0] as (typeof HARDWARE)[number],
    inField: false,
    firstApproval: true,
    rng: mulberry32(7),
    deps: { computePayment, computeRewards },
  });

  it('conforme a ficha: AOI, teto, luzes, vento, regras, 7 requisitos, recompensa e museu', () => {
    expect(R08.title).toBe('Bairro dos Santos');
    expect(R08.client.name).toBe('Carlinhos Joilson (CJ)');
    expect(R08.client.portrait).toEqual({
      shape: 'CIRCLE',
      icon: 'Bike',
      primary: '#16a34a',
      secondary: '#f8fafc',
      initials: 'CJ',
    });
    expect([R08.dimension, R08.biome, R08.seed]).toEqual(['RIFT', 'RIFT_SANTOS_HOOD', 9808]);
    expect(R08.aoi).toEqual({ widthM: 240, lengthM: 300 });
    expect([R08.ceilingM, R08.terrainReliefM]).toEqual([120, 20]);
    expect(R08.lightingOptions).toEqual(['SUN_HIGH', 'GOLDEN_HOUR', 'OVERCAST']);
    expect(R08.wind).toEqual({ meanMs: 3, gustMs: 2, directionDeg: 0 });
    expect(R08.specialRules).toEqual(['EM_INTERFERENCE', 'LOW_WIRES']);
    expect(R08.requirements.slice(0, -1).map((r) => [r.severity, r.check])).toEqual([
      ['CRITICAL', { type: 'ACCURACY_PEC', cls: 'A', scaleDenominator: 1000 }],
      ['CRITICAL', { type: 'MIN_COVERAGE_GREEN', value: 0.85 }],
      ['MAJOR', { type: 'MAX_GSD_CM', value: 2 }],
      ['MAJOR', { type: 'MIN_FORWARD_OVERLAP', value: 80 }],
      ['MAJOR', { type: 'MIN_SIDE_OVERLAP', value: 70 }],
      ['MAJOR', { type: 'MIN_GCP', value: 5 }],
      ['MINOR', { type: 'MIN_CP', value: 3 }],
    ]);
    expect(R08.recommended).toMatchObject({ aircraft: ['DRONE_T2'], sensors: ['CAM_45MP_FF'] });
    expect(R08.minVehicle).toBe('FOOT_BIKE');
    expect([R08.basePaymentBRL, R08.xp, R08.reputationReward]).toEqual([2_800_000, 700, 5]);
    expect(R08.souvenirId).toBe('SV_BMX');
    expect(R08.museum).toEqual({ wing: 'RIFT', slot: 7, incomePerMinBRL: 8500 });
    expect(R08.unlock).toEqual({ type: 'CONTRACT_DONE', contractId: 'C05' });
    expect(R08.overworldMarker).toBe('h');
    expect(
      [R08.dialogs.briefing, R08.dialogs.success, R08.dialogs.failure].map((d) => d.length),
    ).toEqual([3, 1, 1]);
  });

  it('o portal `h` é de quem vai a pé ou de bicicleta, e o slot 7 do museu é só dele', () => {
    expect(MARKER_ACCESS[R08.overworldMarker]).toBe('FOOT_BIKE');
    const marker = WORLD_MAP.markers.find((m) => m.char === R08.overworldMarker) as {
      kind: string;
      x: number;
      y: number;
    };
    expect(marker.kind).toBe('RIFT');
    expect(isReachable(WORLD_MAP, WORLD_MAP.door, marker, 'FOOT_BIKE')).toBe(true);
    const slots = RIFT_CONTRACTS.map((c) => c.museum.slot);
    expect(new Set(slots).size).toBe(slots.length);
  });

  it('o plano de referência voa o T2 com a câmera de 45 MP e a lente de 35 mm: GSD 1,00 cm, 11 linhas, 575,8 s', () => {
    const ref = R08.referencePlan;
    expect(ref).toMatchObject({
      aircraftId: 'DRONE_T2',
      sensorId: 'CAM_45MP_FF',
      lensId: 'LENS_35',
      heightM: 80,
      forwardOverlapPct: 80,
      sideOverlapPct: 70,
      speedMs: 8,
      lighting: 'SUN_HIGH',
    });
    expect(ref.heightM).toBeLessThanOrEqual(R08.ceilingM);
    expect(ref.gcps).toHaveLength(5);
    expect(ref.cps).toHaveLength(3);
    expect(ref.expected).toEqual({ gsdCm: 1, nLines: 11, flightTimeS: 575.8 });
    const plan = buildFlightPlan(referenceParams(R08), R08, CATALOG);
    expect(plan.stats.gsdM * 100).toBeCloseTo(1.0, 1);
    expect(plan.stats.nLines).toBe(11);
    expect(plan.stats.flightTimeS).toBeCloseTo(575.8, 0);
    expect(plan.stats.totalPhotos).toBe(330);
    expect(plan.stats.batteriesNeeded).toBe(1);
  });

  it('fiação baixa e interferência: os fios ficam a 8–14 m (±1 m de tolerância na colisão) e o T2 sofre a interferência', () => {
    const fx = resolveRuleEffects(R08.specialRules);
    expect(fx.terrain.lowWires).toEqual({
      poleSpacingM: [30, 40],
      wireHeightM: [8, 14],
    });
    expect(fx.flight.wireCollisions).toEqual({ hitToleranceM: 1 });
    expect(fx.flight.emInterference).not.toBeNull();
    expect(getAircraft('DRONE_T2').emImmune).toBe(false);
  });

  it('com o plano de referência (missão sintética), o relatório aprova; a sobreposição lateral, sem folga, fica na casa de 70 %', () => {
    const mission = syntheticMission(R08, terrain, CATALOG);
    expect(mission.groundPoints.filter((p) => p.kind === 'CP')).toHaveLength(3);
    const report = evaluateMission(mission, R08, context());
    expect(report.critical).toBe(false);
    expect(report.approved).toBe(true);
    expect(report.requirements.slice(0, -1).map((r) => r.id)).toEqual([
      'R08-pec',
      'R08-cov',
      'R08-gsd',
      'R08-fwd',
      'R08-side',
      'R08-gcp',
      'R08-cp',
    ]);
    // A ficha pede q ≥ 70 % e o plano de referência tem q = 70 %, sem folga: com 20 m de relevo a
    // faixa estreita nos morros, e a estimativa (Jensen: 1 − s/W é côncava em W) cai uns 0,03 ponto.
    // É por isso que o briefing manda dar folga ao q. Nada mais falha.
    const failed = report.requirements.filter((r) => !r.pass).map((r) => r.id);
    expect(failed.every((id) => id === 'R08-side')).toBe(true);
    const q = estimatedSideOverlapPct(mission) as number;
    expect(q).toBeGreaterThan(69.9);
    expect(q).toBeLessThan(70.1);
    expect(R08.recommended.notes).toContain('dê folga ao q');
    // O relatório não esconde a falta atrás do "70 %" arredondado: mostra as casas decimais.
    const side = report.requirements.find((r) => r.id === 'R08-side');
    if (side && !side.pass) expect(side.valueText.replace(/\s/g, ' ')).toMatch(/^69,\d{2} %$/);
    // Sem equidistância, só a planimetria entra no PEC.
    expect(report.pec?.altimetric).toBeUndefined();
    expect(report.pec?.planimetric.pass).toBe(true);
    expect(report.coverage.green).toBeGreaterThanOrEqual(0.85);
  });

  it('com 2 pontos percentuais de folga no q, a sobreposição lateral passa', () => {
    const plan = { ...R08, referencePlan: { ...R08.referencePlan, sideOverlapPct: 72 } };
    const mission = syntheticMission(plan, terrain, CATALOG);
    const report = evaluateMission(mission, plan, context());
    expect(report.requirements.find((r) => r.id === 'R08-side')?.pass).toBe(true);
    expect(estimatedSideOverlapPct(mission) as number).toBeGreaterThan(71.9);
  });

  it('concluir o C05 libera a R08 e a R11 de uma vez, e só elas: as fendas são descobertas e saem dois avisos', () => {
    resetGameStore();
    const get = () => useGameStore.getState();
    const done = { status: 'COMPLETED' as const, completions: 1, bestScore: 0.9 };
    act(() => {
      useGameStore.setState((s) => ({
        contracts: { ...s.contracts, C00: done, C01: done },
        stats: { ...s.stats, contractsCompleted: 2 },
      }));
      get().refreshUnlocks({ silent: true });
    });
    // Com o C01 só as duas primeiras fendas abrem; a R08 e a R11 esperam o C05.
    expect(get().contracts.R08?.status).toBe('LOCKED');
    expect(get().contracts.R11?.status).toBe('LOCKED');
    expect(get().world.discoveredRifts).toEqual(['R01', 'R02']);
    act(() => {
      useGameStore.setState((s) => ({
        contracts: { ...s.contracts, C05: done },
        stats: { ...s.stats, contractsCompleted: 3 },
      }));
      get().refreshUnlocks();
    });
    expect(get().contracts.R08?.status).toBe('AVAILABLE');
    expect(get().contracts.R11?.status).toBe('AVAILABLE');
    expect(get().world.discoveredRifts).toEqual(['R01', 'R02', 'R08', 'R11']);
    expect(
      get()
        .session.toasts.filter((t) => t.type === 'rift')
        .map((t) => t.title),
    ).toEqual([
      'Anomalia dimensional detectada: Bairro dos Santos',
      'Anomalia dimensional detectada: Tumbas dos Desfiladeiros',
    ]);
  });
});

describe('R11 — Tumbas dos Desfiladeiros', () => {
  const terrain = createTerrain(R11);
  // O T2 vem em combo com o kit GNSS.
  const context = (): MissionContext => ({
    catalog: CATALOG,
    terrain,
    ownsRtkKit: true,
    modifiers: neutralModifiers(),
    staff: { INTERN: 0, JUNIOR_ENG: 0 },
    hardware: HARDWARE[0] as (typeof HARDWARE)[number],
    inField: false,
    firstApproval: true,
    rng: mulberry32(7),
    deps: { computePayment, computeRewards },
  });

  it('conforme a ficha: AOI, teto, luzes, vento do cânion, 4 regras, 5 requisitos, recompensa e museu', () => {
    expect(R11.title).toBe('Tumbas dos Desfiladeiros');
    expect(R11.client.name).toBe('Dona Laura da Silva');
    expect(R11.client.portrait).toEqual({
      shape: 'DIAMOND',
      icon: 'Crosshair',
      primary: '#0d9488',
      secondary: '#78350f',
      initials: 'LS',
    });
    expect([R11.dimension, R11.biome, R11.seed]).toEqual(['RIFT', 'RIFT_CLIFF_TOMBS', 9111]);
    expect(R11.aoi).toEqual({ widthM: 240, lengthM: 400 });
    expect([R11.ceilingM, R11.terrainReliefM]).toEqual([120, 100]);
    expect(R11.lightingOptions).toEqual(['SUN_HIGH', 'GOLDEN_HOUR', 'OVERCAST']);
    expect(R11.wind).toEqual({ meanMs: 5, gustMs: 4, directionDeg: 90 });
    expect(R11.specialRules).toEqual([
      'EM_INTERFERENCE',
      'VERTICAL_CLIFFS',
      'FEATURE_TARGETS',
      'PAINT_MARKERS',
    ]);
    expect(R11.requirements.slice(0, -1).map((r) => [r.severity, r.check])).toEqual([
      ['CRITICAL', { type: 'FLIGHT_MODE', value: 'OBLIQUE' }],
      ['CRITICAL', { type: 'FEATURE_CAPTURED', featureId: 'TEMPLE_FACADE' }],
      ['MAJOR', { type: 'MIN_COVERAGE_GREEN', value: 0.75 }],
      ['MAJOR', { type: 'ACCURACY_ASPRS', horizontalCm: 6, verticalCm: 8 }],
      ['MAJOR', { type: 'MIN_GCP', value: 5 }],
    ]);
    expect(R11.recommended).toMatchObject({ aircraft: ['DRONE_T2'], sensors: ['CAM_45MP_FF'] });
    expect(R11.minVehicle).toBe('FOOT_BIKE');
    expect([R11.basePaymentBRL, R11.xp, R11.reputationReward]).toEqual([6_500_000, 1100, 5]);
    expect(R11.souvenirId).toBe('SV_PAINT_PISTOL');
    expect(R11.museum).toEqual({ wing: 'RIFT', slot: 10, incomePerMinBRL: 13_000 });
    expect(R11.unlock).toEqual({ type: 'CONTRACT_DONE', contractId: 'C05' });
    expect(R11.overworldMarker).toBe('k');
    expect(
      [R11.dialogs.briefing, R11.dialogs.success, R11.dialogs.failure].map((d) => d.length),
    ).toEqual([3, 1, 1]);
  });

  it('o portal `k` é de quem vai a pé ou de bicicleta, e o slot 10 do museu é só dele', () => {
    expect(MARKER_ACCESS[R11.overworldMarker]).toBe('FOOT_BIKE');
    const marker = WORLD_MAP.markers.find((m) => m.char === R11.overworldMarker) as {
      kind: string;
      x: number;
      y: number;
    };
    expect(marker.kind).toBe('RIFT');
    expect(isReachable(WORLD_MAP, WORLD_MAP.door, marker, 'FOOT_BIKE')).toBe(true);
    const slots = RIFT_CONTRACTS.map((c) => c.museum.slot);
    expect(new Set(slots).size).toBe(slots.length);
  });

  it('o plano de referência voa oblíquo a 45°: T2, câmera de 45 MP, lente de 24 mm, GSD 1,28 cm, 9 linhas, 775,9 s', () => {
    const ref = R11.referencePlan;
    expect(ref).toMatchObject({
      aircraftId: 'DRONE_T2',
      sensorId: 'CAM_45MP_FF',
      lensId: 'LENS_24',
      heightM: 70,
      forwardOverlapPct: 80,
      sideOverlapPct: 70,
      speedMs: 6,
      modes: ['OBLIQUE'],
      obliqueDeg: 45,
      lighting: 'OVERCAST',
    });
    expect(ref.heightM).toBeLessThanOrEqual(R11.ceilingM);
    expect(ref.gcps).toHaveLength(5);
    expect(ref.cps).toHaveLength(0);
    expect(ref.expected).toEqual({ gsdCm: 1.28, nLines: 9, flightTimeS: 775.9 });
    const plan = buildFlightPlan(referenceParams(R11), R11, CATALOG);
    expect(plan.params.obliqueDeg).toBe(45);
    expect(plan.stats.gsdM * 100).toBeCloseTo(1.28, 2);
    expect(plan.stats.nLines).toBe(9);
    expect(plan.stats.flightTimeS).toBeCloseTo(775.9, 0);
    expect(plan.stats.batteriesNeeded).toBe(1);
  });

  it('o voo oblíquo é crítico: o plano previsto passa, e o mesmo plano sem inclinação reprova', () => {
    const points = referencePoints(R11, terrain);
    const ctx = { catalog: CATALOG, ownsRtkKit: true, fieldEquipmentId: 'TOTAL_STATION' as const };
    const oblique = buildFlightPlan(referenceParams(R11), R11, CATALOG);
    const [fixedMode] = predictRequirements(oblique, R11, points, ctx);
    expect(fixedMode?.id).toBe('R11-mode');
    expect(fixedMode?.pass).toBe(true);
    const { obliqueDeg: _tilt, ...nadirParams } = referenceParams(R11);
    const nadir = buildFlightPlan(nadirParams, R11, CATALOG);
    const [mode] = predictRequirements(nadir, R11, points, ctx);
    expect(mode?.pass).toBe(false);
    expect(mode?.severity).toBe('CRITICAL');
  });

  it('os efeitos das regras: paredões de 60–100 m (> 80°), alvos especiais e tinta nos GCPs', () => {
    const fx = resolveRuleEffects(R11.specialRules);
    expect(fx.terrain.verticalCliffs).toEqual({ minSlopeDeg: 80, heightM: [60, 100] });
    expect(fx.terrain.featureTargets).toBe(true);
    expect(fx.flight.featureCapture).toBe(true);
    expect(fx.field.paintMarkers).toBe(true);
    expect(fx.flight.emInterference).not.toBeNull();
  });

  it('a fachada do templo é capturada pelo plano de referência (≥ 3 fotos válidas cobrem o centro)', () => {
    const mission = syntheticMission(R11, terrain, CATALOG);
    const plan = mission.plan;
    const camera = getSensor(plan.params.sensorId);
    const capture = (shots: typeof mission.shots) =>
      capturedFeatures({ shots }, terrain, {
        aoi: R11.aoi,
        aircraftKind: getAircraft(plan.params.aircraftId).kind,
        sensor: camera,
        focalM: plan.stats.focalM,
        rules: { sensorKind: camera.kind, specularWater: false },
      });
    expect(plan.params.lensId).toBe('LENS_24');
    expect(capture(mission.shots)).toEqual(['TEMPLE_FACADE']);
    // Sem as linhas que passam pelo terraço do templo (as cinco primeiras), ninguém o fotografa.
    const away = mission.shots.filter((s) => s.lineIndex >= 6);
    expect(capture(away)).toEqual([]);
  });

  it('com o plano de referência (missão sintética), o relatório aprova e a fachada está capturada', () => {
    const mission = syntheticMission(R11, terrain, CATALOG);
    const report = evaluateMission(mission, R11, context());
    expect(report.critical).toBe(false);
    expect(report.approved).toBe(true);
    expect(report.requirements.slice(0, -1).map((r) => r.id)).toEqual([
      'R11-mode',
      'R11-facade',
      'R11-cov',
      'R11-asprs',
      'R11-gcp',
    ]);
    for (const id of ['R11-mode', 'R11-facade', 'R11-gcp']) {
      expect(report.requirements.find((r) => r.id === id)?.pass, id).toBe(true);
    }
    // Sem CPs na ficha, o ASPRS fica "não verificável" (GCP × 1,8) e quase no limite de 6 cm.
    expect(report.asprs?.horizontalCm).toBe(6);
    expect(report.asprs?.verticalCm).toBe(8);
    // O mesmo voo sem passar pelo terraço do templo reprova pelo crítico `R11-facade`.
    const away = { ...mission, shots: mission.shots.filter((s) => s.lineIndex >= 6) };
    const bad = evaluateMission(away, R11, context());
    expect(bad.requirements.find((r) => r.id === 'R11-facade')?.pass).toBe(false);
    expect(bad.critical).toBe(true);
    expect(bad.approved).toBe(false);
  });
});

describe('R06 — Pântano Cinzento', () => {
  const terrain = createTerrain(R06);
  const context = (): MissionContext => ({
    catalog: CATALOG,
    terrain,
    ownsRtkKit: true,
    modifiers: neutralModifiers(),
    staff: { INTERN: 0, JUNIOR_ENG: 0 },
    hardware: HARDWARE[0] as (typeof HARDWARE)[number],
    inField: false,
    firstApproval: true,
    rng: mulberry32(7),
    deps: { computePayment, computeRewards },
  });
  /** O mesmo plano de referência com a câmera RGB de 45 MP no lugar da termal. */
  const rgbContract = {
    ...R06,
    referencePlan: { ...R06.referencePlan, sensorId: 'CAM_45MP_FF', lensId: 'LENS_24' as const },
  };

  it('conforme a ficha: AOI, teto, luzes, regras, 6 requisitos, recompensa e museu', () => {
    expect(R06.title).toBe('Pântano Cinzento');
    expect(R06.client.name).toBe('Geraldo de Rívia');
    expect(R06.client.portrait).toEqual({
      shape: 'SHIELD',
      icon: 'Sword',
      primary: '#94a3b8',
      secondary: '#0f172a',
      initials: 'GR',
    });
    expect([R06.dimension, R06.biome, R06.seed]).toEqual(['RIFT', 'RIFT_GREY_SWAMP', 9606]);
    expect(R06.aoi).toEqual({ widthM: 200, lengthM: 300 });
    expect([R06.ceilingM, R06.terrainReliefM]).toEqual([120, 8]);
    expect(R06.lightingOptions).toEqual(['OVERCAST', 'GOLDEN_HOUR']);
    expect(R06.wind).toEqual({ meanMs: 3, gustMs: 2, directionDeg: 0 });
    expect(R06.specialRules).toEqual(['EM_INTERFERENCE', 'FEATURE_TARGETS']);
    expect(R06.requirements.slice(0, -1).map((r) => [r.severity, r.check])).toEqual([
      ['CRITICAL', { type: 'SENSOR_KIND', value: 'THERMAL' }],
      ['CRITICAL', { type: 'FEATURE_CAPTURED', featureId: 'DEN_A' }],
      ['MAJOR', { type: 'FEATURE_CAPTURED', featureId: 'DEN_B' }],
      ['MAJOR', { type: 'FEATURE_CAPTURED', featureId: 'DEN_C' }],
      ['MAJOR', { type: 'MIN_COVERAGE_GREEN', value: 0.7 }],
      ['MINOR', { type: 'MAX_GSD_CM', value: 14 }],
    ]);
    expect(R06.recommended).toMatchObject({
      aircraft: ['DRONE_T2'],
      sensors: ['CAM_THERMAL'],
      vehicle: 'PICKUP_4X4',
    });
    expect([R06.basePaymentBRL, R06.xp, R06.reputationReward]).toEqual([6_000_000, 1100, 5]);
    expect(R06.souvenirId).toBe('SV_THEODOLITE_SWORD');
    expect(R06.museum).toEqual({ wing: 'RIFT', slot: 5, incomePerMinBRL: 13_000 });
    expect(R06.unlock).toEqual({ type: 'CONTRACT_DONE', contractId: 'C06' });
    expect(R06.overworldMarker).toBe('f');
    expect(
      [R06.dialogs.briefing, R06.dialogs.success, R06.dialogs.failure].map((d) => d.length),
    ).toEqual([3, 1, 1]);
  });

  it('4x4 para chegar: o portal `f` só se alcança de picape, como o do C03 e o do C04', () => {
    expect(R06.minVehicle).toBe('PICKUP_4X4');
    expect(MARKER_ACCESS[R06.overworldMarker]).toBe('PICKUP_4X4');
    const marker = WORLD_MAP.markers.find((m) => m.char === R06.overworldMarker) as {
      kind: string;
      x: number;
      y: number;
    };
    expect(marker.kind).toBe('RIFT');
    const reach = (v: VehicleId) => isReachable(WORLD_MAP, WORLD_MAP.door, marker, v);
    expect(reach('PICKUP_4X4')).toBe(true);
    for (const v of ['FOOT_BIKE', 'COMPACT_CAR', 'LAB_VAN'] as const) {
      expect(reach(v), v).toBe(false);
    }
    // Slot do museu distinto dos das outras fendas.
    const slots = RIFT_CONTRACTS.map((c) => c.museum.slot);
    expect(new Set(slots).size).toBe(slots.length);
  });

  it('o plano de referência voa o T2 com a câmera termal: GSD 13,08 cm, 8 linhas, 426,6 s, sem pontos de apoio', () => {
    const ref = R06.referencePlan;
    expect(ref).toMatchObject({
      aircraftId: 'DRONE_T2',
      sensorId: 'CAM_THERMAL',
      heightM: 100,
      forwardOverlapPct: 75,
      sideOverlapPct: 65,
      speedMs: 8,
      lighting: 'OVERCAST',
      gcps: [],
      cps: [],
    });
    expect(getSensor(ref.sensorId).kind).toBe('THERMAL');
    expect(ref.expected).toEqual({ gsdCm: 13.08, nLines: 8, flightTimeS: 426.6 });
    const plan = buildFlightPlan(referenceParams(R06), R06, CATALOG);
    expect(plan.stats.gsdM * 100).toBeCloseTo(13.08, 2);
    expect(plan.stats.nLines).toBe(8);
    expect(plan.stats.flightTimeS).toBeCloseTo(426.6, 0);
    expect(plan.stats.totalPhotos).toBe(160);
  });

  it('o sensor térmico é obrigatório e crítico: o plano térmico passa, o mesmo plano com RGB reprova', () => {
    const ctx = { catalog: CATALOG, ownsRtkKit: true, fieldEquipmentId: 'TOTAL_STATION' as const };
    const thermal = buildFlightPlan(referenceParams(R06), R06, CATALOG);
    const [ok] = predictRequirements(thermal, R06, [], ctx);
    expect(ok?.id).toBe('R06-sensor');
    expect(ok?.pass).toBe(true);
    const rgb = buildFlightPlan(referenceParams(rgbContract), rgbContract, CATALOG);
    const [bad] = predictRequirements(rgb, R06, [], ctx);
    expect(bad?.pass).toBe(false);
    expect(bad?.severity).toBe('CRITICAL');
  });

  it('as tocas só são capturadas pelas fotos do sensor termal: as mesmas fotos RGB passam em branco', () => {
    const mission = syntheticMission(R06, terrain, CATALOG);
    const plan = mission.plan;
    const aircraftKind = getAircraft(plan.params.aircraftId).kind;
    const capture = (sensorId: string, focalM: number) => {
      const sensor = getSensor(sensorId);
      return capturedFeatures({ shots: mission.shots }, terrain, {
        aoi: R06.aoi,
        aircraftKind,
        sensor,
        focalM,
        rules: { sensorKind: sensor.kind, specularWater: false },
      });
    };
    expect(capture('CAM_THERMAL', plan.stats.focalM)).toEqual(['DEN_A', 'DEN_B', 'DEN_C']);
    expect(capture('CAM_45MP_FF', plan.stats.focalM)).toEqual([]);
  });

  it('com o plano de referência (missão sintética), o relatório aprova e as três tocas são capturadas', () => {
    const mission = syntheticMission(R06, terrain, CATALOG);
    expect(mission.groundPoints).toHaveLength(0);
    const report = evaluateMission(mission, R06, context());
    expect(report.critical).toBe(false);
    expect(report.approved).toBe(true);
    expect(report.requirements.slice(0, -1).map((r) => r.id)).toEqual([
      'R06-sensor',
      'R06-den-a',
      'R06-den-b',
      'R06-den-c',
      'R06-cov',
      'R06-gsd',
    ]);
    expect(report.requirements.every((r) => r.pass)).toBe(true);
  });

  it('voar com a câmera RGB reprova pelos dois críticos: sem sensor térmico e sem a toca A', () => {
    const mission = syntheticMission(rgbContract, terrain, CATALOG);
    const report = evaluateMission(mission, R06, context());
    const byId = (id: string) => report.requirements.find((r) => r.id === id);
    expect(byId('R06-sensor')?.pass).toBe(false);
    expect(byId('R06-den-a')?.pass).toBe(false);
    expect(byId('R06-den-b')?.pass).toBe(false);
    expect(report.critical).toBe(true);
    expect(report.approved).toBe(false);
  });

  it('concluir o C06 libera a R06 e a R07 de uma vez: as fendas são descobertas e saem dois avisos', () => {
    resetGameStore();
    const get = () => useGameStore.getState();
    const done = { status: 'COMPLETED' as const, completions: 1, bestScore: 0.9 };
    act(() => {
      useGameStore.setState((s) => ({
        contracts: { ...s.contracts, C00: done, C01: done },
        stats: { ...s.stats, contractsCompleted: 2 },
      }));
      get().refreshUnlocks({ silent: true });
    });
    expect(get().contracts.R06?.status).toBe('LOCKED');
    expect(get().contracts.R07?.status).toBe('LOCKED');
    act(() => {
      useGameStore.setState((s) => ({
        contracts: { ...s.contracts, C06: done },
        stats: { ...s.stats, contractsCompleted: 3 },
      }));
      get().refreshUnlocks();
    });
    expect(get().contracts.R06?.status).toBe('AVAILABLE');
    expect(get().contracts.R07?.status).toBe('AVAILABLE');
    expect(get().world.discoveredRifts).toEqual(['R01', 'R02', 'R06', 'R07']);
    expect(
      get()
        .session.toasts.filter((t) => t.type === 'rift')
        .map((t) => t.title),
    ).toEqual([
      'Anomalia dimensional detectada: Pântano Cinzento',
      'Anomalia dimensional detectada: Base Polar das Sombras',
    ]);
  });
});

describe('R07 — Base Polar das Sombras', () => {
  const terrain = createTerrain(R07);
  const context = (): MissionContext => ({
    catalog: CATALOG,
    terrain,
    ownsRtkKit: true,
    modifiers: neutralModifiers(),
    staff: { INTERN: 0, JUNIOR_ENG: 0 },
    hardware: HARDWARE[0] as (typeof HARDWARE)[number],
    inField: false,
    firstApproval: true,
    rng: mulberry32(7),
    deps: { computePayment, computeRewards },
  });

  it('conforme a ficha: AOI, nevasca, regras, 4 requisitos, recompensa e museu', () => {
    expect(R07.title).toBe('Base Polar das Sombras');
    expect(R07.client.name).toBe('Cobrinha Sólida');
    expect(R07.client.portrait).toEqual({
      shape: 'SHIELD',
      icon: 'Package',
      primary: '#57534e',
      secondary: '#a16207',
      initials: 'CS',
    });
    expect([R07.dimension, R07.biome, R07.seed]).toEqual(['RIFT', 'RIFT_POLAR_BASE', 9707]);
    expect(R07.aoi).toEqual({ widthM: 240, lengthM: 300 });
    expect([R07.ceilingM, R07.terrainReliefM]).toEqual([120, 15]);
    expect(R07.lightingOptions).toEqual(['BLIZZARD']);
    expect(R07.wind).toEqual({ meanMs: 7, gustMs: 4, directionDeg: 90 });
    expect(R07.specialRules).toEqual([
      'EM_INTERFERENCE',
      'BLIZZARD_DRAIN',
      'SEARCHLIGHTS',
      'FEATURE_TARGETS',
    ]);
    expect(R07.requirements.slice(0, -1).map((r) => [r.severity, r.check])).toEqual([
      ['CRITICAL', { type: 'NOT_DETECTED' }],
      ['CRITICAL', { type: 'FEATURE_CAPTURED', featureId: 'WALKER' }],
      ['MAJOR', { type: 'MIN_COVERAGE_GREEN', value: 0.7 }],
      ['MINOR', { type: 'MAX_GSD_CM', value: 3 }],
    ]);
    expect(R07.recommended).toMatchObject({
      aircraft: ['ATLAS', 'DRONE_T2'],
      vehicle: 'FOOT_BIKE',
    });
    expect(R07.minVehicle).toBe('FOOT_BIKE');
    expect([R07.basePaymentBRL, R07.xp, R07.reputationReward]).toEqual([7_000_000, 1200, 5]);
    expect(R07.souvenirId).toBe('SV_CARDBOARD_BOX');
    expect(R07.museum).toEqual({ wing: 'RIFT', slot: 6, incomePerMinBRL: 14_000 });
    expect(R07.unlock).toEqual({ type: 'CONTRACT_DONE', contractId: 'C06' });
    expect(R07.overworldMarker).toBe('g');
    expect(
      [R07.dialogs.briefing, R07.dialogs.success, R07.dialogs.failure].map((d) => d.length),
    ).toEqual([3, 1, 1]);
  });

  it('o portal `g` é de quem vai a pé ou de bicicleta, e o slot 6 do museu é só dele', () => {
    expect(MARKER_ACCESS[R07.overworldMarker]).toBe('FOOT_BIKE');
    const marker = WORLD_MAP.markers.find((m) => m.char === R07.overworldMarker) as {
      kind: string;
      x: number;
      y: number;
    };
    expect(marker.kind).toBe('RIFT');
    expect(isReachable(WORLD_MAP, WORLD_MAP.door, marker, 'FOOT_BIKE')).toBe(true);
    const slots = RIFT_CONTRACTS.map((c) => c.museum.slot);
    expect(new Set(slots).size).toBe(slots.length);
  });

  it('o plano de referência voa o T2 na nevasca: GSD 2,01 cm, 6 linhas, 307 s, sem pontos de apoio', () => {
    const ref = R07.referencePlan;
    expect(ref).toMatchObject({
      aircraftId: 'DRONE_T2',
      sensorId: 'CAM_45MP_FF',
      lensId: 'LENS_24',
      heightM: 110,
      forwardOverlapPct: 75,
      sideOverlapPct: 65,
      speedMs: 9,
      lighting: 'BLIZZARD',
      gcps: [],
      cps: [],
    });
    expect(ref.expected).toEqual({ gsdCm: 2.01, nLines: 6, flightTimeS: 307 });
    const plan = buildFlightPlan(referenceParams(R07), R07, CATALOG);
    expect(plan.stats.gsdM * 100).toBeCloseTo(2.01, 2);
    expect(plan.stats.nLines).toBe(6);
    expect(plan.stats.flightTimeS).toBeCloseTo(307, 0);
    // A nevasca drena a bateria 2×: 307 s de voo gastam 614 s de autonomia, e o T2 tem 2.100 s.
    expect(plan.stats.flightTimeS * RULE_PARAMS.blizzard.energyDrainFactor).toBeCloseTo(614, 0);
    expect(plan.stats.batteriesNeeded).toBe(1);
  });

  it('a nevasca dobra o dreno: o mesmo voo gasta 2× a energia com a regra BLIZZARD_DRAIN', () => {
    const fx = resolveRuleEffects(R07.specialRules);
    expect(fx.flight.energyDrainFactor).toBe(2);
    expect(fx.flight.searchlights).toEqual({ detectS: 1.5, detectAtlasS: 3 });
    const calm = { ...R07, specialRules: R07.specialRules.filter((r) => r !== 'BLIZZARD_DRAIN') };
    const drained = fly(R07);
    const normal = fly(calm);
    expect(drained.result.outcome).toBe('COMPLETED');
    expect(normal.result.outcome).toBe('COMPLETED');
    expect(drained.used / normal.used).toBeGreaterThan(1.9);
    expect(drained.used / normal.used).toBeLessThan(2.1);
    // Com o dreno de 2× ainda sobra bateria no fim do plano de referência.
    expect(drained.used).toBeLessThan(0.5);
  });

  it('o autopilot voa o plano de referência sem ser detectado, sem colidir, e captura o andador', () => {
    const { result } = fly(R07);
    expect(result.outcome).toBe('COMPLETED');
    expect(result.detected).toBe(false);
    expect(result.collisions).toBe(0);
    expect(result.completedLines).toEqual([0, 1, 2, 3, 4, 5]);
    expect(result.featuresCaptured).toEqual(['WALKER']);
  });

  it('com o plano de referência (missão sintética), o relatório aprova; detectado, reprova pelo crítico', () => {
    const mission = syntheticMission(R07, terrain, CATALOG);
    const report = evaluateMission(mission, R07, context());
    expect(report.critical).toBe(false);
    expect(report.approved).toBe(true);
    expect(report.requirements.slice(0, -1).map((r) => r.id)).toEqual([
      'R07-stealth',
      'R07-walker',
      'R07-cov',
      'R07-gsd',
    ]);
    expect(report.requirements.every((r) => r.pass)).toBe(true);
    // O mesmo voo, mas detectado por um holofote: o requisito crítico NOT_DETECTED reprova.
    const seen = { ...mission, events: { ...mission.events, detected: true } };
    const bad = evaluateMission(seen, R07, context());
    expect(bad.requirements.find((r) => r.id === 'R07-stealth')?.pass).toBe(false);
    expect(bad.critical).toBe(true);
    expect(bad.approved).toBe(false);
  });
});

describe('R09 — Savana das Gramas Altas', () => {
  const terrain = createTerrain(R09);
  const context = (): MissionContext => ({
    catalog: CATALOG,
    terrain,
    ownsRtkKit: true,
    modifiers: neutralModifiers(),
    staff: { INTERN: 0, JUNIOR_ENG: 0 },
    hardware: HARDWARE[0] as (typeof HARDWARE)[number],
    inField: false,
    firstApproval: true,
    rng: mulberry32(7),
    deps: { computePayment, computeRewards },
  });
  /** O mesmo plano de referência com a câmera RGB de 45 MP no lugar da multiespectral. */
  const rgbContract = {
    ...R09,
    referencePlan: { ...R09.referencePlan, sensorId: 'CAM_45MP_FF', lensId: 'LENS_24' as const },
  };

  it('conforme a ficha: AOI, teto, luzes, vento, regras, 4 requisitos, recompensa e museu', () => {
    expect(R09.title).toBe('Savana das Gramas Altas');
    expect(R09.client.name).toBe('Ailton da Rocha');
    expect(R09.client.portrait).toEqual({
      shape: 'CIRCLE',
      icon: 'Backpack',
      primary: '#ef4444',
      secondary: '#f8fafc',
      initials: 'AR',
    });
    expect([R09.dimension, R09.biome, R09.seed]).toEqual(['RIFT', 'RIFT_TALL_GRASS', 9909]);
    expect(R09.aoi).toEqual({ widthM: 400, lengthM: 800 });
    expect([R09.ceilingM, R09.terrainReliefM]).toEqual([150, 20]);
    expect(R09.lightingOptions).toEqual(['SUN_HIGH', 'OVERCAST']);
    expect(R09.wind).toEqual({ meanMs: 4, gustMs: 3, directionDeg: 0 });
    expect(R09.specialRules).toEqual([
      'EM_INTERFERENCE',
      'ELECTRIC_CREATURES',
      'HOMOGENEOUS_TEXTURE',
    ]);
    expect(R09.requirements.slice(0, -1).map((r) => [r.severity, r.check])).toEqual([
      ['CRITICAL', { type: 'SENSOR_KIND', value: 'MULTISPECTRAL' }],
      ['CRITICAL', { type: 'MIN_COVERAGE_GREEN', value: 0.75 }],
      ['MAJOR', { type: 'MAX_GSD_CM', value: 12 }],
      ['MAJOR', { type: 'MIN_FORWARD_OVERLAP', value: 80 }],
    ]);
    expect(R09.recommended).toMatchObject({
      aircraft: ['DRONE_T2', 'VTOL_T3'],
      sensors: ['CAM_MS5'],
      vehicle: 'FOOT_BIKE',
    });
    expect(R09.minVehicle).toBe('FOOT_BIKE');
    expect([R09.basePaymentBRL, R09.xp, R09.reputationReward]).toEqual([4_000_000, 800, 5]);
    expect(R09.souvenirId).toBe('SV_CAP');
    expect(R09.museum).toEqual({ wing: 'RIFT', slot: 8, incomePerMinBRL: 10_000 });
    expect(R09.unlock).toEqual({ type: 'CONTRACT_DONE', contractId: 'C02' });
    expect(R09.overworldMarker).toBe('i');
    expect(
      [R09.dialogs.briefing, R09.dialogs.success, R09.dialogs.failure].map((d) => d.length),
    ).toEqual([3, 1, 1]);
  });

  it('o portal `i` é de quem vai a pé ou de bicicleta, e o slot 8 do museu é só dele', () => {
    expect(MARKER_ACCESS[R09.overworldMarker]).toBe('FOOT_BIKE');
    const marker = WORLD_MAP.markers.find((m) => m.char === R09.overworldMarker) as {
      kind: string;
      x: number;
      y: number;
    };
    expect(marker.kind).toBe('RIFT');
    expect(isReachable(WORLD_MAP, WORLD_MAP.door, marker, 'FOOT_BIKE')).toBe(true);
    const slots = RIFT_CONTRACTS.map((c) => c.museum.slot);
    expect(new Set(slots).size).toBe(slots.length);
  });

  it('o plano de referência voa o T2 com a câmera multiespectral: GSD 7,53 cm, 9 linhas, 725 s, 333 fotos', () => {
    const ref = R09.referencePlan;
    expect(ref).toMatchObject({
      aircraftId: 'DRONE_T2',
      sensorId: 'CAM_MS5',
      heightM: 120,
      forwardOverlapPct: 80,
      sideOverlapPct: 65,
      speedMs: 12,
      lighting: 'SUN_HIGH',
      gcps: [],
      cps: [],
    });
    expect(ref.heightM).toBeLessThanOrEqual(R09.ceilingM);
    expect(ref.expected).toEqual({ gsdCm: 7.53, nLines: 9, flightTimeS: 725.2 });
    const plan = buildFlightPlan(referenceParams(R09), R09, CATALOG);
    expect(plan.stats.gsdM * 100).toBeCloseTo(7.53, 2);
    expect(plan.stats.nLines).toBe(9);
    expect(plan.stats.flightTimeS).toBeCloseTo(725.2, 0);
    expect(plan.stats.totalPhotos).toBe(333);
    expect(plan.stats.batteriesNeeded).toBe(1);
    // A previsão, antes do voo, só enxerga o que depende do plano (sensor, GSD e p).
    const predicted = predictRequirements(plan, R09, [], {
      catalog: CATALOG,
      ownsRtkKit: true,
      fieldEquipmentId: 'TOTAL_STATION',
    });
    expect(predicted.map((r) => [r.id, r.pass])).toEqual([
      ['R09-sensor', true],
      ['R09-cov', true],
      ['R09-gsd', true],
      ['R09-fwd', true],
      // A execução do voo só se mede com dados: na previsão é informativa.
      ['R09-exec', true],
    ]);
  });

  it('as criaturas elétricas dão um pico a cada 8–12 s que dura 2 s e empurra o T2 3 m/s de lado; o T2 não é imune', () => {
    const fx = resolveRuleEffects(R09.specialRules);
    expect(fx.flight.electricCreatures).toEqual({ intervalS: [8, 12], spikeS: 2, forceMs: 3 });
    expect(fx.flight.electricCreatures).toEqual(RULE_PARAMS.electric);
    expect(fx.flight.emInterference).not.toBeNull();
    expect(fx.accuracy.homogeneousTexture).toEqual({ tiePointFactor: 0.6 });
    expect(getAircraft('DRONE_T2').emImmune).toBe(false);
    expect(getSensor('CAM_MS5').kind).toBe('MULTISPECTRAL');
  });

  it('o autopilot voa o plano de referência inteiro: 9 linhas, 333 fotos, sem colisão, no meio dos picos elétricos', () => {
    const { result, used } = fly(R09);
    expect(result.outcome).toBe('COMPLETED');
    expect(result.collisions).toBe(0);
    expect(result.completedLines).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(result.photos).toBe(333);
    expect(result.detected).toBe(false);
    // 725 s de voo dos 2.100 s do T2: sobra bateria.
    expect(used).toBeLessThan(0.6);
    // Sem as criaturas o voo também fecha: o empurrão só desvia, não derruba.
    const calm = {
      ...R09,
      specialRules: R09.specialRules.filter((r) => r !== 'ELECTRIC_CREATURES'),
    };
    expect(fly(calm).result.outcome).toBe('COMPLETED');
  });

  it('com o plano de referência (missão sintética), o relatório aprova com a sobreposição longitudinal na casa de 80 %', () => {
    const mission = syntheticMission(R09, terrain, CATALOG);
    expect(mission.groundPoints).toHaveLength(0);
    expect(mission.shots).toHaveLength(333);
    const report = evaluateMission(mission, R09, context());
    expect(report.critical).toBe(false);
    expect(report.approved).toBe(true);
    expect(report.requirements.slice(0, -1).map((r) => r.id)).toEqual([
      'R09-sensor',
      'R09-cov',
      'R09-gsd',
      'R09-fwd',
    ]);
    const byId = (id: string) => report.requirements.find((r) => r.id === id);
    expect(['R09-sensor', 'R09-cov', 'R09-gsd'].every((id) => byId(id)?.pass)).toBe(true);
    expect(report.coverage.green).toBeGreaterThanOrEqual(0.75);
    // A ficha pede p ≥ 80 % e o plano de referência tem p = 80 %, sem folga: o relevo de até 20 m
    // mexe na escala de cada foto e a mediana medida fica na casa de 80 %.
    const p = medianForwardOverlapPct(mission.shots) as number;
    expect(p).toBeGreaterThan(79.8);
    expect(p).toBeLessThan(80.3);
    expect(R09.recommended.notes).toContain('p ≥ 80 %');
    expect(R09.recommended.notes).toContain('dê folga ao p');
    // A textura homogênea do capim pesa no relatório (×1,24 com p ≥ 80 %), assim como a interferência.
    const keys = report.multipliers.map((m) => m.key);
    expect(keys).toEqual(expect.arrayContaining(['texture', 'em']));
    expect(report.multipliers.find((m) => m.key === 'texture')?.xy).toBeCloseTo(1.24, 6);
  });

  it('no voo de verdade o T2 não passa de 120 m (o H do plano): o corredor segue os morros e a mediana de p fica logo abaixo de 80 %', () => {
    expect(getAircraft('DRONE_T2').hMaxM).toBe(R09.referencePlan.heightM);
    const { shots } = fly(R09);
    expect(shots).toHaveLength(333);
    // O teto de AGL do T2 corta os vales: nenhuma foto sai com AGL acima do H do plano (±10 cm de passo).
    expect(Math.max(...shots.map((s) => s.aglM))).toBeLessThanOrEqual(120.1);
    // O corredor acompanha o relevo (ADR-029): o AGL não cai mais nos morros.
    expect(Math.min(...shots.map((s) => s.aglM))).toBeGreaterThan(118);
    // A mediana medida na pegada real fica logo abaixo do 80 % nominal (o relatório marca
    // "Sobreposição longitudinal" como não atendida, IMPORTANTE, e a missão segue aprovada).
    const p = medianForwardOverlapPct(shots) as number;
    expect(p).toBeGreaterThan(79.5);
    expect(p).toBeLessThan(80);
    // Com 2 pontos percentuais de folga no p, o voo de verdade passa com sobra.
    const roomy = { ...R09, referencePlan: { ...R09.referencePlan, forwardOverlapPct: 82 } };
    const better = medianForwardOverlapPct(fly(roomy).shots) as number;
    expect(better).toBeGreaterThan(81.5);
  });

  it('com p = 75 % a textura homogênea pesa ×1,6 e a sobreposição reprova (MAJOR); com 82 % passa com folga', () => {
    const lowP = { ...R09, referencePlan: { ...R09.referencePlan, forwardOverlapPct: 75 } };
    const mission = syntheticMission(lowP, terrain, CATALOG);
    const report = evaluateMission(mission, R09, context());
    expect(report.requirements.find((r) => r.id === 'R09-fwd')?.pass).toBe(false);
    expect(report.critical).toBe(false);
    expect(report.multipliers.find((m) => m.key === 'texture')?.xy).toBeCloseTo(1.6, 6);
    const highP = { ...R09, referencePlan: { ...R09.referencePlan, forwardOverlapPct: 82 } };
    const better = syntheticMission(highP, terrain, CATALOG);
    expect(medianForwardOverlapPct(better.shots) as number).toBeGreaterThan(81.9);
    expect(
      evaluateMission(better, R09, context()).requirements.find((r) => r.id === 'R09-fwd')?.pass,
    ).toBe(true);
  });

  it('voar com a câmera RGB reprova pelo crítico: sem sensor multiespectral, sem NDVI', () => {
    const mission = syntheticMission(rgbContract, terrain, CATALOG);
    const report = evaluateMission(mission, R09, context());
    const bySensor = report.requirements.find((r) => r.id === 'R09-sensor');
    expect(bySensor?.pass).toBe(false);
    expect(report.critical).toBe(true);
    expect(report.approved).toBe(false);
  });

  it('o NDVI separa o capim alto (≥ 0,8) do capim baixo (~0,5), da areia/estrada e da água', () => {
    const grid = createCoverageGrid(R09.aoi);
    const raster = generateProduct('NDVI', {
      terrain,
      coverage: {
        cols: grid.cols,
        rows: grid.rows,
        counts: grid.counts.map(() => 6),
        excludedCells: [],
      },
      lighting: 'SUN_HIGH',
      rmseZM: 0.1,
      seed: 1,
    });
    const hist = raster.histogram as number[];
    const total = hist.reduce((s, v) => s + v, 0);
    const share = (from: number, to: number) =>
      hist.slice(from, to).reduce((s, v) => s + v, 0) / total;
    // 22 faixas de 0,05 entre −0,2 e 0,9: ≥ 0,8 são as faixas 20 e 21.
    expect(share(20, 22)).toBeGreaterThan(0.3);
    expect(share(20, 22)).toBeLessThan(0.45);
    // O capim baixo (0,5 ± 0,06) cai nas faixas 13–15 e é a maior parte do mapa.
    expect(share(12, 16)).toBeGreaterThan(0.45);
    // A água (NDVI < 0) fica nas faixas 0–3.
    expect(share(0, 4)).toBeGreaterThan(0.04);
    expect(share(0, 4)).toBeLessThan(0.12);
  });

  it('concluir o C02 libera a R09: a fenda é descoberta e sai um aviso', () => {
    resetGameStore();
    const get = () => useGameStore.getState();
    const done = { status: 'COMPLETED' as const, completions: 1, bestScore: 0.9 };
    act(() => {
      useGameStore.setState((s) => ({
        contracts: { ...s.contracts, C00: done, C01: done },
        stats: { ...s.stats, contractsCompleted: 2 },
      }));
      get().refreshUnlocks({ silent: true });
    });
    expect(get().contracts.R09?.status).toBe('LOCKED');
    expect(get().world.discoveredRifts).toEqual(['R01', 'R02']);
    act(() => {
      useGameStore.setState((s) => ({
        contracts: { ...s.contracts, C02: done },
        stats: { ...s.stats, contractsCompleted: 3 },
      }));
      get().refreshUnlocks();
    });
    expect(get().contracts.R09?.status).toBe('AVAILABLE');
    expect(get().world.discoveredRifts).toEqual(['R01', 'R02', 'R09']);
    expect(
      get()
        .session.toasts.filter((t) => t.type === 'rift')
        .map((t) => t.title),
    ).toEqual(['Anomalia dimensional detectada: Savana das Gramas Altas']);
  });
});

describe('R03 — Planalto dos Guerreiros', () => {
  const terrain = createTerrain(R03);
  const context = (): MissionContext => ({
    catalog: CATALOG,
    terrain,
    ownsRtkKit: true,
    modifiers: neutralModifiers(),
    staff: { INTERN: 0, JUNIOR_ENG: 0 },
    hardware: HARDWARE[0] as (typeof HARDWARE)[number],
    inField: false,
    firstApproval: true,
    rng: mulberry32(7),
    deps: { computePayment, computeRewards },
  });

  it('conforme a ficha: AOI, teto, luzes, vento, regras, 4 requisitos, recompensa e museu', () => {
    expect(R03.title).toBe('Planalto dos Guerreiros');
    expect(R03.client.name).toBe('Guko');
    expect(R03.client.portrait).toEqual({
      shape: 'HEXAGON',
      icon: 'Flame',
      primary: '#f97316',
      secondary: '#1d4ed8',
      initials: 'GK',
    });
    expect([R03.dimension, R03.biome, R03.seed]).toEqual(['RIFT', 'RIFT_CRATERS', 9303]);
    expect(R03.aoi).toEqual({ widthM: 300, lengthM: 400 });
    expect([R03.ceilingM, R03.terrainReliefM]).toEqual([120, 60]);
    expect(R03.lightingOptions).toEqual(['SUN_HIGH', 'GOLDEN_HOUR']);
    expect(R03.wind).toEqual({ meanMs: 4, gustMs: 6, directionDeg: 90 });
    expect(R03.specialRules).toEqual(['EM_INTERFERENCE', 'ENERGY_BEAMS', 'STEEP_RELIEF']);
    expect(R03.requirements.slice(0, -1).map((r) => [r.severity, r.check])).toEqual([
      ['CRITICAL', { type: 'MAX_VOLUME_ERROR_PCT', value: 3 }],
      ['CRITICAL', { type: 'MIN_COVERAGE_GREEN', value: 0.85 }],
      ['MAJOR', { type: 'ACCURACY_ASPRS', horizontalCm: 8, verticalCm: 10 }],
      ['MAJOR', { type: 'MIN_GCP', value: 5 }],
    ]);
    expect(R03.recommended).toMatchObject({
      aircraft: ['DRONE_T2'],
      sensors: ['CAM_45MP_FF'],
      vehicle: 'FOOT_BIKE',
    });
    expect(R03.recommended.notes).toContain('Terrain Following');
    expect(R03.minVehicle).toBe('FOOT_BIKE');
    expect([R03.basePaymentBRL, R03.xp, R03.reputationReward]).toEqual([4_500_000, 900, 5]);
    expect(R03.souvenirId).toBe('SV_STAR_SPHERE');
    expect(R03.museum).toEqual({ wing: 'RIFT', slot: 2, incomePerMinBRL: 11_000 });
    expect(R03.unlock).toEqual({ type: 'CONTRACT_DONE', contractId: 'C04' });
    expect(R03.overworldMarker).toBe('c');
    expect(
      [R03.dialogs.briefing, R03.dialogs.success, R03.dialogs.failure].map((d) => d.length),
    ).toEqual([3, 1, 1]);
  });

  it('o portal `c` é de quem vai a pé ou de bicicleta, e o slot 2 do museu é só dele', () => {
    expect(MARKER_ACCESS[R03.overworldMarker]).toBe('FOOT_BIKE');
    const marker = WORLD_MAP.markers.find((m) => m.char === R03.overworldMarker) as {
      kind: string;
      x: number;
      y: number;
    };
    expect(marker.kind).toBe('RIFT');
    expect(isReachable(WORLD_MAP, WORLD_MAP.door, marker, 'FOOT_BIKE')).toBe(true);
    const slots = RIFT_CONTRACTS.map((c) => c.museum.slot);
    expect(new Set(slots).size).toBe(slots.length);
  });

  it('o plano de referência voa o T2 com Terrain Following: GSD 1,64 cm, 8 linhas, 442 s, 160 fotos', () => {
    const ref = R03.referencePlan;
    expect(ref).toMatchObject({
      aircraftId: 'DRONE_T2',
      sensorId: 'CAM_45MP_FF',
      lensId: 'LENS_24',
      heightM: 90,
      forwardOverlapPct: 75,
      sideOverlapPct: 65,
      speedMs: 10,
      modes: ['TERRAIN_FOLLOWING'],
      lighting: 'SUN_HIGH',
      cps: [],
    });
    expect(ref.gcps).toEqual([
      { u: 30, v: 30 },
      { u: 370, v: 30 },
      { u: 30, v: 270 },
      { u: 370, v: 270 },
      { u: 200, v: 150 },
    ]);
    expect(ref.heightM).toBeLessThanOrEqual(R03.ceilingM);
    expect(ref.expected).toEqual({ gsdCm: 1.64, nLines: 8, flightTimeS: 442 });
    expect(getAircraft(ref.aircraftId).terrainFollowing).toBe(true);
    const plan = buildFlightPlan(referenceParams(R03), R03, CATALOG);
    expect(plan.params.terrainFollowing).toBe(true);
    expect(plan.stats.gsdM * 100).toBeCloseTo(1.64, 2);
    expect(plan.stats.nLines).toBe(8);
    expect(plan.stats.flightTimeS).toBeCloseTo(442, 0);
    expect(plan.stats.totalPhotos).toBe(160);
    expect(plan.stats.batteriesNeeded).toBe(1);
    // A previsão antes do voo passa em tudo que depende só do plano e dos 5 GCPs do plano.
    const predicted = predictRequirements(
      plan,
      R03,
      ref.gcps.map((p, i) => ({
        id: `GCP${i + 1}`,
        kind: 'GCP' as const,
        u: p.u,
        v: p.v,
        elevM: terrain.elevation(p.u, p.v),
        sigmaM: 0.01,
      })),
      { catalog: CATALOG, ownsRtkKit: true, fieldEquipmentId: 'TOTAL_STATION' },
    );
    expect(predicted.filter((r) => !r.pass).map((r) => r.id)).toEqual([]);
  });

  it('colunas de energia e interferência: o T2 não é imune, e a regra dá 2 s ligada, 3 s apagada, 0,5 s de aviso', () => {
    const fx = resolveRuleEffects(R03.specialRules);
    expect(fx.flight.energyBeams).toEqual({ onS: 2, offS: 3, warnS: 0.5 });
    expect(fx.flight.emInterference).not.toBeNull();
    expect(fx.terrain.steepRelief).toMatchObject({ minReliefM: 60, slopeDeg: [35, 70] });
    expect(getAircraft('DRONE_T2').emImmune).toBe(false);
    expect(terrain.objects.filter((o) => o.kind === 'ENERGY_BEAM')).toHaveLength(6);
  });

  it('o autopilot voa o plano de referência inteiro com TF: 8 linhas, 160 fotos, sem colisão, por cima das colunas', () => {
    const beams = terrain.objects.filter((o) => o.kind === 'ENERGY_BEAM');
    let minAgl = Infinity;
    let maxAgl = 0;
    let minOverBeam = Infinity;
    const { result, used } = fly(R03, (e) => {
      if (e.phase !== 'RUN') return;
      const p = e.pos();
      const agl = e.ac.alt - terrain.elevation(p.u, p.v);
      minAgl = Math.min(minAgl, agl);
      maxAgl = Math.max(maxAgl, agl);
      for (const b of beams) {
        // Perto de uma coluna (≤ 6 m do eixo além do raio), a folga sobre o topo de 80 m.
        if (Math.hypot(p.u - b.u, p.v - b.v) < b.widthM / 2 + 6) {
          minOverBeam = Math.min(minOverBeam, e.ac.alt - (terrain.elevation(b.u, b.v) + b.heightM));
        }
      }
    });
    expect(result.outcome).toBe('COMPLETED');
    expect(result.collisions).toBe(0);
    expect(result.completedLines).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(result.photos).toBe(160);
    expect(result.detected).toBe(false);
    // 442 s de voo dos 2.100 s do T2.
    expect(used).toBeLessThan(0.4);
    // O TF segura o AGL perto dos 90 m do plano nos 74 m de relevo (o declive de 60° só atrasa um pouco).
    expect(minAgl).toBeGreaterThan(70);
    expect(maxAgl).toBeLessThan(115);
    // As colunas têm 80 m e o T2 passa 12 m acima do topo; quem voa mais baixo é que precisa cronometrar.
    expect(minOverBeam).toBeGreaterThan(8);
  });

  it('com o plano de referência (missão sintética), o relatório aprova: volume, cobertura, ASPRS e 5 GCPs', () => {
    const mission = syntheticMission(R03, terrain, CATALOG);
    expect(mission.groundPoints.filter((p) => p.kind === 'GCP')).toHaveLength(5);
    expect(mission.groundPoints.filter((p) => p.kind === 'CP')).toHaveLength(0);
    const report = evaluateMission(mission, R03, context());
    expect(report.critical).toBe(false);
    expect(report.approved).toBe(true);
    expect(report.requirements.slice(0, -1).map((r) => r.id)).toEqual([
      'R03-vol',
      'R03-cov',
      'R03-asprs',
      'R03-gcp',
    ]);
    expect(report.requirements.every((r) => r.pass)).toBe(true);
    // Sem CPs, o ASPRS sai "não verificável" (GCP × 1,8) e mesmo assim cabe nos 8 cm e 10 cm.
    const asprs = report.requirements.find((r) => r.id === 'R03-asprs');
    expect(asprs?.valueText).toContain('não verificável');
    expect(report.coverage.green).toBeGreaterThanOrEqual(0.85);
    expect(report.volume?.errorPct).toBeLessThan(0.5);
    // O volume é o do alívio todo da AOI em relação ao plano das bordas: bem acima de 1 milhão de m³.
    expect(report.volume?.referenceM3).toBeGreaterThan(1_000_000);
  });

  it('volumetria: o erro fica longe dos 3 % com o RMSE do plano; 5 % de buracos ainda passa, 7 % reprova', () => {
    const reference = referenceVolumeM3(terrain, R03.aoi, borderMeanElevation(terrain, R03.aoi));
    const depth = meanDepthM(reference);
    expect(reference.cutM3 + reference.fillM3).toBeGreaterThan(1_000_000);
    expect(depth).toBeGreaterThan(15);
    // RMSE_z de ~10 cm (ASPRS V de 10 cm): erro de volume pequeno (σ = 0,5·RMSE/profundidade) em qualquer seed.
    for (let seed = 1; seed <= 100; seed++) {
      const measured = measuredVolumeM3(reference, 0.1, depth, 0, mulberry32(seed));
      expect(volumeErrorPct(reference, measured)).toBeLessThan(1.5);
    }
    // Cada ponto de cobertura vermelha (< 3 fotos) tira meio ponto do volume (média de 100 seeds).
    const meanError = (red: number) => {
      let sum = 0;
      for (let seed = 1; seed <= 100; seed++) {
        const measured = measuredVolumeM3(reference, 0.1, depth, red, mulberry32(seed));
        sum += volumeErrorPct(reference, measured);
      }
      return sum / 100;
    };
    expect(meanError(0)).toBeLessThan(0.5);
    expect(meanError(0.05)).toBeGreaterThan(2.2);
    expect(meanError(0.05)).toBeLessThan(3);
    expect(meanError(0.07)).toBeGreaterThan(3);
  });

  it('com poucas fotos sobra buraco: a cobertura e o volume reprovam e a missão é reprovada pelos críticos', () => {
    const full = syntheticMission(R03, terrain, CATALOG);
    const partial = { ...full, shots: full.shots.filter((s) => s.lineIndex < 4) };
    const report = evaluateMission(partial, R03, context());
    const byId = (id: string) => report.requirements.find((r) => r.id === id);
    expect(byId('R03-cov')?.pass).toBe(false);
    expect(byId('R03-vol')?.pass).toBe(false);
    expect(report.critical).toBe(true);
    expect(report.approved).toBe(false);
  });

  it('com 3 GCPs só o MAJOR `R03-gcp` reprova: a missão segue aprovada', () => {
    const full = syntheticMission(R03, terrain, CATALOG);
    const few = { ...full, groundPoints: full.groundPoints.slice(0, 3) };
    const report = evaluateMission(few, R03, context());
    const failed = report.requirements.filter((r) => !r.pass).map((r) => r.id);
    expect(failed).toContain('R03-gcp');
    expect(failed.every((id) => id === 'R03-gcp' || id === 'R03-asprs')).toBe(true);
    expect(report.critical).toBe(false);
    expect(report.approved).toBe(true);
  });

  it('concluir o C04 libera a R03 e a R05 de uma vez: as fendas são descobertas e saem dois avisos', () => {
    resetGameStore();
    const get = () => useGameStore.getState();
    const done = { status: 'COMPLETED' as const, completions: 1, bestScore: 0.9 };
    act(() => {
      useGameStore.setState((s) => ({
        contracts: { ...s.contracts, C00: done, C01: done },
        stats: { ...s.stats, contractsCompleted: 2 },
      }));
      get().refreshUnlocks({ silent: true });
    });
    expect(get().contracts.R03?.status).toBe('LOCKED');
    expect(get().contracts.R05?.status).toBe('LOCKED');
    expect(get().world.discoveredRifts).toEqual(['R01', 'R02']);
    act(() => {
      useGameStore.setState((s) => ({
        contracts: { ...s.contracts, C04: done },
        stats: { ...s.stats, contractsCompleted: 3 },
      }));
      get().refreshUnlocks();
    });
    expect(get().contracts.R03?.status).toBe('AVAILABLE');
    expect(get().contracts.R05?.status).toBe('AVAILABLE');
    expect(get().world.discoveredRifts).toEqual(['R01', 'R02', 'R03', 'R05']);
    expect(
      get()
        .session.toasts.filter((t) => t.type === 'rift')
        .map((t) => t.title),
    ).toEqual([
      'Anomalia dimensional detectada: Planalto dos Guerreiros',
      'Anomalia dimensional detectada: Mina dos Blocos Cúbicos',
    ]);
  });
});

describe('R05 — Mina dos Blocos Cúbicos', () => {
  const terrain = createTerrain(R05);
  const context = (): MissionContext => ({
    catalog: CATALOG,
    terrain,
    ownsRtkKit: true,
    modifiers: neutralModifiers(),
    staff: { INTERN: 0, JUNIOR_ENG: 0 },
    hardware: HARDWARE[0] as (typeof HARDWARE)[number],
    inField: false,
    firstApproval: true,
    rng: mulberry32(7),
    deps: { computePayment, computeRewards },
  });
  const thermals = terrain.zones.filter((z) => z.kind === 'THERMAL');

  it('conforme a ficha: AOI, teto, luzes, vento, regras, 5 requisitos, recompensa e museu', () => {
    expect(R05.title).toBe('Mina dos Blocos Cúbicos');
    expect(R05.client.name).toBe('Estêvão');
    expect(R05.client.portrait).toEqual({
      shape: 'HEXAGON',
      icon: 'Box',
      primary: '#06b6d4',
      secondary: '#4d7c0f',
      initials: 'ES',
    });
    expect([R05.dimension, R05.biome, R05.seed]).toEqual(['RIFT', 'RIFT_CUBES', 9505]);
    expect(R05.aoi).toEqual({ widthM: 240, lengthM: 320 });
    expect([R05.ceilingM, R05.terrainReliefM]).toEqual([120, 80]);
    expect(R05.lightingOptions).toEqual(['SUN_HIGH', 'OVERCAST']);
    expect(R05.wind).toEqual({ meanMs: 2, gustMs: 2, directionDeg: 0 });
    expect(R05.specialRules).toEqual(['EM_INTERFERENCE', 'LAVA_THERMALS', 'STEEP_RELIEF']);
    expect(R05.requirements.slice(0, -1).map((r) => [r.severity, r.check])).toEqual([
      ['CRITICAL', { type: 'MIN_COVERAGE_GREEN', value: 0.85 }],
      ['MAJOR', { type: 'MIN_FORWARD_OVERLAP', value: 80 }],
      ['MAJOR', { type: 'ACCURACY_ASPRS', horizontalCm: 6, verticalCm: 8 }],
      ['MAJOR', { type: 'FLIGHT_MODE', value: 'TERRAIN_FOLLOWING' }],
      ['MAJOR', { type: 'MIN_GCP', value: 5 }],
    ]);
    expect(R05.recommended).toMatchObject({
      aircraft: ['DRONE_T2'],
      sensors: ['CAM_45MP_FF'],
      vehicle: 'PICKUP_4X4',
    });
    expect(R05.recommended.notes).toContain('Terrain Following');
    expect([R05.basePaymentBRL, R05.xp, R05.reputationReward]).toEqual([5_000_000, 1000, 5]);
    expect(R05.souvenirId).toBe('SV_CUBE_ORE');
    expect(R05.museum).toEqual({ wing: 'RIFT', slot: 4, incomePerMinBRL: 12_000 });
    expect(R05.unlock).toEqual({ type: 'CONTRACT_DONE', contractId: 'C04' });
    expect(R05.overworldMarker).toBe('e');
    expect(
      [R05.dialogs.briefing, R05.dialogs.success, R05.dialogs.failure].map((d) => d.length),
    ).toEqual([3, 1, 1]);
  });

  it('OQ-009: o portal `e` só se alcança de picape 4x4 (atrás do cinturão), e o slot 4 do museu é só dele', () => {
    expect(R05.minVehicle).toBe('PICKUP_4X4');
    expect(MARKER_ACCESS[R05.overworldMarker]).toBe('PICKUP_4X4');
    const marker = WORLD_MAP.markers.find((m) => m.char === R05.overworldMarker) as {
      kind: string;
      x: number;
      y: number;
    };
    expect(marker.kind).toBe('RIFT');
    expect(isReachable(WORLD_MAP, WORLD_MAP.door, marker, 'PICKUP_4X4')).toBe(true);
    expect(isReachable(WORLD_MAP, WORLD_MAP.door, marker, 'FOOT_BIKE')).toBe(false);
    const slots = RIFT_CONTRACTS.map((c) => c.museum.slot);
    expect(new Set(slots).size).toBe(slots.length);
  });

  it('o plano de referência voa o T2 com Terrain Following: GSD 1,46 cm, 8 linhas, 452 s, 184 fotos', () => {
    const ref = R05.referencePlan;
    expect(ref).toMatchObject({
      aircraftId: 'DRONE_T2',
      sensorId: 'CAM_45MP_FF',
      lensId: 'LENS_24',
      heightM: 80,
      forwardOverlapPct: 80,
      sideOverlapPct: 70,
      speedMs: 8,
      modes: ['TERRAIN_FOLLOWING'],
      lighting: 'OVERCAST',
      cps: [],
    });
    expect(ref.gcps).toEqual([
      { u: 20, v: 20 },
      { u: 300, v: 20 },
      { u: 20, v: 220 },
      { u: 300, v: 220 },
      { u: 160, v: 120 },
    ]);
    expect(ref.expected).toEqual({ gsdCm: 1.46, nLines: 8, flightTimeS: 452.4 });
    const plan = buildFlightPlan(referenceParams(R05), R05, CATALOG);
    expect(plan.params.terrainFollowing).toBe(true);
    expect(plan.stats.gsdM * 100).toBeCloseTo(1.46, 2);
    expect(plan.stats.nLines).toBe(8);
    expect(plan.stats.flightTimeS).toBeCloseTo(452.4, 0);
    expect(plan.stats.totalPhotos).toBe(184);
    expect(plan.stats.batteriesNeeded).toBe(1);
    const gcps = ref.gcps.map((p, i) => ({
      id: `GCP${i + 1}`,
      kind: 'GCP' as const,
      u: p.u,
      v: p.v,
      elevM: terrain.elevation(p.u, p.v),
      sigmaM: 0.01,
    }));
    const ctx = { catalog: CATALOG, ownsRtkKit: true, fieldEquipmentId: 'TOTAL_STATION' as const };
    expect(
      predictRequirements(plan, R05, gcps, ctx)
        .filter((r) => !r.pass)
        .map((r) => r.id),
    ).toEqual([]);
    // Sem o modo, o requisito `R05-tf` (MAJOR) reprova na previsão.
    const flat = buildFlightPlan(
      { ...referenceParams(R05), terrainFollowing: false },
      R05,
      CATALOG,
    );
    expect(
      predictRequirements(flat, R05, gcps, ctx)
        .filter((r) => !r.pass)
        .map((r) => r.id),
    ).toEqual(['R05-tf']);
  });

  it('o autopilot voa o plano de referência inteiro com TF sobre os degraus: 8 linhas, sem colisão, p real acima de 80 %', () => {
    let minAgl = Infinity;
    const { result, shots, used } = fly(R05, (e) => {
      if (e.phase !== 'RUN') return;
      const p = e.pos();
      minAgl = Math.min(minAgl, e.ac.alt - terrain.elevation(p.u, p.v));
    });
    expect(result.outcome).toBe('COMPLETED');
    expect(result.collisions).toBe(0);
    expect(result.completedLines).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(result.photos).toBeGreaterThan(170);
    expect(result.photos).toBeLessThanOrEqual(184);
    expect(used).toBeLessThan(0.4);
    // Os degraus de 4 m e os taludes de ~65° atrasam o TF (o T2 sobe 5 m/s): o AGL cai, sem chegar ao chão.
    expect(minAgl).toBeGreaterThan(30);
    // O TF olha 2 s à frente e voa sobre o ponto mais alto dessa janela: o AGL médio passa dos 80 m do plano,
    // e a sobreposição real (mediana) fica acima dos 80 % — ao contrário das fendas de altitude constante.
    expect(medianForwardOverlapPct(shots) as number).toBeGreaterThanOrEqual(80);
    expect(shots.reduce((sum, s) => sum + s.aglM, 0) / shots.length).toBeGreaterThan(80);
  });

  it('as térmicas da lava (6 m/s) empurram o drone para cima: com sol a pino o AGL nelas passa o de céu encoberto', () => {
    expect(thermals.length).toBeGreaterThan(3);
    const meanAglInZones = (contract: Contract) => {
      let sum = 0;
      let n = 0;
      const { result } = fly(contract, (e) => {
        if (e.phase !== 'RUN') return;
        const p = e.pos();
        const inside = thermals.some(
          (z) => z.kind === 'THERMAL' && Math.hypot(p.u - z.u, p.v - z.v) < z.radiusM,
        );
        if (!inside) return;
        sum += e.ac.alt - terrain.elevation(p.u, p.v);
        n++;
      });
      expect(result.outcome).toBe('COMPLETED');
      expect(result.collisions).toBe(0);
      expect(n).toBeGreaterThan(1000);
      return sum / n;
    };
    const overcast = meanAglInZones(R05);
    const sun = meanAglInZones({
      ...R05,
      referencePlan: { ...R05.referencePlan, lighting: 'SUN_HIGH' },
    });
    // Sem sol a pino a térmica vale a metade (3 m/s) e o TF a absorve; com sol (6 m/s > 5 m/s de subida) o drone sobe.
    expect(sun).toBeGreaterThan(overcast + 5);
  });

  it('com o plano de referência (missão sintética), o relatório aprova: cobertura, p, ASPRS, TF e 5 GCPs', () => {
    const mission = syntheticMission(R05, terrain, CATALOG);
    expect(mission.groundPoints.filter((p) => p.kind === 'GCP')).toHaveLength(5);
    const report = evaluateMission(mission, R05, context());
    expect(report.critical).toBe(false);
    expect(report.approved).toBe(true);
    expect(report.requirements.slice(0, -1).map((r) => r.id)).toEqual([
      'R05-cov',
      'R05-fwd',
      'R05-asprs',
      'R05-tf',
      'R05-gcp',
    ]);
    expect(report.requirements.every((r) => r.pass)).toBe(true);
    // Sem CPs, o ASPRS sai "não verificável" (GCP × 1,8) e cabe nos 6 cm e 8 cm.
    expect(report.requirements.find((r) => r.id === 'R05-asprs')?.valueText).toContain(
      'não verificável',
    );
    expect(report.coverage.green).toBeGreaterThanOrEqual(0.85);
  });

  it('com 3 GCPs só os MAJOR reprovam (os 5 GCPs e o ASPRS): a missão segue aprovada; sem TF reprova o `R05-tf`', () => {
    const full = syntheticMission(R05, terrain, CATALOG);
    const few = { ...full, groundPoints: full.groundPoints.slice(0, 3) };
    const report = evaluateMission(few, R05, context());
    const failed = report.requirements.filter((r) => !r.pass).map((r) => r.id);
    expect(failed).toContain('R05-gcp');
    expect(failed.every((id) => id === 'R05-gcp' || id === 'R05-asprs')).toBe(true);
    expect(report.critical).toBe(false);
    expect(report.approved).toBe(true);
    const noTf = { ...R05, referencePlan: { ...R05.referencePlan, modes: [] } };
    const flat = evaluateMission(syntheticMission(noTf, terrain, CATALOG), R05, context());
    expect(flat.requirements.find((r) => r.id === 'R05-tf')?.pass).toBe(false);
    expect(flat.critical).toBe(false);
  });
});

describe('R04 — Bosque das Fadas Perdidas', () => {
  const terrain = createTerrain(R04);
  const context = (): MissionContext => ({
    catalog: CATALOG,
    terrain,
    ownsRtkKit: true,
    modifiers: neutralModifiers(),
    staff: { INTERN: 0, JUNIOR_ENG: 0 },
    hardware: HARDWARE[0] as (typeof HARDWARE)[number],
    inField: false,
    firstApproval: true,
    rng: mulberry32(7),
    deps: { computePayment, computeRewards },
  });
  /** O mesmo bosque e a mesma névoa, mas com a câmera RGB de 45 MP no lugar do LiDAR. */
  const rgbContract: Contract = {
    ...R04,
    referencePlan: {
      ...R04.referencePlan,
      sensorId: 'CAM_45MP_FF',
      lensId: 'LENS_24',
      heightM: 100,
      forwardOverlapPct: 75,
      sideOverlapPct: 65,
    },
  };

  it('conforme a ficha: AOI, teto, só névoa, vento, regras, 4 requisitos, recompensa e museu', () => {
    expect(R04.title).toBe('Bosque das Fadas Perdidas');
    expect(R04.client.name).toBe('Lino');
    expect(R04.client.portrait).toEqual({
      shape: 'DIAMOND',
      icon: 'Triangle',
      primary: '#16a34a',
      secondary: '#facc15',
      initials: 'LN',
    });
    expect([R04.dimension, R04.biome, R04.seed]).toEqual(['RIFT', 'RIFT_FAIRY_FOREST', 9404]);
    expect(R04.aoi).toEqual({ widthM: 400, lengthM: 600 });
    expect([R04.ceilingM, R04.terrainReliefM]).toEqual([150, 30]);
    expect(R04.lightingOptions).toEqual(['MAGIC_FOG']);
    expect(R04.wind).toEqual({ meanMs: 1, gustMs: 1, directionDeg: 0 });
    expect(R04.specialRules).toEqual([
      'EM_INTERFERENCE',
      'MAGIC_FOG',
      'DENSE_CANOPY',
      'FEATURE_TARGETS',
    ]);
    expect(R04.requirements.slice(0, -1).map((r) => [r.severity, r.check])).toEqual([
      ['CRITICAL', { type: 'SENSOR_KIND', value: 'LIDAR' }],
      ['CRITICAL', { type: 'FEATURE_CAPTURED', featureId: 'TEMPLE' }],
      ['MAJOR', { type: 'MIN_GROUND_DENSITY', value: 10 }],
      ['MINOR', { type: 'MIN_LIDAR_DENSITY', value: 120 }],
    ]);
    expect(R04.recommended).toMatchObject({
      aircraft: ['DRONE_T2'],
      sensors: ['POD_LIDAR'],
      vehicle: 'FOOT_BIKE',
    });
    expect(R04.minVehicle).toBe('FOOT_BIKE');
    expect([R04.basePaymentBRL, R04.xp, R04.reputationReward]).toEqual([8_000_000, 1400, 5]);
    expect(R04.souvenirId).toBe('SV_TRIANGLE');
    expect(R04.museum).toEqual({ wing: 'RIFT', slot: 3, incomePerMinBRL: 16_000 });
    expect(R04.unlock).toEqual({ type: 'CONTRACT_DONE', contractId: 'C03' });
    expect(R04.overworldMarker).toBe('d');
    expect(
      [R04.dialogs.briefing, R04.dialogs.success, R04.dialogs.failure].map((d) => d.length),
    ).toEqual([2, 1, 1]);
  });

  it('o portal `d` é de quem vai a pé ou de bicicleta, e o slot 3 do museu é só dele', () => {
    expect(MARKER_ACCESS[R04.overworldMarker]).toBe('FOOT_BIKE');
    const marker = WORLD_MAP.markers.find((m) => m.char === R04.overworldMarker) as {
      kind: string;
      x: number;
      y: number;
    };
    expect(marker.kind).toBe('RIFT');
    expect(isReachable(WORLD_MAP, WORLD_MAP.door, marker, 'FOOT_BIKE')).toBe(true);
    const slots = RIFT_CONTRACTS.map((c) => c.museum.slot);
    expect(new Set(slots).size).toBe(slots.length);
  });

  it('o plano de referência voa o T2 com o pod LiDAR: faixa de 112,03 m, 9 linhas, 682,8 s e 428 pts/m²', () => {
    const ref = R04.referencePlan;
    expect(ref).toMatchObject({
      aircraftId: 'DRONE_T2',
      sensorId: 'POD_LIDAR',
      heightM: 80,
      sideOverlapPct: 50,
      speedMs: 10,
      modes: [],
      lighting: 'MAGIC_FOG',
      gcps: [],
      cps: [],
    });
    expect(referenceParams(R04).primarySensor).toBe('LIDAR');
    expect(ref.expected).toEqual({
      gsdCm: 2.13,
      nLines: 9,
      flightTimeS: 682.8,
      lidar: { swathM: 112.03, density: 428, groundDensity: 54 },
    });
    const plan = buildFlightPlan(referenceParams(R04), R04, CATALOG, { meanCanopy: 0.95 });
    expect(plan.stats.lidarSwathM).toBeCloseTo(112.03, 2);
    expect(plan.stats.nLines).toBe(9);
    expect(plan.stats.flightTimeS).toBeCloseTo(682.8, 0);
    expect(plan.stats.lidarDensity).toBeCloseTo(428, 0);
    expect(plan.stats.groundDensity).toBeGreaterThan(48);
    expect(plan.stats.groundDensity).toBeLessThan(60);
    expect(plan.stats.batteriesNeeded).toBe(1);
    // A previsão (sem pontos de apoio) passa em tudo o que depende do plano.
    const predicted = predictRequirements(plan, R04, [], {
      catalog: CATALOG,
      ownsRtkKit: true,
      fieldEquipmentId: 'TOTAL_STATION',
    });
    expect(predicted.filter((r) => !r.pass).map((r) => r.id)).toEqual([]);
  });

  it('MAGIC_FOG: névoa de 250 m, e toda foto RGB sai na névoa e não conta para a cobertura', () => {
    const fx = resolveRuleEffects(R04.specialRules);
    expect(fx.flight.visibilityM).toBe(RULE_PARAMS.magicFog.visibilityM);
    expect(fx.flight.visibilityM).toBe(250);
    expect(fx.coverage.fog).toBe(true);
    expect(fx.terrain.denseCanopy).toEqual(RULE_PARAMS.denseCanopy);
    expect(getAircraft('DRONE_T2').emImmune).toBe(false);
    expect(CATALOG.payloads.some((p) => p.id === 'POD_LIDAR')).toBe(true);
    expect(terrain.zones).toEqual([{ kind: 'FOG', density: 0.9 }]);
  });

  it('o autopilot voa o plano de referência com o LiDAR: 9 linhas, sem colisão, por cima das copas, e captura o templo', () => {
    let minOverCrown = Infinity;
    const { result, used } = fly(R04, (e) => {
      if (e.phase !== 'RUN') return;
      const p = e.pos();
      // Só as árvores em volta (os objetos vêm ordenados por `u`): 1.700 por quadro seria lento.
      for (const t of terrain.objectsInRange(p.u - 12, p.u + 12)) {
        if (t.kind === 'TREE' && Math.hypot(p.u - t.u, p.v - t.v) < t.widthM / 2) {
          minOverCrown = Math.min(
            minOverCrown,
            e.ac.alt - (terrain.elevation(t.u, t.v) + t.heightM),
          );
        }
      }
    });
    expect(result.outcome).toBe('COMPLETED');
    expect(result.collisions).toBe(0);
    expect(result.completedLines).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(result.featuresCaptured).toEqual(['TEMPLE']);
    expect(result.lidar).not.toBeNull();
    // O pod LiDAR é o sensor primário: o voo não dispara a câmera RGB.
    expect(result.photos).toBe(0);
    // 683 s de voo dos 2.100 s do T2.
    expect(used).toBeLessThan(0.6);
    // Sem TF, a altitude é a cota média + 80 m: a copa mais alta fica ≥ 10 m abaixo.
    expect(minOverCrown).toBeGreaterThan(10);
  }, 30_000);

  it('com o plano de referência (missão sintética), o relatório aprova: LiDAR, templo, solo ≥ 10 e densidade ≥ 120 pts/m²', () => {
    const mission = syntheticMission(R04, terrain, CATALOG);
    expect(mission.groundPoints).toHaveLength(0);
    expect(mission.lidar).toBeDefined();
    const report = evaluateMission(mission, R04, context());
    expect(report.critical).toBe(false);
    expect(report.approved).toBe(true);
    expect(report.requirements.slice(0, -1).map((r) => r.id)).toEqual([
      'R04-sensor',
      'R04-temple',
      'R04-ground',
      'R04-density',
    ]);
    expect(report.requirements.every((r) => r.pass)).toBe(true);
    expect(report.requirements.find((r) => r.id === 'R04-temple')?.valueText).toBe('Capturado');
  });

  it('com a câmera RGB a névoa invalida todas as fotos: cobertura 0 e os dois críticos reprovam', () => {
    const mission = syntheticMission(rgbContract, terrain, CATALOG);
    expect(mission.shots.length).toBeGreaterThan(100);
    const report = evaluateMission(mission, R04, context());
    const byId = (id: string) => report.requirements.find((r) => r.id === id);
    expect(report.coverage.green).toBe(0);
    expect(byId('R04-sensor')?.pass).toBe(false);
    expect(byId('R04-temple')?.pass).toBe(false);
    expect(byId('R04-ground')?.pass).toBe(false);
    expect(report.critical).toBe(true);
    expect(report.approved).toBe(false);
  });

  it('sem os dados do LiDAR o templo não é capturado, mesmo com as fotos: reprova pelos críticos', () => {
    const full = syntheticMission(R04, terrain, CATALOG);
    const { lidar: _lidar, ...rest } = full;
    const report = evaluateMission(rest as MissionData, R04, context());
    const byId = (id: string) => report.requirements.find((r) => r.id === id);
    expect(byId('R04-temple')?.pass).toBe(false);
    expect(byId('R04-ground')?.pass).toBe(false);
    expect(report.critical).toBe(true);
    expect(report.approved).toBe(false);
  });

  it('concluir o C03 libera a R04: a fenda é descoberta e sai um aviso', () => {
    resetGameStore();
    const get = () => useGameStore.getState();
    const done = { status: 'COMPLETED' as const, completions: 1, bestScore: 0.9 };
    act(() => {
      useGameStore.setState((s) => ({
        contracts: { ...s.contracts, C00: done, C01: done },
        stats: { ...s.stats, contractsCompleted: 2 },
      }));
      get().refreshUnlocks({ silent: true });
    });
    expect(get().contracts.R04?.status).toBe('LOCKED');
    expect(get().world.discoveredRifts).toEqual(['R01', 'R02']);
    act(() => {
      useGameStore.setState((s) => ({
        contracts: { ...s.contracts, C03: done },
        stats: { ...s.stats, contractsCompleted: 3 },
      }));
      get().refreshUnlocks();
    });
    expect(get().contracts.R04?.status).toBe('AVAILABLE');
    expect(get().world.discoveredRifts).toEqual(['R01', 'R02', 'R04']);
    expect(
      get()
        .session.toasts.filter((t) => t.type === 'rift')
        .map((t) => t.title),
    ).toEqual(['Anomalia dimensional detectada: Bosque das Fadas Perdidas']);
  });
});

describe('R10 — Trincheira da Estrela de Ferro', () => {
  const terrain = createTerrain(R10);
  const context = (): MissionContext => ({
    catalog: CATALOG,
    terrain,
    ownsRtkKit: true,
    modifiers: neutralModifiers(),
    staff: { INTERN: 0, JUNIOR_ENG: 0 },
    hardware: HARDWARE[0] as (typeof HARDWARE)[number],
    inField: false,
    firstApproval: true,
    rng: mulberry32(7),
    deps: { computePayment, computeRewards },
  });
  /** A mesma missão de LiDAR com os pulsos multiplicados por `k` (uma varredura mais rala). */
  const sparser = (mission: MissionData, k: number): MissionData => {
    const lidar = mission.lidar as NonNullable<MissionData['lidar']>;
    return {
      ...mission,
      lidar: { ...lidar, grid: { ...lidar.grid, pulses: lidar.grid.pulses.map((p) => p * k) } },
    };
  };

  it('conforme a ficha: AOI, teto, só luz do sol, vento, regras, 3 requisitos críticos, recompensa e museu', () => {
    expect(R10.title).toBe('Trincheira da Estrela de Ferro');
    expect(R10.client.name).toBe('Lorde Válter');
    expect(R10.client.portrait).toEqual({
      shape: 'SHIELD',
      icon: 'Orbit',
      primary: '#0f172a',
      secondary: '#ef4444',
      initials: 'LV',
    });
    expect([R10.dimension, R10.biome, R10.seed]).toEqual(['RIFT', 'RIFT_IRON_TRENCH', 9010]);
    expect(R10.aoi).toEqual({ widthM: 120, lengthM: 900 });
    expect([R10.ceilingM, R10.terrainReliefM]).toEqual([120, 40]);
    expect(R10.lightingOptions).toEqual(['SUN_HIGH']);
    expect(R10.wind).toEqual({ meanMs: 0, gustMs: 0, directionDeg: 0 });
    expect(R10.specialRules).toEqual(['EM_INTERFERENCE', 'NARROW_TRENCH', 'FEATURE_TARGETS']);
    expect(R10.requirements.slice(0, -1).map((r) => [r.severity, r.check])).toEqual([
      ['CRITICAL', { type: 'SENSOR_KIND', value: 'LIDAR' }],
      ['CRITICAL', { type: 'MIN_LIDAR_DENSITY', value: 100 }],
      ['CRITICAL', { type: 'FEATURE_CAPTURED', featureId: 'EXHAUST_PORT' }],
    ]);
    expect(R10.recommended).toMatchObject({
      aircraft: ['DRONE_T2'],
      sensors: ['POD_LIDAR'],
      vehicle: 'FOOT_BIKE',
    });
    expect(R10.minVehicle).toBe('FOOT_BIKE');
    expect([R10.basePaymentBRL, R10.xp, R10.reputationReward]).toEqual([15_000_000, 2000, 5]);
    expect(R10.souvenirId).toBe('SV_EXHAUST_PORT');
    expect(R10.museum).toEqual({ wing: 'RIFT', slot: 9, incomePerMinBRL: 20_000 });
    expect(R10.unlock).toEqual({
      type: 'ALL',
      of: [
        { type: 'CONTRACT_DONE', contractId: 'C03' },
        { type: 'RIFTS_DONE', count: 5 },
      ],
    });
    expect(R10.overworldMarker).toBe('j');
    expect(
      [R10.dialogs.briefing, R10.dialogs.success, R10.dialogs.failure].map((d) => d.length),
    ).toEqual([2, 1, 1]);
  });

  it('o portal `j` é de quem vai a pé ou de bicicleta, e o slot 9 do museu é só dele; as 11 fendas ocupam os slots 0 a 10', () => {
    expect(MARKER_ACCESS[R10.overworldMarker]).toBe('FOOT_BIKE');
    const marker = WORLD_MAP.markers.find((m) => m.char === R10.overworldMarker) as {
      kind: string;
      x: number;
      y: number;
    };
    expect(marker.kind).toBe('RIFT');
    expect(isReachable(WORLD_MAP, WORLD_MAP.door, marker, 'FOOT_BIKE')).toBe(true);
    const slots = RIFT_CONTRACTS.map((c) => c.museum.slot);
    expect(new Set(slots).size).toBe(slots.length);
    expect(slots.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(RIFT_CONTRACTS).toHaveLength(11);
  });

  it('o plano de referência voa o T2 com o pod LiDAR: faixa de 84,02 m, 4 linhas, 524,8 s e 714 pts/m²', () => {
    const ref = R10.referencePlan;
    expect(ref).toMatchObject({
      aircraftId: 'DRONE_T2',
      sensorId: 'POD_LIDAR',
      heightM: 60,
      sideOverlapPct: 50,
      speedMs: 8,
      modes: [],
      lighting: 'SUN_HIGH',
      gcps: [],
      cps: [],
    });
    expect(referenceParams(R10).primarySensor).toBe('LIDAR');
    expect(ref.expected).toEqual({
      gsdCm: 1.6,
      nLines: 4,
      flightTimeS: 524.8,
      lidar: { swathM: 84.02, density: 714, groundDensity: 714 },
    });
    const plan = buildFlightPlan(referenceParams(R10), R10, CATALOG, { meanCanopy: 0 });
    expect(plan.stats.lidarSwathM).toBeCloseTo(84.02, 2);
    expect(plan.stats.nLines).toBe(4);
    expect(plan.stats.flightTimeS).toBeCloseTo(524.8, 0);
    expect(plan.stats.lidarDensity).toBeCloseTo(714, 0);
    expect(plan.stats.groundDensity).toBeCloseTo(714, 0);
    expect(plan.stats.batteriesNeeded).toBe(1);
    // A densidade cai com a altura e a velocidade (∝ 1/(H·v)): na altura de teto e a 18 m/s ainda passa de 100.
    const fast = buildFlightPlan(
      { ...referenceParams(R10), heightM: 120, speedMs: 18 },
      R10,
      CATALOG,
      { meanCanopy: 0 },
    );
    expect(fast.stats.lidarDensity).toBeCloseTo(714 * (60 / 120) * (8 / 18), 0);
    expect(fast.stats.lidarDensity as number).toBeGreaterThan(100);
    // Sem pontos de apoio e sem CPs: a previsão passa em tudo.
    const predicted = predictRequirements(plan, R10, [], {
      catalog: CATALOG,
      ownsRtkKit: true,
      fieldEquipmentId: 'TOTAL_STATION',
    });
    expect(predicted.filter((r) => !r.pass).map((r) => r.id)).toEqual([]);
  });

  it('o autopilot voa o plano de referência com o LiDAR: 4 linhas, sem colisão, por cima das torres, e captura a escotilha', () => {
    const towers = terrain.objects.filter((o) => o.kind === 'TOWER');
    let minOverTower = Infinity;
    let aglInTrench = 0;
    const { result, used } = fly(R10, (e) => {
      if (e.phase !== 'RUN') return;
      const p = e.pos();
      for (const t of towers) {
        if (Math.hypot(p.u - t.u, p.v - t.v) < t.widthM) {
          minOverTower = Math.min(
            minOverTower,
            e.ac.alt - (terrain.elevation(t.u, t.v) + t.heightM),
          );
        }
      }
      if (Math.abs(p.v - 60) < 25)
        aglInTrench = Math.max(aglInTrench, e.ac.alt - terrain.elevation(p.u, p.v));
    });
    expect(result.outcome).toBe('COMPLETED');
    expect(result.collisions).toBe(0);
    expect(result.completedLines).toEqual([0, 1, 2, 3]);
    expect(result.featuresCaptured).toEqual(['EXHAUST_PORT']);
    expect(result.lidar).not.toBeNull();
    // O LiDAR é o sensor primário: sem fotos.
    expect(result.photos).toBe(0);
    // 525 s de voo dos 2.100 s do T2.
    expect(used).toBeLessThan(0.4);
    // Sem TF, o T2 voa a cota média + 60 m (~44 m): 20 m acima das torres de 20 m, e no fundo o AGL passa dos 80 m.
    expect(minOverTower).toBeGreaterThan(15);
    expect(aglInTrench).toBeGreaterThan(80);
  }, 30_000);

  it('com o plano de referência (missão sintética), o relatório aprova com 714 pts/m² e a escotilha capturada', () => {
    const mission = syntheticMission(R10, terrain, CATALOG);
    expect(mission.groundPoints).toHaveLength(0);
    expect(mission.lidar).toBeDefined();
    const report = evaluateMission(mission, R10, context());
    expect(report.critical).toBe(false);
    expect(report.approved).toBe(true);
    expect(report.requirements.slice(0, -1).map((r) => r.id)).toEqual([
      'R10-sensor',
      'R10-density',
      'R10-port',
    ]);
    expect(report.requirements.every((r) => r.pass)).toBe(true);
    expect(report.requirements.find((r) => r.id === 'R10-density')?.valueText).toMatch(
      /^714,\d pts\/m²$/,
    );
    expect(report.requirements.find((r) => r.id === 'R10-port')?.valueText).toBe('Capturado');
  });

  it('com a câmera RGB reprova pelos três críticos; uma varredura rala (1/10 dos pulsos) reprova pela densidade e outra, mais rala, também pela escotilha', () => {
    const rgbContract = {
      ...R10,
      referencePlan: { ...R10.referencePlan, sensorId: 'CAM_45MP_FF', lensId: 'LENS_24' as const },
    };
    const rgb = evaluateMission(syntheticMission(rgbContract, terrain, CATALOG), R10, context());
    expect(rgb.requirements.filter((r) => !r.pass).map((r) => r.id)).toEqual([
      'R10-sensor',
      'R10-density',
      'R10-port',
    ]);
    expect(rgb.approved).toBe(false);
    const full = syntheticMission(R10, terrain, CATALOG);
    const thin = evaluateMission(sparser(full, 0.1), R10, context());
    const byId = (id: string) => thin.requirements.find((r) => r.id === id);
    // 71 pts/m²: abaixo dos 100 exigidos, mas ainda acima dos 50 pulsos/m² que capturam a escotilha.
    expect(byId('R10-density')?.pass).toBe(false);
    expect(byId('R10-port')?.pass).toBe(true);
    expect(thin.critical).toBe(true);
    expect(thin.approved).toBe(false);
    const thinner = evaluateMission(sparser(full, 0.05), R10, context());
    expect(thinner.requirements.find((r) => r.id === 'R10-density')?.pass).toBe(false);
    expect(thinner.requirements.find((r) => r.id === 'R10-port')?.pass).toBe(false);
    expect(thinner.approved).toBe(false);
  });

  it('desbloqueio: o C03 e cinco fendas concluídas — com quatro a R10 segue bloqueada, com cinco abre com um aviso', () => {
    resetGameStore();
    const get = () => useGameStore.getState();
    const done = { status: 'COMPLETED' as const, completions: 1, bestScore: 0.9 };
    const completed = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, done]));
    // O C03 e quatro fendas: ainda não.
    act(() => {
      useGameStore.setState((s) => ({
        contracts: {
          ...s.contracts,
          ...completed(['C00', 'C01', 'C03', 'R01', 'R02', 'R03', 'R04']),
        },
        stats: { ...s.stats, contractsCompleted: 7 },
      }));
      get().refreshUnlocks({ silent: true });
    });
    expect(get().contracts.R10?.status).toBe('LOCKED');
    expect(get().world.discoveredRifts).not.toContain('R10');
    // Cinco fendas sem o C03: também não.
    act(() => {
      useGameStore.setState((s) => ({
        contracts: {
          ...s.contracts,
          C03: { status: 'AVAILABLE' as const, completions: 0, bestScore: 0 },
          ...completed(['R05']),
        },
      }));
      get().refreshUnlocks({ silent: true });
    });
    expect(get().contracts.R10?.status).toBe('LOCKED');
    // O C03 e as cinco: abre, e a fenda é descoberta com um aviso.
    act(() => {
      useGameStore.setState((s) => ({ contracts: { ...s.contracts, ...completed(['C03']) } }));
      get().refreshUnlocks();
    });
    expect(get().contracts.R10?.status).toBe('AVAILABLE');
    expect(get().world.discoveredRifts).toContain('R10');
    expect(
      get()
        .session.toasts.filter((t) => t.type === 'rift')
        .map((t) => t.title),
    ).toContain('Anomalia dimensional detectada: Trincheira da Estrela de Ferro');
  });
});
