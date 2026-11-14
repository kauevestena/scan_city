/** Eventos de campo no mapa-múndi — domain-math §13, catalog §12. */
import { WHEELED_VEHICLES } from '@/data/catalog';
import type { Rng } from '@/lib/rng';
import type { TileType, VehicleId } from '@/types';

export type FieldEventId =
  | 'FLAT_TIRE'
  | 'CATTLE'
  | 'LOST_BENCHMARK'
  | 'SUSPICIOUS_OWNER'
  | 'SUDDEN_RAIN'
  | 'ATLAS_FINDS_CORN';

/** Pesos do sorteio; os dois primeiros só com veículo de rodas. */
export const FIELD_EVENT_WEIGHTS: Readonly<Record<FieldEventId, number>> = {
  FLAT_TIRE: 2,
  CATTLE: 2,
  LOST_BENCHMARK: 2,
  SUSPICIOUS_OWNER: 2,
  SUDDEN_RAIN: 1,
  ATLAS_FINDS_CORN: 1,
};

export const EVENT_TILES: ReadonlySet<TileType> = new Set([
  'ROAD_DIRT',
  'TRAIL',
  'GRASS',
  'HILL',
  'SWAMP',
  'SAND',
]);
export const EVENT_CHANCE_PER_TILE = 0.015;
export const EVENT_COOLDOWN_S = 20;

const WHEEL_ONLY: ReadonlySet<FieldEventId> = new Set(['FLAT_TIRE', 'CATTLE']);

/** Sorteio a cada tile percorrido: só em certos tiles, com 20 s de intervalo mínimo. */
export function rollFieldEvent(
  rng: Rng,
  tile: TileType,
  vehicle: VehicleId,
  nowS: number,
  lastEventS: number,
): FieldEventId | null {
  if (!EVENT_TILES.has(tile)) return null;
  if (nowS - lastEventS < EVENT_COOLDOWN_S) return null;
  if (rng.next() >= EVENT_CHANCE_PER_TILE) return null;
  const wheeled = (WHEELED_VEHICLES as readonly string[]).includes(vehicle);
  const pool = (Object.keys(FIELD_EVENT_WEIGHTS) as FieldEventId[]).filter(
    (id) => wheeled || !WHEEL_ONLY.has(id),
  );
  const total = pool.reduce((s, id) => s + FIELD_EVENT_WEIGHTS[id], 0);
  let pick = rng.next() * total;
  for (const id of pool) {
    pick -= FIELD_EVENT_WEIGHTS[id];
    if (pick < 0) return id;
  }
  return pool[pool.length - 1] as FieldEventId;
}
