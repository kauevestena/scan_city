import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createDebugMission } from '@/app/debugFixtures';
import { resetDebugFlagsCache } from '@/app/debugFlags';
import { makeAlert, type FlightHudSnapshot } from '@/engines/flight/hudPublisher';
import { useGameStore } from '@/state/store';
import { resetGameStore } from '@/test/resetStore';
import { FlightHud } from './FlightHud';
import { PostFlightDialog } from './PostFlightDialog';
import { SurveyFlightScreen } from './SurveyFlightScreen';

const get = () => useGameStore.getState();

function snap(over: Partial<FlightHudSnapshot> = {}): FlightHudSnapshot {
  return {
    phase: 'RUN',
    aircraftName: 'Pombo Atlas',
    sensorName: 'Câmera de Peito do Avô',
    lineIndex: 3,
    nLines: 6,
    lineProgress: 0.62,
    crossTrackM: 2.1,
    outOfLane: false,
    altM: 65,
    aglM: 60,
    speedMs: 10.4,
    windCrossMs: 1.2,
    crabDeg: 0,
    timeScale: 1,
    energy: 0.74,
    energyUnit: 'CORN',
    timeLeftS: 1112,
    rthAlert: false,
    hull: 2,
    hullMax: 3,
    rtk: 'NONE',
    activeSensor: 'RGB',
    gsdCm: 2.52,
    gsdOk: true,
    pRealPct: 58,
    qEstPct: 60,
    photos: 43,
    photosPlanned: 96,
    blurPx: 0.2,
    alerts: [makeAlert('OVERLAP', 58), makeAlert('OUT_OF_LANE')],
    minimap: {
      lines: [
        [
          { u: 0, v: 0 },
          { u: 240, v: 0 },
        ],
      ],
      shots: [{ u: 10, v: 0 }],
      pos: { u: 20, v: 0 },
      heading: 0,
    },
    ...over,
  };
}

beforeEach(() => {
  resetGameStore();
  window.history.replaceState(null, '', '/');
  resetDebugFlagsCache();
});

describe('FlightHud', () => {
  it('mostra linha, energia, casco, leituras, alertas por prioridade e o minimapa', () => {
    render(<FlightHud snap={snap()} />);
    expect(screen.getByTestId('hud-line')).toHaveTextContent('LINHA 3/6');
    expect(screen.getByTestId('hud-energy')).toHaveTextContent('🌽 74 % 18:32');
    expect(screen.getByLabelText('Casco 2 de 3')).toBeInTheDocument();
    expect(screen.getByTestId('hud-photos')).toHaveTextContent('FOTOS43 / 96');
    const alerts = within(screen.getByTestId('hud-alerts'));
    expect(alerts.getByText('OVERLAP INSUFICIENTE 58 %')).toHaveAttribute('data-alert', 'OVERLAP');
    expect(alerts.getByText('FORA DA FAIXA')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Minimapa do voo' })).toBeInTheDocument();
    expect(screen.queryByTestId('hud-phase')).not.toBeInTheDocument();
  });

  it('bateria e fase fora do RUN', () => {
    render(
      <FlightHud
        snap={snap({ energyUnit: 'BATTERY', phase: 'TURN', alerts: [], pRealPct: null })}
      />,
    );
    expect(screen.getByTestId('hud-energy')).toHaveTextContent(/^74 % 18:32$/);
    expect(screen.getByTestId('hud-phase')).toHaveTextContent('CURVA');
  });
});

describe('PostFlightDialog', () => {
  function withMission(withData: boolean) {
    const m = { ...createDebugMission('C00', withData), status: 'IN_FLIGHT' as const };
    act(() => {
      get().goTo('WORLD_MAP');
      get().beginMission(m);
      get().goTo('FIELD_SETUP', { contractId: 'C00', rivalAdjustment: 1 });
    });
    useGameStore.setState((s) => ({
      contracts: { ...s.contracts, C00: { status: 'AVAILABLE', completions: 0, bestScore: 0 } },
      session: { ...s.session, screen: 'SURVEY_FLIGHT', payload: { missionId: m.id } },
    }));
    return m;
  }
  const result = {
    outcome: 'COMPLETED' as const,
    durationS: 216,
    completedLines: [0, 1, 2, 3, 4, 5],
    photos: 96,
    collisions: 0,
    atlas: false,
  };

  it('com dados: "Levar dados" põe a missão na fila e volta ao mapa (T10, QUEUED)', () => {
    const m = withMission(true);
    render(<PostFlightDialog result={result} totalLines={6} energyLeft={0.6} />);
    const dialog = screen.getByRole('dialog', { name: 'Voo concluído' });
    expect(within(dialog).getByTestId('post-photos')).toHaveTextContent('96');
    expect(
      within(dialog).queryByRole('button', { name: /Processar agora/ }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole('button', { name: /Tentar de novo/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: /Levar dados/ }));
    expect(get().session.screen).toBe('WORLD_MAP');
    expect(get().session.payload).toEqual({ outcome: 'QUEUED' });
    expect(get().mission.pending.map((p) => p.id)).toEqual([m.id]);
  });

  it('com a Van: "Processar agora" vai ao processamento em campo (T9)', () => {
    withMission(true);
    useGameStore.setState((s) => ({
      inventory: { ...s.inventory, vehicles: [...s.inventory.vehicles, 'LAB_VAN'] },
    }));
    render(<PostFlightDialog result={result} totalLines={6} energyLeft={0.6} />);
    fireEvent.click(screen.getByRole('button', { name: /Processar agora/ }));
    expect(get().session.screen).toBe('PROCESSING_RESULTS');
    expect(get().session.payload).toMatchObject({ inField: true });
  });

  it('sem dados: só "Abandonar" e "Tentar de novo" (T16 volta ao planejamento)', () => {
    withMission(false);
    render(
      <PostFlightDialog
        result={{ ...result, outcome: 'ENERGY_DEPLETED', completedLines: [] }}
        totalLines={6}
        energyLeft={0}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Energia esgotada' });
    expect(within(dialog).getByText('Os dados desta surtida foram perdidos.')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /Levar dados/ })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: /Tentar de novo/ }));
    expect(get().session.screen).toBe('FIELD_SETUP');
    expect(get().mission.active?.status).toBe('PLANNING');
  });

  it('"Abandonar missão" pede confirmação e descarta tudo', () => {
    withMission(true);
    render(<PostFlightDialog result={result} totalLines={6} energyLeft={0.6} />);
    fireEvent.click(screen.getByRole('button', { name: /Abandonar missão/ }));
    const confirm = screen.getByRole('dialog', { name: 'Abandonar a missão?' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Voltar' }));
    expect(get().session.screen).toBe('SURVEY_FLIGHT');
    fireEvent.click(screen.getByRole('button', { name: /Abandonar missão/ }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Abandonar a missão?' })).getByRole('button', {
        name: 'Abandonar missão',
      }),
    );
    expect(get().session.screen).toBe('WORLD_MAP');
    expect(get().session.payload).toEqual({ outcome: 'ABORTED' });
    expect(get().mission.active).toBeNull();
  });
});

describe('SurveyFlightScreen', () => {
  it('sem missão em voo, oferece voltar ao mapa', () => {
    act(() => get().goTo('WORLD_MAP'));
    useGameStore.setState((s) => ({ session: { ...s.session, screen: 'SURVEY_FLIGHT' } }));
    render(<SurveyFlightScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao mapa' }));
    expect(get().session.screen).toBe('WORLD_MAP');
  });

  it('com a missão em voo: contexto FLIGHT, HUD publicado e disparo manual pelo Espaço', async () => {
    act(() => {
      get().goTo('WORLD_MAP');
      get().startMission('C00', 1);
      get().launchMission();
    });
    useGameStore.setState((s) => ({
      session: { ...s.session, screen: 'SURVEY_FLIGHT' },
      // Qualidade baixa: o canvas simulado do jsdom registra cada chamada.
      settings: { ...s.settings, quality: 'LOW' },
    }));
    render(<SurveyFlightScreen />);
    expect(screen.getByTestId('survey-flight-screen')).toBeInTheDocument();
    // Deixa o rAF do jsdom rodar a decolagem (2,5 s): o rótulo da fase some no RUN.
    await waitFor(() => expect(screen.getByTestId('flight-hud')).toBeInTheDocument(), {
      timeout: 3000,
    });
    await waitFor(() => expect(screen.queryByTestId('hud-phase')).not.toBeInTheDocument(), {
      timeout: 12000,
    });
    const count = () =>
      Number(/FOTOS(\d+)/.exec(screen.getByTestId('hud-photos').textContent ?? '')?.[1]);
    const before = count();
    fireEvent.keyDown(window, { code: 'Space', key: ' ' });
    fireEvent.keyUp(window, { code: 'Space', key: ' ' });
    await act(() => new Promise<void>((r) => setTimeout(r, 200)));
    expect(count()).toBeGreaterThan(before);
  }, 20000);
});
