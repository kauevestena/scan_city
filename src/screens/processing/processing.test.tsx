import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { C00 } from '@/data/contracts';
import { PAD } from '@/input/gamepad';
import { InputManager } from '@/input/InputManager';
import { createPad, installGamepads, setButton, XBOX_ID } from '@/test/fakeGamepad';
import { createCoverageGrid } from '@/domain/coverage';
import { syntheticMission } from '@/test/fixtures/syntheticMission';
import { resetGameStore } from '@/test/resetStore';
import { useGameStore } from '@/state/store';
import type { GroundPoint, MissionData } from '@/types';
import { createTerrain } from '@/world/terrain/createTerrain';
import { evaluateForState } from './evaluate';
import { ProcessingResultsScreen } from './ProcessingResultsScreen';
import { MegaMapCard } from './MegaMapCard';
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

  it('o relatório se navega só com o teclado e com o controle: Q/E e LB/RB trocam de aba, as setas andam pelos controles (REQ-INP-006)', async () => {
    fastHardware();
    queue();
    render(<ProcessingResultsScreen />);
    await waitFor(() => expect(screen.getByTestId('report')).toBeInTheDocument(), {
      timeout: 8000,
    });
    const selected = () =>
      screen.getAllByRole('tab').find((t) => t.getAttribute('aria-selected') === 'true')
        ?.textContent;
    expect(selected()).toBe('Resumo');
    fireEvent.keyDown(window, { code: 'KeyE', key: 'e' });
    expect(selected()).toBe('Acurácia');
    fireEvent.keyDown(window, { code: 'KeyE', key: 'e' });
    expect(selected()).toBe('Cobertura');
    fireEvent.keyDown(window, { code: 'KeyQ', key: 'q' });
    expect(selected()).toBe('Acurácia');
    // O controle: RB avança, LB volta.
    const pad = createPad(XBOX_ID);
    const uninstall = installGamepads([pad]);
    try {
      setButton(pad, PAD.RB, true);
      act(() => InputManager.get().poll(1));
      expect(selected()).toBe('Cobertura');
      setButton(pad, PAD.RB, false);
      act(() => InputManager.get().poll(2));
      setButton(pad, PAD.LB, true);
      act(() => InputManager.get().poll(3));
      expect(selected()).toBe('Acurácia');
      setButton(pad, PAD.LB, false);
      act(() => InputManager.get().poll(4));
      // Sem foco, o D-pad (UI_DOWN) foca o primeiro controle do relatório.
      setButton(pad, PAD.DPAD_DOWN, true);
      act(() => InputManager.get().poll(5));
      expect(screen.getByTestId('report')).toContainElement(document.activeElement as HTMLElement);
    } finally {
      uninstall();
    }
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

    it('missão sem pontos de apoio (R06): a aba não mostra tabelas zeradas e o MegaMap não inventa RMSE', () => {
      const bare = queue({ groundPoints: [] });
      const empty = evaluateForState(get(), bare, false);
      expect(empty.residuals).toHaveLength(0);
      const { unmount } = render(<ReportAccuracy report={empty} mission={bare} />);
      expect(screen.getByTestId('no-points')).toHaveTextContent(STRINGS.processing.noPoints);
      expect(screen.queryByTestId('residuals')).not.toBeInTheDocument();
      expect(screen.queryByTestId('rmse')).not.toBeInTheDocument();
      // O que não depende dos pontos continua à mostra.
      expect(screen.getByTestId('multipliers')).toBeInTheDocument();
      unmount();
      // O comparativo da MegaMap também não mostra "RMSE 0,0 cm" sem pontos.
      const card = render(<MegaMapCard report={empty} mission={bare} />);
      expect(screen.getByTestId('megamap-yours')).toHaveTextContent(
        STRINGS.processing.megamap.yoursNoPoints,
      );
      card.unmount();
      // Com pontos, as tabelas voltam e a nota some.
      const mission = queue();
      const full = evaluateForState(get(), mission, false);
      expect(full.residuals.length).toBeGreaterThan(0);
      render(<ReportAccuracy report={full} mission={mission} />);
      expect(screen.queryByTestId('no-points')).not.toBeInTheDocument();
      expect(screen.getByTestId('residuals')).toBeInTheDocument();
    });

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

  describe('Van Lab e equipe (T044)', () => {
    /** Missão em campo: ainda a ativa, com o payload `inField` da Van. */
    function inField(): MissionData {
      const mission = {
        ...syntheticMission(C00, createTerrain(C00)),
        status: 'IN_FLIGHT' as const,
      } as MissionData;
      useGameStore.setState((s) => ({
        mission: { active: mission, pending: [] },
        session: {
          ...s.session,
          screen: 'PROCESSING_RESULTS',
          payload: { missionId: mission.id, inField: true },
        },
      }));
      return mission;
    }
    const withVan = () =>
      useGameStore.setState((s) => ({
        inventory: { ...s.inventory, vehicles: [...s.inventory.vehicles, 'LAB_VAN'] },
      }));
    const header = () => screen.getByTestId('processing-header').textContent;

    it('fator 2,5: em campo com a Van, o notebook (×1,0) processa a ×2,5; fora de campo, não', () => {
      withVan();
      inField();
      const { unmount } = render(<ProcessingResultsScreen />);
      expect(header()).toContain('×2,5');
      unmount();
      // Mesma Van, mas processando no escritório: vale só o hardware.
      resetGameStore();
      withVan();
      queue();
      render(<ProcessingResultsScreen />);
      expect(header()).toContain('×1,0');
    });

    it('sem a Van, em campo, o fator é o do hardware', () => {
      inField();
      render(<ProcessingResultsScreen />);
      expect(header()).toContain('×1,0');
    });

    it('a esteira em campo leva 1/2,5 do tempo e termina no mapa (T13), aplicando o resultado', async () => {
      withVan();
      const mission = inField();
      const money = get().player.money;
      const report = evaluateForState(get(), mission, true);
      // 6 + 0,08 · 96 = 13,68 s no notebook; ÷ 2,5.
      expect(report.processingTimeS).toBeCloseTo(13.68 / 2.5, 9);
      render(<ProcessingResultsScreen />);
      await waitFor(() => expect(screen.getByTestId('report')).toBeInTheDocument(), {
        timeout: 12_000,
      });
      expect(get().player.money).toBe(money + report.payment.totalBRL);
      // A missão em campo sai da missão ativa quando o resultado é aplicado.
      expect(get().mission.active).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Voltar ao mapa' }));
      expect(get().session.screen).toBe('WORLD_MAP');
    }, 20_000);

    it('com equipe: aparece a etapa 7 "Vetorização automática (equipe)" e o cabeçalho avisa', () => {
      useGameStore.setState((s) => ({ staff: { ...s.staff, INTERN: 1 } }));
      queue();
      render(<ProcessingResultsScreen />);
      expect(header()).toContain('+ equipe');
      const stages = within(screen.getByTestId('pipeline'))
        .getAllByRole('listitem')
        .filter((li) => li.hasAttribute('data-stage'));
      expect(stages).toHaveLength(7);
      expect(stages[6]).toHaveTextContent('7 Vetorização automática (equipe)');
    });

    it('sem equipe, a esteira tem 6 etapas e o cabeçalho não menciona a equipe', () => {
      queue();
      render(<ProcessingResultsScreen />);
      expect(header()).not.toContain('equipe');
      const stages = within(screen.getByTestId('pipeline'))
        .getAllByRole('listitem')
        .filter((li) => li.hasAttribute('data-stage'));
      expect(stages).toHaveLength(6);
    });

    it('com equipe, os bônus entram no pagamento: fator na linha e custo descontado', async () => {
      fastHardware();
      useGameStore.setState((s) => ({ staff: { ...s.staff, INTERN: 1 } }));
      const mission = queue();
      const report = evaluateForState(get(), mission, false);
      expect(report.payment.staffBonus).toBeGreaterThan(1);
      expect(report.payment.staffCostBRL).toBeGreaterThan(0);
      render(<ProcessingResultsScreen />);
      await waitFor(() => expect(screen.getByTestId('report')).toBeInTheDocument(), {
        timeout: 10_000,
      });
      fireEvent.click(screen.getByRole('tab', { name: 'Pagamento' }));
      // As linhas entram em sequência; o total fecha a tabela.
      await screen.findByTestId('payment-total', undefined, { timeout: 8000 });
      const rows = within(screen.getByTestId('report-payment')).getAllByRole('row');
      const text = rows.map((r) => r.textContent ?? '');
      expect(text.some((t) => t.includes('× equipe'))).toBe(true);
      expect(text.some((t) => t.includes('− custo da equipe'))).toBe(true);
    }, 20_000);
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
