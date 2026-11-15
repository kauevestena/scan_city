import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MEGAMAP } from '@/data/rival';
import { counterOfferFor, counterOfferSeed, MATCH_PRICE_FACTOR } from '@/domain/rival';
import { useGameStore } from '@/state/store';
import { resetGameStore, TEST_SEED, TEST_SEED_COUNTER_OFFER } from '@/test/resetStore';
import { BriefingModal } from './BriefingModal';
import { CounterOfferModal } from './CounterOfferModal';

const get = () => useGameStore.getState();
const CLIENT = {
  shape: 'CIRCLE',
  icon: 'Tractor',
  primary: '#84cc16',
  secondary: '#1e293b',
  initials: 'ZB',
  name: 'Seu Zé Bento',
} as const;

beforeEach(() => resetGameStore());

describe('sorteio da contraproposta (progression §8)', () => {
  const roll = (over: Partial<Parameters<typeof counterOfferFor>[0]> = {}) =>
    counterOfferFor({
      globalSeed: 1,
      contractId: 'C00',
      salt: 0,
      rivalChanceMod: 1,
      isReplay: false,
      ...over,
    });

  it('é determinístico pela seed, pelo contrato e pelo aceite; replays nunca recebem', () => {
    expect(roll({ globalSeed: TEST_SEED_COUNTER_OFFER })).toBe(true);
    expect(roll({ globalSeed: TEST_SEED_COUNTER_OFFER })).toBe(true);
    expect(roll({ globalSeed: TEST_SEED })).toBe(false);
    expect(roll({ globalSeed: TEST_SEED_COUNTER_OFFER, isReplay: true })).toBe(false);
    expect(counterOfferSeed(1, 'C00', 0)).not.toBe(counterOfferSeed(1, 'C01', 0));
    expect(counterOfferSeed(1, 'C00', 0)).not.toBe(counterOfferSeed(1, 'C00', 1));
  });

  it('a taxa é 20 % × rivalChance (GES reduz a chance)', () => {
    const rate = (mod: number) => {
      let n = 0;
      for (let seed = 0; seed < 5000; seed++)
        if (roll({ globalSeed: seed, rivalChanceMod: mod })) n++;
      return n / 5000;
    };
    expect(rate(1)).toBeGreaterThan(0.17);
    expect(rate(1)).toBeLessThan(0.23);
    expect(rate(0.5)).toBeGreaterThan(0.07);
    expect(rate(0.5)).toBeLessThan(0.13);
    expect(rate(0)).toBe(0);
  });
});

describe('CounterOfferModal', () => {
  const open = () => {
    const onResolve = vi.fn();
    render(<CounterOfferModal contractId="C00" client={CLIENT} onResolve={onResolve} />);
    return onResolve;
  };

  it('mostra o emblema da MegaMap (hexágono "MM") e a fala, com as duas opções', () => {
    open();
    const dialog = screen.getByRole('dialog', { name: 'Contraproposta da MegaMap' });
    const badge = within(dialog).getByRole('img', { name: 'MegaMap' });
    expect(badge).toHaveAttribute('data-shape', 'HEXAGON');
    expect(badge).toHaveTextContent('MM');
    expect(MEGAMAP).toMatchObject({ icon: 'Map', primary: '#e11d48', secondary: '#0f172a' });
    expect(screen.getByTestId('counter-offer-line')).toHaveTextContent(
      "A MegaMap ofereceu fazer por 30 % menos. Sem GCPs, mas 'com IA'.",
    );
    expect(within(dialog).getByRole('button', { name: 'Igualar preço' })).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: 'Apresentar portfólio técnico' }),
    ).toBeInTheDocument();
    // Não dá para dispensar: sem botão de fechar, e o Esc não resolve.
    fireEvent.keyDown(window, { code: 'Escape' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('igualar preço: fator 0,85, sem mexer na reputação, e o histórico registra', () => {
    const onResolve = open();
    const rep = get().player.reputation;
    fireEvent.click(screen.getByTestId('counter-match'));
    expect(onResolve).toHaveBeenCalledWith(MATCH_PRICE_FACTOR);
    expect(MATCH_PRICE_FACTOR).toBe(0.85);
    expect(get().player.reputation).toBe(rep);
    expect(get().rival.history).toEqual([
      { at: expect.any(Number), contractId: 'C00', kind: 'COUNTER_OFFER' },
    ]);
    // Contraproposta não é roubo: o placar da rival não sobe.
    expect(get().rival.score).toBe(0);
  });

  it('portfólio sem contrato classe A: 0,85, −2 de reputação e a fala do cliente', () => {
    const onResolve = open();
    const rep = get().player.reputation;
    fireEvent.click(screen.getByTestId('counter-portfolio'));
    expect(screen.getByTestId('counter-reply')).toHaveTextContent(
      'Bonito, mas o preço da concorrência é menor',
    );
    expect(get().player.reputation).toBe(rep - 2);
    expect(get().rival.history).toHaveLength(1);
    expect(onResolve).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('counter-proceed'));
    expect(onResolve).toHaveBeenCalledWith(0.85);
  });

  it('portfólio com um contrato concluído em classe A: o preço se mantém', () => {
    act(() =>
      useGameStore.setState((s) => ({
        contracts: {
          ...s.contracts,
          C00: { status: 'COMPLETED', completions: 1, bestScore: 0.95, bestClass: 'A' },
        },
      })),
    );
    const onResolve = open();
    const rep = get().player.reputation;
    fireEvent.click(screen.getByTestId('counter-portfolio'));
    expect(screen.getByTestId('counter-reply')).toHaveTextContent('Seu histórico fala por si');
    expect(screen.getByTestId('counter-result')).toHaveTextContent(
      'O preço do contrato foi mantido.',
    );
    expect(get().player.reputation).toBe(rep);
    fireEvent.click(screen.getByTestId('counter-proceed'));
    expect(onResolve).toHaveBeenCalledWith(1);
  });
});

describe('aceitar no briefing', () => {
  const accept = () => fireEvent.click(screen.getByTestId('briefing-accept'));

  it('sem contraproposta: aceita direto com fator 1', () => {
    act(() => get().goTo('WORLD_MAP'));
    render(<BriefingModal contractId="C00" onClose={() => undefined} />);
    accept();
    expect(screen.queryByTestId('counter-offer')).not.toBeInTheDocument();
    expect(get().session.screen).toBe('FIELD_SETUP');
    expect(get().mission.active?.rivalAdjustment).toBe(1);
  });

  it('com contraproposta: o modal aparece antes do campo; igualar leva o fator 0,85 à missão', () => {
    act(() => {
      useGameStore.setState({ createdAt: TEST_SEED_COUNTER_OFFER });
      get().goTo('WORLD_MAP');
    });
    render(<BriefingModal contractId="C00" onClose={() => undefined} />);
    accept();
    expect(screen.getByTestId('counter-offer')).toBeInTheDocument();
    expect(get().session.screen).toBe('WORLD_MAP');
    expect(get().mission.active).toBeNull();
    fireEvent.click(screen.getByTestId('counter-match'));
    expect(get().session.screen).toBe('FIELD_SETUP');
    expect(get().mission.active?.rivalAdjustment).toBe(0.85);
    expect(get().session.payload).toEqual({ contractId: 'C00', rivalAdjustment: 0.85 });
  });

  it('replay (contrato já concluído) nunca recebe contraproposta', () => {
    act(() => {
      useGameStore.setState((s) => ({
        createdAt: TEST_SEED_COUNTER_OFFER,
        contracts: { ...s.contracts, C00: { status: 'COMPLETED', completions: 1, bestScore: 0.8 } },
      }));
      get().goTo('WORLD_MAP');
    });
    render(<BriefingModal contractId="C00" onClose={() => undefined} />);
    accept();
    expect(screen.queryByTestId('counter-offer')).not.toBeInTheDocument();
    expect(get().session.screen).toBe('FIELD_SETUP');
  });
});
