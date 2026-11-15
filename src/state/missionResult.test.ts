import { C00 } from '@/data/contracts';
import { evaluateForState } from '@/screens/processing/evaluate';
import { syntheticMission } from '@/test/fixtures/syntheticMission';
import { resetGameStore } from '@/test/resetStore';
import type { MissionData, QualityReport } from '@/types';
import { createTerrain } from '@/world/terrain/createTerrain';
import { canBeStolen } from './slices/missionSlice';
import { useGameStore } from './store';

const get = () => useGameStore.getState();

function queue(over: Partial<MissionData> = {}): MissionData {
  const mission = {
    ...syntheticMission(C00, createTerrain(C00)),
    status: 'PENDING_PROCESSING' as const,
    ...over,
  };
  useGameStore.setState((s) => ({
    mission: { ...s.mission, pending: [...s.mission.pending, mission] },
  }));
  return mission;
}

beforeEach(() => resetGameStore());

describe('applyMissionResult (processing-results §3, §5.8, §5.9)', () => {
  it('aprovação inédita: saldo + total exato, XP, reputação, souvenir, contrato, museu — uma vez só', () => {
    const mission = queue();
    const report = evaluateForState(get(), mission, false);
    expect(report.approved).toBe(true);
    expect(report.souvenirAwarded).toBe('SV_NOTEBOOK');
    const money = get().player.money;
    expect(get().applyMissionResult(report)).toBe(true);
    expect(get().player.money).toBe(money + report.payment.totalBRL);
    expect(get().player.xp > 0 || get().player.level > 1).toBe(true);
    expect(get().souvenirs).toEqual(['SV_NOTEBOOK']);
    expect(get().contracts.C00).toMatchObject({
      status: 'COMPLETED',
      completions: 1,
      bestScore: report.qualityScore,
    });
    expect(get().contracts.C00?.bestMissionLines).toHaveLength(mission.plan.lines.length);
    expect(get().museum.sectors.C00).toMatchObject({
      contractId: 'C00',
      qualityScore: report.qualityScore,
    });
    expect(get().mission.pending).toEqual([]);
    expect(get().stats.contractsCompleted).toBe(1);
    const toasts = get().session.toasts.map((t) => t.title);
    expect(toasts.filter((t) => t === 'Souvenir: Caderneta de Campo do Avô')).toHaveLength(1);

    // Segunda chamada (re-render, recarregar): nada muda.
    const snapshot = {
      money: get().player.money,
      xp: get().player.xp,
      toasts: get().session.toasts.length,
    };
    expect(get().applyMissionResult(report)).toBe(false);
    expect({
      money: get().player.money,
      xp: get().player.xp,
      toasts: get().session.toasts.length,
    }).toEqual(snapshot);
  });

  it('missão em campo (ativa) também sai; o museu só troca por um resultado melhor', () => {
    const mission = { ...syntheticMission(C00, createTerrain(C00)), status: 'IN_FLIGHT' as const };
    get().beginMission(mission);
    const report = evaluateForState(get(), mission, true);
    get().applyMissionResult(report);
    expect(get().mission.active).toBeNull();
    const sector = get().museum.sectors.C00;
    const worse: QualityReport = {
      ...report,
      missionId: 'C00-replay',
      qualityScore: report.qualityScore - 0.1,
    };
    queue({ id: 'C00-replay', isReplay: true });
    expect(get().applyMissionResult(worse)).toBe(true);
    expect(get().museum.sectors.C00).toEqual(sector);
    expect(get().contracts.C00?.completions).toBe(2);
  });

  it('subir de nível: toast por nível', () => {
    const mission = queue();
    const report = { ...evaluateForState(get(), mission, false), xp: 1000 };
    get().applyMissionResult(report);
    expect(get().player.level).toBeGreaterThanOrEqual(3);
    expect(get().session.toasts.filter((t) => t.title.startsWith('Nível ')).length).toBe(
      get().player.level - 1,
    );
  });

  it('falha crítica: a MegaMap rouba se houver outro contrato jogável (OQ-010); senão, não', () => {
    const mission = queue();
    const ok = evaluateForState(get(), mission, false);
    const failed: QualityReport = {
      ...ok,
      approved: false,
      critical: true,
      qualityScore: 0,
      souvenirAwarded: undefined,
    } as QualityReport;
    // Só o C00 existe: não há outro contrato para "reconquistar" o roubado.
    expect(canBeStolen(get().contracts, 'C00')).toBe(false);
    get().applyMissionResult(failed);
    expect(get().contracts.C00?.status).toBe('AVAILABLE');
    expect(get().rival.score).toBe(0);

    // Com outro contrato disponível, o C00 é roubado.
    useGameStore.setState((s) => ({
      contracts: { ...s.contracts, C01: { status: 'AVAILABLE', completions: 0, bestScore: 0 } },
    }));
    const again = queue({ id: 'C00-2' });
    get().applyMissionResult({ ...failed, missionId: again.id });
    expect(get().contracts.C00).toMatchObject({ status: 'STOLEN', stolenAtCompletionCount: 0 });
    expect(get().rival.score).toBe(1);
  });

  it('o roubado volta depois de concluir outro contrato', () => {
    useGameStore.setState((s) => ({
      contracts: {
        ...s.contracts,
        C05: { status: 'STOLEN', completions: 0, bestScore: 0, stolenAtCompletionCount: 0 },
      },
    }));
    const mission = queue();
    get().applyMissionResult(evaluateForState(get(), mission, false));
    expect(get().contracts.C05?.status).toBe('AVAILABLE');
  });
});
