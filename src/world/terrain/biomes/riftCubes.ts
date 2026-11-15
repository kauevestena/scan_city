/**
 * RIFT_CUBES — R05 "Mina dos Blocos Cúbicos" (terrain §3): um terreno de blocos. O chão é feito de
 * colunas de 4 × 4 m cuja cota é `floor(h/4)·4` (degraus de 4 m, de 0 a 80 m); a grama cobre o topo,
 * uma borda de rocha de 1 m marca cada degrau, a lava enche as baixadas (abaixo de 8 m) e blocos
 * cúbicos de 4 m, soltos ou empilhados, e árvores de troncos e copas cúbicas completam o cenário.
 * A "textura" de cada quadrado de 4 m é um xadrez de pixels de 1 m em dois verdes. As cores de
 * bioma são exceção aos tokens (ui-style §1).
 */
import { clamp } from '@/lib/math';
import { hash2 } from '@/lib/rng';
import type { AoiPoint, LandCover, Rgb, WorldObject } from '@/types';
import type { NoiseKit } from '../noise';
import { makeObject } from '../objects';
import { lavaThermalZones } from '../ruleGenerators';
import { distanceToPolyline, type BiomeRecipe, type Polyline } from '../TerrainSampler';

/** A coluna do terreno: 4 × 4 m, com a cota em degraus de 4 m. */
export const CELL_M = 4;
export const STEP_M = 4;
/** Alívio do terreno (a ficha pede 80 m). */
export const RELIEF_M = 80;
/** Abaixo desta cota a coluna é lava. */
export const LAVA_BELOW_M = 8;
const NOISE_SCALE_M = 130;
const NOISE_OCTAVES = 4;
/** Ganho do ruído: com ele a cota usa o alívio todo, e ~13 % do chão fica abaixo de `LAVA_BELOW_M`. */
const NOISE_GAIN = 1;
/** A rocha marca 1 m (um quarto da coluna) junto de cada degrau para baixo. */
const EDGE_FRACTION = 0.25;
/** Um pixel da textura tem 1 m: 16 pixels por quadrado de 4 m. */
const TEXTURE_CHANCE = 0.38;
const TEXTURE_SEED = 0x5ca1e;

/** Patamares planos (colunas à mesma cota, nunca lava) nos 5 GCPs do plano de referência. */
export const GCP_PADS: readonly AoiPoint[] = [
  { u: 20, v: 20 },
  { u: 300, v: 20 },
  { u: 20, v: 220 },
  { u: 300, v: 220 },
  { u: 160, v: 120 },
];
export const PAD_RADIUS_M = 8;

/** Uma trilha de terra atravessa a AOI de ponta a ponta (a picape chega a 400 m dela). */
export const TRAIL_WIDTH_M = 3;
export const trailV = (u: number): number => 110 + 30 * Math.sin(u / 70);

export const BLOCK_COUNT = 30;
export const BLOCK_M = 4;
export const STACKED_BLOCKS = 8;
export const TREE_COUNT = 12;
export const TRUNK = { widthM: 1, heightM: 6 } as const;
export const CROWN = { widthM: 5, heightM: 4 } as const;
const BLOCK_COLORS: readonly Rgb[] = [
  [122, 122, 132],
  [98, 98, 110],
  [150, 108, 78],
];
const TRUNK_COLOR: Rgb = [110, 76, 44];
const CROWN_COLOR: Rgb = [52, 150, 56];

const GRASS_COLOR: Rgb = [112, 196, 64];
const CROP_COLOR: Rgb = [78, 164, 52];
const ROCK_COLOR: Rgb = [128, 128, 140];
const LAVA_COLOR: Rgb = [255, 112, 22];

/** Cota (m) da coluna `(i, j)` só pelo ruído: `floor(h/4)·4`, avaliado no centro da coluna. */
function rawColumn(i: number, j: number, n: NoiseKit): number {
  const cu = (i + 0.5) * CELL_M;
  const cv = (j + 0.5) * CELL_M;
  const f = n.fbm(n.a, cu / NOISE_SCALE_M, cv / NOISE_SCALE_M, { octaves: NOISE_OCTAVES });
  const s = clamp(0.5 + NOISE_GAIN * f, 0, 1);
  return Math.floor((RELIEF_M * s) / STEP_M) * STEP_M;
}

/** Cota de cada patamar: a da coluna do centro, ou `LAVA_BELOW_M` se ela for baixada (calculada uma vez por ruído). */
const padLevelCache = new WeakMap<NoiseKit, readonly number[]>();
function padLevels(n: NoiseKit): readonly number[] {
  const cached = padLevelCache.get(n);
  if (cached) return cached;
  const levels = GCP_PADS.map((p) =>
    Math.max(LAVA_BELOW_M, rawColumn(Math.floor(p.u / CELL_M), Math.floor(p.v / CELL_M), n)),
  );
  padLevelCache.set(n, levels);
  return levels;
}

const KEY_OFFSET = 1 << 11;
const KEY_STRIDE = 1 << 12;
const columnCache = new WeakMap<NoiseKit, Map<number, number>>();

/** Cota da coluna `(i, j)` com os patamares; guardada em tabela, porque cada amostra consulta as vizinhas. */
function column(i: number, j: number, n: NoiseKit): number {
  let table = columnCache.get(n);
  if (!table) {
    table = new Map();
    columnCache.set(n, table);
  }
  const key = (i + KEY_OFFSET) * KEY_STRIDE + (j + KEY_OFFSET);
  const hit = table.get(key);
  if (hit !== undefined) return hit;
  const cu = (i + 0.5) * CELL_M;
  const cv = (j + 0.5) * CELL_M;
  let h = -1;
  for (let k = 0; k < GCP_PADS.length; k++) {
    const p = GCP_PADS[k] as AoiPoint;
    if (Math.hypot(cu - p.u, cv - p.v) <= PAD_RADIUS_M) {
      h = padLevels(n)[k] as number;
      break;
    }
  }
  if (h < 0) h = rawColumn(i, j, n);
  table.set(key, h);
  return h;
}

/** A coluna que contém `(u, v)`. */
export const columnOf = (u: number, v: number): { i: number; j: number } => ({
  i: Math.floor(u / CELL_M),
  j: Math.floor(v / CELL_M),
});

/** `(u, v)` está no 1 m de borda de uma coluna que tem vizinha mais baixa desse lado? */
function onEdge(u: number, v: number, h: number, n: NoiseKit): boolean {
  const x = u / CELL_M;
  const y = v / CELL_M;
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = x - i;
  const fy = y - j;
  return (
    (fx < EDGE_FRACTION && column(i - 1, j, n) < h) ||
    (fx > 1 - EDGE_FRACTION && column(i + 1, j, n) < h) ||
    (fy < EDGE_FRACTION && column(i, j - 1, n) < h) ||
    (fy > 1 - EDGE_FRACTION && column(i, j + 1, n) < h)
  );
}

export const RIFT_CUBES: BiomeRecipe = {
  id: 'RIFT_CUBES',
  palette: {
    cover: {
      GRASS: GRASS_COLOR,
      CROP: CROP_COLOR,
      FOREST: [44, 130, 56],
      WATER: [60, 150, 230],
      ROAD: [190, 150, 104],
      ROOF: [204, 92, 82],
      SAND: [232, 208, 148],
      ROCK: ROCK_COLOR,
      SWAMP: [92, 144, 98],
      URBAN: [172, 168, 178],
      BENCH: [182, 142, 102],
      LAVA: LAVA_COLOR,
      SNOW: [240, 244, 250],
      METAL: [142, 152, 172],
    },
    skyTop: [112, 164, 232],
    skyHorizon: [204, 228, 246],
    fog: [200, 222, 240],
    water: [60, 150, 230],
  },

  // Colunas de 4 × 4 m com a cota em degraus de 4 m (0–80 m) e os patamares dos GCPs.
  baseElevation(u, v, n) {
    return column(Math.floor(u / CELL_M), Math.floor(v / CELL_M), n);
  },

  // Lava nas baixadas, rocha na borda de cada degrau e o xadrez de pixels de 1 m em dois verdes.
  landCover(u, v, elev, n): LandCover {
    if (elev < LAVA_BELOW_M) return 'LAVA';
    if (onEdge(u, v, elev, n)) return 'ROCK';
    return hash2(Math.floor(u), Math.floor(v), TEXTURE_SEED) < TEXTURE_CHANCE ? 'CROP' : 'GRASS';
  },

  canopy() {
    return 0;
  },

  ndvi(u, v, cover, n) {
    switch (cover) {
      case 'GRASS':
        return 0.62 + 0.04 * n.b(u / 8, v / 8);
      case 'CROP':
        return 0.7 + 0.04 * n.b(u / 8, v / 8);
      case 'LAVA':
        return 0.02;
      default:
        return 0.1;
    }
  },

  roads() {
    const points: AoiPoint[] = [];
    for (let u = -64; u <= 384; u += 32) points.push({ u, v: trailV(u) });
    return [{ kind: 'TRAIL', widthM: TRAIL_WIDTH_M, points }];
  },

  placeObjects(ctx, rng) {
    const objects: WorldObject[] = [];
    const b = ctx.bounds;
    const trail = ctx.roads as readonly Polyline[];
    // Coluna livre: fora da lava, dos patamares e da trilha.
    const free = (u: number, v: number, margin: number): boolean =>
      ctx.elevation(u, v) >= LAVA_BELOW_M &&
      GCP_PADS.every((p) => Math.hypot(u - p.u, v - p.v) > PAD_RADIUS_M + margin) &&
      trail.every((r) => distanceToPolyline({ u, v }, r) > TRAIL_WIDTH_M / 2 + margin);
    const randomColumn = (): { u: number; v: number } => {
      const i = rng.int(Math.floor(b.uMin / CELL_M), Math.floor(b.uMax / CELL_M) - 1);
      const j = rng.int(Math.floor(b.vMin / CELL_M), Math.floor(b.vMax / CELL_M) - 1);
      return { u: (i + 0.5) * CELL_M, v: (j + 0.5) * CELL_M };
    };
    // Blocos soltos de 4 m no topo das colunas, alguns com outro bloco por cima.
    let placed = 0;
    for (let attempt = 0; placed < BLOCK_COUNT && attempt < BLOCK_COUNT * 40; attempt++) {
      const { u, v } = randomColumn();
      if (!free(u, v, 6)) continue;
      objects.push(
        makeObject(ctx.nextId, {
          kind: 'CUBE_BLOCK',
          u,
          v,
          widthM: BLOCK_M,
          depthM: BLOCK_M,
          heightM: BLOCK_M,
          color: rng.pick(BLOCK_COLORS),
        }),
      );
      if (placed < STACKED_BLOCKS) {
        objects.push(
          makeObject(ctx.nextId, {
            kind: 'CUBE_BLOCK',
            u,
            v,
            widthM: BLOCK_M,
            depthM: BLOCK_M,
            heightM: BLOCK_M,
            baseM: BLOCK_M,
            color: rng.pick(BLOCK_COLORS),
          }),
        );
      }
      placed++;
    }
    // Árvores cúbicas: tronco fino de 6 m e copa de 5 × 5 × 4 m.
    let trees = 0;
    for (let attempt = 0; trees < TREE_COUNT && attempt < TREE_COUNT * 40; attempt++) {
      const { u, v } = randomColumn();
      if (!free(u, v, 8)) continue;
      objects.push(
        makeObject(ctx.nextId, {
          kind: 'CUBE_BLOCK',
          u,
          v,
          widthM: TRUNK.widthM,
          depthM: TRUNK.widthM,
          heightM: TRUNK.heightM,
          color: TRUNK_COLOR,
        }),
        makeObject(ctx.nextId, {
          kind: 'CUBE_BLOCK',
          u,
          v,
          widthM: CROWN.widthM,
          depthM: CROWN.widthM,
          heightM: CROWN.heightM,
          baseM: TRUNK.heightM,
          color: CROWN_COLOR,
        }),
      );
      trees++;
    }
    return objects;
  },

  // `LAVA_THERMALS`: uma térmica por aglomerado de colunas de lava dentro da AOI.
  zones(_objects, aoi, _rng, ctx) {
    const cells: AoiPoint[] = [];
    for (let u = CELL_M / 2; u < aoi.lengthM; u += CELL_M) {
      for (let v = CELL_M / 2; v < aoi.widthM; v += CELL_M) {
        if (ctx.elevation(u, v) < LAVA_BELOW_M) cells.push({ u, v });
      }
    }
    return lavaThermalZones(cells);
  },

  // Os patamares dos GCPs são o único chão garantido (sem lava, plano e a ≤ 400 m da trilha).
  guaranteedAccessible: [...GCP_PADS],
};
