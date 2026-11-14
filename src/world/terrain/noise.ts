/** Ruído de valor 2D e utilitários (terrain §1). Determinístico: hash inteiro, sem `Math.random`. */
import { hash2 } from '@/lib/rng';

export type Noise2D = (x: number, y: number) => number;

/** Ruído de valor em [−1, 1], interpolação smoothstep sobre a grade inteira com hash. */
export function valueNoise2D(seed: number): Noise2D {
  const s = seed | 0;
  return (x, y) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = hash2(ix, iy, s);
    const b = hash2(ix + 1, iy, s);
    const c = hash2(ix, iy + 1, s);
    const d = hash2(ix + 1, iy + 1, s);
    const top = a + (b - a) * sx;
    const bottom = c + (d - c) * sx;
    return (top + (bottom - top) * sy) * 2 - 1;
  };
}

export interface FbmOptions {
  octaves: number;
  lacunarity?: number;
  gain?: number;
}

/** Soma fractal normalizada, em [−1, 1]. */
export function fbm(noise: Noise2D, x: number, y: number, opts: FbmOptions): number {
  const { octaves, lacunarity = 2, gain = 0.5 } = opts;
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise(x * freq, y * freq);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

/** Ruído "de cristas": 1 − |n| acumulado, em [0, 1]. */
export function ridged(noise: Noise2D, x: number, y: number, octaves: number): number {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * (1 - Math.abs(noise(x * freq, y * freq)));
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

/** Desloca (x, y) por um campo de ruído, para quebrar a regularidade. */
export function domainWarp(noise: Noise2D, x: number, y: number, amount: number): [number, number] {
  return [x + amount * noise(x + 17.3, y - 4.1), y + amount * noise(x - 8.7, y + 23.9)];
}

/** Kit de ruídos de um terreno, todos derivados da seed do contrato. */
export interface NoiseKit {
  /** Ruído principal e dois independentes. */
  a: Noise2D;
  b: Noise2D;
  c: Noise2D;
  fbm: (noise: Noise2D, x: number, y: number, opts: FbmOptions) => number;
  ridged: (noise: Noise2D, x: number, y: number, octaves: number) => number;
  warp: (noise: Noise2D, x: number, y: number, amount: number) => [number, number];
}

export function createNoiseKit(seed: number): NoiseKit {
  return {
    a: valueNoise2D(seed),
    b: valueNoise2D(seed ^ 0x5bd1e995),
    c: valueNoise2D(seed ^ 0x27d4eb2f),
    fbm,
    ridged,
    warp: domainWarp,
  };
}
