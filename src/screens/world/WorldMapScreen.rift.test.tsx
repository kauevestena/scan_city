/**
 * Aba Fendas do mapa-múndi (T059, world-map §8 critério 3), com duas fendas de teste (`a` e `b`)
 * injetadas no catálogo: aparecem quando o C01 é concluído, `RIFT_OPEN` toca uma vez e os portais
 * viram marcadores interativos só na aba Fendas.
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AudioEngine } from '@/audio/AudioEngine';
import { markerViews } from '@/world/overworld/markers';
import { WORLD_MAP } from '@/world/overworld/tiles';

vi.mock('@/data/contracts', async (importOriginal) =>
  (await import('@/test/riftFixtures')).withTestRifts(await importOriginal()),
);
// A contraproposta da MegaMap é sorteada: aqui o aceite segue direto.
vi.mock('@/domain/rival', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/domain/rival')>()),
  counterOfferFor: () => false,
}));

const { useGameStore } = await import('@/state/store');
const { resetGameStore } = await import('@/test/resetStore');
const { WorldMapScreen } = await import('./WorldMapScreen');

const get = () => useGameStore.getState();
const frames = (ms: number) => act(() => new Promise<void>((r) => setTimeout(r, ms)));
const marker = (char: string) =>
  WORLD_MAP.markers.find((m) => m.char === char) as { x: number; y: number };
const press = (code: string, key = code) => {
  fireEvent.keyDown(window, { code, key });
  fireEvent.keyUp(window, { code, key });
};

/** C01 concluído: as duas fendas saem do bloqueio e são descobertas. */
function completeC01() {
  act(() => {
    useGameStore.setState((s) => ({
      contracts: {
        ...s.contracts,
        C00: { status: 'COMPLETED', completions: 1, bestScore: 0.9 },
        C01: { status: 'COMPLETED', completions: 1, bestScore: 0.9 },
      },
      stats: { ...s.stats, contractsCompleted: 2 },
    }));
    get().refreshUnlocks();
  });
}

/** Põe o avatar no centro do marcador. */
async function standAt(char: string) {
  const m = marker(char);
  act(() => get().setAvatar({ x: m.x + 0.5, y: m.y + 0.5, facing: 'S' }));
  await frames(80);
}

beforeEach(() => {
  resetGameStore();
  act(() => get().goTo('WORLD_MAP'));
});

describe('aba Fendas Dimensionais', () => {
  it('antes da primeira descoberta não há aba; Tab mostra "Nenhuma anomalia detectada ainda"', async () => {
    render(<WorldMapScreen />);
    expect(screen.getByRole('tab', { name: 'Contratos do Mundo Real' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Fendas Dimensionais' })).not.toBeInTheDocument();
    press('Tab');
    expect(await screen.findByTestId('world-hint')).toHaveTextContent(
      'Nenhuma anomalia detectada ainda',
    );
    expect(get().world.dimensionTab).toBe('REAL');
  });

  it('critério 3: com o C01 concluído, a aba aparece, RIFT_OPEN toca uma vez e os portais a e b entram', async () => {
    const play = vi.spyOn(AudioEngine.get(), 'play');
    completeC01();
    expect(get().world.discoveredRifts).toEqual(['R01', 'R02']);
    // Uma abertura só para as duas fendas, e um toast para cada.
    expect(play.mock.calls.filter(([id]) => id === 'RIFT_OPEN')).toHaveLength(1);
    expect(
      get()
        .session.toasts.filter((t) => t.type === 'rift')
        .map((t) => t.title),
    ).toEqual([
      'Anomalia dimensional detectada: Colinas Verdes de Teste',
      'Anomalia dimensional detectada: Reino dos Canos de Teste',
    ]);

    render(<WorldMapScreen />);
    expect(screen.getByRole('tab', { name: 'Contratos do Mundo Real' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Fendas Dimensionais' }));
    expect(screen.getByRole('tab', { name: 'Fendas Dimensionais' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(get().world.dimensionTab).toBe('RIFT');
    // Os portais da aba: só `a` e `b`, descobertos e disponíveis, com o marcador do mapa.
    const views = markerViews(get().contracts, 'RIFT', get().world.discoveredRifts);
    expect(views.map((v) => [v.char, v.contractId, v.status, v.kind])).toEqual([
      ['a', 'R01', 'AVAILABLE', 'RIFT'],
      ['b', 'R02', 'AVAILABLE', 'RIFT'],
    ]);
    for (const [char, id, title] of [
      ['a', 'R01', 'Colinas Verdes de Teste'],
      ['b', 'R02', 'Reino dos Canos de Teste'],
    ] as const) {
      await standAt(char);
      const prompt = screen.getByTestId('world-prompt');
      expect(prompt).toHaveAttribute('data-target', id);
      expect(prompt).toHaveTextContent(`Ver contrato "${title}"`);
    }
  });

  it('cada aba só tem os seus marcadores: portais não valem na Real, nem o 0 na Fendas', async () => {
    completeC01();
    render(<WorldMapScreen />);
    // Aba Real: o portal `a` não é interativo, o contrato `0` é.
    await standAt('a');
    expect(screen.queryByTestId('world-prompt')).not.toBeInTheDocument();
    await standAt('0');
    expect(screen.getByTestId('world-prompt')).toHaveAttribute('data-target', 'C00');
    // Aba Fendas: o contrato `0` some, o portal volta.
    fireEvent.click(screen.getByRole('tab', { name: 'Fendas Dimensionais' }));
    await frames(60);
    expect(screen.queryByTestId('world-prompt')).not.toBeInTheDocument();
    await standAt('a');
    expect(screen.getByTestId('world-prompt')).toHaveAttribute('data-target', 'R01');
  });

  it('Tab alterna Real ↔ Fendas e a escolha fica no estado salvo', async () => {
    completeC01();
    render(<WorldMapScreen />);
    press('Tab');
    await waitFor(() => expect(get().world.dimensionTab).toBe('RIFT'));
    expect(screen.getByRole('tab', { name: 'Fendas Dimensionais' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    press('Tab');
    await waitFor(() => expect(get().world.dimensionTab).toBe('REAL'));
    expect(screen.getByRole('tab', { name: 'Contratos do Mundo Real' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('um save na aba Fendas sem nenhuma fenda descoberta cai na aba Real', () => {
    act(() => get().setDimensionTab('RIFT'));
    render(<WorldMapScreen />);
    expect(screen.queryByRole('tab', { name: 'Fendas Dimensionais' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Contratos do Mundo Real' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});

describe('briefing e entrada numa fenda', () => {
  async function openBriefing() {
    completeC01();
    render(<WorldMapScreen />);
    fireEvent.click(screen.getByRole('tab', { name: 'Fendas Dimensionais' }));
    await standAt('a');
    press('Space', ' ');
    return screen.findByRole('dialog', { name: 'Colinas Verdes de Teste' });
  }

  it('INTERACT no portal abre o briefing com a moldura de fenda', async () => {
    const dialog = await openBriefing();
    expect(within(dialog).getByTestId('briefing-rift-frame')).toHaveTextContent(
      'Fenda dimensional',
    );
    expect(within(dialog).getByTestId('briefing')).toHaveAttribute('data-dimension', 'RIFT');
    // Retrato de emblema abstrato do cliente, nunca o desenho do personagem.
    expect(within(dialog).getAllByText('Cliente R01').length).toBeGreaterThan(0);
  });

  it('Aceitar passa pela distorção de 700 ms e só então abre o campo', async () => {
    const dialog = await openBriefing();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Aceitar' }));
    expect(screen.getByTestId('rift-warp')).toBeInTheDocument();
    expect(get().session.screen).toBe('WORLD_MAP');
    expect(get().mission.active).toBeNull();
    await waitFor(() => expect(get().session.screen).toBe('FIELD_SETUP'), { timeout: 3000 });
    expect(get().mission.active).toMatchObject({ contractId: 'R01', status: 'PLANNING' });
  });

  it('com reduceFlashes a distorção é pulada: o campo abre na hora', async () => {
    act(() => useGameStore.setState((s) => ({ settings: { ...s.settings, reduceFlashes: true } })));
    const dialog = await openBriefing();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Aceitar' }));
    expect(screen.queryByTestId('rift-warp')).not.toBeInTheDocument();
    expect(get().session.screen).toBe('FIELD_SETUP');
    expect(get().mission.active?.contractId).toBe('R01');
  });

  it('um contrato do Mundo Real não ganha a moldura nem a distorção', async () => {
    completeC01();
    render(<WorldMapScreen />);
    await standAt('0');
    press('Space', ' ');
    const dialog = await screen.findByRole('dialog', { name: 'Sítio do Avô' });
    expect(within(dialog).queryByTestId('briefing-rift-frame')).not.toBeInTheDocument();
    expect(within(dialog).getByTestId('briefing')).toHaveAttribute('data-dimension', 'REAL');
    fireEvent.click(within(dialog).getByRole('button', { name: /Aceitar|Repetir/ }));
    expect(screen.queryByTestId('rift-warp')).not.toBeInTheDocument();
    expect(get().session.screen).toBe('FIELD_SETUP');
  });
});
