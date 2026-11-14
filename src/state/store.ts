import { create } from 'zustand';
import { createContractsSlice } from './slices/contractsSlice';
import { createInventorySlice } from './slices/inventorySlice';
import { createMissionSlice } from './slices/missionSlice';
import { createMuseumSlice } from './slices/museumSlice';
import { createPlayerSlice } from './slices/playerSlice';
import { createRivalSlice } from './slices/rivalSlice';
import { createSessionSlice } from './slices/sessionSlice';
import { createSettingsSlice } from './slices/settingsSlice';
import { createWorldSlice } from './slices/worldSlice';
import type { GameStore } from './types';

/**
 * Store única do jogo (architecture §3). Os engines usam `useGameStore.getState()`
 * e despacham ações só em eventos discretos.
 */
export const useGameStore = create<GameStore>()((...a) => ({
  createdAt: Date.now(),
  ...createSessionSlice(...a),
  ...createPlayerSlice(...a),
  ...createInventorySlice(...a),
  ...createContractsSlice(...a),
  ...createMissionSlice(...a),
  ...createMuseumSlice(...a),
  ...createWorldSlice(...a),
  ...createRivalSlice(...a),
  ...createSettingsSlice(...a),
}));
