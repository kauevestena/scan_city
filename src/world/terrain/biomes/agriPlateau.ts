/**
 * AGRI_PLATEAU — C02 "Planalto Agrícola" (terrain §3): relevo suave de até 30 m (fbm de 2 oitavas,
 * escala 600 m), talhões retangulares de 190–270 m separados por estradas internas, vigor (NDVI)
 * de 0,55 a 0,85 por talhão menos manchas de estresse (fbm, até −0,4), três pivôs centrais (círculos
 * de cultivo com um braço de postes não sólidos) e a sede da fazenda com silos.
 * As cores dos biomas são exceção permitida aos tokens (ui-style §1).
 */
import { clamp, smoothstep } from '@/lib/math';
import { hash2 } from '@/lib/rng';
import type { AoiPoint, LandCover, Rgb, WorldObject } from '@/types';
import { makeObject } from '../objects';
import { MARGIN_FRACTION, type BiomeRecipe, type Polyline } from '../TerrainSampler';

/** Estradas internas nas divisas dos talhões (cada uma é um corte, de 190 a 270 m entre elas). */
export const CUTS_U = [-300, -110, 120, 390, 600, 870, 1090, 1330, 1550, 1790, 2050] as const;
export const CUTS_V = [-140, 100, 330, 590, 830] as const;
export const ROAD_WIDTH_M = 6;
/** A estrada principal (v = 330) é mais larga. */
export const MAIN_ROAD_V = 330;
export const MAIN_ROAD_WIDTH_M = 9;
export const RELIEF_M = 30;
const RELIEF_SCALE_M = 600;

/** Pivôs centrais: o círculo cultivado ocupa o miolo do talhão e os cantos ficam de pousio. */
export interface Pivot {
  u: number;
  v: number;
  radiusM: number;
  /** Direção do braço de postes (graus, de +u para +v). */
  armDeg: number;
}
export const PIVOTS: readonly Pivot[] = [
  { u: 255, v: 215, radiusM: 105, armDeg: 20 },
  { u: 980, v: 460, radiusM: 100, armDeg: 100 },
  { u: 1440, v: 215, radiusM: 100, armDeg: 55 },
];
/** O pivô 3 está entupido: um setor dele fica com o vigor lá embaixo (a mancha amarela). */
export const CLOGGED = { pivot: 2, fromDeg: 30, toDeg: 80, drop: 0.4 } as const;

/** Sede: pátio de terra batida com silos, galpões e a casa, no canto de um talhão. */
export const YARD = { uMin: 400, uMax: 475, vMin: 340, vMax: 415 } as const;
export const SILOS = [
  { u: 414, v: 356 },
  { u: 430, v: 356 },
  { u: 446, v: 356 },
  { u: 462, v: 356 },
] as const;

const SOY: Rgb = [90, 140, 70];
const POLE_COLOR: Rgb = [170, 172, 178];
const SILO_COLOR: Rgb = [196, 198, 204];
const SHED_COLOR: Rgb = [176, 120, 90];
const HOUSE_COLOR: Rgb = [226, 212, 186];

/** Índice do talhão (entre divisas) que contém a coordenada, ou −1 se cair numa estrada. */
function slot(x: number, cuts: readonly number[]): number {
  const half = ROAD_WIDTH_M / 2;
  for (let k = 0; k + 1 < cuts.length; k++) {
    if (x >= (cuts[k] as number) + half && x <= (cuts[k + 1] as number) - half) return k;
  }
  return -1;
}

/** Vigor-base do talhão (NDVI de 0,55 a 0,85). */
export function fieldVigor(k: number, j: number): number {
  return 0.55 + 0.3 * hash2(k, j, 2020);
}

const inYard = (u: number, v: number) =>
  u >= YARD.uMin && u <= YARD.uMax && v >= YARD.vMin && v <= YARD.vMax;

/** Pivô cujo talhão contém (u, v), com a distância ao centro. */
function pivotAt(u: number, v: number): { pivot: Pivot; index: number; dist: number } | null {
  const k = slot(u, CUTS_U);
  const j = slot(v, CUTS_V);
  if (k < 0 || j < 0) return null;
  for (const [index, pivot] of PIVOTS.entries()) {
    if (slot(pivot.u, CUTS_U) === k && slot(pivot.v, CUTS_V) === j) {
      return { pivot, index, dist: Math.hypot(u - pivot.u, v - pivot.v) };
    }
  }
  return null;
}

/** Peso (0..1) do setor entupido do pivô 3 em (u, v). */
export function cloggedWeight(u: number, v: number): number {
  const p = PIVOTS[CLOGGED.pivot] as Pivot;
  const dist = Math.hypot(u - p.u, v - p.v);
  if (dist > p.radiusM) return 0;
  const deg = (Math.atan2(v - p.v, u - p.u) * 180) / Math.PI;
  const edge = Math.min(deg - CLOGGED.fromDeg, CLOGGED.toDeg - deg);
  return smoothstep(0, 6, edge);
}

export const AGRI_PLATEAU: BiomeRecipe = {
  id: 'AGRI_PLATEAU',
  palette: {
    cover: {
      GRASS: [158, 168, 96],
      CROP: SOY,
      FOREST: [58, 118, 60],
      WATER: [58, 108, 150],
      ROAD: [186, 158, 120],
      ROOF: [176, 100, 80],
      SAND: [214, 196, 150],
      ROCK: [130, 126, 118],
      SWAMP: [92, 110, 74],
      URBAN: [190, 172, 146],
      BENCH: [150, 120, 96],
      LAVA: [220, 90, 40],
      SNOW: [236, 240, 244],
      METAL: [120, 128, 140],
    },
    skyTop: [82, 146, 222],
    skyHorizon: [206, 226, 240],
    fog: [212, 226, 236],
    water: [58, 108, 150],
  },

  // Planalto suave: ondas largas de até 30 m.
  baseElevation(u, v, n) {
    const wave = n.fbm(n.a, u / RELIEF_SCALE_M, v / RELIEF_SCALE_M, { octaves: 2 });
    return RELIEF_M * (0.5 + 0.5 * clamp(1.6 * wave, -1, 1));
  },

  // Estradas (ROAD) e telhados (ROOF) vêm do sampler; o resto é cultivo, pousio nos cantos dos
  // pivôs e o pátio da sede.
  landCover(u, v): LandCover {
    if (inYard(u, v)) return 'URBAN';
    const hit = pivotAt(u, v);
    if (hit && hit.dist > hit.pivot.radiusM) return 'GRASS';
    return 'CROP';
  },

  canopy() {
    return 0;
  },

  // Vigor do talhão menos as manchas de estresse (fbm, até −0,4) e o setor entupido do pivô 3.
  ndvi(u, v, cover, n) {
    switch (cover) {
      case 'CROP': {
        const k = slot(u, CUTS_U);
        const j = slot(v, CUTS_V);
        const vigor = k < 0 || j < 0 ? 0.6 : fieldVigor(k, j);
        const stress = 0.4 * smoothstep(0.12, 0.38, n.fbm(n.b, u / 70, v / 70, { octaves: 2 }));
        // O entupimento do pivô 3 vale mais que a mancha de estresse, não soma com ela.
        const drop = Math.max(stress, CLOGGED.drop * cloggedWeight(u, v));
        return clamp(vigor - drop, -0.2, 0.9);
      }
      case 'GRASS':
        return 0.36 + 0.08 * n.b(u / 30, v / 30);
      case 'ROAD':
        return 0.08;
      case 'ROOF':
        return 0.05;
      default:
        return 0.12;
    }
  },

  roads(aoi) {
    const m = MARGIN_FRACTION;
    const uMin = -m * aoi.lengthM;
    const uMax = (1 + m) * aoi.lengthM;
    const vMin = -m * aoi.widthM;
    const vMax = (1 + m) * aoi.widthM;
    return [
      ...CUTS_U.map<Polyline>((u) => ({
        kind: 'ROAD',
        widthM: ROAD_WIDTH_M,
        points: [
          { u, v: vMin },
          { u, v: vMax },
        ],
      })),
      ...CUTS_V.map<Polyline>((v) => ({
        kind: 'ROAD',
        widthM: v === MAIN_ROAD_V ? MAIN_ROAD_WIDTH_M : ROAD_WIDTH_M,
        points: [
          { u: uMin, v },
          { u: uMax, v },
        ],
      })),
    ];
  },

  placeObjects(ctx) {
    const objects: WorldObject[] = [];
    const pole = (u: number, v: number, heightM: number) =>
      objects.push(
        makeObject(ctx.nextId, {
          kind: 'POLE',
          u,
          v,
          widthM: 0.4,
          depthM: 0.4,
          heightM,
          color: POLE_COLOR,
          solid: false,
        }),
      );
    // Cada pivô: torre central e um braço radial de postes (não sólidos).
    for (const p of PIVOTS) {
      pole(p.u, p.v, 5);
      const a = (p.armDeg * Math.PI) / 180;
      for (let k = 1; k <= 8; k++) {
        const r = (p.radiusM * k) / 8;
        pole(p.u + r * Math.cos(a), p.v + r * Math.sin(a), 3.5);
      }
    }
    // Silos (cilindros) em fila, galpões e a casa da sede.
    SILOS.forEach(({ u, v }, i) =>
      objects.push(
        makeObject(ctx.nextId, {
          kind: 'PIPE',
          u,
          v,
          widthM: 10,
          depthM: 10,
          heightM: 16 + 2 * i,
          color: SILO_COLOR,
        }),
      ),
    );
    for (const v of [386, 403]) {
      objects.push(
        makeObject(ctx.nextId, {
          kind: 'BUILDING',
          u: 428,
          v,
          widthM: 28,
          depthM: 12,
          heightM: 7,
          color: SHED_COLOR,
        }),
      );
    }
    objects.push(
      makeObject(ctx.nextId, {
        kind: 'BUILDING',
        u: 458,
        v: 394,
        widthM: 14,
        depthM: 10,
        heightM: 5,
        color: HOUSE_COLOR,
      }),
    );
    return objects;
  },

  guaranteedAccessible: [{ u: 750, v: 300 }] as AoiPoint[],
};
