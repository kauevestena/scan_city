/**
 * RURAL_TUTORIAL — C00 "Sítio do Avô" (terrain §3): pasto ondulado (fbm 3 oitavas, escala
 * 120 m, amplitude 15 m), pomar, açude de r = 18 m em (60, 120), estrada de terra diagonal,
 * casa sede de 12 × 10 × 6 m, 25 árvores e uma cerca baixa.
 * As cores dos biomas são exceção permitida aos tokens (ui-style §1).
 */
import { smoothstep } from '@/lib/math';
import type { AoiPoint, LandCover, Rgb, WorldObject } from '@/types';
import { makeObject } from '../objects';
import type { BiomeRecipe } from '../TerrainSampler';

export const POND = { u: 60, v: 120, r: 18 } as const;
export const ORCHARD = { uMin: 150, uMax: 200, vMin: 122, vMax: 152 } as const;
export const HOUSE = { u: 100, v: 88, widthM: 12, depthM: 10, heightM: 6 } as const;
export const ORCHARD_CANOPY = 0.5;

const SCALE_M = 120;
const AMPLITUDE_M = 15;

const inOrchard = (u: number, v: number) =>
  u >= ORCHARD.uMin && u <= ORCHARD.uMax && v >= ORCHARD.vMin && v <= ORCHARD.vMax;

const TREE: Rgb = [46, 112, 52];
const TRUNK_FENCE: Rgb = [120, 86, 52];

export const RURAL_TUTORIAL: BiomeRecipe = {
  id: 'RURAL_TUTORIAL',
  palette: {
    cover: {
      GRASS: [112, 158, 74],
      CROP: [168, 170, 84],
      FOREST: [58, 118, 60],
      WATER: [58, 108, 150],
      ROAD: [160, 128, 92],
      ROOF: [168, 74, 58],
      SAND: [214, 196, 150],
      ROCK: [130, 126, 118],
      SWAMP: [92, 110, 74],
      URBAN: [150, 146, 140],
      BENCH: [150, 120, 96],
      LAVA: [220, 90, 40],
      SNOW: [236, 240, 244],
      METAL: [120, 128, 140],
    },
    skyTop: [74, 140, 214],
    skyHorizon: [196, 222, 240],
    fog: [214, 228, 236],
    water: [58, 108, 150],
  },

  baseElevation(u, v, n) {
    const ground = AMPLITUDE_M * (0.5 + 0.5 * n.fbm(n.a, u / SCALE_M, v / SCALE_M, { octaves: 3 }));
    const d = Math.hypot(u - POND.u, v - POND.v);
    if (d >= POND.r * 1.4) return ground;
    // Açude: fundo plano 1,5 m abaixo do terreno, com margem suave.
    const pondLevel =
      AMPLITUDE_M * (0.5 + 0.5 * n.fbm(n.a, POND.u / SCALE_M, POND.v / SCALE_M, { octaves: 3 })) -
      1.5;
    return ground + (pondLevel - ground) * smoothstep(POND.r * 1.4, POND.r * 0.8, d);
  },

  landCover(u, v): LandCover {
    if (Math.hypot(u - POND.u, v - POND.v) <= POND.r) return 'WATER';
    if (inOrchard(u, v)) return 'FOREST';
    return 'GRASS';
  },

  canopy(u, v, cover) {
    return cover === 'FOREST' && inOrchard(u, v) ? ORCHARD_CANOPY : 0;
  },

  ndvi(u, v, cover, n) {
    switch (cover) {
      case 'WATER':
        return -0.3;
      case 'ROAD':
        return 0.1;
      case 'ROOF':
        return 0.05;
      case 'FOREST':
        return 0.75 + 0.05 * n.b(u / 20, v / 20);
      default:
        return 0.58 + 0.08 * n.fbm(n.b, u / 40, v / 40, { octaves: 2 });
    }
  },

  roads(aoi) {
    // Estrada de terra cruzando a AOI na diagonal, de canto a canto (com a margem).
    const m = 0.2;
    return [
      {
        kind: 'ROAD',
        widthM: 5,
        points: [
          { u: -m * aoi.lengthM, v: -m * aoi.widthM },
          { u: (1 + m) * aoi.lengthM, v: (1 + m) * aoi.widthM },
        ],
      },
    ];
  },

  placeObjects(ctx, rng) {
    const objects: WorldObject[] = [];
    objects.push(
      makeObject(ctx.nextId, {
        kind: 'BUILDING',
        u: HOUSE.u,
        v: HOUSE.v,
        widthM: HOUSE.widthM,
        depthM: HOUSE.depthM,
        heightM: HOUSE.heightM,
        color: [196, 180, 150],
      }),
    );
    // 15 árvores do pomar, em fileiras.
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 5; col++) {
        objects.push(
          makeObject(ctx.nextId, {
            kind: 'TREE',
            u: ORCHARD.uMin + 5 + col * 10,
            v: ORCHARD.vMin + 5 + row * 10,
            widthM: 5,
            depthM: 5,
            heightM: rng.range(4, 6),
            color: TREE,
          }),
        );
      }
    }
    // 10 árvores esparsas, longe da casa, do açude, do pomar e dos pontos de apoio de referência.
    const avoid: AoiPoint[] = [
      { u: 25, v: 20 },
      { u: 215, v: 20 },
      { u: 25, v: 140 },
      { u: 215, v: 140 },
      { u: 120, v: 80 },
      { u: 70, v: 50 },
      { u: 170, v: 110 },
    ];
    let placed = 0;
    let attempts = 0;
    while (placed < 10 && attempts < 500) {
      attempts++;
      const u = rng.range(5, ctx.aoi.lengthM - 5);
      const v = rng.range(5, ctx.aoi.widthM - 5);
      const clear =
        Math.hypot(u - POND.u, v - POND.v) > POND.r + 6 &&
        !inOrchard(u, v) &&
        Math.hypot(u - HOUSE.u, v - HOUSE.v) > 15 &&
        Math.abs(v - (u * ctx.aoi.widthM) / ctx.aoi.lengthM) > 8 &&
        avoid.every((p) => Math.hypot(u - p.u, v - p.v) > 12);
      if (!clear) continue;
      objects.push(
        makeObject(ctx.nextId, {
          kind: 'TREE',
          u,
          v,
          widthM: rng.range(5, 8),
          depthM: 6,
          heightM: rng.range(7, 11),
          color: TREE,
        }),
      );
      placed++;
    }
    // Cerca baixa do quintal da casa: postes a cada 6 m, não sólidos.
    for (let k = 0; k <= 5; k++) {
      objects.push(
        makeObject(ctx.nextId, {
          kind: 'POLE',
          u: HOUSE.u - 15 + k * 6,
          v: HOUSE.v + 10,
          widthM: 0.3,
          depthM: 0.3,
          heightM: 1.2,
          color: TRUNK_FENCE,
          solid: false,
        }),
      );
    }
    return objects;
  },
};
