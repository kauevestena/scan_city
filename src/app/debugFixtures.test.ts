import { CATALOG, getVehicle } from '@/data/catalog';
import { C01 } from '@/data/contracts';
import { isAccessible } from '@/domain/accessibility';
import { buildFlightPlan } from '@/domain/flightPlanner';
import { referenceParams } from '@/domain/referencePlan';
import { useGameStore } from '@/state/store';
import { resetGameStore } from '@/test/resetStore';
import { createTerrain } from '@/world/terrain/createTerrain';
import { applyDebugFlags, createDebugMission } from './debugFixtures';
import { parseDebugFlags } from './debugFlags';

const get = () => useGameStore.getState();

describe('createDebugMission por contrato', () => {
  it('C00 mantém o plano fixo do tutorial (Atlas, 6 linhas, 96 fotos)', () => {
    const planning = createDebugMission('C00', false);
    expect(planning.plan.params.aircraftId).toBe('ATLAS');
    expect(planning.plan.stats.nLines).toBe(6);
    expect(planning.shots).toHaveLength(0);
    expect(createDebugMission('C00', true).shots).toHaveLength(96);
  });

  it('um contrato do catálogo usa o plano de referência dele e pontos acessíveis', () => {
    const mission = createDebugMission('C01', false);
    const plan = buildFlightPlan(referenceParams(C01), C01, CATALOG);
    expect(mission.contractId).toBe('C01');
    expect(mission.plan).toEqual(plan);
    expect(mission.plan.params.aircraftId).toBe('DRONE_T1');
    expect(mission.plan.stats.nLines).toBe(C01.referencePlan.expected.nLines);
    expect(mission.status).toBe('PLANNING');
    expect([mission.shots.length, mission.sorties.length, mission.completedLines.length]).toEqual([
      0, 0, 0,
    ]);

    // 5 GCPs e 2 CPs, todos fora de telhado e ao alcance de quem vai a campo.
    expect(mission.groundPoints.map((p) => p.kind)).toEqual([
      'GCP',
      'GCP',
      'GCP',
      'GCP',
      'GCP',
      'CP',
      'CP',
    ]);
    const terrain = createTerrain(C01);
    const vehicles = [getVehicle(C01.minVehicle), getVehicle(C01.recommended.vehicle)];
    for (const p of mission.groundPoints) {
      expect(isAccessible(p.u, p.v, terrain, vehicles, { paintMarkers: false }), p.id).toEqual({
        ok: true,
      });
      expect(p.elevM).toBe(terrain.elevation(p.u, p.v));
    }
  });

  it('com dados, traz as fotos do plano e todas as linhas concluídas', () => {
    const mission = createDebugMission('C01', true);
    expect(mission.status).toBe('PENDING_PROCESSING');
    expect(mission.shots.length).toBeGreaterThan(100);
    expect(mission.completedLines).toHaveLength(C01.referencePlan.expected.nLines);
    expect(mission.shots.every((s) => s.lighting === 'SUN_HIGH')).toBe(true);
  });

  it('contrato fora do catálogo continua com o plano do tutorial', () => {
    const mission = createDebugMission('C99', false);
    expect(mission.contractId).toBe('C99');
    expect(mission.plan.params.aircraftId).toBe('ATLAS');
  });
});

describe('applyDebugFlags com contract= de um contrato do catálogo', () => {
  beforeEach(() => resetGameStore());

  it('abre o voo do C01 com o plano dele e libera o contrato bloqueado', () => {
    expect(get().contracts.C01?.status).toBe('LOCKED');
    applyDebugFlags(parseDebugFlags('?debug=1&screen=SURVEY_FLIGHT&contract=C01'));
    expect(get().session.screen).toBe('SURVEY_FLIGHT');
    expect(get().mission.active?.contractId).toBe('C01');
    expect(get().mission.active?.plan.params.aircraftId).toBe('DRONE_T1');
    expect(get().contracts.C01?.status).toBe('AVAILABLE');
    // Um contrato concluído não é rebaixado.
    useGameStore.setState((s) => ({
      mission: { ...s.mission, active: null },
      contracts: { ...s.contracts, C01: { status: 'COMPLETED', completions: 1, bestScore: 1 } },
    }));
    applyDebugFlags(parseDebugFlags('?debug=1&screen=SURVEY_FLIGHT&contract=C01'));
    expect(get().contracts.C01?.status).toBe('COMPLETED');
  });
});
