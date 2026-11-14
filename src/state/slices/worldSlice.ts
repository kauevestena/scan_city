import type { StateCreator } from 'zustand';
import type { SaveGame, VehicleId } from '@/types';
import { WORLD_MAP } from '@/world/overworld/tiles';
import type { GameStore, WorldActions } from '../types';

/** Ordem do ciclo de locomoção (catalog §5). */
export const VEHICLE_ORDER: readonly VehicleId[] = [
  'FOOT_BIKE',
  'COMPACT_CAR',
  'PICKUP_4X4',
  'LAB_VAN',
];

/** Centro do tile de spawn `@` (o avatar guarda a posição contínua, em tiles). */
export const DEFAULT_SPAWN = { x: WORLD_MAP.spawn.x + 0.5, y: WORLD_MAP.spawn.y + 0.5 } as const;

/** Próximo modo do ciclo entre os veículos possuídos (volta ao primeiro depois do último). */
export function nextVehicle(owned: readonly VehicleId[], current: VehicleId): VehicleId {
  const ordered = VEHICLE_ORDER.filter((v) => owned.includes(v));
  const index = ordered.indexOf(current);
  return ordered[(index + 1) % ordered.length] ?? current;
}

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
    const next = nextVehicle(inventory.vehicles, world.vehicleMode);
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
