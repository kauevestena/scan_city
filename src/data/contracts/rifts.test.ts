/** Fichas das Fendas Dimensionais (contracts-rifts): uma por tarefa T060–T070. */
import { act } from '@testing-library/react';
import { CATALOG, getAircraft, HARDWARE } from '@/data/catalog';
import { MARKER_ACCESS } from '@/data/overworld/map';
import { computePayment, computeRewards } from '@/domain/economy';
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
import { R01, RIFT_CONTRACTS } from './rifts';

describe('catálogo das fendas', () => {
  it('as fendas do catálogo são só de dimensão RIFT, entram em CONTRACTS e seguem a ordem das tarefas', () => {
    expect(RIFT_CONTRACTS.every((c) => c.dimension === 'RIFT')).toBe(true);
    expect(RIFT_CONTRACTS.map((c) => c.id)).toEqual(['R01']);
    for (const c of RIFT_CONTRACTS) expect(CONTRACTS).toContain(c);
    expect(getContract('R01')).toBe(R01);
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

  it('concluir o C01 libera a R01 e a descobre: a aba Fendas aparece e o aviso de anomalia sai', () => {
    resetGameStore();
    const get = () => useGameStore.getState();
    expect(get().contracts.R01?.status).toBe('LOCKED');
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
    expect(get().world.discoveredRifts).toEqual(['R01']);
    expect(
      get()
        .session.toasts.filter((t) => t.type === 'rift')
        .map((t) => t.title),
    ).toEqual(['Anomalia dimensional detectada: Colinas Verdes dos Espinhos']);
  });
});
