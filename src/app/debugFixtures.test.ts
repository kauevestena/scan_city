import { CATALOG, getVehicle } from '@/data/catalog';
import { C01, CONTRACTS } from '@/data/contracts';
import { isAccessible } from '@/domain/accessibility';
import { buildFlightPlan } from '@/domain/flightPlanner';
import { referenceParams } from '@/domain/referencePlan';
import { useGameStore } from '@/state/store';
import { resetGameStore } from '@/test/resetStore';
import { createTerrain } from '@/world/terrain/createTerrain';
import { applyDebugFlags, createDebugMission, mapAllSectors } from './debugFixtures';
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

describe('equipamento do plano de referência nos fluxos de depuração', () => {
  beforeEach(() => resetGameStore());

  it('contrato com aeronave RTK: o jogador ganha aeronave, câmera, lente e o kit GNSS do combo', () => {
    expect(get().inventory.aircraft).not.toContain('DRONE_T2');
    applyDebugFlags(parseDebugFlags('?debug=1&screen=SURVEY_FLIGHT&contract=C06'));
    const inv = get().inventory;
    expect(inv.aircraft).toContain('DRONE_T2');
    expect(inv.sensors).toContain('CAM_45MP_FF');
    expect(inv.lenses).toContain('LENS_24');
    expect(inv.fieldEquipment).toContain('GNSS_RTK_KIT');
    expect(get().contracts.C06?.status).toBe('AVAILABLE');
  });

  it('aeronave sem RTK não ganha o kit, e quem já tem o item não o recebe duas vezes', () => {
    applyDebugFlags(parseDebugFlags('?debug=1&screen=SURVEY_FLIGHT&contract=C01'));
    expect(get().inventory.aircraft.filter((a) => a === 'DRONE_T1')).toHaveLength(1);
    expect(get().inventory.fieldEquipment).not.toContain('GNSS_RTK_KIT');
    useGameStore.setState((s) => ({ mission: { ...s.mission, active: null } }));
    applyDebugFlags(parseDebugFlags('?debug=1&screen=SURVEY_FLIGHT&contract=C01'));
    expect(get().inventory.aircraft.filter((a) => a === 'DRONE_T1')).toHaveLength(1);
  });

  it('a tela de processamento também recebe o equipamento (o relatório conta com o RTK)', () => {
    applyDebugFlags(parseDebugFlags('?debug=1&screen=PROCESSING_RESULTS&contract=C06'));
    expect(get().inventory.fieldEquipment).toContain('GNSS_RTK_KIT');
    expect(get().mission.pending[0]?.contractId).toBe('C06');
  });

  it('o C00 mantém o inventário do jogo novo', () => {
    const before = get().inventory;
    applyDebugFlags(parseDebugFlags('?debug=1&screen=SURVEY_FLIGHT'));
    expect(get().inventory).toEqual(before);
  });
});

describe('mapAllSectors (F9 "Mapear tudo", T072)', () => {
  beforeEach(() => resetGameStore());

  it('mapeia os 18 contratos, com a melhor missão e a aeronave de referência', () => {
    const before = get().contracts;
    mapAllSectors(useGameStore);
    expect(Object.keys(get().museum.sectors).sort()).toEqual(CONTRACTS.map((c) => c.id).sort());
    expect(CONTRACTS).toHaveLength(18);
    for (const c of CONTRACTS) {
      const progress = get().contracts[c.id];
      expect(progress?.bestAircraftId).toBe(c.referencePlan.aircraftId);
      expect(progress?.bestMissionLines?.length).toBe(c.referencePlan.expected.nLines);
      // Só o museu muda: status e bloqueios dos contratos ficam como estavam.
      expect(progress?.status).toBe(before[c.id]?.status);
    }
  }, 60_000);

  it('preserva um setor já mapeado (nota e renda)', () => {
    useGameStore.setState((s) => ({
      museum: {
        ...s.museum,
        sectors: {
          C01: {
            contractId: 'C01',
            qualityScore: 0.95,
            mappedAt: 7,
            incomePerMinBRL: 3800,
            className: 'A',
          },
        },
      },
    }));
    mapAllSectors(useGameStore);
    expect(get().museum.sectors.C01).toMatchObject({ qualityScore: 0.95, incomePerMinBRL: 3800 });
    expect(Object.keys(get().museum.sectors)).toHaveLength(18);
  }, 60_000);
});
