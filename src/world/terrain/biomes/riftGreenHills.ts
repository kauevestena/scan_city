/**
 * RIFT_GREEN_HILLS — R01 "Colinas Verdes dos Espinhos" (terrain §3): senoides cruzadas de 35 m de
 * amplitude e 120 m de comprimento de onda; a relva é um xadrez de 8 m em dois verdes; 6 arcos de
 * pedra de 20–30 m com 12 m de vão livre; 40 anéis dourados de 10–40 m de altura, em 5 arcos sobre
 * as linhas de voo do plano de referência; palmeiras estilizadas e três lagoinhas com cachoeira
 * nos vales. As fendas usam saturação aumentada (terrain §3); as cores de bioma são exceção
 * permitida aos tokens (ui-style §1).
 */
import type { AoiPoint, LandCover, Rgb, WorldObject } from '@/types';
import { makeObject } from '../objects';
import { distanceToPolyline, type BiomeRecipe, type Polyline } from '../TerrainSampler';

export const WAVELENGTH_M = 120;
export const RELIEF_M = 35;
/** Lado das casas do xadrez da relva. */
export const CHECKER_M = 8;
const K = (2 * Math.PI) / WAVELENGTH_M;

/** Cota do solo: `35·(½ + ¼·(sen(ku) + sen(kv)))`, de 0 (vales) a 35 m (cristas). */
export function hillHeight(u: number, v: number): number {
  return RELIEF_M * (0.5 + 0.25 * (Math.sin(K * u) + Math.sin(K * v)));
}

/** Cristas (u = 30 + 120i, v = 30 + 120j) são planas: aí cabem os pontos de apoio. */
export const CRESTS: readonly AoiPoint[] = [
  { u: 30, v: 30 },
  { u: 150, v: 150 },
  { u: 270, v: 30 },
  { u: 390, v: 150 },
];

/** Lagoinhas nos vales (u = 90 + 120i, v = 90): cada uma recebe uma cachoeira que desce da crista. */
export interface Pool {
  u: number;
  v: number;
}
export const POOLS: readonly Pool[] = [
  { u: 90, v: 90 },
  { u: 210, v: 90 },
  { u: 330, v: 90 },
];
export const POOL_RADIUS_M = 9;
/** Cachoeira: faixa de 3 m que desce de `u − 48` até a borda da lagoa. */
export const FALL = { widthM: 3, lengthM: 48 } as const;

export const ARCH_COUNT = 6;
/** Vão livre de 12 m: as colunas ocupam 20 % da largura cada, então a caixa tem 20 m. */
export const ARCH_SPAN_M = 12;
export const ARCH_WIDTH_M = 20;
export const ARCH_DEPTH_M = 4;
export const ARCH_HEIGHT_M = [20, 30] as const;
/** Nas linhas planas do relevo (v = 30, 90, 150, onde o solo não inclina ao longo da largura). */
export const ARCH_SITES: readonly AoiPoint[] = [
  { u: 150, v: 30 },
  { u: 210, v: 30 },
  { u: 250, v: 90 },
  { u: 390, v: 90 },
  { u: 60, v: 150 },
  { u: 330, v: 150 },
];

/** Os 40 anéis: 5 arcos de 8 anéis, cada um sobre uma linha de voo do plano de referência. */
export const RING_COUNT = 40;
export const RING_ARCS = [
  { v: 24.6, uStart: 70 },
  { v: 54.8, uStart: 260 },
  { v: 84.9, uStart: 150 },
  { v: 115.1, uStart: 60 },
  { v: 145.2, uStart: 300 },
] as const;
export const RINGS_PER_ARC = 8;
export const RING_SPACING_M = 9;
export const RING_DIAMETER_M = 6;
/** Altura da base do anel sobre o solo: o arco sobe de 10 m nas pontas a 40 m no meio. */
export const RING_BASE_M = [10, 40] as const;
const RING_COLOR: Rgb = [251, 191, 36];

const ARCH_COLOR: Rgb = [176, 170, 188];
const PALM_COLORS: readonly Rgb[] = [
  [38, 170, 76],
  [52, 188, 84],
  [30, 152, 90],
];
export const PALM_COUNT = 48;
export const PALM_HEIGHT_M = [7, 11] as const;
export const PALM_CROWN_M = [4.5, 6.5] as const;

/** Duas trilhas ondulantes ao longo de `u`: a pé ou de bicicleta, qualquer ponto fica a ≤ 60 m. */
const TRAIL_WIDTH_M = 3;
function trail(baseV: number, phase: number): Polyline {
  const points: AoiPoint[] = [];
  for (let u = -100; u <= 500; u += 25) {
    points.push({ u, v: baseV + 10 * Math.sin(u / 50 + phase) });
  }
  return { kind: 'TRAIL', widthM: TRAIL_WIDTH_M, points };
}

/** A cachoeira ou a lagoa contém (u, v)? */
export function waterAt(u: number, v: number): boolean {
  return POOLS.some((p) => {
    if (Math.hypot(u - p.u, v - p.v) < POOL_RADIUS_M) return true;
    const along = p.u - POOL_RADIUS_M - u;
    return along >= 0 && along <= FALL.lengthM && Math.abs(v - p.v) < FALL.widthM / 2;
  });
}

/** Casa do xadrez: par = claro (GRASS), ímpar = escuro (CROP). */
function checkerLight(u: number, v: number): boolean {
  return (Math.floor(u / CHECKER_M) + Math.floor(v / CHECKER_M)) % 2 === 0;
}

/** Posição (u, v) do anel `k` do arco `arc`. */
export function ringSite(arc: number, k: number): { u: number; v: number; baseM: number } {
  const a = RING_ARCS[arc] as (typeof RING_ARCS)[number];
  const t = k / (RINGS_PER_ARC - 1);
  const [lo, hi] = RING_BASE_M;
  return {
    u: a.uStart + k * RING_SPACING_M,
    v: a.v,
    baseM: lo + (hi - lo) * 4 * t * (1 - t),
  };
}

export const RIFT_GREEN_HILLS: BiomeRecipe = {
  id: 'RIFT_GREEN_HILLS',
  palette: {
    cover: {
      GRASS: [158, 226, 98],
      CROP: [84, 182, 76],
      FOREST: [38, 142, 66],
      WATER: [62, 160, 238],
      ROAD: [220, 182, 122],
      ROOF: [204, 92, 82],
      SAND: [242, 216, 152],
      ROCK: [156, 146, 164],
      SWAMP: [92, 144, 98],
      URBAN: [172, 168, 178],
      BENCH: [182, 142, 102],
      LAVA: [244, 104, 42],
      SNOW: [240, 244, 250],
      METAL: [142, 152, 172],
    },
    skyTop: [112, 108, 238],
    skyHorizon: [170, 232, 244],
    fog: [198, 226, 246],
    water: [62, 160, 238],
  },

  baseElevation(u, v) {
    return hillHeight(u, v);
  },

  landCover(u, v): LandCover {
    if (waterAt(u, v)) return 'WATER';
    return checkerLight(u, v) ? 'GRASS' : 'CROP';
  },

  canopy() {
    return 0;
  },

  ndvi(u, v, cover, n) {
    switch (cover) {
      case 'WATER':
        return -0.3;
      case 'GRASS':
        return 0.7 + 0.04 * n.b(u / 20, v / 20);
      case 'CROP':
        return 0.8 + 0.04 * n.b(u / 20, v / 20);
      case 'ROAD':
        return 0.08;
      default:
        return 0.2;
    }
  },

  roads() {
    return [trail(50, 0), trail(150, 2)];
  },

  placeObjects(ctx, rng) {
    const objects: WorldObject[] = [];

    // Arcos de pedra: a largura (20 m) fica ao longo de `v`, então as linhas de voo, que correm
    // ao longo de `u`, passam pelo vão de 12 m entre as colunas.
    for (const site of ARCH_SITES) {
      objects.push(
        makeObject(ctx.nextId, {
          kind: 'STONE_ARCH',
          u: site.u,
          v: site.v,
          widthM: ARCH_WIDTH_M,
          depthM: ARCH_DEPTH_M,
          heightM: rng.range(...ARCH_HEIGHT_M),
          rotationRad: Math.PI / 2,
          color: ARCH_COLOR,
        }),
      );
    }

    // Anéis dourados flutuantes, não sólidos, coletáveis a menos de 3 m do centro.
    for (let arc = 0; arc < RING_ARCS.length; arc++) {
      for (let k = 0; k < RINGS_PER_ARC; k++) {
        const site = ringSite(arc, k);
        objects.push(
          makeObject(ctx.nextId, {
            kind: 'RING',
            u: site.u,
            v: site.v,
            widthM: RING_DIAMETER_M,
            depthM: 0.5,
            heightM: RING_DIAMETER_M,
            baseM: site.baseM,
            color: RING_COLOR,
            solid: false,
            collectible: true,
          }),
        );
      }
    }

    // Palmeiras estilizadas, fora da água, das trilhas, dos arcos e das cristas dos pontos de apoio.
    const b = ctx.bounds;
    const clear = (u: number, v: number) =>
      !waterAt(u, v) &&
      !ctx.roads.some((r) => distanceToPolyline({ u, v }, r) < TRAIL_WIDTH_M / 2 + 4) &&
      !ARCH_SITES.some((a) => Math.hypot(u - a.u, v - a.v) < ARCH_WIDTH_M) &&
      !CRESTS.some((c) => Math.hypot(u - c.u, v - c.v) < 10);
    let placed = 0;
    for (let attempt = 0; placed < PALM_COUNT && attempt < PALM_COUNT * 20; attempt++) {
      const u = rng.range(b.uMin, b.uMax);
      const v = rng.range(b.vMin, b.vMax);
      const crownM = rng.range(...PALM_CROWN_M);
      const heightM = rng.range(...PALM_HEIGHT_M);
      const color = rng.pick(PALM_COLORS);
      if (!clear(u, v)) continue;
      objects.push(
        makeObject(ctx.nextId, {
          kind: 'TREE',
          u,
          v,
          widthM: crownM,
          depthM: crownM,
          heightM,
          color,
        }),
      );
      placed++;
    }
    return objects;
  },

  // As cristas planas são os pontos de apoio garantidos.
  guaranteedAccessible: CRESTS.map((c) => ({ u: c.u, v: c.v })),
};
