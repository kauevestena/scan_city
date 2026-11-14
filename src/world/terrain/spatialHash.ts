/** Hash espacial de objetos (terrain §2: células de 16 m) para consultas de superfície. */
import type { WorldObject } from '@/types';

export const SPATIAL_CELL_M = 16;

export interface SpatialHash {
  /** Objetos cuja caixa envolvente pode conter (u, v). */
  near(u: number, v: number): readonly WorldObject[];
}

/** Raio da caixa envolvente do objeto no plano (considera a rotação). */
export function objectReach(o: WorldObject): number {
  if (o.kind === 'WIRE' && o.u2 !== undefined && o.v2 !== undefined) {
    return Math.hypot(o.u2 - o.u, o.v2 - o.v) / 2 + 1;
  }
  return Math.hypot(o.widthM, o.depthM) / 2;
}

export function createSpatialHash(
  objects: readonly WorldObject[],
  cellM = SPATIAL_CELL_M,
): SpatialHash {
  const cells = new Map<string, WorldObject[]>();
  const key = (cx: number, cy: number) => `${cx},${cy}`;
  for (const o of objects) {
    const reach = objectReach(o);
    const cu = o.kind === 'WIRE' && o.u2 !== undefined ? (o.u + o.u2) / 2 : o.u;
    const cv = o.kind === 'WIRE' && o.v2 !== undefined ? (o.v + o.v2) / 2 : o.v;
    for (let cx = Math.floor((cu - reach) / cellM); cx <= Math.floor((cu + reach) / cellM); cx++) {
      for (
        let cy = Math.floor((cv - reach) / cellM);
        cy <= Math.floor((cv + reach) / cellM);
        cy++
      ) {
        const k = key(cx, cy);
        const list = cells.get(k);
        if (list) list.push(o);
        else cells.set(k, [o]);
      }
    }
  }
  const empty: readonly WorldObject[] = [];
  return {
    near: (u, v) => cells.get(key(Math.floor(u / cellM), Math.floor(v / cellM))) ?? empty,
  };
}
