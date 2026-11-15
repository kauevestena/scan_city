/**
 * AMAZON — C03 "Floresta Amazônica" (terrain §3): floresta densa de dossel 0,97 (árvores de
 * 25–45 m, uma copa aglutinada a cada ~15 m), relevo de até 40 m (fbm de 4 oitavas, escala 200 m),
 * um igarapé sinuoso escavado 4 m, com brejo nas margens, e 7 clareiras fixas — os únicos lugares
 * onde um GCP cabe, e por onde o laser chega ao solo. As cores dos biomas são exceção permitida aos
 * tokens (ui-style §1).
 */
import { clamp, smoothstep } from '@/lib/math';
import type { AoiPoint, LandCover, Rgb, WorldObject } from '@/types';
import { makeObject } from '../objects';
import { type BiomeRecipe, type Polyline } from '../TerrainSampler';

/** As 7 clareiras fixas (centro e raio de 22–35 m): 5 de GCP e 2 extras de CP no plano de referência. */
export interface Clearing {
  u: number;
  v: number;
  r: number;
}
export const CLEARINGS: readonly Clearing[] = [
  { u: 150, v: 100, r: 30 },
  { u: 850, v: 100, r: 28 },
  { u: 150, v: 400, r: 34 },
  { u: 850, v: 400, r: 26 },
  { u: 500, v: 250, r: 35 },
  { u: 300, v: 250, r: 22 },
  { u: 700, v: 250, r: 24 },
];

/** Dossel da floresta (0,97 ± 0,01) e o do brejo. */
export const FOREST_CANOPY = 0.97;
export const SWAMP_CANOPY = 0.88;
export const RELIEF_M = 40;
export const TREE_SPACING_M = 15;
export const TREE_HEIGHT_M = [25, 45] as const;

/** Igarapé: senoide ao longo de `u`, entre as duas fileiras de clareiras, escavada 4 m. */
export const STREAM = {
  baseV: 175,
  swayM: 35,
  periodM: 120,
  halfWidthM: 4,
  swampM: 14,
  carveM: 4,
} as const;

/** Eixo do igarapé em `u`. */
export const streamV = (u: number): number =>
  STREAM.baseV + STREAM.swayM * Math.sin(u / STREAM.periodM);

/** Distância (m) ao eixo do igarapé, medida na perpendicular. */
export function streamDistance(u: number, v: number): number {
  const slope = (STREAM.swayM / STREAM.periodM) * Math.cos(u / STREAM.periodM);
  return Math.abs(v - streamV(u)) / Math.sqrt(1 + slope * slope);
}

/** Clareira que contém (u, v), se houver. */
export function clearingAt(u: number, v: number, extraM = 0): Clearing | undefined {
  return CLEARINGS.find((c) => Math.hypot(u - c.u, v - c.v) < c.r + extraM);
}

const TREE_COLORS: readonly Rgb[] = [
  [22, 84, 44],
  [30, 98, 52],
  [38, 108, 58],
  [26, 76, 48],
];

export const AMAZON: BiomeRecipe = {
  id: 'AMAZON',
  palette: {
    cover: {
      GRASS: [124, 168, 88],
      CROP: [168, 170, 84],
      FOREST: [28, 92, 48],
      WATER: [48, 88, 80],
      ROAD: [150, 120, 88],
      ROOF: [168, 74, 58],
      SAND: [214, 196, 150],
      ROCK: [130, 126, 118],
      SWAMP: [70, 98, 62],
      URBAN: [150, 146, 140],
      BENCH: [150, 120, 96],
      LAVA: [220, 90, 40],
      SNOW: [236, 240, 244],
      METAL: [120, 128, 140],
    },
    skyTop: [78, 140, 208],
    skyHorizon: [200, 222, 226],
    fog: [196, 216, 214],
    water: [48, 88, 80],
  },

  // Relevo de até 40 m e o leito do igarapé 4 m abaixo.
  baseElevation(u, v, n) {
    const wave = n.fbm(n.a, u / 200, v / 200, { octaves: 4 });
    const ground = RELIEF_M * (0.5 + 0.5 * clamp(1.5 * wave, -1, 1));
    return (
      ground -
      STREAM.carveM * smoothstep(STREAM.halfWidthM * 3, STREAM.halfWidthM, streamDistance(u, v))
    );
  },

  landCover(u, v): LandCover {
    if (clearingAt(u, v)) return 'GRASS';
    const d = streamDistance(u, v);
    if (d < STREAM.halfWidthM) return 'WATER';
    return d < STREAM.swampM ? 'SWAMP' : 'FOREST';
  },

  // O dossel só some nas clareiras e na água.
  canopy(u, v, cover, n) {
    if (cover === 'FOREST') return clamp(FOREST_CANOPY + 0.01 * n.b(u / 30, v / 30), 0.95, 0.98);
    return cover === 'SWAMP' ? SWAMP_CANOPY : 0;
  },

  ndvi(u, v, cover, n) {
    switch (cover) {
      case 'WATER':
        return -0.3;
      case 'GRASS':
        return 0.6 + 0.05 * n.b(u / 15, v / 15);
      case 'SWAMP':
        return 0.5;
      default:
        return 0.82 + 0.04 * n.b(u / 25, v / 25);
    }
  },

  // Trilhas ligando as clareiras: por elas a picape alcança os pontos de apoio.
  roads() {
    const trail = (points: AoiPoint[]): Polyline => ({ kind: 'TRAIL', widthM: 3, points });
    return [
      trail([
        { u: -200, v: 250 },
        { u: 150, v: 400 },
        { u: 300, v: 250 },
        { u: 500, v: 250 },
        { u: 700, v: 250 },
        { u: 850, v: 400 },
        { u: 1200, v: 250 },
      ]),
      trail([
        { u: 150, v: 100 },
        { u: 300, v: 250 },
      ]),
      trail([
        { u: 850, v: 100 },
        { u: 700, v: 250 },
      ]),
    ];
  },

  // Uma copa aglutinada a cada ~15 m (o LOD de "uma árvore a cada 12 m²"), fora das clareiras e do igarapé.
  placeObjects(ctx, rng) {
    const objects: WorldObject[] = [];
    const b = ctx.bounds;
    const s = TREE_SPACING_M;
    for (let u = b.uMin + s / 2; u < b.uMax; u += s) {
      for (let v = b.vMin + s / 2; v < b.vMax; v += s) {
        // O sorteio roda em toda célula: a seed determina a mata inteira.
        const ju = u + rng.range(-4, 4);
        const jv = v + rng.range(-4, 4);
        const heightM = rng.range(...TREE_HEIGHT_M);
        const widthM = rng.range(11, 15);
        const color = rng.pick(TREE_COLORS);
        if (clearingAt(ju, jv, 4) || streamDistance(ju, jv) < STREAM.halfWidthM + 4) continue;
        objects.push(
          makeObject(ctx.nextId, {
            kind: 'TREE',
            u: ju,
            v: jv,
            widthM,
            depthM: widthM,
            heightM,
            color,
          }),
        );
      }
    }
    return objects;
  },

  guaranteedAccessible: CLEARINGS.map((c) => ({ u: c.u, v: c.v })),
};
