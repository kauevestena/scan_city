import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { C00 } from '@/data/contracts';
import { syntheticMission } from '@/test/fixtures/syntheticMission';
import { resetGameStore } from '@/test/resetStore';
import { useGameStore } from '@/state/store';
import type { GroundPoint, MissionData } from '@/types';
import { createTerrain } from '@/world/terrain/createTerrain';
import { evaluateForState } from './evaluate';
import { ProcessingResultsScreen } from './ProcessingResultsScreen';
import { multiplierText } from './ReportAccuracy';
import { paymentRows } from './ReportPayment';

const get = () => useGameStore.getState();

function queue(over: Partial<MissionData> = {}): MissionData {
  const mission = {
    ...syntheticMission(C00, createTerrain(C00)),
    status: 'PENDING_PROCESSING' as const,
    ...over,
  };
  useGameStore.setState((s) => ({
    mission: { ...s.mission, pending: [...s.mission.pending, mission] },
    session: {
      ...s.session,
      screen: 'PROCESSING_RESULTS',
      payload: { missionId: mission.id, inField: false },
    },
  }));
  return mission;
}

/** Workstation em nuvem: a esteira do C00 leva ~0,9 s. */
const fastHardware = () =>
  useGameStore.setState((s) => ({ inventory: { ...s.inventory, hardware: 'CLOUD' } }));

beforeEach(() => resetGameStore());

describe('avaliação (critérios 1 e 2)', () => {
  it('C00 de referência no notebook: esteira de 13,68 s, aprovado com classe ≥ C', () => {
    const mission = queue();
    const report = evaluateForState(get(), mission, false);
    expect(report.processingTimeS).toBeCloseTo(13.68, 9);
    expect(report.approved).toBe(true);
    expect(['A', 'B', 'C']).toContain(report.pec?.planimetric.achieved);
    expect(report.lens?.reprojErrorPx).toBeGreaterThan(0);
  });

  it('3 GCPs colineares: "Geometria dos GCPs (Z ×3,00)" e o RMSE_z reflete', () => {
    const base = syntheticMission(C00, createTerrain(C00));
    const collinear: GroundPoint[] = [
      { id: 'GCP1', kind: 'GCP', u: 20, v: 20, elevM: 0, sigmaM: 0.01 },
      { id: 'GCP2', kind: 'GCP', u: 120, v: 80, elevM: 0, sigmaM: 0.01 },
      { id: 'GCP3', kind: 'GCP', u: 220, v: 140, elevM: 0, sigmaM: 0.01 },
      ...base.groundPoints.filter((p) => p.kind === 'CP'),
    ];
    const good = evaluateForState(get(), queue(), false);
    const bad = evaluateForState(get(), queue({ id: 'C00-col', groundPoints: collinear }), false);
    const texts = bad.multipliers.map(multiplierText);
    // Colineares: casco de área zero também penaliza XY (2,5); o Z leva o ×3,00.
    expect(texts).toContain('Geometria dos GCPs (XY ×2,50, Z ×3,00)');
    expect(bad.rmse.gcp.z).toBeGreaterThan(good.rmse.gcp.z * 1.5);
    expect(multiplierText({ label: 'Poucos GCPs', xy: 1.6, z: 1.6 })).toBe('Poucos GCPs (×1,60)');
    expect(multiplierText({ label: 'X', xy: 1.35, z: 1 })).toBe('X (XY ×1,35)');
    expect(multiplierText({ label: 'Y', xy: 1.2, z: 1.5 })).toBe('Y (XY ×1,20, Z ×1,50)');
  });

  it('linhas do pagamento: as neutras ficam de fora', () => {
    const report = evaluateForState(get(), queue(), false);
    expect(paymentRows(report.payment).map(([k]) => k)).toEqual([
      'Valor-base',
      '× qualidade (score)',
    ]);
    const full = paymentRows({
      ...report.payment,
      replayFactor: 0.4,
      rivalFactor: 0.85,
      managementBonus: 1.1,
      staffBonus: 1.2,
      staffCostBRL: 1000,
      penaltiesBRL: 500,
    });
    expect(full).toHaveLength(8);
  });
});

describe('ProcessingResultsScreen', () => {
  it('esteira → relatório: saldo + total exato, souvenir e toast uma vez (critério 4)', async () => {
    fastHardware();
    const mission = queue();
    const report = evaluateForState(get(), mission, false);
    const money = get().player.money;
    const { rerender } = render(<ProcessingResultsScreen />);
    expect(screen.getByTestId('pipeline')).toBeInTheDocument();
    expect(screen.getByTestId('processing-header')).toHaveTextContent(
      'Sítio do Avô · Processamento — Workstation: Servidores em Nuvem ×15,0',
    );
    await waitFor(() => expect(screen.getByTestId('report')).toBeInTheDocument(), {
      timeout: 8000,
    });
    rerender(<ProcessingResultsScreen />);
    expect(get().player.money).toBe(money + report.payment.totalBRL);
    expect(get().souvenirs).toEqual(['SV_NOTEBOOK']);
    expect(get().session.toasts.filter((t) => t.title.startsWith('Souvenir:'))).toHaveLength(1);
    expect(get().mission.pending).toEqual([]);

    // Resumo, acurácia, cobertura e pagamento.
    expect(screen.getByTestId('report-status')).toHaveTextContent('APROVADO');
    expect(within(screen.getByTestId('report-requirements')).getAllByRole('listitem')).toHaveLength(
      6,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Acurácia' }));
    expect(screen.getByTestId('residuals')).toHaveTextContent('CP1');
    expect(screen.getByTestId('pec')).toHaveTextContent('Classe exigida: C');
    fireEvent.click(screen.getByRole('tab', { name: 'Cobertura' }));
    expect(screen.getByTestId('coverage-legend')).toHaveTextContent('≥ 5 fotos');
    fireEvent.mouseMove(screen.getByTestId('coverage-canvas'), { clientX: 0, clientY: 0 });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mostrar centros das fotos' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Pagamento' }));
    await waitFor(() => expect(screen.getByTestId('payment-total')).toBeInTheDocument(), {
      timeout: 3000,
    });
    expect(screen.getByTestId('souvenir-card')).toHaveTextContent('Caderneta de Campo do Avô');

    // Enviar ao museu (T11).
    fireEvent.click(screen.getByTestId('send-museum'));
    expect(get().session.screen).toBe('HOLO_TABLE_VIEW');
    expect(get().session.payload).toEqual({ focusSectorId: 'C00' });
  }, 15000);

  it('sair durante a esteira não aplica as recompensas (a missão segue na fila)', async () => {
    const mission = queue();
    const money = get().player.money;
    const { unmount } = render(<ProcessingResultsScreen />);
    await act(() => new Promise<void>((r) => setTimeout(r, 200)));
    unmount();
    expect(get().player.money).toBe(money);
    expect(get().mission.pending.map((m) => m.id)).toEqual([mission.id]);
  });

  it('reprovado: botão do museu desabilitado; Concluir volta ao escritório', async () => {
    fastHardware();
    queue({ shots: [] });
    render(<ProcessingResultsScreen />);
    await waitFor(() => expect(screen.getByTestId('report')).toBeInTheDocument(), {
      timeout: 8000,
    });
    expect(screen.getByTestId('report-status')).toHaveTextContent('REPROVADO');
    expect(screen.getByTestId('send-museum')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Concluir/ }));
    expect(get().session.screen).toBe('OFFICE');
  }, 15000);

  it('missão inexistente: aviso e volta ao escritório', () => {
    useGameStore.setState((s) => ({
      session: {
        ...s.session,
        screen: 'PROCESSING_RESULTS',
        payload: { missionId: 'nada', inField: false },
      },
    }));
    render(<ProcessingResultsScreen />);
    expect(screen.getByText('Missão não encontrada na fila de processamento.')).toBeInTheDocument();
  });
});
