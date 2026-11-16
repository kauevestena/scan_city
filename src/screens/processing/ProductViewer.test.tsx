import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { C00 } from '@/data/contracts';
import { createCoverageGrid } from '@/domain/coverage';
import { syntheticMission } from '@/test/fixtures/syntheticMission';
import { resetGameStore } from '@/test/resetStore';
import { useGameStore } from '@/state/store';
import { PAD } from '@/input/gamepad';
import { InputManager } from '@/input/InputManager';
import { createPad, installGamepads, setButton } from '@/test/fakeGamepad';
import { useInputContext } from '@/input/useInputContext';
import type { OrbitCamera } from '@/engines/soft3d/OrbitCamera';
import type { LidarSample, MissionData, QualityReport } from '@/types';
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

function lidarOf(mission: MissionData, n: number): MissionData {
  const pulses = grid.counts.map(() => 100);
  const rets = ['FIRST', 'INTERMEDIATE', 'GROUND'] as const;
  const samples: LidarSample[] = Array.from({ length: n }, (_, k) => ({
    u: (k * 7.3) % C00.aoi.lengthM,
    v: (k * 3.1) % C00.aoi.widthM,
    z: (k % 40) / 10,
    ret: rets[k % 3] as LidarSample['ret'],
  }));
  return {
    ...mission,
    lidar: {
      grid: {
        cols: grid.cols,
        rows: grid.rows,
        pulses,
        firstAbove: pulses,
        ground: pulses,
        cellAreaM2: 10,
      },
      samples,
    },
  } as MissionData;
}

const cloudReady = () =>
  waitFor(() => expect(screen.getByTestId('cloud-view')).toHaveAttribute('data-ready', 'true'), {
    timeout: 10_000,
  });

/** O relatório roda no contexto UI; o viewer lê o analógico direito por ele. */
function UiContext({ children }: { children: React.ReactNode }) {
  useInputContext('UI');
  return <>{children}</>;
}

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

describe('Nuvem / TIN (T042)', () => {
  it('a aba existe entre o MDT e o NDVI; sem dados fica desabilitada com o motivo', () => {
    const { mission, report } = fixture();
    const { unmount } = render(
      <ProductViewer report={report} mission={mission} sliceBudgetMs={50} />,
    );
    const names = screen.getAllByRole('tab').map((t) => t.textContent);
    expect(names).toEqual(['Ortofoto', 'MDS', 'MDT', 'Nuvem / TIN', 'NDVI']);
    expect(screen.getByRole('tab', { name: 'Nuvem / TIN' })).not.toHaveAttribute('aria-disabled');
    unmount();
    render(
      <ProductViewer
        report={report}
        mission={{ ...mission, shots: [] } as MissionData}
        sliceBudgetMs={50}
      />,
    );
    expect(screen.getByRole('tab', { name: 'Nuvem / TIN' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('nuvem fotogramétrica: ~30.000 pontos com as cores da orto e o toggle TIN', async () => {
    const { mission, report } = fixture();
    render(<ProductViewer report={report} mission={mission} sliceBudgetMs={50} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Nuvem / TIN' }));
    await cloudReady();
    expect(screen.getByTestId('cloud-canvas')).toBeInTheDocument();
    expect(screen.getByTestId('cloud-legend')).toHaveTextContent(/\d+\.\d{3} pontos/);
    expect(screen.getByTestId('cloud-legend')).toHaveTextContent('Cores da ortofoto');
    // Sem LiDAR, não há escolha de origem.
    expect(screen.queryByRole('tab', { name: 'LiDAR' })).not.toBeInTheDocument();
    const toggle = screen.getByRole('checkbox', { name: 'Mostrar malha TIN' });
    expect(toggle).not.toBeChecked();
    fireEvent.click(toggle);
    expect(toggle).toBeChecked();
  }, 30_000);

  it('nuvem LiDAR: cores por retorno e escolha entre as duas origens quando há fotos também', async () => {
    const { mission, report } = fixture();
    render(<ProductViewer report={report} mission={lidarOf(mission, 600)} sliceBudgetMs={50} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Nuvem / TIN' }));
    await cloudReady();
    expect(screen.getByTestId('return-FIRST')).toHaveTextContent('1º retorno');
    expect(screen.getByTestId('return-INTERMEDIATE')).toHaveTextContent('Intermediário');
    expect(screen.getByTestId('return-GROUND')).toHaveTextContent('Solo');
    expect(screen.getByTestId('cloud-count')).toHaveTextContent('600 pontos');
    fireEvent.click(screen.getByRole('tab', { name: 'Fotogrametria' }));
    await waitFor(
      () => expect(screen.getByTestId('cloud-legend')).toHaveTextContent('Cores da ortofoto'),
      {
        timeout: 10_000,
      },
    );
  }, 30_000);

  it('órbita por mouse: arrastar gira, a roda dá zoom (dentro dos limites)', async () => {
    const { mission, report } = fixture();
    const cameraRef: { current: OrbitCamera | null } = { current: null };
    render(
      <ProductViewer
        report={report}
        mission={lidarOf(mission, 90)}
        sliceBudgetMs={50}
        cloudCameraRef={cameraRef}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Nuvem / TIN' }));
    await cloudReady();
    // A nuvem sai de um rAF fora do act: fecha um act para os efeitos (a câmera) entrarem.
    await act(async () => undefined);
    const canvas = screen.getByTestId('cloud-canvas');
    const camera = cameraRef.current as OrbitCamera;
    const yaw = camera.yaw;
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 160, clientY: 100 });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 160, clientY: 100 });
    expect(camera.yaw).toBeLessThan(yaw);
    const d = camera.distance;
    fireEvent.wheel(canvas, { deltaY: 100 });
    expect(camera.distance).toBeGreaterThan(d);
    for (let i = 0; i < 80; i++) fireEvent.wheel(canvas, { deltaY: 100 });
    expect(camera.distance).toBeCloseTo(camera.maxDistance, 6);
  }, 30_000);

  it('teclado: o quadro da nuvem recebe o foco e as setas orbitam, sem mover o foco (REQ-NFR-007)', async () => {
    const { mission, report } = fixture();
    const cameraRef: { current: OrbitCamera | null } = { current: null };
    render(
      <ProductViewer
        report={report}
        mission={lidarOf(mission, 90)}
        sliceBudgetMs={50}
        cloudCameraRef={cameraRef}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Nuvem / TIN' }));
    await cloudReady();
    await act(async () => undefined);
    const canvas = screen.getByTestId('cloud-canvas');
    const camera = cameraRef.current as OrbitCamera;
    expect(canvas).toHaveAttribute('tabindex', '0');
    canvas.focus();
    expect(canvas).toHaveFocus();
    const { yaw, pitch } = camera;
    const left = new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      canvas.dispatchEvent(left);
    });
    expect(left.defaultPrevented).toBe(true);
    expect(camera.yaw).toBeGreaterThan(yaw);
    fireEvent.keyDown(canvas, { key: 'ArrowRight' });
    fireEvent.keyDown(canvas, { key: 'ArrowRight' });
    expect(camera.yaw).toBeLessThan(yaw);
    fireEvent.keyDown(canvas, { key: 'ArrowUp' });
    expect(camera.pitch).not.toBe(pitch);
    // O foco continua no quadro: a seta não foi para a navegação de foco da tela.
    expect(canvas).toHaveFocus();
    // Outras teclas passam sem ser consumidas.
    const other = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
    act(() => {
      canvas.dispatchEvent(other);
    });
    expect(other.defaultPrevented).toBe(false);
  }, 30_000);

  it('gamepad: o analógico direito orbita e os gatilhos dão zoom', async () => {
    const { mission, report } = fixture();
    const cameraRef: { current: OrbitCamera | null } = { current: null };
    render(
      <UiContext>
        <ProductViewer
          report={report}
          mission={lidarOf(mission, 90)}
          sliceBudgetMs={50}
          cloudCameraRef={cameraRef}
        />
      </UiContext>,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Nuvem / TIN' }));
    await cloudReady();
    // A nuvem pronta sai de um rAF, fora do act: os efeitos (o loop) só rodam ao fechar um act.
    await act(async () => undefined);
    expect(InputManager.get().screenContext).toBe('UI');
    const camera = cameraRef.current as OrbitCamera;
    const { yaw, distance } = camera;
    const pad = createPad('Xbox Wireless Controller');
    pad.axes = [0, 0, 1, 0];
    setButton(pad, PAD.RT, 1);
    const uninstall = installGamepads([pad]);
    try {
      await act(() => new Promise<void>((r) => setTimeout(r, 300)));
    } finally {
      uninstall();
    }
    // Stick à direita: LOOK_X > 0 gira o yaw para baixo; o gatilho direito aproxima a câmera.
    expect(camera.yaw).toBeLessThan(yaw);
    expect(camera.distance).toBeLessThan(distance);
  }, 30_000);
});
