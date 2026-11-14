import type { StateCreator } from 'zustand';
import type { SaveGame } from '@/types';
import type { GameStore, MuseumActions } from '../types';

export function initialMuseum(now: number): SaveGame['museum'] {
  return { sectors: {}, featured: {}, lastIncomeAt: now, totalVisitors: 0 };
}

export const createMuseumSlice: StateCreator<
  GameStore,
  [],
  [],
  Pick<GameStore, 'museum'> & MuseumActions
> = (set) => ({
  museum: initialMuseum(Date.now()),

  setFeatured: (wing, contractId) =>
    set((s) => {
      const featured = { ...s.museum.featured };
      if (contractId === null) delete featured[wing];
      else if (Object.hasOwn(s.museum.sectors, contractId)) featured[wing] = contractId;
      else return s;
      return { museum: { ...s.museum, featured } };
    }),
});
