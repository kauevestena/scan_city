/**
 * Arena de teste: terreno plano e liso, sem estradas, com os objetos, zonas e alvos que
 * cada teste pedir. Só os testes a usam (T036: uma cena por regra especial).
 */
import type { AoiPoint, FeatureTarget, LandCover, SpecialZone } from '@/types';
import { makeObject, type ObjectSpec } from '../objects';
import { buildTerrain, type BiomeRecipe, type TerrainContract } from '../TerrainSampler';

export interface ArenaOptions {
  objects?: readonly ObjectSpec[];
  zones?: readonly SpecialZone[];
  features?: readonly FeatureTarget[];
  /** Cobertura constante (padrão: grama). */
  cover?: LandCover;
  /** Dossel constante (padrão: 0). */
  canopy?: number;
  /** Elevação do terreno em função de (u, v) (padrão: 0). */
  elevation?: (u: number, v: number) => number;
}

export function testArenaRecipe(opts: ArenaOptions = {}): BiomeRecipe {
  const cover = opts.cover ?? 'GRASS';
  return {
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
    baseElevation: (u, v) => opts.elevation?.(u, v) ?? 0,
    landCover: () => cover,
    canopy: () => opts.canopy ?? 0,
    ndvi: () => 0.5,
    roads: () => [],
    placeObjects: (ctx) => (opts.objects ?? []).map((spec) => makeObject(ctx.nextId, spec)),
    ...(opts.features ? { features: () => [...(opts.features as FeatureTarget[])] } : {}),
    ...(opts.zones ? { zones: () => [...(opts.zones as SpecialZone[])] } : {}),
    guaranteedAccessible: [] as AoiPoint[],
  };
}

const ARENA_CONTRACT: TerrainContract = {
  id: 'ARENA',
  seed: 4242,
  biome: 'RURAL_TUTORIAL',
  aoi: { widthM: 160, lengthM: 240 },
  terrainReliefM: 1,
};

/** Terreno da arena para um conjunto de elementos. */
export function buildTestArena(opts: ArenaOptions = {}, aoi = ARENA_CONTRACT.aoi) {
  return buildTerrain({ ...ARENA_CONTRACT, aoi }, testArenaRecipe(opts));
}
