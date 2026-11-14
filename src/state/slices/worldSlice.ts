import type { StateCreator } from 'zustand';
import type { SaveGame, VehicleId } from '@/types';
import type { GameStore, WorldActions } from '../types';

/** Ordem do ciclo de locomoção (catalog §5). */
export const VEHICLE_ORDER: readonly VehicleId[] = [
  'FOOT_BIKE',
  'COMPACT_CAR',
  'PICKUP_4X4',
  'LAB_VAN',
];

/** Centro do mapa 160 × 100; T021 troca pelo tile de spawn `@`. */
export const DEFAULT_SPAWN = { x: 80, y: 50 } as const;

export function initialWorld(): SaveGame['world'] {
  return {
    avatar: { ...DEFAULT_SPAWN, facing: 'S' },
    vehicleMode: 'FOOT_BIKE',
    dimensionTab: 'REAL',
    discoveredRifts: [],
    lastEventAt: 0,
  };
}

export const createWorldSlice: StateCreator<
  GameStore,
  [],
  [],
  Pick<GameStore, 'world'> & WorldActions
> = (set, get) => ({
  world: initialWorld(),

  setAvatar: (avatar) =>
    set((s) => ({ world: { ...s.world, avatar: { ...s.world.avatar, ...avatar } } })),

  cycleVehicle: () => {
    const { inventory, world } = get();
    const owned = VEHICLE_ORDER.filter((v) => inventory.vehicles.includes(v));
    const index = owned.indexOf(world.vehicleMode);
    const next = owned[(index + 1) % owned.length] ?? world.vehicleMode;
    if (next !== world.vehicleMode) set((s) => ({ world: { ...s.world, vehicleMode: next } }));
    return next;
  },

  setDimensionTab: (tab) => set((s) => ({ world: { ...s.world, dimensionTab: tab } })),

  discoverRift: (contractId) =>
    set((s) =>
      s.world.discoveredRifts.includes(contractId)
        ? s
        : { world: { ...s.world, discoveredRifts: [...s.world.discoveredRifts, contractId] } },
    ),
});
