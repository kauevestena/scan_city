import type { StateCreator } from 'zustand';
import { AudioEngine } from '@/audio/AudioEngine';
import { CONTRACTS, initialContracts } from '@/data/contracts';
import { STRINGS } from '@/data/strings';
import { evaluateUnlock, unlockStateFrom } from '@/domain/progression';
import type { ContractProgress } from '@/types';
import type { ContractsActions, GameStore } from '../types';

const LOCKED: ContractProgress = { status: 'LOCKED', completions: 0, bestScore: 0 };

export const createContractsSlice: StateCreator<
  GameStore,
  [],
  [],
  Pick<GameStore, 'contracts'> & ContractsActions
> = (set, get) => ({
  contracts: initialContracts(),

  refreshUnlocks: (options = {}) => {
    const state = get();
    const unlock = unlockStateFrom(state);
    const contracts = { ...state.contracts };
    const unlocked: string[] = [];
    for (const contract of CONTRACTS) {
      // Contratos novos no catálogo (save de uma versão anterior) entram bloqueados.
      const progress = contracts[contract.id] ?? LOCKED;
      contracts[contract.id] = progress;
      if (progress.status !== 'LOCKED' || !evaluateUnlock(contract.unlock, unlock)) continue;
      contracts[contract.id] = { ...progress, status: 'AVAILABLE' };
      unlocked.push(contract.id);
    }
    set({ contracts });

    let riftsOpened = false;
    for (const id of unlocked) {
      const contract = CONTRACTS.find((c) => c.id === id);
      if (!contract) continue;
      const rift = contract.dimension === 'RIFT';
      if (rift) get().discoverRift(id);
      if (options.silent) continue;
      // Uma abertura por vez: duas fendas liberadas juntas tocam `RIFT_OPEN` uma só vez.
      if (rift && !riftsOpened) {
        AudioEngine.get().play('RIFT_OPEN');
        riftsOpened = true;
      }
      get().pushToast({
        type: rift ? 'rift' : 'info',
        title: rift
          ? STRINGS.contracts.riftDetected(contract.title)
          : STRINGS.contracts.newContract(contract.title),
      });
    }
    return unlocked;
  },

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
