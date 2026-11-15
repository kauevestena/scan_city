import { resetGameStore } from '@/test/resetStore';
import type { MuseumSector } from '@/types';
import { MUSEUM_TICK_S, startMuseumIncome } from './museumIncome';
import { flushSave, hydrateGame, useGameStore } from './store';

const get = () => useGameStore.getState();
const sector = (
  contractId: string,
  incomePerMinBRL: number,
  qualityScore: number,
): MuseumSector => ({
  contractId,
  qualityScore,
  mappedAt: 0,
  incomePerMinBRL,
  className: 'A',
});
/** C00 (score 0,8) rende R$ 9,00/min e C01 (score 1,0), R$ 40,00/min (critério 5). */
function seedMuseum(
  lastIncomeAt: number,
  sectors = { C00: sector('C00', 900, 0.8), C01: sector('C01', 4000, 1) },
) {
  useGameStore.setState((s) => ({ museum: { ...s.museum, sectors, lastIncomeAt, featured: {} } }));
}

beforeEach(() => resetGameStore());

describe('tickIncome (progression §10)', () => {
  it('critério 5: C00 (0,8) e C01 (1,0), sem destaque → em 1 min, R$ 9,00 + R$ 40,00 = R$ 49,00', () => {
    seedMuseum(1_000_000);
    const money = get().player.money;
    expect(get().tickIncome(1_000_000 + 60_000)).toBe(4900);
    expect(get().player.money).toBe(money + 4900);
    expect(get().museum.lastIncomeAt).toBe(1_060_000);
  });

  it('em ticks de 10 s, o minuto inteiro soma os mesmos R$ 49,00 (as frações se acumulam)', () => {
    seedMuseum(0);
    const money = get().player.money;
    let credited = 0;
    for (let t = 10_000; t <= 60_000; t += 10_000) credited += get().tickIncome(t);
    expect(credited).toBe(4900);
    expect(get().player.money).toBe(money + 4900);
    // 4900/6 = 816,67 por tick: as frações ficaram no carry entre os ticks.
    expect(get().session.incomeCarryCents).toBeCloseTo(0, 6);
  });

  it('frações de centavo não se perdem: R$ 0,10/min rende 1 centavo a cada 6 s', () => {
    seedMuseum(0, { C00: sector('C00', 10, 1) } as never);
    expect(get().tickIncome(3_000)).toBe(0);
    expect(get().session.incomeCarryCents).toBeCloseTo(0.5, 9);
    expect(get().tickIncome(6_000)).toBe(1);
  });

  it('destaque dobra a renda do setor; visitantes = renda (R$/min) · 6 por hora', () => {
    seedMuseum(0);
    useGameStore.setState((s) => ({ museum: { ...s.museum, featured: { REAL: 'C00' } } }));
    expect(get().tickIncome(60_000)).toBe(900 * 2 + 4000);
    // (18 + 40) R$/min · 6 = 348 visitantes/h → 5,8 em 1 min.
    expect(get().museum.totalVisitors).toBeCloseTo(5.8, 6);
  });

  it('não gera transação nem toast; museu vazio não rende', () => {
    seedMuseum(0);
    get().tickIncome(60_000);
    expect(get().session.transactions).toEqual([]);
    expect(get().session.toasts).toEqual([]);
    resetGameStore();
    const money = get().player.money;
    expect(get().tickIncome(Date.now() + 600_000)).toBe(0);
    expect(get().player.money).toBe(money);
  });

  it('relógio para trás não desconta nada', () => {
    seedMuseum(100_000);
    expect(get().tickIncome(50_000)).toBe(0);
  });
});

describe('startMuseumIncome — a cada 10 s de jogo não pausado', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('credita a cada 10 s; pausado, o tempo não rende', () => {
    let clock = 0;
    seedMuseum(0);
    const stop = startMuseumIncome(window, () => clock);
    const money = get().player.money;
    const advance = (s: number) => {
      for (let i = 0; i < s; i++) {
        clock += 1000;
        vi.advanceTimersByTime(1000);
      }
    };
    expect(MUSEUM_TICK_S).toBe(10);
    advance(9);
    expect(get().player.money).toBe(money);
    advance(1);
    // 10 s de R$ 49,00/min = R$ 8,16 (o resto fica no carry).
    expect(get().player.money).toBe(money + 816);

    // Pausa de 5 minutos: só o que correu até a pausa é creditado.
    advance(4);
    get().setPaused(true);
    advance(300);
    const paused = get().player.money;
    // Os 4 s antes da pausa + 1 s até o tick que a percebe.
    expect(paused - (money + 816)).toBeLessThanOrEqual(Math.ceil((4900 * 6) / 60));
    advance(60);
    expect(get().player.money).toBe(paused);

    // De volta: mais 10 s, mais ~R$ 8,16.
    get().setPaused(false);
    advance(11);
    expect(get().player.money - paused).toBeGreaterThanOrEqual(816);
    expect(get().player.money - paused).toBeLessThanOrEqual(900);
    stop();
    const after = get().player.money;
    advance(30);
    expect(get().player.money).toBe(after);
  });
});

describe('renda offline (ao carregar o save)', () => {
  const reload = () => {
    useGameStore.setState(useGameStore.getInitialState(), true);
    return hydrateGame();
  };

  it('30 min fora: credita 30 × R$ 49,00, com o toast', () => {
    const now = Date.now();
    seedMuseum(now - 30 * 60_000);
    const money = get().player.money;
    expect(get().applyOfflineIncome(now)).toBe(30 * 4900);
    expect(get().player.money).toBe(money + 30 * 4900);
    expect(get().session.toasts.at(-1)?.title).toMatch(
      /^Enquanto você esteve fora, o Museu rendeu R\$\s1\.470,00$/,
    );
    expect(get().museum.lastIncomeAt).toBe(now);
    // Aplicar de novo na mesma hora não credita outra vez.
    expect(get().applyOfflineIncome(now)).toBe(0);
  });

  it('no máximo 2 h, mesmo depois de dias fora', () => {
    const now = Date.now();
    seedMuseum(now - 3 * 24 * 3_600_000);
    expect(get().applyOfflineIncome(now)).toBe(120 * 4900);
  });

  it('museu vazio ou nenhum tempo fora: sem crédito e sem toast', () => {
    expect(get().applyOfflineIncome(Date.now() + 3_600_000)).toBe(0);
    expect(get().session.toasts).toEqual([]);
  });

  it('hydrateGame aplica a renda offline do save carregado', () => {
    seedMuseum(Date.now() - 10 * 60_000);
    get().earn(1, 'força o save');
    flushSave();
    const money = get().player.money;
    expect(reload().status).toBe('OK');
    // ~10 min a R$ 49,00/min (o relógio anda alguns ms entre o save e o load).
    expect(get().player.money - money).toBeGreaterThanOrEqual(10 * 4900);
    expect(get().player.money - money).toBeLessThan(10 * 4900 + 100);
    expect(get().session.toasts.some((t) => t.title.startsWith('Enquanto você esteve fora'))).toBe(
      true,
    );
  });

  it('jogo novo (sem save) não mostra toast de renda', () => {
    expect(reload().status).toBe('EMPTY');
    expect(get().session.toasts).toEqual([]);
  });
});
