import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { C00 } from '@/data/contracts';
import { createCoverageGrid } from '@/domain/coverage';
import { syntheticMission } from '@/test/fixtures/syntheticMission';
import { resetGameStore } from '@/test/resetStore';
import { useGameStore } from '@/state/store';
import type { GroundPoint, MissionData } from '@/types';
import { createTerrain } from '@/world/terrain/createTerrain';
import { evaluateForState } from './evaluate';
import { ProcessingResultsScreen } from './ProcessingResultsScreen';
import { multiplierText } from './ReportAccuracy';
import { paymentRows } from './ReportPayment';
import { ReportAccuracy } from './ReportAccuracy';
import { STRINGS } from '@/data/strings';
import type { LidarGrid, LidarSample, QualityReport } from '@/types';

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

  it('aba Produtos: "Ver produtos" abre o visualizador; NDVI vem desabilitado no C00', async () => {
    fastHardware();
    queue();
    render(<ProcessingResultsScreen />);
    await waitFor(() => expect(screen.getByTestId('report')).toBeInTheDocument(), {
      timeout: 8000,
    });
    expect(screen.getByRole('tab', { name: 'Produtos' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver produtos' }));
    expect(screen.getByTestId('report-products')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Produtos' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'NDVI' })).toHaveAttribute('aria-disabled', 'true');
    // Já na aba, o atalho some.
    expect(screen.queryByRole('button', { name: 'Ver produtos' })).not.toBeInTheDocument();
  }, 15000);

  describe('esteira LiDAR (T043)', () => {
    const lidarData = (): NonNullable<MissionData['lidar']> => {
      const grid = createCoverageGrid(C00.aoi);
      const pulses = grid.counts.map(() => 20_000);
      const lg: LidarGrid = {
        cols: grid.cols,
        rows: grid.rows,
        pulses,
        firstAbove: pulses,
        ground: pulses,
        cellAreaM2: 10,
      };
      const rets = ['FIRST', 'INTERMEDIATE', 'GROUND'] as const;
      const samples: LidarSample[] = Array.from({ length: 120 }, (_, k) => ({
        u: (k * 7.7) % C00.aoi.lengthM,
        v: (k * 3.3) % C00.aoi.widthM,
        z: (k % 20) / 4,
        ret: rets[k % 3] as LidarSample['ret'],
      }));
      return { grid: lg, samples };
    };
    const stageNames = () =>
      within(screen.getByTestId('pipeline'))
        .getAllByRole('listitem')
        .filter((li) => li.hasAttribute('data-stage'))
        .map((li) =>
          li.textContent
            ?.replace(/^·/, '')
            .replace(/\d+ %$/, '')
            .trim(),
        );

    it('só LiDAR (sem fotos): 6 etapas da esteira LiDAR, na ordem', () => {
      queue({ shots: [], lidar: lidarData() });
      render(<ProcessingResultsScreen />);
      expect(stageNames()).toEqual(STRINGS.processing.stagesLidar.map((n, k) => `${k + 1} ${n}`));
      expect(screen.queryByTestId('pipeline-track-SFM')).not.toBeInTheDocument();
    });

    it('fotos e LiDAR: as duas esteiras em sequência, cada uma com o seu título', () => {
      queue({ lidar: lidarData() });
      render(<ProcessingResultsScreen />);
      const names = stageNames();
      expect(names).toEqual([
        ...STRINGS.processing.stages.slice(0, 6).map((n, k) => `${k + 1} ${n}`),
        ...STRINGS.processing.stagesLidar.map((n, k) => `${k + 1} ${n}`),
      ]);
      const headers = screen
        .getAllByTestId(/^pipeline-track-/)
        .map((h) => h.getAttribute('data-testid'));
      expect(headers).toEqual(['pipeline-track-SFM', 'pipeline-track-LIDAR']);
    });

    it('missão só com fotos mantém a esteira SfM e nenhum título de trilha', () => {
      queue();
      render(<ProcessingResultsScreen />);
      expect(stageNames()).toHaveLength(6);
      expect(screen.queryByTestId('pipeline-track-LIDAR')).not.toBeInTheDocument();
      expect(screen.queryByTestId('pipeline-track-SFM')).not.toBeInTheDocument();
    });

    it('a esteira mista termina no relatório', async () => {
      fastHardware();
      queue({ lidar: lidarData() });
      render(<ProcessingResultsScreen />);
      await waitFor(() => expect(screen.getByTestId('report')).toBeInTheDocument(), {
        timeout: 10_000,
      });
    }, 20_000);
  });

  describe('aba Acurácia: comparativo e volumetria (T043)', () => {
    it('card MegaMap: ortofoto deformada, RMSE declarado e o selo; o deslocamento fica entre 2 e 6 m', async () => {
      fastHardware();
      queue();
      render(<ProcessingResultsScreen />);
      await waitFor(() => expect(screen.getByTestId('report')).toBeInTheDocument(), {
        timeout: 8000,
      });
      fireEvent.click(screen.getByRole('tab', { name: 'Acurácia' }));
      const card = screen.getByTestId('megamap-card');
      expect(within(card).getByText('Comparativo MegaMap')).toBeInTheDocument();
      expect(within(card).getByRole('img', { name: /MegaMap/ })).toBeInTheDocument();
      expect(screen.getByTestId('megamap-declared')).toHaveTextContent(
        'RMSE declarado: ± 1,5 m (sem pontos de controle)',
      );
      expect(screen.getByTestId('megamap-stamp')).toHaveTextContent('Reprovado PEC-PCD');
      const m = Number(
        /([\d,]+) m/
          .exec(screen.getByTestId('megamap-offset').textContent ?? '')?.[1]
          ?.replace(',', '.'),
      );
      expect(m).toBeGreaterThanOrEqual(2);
      expect(m).toBeLessThanOrEqual(6);
      expect(screen.getByTestId('megamap-yours')).toHaveTextContent(/Seu mapa: RMSE planimétrico/);
    }, 15000);

    it('volumetria só aparece quando o relatório a traz; lente e multiplicadores seguem visíveis', () => {
      const mission = queue();
      const base = evaluateForState(get(), mission, false);
      const { rerender } = render(<ReportAccuracy report={base} mission={mission} />);
      expect(screen.queryByText('Volumetria')).not.toBeInTheDocument();
      expect(screen.getByTestId('lens')).toBeInTheDocument();
      const withVolume: QualityReport = {
        ...base,
        volume: { referenceM3: 523_599, measuredM3: 520_000, errorPct: 0.7 },
      };
      rerender(<ReportAccuracy report={withVolume} mission={mission} />);
      expect(screen.getByText('Volumetria')).toBeInTheDocument();
      expect(screen.getByText(/523\.599/)).toBeInTheDocument();
      expect(screen.getByText(/0,7 %/)).toBeInTheDocument();
    });

    it('todos os rótulos de multiplicador estão em pt-BR (sem códigos soltos)', () => {
      const labels: string[] = [];
      const walk = (v: unknown) => {
        if (typeof v === 'string') labels.push(v);
        else if (v && typeof v === 'object') Object.values(v).forEach(walk);
      };
      walk(STRINGS.accuracy.multipliers);
      expect(labels.length).toBeGreaterThanOrEqual(15);
      for (const l of labels) {
        expect(l).toMatch(/^[A-ZÀ-Ú]/);
        expect(l).not.toMatch(/[_]|^[A-Z0-9_]+$/);
      }
    });
  });

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
