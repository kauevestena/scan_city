/**
 * Prévia da ortofoto e do MDS hipsométrico sobre a AOI (sem margem), a partir do mesmo
 * terreno do voo. Usada no fundo da cobertura e nos visuais da esteira.
 */
import { hillshadeFactor } from '@/engines/field/satellite';
import type { TerrainSampler } from '@/world/terrain/TerrainSampler';

export interface RasterDims {
  width: number;
  height: number;
}

/** 256 px no lado maior, na proporção da AOI. */
export function aoiRasterSize(
  aoi: { lengthM: number; widthM: number },
  longSide = 256,
): RasterDims {
  return aoi.lengthM >= aoi.widthM
    ? { width: longSide, height: Math.max(1, Math.round((longSide * aoi.widthM) / aoi.lengthM)) }
    : { width: Math.max(1, Math.round((longSide * aoi.lengthM) / aoi.widthM)), height: longSide };
}

/** RGBA da orto (cobertura × hillshade); em tons de cinza com `gray`. */
export function orthoPixels(
  terrain: TerrainSampler,
  size: RasterDims,
  gray = false,
): Uint8ClampedArray {
  const { lengthM, widthM } = terrain.aoi;
  const { width, height } = size;
  const du = lengthM / width;
  const dv = widthM / height;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const u = (i + 0.5) * du;
      const v = (j + 0.5) * dv;
      const cover = terrain.landCover(u, v);
      const dzdu = (terrain.surface(u + du, v) - terrain.surface(u - du, v)) / (2 * du);
      const dzdv = (terrain.surface(u, v + dv) - terrain.surface(u, v - dv)) / (2 * dv);
      const k = cover === 'WATER' ? 1 : hillshadeFactor(dzdu, dzdv);
      const [r, g, b] = terrain.palette.cover[cover];
      const o = (j * width + i) * 4;
      if (gray) {
        const y = (0.299 * r + 0.587 * g + 0.114 * b) * k;
        data[o] = y;
        data[o + 1] = y;
        data[o + 2] = y;
      } else {
        data[o] = r * k;
        data[o + 1] = g * k;
        data[o + 2] = b * k;
      }
      data[o + 3] = 255;
    }
  }
  return data;
}

/** Rampa hipsométrica: azul → verde → amarelo → marrom → branco. */
const HYPSO: ReadonlyArray<readonly [number, number, number]> = [
  [37, 99, 235],
  [34, 197, 94],
  [250, 204, 21],
  [146, 64, 14],
  [248, 250, 252],
];

export function hypsometricColor(t: number): [number, number, number] {
  const x = Math.min(0.9999, Math.max(0, t)) * (HYPSO.length - 1);
  const k = Math.floor(x);
  const f = x - k;
  const a = HYPSO[k] as readonly [number, number, number];
  const b = HYPSO[k + 1] as readonly [number, number, number];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

/** RGBA do MDS com a rampa hipsométrica normalizada pela amplitude da AOI. */
export function hypsometricPixels(terrain: TerrainSampler, size: RasterDims): Uint8ClampedArray {
  const { lengthM, widthM } = terrain.aoi;
  const { width, height } = size;
  const z = new Float32Array(width * height);
  let lo = Infinity;
  let hi = -Infinity;
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const e = terrain.surface(((i + 0.5) * lengthM) / width, ((j + 0.5) * widthM) / height);
      z[j * width + i] = e;
      lo = Math.min(lo, e);
      hi = Math.max(hi, e);
    }
  }
  const data = new Uint8ClampedArray(width * height * 4);
  const span = Math.max(1e-6, hi - lo);
  for (let k = 0; k < width * height; k++) {
    const [r, g, b] = hypsometricColor(((z[k] as number) - lo) / span);
    data[k * 4] = r;
    data[k * 4 + 1] = g;
    data[k * 4 + 2] = b;
    data[k * 4 + 3] = 255;
  }
  return data;
}

const cache = new WeakMap<TerrainSampler, Map<string, HTMLCanvasElement>>();

function toCanvas(size: RasterDims, data: Uint8ClampedArray): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const image = ctx.createImageData(size.width, size.height);
    image.data.set(data);
    ctx.putImageData(image, 0, 0);
  }
  return canvas;
}

/** Canvas da orto (colorida ou cinza) ou do MDS hipsométrico, um por terreno e tipo. */
export function rasterCanvas(
  terrain: TerrainSampler,
  kind: 'ORTHO' | 'GRAY' | 'HYPSO',
): HTMLCanvasElement {
  let byKind = cache.get(terrain);
  if (!byKind) {
    byKind = new Map();
    cache.set(terrain, byKind);
  }
  const hit = byKind.get(kind);
  if (hit) return hit;
  const size = aoiRasterSize(terrain.aoi);
  const data =
    kind === 'HYPSO'
      ? hypsometricPixels(terrain, size)
      : orthoPixels(terrain, size, kind === 'GRAY');
  const canvas = toCanvas(size, data);
  byKind.set(kind, canvas);
  return canvas;
}
