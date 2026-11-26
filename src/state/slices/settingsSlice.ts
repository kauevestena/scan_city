import type { StateCreator } from 'zustand';
import type { Settings } from '@/types';
import type { GameStore, SettingsActions } from '../types';

export function defaultSettings(): Settings {
  return {
    masterVolume: 0.8,
    sfxVolume: 0.8,
    muted: false,
    quality: 'HIGH',
    reduceFlashes: false,
    showFps: false,
    gnssNav: true,
  };
}

export const createSettingsSlice: StateCreator<
  GameStore,
  [],
  [],
  Pick<GameStore, 'settings'> & SettingsActions
> = (set) => ({
  settings: defaultSettings(),

  setSetting: (key, value) => set((s) => ({ settings: { ...s.settings, [key]: value } })),
});
