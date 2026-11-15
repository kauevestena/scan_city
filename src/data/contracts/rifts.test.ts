/** Fichas das Fendas Dimensionais (contracts-rifts): uma por tarefa T060–T070. */
import { act } from '@testing-library/react';
import { CATALOG, getAircraft, getSensor, HARDWARE } from '@/data/catalog';
import { MARKER_ACCESS } from '@/data/overworld/map';
import { computePayment, computeRewards } from '@/domain/economy';
import { capturedFeatures } from '@/domain/features';
import { classifyPec } from '@/domain/standards';
import { buildFlightPlan } from '@/domain/flightPlanner';
import { predictRequirements } from '@/domain/requirements';
import { estimatedSideOverlapPct, evaluateMission, type MissionContext } from '@/domain/mission';
import { neutralModifiers } from '@/domain/modifiers';
import { referenceParams, referencePoints, syntheticMission } from '@/domain/referencePlan';
import { resolveRuleEffects, RULE_PARAMS } from '@/domain/specialRules';
import { mulberry32 } from '@/lib/rng';
import { useGameStore } from '@/state/store';
import { resetGameStore } from '@/test/resetStore';
import type { VehicleId } from '@/types';
import { isReachable } from '@/world/overworld/pathfinding';
import { WORLD_MAP } from '@/world/overworld/tiles';
import { createTerrain } from '@/world/terrain/createTerrain';
import { CONTRACTS, getContract } from '.';
import { R01, R02, R08, R11, RIFT_CONTRACTS } from './rifts';

describe('catálogo das fendas', () => {
  it('as fendas do catálogo são só de dimensão RIFT, entram em CONTRACTS e seguem a ordem das tarefas', () => {
    expect(RIFT_CONTRACTS.every((c) => c.dimension === 'RIFT')).toBe(true);
    expect(RIFT_CONTRACTS.map((c) => c.id)).toEqual(['R01', 'R02', 'R08', 'R11']);
    for (const c of RIFT_CONTRACTS) expect(CONTRACTS).toContain(c);
    expect(getContract('R01')).toBe(R01);
    expect(getContract('R02')).toBe(R02);
    expect(getContract('R08')).toBe(R08);
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
    expect(R08.requirements.map((r) => [r.severity, r.check])).toEqual([
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
    expect(report.requirements.map((r) => r.id)).toEqual([
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
    expect(R11.requirements.map((r) => [r.severity, r.check])).toEqual([
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
    expect(report.requirements.map((r) => r.id)).toEqual([
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
