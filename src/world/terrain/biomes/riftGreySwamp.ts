/**
 * RIFT_GREY_SWAMP — R06 "Pântano Cinzento" (terrain §3): brejo quase plano (fbm de 8 m) de cores
 * lavadas, com poças d'água, ilhotas de capim, árvores mortas cinzentas, ruínas de pedra e uma
 * névoa baixa na paleta. Três tocas quentes (`DEN_A/B/C`, alvos de sensor termal) não existem para
 * o RGB: só o render termal as mostra como manchas brilhantes. Uma calçada de pedra velha corta o
 * brejo de ponta a ponta, para a picape 4x4. As cores de bioma são exceção aos tokens (ui-style §1).
 */
import { clamp } from '@/lib/math';
import type { AoiPoint, FeatureTarget, LandCover, Rgb, WorldObject } from '@/types';
import { makeObject } from '../objects';
import { distanceToPolyline, type BiomeRecipe, type Polyline } from '../TerrainSampler';

export const RELIEF_M = 8;

/** As três tocas quentes: r = 8 m, fotos com o sensor térmico. */
function den(id: string, name: string, u: number, v: number): FeatureTarget {
  return { id, name, u, v, radiusM: 8, needs: 'PHOTO', sensorKind: 'THERMAL' };
}
export const DENS: readonly FeatureTarget[] = [
  den('DEN_A', 'Toca A', 80, 60),
  den('DEN_B', 'Toca B', 220, 150),
  den('DEN_C', 'Toca C', 150, 40),
];
/** Distância das tocas à água e às árvores: a toca fica em chão firme e a céu aberto. */
const DEN_CLEAR_M = 14;
const nearDen = (u: number, v: number, extraM = 0): boolean =>
  DENS.some((d) => Math.hypot(u - d.u, v - d.v) < DEN_CLEAR_M + extraM);

/** Poças: onde o ruído de baixa frequência passa deste limite (~15 % do brejo). */
export const PUDDLE_THRESHOLD = 0.5;
/** Ilhotas de capim e de lama firme. */
export const HUMMOCK_THRESHOLD = 0.5;

export const DEAD_TREE_COUNT = 90;
export const DEAD_TREE_HEIGHT_M = [5, 9] as const;
export const DEAD_TREE_CROWN_M = [2.5, 4] as const;

/** Ruínas de pedra: quatro conjuntos de muros baixos em volta de um pátio. */
export const RUINS: readonly AoiPoint[] = [
  { u: 40, v: 140 },
  { u: 120, v: 120 },
  { u: 250, v: 60 },
  { u: 190, v: 170 },
];
export const RUIN_WALL_HEIGHT_M = [2, 4] as const;
const RUIN_COLOR: Rgb = [158, 156, 150];
const TREE_COLOR: Rgb = [124, 122, 118];

/** Calçada de pedra velha de ponta a ponta, ondulando em torno de v = 100. */
const CAUSEWAY_WIDTH_M = 3;
function causeway(): Polyline {
  const points: AoiPoint[] = [];
  for (let u = -80; u <= 380; u += 20) points.push({ u, v: 100 + 10 * Math.sin(u / 60) });
  return { kind: 'TRAIL', widthM: CAUSEWAY_WIDTH_M, points };
}

export const RIFT_GREY_SWAMP: BiomeRecipe = {
  id: 'RIFT_GREY_SWAMP',
  palette: {
    cover: {
      GRASS: [142, 150, 128],
      CROP: [150, 152, 120],
      FOREST: [96, 110, 100],
      WATER: [94, 112, 128],
      ROAD: [170, 166, 156],
      ROOF: [150, 146, 140],
      SAND: [186, 180, 160],
      ROCK: [150, 150, 146],
      SWAMP: [112, 126, 118],
      URBAN: [160, 160, 156],
      BENCH: [150, 140, 126],
      LAVA: [220, 90, 40],
      SNOW: [236, 240, 244],
      METAL: [130, 136, 144],
    },
    skyTop: [138, 152, 170],
    skyHorizon: [200, 206, 210],
    fog: [176, 184, 188],
    water: [94, 112, 128],
  },

  // Brejo quase plano: 0–8 m de ondulação suave.
  baseElevation(u, v, n) {
    const wave = n.fbm(n.a, u / 70, v / 70, { octaves: 3 });
    return RELIEF_M / 2 + (RELIEF_M / 2) * clamp(1.3 * wave, -1, 1);
  },

  landCover(u, v, _elev, n): LandCover {
    if (nearDen(u, v)) return 'SWAMP';
    if (n.b(u / 38, v / 38) > PUDDLE_THRESHOLD) return 'WATER';
    return n.c(u / 30, v / 30) > HUMMOCK_THRESHOLD ? 'GRASS' : 'SWAMP';
  },

  canopy() {
    return 0;
  },

  ndvi(u, v, cover, n) {
    switch (cover) {
      case 'WATER':
        return -0.3;
      case 'GRASS':
        return 0.42 + 0.05 * n.b(u / 15, v / 15);
      case 'SWAMP':
        return 0.3 + 0.05 * n.b(u / 20, v / 20);
      case 'ROAD':
        return 0.1;
      default:
        return 0.12;
    }
  },

  roads() {
    return [causeway()];
  },

  features() {
    return DENS.map((d) => ({ ...d }));
  },

  placeObjects(ctx, rng) {
    const objects: WorldObject[] = [];
    const road = ctx.roads[0];
    const clear = (u: number, v: number, radius: number) =>
      !nearDen(u, v, radius) &&
      !(road && distanceToPolyline({ u, v }, road) < CAUSEWAY_WIDTH_M / 2 + radius + 1) &&
      !RUINS.some((r) => Math.hypot(u - r.u, v - r.v) < 10 + radius);

    // Ruínas: quatro muros baixos em volta de um pátio de 8 × 8 m (um lado aberto).
    for (const r of RUINS) {
      const sides = [
        { du: 0, dv: -5, w: 10, d: 1 },
        { du: 0, dv: 5, w: 10, d: 1 },
        { du: -5, dv: 0, w: 1, d: 8 },
        { du: 5, dv: 0, w: 1, d: 8 },
      ];
      for (const wall of sides) {
        const heightM = rng.range(...RUIN_WALL_HEIGHT_M);
        const keep = rng.next() > 0.2;
        if (!keep) continue;
        objects.push(
          makeObject(ctx.nextId, {
            kind: 'BUILDING',
            u: r.u + wall.du,
            v: r.v + wall.dv,
            widthM: wall.w,
            depthM: wall.d,
            heightM,
            color: RUIN_COLOR,
          }),
        );
      }
    }

    // Árvores mortas, cinzentas e finas, espalhadas pelo brejo.
    const b = ctx.bounds;
    let placed = 0;
    for (let attempt = 0; placed < DEAD_TREE_COUNT && attempt < DEAD_TREE_COUNT * 20; attempt++) {
      const u = rng.range(b.uMin, b.uMax);
      const v = rng.range(b.vMin, b.vMax);
      const crown = rng.range(...DEAD_TREE_CROWN_M);
      const heightM = rng.range(...DEAD_TREE_HEIGHT_M);
      if (!clear(u, v, crown / 2)) continue;
      objects.push(
        makeObject(ctx.nextId, {
          kind: 'TREE',
          u,
          v,
          widthM: crown,
          depthM: crown,
          heightM,
          color: TREE_COLOR,
        }),
      );
      placed++;
    }
    return objects;
  },

  // A calçada de pedra velha é chão firme certo: ponto de apoio garantido no meio do brejo.
  guaranteedAccessible: [{ u: 150, v: 100 + 10 * Math.sin(150 / 60) }],
};
