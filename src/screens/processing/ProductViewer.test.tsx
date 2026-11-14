import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { C00 } from '@/data/contracts';
import { createCoverageGrid } from '@/domain/coverage';
import { syntheticMission } from '@/test/fixtures/syntheticMission';
import { resetGameStore } from '@/test/resetStore';
import { useGameStore } from '@/state/store';
import type { MissionData, QualityReport } from '@/types';
import { buildTestArena } from '@/world/terrain/biomes/testArena';
import { createTerrain } from '@/world/terrain/createTerrain';
import { evaluateForState } from './evaluate';
import { ProductViewer } from './ProductViewer';
import { productAvailability } from './productModel';

const terrain = createTerrain(C00);
const grid = createCoverageGrid(C00.aoi);

function fixture(): { mission: MissionData; report: QualityReport } {
  resetGameStore();
  const mission = { ...syntheticMission(C00, terrain), status: 'PENDING_PROCESSING' as const };
  return { mission, report: evaluateForState(useGameStore.getState(), mission, false) };
}

/** Troca a câmera do plano (o viewer só lê o tipo do sensor e a iluminação). */
function withSensor(mission: MissionData, aircraftId: string, sensorId: string): MissionData {
  return {
    ...mission,
    plan: { ...mission.plan, params: { ...mission.plan.params, aircraftId, sensorId } },
  } as MissionData;
}

const ready = (kind: string) =>
  waitFor(
    () => {
      const canvas = screen.getByTestId('product-canvas');
      expect(canvas).toHaveAttribute('data-kind', kind);
      expect(canvas).toHaveAttribute('data-ready', 'true');
    },
    { timeout: 10_000 },
  );

describe('disponibilidade dos produtos (§5.7)', () => {
  it('missão RGB do C00: Orto, MDS e MDT liberados; NDVI não, com o motivo', () => {
    const { mission, report } = fixture();
    const a = productAvailability(mission, report, C00, terrain);
    expect(a.ORTHO.available).toBe(true);
    expect(a.DSM.available).toBe(true);
    expect(a.DTM.available).toBe(true);
    expect(a.NDVI).toEqual({ available: false, reason: 'NDVI requer câmera multiespectral' });
  });

  it('sem fotos válidas e sem LiDAR, tudo indisponível; o MDS e o MDT aceitam só LiDAR', () => {
    const { mission, report } = fixture();
    const none = { ...mission, shots: [] } as MissionData;
    const a = productAvailability(none, report, C00, terrain);
    expect([a.ORTHO, a.DSM, a.DTM, a.NDVI].every((p) => !p.available)).toBe(true);
    const pulses = grid.counts.map(() => 100);
    const lidar = {
      ...none,
      lidar: {
        grid: {
          cols: grid.cols,
          rows: grid.rows,
          pulses,
          firstAbove: pulses,
          ground: pulses,
          cellAreaM2: 10,
        },
        samples: [],
      },
    } as MissionData;
    const b = productAvailability(lidar, report, C00, terrain);
    expect(b.DSM.available).toBe(true);
    expect(b.DTM.available).toBe(true);
    expect(b.ORTHO.available).toBe(false);
  });

  it('só borradas/inválidas não contam: foto borrada não libera a orto', () => {
    const { mission, report } = fixture();
    const blurred = { ...mission, shots: mission.shots.map((s) => ({ ...s, blurred: true })) };
    expect(productAvailability(blurred as MissionData, report, C00, terrain).ORTHO.available).toBe(
      false,
    );
  });

  it('mata fechada sem LiDAR: o MDT fica indisponível', () => {
    const { mission, report } = fixture();
    const forest = buildTestArena({ canopy: 0.9 });
    const a = productAvailability(mission, report, C00, forest);
    expect(a.DTM).toEqual({ available: false, reason: 'MDT requer LiDAR ou áreas abertas' });
  });
});

describe('ProductViewer', () => {
  it('critério 5: com CAM_20MP_RS, o NDVI fica desabilitado e o tooltip dá o motivo', () => {
    const { mission, report } = fixture();
    render(
      <ProductViewer
        report={report}
        mission={withSensor(mission, 'DRONE_T1', 'CAM_20MP_RS')}
        sliceBudgetMs={50}
      />,
    );
    const tab = screen.getByRole('tab', { name: 'NDVI' });
    expect(tab).toHaveAttribute('aria-disabled', 'true');
    fireEvent.mouseEnter(tab.parentElement as HTMLElement);
    expect(screen.getByRole('tooltip')).toHaveTextContent('NDVI requer câmera multiespectral');
    fireEvent.click(tab);
    expect(screen.getByTestId('product-canvas')).not.toHaveAttribute('data-kind', 'NDVI');
  });

  it('gera a ortofoto em fatias, com a barra de progresso e a legenda de sem-dados', async () => {
    const { mission, report } = fixture();
    // Uma célula sem foto: o xadrez aparece e a legenda o explica.
    const counts = report.coverage.counts.map((c, k) => (k === 0 ? 0 : c));
    render(
      <ProductViewer
        report={{ ...report, coverage: { ...report.coverage, counts } }}
        mission={mission}
        sliceBudgetMs={50}
      />,
    );
    expect(screen.getByTestId('product-progress')).toHaveTextContent('Gerando o produto…');
    await ready('ORTHO');
    expect(screen.queryByTestId('product-progress')).not.toBeInTheDocument();
    expect(screen.getByTestId('legend-nodata')).toHaveTextContent('Sem dados');
    expect(screen.getByRole('img', { name: 'Raster de Ortofoto' })).toBeInTheDocument();
  }, 20_000);

  it('MDS e MDT: legenda de elevação; o MDT sob dossel mostra a hachura', async () => {
    const { mission, report } = fixture();
    render(<ProductViewer report={report} mission={mission} sliceBudgetMs={50} />);
    await ready('ORTHO');
    fireEvent.click(screen.getByRole('tab', { name: 'MDS' }));
    await ready('DSM');
    expect(screen.getByTestId('product-legend')).toHaveTextContent(/Elevação: .* m/);
    fireEvent.click(screen.getByRole('tab', { name: 'MDT' }));
    await ready('DTM');
    expect(screen.getByTestId('legend-hatched')).toHaveTextContent(
      'Interpolado / sem dados de solo',
    );
    // Voltar a um produto gerado usa o cache: aparece pronto de imediato.
    fireEvent.click(screen.getByRole('tab', { name: 'Ortofoto' }));
    await ready('ORTHO');
  }, 30_000);

  it('NDVI com câmera multiespectral: histograma e faixa do índice', async () => {
    const { mission, report } = fixture();
    render(
      <ProductViewer
        report={report}
        mission={withSensor(mission, 'DRONE_T1', 'CAM_MS5')}
        sliceBudgetMs={50}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'NDVI' }));
    await ready('NDVI');
    expect(screen.getByTestId('ndvi-histogram')).toBeInTheDocument();
    expect(screen.getByTestId('product-legend')).toHaveTextContent(/NDVI: .* a /);
  }, 20_000);

  it('features capturadas são marcadas com rótulo; as não capturadas, não', () => {
    const { mission, report } = fixture();
    const arena = buildTestArena({
      features: [
        { id: 'TEMPLO', name: 'Templo revelado', u: 60, v: 40, radiusM: 10, needs: 'PHOTO' },
        { id: 'TOCA', name: 'Toca oculta', u: 180, v: 120, radiusM: 5, needs: 'PHOTO' },
      ],
    });
    const captured = {
      ...mission,
      events: { ...mission.events, featuresCaptured: ['TEMPLO'] },
    } as MissionData;
    render(<ProductViewer report={report} mission={captured} terrain={arena} sliceBudgetMs={50} />);
    const marks = screen.getAllByTestId('product-feature');
    expect(marks).toHaveLength(1);
    expect(marks[0]).toHaveTextContent('Templo revelado');
    expect(marks[0]).toHaveStyle({ left: '25%', top: '25%' });
    expect(within(screen.getByTestId('product-features')).getAllByRole('listitem')).toHaveLength(1);
    expect(screen.queryByText('Toca oculta')).not.toBeInTheDocument();
  });

  afterEach(() => act(() => undefined));
});
