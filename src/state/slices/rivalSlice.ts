import type { StateCreator } from 'zustand';
import type { SaveGame } from '@/types';
import type { GameStore, RivalActions } from '../types';

export function initialRival(): SaveGame['rival'] {
  return { score: 0, history: [] };
}

export const createRivalSlice: StateCreator<
  GameStore,
  [],
  [],
  Pick<GameStore, 'rival'> & RivalActions
> = (set, get) => ({
  rival: initialRival(),

  steal: (contractId) => {
    if (!get().contracts[contractId]) return;
    get().markStolen(contractId);
    set((s) => ({
      rival: {
        score: s.rival.score + 1,
        history: [...s.rival.history, { at: Date.now(), contractId, kind: 'STEAL' }],
      },
    }));
  },
});
