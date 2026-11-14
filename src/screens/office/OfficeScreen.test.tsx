import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { createDebugMission } from '@/app/debugFixtures';
import { INTRO_LINES } from '@/data/office';
import { useGameStore } from '@/state/store';
import { resetGameStore } from '@/test/resetStore';
import { OfficeScreen } from './OfficeScreen';

const get = () => useGameStore.getState();

/** jsdom não faz layout: coloca os hotspots onde o canvas os desenharia. */
function placeHotspots() {
  const pos: Record<string, [number, number]> = {
    HOLO_TABLE: [500, 190],
    DOOR: [1044, 76],
    WORKSTATION: [56, 420],
    LAB: [740, 420],
  };
  for (const [id, [left, top]] of Object.entries(pos)) {
    const el = document.querySelector<HTMLElement>(`[data-hotspot="${id}"]`);
    if (el) el.getBoundingClientRect = () => ({ left, top, width: 200, height: 160 }) as DOMRect;
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

  it('só os 4 hotspots do v1 são botões; a Porta, a Mesa e o Laboratório trocam de tela', () => {
    get().setFlags({ introSeen: true });
    render(<OfficeScreen />);
    const hotspots = document.querySelectorAll('[data-hotspot]');
    expect([...hotspots].map((h) => h.getAttribute('data-hotspot')).sort()).toEqual([
      'DOOR',
      'HOLO_TABLE',
      'LAB',
      'WORKSTATION',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Mesa Holográfica' }));
    expect(get().session.screen).toBe('HOLO_TABLE_VIEW');
    act(() => get().goTo('OFFICE'));
    fireEvent.click(screen.getByRole('button', { name: 'Laboratório' }));
    expect(get().session.screen).toBe('INFOGRAPHIC_LAB');
    act(() => get().goTo('OFFICE'));
    fireEvent.click(screen.getByRole('button', { name: 'Porta — sair para o mapa' }));
    expect(get().session.screen).toBe('WORLD_MAP');
  });

  it('só com o teclado, setas e Enter alcançam e ativam os 4 hotspots', () => {
    get().setFlags({ introSeen: true });
    render(<OfficeScreen />);
    placeHotspots();
    const focused = () => (document.activeElement as HTMLElement).getAttribute('data-hotspot');
    expect(focused()).toBe('DOOR');
    const press = (code: string) =>
      fireEvent.keyDown(document.activeElement as HTMLElement, { code });
    press('ArrowDown');
    expect(focused()).toBe('LAB');
    press('ArrowLeft');
    expect(focused()).toBe('WORKSTATION');
    press('ArrowRight');
    expect(focused()).toBe('LAB');
    press('ArrowUp');
    expect(focused()).toBe('HOLO_TABLE');
    // Peso 2 no eixo ortogonal (input §5): da Mesa, → vai ao Laboratório, mais próximo.
    press('ArrowRight');
    expect(focused()).toBe('LAB');
    press('ArrowRight');
    expect(focused()).toBe('DOOR');
    press('ArrowLeft');
    expect(focused()).toBe('HOLO_TABLE');
    // Enter no botão focado usa a ativação nativa (clique).
    press('ArrowRight');
    press('ArrowLeft');
    expect(focused()).toBe('WORKSTATION');
    fireEvent.click(document.activeElement as HTMLElement);
    expect(screen.getByTestId('workstation-panel')).toBeInTheDocument();
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
