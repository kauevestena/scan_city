import type { StateCreator } from 'zustand';
import type { ContractsActions, GameStore } from '../types';

export const createContractsSlice: StateCreator<
  GameStore,
  [],
  [],
  Pick<GameStore, 'contracts'> & ContractsActions
> = (set) => ({
  contracts: {},

  markStolen: (contractId) =>
    set((s) => {
      const progress = s.contracts[contractId];
      if (!progress) return s;
      return {
        contracts: {
          ...s.contracts,
          [contractId]: {
            ...progress,
            status: 'STOLEN',
            stolenAtCompletionCount: s.stats.contractsCompleted,
          },
        },
      };
    }),
});
