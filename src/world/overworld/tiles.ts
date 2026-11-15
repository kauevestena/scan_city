/** Tiles do mapa-múndi (world-map §5.1): legenda ASCII, passabilidade e marcadores. */
import { getVehicle, VEHICLES } from '@/data/catalog';
import { MAP_ROWS } from '@/data/overworld/map';
import { STRINGS } from '@/data/strings';
import type { TileType, VehicleId } from '@/types';

export const MAP_W = 160;
export const MAP_H = 100;

export const LEGEND: Readonly<Record<string, TileType>> = {
  '=': 'ROAD_PAVED',
  '-': 'ROAD_DIRT',
  ':': 'TRAIL',
  '.': 'GRASS',
  T: 'FOREST',
  '~': 'WATER',
  '%': 'SWAMP',
  s: 'SAND',
  '^': 'HILL',
  A: 'HILL_STEEP',
  M: 'MOUNTAIN',
  u: 'URBAN',
  '#': 'BUILDING',
  H: 'BRIDGE',
  '*': 'SNOW',
  O: 'URBAN',
  '@': 'GRASS',
  ...Object.fromEntries([...'0123456'].map((c) => [c, 'ROAD_DIRT' as const])),
  ...Object.fromEntries([...'abcdefghijk'].map((c) => [c, 'GRASS' as const])),
};

export type MarkerKind = 'CONTRACT' | 'RIFT';

export interface MapMarker {
  char: string;
  kind: MarkerKind;
  x: number;
  y: number;
}

export interface OverworldMap {
  width: number;
  height: number;
  tiles: readonly TileType[];
  chars: readonly string[];
  /** Porta da sede `O` e spawn `@`, em tiles. */
  door: { x: number; y: number };
  spawn: { x: number; y: number };
  markers: readonly MapMarker[];
}

export function parseMap(rows: readonly string[]): OverworldMap {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const tiles: TileType[] = [];
  const chars: string[] = [];
  const markers: MapMarker[] = [];
  let door = { x: 0, y: 0 };
  let spawn = { x: 0, y: 0 };
  rows.forEach((row, y) => {
    if (row.length !== width) throw new RangeError(`Linha ${y} do mapa com ${row.length} colunas`);
    [...row].forEach((char, x) => {
      const tile = LEGEND[char];
      if (!tile) throw new RangeError(`Caractere desconhecido no mapa: "${char}" em (${x}, ${y})`);
      tiles.push(tile);
      chars.push(char);
      if (char === 'O') door = { x, y };
      else if (char === '@') spawn = { x, y };
      else if (/[0-6]/.test(char)) markers.push({ char, kind: 'CONTRACT', x, y });
      else if (/[a-k]/.test(char)) markers.push({ char, kind: 'RIFT', x, y });
    });
  });
  return { width, height, tiles, chars, door, spawn, markers };
}

export const WORLD_MAP: OverworldMap = parseMap(MAP_ROWS);

/** Tile em (x, y); fora do mapa conta como montanha. */
export function tileAt(map: OverworldMap, x: number, y: number): TileType {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return 'MOUNTAIN';
  return map.tiles[ty * map.width + tx] as TileType;
}

/** Velocidade (tiles/s) do veículo no tile; `undefined` = intransponível. */
export function speedOn(tile: TileType, vehicle: VehicleId): number | undefined {
  return getVehicle(vehicle).speedTilesS[tile];
}

export function canEnter(tile: TileType, vehicle: VehicleId): boolean {
  return speedOn(tile, vehicle) !== undefined;
}

/** Veículos que passam por todos os tiles do veículo dado ("superiores em capacidade"). */
export function superiorVehicles(vehicle: VehicleId): VehicleId[] {
  const base = Object.keys(getVehicle(vehicle).speedTilesS);
  return VEHICLES.filter(
    (v) => v.id !== vehicle && base.every((t) => v.speedTilesS[t as TileType] !== undefined),
  ).map((v) => v.id);
}

/** Dica contextual quando o tile barra o veículo (world-map §5.3). */
export function blockedHint(tile: TileType, vehicle: VehicleId): string {
  const B = STRINGS.world.blocked;
  if (tile === 'HILL_STEEP') return B.HILL_STEEP;
  if (tile === 'SWAMP') return B.SWAMP;
  if (tile === 'WATER') return B.WATER;
  if (tile === 'MOUNTAIN') return B.MOUNTAIN;
  if (tile === 'BUILDING') return B.BUILDING;
  return vehicle === 'COMPACT_CAR' || vehicle === 'LAB_VAN' ? B.OFFROAD : B.MOUNTAIN;
}
