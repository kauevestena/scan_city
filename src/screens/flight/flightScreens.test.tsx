import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createDebugMission } from '@/app/debugFixtures';
import { AudioEngine } from '@/audio/AudioEngine';
import type { LoopHandle, LoopId, MotorVariant } from '@/audio/sfx';
import { resetDebugFlagsCache } from '@/app/debugFlags';
import { makeAlert } from '@/engines/flight/hudPublisher';
import { snap } from '@/test/hudSnap';
import { useGameStore } from '@/state/store';
import { resetGameStore } from '@/test/resetStore';
import { FlightHud } from './FlightHud';
import { PostFlightDialog } from './PostFlightDialog';
import { SurveyFlightScreen } from './SurveyFlightScreen';

const get = () => useGameStore.getState();

beforeEach(() => {
  resetGameStore();
  window.history.replaceState(null, '', '/');
  resetDebugFlagsCache();
});

describe('FlightHud', () => {
  it('mostra linha, energia, casco, leituras, alertas por prioridade e o minimapa', () => {
    render(<FlightHud snap={snap()} />);
    expect(screen.getByTestId('hud-line')).toHaveTextContent('LINHA 3/6');
    expect(screen.getByTestId('hud-energy')).toHaveTextContent('🌽 × 8 · 74 % 18:32');
    expect(screen.getByLabelText('Casco 2 de 3')).toBeInTheDocument();
    expect(screen.getByTestId('hud-photos')).toHaveTextContent('FOTOS43 / 96');
    const alerts = within(screen.getByTestId('hud-alerts'));
    expect(alerts.getByText('OVERLAP INSUFICIENTE 58 %')).toHaveAttribute('data-alert', 'OVERLAP');
    expect(alerts.getByText('FORA DA FAIXA')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Minimapa do voo' })).toBeInTheDocument();
    expect(screen.queryByTestId('hud-phase')).not.toBeInTheDocument();
  });

  it('interferência EM: glitch de scanlines, desligado com reduceFlashes', () => {
    const { rerender } = render(<FlightHud snap={snap({ emGlitch: true })} />);
    expect(screen.getByTestId('hud-glitch')).toBeInTheDocument();
    useGameStore.setState((s) => ({ settings: { ...s.settings, reduceFlashes: true } }));
    rerender(<FlightHud snap={snap({ emGlitch: true })} />);
    expect(screen.queryByTestId('hud-glitch')).not.toBeInTheDocument();
  });

  it('mostra todas as leituras do snapshot e pulsa o contador de fotos (não com reduceFlashes)', () => {
    const { rerender } = render(<FlightHud snap={snap({ rtk: 'FLOAT' })} />);
    const hud = screen.getByTestId('flight-hud');
    expect(hud).toHaveTextContent('RTK: FLOAT');
    expect(hud).toHaveTextContent('ALT65 m');
    expect(hud).toHaveTextContent('SOLO10,4 m/salvo 10');
    expect(hud).toHaveTextContent('VENTO1,2 m/s');
    expect(hud).toHaveTextContent('GSD2,52 cm/px');
    expect(hud).toHaveTextContent('p58 %');
    expect(hud).toHaveTextContent('q60 %');
    expect(hud).toHaveTextContent('BLUR0,2 px');
    expect(screen.getByTestId('hud-photos')).toHaveClass('photo-pulse');
    useGameStore.setState((s) => ({ settings: { ...s.settings, reduceFlashes: true } }));
    rerender(<FlightHud snap={snap({ photos: 44 })} />);
    expect(screen.getByTestId('hud-photos')).not.toHaveClass('photo-pulse');
  });

  it('a velocidade mínima da asa fixa aparece como alerta', () => {
    render(<FlightHud snap={snap({ alerts: [makeAlert('MIN_SPEED')] })} />);
    expect(screen.getByText('VELOCIDADE MÍNIMA')).toBeInTheDocument();
  });

  it('cruzeiro em âmbar (ou desligado), anéis e a barra de detecção do holofote', () => {
    const { rerender } = render(<FlightHud snap={snap({ cruise: { on: true, factor: 1 } })} />);
    expect(screen.queryByTestId('hud-warp')).not.toBeInTheDocument();
    expect(screen.queryByTestId('hud-rings')).not.toBeInTheDocument();
    expect(screen.queryByTestId('hud-detection')).not.toBeInTheDocument();
    rerender(
      <FlightHud
        snap={snap({
          timeScale: 3.4,
          cruise: { on: true, factor: 3.4 },
          rings: 3,
          detectedProgress: 0.5,
        })}
      />,
    );
    expect(screen.getByTestId('hud-warp')).toHaveTextContent('CRUZEIRO ×3,4');
    expect(screen.getByTestId('hud-warp')).toHaveClass('text-amber-400');
    rerender(<FlightHud snap={snap({ cruise: { on: false, factor: 1 } })} />);
    expect(screen.getByTestId('hud-warp')).toHaveTextContent('CRUZEIRO DESLIGADO');
    rerender(<FlightHud snap={snap({ rings: 3, detectedProgress: 0.5 })} />);
    expect(screen.getByTestId('hud-rings')).toHaveTextContent('Anéis: 3');
    expect(screen.getByTestId('hud-detection')).toBeInTheDocument();
  });

  it('LiDAR ativo: mostra a densidade total e a de solo', () => {
    render(
      <FlightHud snap={snap({ activeSensor: 'LIDAR', lidarDensity: 158, groundDensity: 17 })} />,
    );
    expect(screen.getByTestId('flight-hud')).toHaveTextContent('158 pts/m² · solo 17');
  });

  it('moldura de fenda: um filete violeta em volta do HUD, só nas fendas', () => {
    const { rerender } = render(<FlightHud snap={snap()} />);
    expect(screen.getByTestId('flight-hud')).toHaveAttribute('data-rift', 'false');
    expect(screen.queryByTestId('rift-hud-frame')).not.toBeInTheDocument();
    rerender(<FlightHud snap={snap()} rift />);
    expect(screen.getByTestId('flight-hud')).toHaveAttribute('data-rift', 'true');
    const frame = screen.getByTestId('rift-hud-frame');
    expect(frame).toHaveAttribute('aria-hidden', 'true');
    expect(frame.className).toContain('border-violet-500');
    // O HUD de sempre continua inteiro dentro da moldura.
    expect(screen.getByTestId('hud-line')).toHaveTextContent('LINHA 3/6');
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

describe('FlightHud — execução do voo (REQ-FLT-029)', () => {
  it('execução da passada, sequência a partir de 3 e o selo de revoo', () => {
    const { rerender } = render(
      <FlightHud snap={snap({ passScore: 0.88, passLetter: 'A', streak: 2 })} />,
    );
    expect(screen.getByTestId('hud-execution')).toHaveTextContent('EXECUÇÃOA 88 %');
    expect(screen.queryByTestId('hud-streak')).not.toBeInTheDocument();
    rerender(
      <FlightHud snap={snap({ passScore: 0.88, passLetter: 'A', streak: 7, refly: true })} />,
    );
    expect(screen.getByTestId('hud-streak')).toHaveTextContent('sequência ×7');
    expect(screen.getByTestId('hud-execution')).toHaveTextContent('REVOO');
  });

  it('rajada avisada: alerta com o lado e a contagem, biruta âmbar', () => {
    render(
      <FlightHud
        snap={snap({
          gust: { side: 1, inS: 1.2, active: false },
          alerts: [makeAlert('GUST', 1.2, 1)],
        })}
      />,
    );
    expect(
      within(screen.getByTestId('hud-alerts')).getByText('RAJADA ▶ em 1,2 s'),
    ).toBeInTheDocument();
    const sock = screen.getByTestId('hud-windsock');
    expect(sock).toHaveAttribute('data-gust', 'warned');
    expect(sock).toHaveAccessibleName('Biruta: vento a 90° do rumo');
  });

  it('nota Fraca pela faixa: a marca mostra a nota e o eixo; com reduceFlashes, sem subir', () => {
    const weak = snap({ lastGrade: { grade: 'WEAK', axis: 'lateral', seq: 4 } });
    const { rerender } = render(<FlightHud snap={weak} />);
    const mark = screen.getByTestId('hud-grade');
    expect(mark).toHaveTextContent('FRACA · faixa');
    expect(mark).toHaveClass('grade-pop', 'text-amber-400');
    useGameStore.setState((s) => ({ settings: { ...s.settings, reduceFlashes: true } }));
    rerender(<FlightHud snap={weak} />);
    expect(screen.getByTestId('hud-grade')).toHaveClass('grade-fade');
    rerender(<FlightHud snap={snap({ lastGrade: { grade: 'PERFECT', axis: null, seq: 5 } })} />);
    expect(screen.getByTestId('hud-grade')).toHaveTextContent(/^PERFEITA$/);
  });

  it('velocidade no solo acima do plano fica âmbar e depois vermelha; a seta de altura aparece fora da zona Perfeita', () => {
    const { rerender } = render(<FlightHud snap={snap({ groundSpeedMs: 11, planSpeedMs: 10 })} />);
    expect(within(screen.getByTestId('hud-ground-speed')).getByText('11,0 m/s')).toHaveClass(
      'text-amber-300',
    );
    rerender(<FlightHud snap={snap({ groundSpeedMs: 12, planSpeedMs: 10 })} />);
    expect(within(screen.getByTestId('hud-ground-speed')).getByText('12,0 m/s')).toHaveClass(
      'text-rose-400',
    );
    expect(screen.queryByTestId('hud-climb')).not.toBeInTheDocument();
    rerender(<FlightHud snap={snap({ corridorDeltaM: 4.4, corridorTolM: 3 })} />);
    expect(screen.getByTestId('hud-climb')).toHaveTextContent('▲ +4 m');
    rerender(<FlightHud snap={snap({ corridorDeltaM: -6, corridorTolM: 3 })} />);
    expect(screen.getByTestId('hud-climb')).toHaveTextContent('▼ −6 m');
  });

  it('boletim da linha recusada na curva: letra, contagem e "REVOO NECESSÁRIO"', () => {
    render(
      <FlightHud
        snap={snap({
          phase: 'TURN',
          lineReport: {
            lineNumber: 3,
            pass: 0,
            score: 0.32,
            letter: 'D',
            counts: [1, 2, 6, 6],
            accepted: false,
          },
        })}
      />,
    );
    const card = screen.getByTestId('hud-line-report');
    expect(card).toHaveAttribute('data-accepted', 'false');
    expect(card).toHaveTextContent('LINHA 3 · D');
    expect(card).toHaveTextContent('1 perfeitas · 2 boas · 6 fracas · 6 rejeitadas');
    expect(card).toHaveTextContent('REVOO NECESSÁRIO');
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
    cornUsed: 0,
    lidar: null,
    detected: false,
    rings: 0,
    featuresCaptured: [],
    atlas: false,
    linePasses: [],
    refly: [],
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

  it('voo de LiDAR sem nenhuma foto: a nuvem conta como dado, e "Levar dados" aparece', () => {
    const m = withMission(false);
    useGameStore.setState((s) => ({
      mission: {
        ...s.mission,
        active: {
          ...(s.mission.active as NonNullable<typeof s.mission.active>),
          lidar: {
            grid: {
              cols: 1,
              rows: 1,
              pulses: [5],
              firstAbove: [3],
              ground: [1],
              cellAreaM2: 1,
            },
            samples: [],
          },
        },
      },
    }));
    render(<PostFlightDialog result={result} totalLines={6} energyLeft={0.6} />);
    const dialog = screen.getByRole('dialog', { name: 'Voo concluído' });
    expect(within(dialog).getByTestId('post-photos')).toHaveTextContent('0');
    expect(
      within(dialog).queryByRole('button', { name: /Tentar de novo/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: /Levar dados/ }));
    expect(get().session.screen).toBe('WORLD_MAP');
    expect(get().mission.pending.map((p) => p.id)).toEqual([m.id]);
  });

  it('sem foto e sem nuvem não há o que levar: só "Tentar de novo"', () => {
    withMission(false);
    render(<PostFlightDialog result={result} totalLines={6} energyLeft={0.6} />);
    const dialog = screen.getByRole('dialog', { name: 'Voo concluído' });
    expect(within(dialog).queryByRole('button', { name: /Levar dados/ })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Tentar de novo/ })).toBeInTheDocument();
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

  it('Nova surtida: com linhas incompletas e milho em estoque (Atlas), enche o papo; sem estoque, some', () => {
    withMission(true);
    useGameStore.setState((s) => ({
      mission: {
        ...s.mission,
        active: {
          ...(s.mission.active as NonNullable<typeof s.mission.active>),
          completedLines: [0, 1],
          sorties: [{ index: 0, outcome: 'RTH', durationS: 50 }],
        },
      },
      inventory: { ...s.inventory, corn: { stock: 15, crop: 4 } },
    }));
    const onNew = vi.fn();
    const { unmount } = render(
      <PostFlightDialog
        result={{ ...result, outcome: 'RTH', completedLines: [0, 1] }}
        totalLines={6}
        energyLeft={0.2}
        onNewSortie={onNew}
      />,
    );
    fireEvent.click(screen.getByTestId('post-new-sortie'));
    expect(onNew).toHaveBeenCalledOnce();
    expect(get().inventory.corn).toEqual({ stock: 9, crop: 10 });
    expect(get().mission.active?.status).toBe('IN_FLIGHT');
    unmount();
    useGameStore.setState((s) => ({ inventory: { ...s.inventory, corn: { stock: 0, crop: 10 } } }));
    render(
      <PostFlightDialog result={{ ...result, outcome: 'RTH' }} totalLines={6} energyLeft={0.2} />,
    );
    expect(screen.queryByTestId('post-new-sortie')).not.toBeInTheDocument();
    expect(get().startNewSortie()).toBe(false);
  });

  it('RTH: a confirmação aparece no HUD com os glyphs', () => {
    render(<FlightHud snap={snap({ rthConfirm: true })} />);
    expect(screen.getByTestId('hud-rth-confirm')).toHaveTextContent('Retornar à base?');
  });

  it('a nota de cada linha voada, com "revoar" nas recusadas, e a execução da missão', () => {
    withMission(true);
    const passes = [
      {
        lineIndex: 0,
        pass: 0,
        sortie: 0,
        counts: [15, 0, 0, 0] as [number, number, number, number],
        complete: true,
      },
      {
        lineIndex: 1,
        pass: 0,
        sortie: 0,
        counts: [0, 0, 10, 5] as [number, number, number, number],
        complete: true,
      },
    ];
    act(() =>
      useGameStore.setState((s) => ({
        mission: {
          ...s.mission,
          active: s.mission.active && { ...s.mission.active, linePasses: passes },
        },
      })),
    );
    render(
      <PostFlightDialog
        result={{ ...result, linePasses: passes, refly: [1] }}
        totalLines={6}
        energyLeft={0.6}
      />,
    );
    const box = screen.getByTestId('post-execution');
    const items = within(box).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Linha 1: S · 100 %');
    expect(items[0]).toHaveAttribute('data-refly', 'false');
    expect(items[1]).toHaveTextContent('Linha 2: D · 27 %revoar');
    expect(box).toHaveTextContent('Execução da missão até aqui:');
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

describe('SurveyFlightScreen — som de ambiente (T076)', () => {
  interface FakeLoop {
    id: LoopId;
    variant: MotorVariant | undefined;
    params: Record<string, number>;
    stopped: boolean;
  }

  /** Troca o `startLoop` do AudioEngine por loops falsos que anotam o que recebem. */
  function spyLoops(): FakeLoop[] {
    const loops: FakeLoop[] = [];
    vi.spyOn(AudioEngine.get(), 'startLoop').mockImplementation((id, opts) => {
      const loop: FakeLoop = { id, variant: opts?.variant, params: {}, stopped: false };
      loops.push(loop);
      const handle: LoopHandle = {
        setParam: (name, value) => {
          loop.params[name] = value;
        },
        stop: () => {
          loop.stopped = true;
        },
      };
      return handle;
    });
    return loops;
  }

  function startFlight() {
    act(() => {
      get().goTo('WORLD_MAP');
      get().startMission('C00', 1);
      get().launchMission();
    });
    useGameStore.setState((s) => ({
      session: { ...s.session, screen: 'SURVEY_FLIGHT' },
      settings: { ...s.settings, quality: 'LOW' },
    }));
  }

  afterEach(() => vi.restoreAllMocks());

  it('liga o motor da aeronave (o bater de asas do Atlas) e o vento ao entrar no voo', async () => {
    const loops = spyLoops();
    startFlight();
    const { unmount } = render(<SurveyFlightScreen />);
    const motor = loops.find((l) => l.id === 'MOTOR');
    expect(motor?.variant).toBe('BIRD');
    expect(loops.some((l) => l.id === 'WIND')).toBe(true);
    // O HUD publicado leva a velocidade ao motor (o Atlas voa a ~10 m/s).
    await waitFor(() => expect(motor?.params.rate).toBeGreaterThan(0), { timeout: 4000 });
    unmount();
    expect(loops.filter((l) => l.id === 'MOTOR' || l.id === 'WIND').every((l) => l.stopped)).toBe(
      true,
    );
  });

  it('no primeiro voo do C00 a dica do voo ganha a linha do momento: alinhar na entrada', async () => {
    spyLoops();
    startFlight();
    act(() => get().setFlags({ tutorialStep: 3 }));
    render(<SurveyFlightScreen />);
    expect(screen.getByTestId('tutorial-hint')).toHaveTextContent('Voe pelos portais');
    // Depois da decolagem, já na primeira linha.
    await waitFor(
      () => expect(screen.getByTestId('tutorial-hint-detail')).toHaveTextContent('Alinhe já'),
      { timeout: 8000 },
    );
    // Dispensar a dica da etapa leva junto as do voo.
    fireEvent.keyDown(window, { key: 'h', code: 'KeyH' });
    expect(screen.queryByTestId('tutorial-hint')).not.toBeInTheDocument();
    expect(get().flags.tutorialStep).toBe(4);
  });

  it('a pausa cala o motor e o vento; retomar os devolve', async () => {
    const loops = spyLoops();
    startFlight();
    render(<SurveyFlightScreen />);
    const motor = loops.find((l) => l.id === 'MOTOR');
    await waitFor(() => expect(motor?.params.rate).toBeGreaterThan(0), { timeout: 4000 });
    expect(motor?.params.gain).toBe(1);
    act(() => get().setPaused(true));
    expect(motor?.params.gain).toBe(0);
    expect(loops.find((l) => l.id === 'WIND')?.params.gain).toBe(0);
    act(() => get().setPaused(false));
    expect(motor?.params.gain).toBe(1);
  });
});
