import type { Vec2, Vec3 } from '@/types';

export function clamp(x: number, min: number, max: number): number {
  return x < min ? min : x > max ? max : x;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Inverso de `lerp`: onde `x` está entre `a` e `b` (0 se `a === b`). */
export function invLerp(a: number, b: number, x: number): number {
  return a === b ? 0 : (x - a) / (b - a);
}

/** Leva `x` do intervalo [inMin, inMax] para [outMin, outMax], sem clamp. */
export function remap(
  x: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  return lerp(outMin, outMax, invLerp(inMin, inMax, x));
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp(invLerp(edge0, edge1, x), 0, 1);
  return t * t * (3 - 2 * t);
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Módulo sempre não negativo (ao contrário de `%`). */
export function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

export const vec2 = {
  of: (x: number, y: number): Vec2 => ({ x, y }),
  add: (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y }),
  sub: (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y }),
  scale: (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s }),
  dot: (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y,
  /** Componente z do produto vetorial (área orientada do paralelogramo). */
  cross: (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x,
  len: (a: Vec2): number => Math.hypot(a.x, a.y),
  /** Vetor unitário; o vetor nulo continua nulo. */
  norm: (a: Vec2): Vec2 => {
    const l = Math.hypot(a.x, a.y);
    return l === 0 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
  },
} as const;

export const vec3 = {
  of: (x: number, y: number, z: number): Vec3 => ({ x, y, z }),
  add: (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }),
  sub: (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }),
  scale: (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s }),
  dot: (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z,
  cross: (a: Vec3, b: Vec3): Vec3 => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }),
  len: (a: Vec3): number => Math.hypot(a.x, a.y, a.z),
  norm: (a: Vec3): Vec3 => {
    const l = Math.hypot(a.x, a.y, a.z);
    return l === 0 ? { x: 0, y: 0, z: 0 } : { x: a.x / l, y: a.y / l, z: a.z / l };
  },
} as const;
