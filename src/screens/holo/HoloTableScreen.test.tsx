import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useGameStore } from '@/state/store';
import { resetGameStore } from '@/test/resetStore';
import { HoloTableScreen } from './HoloTableScreen';

const get = () => useGameStore.getState();

function mapC00(featured = false) {
  useGameStore.setState((s) => ({
    museum: {
      ...s.museum,
      sectors: {
        C00: {
          contractId: 'C00',
          qualityScore: 0.8,
          mappedAt: Date.UTC(2026, 10, 14),
          incomePerMinBRL: 900,
          className: 'C',
        },
      },
      featured: featured ? { REAL: 'C00' } : {},
    },
    contracts: { ...s.contracts, C00: { status: 'COMPLETED', completions: 1, bestScore: 0.8 } },
    settings: { ...s.settings, quality: 'LOW' },
  }));
}

beforeEach(() => resetGameStore());

describe('HoloTableScreen', () => {
  it('museu vazio: texto de convite; Esc volta ao escritório (T14)', () => {
    act(() => {
      get().goTo('HOLO_TABLE_VIEW');
    });
    render(<HoloTableScreen />);
    expect(screen.getByTestId('holo-empty')).toHaveTextContent(
      'Conclua contratos para esculpir o Museu',
    );
    expect(screen.queryByTestId('sector-card')).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(get().session.screen).toBe('OFFICE');
    // O mesmo Esc não pausa o jogo.
    expect(get().session.paused).toBe(false);
  });

  it('chegada do processamento: o setor focado já vem selecionado, com o cartão e o destaque', () => {
    mapC00();
    act(() => {
      useGameStore.setState((s) => ({
        session: { ...s.session, screen: 'HOLO_TABLE_VIEW', payload: { focusSectorId: 'C00' } },
      }));
    });
    render(<HoloTableScreen />);
    expect(screen.queryByTestId('holo-empty')).not.toBeInTheDocument();
    const card = screen.getByTestId('sector-card');
    expect(card).toHaveTextContent('Sítio do Avô');
    expect(card).toHaveTextContent('Classe C · Nota 80');
    expect(card).toHaveTextContent('R$ 9,00/min');
    expect(card).toHaveTextContent('54 visitantes/h');
    fireEvent.click(within(card).getByRole('button', { name: 'Destacar' }));
    expect(get().museum.featured).toEqual({ REAL: 'C00' });
    expect(card).toHaveTextContent('R$ 18,00/min');
    fireEvent.click(within(card).getByRole('button', { name: 'Em destaque' }));
    expect(get().museum.featured).toEqual({});
    fireEvent.click(screen.getByRole('button', { name: /Voltar/ }));
    expect(get().session.screen).toBe('OFFICE');
  });

  it('setor em névoa mostra "Contrato: <nome> — não mapeado"', () => {
    act(() => {
      useGameStore.setState((s) => ({
        session: { ...s.session, screen: 'HOLO_TABLE_VIEW', payload: { focusSectorId: 'C00' } },
      }));
    });
    render(<HoloTableScreen />);
    expect(screen.getByTestId('sector-card')).toHaveTextContent(
      'Contrato: Sítio do Avô — não mapeado',
    );
  });
});
