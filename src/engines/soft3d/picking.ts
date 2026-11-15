/** Picking de setores (holo-table §5.1): o topo projetado mais próximo sob o cursor. */
import { projectPoint, type Mat4 } from './mat4';
import type { Vec3 } from './vec3';

export interface PickTarget {
  id: string;
  /** Cantos do topo, no mundo, em ordem. */
  corners: readonly Vec3[];
}

function inPolygon(x: number, y: number, poly: ReadonlyArray<{ x: number; y: number }>): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i] as { x: number; y: number };
    const b = poly[j] as { x: number; y: number };
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Setor cujo topo projetado contém (xs, ys); entre vários, o mais próximo da câmera. */
export function pickSector(
  xs: number,
  ys: number,
  targets: readonly PickTarget[],
  m: Mat4,
  width: number,
  height: number,
): string | null {
  let best: string | null = null;
  let bestW = Infinity;
  for (const t of targets) {
    const pts = t.corners.map((c) => projectPoint(m, c[0], c[1], c[2], width, height));
    if (pts.some((p) => p.w <= 0)) continue;
    if (!inPolygon(xs, ys, pts)) continue;
    const w = pts.reduce((s, p) => s + p.w, 0) / pts.length;
    if (w < bestW) {
      bestW = w;
      best = t.id;
    }
  }
  return best;
}
