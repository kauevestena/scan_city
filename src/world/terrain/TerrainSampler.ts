/**
 * Terreno compartilhado (architecture §5, terrain §2). O mesmo sampler alimenta o Field Setup,
 * o voo, a cobertura, os produtos e a mesa. Frame da AOI: `u` ao longo do comprimento
 * (0…lengthM), `v` ao longo da largura (0…widthM); a margem de 20 % fica em volta.
 */
import { hashString, mulberry32, type Rng } from '@/lib/rng';
import type {
  AoiPoint,
  BiomeId,
  Contract,
  FeatureTarget,
  LandCover,
  Rgb,
  SpecialZone,
  WorldObject,
} from '@/types';
import { createDistanceField, type Bounds } from './distanceField';
import { createNoiseKit, type NoiseKit } from './noise';
import { insideFootprint, objectTopAt } from './objects';
import { createSpatialHash, objectReach } from './spatialHash';

export interface BiomePalette {
  cover: Record<LandCover, Rgb>;
  skyTop: Rgb;
  skyHorizon: Rgb;
  fog: Rgb;
  water: Rgb;
}

/** Via (estrada ou trilha) como polilinha com largura. */
export interface Polyline {
  kind: 'ROAD' | 'TRAIL';
  points: readonly AoiPoint[];
  widthM: number;
}

export interface PlacementCtx {
  aoi: Contract['aoi'];
  bounds: Bounds;
  elevation: (u: number, v: number) => number;
  roads: readonly Polyline[];
  nextId: () => number;
}

export interface BiomeRecipe {
  id: BiomeId;
  palette: BiomePalette;
  baseElevation(u: number, v: number, n: NoiseKit): number;
  landCover(u: number, v: number, elev: number, n: NoiseKit): LandCover;
  canopy(u: number, v: number, cover: LandCover, n: NoiseKit): number;
  ndvi(u: number, v: number, cover: LandCover, n: NoiseKit): number;
  roads(aoi: Contract['aoi'], rng: Rng): Polyline[];
  placeObjects(ctx: PlacementCtx, rng: Rng): WorldObject[];
  features?(aoi: Contract['aoi']): FeatureTarget[];
  zones?(objects: readonly WorldObject[], aoi: Contract['aoi'], rng: Rng): SpecialZone[];
  /** Pontos garantidamente acessíveis (clareiras, praia), usados no plano de referência. */
  guaranteedAccessible?: AoiPoint[];
}

export interface TerrainSampler {
  /** Dimensões da AOI mais a margem de 20 % de cada lado. */
  readonly widthM: number;
  readonly lengthM: number;
  readonly aoi: Contract['aoi'];
  /** Extensão amostrável, incluindo a margem (u e v podem ser negativos). */
  readonly bounds: Bounds;
  readonly biome: BiomeId;
  readonly palette: BiomePalette;
  readonly roads: readonly Polyline[];
  /** Solo nu (MDT), m. */
  elevation(u: number, v: number): number;
  /** MDS: solo + objetos e copas. */
  surface(u: number, v: number): number;
  landCover(u: number, v: number): LandCover;
  /** Cobertura de dossel, 0..1. */
  canopy(u: number, v: number): number;
  ndvi(u: number, v: number): number;
  slopePct(u: number, v: number): number;
  /** Distância (m) até a estrada mais próxima. */
  distanceToRoad(u: number, v: number): number;
  /** Distância (m) até estrada ou trilha. */
  distanceToTrack(u: number, v: number): number;
  /** Ordenados por `u`. */
  readonly objects: readonly WorldObject[];
  objectsInRange(uMin: number, uMax: number): readonly WorldObject[];
  readonly features: readonly FeatureTarget[];
  readonly zones: readonly SpecialZone[];
  readonly guaranteedAccessible: readonly AoiPoint[];
}

export type TerrainContract = Pick<Contract, 'id' | 'seed' | 'biome' | 'aoi' | 'terrainReliefM'>;

export const MARGIN_FRACTION = 0.2;
export const DISTANCE_CELL_M = 4;
const SLOPE_STEP_M = 2;
/** Dossel sob a copa de uma árvore isolada. */
export const TREE_CROWN_CANOPY = 0.85;

/** Seed do terreno de um contrato (constitution §2.3). */
export function terrainSeed(contract: Pick<Contract, 'id' | 'seed'>): number {
  return (hashString(contract.id) ^ contract.seed) >>> 0;
}

/** Distância de um ponto a um segmento. */
export function distanceToSegment(p: AoiPoint, a: AoiPoint, b: AoiPoint): number {
  const du = b.u - a.u;
  const dv = b.v - a.v;
  const len2 = du * du + dv * dv;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((p.u - a.u) * du + (p.v - a.v) * dv) / len2)) : 0;
  return Math.hypot(p.u - (a.u + t * du), p.v - (a.v + t * dv));
}

export function distanceToPolyline(p: AoiPoint, line: Polyline): number {
  let best = Infinity;
  for (let i = 1; i < line.points.length; i++) {
    best = Math.min(
      best,
      distanceToSegment(p, line.points[i - 1] as AoiPoint, line.points[i] as AoiPoint),
    );
  }
  return best;
}

export function buildTerrain(contract: TerrainContract, recipe: BiomeRecipe): TerrainSampler {
  const seed = terrainSeed(contract);
  const rng = mulberry32(seed);
  const n = createNoiseKit(seed);
  const { aoi } = contract;
  const bounds: Bounds = {
    uMin: -MARGIN_FRACTION * aoi.lengthM,
    uMax: (1 + MARGIN_FRACTION) * aoi.lengthM,
    vMin: -MARGIN_FRACTION * aoi.widthM,
    vMax: (1 + MARGIN_FRACTION) * aoi.widthM,
  };

  const elevation = (u: number, v: number) => recipe.baseElevation(u, v, n);
  const roads = recipe.roads(aoi, rng.fork('roads'));

  let nextObjectId = 1;
  const objects = [
    ...recipe.placeObjects(
      { aoi, bounds, elevation, roads, nextId: () => nextObjectId++ },
      rng.fork('objects'),
    ),
  ].sort((a, b) => a.u - b.u);
  const maxReach = objects.reduce((m, o) => Math.max(m, objectReach(o)), 0);
  const hash = createSpatialHash(objects);
  const features = recipe.features?.(aoi) ?? [];
  const zones = recipe.zones?.(objects, aoi, rng.fork('zones')) ?? [];

  const onRoad = (kinds: ReadonlySet<Polyline['kind']>) => (u: number, v: number) =>
    roads.some((r) => kinds.has(r.kind) && distanceToPolyline({ u, v }, r) <= r.widthM / 2);
  const roadField = createDistanceField(bounds, DISTANCE_CELL_M, onRoad(new Set(['ROAD'])));
  const trackField = createDistanceField(
    bounds,
    DISTANCE_CELL_M,
    onRoad(new Set(['ROAD', 'TRAIL'])),
  );

  const isRoof = (u: number, v: number) =>
    hash.near(u, v).some((o) => o.kind === 'BUILDING' && insideFootprint(o, u, v));
  const roadAt = (u: number, v: number) =>
    roads.some((r) => r.kind === 'ROAD' && distanceToPolyline({ u, v }, r) <= r.widthM / 2);

  const landCover = (u: number, v: number): LandCover => {
    if (isRoof(u, v)) return 'ROOF';
    const cover = recipe.landCover(u, v, elevation(u, v), n);
    if (cover !== 'WATER' && roadAt(u, v)) return 'ROAD';
    return cover;
  };

  // Busca binária pelo primeiro objeto com u ≥ x.
  const lowerBound = (x: number) => {
    let lo = 0;
    let hi = objects.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((objects[mid] as WorldObject).u < x) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };

  return {
    widthM: aoi.widthM * (1 + 2 * MARGIN_FRACTION),
    lengthM: aoi.lengthM * (1 + 2 * MARGIN_FRACTION),
    aoi,
    bounds,
    biome: recipe.id,
    palette: recipe.palette,
    roads,
    elevation,
    surface(u, v) {
      const ground = elevation(u, v);
      let top = 0;
      for (const o of hash.near(u, v)) {
        const h = objectTopAt(o, u, v);
        if (h !== null && h > top) top = h;
      }
      return ground + top;
    },
    landCover,
    canopy(u, v) {
      const base = recipe.canopy(u, v, landCover(u, v), n);
      const underTree = hash
        .near(u, v)
        .some((o) => o.kind === 'TREE' && Math.hypot(u - o.u, v - o.v) <= o.widthM / 2);
      return underTree ? Math.max(base, TREE_CROWN_CANOPY) : base;
    },
    ndvi(u, v) {
      return recipe.ndvi(u, v, landCover(u, v), n);
    },
    slopePct(u, v) {
      const du =
        (elevation(u + SLOPE_STEP_M, v) - elevation(u - SLOPE_STEP_M, v)) / (2 * SLOPE_STEP_M);
      const dv =
        (elevation(u, v + SLOPE_STEP_M) - elevation(u, v - SLOPE_STEP_M)) / (2 * SLOPE_STEP_M);
      return Math.hypot(du, dv) * 100;
    },
    distanceToRoad: (u, v) => roadField.sample(u, v),
    distanceToTrack: (u, v) => trackField.sample(u, v),
    objects,
    objectsInRange(uMin, uMax) {
      return objects.slice(lowerBound(uMin - maxReach), lowerBound(uMax + maxReach + 1e-9));
    },
    features,
    zones,
    guaranteedAccessible: recipe.guaranteedAccessible ?? [],
  };
}
