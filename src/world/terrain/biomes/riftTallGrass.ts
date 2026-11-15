/**
 * RIFT_TALL_GRASS — R09 "Savana das Gramas Altas" (terrain §3): savana de relevo de até 20 m
 * (fbm, com mais várzea que morro), com manchas de capim alto (cobertura `CROP`, NDVI de 0,8 em diante) no meio do capim
 * baixo (`GRASS`, NDVI de ~0,5), três trilhas de terra, um lago com margem de areia e árvores
 * isoladas. As criaturas elétricas não são objetos: os picos vêm do tempo (`ELECTRIC_CREATURES`).
 * As cores de bioma são exceção aos tokens (ui-style §1).
 */
import { clamp, smoothstep } from '@/lib/math';
import type { AoiPoint, LandCover, Rgb, WorldObject } from '@/types';
import type { NoiseKit } from '../noise';
import { makeObject } from '../objects';
import { distanceToPolyline, type BiomeRecipe, type Polyline } from '../TerrainSampler';

export const RELIEF_M = 20;
const RELIEF_SCALE_M = 260;

/** O lago: uma elipse de 220 × 140 m, com a bacia 3 m abaixo e uma margem de areia em volta. */
export const LAKE = { u: 560, v: 250, semiU: 110, semiV: 70, basinM: 3, shore: 1.25 } as const;
/** Distância normalizada ao centro do lago: < 1 na água, < 1,25 na areia. */
export function lakeDistance(u: number, v: number): number {
  return Math.hypot((u - LAKE.u) / LAKE.semiU, (v - LAKE.v) / LAKE.semiV);
}

/** Manchas de capim alto: onde o ruído de baixa frequência passa do limite (~35 % do campo). */
export const TALL_GRASS_THRESHOLD = 0.2;
const TALL_GRASS_SCALE_M = 95;

/** NDVI por cobertura: o capim alto brilha no multiespectral. */
export const NDVI_TALL = 0.84;
export const NDVI_SHORT = 0.5;

/** Três trilhas de terra: duas ao longo de `u` e uma cruzando por `v`. */
const TRAIL_WIDTH_M = 3;
function trail(point: (t: number) => AoiPoint, from: number, to: number, step: number): Polyline {
  const points: AoiPoint[] = [];
  for (let t = from; t <= to; t += step) points.push(point(t));
  return { kind: 'TRAIL', widthM: TRAIL_WIDTH_M, points };
}
export const trailV1 = (u: number): number => 100 + 25 * Math.sin(u / 110);
export const trailV2 = (u: number): number => 300 + 20 * Math.sin(u / 90 + 1);
export const crossU = (v: number): number => 400 + 30 * Math.sin(v / 80);

export const TREE_COUNT = 60;
export const TREE_HEIGHT_M = [8, 14] as const;
export const TREE_CROWN_M = [6, 9] as const;
const TREE_COLORS: readonly Rgb[] = [
  [58, 152, 72],
  [48, 138, 66],
  [72, 164, 80],
];

export const RIFT_TALL_GRASS: BiomeRecipe = {
  id: 'RIFT_TALL_GRASS',
  palette: {
    cover: {
      // Capim baixo (claro) e capim alto (escuro e viçoso).
      GRASS: [158, 208, 100],
      CROP: [70, 168, 78],
      FOREST: [44, 134, 66],
      WATER: [68, 152, 224],
      ROAD: [214, 184, 132],
      ROOF: [204, 92, 82],
      SAND: [238, 216, 158],
      ROCK: [156, 146, 164],
      SWAMP: [92, 144, 98],
      URBAN: [172, 168, 178],
      BENCH: [182, 142, 102],
      LAVA: [244, 104, 42],
      SNOW: [240, 244, 250],
      METAL: [142, 152, 172],
    },
    skyTop: [108, 150, 232],
    skyHorizon: [202, 232, 246],
    fog: [214, 234, 244],
    water: [68, 152, 224],
  },

  // Planícies largas e colinas de até 20 m (o quadrado do fbm normalizado dá mais várzea que
  // morro: a cota mediana fica abaixo da média), com a bacia do lago afundada.
  baseElevation(u, v, n: NoiseKit) {
    const wave = n.fbm(n.a, u / RELIEF_SCALE_M, v / RELIEF_SCALE_M, { octaves: 3 });
    const w = 0.5 + 0.5 * clamp(1.3 * wave, -1, 1);
    const basin = LAKE.basinM * (1 - smoothstep(0.6, 1.3, lakeDistance(u, v)));
    return RELIEF_M * w * w - basin;
  },

  landCover(u, v, _elev, n): LandCover {
    const d = lakeDistance(u, v);
    if (d < 1) return 'WATER';
    if (d < LAKE.shore) return 'SAND';
    return n.b(u / TALL_GRASS_SCALE_M, v / TALL_GRASS_SCALE_M) > TALL_GRASS_THRESHOLD
      ? 'CROP'
      : 'GRASS';
  },

  canopy() {
    return 0;
  },

  ndvi(u, v, cover, n) {
    switch (cover) {
      case 'WATER':
        return -0.3;
      case 'CROP':
        return NDVI_TALL + 0.04 * n.b(u / 12, v / 12);
      case 'GRASS':
        return NDVI_SHORT + 0.06 * n.b(u / 14, v / 14);
      case 'SAND':
        return 0.14;
      case 'ROAD':
        return 0.1;
      default:
        return 0.2;
    }
  },

  roads() {
    return [
      trail((t) => ({ u: t, v: trailV1(t) }), -160, 960, 40),
      trail((t) => ({ u: t, v: trailV2(t) }), -160, 960, 40),
      trail((t) => ({ u: crossU(t), v: t }), -80, 480, 40),
    ];
  },

  placeObjects(ctx, rng) {
    const objects: WorldObject[] = [];
    const b = ctx.bounds;
    let placed = 0;
    for (let attempt = 0; placed < TREE_COUNT && attempt < TREE_COUNT * 20; attempt++) {
      const u = rng.range(b.uMin, b.uMax);
      const v = rng.range(b.vMin, b.vMax);
      const crown = rng.range(...TREE_CROWN_M);
      const heightM = rng.range(...TREE_HEIGHT_M);
      const color = rng.pick(TREE_COLORS);
      // Longe da água, da areia e das trilhas.
      if (lakeDistance(u, v) < LAKE.shore + 0.15) continue;
      if (
        ctx.roads.some((r) => distanceToPolyline({ u, v }, r) < TRAIL_WIDTH_M / 2 + crown / 2 + 2)
      )
        continue;
      objects.push(
        makeObject(ctx.nextId, {
          kind: 'TREE',
          u,
          v,
          widthM: crown,
          depthM: crown,
          heightM,
          color,
        }),
      );
      placed++;
    }
    return objects;
  },

  // A trilha de terra é chão firme em qualquer cena.
  guaranteedAccessible: [{ u: 400, v: trailV1(400) }],
};
