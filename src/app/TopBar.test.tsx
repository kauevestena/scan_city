import { act, fireEvent, render, screen } from '@testing-library/react';
import { useGameStore } from '@/state/store';
import { resetGameStore } from '@/test/resetStore';
import { TopBar } from './TopBar';

beforeEach(() => resetGameStore());

const text = (id: string) => screen.getByTestId(id).textContent?.replace(/\s/g, ' ');

describe('TopBar (REQ-UI-003)', () => {
  it('mostra saldo, nível e XP, reputação, renda do museu (0) e a dimensão', () => {
    render(<TopBar />);
    expect(
      screen.getByText((_, el) => el?.textContent?.replace(/\s/g, ' ') === 'R$ 5.000,00'),
    ).toBeInTheDocument();
    expect(text('top-bar-level')).toBe('Nív. 1');
    expect(screen.getByRole('meter', { name: 'Reputação' })).toHaveAttribute(
      'aria-valuenow',
      '0.3',
    );
    expect(text('top-bar-income')).toBe('R$ 0,00/min');
    expect(text('top-bar-dimension')).toBe('Mundo Real');
    expect(screen.getByRole('img', { name: 'GeoSurvey' })).toBeInTheDocument();
  });

  it('reage à store: XP, renda do museu (com destaque e skills) e fendas', () => {
    render(<TopBar />);
    act(() => {
      useGameStore.setState((s) => ({
        player: { ...s.player, level: 3, xp: 260 },
        skills: ['GES_1', 'GES_2'],
        museum: {
          ...s.museum,
          sectors: {
            C00: {
              contractId: 'C00',
              qualityScore: 0.8,
              mappedAt: 0,
              incomePerMinBRL: 900,
              className: 'A',
            },
          },
        },
      }));
      useGameStore.getState().setDimensionTab('RIFT');
    });
    expect(text('top-bar-level')).toBe('Nív. 3');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', String(260 / 520));
    expect(text('top-bar-income')).toBe('R$ 13,50/min');
    expect(text('top-bar-dimension')).toBe('Fendas');
  });

  it('o botão de pausa pausa o jogo', () => {
    render(<TopBar />);
    fireEvent.click(screen.getByRole('button', { name: 'Pausar' }));
    expect(useGameStore.getState().session.paused).toBe(true);
  });
});
