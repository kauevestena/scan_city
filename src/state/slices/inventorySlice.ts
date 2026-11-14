import type { StateCreator } from 'zustand';
import type { Emblem, SaveGame } from '@/types';
import { COLORS } from '@/ui/tokens';
import type { GameStore, InventoryActions } from '../types';

/** catalog §10 */
export const DEFAULT_EMBLEM: Emblem = {
  shape: 'SHIELD',
  icon: 'Compass',
  primary: COLORS.radar,
  secondary: COLORS.bgPanel,
  initials: 'GS',
};

/** progression §3 */
export function initialInventory(): SaveGame['inventory'] {
  return {
    aircraft: ['ATLAS'],
    sensors: ['CAM_PIGEON'],
    lenses: [],
    payloads: [],
    vehicles: ['FOOT_BIKE'],
    fieldEquipment: ['TOTAL_STATION'],
    hardware: 'OLD_LAPTOP',
    cosmetics: ['CHAR_VEST', 'PAINT_GREY', 'ATLAS_NONE'],
    equipped: { character: 'CHAR_VEST', dronePaint: 'PAINT_GREY', atlasAccessory: 'ATLAS_NONE' },
    emblem: { ...DEFAULT_EMBLEM },
    corn: { stock: 20, crop: 10 },
    atlasCalibrationFlights: 0,
  };
}

export const createInventorySlice: StateCreator<
  GameStore,
  [],
  [],
  Pick<GameStore, 'inventory'> & InventoryActions
> = (set) => ({
  inventory: initialInventory(),

  equip: (slot, cosmeticId) =>
    set((s) =>
      s.inventory.cosmetics.includes(cosmeticId)
        ? {
            inventory: {
              ...s.inventory,
              equipped: { ...s.inventory.equipped, [slot]: cosmeticId },
            },
          }
        : s,
    ),

  setEmblem: (emblem) =>
    set((s) => ({
      inventory: {
        ...s.inventory,
        emblem: { ...emblem, initials: emblem.initials.toUpperCase().slice(0, 4) },
      },
    })),
});
