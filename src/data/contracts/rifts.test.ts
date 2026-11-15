/** Fichas das Fendas Dimensionais (contracts-rifts): uma por tarefa T060–T070. */
import { act } from '@testing-library/react';
import { CATALOG, getAircraft, HARDWARE } from '@/data/catalog';
import { MARKER_ACCESS } from '@/data/overworld/map';
import { computePayment, computeRewards } from '@/domain/economy';
import { classifyPec } from '@/domain/standards';
import { buildFlightPlan } from '@/domain/flightPlanner';
import { evaluateMission, type MissionContext } from '@/domain/mission';
import { neutralModifiers } from '@/domain/modifiers';
import { referenceParams, syntheticMission } from '@/domain/referencePlan';
import { resolveRuleEffects, RULE_PARAMS } from '@/domain/specialRules';
import { mulberry32 } from '@/lib/rng';
import { useGameStore } from '@/state/store';
import { resetGameStore } from '@/test/resetStore';
import type { VehicleId } from '@/types';
import { isReachable } from '@/world/overworld/pathfinding';
import { WORLD_MAP } from '@/world/overworld/tiles';
import { createTerrain } from '@/world/terrain/createTerrain';
import { CONTRACTS, getContract } from '.';
import { R01, R02, RIFT_CONTRACTS } from './rifts';

describe('catálogo das fendas', () => {
  it('as fendas do catálogo são só de dimensão RIFT, entram em CONTRACTS e seguem a ordem das tarefas', () => {
    expect(RIFT_CONTRACTS.every((c) => c.dimension === 'RIFT')).toBe(true);
    expect(RIFT_CONTRACTS.map((c) => c.id)).toEqual(['R01', 'R02']);
    for (const c of RIFT_CONTRACTS) expect(CONTRACTS).toContain(c);
    expect(getContract('R01')).toBe(R01);
    expect(getContract('R02')).toBe(R02);
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
    expect(R01.requirements.map((r) => [r.severity, r.check])).toEqual([
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
    expect(report.requirements.map((r) => r.id)).toEqual([
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
    expect(R02.requirements.map((r) => [r.severity, r.check])).toEqual([
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
    expect(report.requirements.map((r) => r.id)).toEqual([
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
