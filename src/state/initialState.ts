import type { SaveGame } from '@/types';
import { SAVE_VERSION } from './migrations';
import { initialInventory } from './slices/inventorySlice';
import { initialMuseum } from './slices/museumSlice';
import { initialFlags, initialPlayer, initialStaff, initialStats } from './slices/playerSlice';
import { initialRival } from './slices/rivalSlice';
import { initialWorld } from './slices/worldSlice';
import type { GameData } from './types';

/** Estado de um jogo novo (progression §3). */
export function createNewGame(now: number = Date.now()): SaveGame {
  return {
    version: SAVE_VERSION,
    createdAt: now,
    updatedAt: now,
    player: initialPlayer(),
    skills: [],
    staff: initialStaff(),
    inventory: initialInventory(),
    contracts: {},
    museum: initialMuseum(now),
    souvenirs: [],
    pendingMissions: [],
    world: initialWorld(),
    rival: initialRival(),
    stats: initialStats(),
    flags: initialFlags(),
  };
}

type PersistedData = Omit<GameData, 'session' | 'settings'>;

/** Parte da store que vem do save. A missão ativa (em voo) nunca é persistida. */
export function gameDataFromSave(save: SaveGame): PersistedData {
  return {
    createdAt: save.createdAt,
    player: save.player,
    skills: save.skills,
    staff: save.staff,
    inventory: save.inventory,
    contracts: save.contracts,
    mission: { active: null, pending: save.pendingMissions },
    museum: save.museum,
    souvenirs: save.souvenirs,
    world: save.world,
    rival: save.rival,
    stats: save.stats,
    flags: save.flags,
  };
}

/** Recorte persistido da store, no formato `SaveGame`. */
export function saveFromGameData(state: PersistedData, now: number = Date.now()): SaveGame {
  return {
    version: SAVE_VERSION,
    createdAt: state.createdAt,
    updatedAt: now,
    player: state.player,
    skills: state.skills,
    staff: state.staff,
    inventory: state.inventory,
    contracts: state.contracts,
    museum: state.museum,
    souvenirs: state.souvenirs,
    pendingMissions: state.mission.pending,
    world: state.world,
    rival: state.rival,
    stats: state.stats,
    flags: state.flags,
  };
}
