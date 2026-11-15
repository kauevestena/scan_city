import type { StateCreator } from 'zustand';
import { STRINGS } from '@/data/strings';
import { accrueIncome, MAX_OFFLINE_MS, offlineIncome, visitorsPerHour } from '@/domain/museum';
import { formatBRL } from '@/lib/format';
import type { SaveGame } from '@/types';
import { selectMuseumIncome } from '../selectors';
import type { GameStore, MuseumActions } from '../types';

export function initialMuseum(now: number): SaveGame['museum'] {
  return { sectors: {}, featured: {}, lastIncomeAt: now, totalVisitors: 0 };
}

export const createMuseumSlice: StateCreator<
  GameStore,
  [],
  [],
  Pick<GameStore, 'museum'> & MuseumActions
> = (set, get) => ({
  museum: initialMuseum(Date.now()),

  setFeatured: (wing, contractId) =>
    set((s) => {
      const featured = { ...s.museum.featured };
      if (contractId === null) delete featured[wing];
      else if (Object.hasOwn(s.museum.sectors, contractId)) featured[wing] = contractId;
      else return s;
      return { museum: { ...s.museum, featured } };
    }),

  tickIncome: (nowMs) => {
    const state = get();
    const elapsedMs = Math.max(0, nowMs - state.museum.lastIncomeAt);
    const perMin = selectMuseumIncome(state);
    const { creditedCents, carryCents, visitors } = accrueIncome(
      perMin,
      elapsedMs,
      state.session.incomeCarryCents,
    );
    // Sem transação nem toast: a renda pinga a cada 10 s e só aparece no saldo.
    set((s) => ({
      player: { ...s.player, money: s.player.money + creditedCents },
      museum: {
        ...s.museum,
        lastIncomeAt: nowMs,
        totalVisitors: s.museum.totalVisitors + visitors,
      },
      session: { ...s.session, incomeCarryCents: carryCents },
    }));
    return creditedCents;
  },

  syncIncomeClock: (nowMs) => set((s) => ({ museum: { ...s.museum, lastIncomeAt: nowMs } })),

  applyOfflineIncome: (nowMs) => {
    const state = get();
    const elapsedMs = Math.max(0, nowMs - state.museum.lastIncomeAt);
    const perMin = selectMuseumIncome(state);
    const credited = offlineIncome(perMin, elapsedMs);
    const hours = Math.min(elapsedMs, MAX_OFFLINE_MS) / 3_600_000;
    set((s) => ({
      museum: {
        ...s.museum,
        lastIncomeAt: nowMs,
        totalVisitors: s.museum.totalVisitors + visitorsPerHour(perMin) * hours,
      },
    }));
    if (credited > 0) {
      get().earn(credited, STRINGS.museum.incomeReason);
      get().pushToast({ type: 'money', title: STRINGS.museum.offline(formatBRL(credited)) });
    }
    return credited;
  },
});
