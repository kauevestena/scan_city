import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { createDebugMission } from '@/app/debugFixtures';
import { FINALE_LINES, FINALE_LETTER, INTRO_LINES, OFFICE_HOTSPOTS } from '@/data/office';
import { DEFAULT_SPAWN } from '@/state/slices/worldSlice';
import { useGameStore } from '@/state/store';
import { resetGameStore } from '@/test/resetStore';
import { OfficeScreen } from './OfficeScreen';

const get = () => useGameStore.getState();

/** jsdom não faz layout: coloca os hotspots onde o canvas os desenharia (os retângulos dos dados). */
function placeHotspots() {
  for (const h of OFFICE_HOTSPOTS) {
    const el = document.querySelector<HTMLElement>(`[data-hotspot="${h.id}"]`);
    if (el) {
      el.getBoundingClientRect = () =>
        ({ left: h.rect.x, top: h.rect.y, width: h.rect.w, height: h.rect.h }) as DOMRect;
    }
  }
}

beforeEach(() => resetGameStore());

describe('OfficeScreen', () => {
  it('novo jogo: a intro mostra os 4 cartões e, depois dela, o foco vai para a Porta', () => {
    render(<OfficeScreen />);
    const dialog = screen.getByRole('dialog', { name: 'Uma carta na mesa' });
    const next = within(dialog).getByRole('button', { name: 'Avançar diálogo' });
    for (const line of INTRO_LINES) {
      fireEvent.click(next);
      expect(within(dialog).getByTestId('dialogue-text')).toHaveTextContent(line);
      fireEvent.click(next);
    }
    expect(get().flags.introSeen).toBe(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Porta — sair para o mapa' })).toHaveFocus();
  });

  it('os 9 hotspots são botões; a Porta, a Mesa e o Laboratório trocam de tela', () => {
    get().setFlags({ introSeen: true });
    render(<OfficeScreen />);
    const hotspots = document.querySelectorAll('[data-hotspot]');
    expect([...hotspots].map((h) => h.getAttribute('data-hotspot')).sort()).toEqual([
      'CAREER',
      'DOOR',
      'GARAGE',
      'HOLO_TABLE',
      'LAB',
      'PERCH',
      'SHELF',
      'STAFF',
      'WORKSTATION',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Mesa Holográfica' }));
    expect(get().session.screen).toBe('HOLO_TABLE_VIEW');
    act(() => get().goTo('OFFICE'));
    fireEvent.click(screen.getByRole('button', { name: 'Laboratório' }));
    expect(get().session.screen).toBe('INFOGRAPHIC_LAB');
    act(() => {
      get().goTo('OFFICE');
      get().setAvatar({ x: 10.5, y: 20.5, facing: 'N' });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Porta — sair para o mapa' }));
    expect(get().session.screen).toBe('WORLD_MAP');
    // Sair pela porta põe o avatar no spawn, ao lado dela.
    expect(get().world.avatar).toEqual({ ...DEFAULT_SPAWN, facing: 'S' });
  });

  it('só com o teclado, setas e Enter alcançam e ativam os 9 hotspots', () => {
    get().setFlags({ introSeen: true });
    render(<OfficeScreen />);
    placeHotspots();
    const focusedId = () => (document.activeElement as HTMLElement).getAttribute('data-hotspot');
    const focusHotspot = (id: string) =>
      document.querySelector<HTMLElement>(`[data-hotspot="${id}"]`)?.focus();
    expect(focusedId()).toBe('DOOR');
    // Busca em largura: de cada hotspot alcançado, tenta as 4 direções (como o E2E).
    const seen = new Set(['DOOR']);
    const queue = ['DOOR'];
    while (queue.length > 0) {
      const from = queue.shift() as string;
      for (const code of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
        focusHotspot(from);
        fireEvent.keyDown(document.activeElement as HTMLElement, { code });
        const to = focusedId();
        if (to && !seen.has(to)) {
          seen.add(to);
          queue.push(to);
        }
      }
    }
    expect([...seen].sort()).toEqual([
      'CAREER',
      'DOOR',
      'GARAGE',
      'HOLO_TABLE',
      'LAB',
      'PERCH',
      'SHELF',
      'STAFF',
      'WORKSTATION',
    ]);
    // Enter no botão focado usa a ativação nativa (clique).
    focusHotspot('CAREER');
    fireEvent.click(document.activeElement as HTMLElement);
    expect(screen.getByTestId('career-panel')).toBeInTheDocument();
  });

  it('com missão pendente: toast na entrada, foco na Workstation e "Processar" leva ao processamento (T4)', () => {
    get().setFlags({ introSeen: true });
    const mission = createDebugMission('C00', true);
    useGameStore.setState((s) => ({ mission: { ...s.mission, pending: [mission] } }));
    render(<OfficeScreen />);
    expect(get().session.toasts.at(-1)?.title).toBe(
      'Há 1 missão aguardando processamento na Workstation',
    );
    const workstation = screen.getByRole('button', { name: 'Workstation' });
    expect(workstation).toHaveFocus();
    fireEvent.click(workstation);
    const panel = screen.getByTestId('workstation-panel');
    expect(within(panel).getByText('C00')).toBeInTheDocument();
    expect(within(panel).getByText('96 fotos')).toBeInTheDocument();
    expect(within(panel).getByText('Tempo estimado: 00:14')).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', { name: 'Processar' }));
    expect(get().session.screen).toBe('PROCESSING_RESULTS');
    expect(get().session.payload).toEqual({ missionId: mission.id, inField: false });
  });

  it('o painel fecha com Esc (UI_BACK) e com o ✕, devolvendo o foco ao hotspot', () => {
    get().setFlags({ introSeen: true });
    render(<OfficeScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Workstation' }));
    expect(
      screen.getByText('Nenhuma missão na fila. Voe um contrato e traga os dados para cá.'),
    ).toBeInTheDocument();
    fireEvent.keyDown(window, { code: 'Escape' });
    expect(screen.queryByTestId('workstation-panel')).not.toBeInTheDocument();
    expect(get().session.paused).toBe(false);
    expect(screen.getByRole('button', { name: 'Workstation' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Workstation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fechar painel' }));
    expect(screen.queryByTestId('workstation-panel')).not.toBeInTheDocument();
  });

  it('a Porta pulsa por 6 s depois da intro (estática com reduceFlashes)', () => {
    vi.useFakeTimers();
    render(<OfficeScreen />);
    const next = screen.getByRole('button', { name: 'Avançar diálogo' });
    for (let i = 0; i < INTRO_LINES.length * 2; i++) fireEvent.click(next);
    const label = () =>
      screen.getByRole('button', { name: 'Porta — sair para o mapa' }).querySelector('span');
    expect(label()?.className).toContain('animate-pulse');
    expect(label()?.className).toContain('opacity-100');
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(label()?.className).not.toContain('animate-pulse');
    vi.useRealTimers();
  });
});

describe('OfficeScreen — final da campanha (REQ-CNT-008)', () => {
  const REAL = ['C00', 'C01', 'C02', 'C03', 'C04', 'C05', 'C06'];
  const completed = (ids: string[]) =>
    Object.fromEntries(
      ids.map((id) => [id, { status: 'COMPLETED' as const, completions: 1, bestScore: 0.9 }]),
    );
  const finishCampaign = (ids = REAL) =>
    useGameStore.setState((s) => ({ contracts: { ...s.contracts, ...completed(ids) } }));

  it('com os 7 contratos reais concluídos, ao entrar: 4 cartões com a carta do avô, o chapéu e o toast; uma única vez', () => {
    get().setFlags({ introSeen: true });
    finishCampaign();
    expect(get().inventory.cosmetics).not.toContain('CHAR_GRANDPA_HAT');
    const { unmount } = render(<OfficeScreen />);
    const dialog = screen.getByRole('dialog', { name: 'Museu da Terra' });
    const next = within(dialog).getByRole('button', { name: 'Avançar diálogo' });
    expect(FINALE_LINES).toHaveLength(4);
    expect(FINALE_LINES[1]).toBe(FINALE_LETTER);
    for (const line of FINALE_LINES) {
      fireEvent.click(next);
      expect(within(dialog).getByTestId('dialogue-text')).toHaveTextContent(line);
      // O cartão ainda não entrega nada: o chapéu vem no fim.
      expect(get().flags.finaleSeen).toBe(false);
      fireEvent.click(next);
    }
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(get().flags.finaleSeen).toBe(true);
    expect(get().inventory.cosmetics).toContain('CHAR_GRANDPA_HAT');
    expect(get().session.toasts.map((t) => t.title)).toContain('Museu da Terra inaugurado!');
    // Entrar de novo no escritório não repete o final.
    unmount();
    render(<OfficeScreen />);
    expect(screen.queryByRole('dialog', { name: 'Museu da Terra' })).not.toBeInTheDocument();
    expect(
      get().session.toasts.filter((t) => t.title === 'Museu da Terra inaugurado!'),
    ).toHaveLength(1);
  });

  it('com 6 dos 7 contratos reais, ou com as fendas só, não há final', () => {
    get().setFlags({ introSeen: true });
    finishCampaign(REAL.filter((id) => id !== 'C03'));
    const { unmount } = render(<OfficeScreen />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    unmount();
    resetGameStore();
    get().setFlags({ introSeen: true });
    finishCampaign(['R01', 'R02', 'R03', 'R04', 'R05', 'R06', 'R07', 'R08', 'R09', 'R10', 'R11']);
    render(<OfficeScreen />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(get().flags.finaleSeen).toBe(false);
  });

  it('com a introdução ainda por ver, só a introdução aparece; o final espera a próxima entrada', () => {
    finishCampaign();
    const { unmount } = render(<OfficeScreen />);
    expect(screen.getByRole('dialog', { name: 'Uma carta na mesa' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Museu da Terra' })).not.toBeInTheDocument();
    unmount();
    get().setFlags({ introSeen: true });
    render(<OfficeScreen />);
    expect(screen.getByRole('dialog', { name: 'Museu da Terra' })).toBeInTheDocument();
  });

  it('concluir o último contrato com o escritório aberto não dispara o final na hora: ele vem na próxima entrada', () => {
    get().setFlags({ introSeen: true });
    finishCampaign(REAL.filter((id) => id !== 'C03'));
    const { unmount } = render(<OfficeScreen />);
    act(() => finishCampaign(['C03']));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    unmount();
    render(<OfficeScreen />);
    expect(screen.getByRole('dialog', { name: 'Museu da Terra' })).toBeInTheDocument();
  });
});
