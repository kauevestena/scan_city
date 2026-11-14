import { create } from 'zustand';
import { persist, type PersistStorage } from 'zustand/middleware';
import { STRINGS } from '@/data/strings';
import type { SaveGame } from '@/types';
import { createNewGame, gameDataFromSave, saveFromGameData } from './initialState';
import { SAVE_VERSION } from './migrations';
import {
  backupSave,
  loadSave,
  loadSettings,
  SAVE_KEY,
  writeSave,
  writeSettings,
  type LoadResult,
} from './persistence';
import { createContractsSlice } from './slices/contractsSlice';
import { createInventorySlice } from './slices/inventorySlice';
import { createMissionSlice } from './slices/missionSlice';
import { createMuseumSlice } from './slices/museumSlice';
import { createPlayerSlice } from './slices/playerSlice';
import { createRivalSlice } from './slices/rivalSlice';
import { createSessionSlice, initialSession } from './slices/sessionSlice';
import { createSettingsSlice } from './slices/settingsSlice';
import { createWorldSlice } from './slices/worldSlice';
import type { GameStore } from './types';

/**
 * Armazenamento do `persist`. A store muda muitas vezes por segundo, mas o save só vai
 * para o `localStorage` nos momentos de autosave (architecture §6): `setItem` apenas
 * guarda o último recorte, e `flushSave()` grava.
 */
let pendingSave: SaveGame | null = null;
let lastLoad: LoadResult = { status: 'EMPTY' };
let saveFailed = false;

const bufferedStorage: PersistStorage<SaveGame> = {
  getItem: () => {
    lastLoad = loadSave();
    return lastLoad.status === 'OK' ? { state: lastLoad.save, version: SAVE_VERSION } : null;
  },
  setItem: (_name, value) => {
    pendingSave = value.state;
  },
  removeItem: () => {
    pendingSave = null;
    localStorage.removeItem(SAVE_KEY);
  },
};

/**
 * Store única do jogo (architecture §3). Os engines usam `useGameStore.getState()`
 * e despacham ações só em eventos discretos.
 */
export const useGameStore = create<GameStore>()(
  persist(
    (...a) => ({
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
    }),
    {
      name: SAVE_KEY,
      version: SAVE_VERSION,
      storage: bufferedStorage,
      partialize: (state) => saveFromGameData(state),
      merge: (persisted, current) => ({ ...current, ...gameDataFromSave(persisted as SaveGame) }),
      // A hidratação é pedida explicitamente no boot (`hydrateGame`).
      skipHydration: true,
    },
  ),
);

/** Grava no `localStorage` o estado mais recente, se houver mudança pendente. */
export function flushSave(): boolean {
  if (pendingSave === null) return true;
  const ok = writeSave({ ...pendingSave, updatedAt: Date.now() });
  if (ok) {
    pendingSave = null;
    saveFailed = false;
  } else if (!saveFailed) {
    // Avisa uma vez por sequência de falhas, para não empilhar toasts a cada autosave.
    saveFailed = true;
    useGameStore.getState().pushToast({
      type: 'error',
      title: STRINGS.save.writeFailedTitle,
      body: STRINGS.save.writeFailedBody,
    });
  }
  return ok;
}

/**
 * Carrega o save e as configurações. Um save inválido já foi movido para o backup por
 * `loadSave`; aqui o jogo recomeça do estado inicial e avisa o jogador (REQ-CORE-005).
 */
export function hydrateGame(): LoadResult {
  void useGameStore.persist.rehydrate();
  useGameStore.setState({ settings: loadSettings() });
  // Contratos acrescentados ao catálogo depois do save entram e, se for o caso, já liberados.
  useGameStore.getState().refreshUnlocks({ silent: true });
  pendingSave = null;
  if (lastLoad.status === 'INVALID') {
    useGameStore.getState().pushToast({
      type: 'warn',
      title: STRINGS.save.invalidTitle,
      body: STRINGS.save.invalidBody,
    });
  }
  return lastLoad;
}

/**
 * Novo jogo (progression §13): guarda o save atual no backup, volta ao estado inicial e
 * força a máquina de telas para `OFFICE`. As configurações são preservadas.
 */
export function newGame(): void {
  flushSave();
  backupSave();
  useGameStore.setState((s) => ({
    ...gameDataFromSave(createNewGame()),
    session: { ...initialSession(), toasts: s.session.toasts },
  }));
  flushSave();
}

/** Persiste as configurações na chave própria. */
export function saveSettings(): boolean {
  return writeSettings(useGameStore.getState().settings);
}
