import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { SOUVENIRS } from '@/data/souvenirs';
import { useGameStore } from '@/state/store';
import { resetGameStore } from '@/test/resetStore';
import { OfficeScreen } from './OfficeScreen';
import { ShelfPanel, shelfSlots } from './ShelfPanel';

const get = () => useGameStore.getState();
const slot = (id: string) => screen.getByTestId(`shelf-${id}`);

beforeEach(() => resetGameStore());

describe('shelfSlots — estados dos 18 nichos', () => {
  it('obtido mostra o nome; contrato desbloqueado, "Conclua <título>"; bloqueado ou desconhecido, "???"', () => {
    const slots = shelfSlots(['SV_NOTEBOOK'], {
      C00: { status: 'COMPLETED', completions: 1, bestScore: 0.9 },
      C01: { status: 'LOCKED', completions: 0, bestScore: 0 },
    });
    expect(slots).toHaveLength(18);
    expect(slots[0]).toMatchObject({ state: 'OBTAINED', label: 'Caderneta de Campo do Avô' });
    expect(slots.find((s) => s.souvenir.contractId === 'C01')).toMatchObject({
      state: 'UNKNOWN',
      label: '???',
    });
    // Sem o souvenir, mas com o contrato disponível: a dica com o título.
    const hint = shelfSlots([], { C00: { status: 'AVAILABLE', completions: 0, bestScore: 0 } })[0];
    expect(hint).toMatchObject({ state: 'HINT', label: 'Conclua Sítio do Avô' });
  });
});

describe('ShelfPanel', () => {
  it('grade 6 × 3 com os 18 souvenirs e a contagem', () => {
    render(<ShelfPanel onClose={() => undefined} />);
    const grid = screen.getByTestId('shelf-grid');
    expect(within(grid).getAllByRole('button')).toHaveLength(18);
    expect(grid.className).toContain('grid-cols-6');
    expect(screen.getByTestId('shelf-count')).toHaveTextContent(
      `0 / ${SOUVENIRS.length} souvenirs`,
    );
    // Novo jogo: o C00 está disponível (dica); os demais, "???".
    expect(slot('SV_NOTEBOOK')).toHaveAttribute('data-state', 'HINT');
    expect(slot('SV_CITY_KEY')).toHaveAttribute('data-state', 'UNKNOWN');
    expect(slot('SV_NOTEBOOK')).toHaveTextContent('?');
  });

  it('não obtido: ao escolher, mostra a dica do contrato (ou "???")', () => {
    render(<ShelfPanel onClose={() => undefined} />);
    expect(screen.getByTestId('shelf-detail')).toHaveTextContent('Escolha um nicho');
    fireEvent.click(slot('SV_NOTEBOOK'));
    expect(screen.getByTestId('shelf-detail')).toHaveTextContent('Conclua Sítio do Avô');
    fireEvent.click(slot('SV_CITY_KEY'));
    expect(screen.getByTestId('shelf-detail')).toHaveTextContent('???');
    expect(screen.getByTestId('shelf-detail')).not.toHaveTextContent('Chave da Cidade');
  });

  it('obtido: ícone na cor do souvenir, nome e história', () => {
    act(() => useGameStore.setState({ souvenirs: ['SV_NOTEBOOK'] }));
    render(<ShelfPanel onClose={() => undefined} />);
    expect(slot('SV_NOTEBOOK')).toHaveAttribute('data-state', 'OBTAINED');
    expect(slot('SV_NOTEBOOK')).toHaveAccessibleName('Caderneta de Campo do Avô');
    expect(slot('SV_NOTEBOOK').querySelector('svg')).not.toBeNull();
    expect(screen.getByTestId('shelf-count')).toHaveTextContent('1 / 18 souvenirs');
    // O primeiro obtido já vem selecionado, com a história.
    const detail = screen.getByTestId('shelf-detail');
    expect(detail).toHaveTextContent('Caderneta de Campo do Avô');
    expect(detail).toHaveTextContent(SOUVENIRS[0]?.story ?? '');
  });

  it('um souvenir novo preenche o nicho na hora', () => {
    render(<ShelfPanel onClose={() => undefined} />);
    expect(slot('SV_NOTEBOOK')).toHaveAttribute('data-state', 'HINT');
    act(() => useGameStore.setState({ souvenirs: ['SV_NOTEBOOK'] }));
    expect(slot('SV_NOTEBOOK')).toHaveAttribute('data-state', 'OBTAINED');
  });
});

describe('os 9 hotspots do escritório (REQ-OFF-001)', () => {
  it('cada hotspot abre o seu painel ou troca de tela', () => {
    get().setFlags({ introSeen: true });
    render(<OfficeScreen />);
    const panels: Array<[RegExp, string]> = [
      [/Workstation/, 'workstation-panel'],
      [/Garagem/, 'garage-panel'],
      [/Poleiro/, 'perch-panel'],
      [/Estante/, 'shelf-panel'],
      [/Mesa da Equipe/, 'staff-panel'],
      [/Quadro de Carreira/, 'career-panel'],
    ];
    expect(document.querySelectorAll('[data-hotspot]')).toHaveLength(9);
    for (const [name, testId] of panels) {
      fireEvent.click(screen.getByRole('button', { name }));
      expect(screen.getByTestId(testId)).toBeInTheDocument();
      fireEvent.keyDown(window, { code: 'Escape' });
      expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole('button', { name: 'Mesa Holográfica' }));
    expect(get().session.screen).toBe('HOLO_TABLE_VIEW');
    act(() => get().goTo('OFFICE'));
    fireEvent.click(screen.getByRole('button', { name: 'Laboratório' }));
    expect(get().session.screen).toBe('INFOGRAPHIC_LAB');
    act(() => get().goTo('OFFICE'));
    fireEvent.click(screen.getByRole('button', { name: /Porta/ }));
    expect(get().session.screen).toBe('WORLD_MAP');
  });
});
