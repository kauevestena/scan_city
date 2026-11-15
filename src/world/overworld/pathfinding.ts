/** Alcance no mapa-múndi por BFS (world-map §5.1, teste obrigatório). */
import type { VehicleId } from '@/types';
import { canEnter, tileAt, type OverworldMap } from './tiles';

const NEIGHBORS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** Tiles alcançáveis a partir de `start` com o veículo (índices `y · width + x`). */
export function reachableTiles(
  map: OverworldMap,
  start: { x: number; y: number },
  vehicle: VehicleId,
): Set<number> {
  const seen = new Set<number>();
  const sx = Math.floor(start.x);
  const sy = Math.floor(start.y);
  if (!canEnter(tileAt(map, sx, sy), vehicle)) return seen;
  const queue: Array<[number, number]> = [[sx, sy]];
  seen.add(sy * map.width + sx);
  for (let head = 0; head < queue.length; head++) {
    const [x, y] = queue[head] as [number, number];
    for (const [dx, dy] of NEIGHBORS) {
      const nx = x + dx;
      const ny = y + dy;
      const key = ny * map.width + nx;
      if (seen.has(key) || !canEnter(tileAt(map, nx, ny), vehicle)) continue;
      seen.add(key);
      queue.push([nx, ny]);
    }
  }
  return seen;
}

/** "Alcançável" = chegar ao tile ou a um vizinho dele (distância ≤ 1). */
export function isReachable(
  map: OverworldMap,
  start: { x: number; y: number },
  target: { x: number; y: number },
  vehicle: VehicleId,
  reach: Set<number> = reachableTiles(map, start, vehicle),
): boolean {
  return [[0, 0], ...NEIGHBORS].some(([dx, dy]) =>
    reach.has((target.y + dy) * map.width + (target.x + dx)),
  );
}

/** Tile caminhável mais próximo para o veículo (save antigo em tile inválido). */
export function nearestWalkable(
  map: OverworldMap,
  from: { x: number; y: number },
  vehicle: VehicleId,
): { x: number; y: number } | null {
  const sx = Math.min(map.width - 1, Math.max(0, Math.floor(from.x)));
  const sy = Math.min(map.height - 1, Math.max(0, Math.floor(from.y)));
  const seen = new Set<number>([sy * map.width + sx]);
  const queue: Array<[number, number]> = [[sx, sy]];
  for (let head = 0; head < queue.length; head++) {
    const [x, y] = queue[head] as [number, number];
    if (canEnter(tileAt(map, x, y), vehicle)) return { x, y };
    for (const [dx, dy] of NEIGHBORS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
      const key = ny * map.width + nx;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push([nx, ny]);
    }
  }
  return null;
}
