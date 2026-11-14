/**
 * PRNG seedado (constitution §2.3). Nada no jogo usa `Math.random()`.
 */
export interface Rng {
  /** Float uniforme em [0, 1). */
  next(): number;
  /** Inteiro uniforme em [min, max], extremos inclusos. */
  int(min: number, max: number): number;
  /** Float uniforme em [min, max). */
  range(min: number, max: number): number;
  /** Normal padrão (média 0, desvio 1), por Box–Muller. */
  normal(): number;
  /** Elemento uniforme de um array não vazio. */
  pick<T>(arr: readonly T[]): T;
  /** Cópia embaralhada (Fisher–Yates); não altera o array original. */
  shuffle<T>(arr: readonly T[]): T[];
  /** Gerador filho derivado da seed original e do rótulo, independente do consumo do pai. */
  fork(label: string): Rng;
}

const UINT32 = 4294967296;

/** FNV-1a de 32 bits. Retorna um inteiro sem sinal. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Hash de célula inteira (ix, iy) para um float em [0, 1). Base do ruído de valor. */
export function hash2(ix: number, iy: number, seed: number): number {
  let h = (seed | 0) ^ Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iy | 0, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / UINT32;
}

export function mulberry32(seed: number): Rng {
  const seed0 = seed >>> 0;
  let state = seed0;
  let spareNormal: number | null = null;

  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / UINT32;
  };

  const int = (min: number, max: number): number => {
    const lo = Math.ceil(Math.min(min, max));
    const hi = Math.floor(Math.max(min, max));
    return lo + Math.floor(next() * (hi - lo + 1));
  };

  return {
    next,
    int,
    range: (min, max) => min + next() * (max - min),
    normal: () => {
      if (spareNormal !== null) {
        const z = spareNormal;
        spareNormal = null;
        return z;
      }
      // 1 − next() ∈ (0, 1], o que evita log(0).
      const r = Math.sqrt(-2 * Math.log(1 - next()));
      const theta = 2 * Math.PI * next();
      spareNormal = r * Math.sin(theta);
      return r * Math.cos(theta);
    },
    pick: <T>(arr: readonly T[]): T => {
      if (arr.length === 0) throw new RangeError('pick() exige um array não vazio');
      return arr[int(0, arr.length - 1)] as T;
    },
    shuffle: <T>(arr: readonly T[]): T[] => {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(0, i);
        const tmp = out[i] as T;
        out[i] = out[j] as T;
        out[j] = tmp;
      }
      return out;
    },
    fork: (label) => mulberry32((hashString(label) ^ Math.imul(seed0, 0x9e3779b1)) >>> 0),
  };
}
