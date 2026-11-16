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

function mapRift(id: string, incomePerMinBRL = 800) {
  useGameStore.setState((s) => ({
    museum: {
      ...s.museum,
      sectors: {
        ...s.museum.sectors,
        [id]: {
          contractId: id,
          qualityScore: 0.8,
          mappedAt: Date.UTC(2026, 10, 14),
          incomePerMinBRL,
          className: 'C',
        },
      },
    },
    contracts: { ...s.contracts, [id]: { status: 'COMPLETED', completions: 1, bestScore: 0.8 } },
    world: { ...s.world, discoveredRifts: [...new Set([...s.world.discoveredRifts, id])] },
    settings: { ...s.settings, quality: 'LOW' },
  }));
}

function open() {
  act(() => {
    get().goTo('HOLO_TABLE_VIEW');
  });
  return render(<HoloTableScreen />);
}

const key = (code: string, k = code) => fireEvent.keyDown(window, { key: k, code });

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

  it('chegada de uma fenda: abre no Multiverso, com o diorama dela selecionado', () => {
    mapRift('R01');
    act(() => {
      useGameStore.setState((s) => ({
        session: { ...s.session, screen: 'HOLO_TABLE_VIEW', payload: { focusSectorId: 'R01' } },
      }));
    });
    render(<HoloTableScreen />);
    expect(screen.getByTestId('holo-screen')).toHaveAttribute('data-dimension', 'RIFT');
    const card = screen.getByTestId('sector-card');
    expect(card).toHaveTextContent('Colinas Verdes dos Espinhos');
    expect(card).toHaveTextContent('Classe C · Nota 80');
    // O destaque do cartão é da ala do diorama: o do Multiverso, não o da Real.
    fireEvent.click(within(card).getByRole('button', { name: 'Destacar' }));
    expect(get().museum.featured).toEqual({ RIFT: 'R01' });
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

describe('HoloTableScreen — modos e dimensão (REQ-HOL-005, REQ-HOL-006)', () => {
  it('começa em Ortofoto; 1, 2 e 3 trocam o modo e os botões refletem o estado', () => {
    open();
    const screenEl = screen.getByTestId('holo-screen');
    expect(screenEl).toHaveAttribute('data-mode', 'ORTHO');
    expect(screen.getByRole('button', { name: '1 Ortofoto' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    key('Digit3', '3');
    expect(screenEl).toHaveAttribute('data-mode', 'NEON');
    expect(screen.getByRole('button', { name: '3 LiDAR Neon' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    key('Digit2', '2');
    expect(screenEl).toHaveAttribute('data-mode', 'HYPSO');
    fireEvent.click(screen.getByRole('button', { name: '1 Ortofoto' }));
    expect(screenEl).toHaveAttribute('data-mode', 'ORTHO');
  });

  it('FIRE (Espaço) percorre os modos em ciclo', () => {
    open();
    const screenEl = screen.getByTestId('holo-screen');
    key('Space', ' ');
    expect(screenEl).toHaveAttribute('data-mode', 'HYPSO');
    key('Space', ' ');
    expect(screenEl).toHaveAttribute('data-mode', 'NEON');
    key('Space', ' ');
    expect(screenEl).toHaveAttribute('data-mode', 'ORTHO');
  });

  it('sem fendas descobertas, o Multiverso fica desabilitado e o Tab só avisa', () => {
    open();
    const tab = screen.getByRole('tab', { name: 'Multiverso' });
    expect(tab).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(tab);
    expect(screen.getByTestId('holo-screen')).toHaveAttribute('data-dimension', 'REAL');
    key('Tab');
    expect(screen.getByTestId('holo-screen')).toHaveAttribute('data-dimension', 'REAL');
    expect(get().session.toasts.map((t) => t.title)).toContain('Nenhuma anomalia registrada');
  });

  it('com a R01 concluída, Tab alterna Terra Real ↔ Multiverso (e a aba também)', () => {
    mapRift('R01');
    open();
    const screenEl = screen.getByTestId('holo-screen');
    expect(screen.getByRole('tab', { name: 'Multiverso' })).not.toHaveAttribute('aria-disabled');
    key('Tab');
    expect(screenEl).toHaveAttribute('data-dimension', 'RIFT');
    // O modo sobrevive à troca de dimensão.
    key('Digit3', '3');
    key('Tab');
    expect(screenEl).toHaveAttribute('data-dimension', 'REAL');
    expect(screenEl).toHaveAttribute('data-mode', 'NEON');
    fireEvent.click(screen.getByRole('tab', { name: 'Multiverso' }));
    expect(screenEl).toHaveAttribute('data-dimension', 'RIFT');
    fireEvent.click(screen.getByRole('tab', { name: 'Terra Real' }));
    expect(screenEl).toHaveAttribute('data-dimension', 'REAL');
  });

  it('um diorama mapeado basta para abrir o Multiverso, mesmo sem a fenda registrada como descoberta', () => {
    mapRift('R01');
    useGameStore.setState((s) => ({ world: { ...s.world, discoveredRifts: [] } }));
    open();
    expect(screen.getByRole('tab', { name: 'Multiverso' })).not.toHaveAttribute('aria-disabled');
  });

  it('o Multiverso sem diorama mapeado mostra o convite; selecionar uma névoa não entrega o nome', () => {
    useGameStore.setState((s) => ({ world: { ...s.world, discoveredRifts: ['R02'] } }));
    open();
    key('Tab');
    expect(screen.getByTestId('holo-screen')).toHaveAttribute('data-dimension', 'RIFT');
    expect(screen.getByTestId('holo-empty')).toBeInTheDocument();
  });
});

describe('HoloTableScreen — painel de alas (REQ-HOL-007)', () => {
  it('W abre e fecha o painel; o botão e o X também', () => {
    open();
    expect(screen.queryByTestId('wings-panel')).not.toBeInTheDocument();
    key('KeyW', 'w');
    expect(screen.getByTestId('wings-panel')).toBeInTheDocument();
    expect(screen.getByTestId('wings-toggle')).toHaveAttribute('aria-expanded', 'true');
    key('KeyW', 'w');
    expect(screen.queryByTestId('wings-panel')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('wings-toggle'));
    expect(screen.getByTestId('wings-panel')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar alas' }));
    expect(screen.queryByTestId('wings-panel')).not.toBeInTheDocument();
  });

  it('uma seção por ala, com os não mapeados em névoa ("░ título — não mapeado")', () => {
    mapC00();
    mapRift('R01');
    open();
    key('KeyW', 'w');
    const real = screen.getByTestId('wing-REAL');
    const rift = screen.getByTestId('wing-RIFT');
    expect(within(real).getAllByRole('listitem')).toHaveLength(7);
    expect(within(rift).getAllByRole('listitem')).toHaveLength(11);
    // Mapeado: ★, título, classe · nota e renda.
    const c00 = screen.getByTestId('wing-row-C00');
    expect(c00).toHaveTextContent('Sítio do Avô');
    expect(c00).toHaveTextContent('C · 80');
    expect(c00).toHaveTextContent('R$ 9,00/min');
    // Em névoa: o nome do contrato Real aparece; o da fenda não descoberta, não.
    expect(screen.getByTestId('wing-row-C02')).toHaveTextContent('░');
    expect(screen.getByTestId('wing-row-C02')).toHaveTextContent('— não mapeado');
    expect(screen.getByTestId('wing-row-R02')).toHaveTextContent(
      '░ Anomalia desconhecida — não mapeado',
    );
    expect(screen.getByTestId('wing-row-R01')).toHaveTextContent('Colinas Verdes dos Espinhos');
  });

  it('a renda de cada ala é a soma dos setores dela; destacar soma exatamente a renda do setor (×2)', () => {
    mapC00();
    useGameStore.setState((s) => ({
      museum: {
        ...s.museum,
        sectors: {
          ...s.museum.sectors,
          C01: {
            contractId: 'C01',
            qualityScore: 1,
            mappedAt: 0,
            incomePerMinBRL: 4000,
            className: 'A',
          },
        },
      },
    }));
    mapRift('R01', 800);
    open();
    key('KeyW', 'w');
    expect(screen.getByTestId('wing-income-REAL')).toHaveTextContent('R$ 49,00/min');
    expect(screen.getByTestId('wing-income-RIFT')).toHaveTextContent('R$ 8,00/min');
    // Destaca o C01 pela ★ do painel: a renda da Real sobe exatamente R$ 40,00.
    fireEvent.click(screen.getByRole('button', { name: 'Destacar Metrópole Vertical' }));
    expect(get().museum.featured).toEqual({ REAL: 'C01' });
    expect(screen.getByTestId('wing-income-REAL')).toHaveTextContent('R$ 89,00/min');
    expect(screen.getByTestId('wing-income-RIFT')).toHaveTextContent('R$ 8,00/min');
    expect(
      screen.getByRole('button', { name: 'Remover o destaque de Metrópole Vertical' }),
    ).toHaveAttribute('aria-pressed', 'true');
    // Um por ala: destacar o C00 passa o destaque para ele.
    fireEvent.click(screen.getByRole('button', { name: 'Destacar Sítio do Avô' }));
    expect(get().museum.featured).toEqual({ REAL: 'C00' });
    expect(screen.getByTestId('wing-income-REAL')).toHaveTextContent('R$ 58,00/min');
    // O destaque do Multiverso é independente.
    fireEvent.click(screen.getByRole('button', { name: 'Destacar Colinas Verdes dos Espinhos' }));
    expect(get().museum.featured).toEqual({ REAL: 'C00', RIFT: 'R01' });
    expect(screen.getByTestId('wing-income-RIFT')).toHaveTextContent('R$ 16,00/min');
    expect(screen.getByTestId('wing-income-REAL')).toHaveTextContent('R$ 58,00/min');
    fireEvent.click(screen.getByRole('button', { name: 'Remover o destaque de Sítio do Avô' }));
    expect(get().museum.featured).toEqual({ RIFT: 'R01' });
  });

  it('rodapé: visitantes por hora (renda · 6) e o total acumulado', () => {
    mapC00();
    useGameStore.setState((s) => ({ museum: { ...s.museum, totalVisitors: 1234.6 } }));
    open();
    key('KeyW', 'w');
    // R$ 9,00/min → 54 visitantes/h.
    expect(screen.getByTestId('wings-visitors')).toHaveTextContent('Visitantes: 54/h');
    expect(screen.getByTestId('wings-total-visitors')).toHaveTextContent('Total acumulado: 1.235');
    fireEvent.click(screen.getByRole('button', { name: 'Destacar Sítio do Avô' }));
    expect(screen.getByTestId('wings-visitors')).toHaveTextContent('Visitantes: 108/h');
  });

  it('clicar no nome de um setor foca e seleciona; o de outra ala troca a dimensão', () => {
    mapC00();
    mapRift('R01');
    open();
    key('KeyW', 'w');
    fireEvent.click(within(screen.getByTestId('wing-row-C00')).getByText(/Sítio do Avô/));
    expect(screen.getByTestId('sector-card')).toHaveTextContent('Sítio do Avô');
    fireEvent.click(within(screen.getByTestId('wing-row-R01')).getByText(/Colinas Verdes/));
    expect(screen.getByTestId('holo-screen')).toHaveAttribute('data-dimension', 'RIFT');
    expect(screen.getByTestId('sector-card')).toHaveTextContent('Colinas Verdes dos Espinhos');
  });

  it('Enter destaca o setor selecionado (e de novo, remove); sem seleção, nada', () => {
    mapC00();
    act(() => {
      useGameStore.setState((s) => ({
        session: { ...s.session, screen: 'HOLO_TABLE_VIEW', payload: { focusSectorId: 'C00' } },
      }));
    });
    render(<HoloTableScreen />);
    key('Enter');
    expect(get().museum.featured).toEqual({ REAL: 'C00' });
    key('Enter');
    expect(get().museum.featured).toEqual({});
  });

  it('o cartão do setor reflete o destaque feito no painel', () => {
    mapC00();
    act(() => {
      useGameStore.setState((s) => ({
        session: { ...s.session, screen: 'HOLO_TABLE_VIEW', payload: { focusSectorId: 'C00' } },
      }));
    });
    render(<HoloTableScreen />);
    key('KeyW', 'w');
    fireEvent.click(screen.getByRole('button', { name: 'Destacar Sítio do Avô' }));
    expect(screen.getByTestId('sector-card')).toHaveTextContent('R$ 18,00/min');
    expect(screen.getByTestId('sector-card')).toHaveTextContent('108 visitantes/h');
  });
});
