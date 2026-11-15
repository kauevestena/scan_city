import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { AudioEngine } from '@/audio/AudioEngine';
import { selectModifiers } from '@/state/selectors';
import { useGameStore } from '@/state/store';
import { resetGameStore } from '@/test/resetStore';
import { CareerPanel } from './CareerPanel';

const get = () => useGameStore.getState();
const setPoints = (n: number) =>
  act(() => useGameStore.setState((s) => ({ player: { ...s.player, skillPoints: n } })));
const node = (id: string) => screen.getByTestId(`skill-${id}`);

beforeEach(() => {
  resetGameStore();
  render(<CareerPanel onClose={() => undefined} />);
});

describe('CareerPanel — árvore de habilidades', () => {
  it('3 colunas (ramos) × 4 nós, com os pontos disponíveis no topo', () => {
    const branches = document.querySelectorAll('[data-branch]');
    expect([...branches].map((b) => b.getAttribute('data-branch'))).toEqual([
      'PILOT',
      'ENGINEERING',
      'MANAGEMENT',
    ]);
    for (const b of branches)
      expect(within(b as HTMLElement).getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByTestId('skill-points')).toHaveTextContent('0 pontos de habilidade');
    expect(screen.getByText('Mãos Firmes')).toBeInTheDocument();
  });

  it('sem pontos, todos bloqueados, com o motivo: "Faltam N pontos" no 1º nó, "Requer …" nos demais', () => {
    expect(node('PIL_1')).toHaveAttribute('data-state', 'LOCKED');
    expect(within(node('PIL_1')).getByTestId('skill-reason')).toHaveTextContent('Falta 1 ponto');
    expect(node('PIL_2')).toHaveAttribute('data-state', 'LOCKED');
    expect(within(node('PIL_2')).getByTestId('skill-reason')).toHaveTextContent(
      'Requer Mãos Firmes',
    );
    expect(within(node('PIL_1')).queryByRole('button')).not.toBeInTheDocument();
  });

  it('critério 4: 2 pontos → adquirir PIL_1 → caem para 1 e windDrift vira 0,8', () => {
    setPoints(2);
    expect(node('PIL_1')).toHaveAttribute('data-state', 'AVAILABLE');
    // Só o 1º nó de cada ramo está disponível; o resto espera o anterior.
    expect(node('PIL_2')).toHaveAttribute('data-state', 'LOCKED');
    const play = vi.spyOn(AudioEngine.get(), 'play');
    fireEvent.click(within(node('PIL_1')).getByRole('button', { name: 'Adquirir' }));
    const dialog = screen.getByRole('dialog', { name: 'Adquirir Mãos Firmes?' });
    expect(dialog).toHaveTextContent('Isto gasta 1 ponto de habilidade.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Adquirir' }));
    expect(get().player.skillPoints).toBe(1);
    expect(get().skills).toEqual(['PIL_1']);
    expect(selectModifiers(get()).windDrift).toBeCloseTo(0.8, 12);
    expect(play).toHaveBeenCalledWith('COLLECT');
    expect(node('PIL_1')).toHaveAttribute('data-state', 'ACQUIRED');
    expect(screen.getByTestId('skill-points')).toHaveTextContent('1 ponto de habilidade');
    expect(get().session.toasts.at(-1)?.title).toBe('Habilidade adquirida: Mãos Firmes');
    // O próximo nó do ramo (custo 1) ficou disponível.
    expect(node('PIL_2')).toHaveAttribute('data-state', 'AVAILABLE');
  });

  it('cancelar a confirmação não gasta pontos', () => {
    setPoints(2);
    fireEvent.click(within(node('PIL_1')).getByRole('button', { name: 'Adquirir' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
    expect(get().player.skillPoints).toBe(2);
    expect(get().skills).toEqual([]);
  });

  it('nó com custo maior que os pontos fica bloqueado pelo que falta, mesmo com o anterior', () => {
    act(() =>
      useGameStore.setState((s) => ({
        skills: ['PIL_1', 'PIL_2'],
        player: { ...s.player, skillPoints: 1 },
      })),
    );
    // PIL_3 custa 2 pontos.
    expect(node('PIL_3')).toHaveAttribute('data-state', 'LOCKED');
    expect(within(node('PIL_3')).getByTestId('skill-reason')).toHaveTextContent('Falta 1 ponto');
    setPoints(2);
    expect(node('PIL_3')).toHaveAttribute('data-state', 'AVAILABLE');
  });

  it('o nó disponível pulsa; com reduceFlashes, fica estático', () => {
    setPoints(1);
    expect(node('PIL_1').className).toContain('animate-pulse');
    act(() => useGameStore.setState((s) => ({ settings: { ...s.settings, reduceFlashes: true } })));
    expect(node('PIL_1').className).not.toContain('animate-pulse');
  });
});

describe('unlockSkill (ação)', () => {
  it('recusa sem pontos, sem o pré-requisito, repetida e inexistente (DENIED)', () => {
    const play = vi.spyOn(AudioEngine.get(), 'play');
    expect(get().unlockSkill('PIL_1')).toBe(false);
    setPoints(5);
    expect(get().unlockSkill('PIL_2')).toBe(false);
    expect(get().unlockSkill('NAO_EXISTE')).toBe(false);
    expect(get().unlockSkill('PIL_1')).toBe(true);
    expect(get().unlockSkill('PIL_1')).toBe(false);
    expect(play).toHaveBeenCalledWith('DENIED');
    expect(get().player.skillPoints).toBe(4);
  });
});

describe('CareerPanel — perfil', () => {
  const profile = () => {
    fireEvent.click(screen.getByRole('tab', { name: 'Perfil' }));
  };

  it('nível, barra de XP, reputação com a faixa e as estatísticas', () => {
    act(() =>
      useGameStore.setState((s) => ({
        player: { ...s.player, level: 3, xp: 120, reputation: 55 },
        stats: {
          contractsCompleted: 2,
          photosTaken: 1234,
          flightTimeS: 125,
          crashes: 1,
          distanceTiles: 4321,
        },
      })),
    );
    profile();
    expect(screen.getByTestId('profile-level')).toHaveTextContent('3');
    expect(screen.getByTestId('profile-xp')).toHaveTextContent('120 / 520 XP');
    expect(screen.getByTestId('profile-reputation')).toHaveTextContent('55 · Respeitada');
    const stats = screen.getByTestId('profile-stats');
    expect(stats).toHaveTextContent('Contratos concluídos');
    expect(stats).toHaveTextContent('1.234');
    expect(stats).toHaveTextContent('02:05');
    expect(stats).toHaveTextContent('4.321 tiles');
  });

  it('faixas de reputação: 0–29 Desconhecida … 90–100 Lendária', () => {
    const band = (rep: number) => {
      act(() => useGameStore.setState((s) => ({ player: { ...s.player, reputation: rep } })));
      return screen.getByTestId('profile-reputation').textContent;
    };
    profile();
    expect(band(10)).toContain('Desconhecida');
    expect(band(30)).toContain('Promissora');
    expect(band(70)).toContain('Referência');
    expect(band(95)).toContain('Lendária');
  });

  it('rival MegaMap: sem roubos, o aviso; com histórico, o placar e a lista', () => {
    profile();
    expect(screen.getByTestId('profile-rival')).toHaveTextContent(
      'A MegaMap ainda não tomou nenhum contrato.',
    );
    act(() =>
      useGameStore.setState({
        rival: {
          score: 2,
          history: [
            { at: 1, contractId: 'C05', kind: 'STEAL' },
            { at: 2, contractId: 'C06', kind: 'COUNTER_OFFER' },
            { at: 3, contractId: 'R02', kind: 'STEAL' },
          ],
        },
      }),
    );
    const rival = screen.getByTestId('profile-rival');
    expect(rival).toHaveTextContent('Contratos perdidos para a MegaMap: 2');
    expect(screen.getByTestId('rival-summary')).toHaveTextContent(
      'MegaMap: 2 contratos roubados, 1 contraproposta',
    );
    expect(rival).toHaveTextContent('Contrato C05 tomado pela MegaMap');
    expect(rival).toHaveTextContent('Contraproposta em C06');
  });
});
