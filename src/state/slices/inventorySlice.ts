import type { StateCreator } from 'zustand';
import { AudioEngine } from '@/audio/AudioEngine';
import { ATLAS_RULES } from '@/data/catalog';
import { STRINGS } from '@/data/strings';
import { sanitizeInitials } from '@/domain/emblem';
import { feedCrop } from '@/domain/sorties';
import { addItems, canBuy, purchaseItems, shopItem, shopPrice } from '@/domain/economy';
import { unlockStateFrom } from '@/domain/progression';
import { selectModifiers } from '../selectors';
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
> = (set, get) => ({
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

  buyItem: (id) => {
    const state = get();
    const item = shopItem(id);
    const mod = selectModifiers(state).shopPrice;
    const check = canBuy(item, {
      money: state.player.money,
      inventory: state.inventory,
      unlock: unlockStateFrom(state),
      shopPriceMod: mod,
    });
    if (!check.ok) {
      AudioEngine.get().play('DENIED');
      get().pushToast({ type: 'error', title: check.reason ?? STRINGS.shop.cannotBuy });
      return false;
    }
    const gained = purchaseItems(id, state.inventory);
    // O saldo já foi conferido por `canBuy`; `spend` registra a transação.
    if (!get().spend(shopPrice(item.priceBRL, mod), STRINGS.shop.purchase(item.name))) return false;
    set((s) => ({ inventory: addItems(s.inventory, gained) }));
    AudioEngine.get().play('CASH_REGISTER');
    get().pushToast({ type: 'money', title: STRINGS.shop.bought(item.name) });
    // Possuir itens é condição de alguns contratos (progression §12).
    get().refreshUnlocks();
    return true;
  },

  buyCorn: (pack) => {
    if (!(ATLAS_RULES.cornPacks as readonly number[]).includes(pack)) return false;
    if (!get().spend(ATLAS_RULES.cornPriceBRL * pack, STRINGS.perch.cornReason(pack))) return false;
    get().addCorn(pack);
    AudioEngine.get().play('CASH_REGISTER');
    return true;
  },

  feedAtlas: () => {
    const { corn } = get().inventory;
    const fed = feedCrop(corn);
    const moved = fed.crop - corn.crop;
    if (moved <= 0) return 0;
    set((s) => ({ inventory: { ...s.inventory, corn: fed } }));
    AudioEngine.get().play('PIGEON_COO');
    return moved;
  },

  calibrateAtlas: () => {
    set((s) => ({
      inventory: { ...s.inventory, atlasCalibrationFlights: ATLAS_RULES.calibrationFlights },
    }));
    get().pushToast({
      type: 'success',
      title: STRINGS.perch.calibrated(ATLAS_RULES.calibrationFlights),
    });
  },

  setEmblem: (emblem) =>
    set((s) => ({
      inventory: {
        ...s.inventory,
        // Sigla inválida (vazia) mantém a anterior: o emblema nunca fica sem sigla.
        emblem: {
          ...emblem,
          initials: sanitizeInitials(emblem.initials) || s.inventory.emblem.initials,
        },
      },
    })),

  addCorn: (amount) =>
    set((s) => ({
      inventory: {
        ...s.inventory,
        corn: { ...s.inventory.corn, stock: Math.max(0, s.inventory.corn.stock + amount) },
      },
    })),
});
