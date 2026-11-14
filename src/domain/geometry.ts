/** Geometria plana no frame da AOI — domain-math §6.6. */
import type { AoiPoint, Contract } from '@/types';

const cross = (o: AoiPoint, a: AoiPoint, b: AoiPoint) =>
  (a.u - o.u) * (b.v - o.v) - (a.v - o.v) * (b.u - o.u);

/** Casco convexo por monotone chain, anti-horário, sem vértices colineares. */
export function convexHull(points: readonly AoiPoint[]): AoiPoint[] {
  const sorted = [...points]
    .sort((a, b) => a.u - b.u || a.v - b.v)
    .filter((p, i, all) => i === 0 || p.u !== all[i - 1]?.u || p.v !== all[i - 1]?.v);
  if (sorted.length < 3) return sorted;

  const half = (pts: AoiPoint[]): AoiPoint[] => {
    const chain: AoiPoint[] = [];
    for (const p of pts) {
      while (
        chain.length >= 2 &&
        cross(chain[chain.length - 2] as AoiPoint, chain[chain.length - 1] as AoiPoint, p) <= 0
      ) {
        chain.pop();
      }
      chain.push(p);
    }
    chain.pop();
    return chain;
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

/** Área (sempre positiva) pela fórmula do laço. */
export function polygonArea(poly: readonly AoiPoint[]): number {
  if (poly.length < 3) return 0;
  let twice = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i] as AoiPoint;
    const b = poly[(i + 1) % poly.length] as AoiPoint;
    twice += a.u * b.v - b.u * a.v;
  }
  return Math.abs(twice) / 2;
}

/** Fração da AOI coberta pelo casco convexo dos pontos (0..1). */
export function hullCoverage(points: readonly AoiPoint[], aoi: Contract['aoi']): number {
  return Math.min(1, polygonArea(convexHull(points)) / (aoi.widthM * aoi.lengthM));
}

/**
 * λmin/λmax da matriz de covariância 2×2 dos pontos: 0 = colineares, 1 = espalhados
 * igualmente em todas as direções. Com menos de 3 pontos (ou todos iguais), 0.
 */
export function collinearityIndex(points: readonly AoiPoint[]): number {
  const n = points.length;
  if (n < 3) return 0;
  let mu = 0;
  let mv = 0;
  for (const p of points) {
    mu += p.u;
    mv += p.v;
  }
  mu /= n;
  mv /= n;
  let suu = 0;
  let svv = 0;
  let suv = 0;
  for (const p of points) {
    suu += (p.u - mu) ** 2;
    svv += (p.v - mv) ** 2;
    suv += (p.u - mu) * (p.v - mv);
  }
  const trace = (suu + svv) / n;
  const det = (suu * svv - suv * suv) / (n * n);
  const disc = Math.sqrt(Math.max(0, (trace * trace) / 4 - det));
  const max = trace / 2 + disc;
  const min = trace / 2 - disc;
  return max > 0 ? Math.max(0, min) / max : 0;
}

/** Ponto dentro do polígono (ray casting); `inclusive` conta a borda como dentro. */
export function pointInPolygon(p: AoiPoint, poly: readonly AoiPoint[], inclusive = false): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i] as AoiPoint;
    const b = poly[j] as AoiPoint;
    if (inclusive) {
      const onSegment =
        Math.abs(cross(a, b, p)) < 1e-9 &&
        p.u >= Math.min(a.u, b.u) - 1e-9 &&
        p.u <= Math.max(a.u, b.u) + 1e-9 &&
        p.v >= Math.min(a.v, b.v) - 1e-9 &&
        p.v <= Math.max(a.v, b.v) + 1e-9;
      if (onSegment) return true;
    }
    if (a.v > p.v !== b.v > p.v && p.u < ((b.u - a.u) * (p.v - a.v)) / (b.v - a.v) + a.u) {
      inside = !inside;
    }
  }
  return inside;
}

export function polygonBounds(poly: readonly AoiPoint[]): {
  uMin: number;
  uMax: number;
  vMin: number;
  vMax: number;
} {
  const us = poly.map((p) => p.u);
  const vs = poly.map((p) => p.v);
  return {
    uMin: Math.min(...us),
    uMax: Math.max(...us),
    vMin: Math.min(...vs),
    vMax: Math.max(...vs),
  };
}
