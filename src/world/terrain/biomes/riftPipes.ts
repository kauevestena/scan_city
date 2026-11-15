/**
 * RIFT_PIPES — R02 "Reino dos Encanamentos" (terrain §3): campo gramado de relevo suave (fbm de
 * 20 m) com 10 morrinhos semiesféricos de "olhos" pretos, 14 canos verdes gigantes (6–10 m de
 * diâmetro, 15–40 m de altura), 10 plataformas de tijolos flutuantes a 20–50 m do chão e 8
 * cascos flutuantes (esferas verdes e vermelhas) que oscilam de 10 a 25 m em ciclos de 3 a 6 s.
 * Saturação aumentada, como em toda fenda; as cores de bioma são exceção aos tokens (ui-style §1).
 */
import { clamp } from '@/lib/math';
import { RULE_PARAMS } from '@/domain/specialRules';
import type { AoiPoint, LandCover, Rgb, WorldObject } from '@/types';
import { makeObject } from '../objects';
import { distanceToPolyline, type BiomeRecipe, type Polyline } from '../TerrainSampler';

export const RELIEF_M = 20;

/** Morrinho semiesférico: meia elipsoide de raio `r` e altura `h`, com dois olhos pretos no topo. */
export interface Hill {
  u: number;
  v: number;
  r: number;
  h: number;
}
export const HILLS: readonly Hill[] = [
  { u: 80, v: 135, r: 11, h: 8 },
  { u: 230, v: 110, r: 12, h: 9 },
  { u: 150, v: 40, r: 10, h: 7 },
  { u: 150, v: 215, r: 12, h: 8 },
  { u: 255, v: 55, r: 10, h: 8 },
  { u: 55, v: 50, r: 9, h: 7 },
  { u: 270, v: 150, r: 11, h: 9 },
  { u: 25, v: 135, r: 10, h: 8 },
  { u: 215, v: 225, r: 9, h: 7 },
  { u: 100, v: 205, r: 8, h: 6 },
];
/** Os olhos: dois discos pretos lado a lado no topo do morrinho. */
export const EYE_SPREAD = 0.3;
export const eyeRadius = (h: Hill): number => Math.max(1.1, 0.14 * h.r);

export const PIPE_COUNT = 14;
export const PIPE_HEIGHT_M = [15, 40] as const;
export const PIPE_DIAMETER_M = [6, 10] as const;
export const PLATFORM_COUNT = 10;
/** Altura da base das plataformas flutuantes sobre o solo. */
export const PLATFORM_BASE_M = [20, 50] as const;
export const HAZARD_COUNT = 8;
export const HAZARD_DIAMETER_M = 5;
/** Os cascos pairam abaixo da altitude do plano de referência (H = 100 m): dá para cronometrar a passagem. */
export const HAZARD_BASE_M = [30, 45] as const;

const PIPE_COLORS: readonly Rgb[] = [
  [38, 182, 84],
  [30, 160, 72],
  [52, 196, 96],
];
const BRICK_COLOR: Rgb = [214, 108, 64];
const HAZARD_COLORS: readonly Rgb[] = [
  [64, 206, 92],
  [236, 66, 66],
];

/** Pontos de apoio do plano de referência (5 GCPs e 2 CPs): a receita os mantém livres de objetos. */
export const SUPPORT_POINTS: readonly AoiPoint[] = [
  { u: 30, v: 30 },
  { u: 270, v: 30 },
  { u: 30, v: 210 },
  { u: 270, v: 210 },
  { u: 150, v: 120 },
  { u: 90, v: 80 },
  { u: 210, v: 160 },
];

/** Duas trilhas onduladas ao longo de `u`, para o acesso a pé de qualquer ponto da AOI. */
const TRAIL_WIDTH_M = 3;
function trail(baseV: number, phase: number): Polyline {
  const points: AoiPoint[] = [];
  for (let u = -80; u <= 380; u += 20) {
    points.push({ u, v: baseV + 8 * Math.sin(u / 45 + phase) });
  }
  return { kind: 'TRAIL', widthM: TRAIL_WIDTH_M, points };
}

/** Altura do morrinho (meia elipsoide) em (u, v). */
function hillHeight(u: number, v: number): number {
  let h = 0;
  for (const hill of HILLS) {
    const du = u - hill.u;
    const dv = v - hill.v;
    const d2 = du * du + dv * dv;
    const r2 = hill.r * hill.r;
    if (d2 < r2) h = Math.max(h, hill.h * Math.sqrt(1 - d2 / r2));
  }
  return h;
}

/** Os 20 olhos (2 por morrinho) com o raio ao quadrado: `landCover` roda milhares de vezes por quadro. */
const EYES: ReadonlyArray<{ u: number; v: number; r2: number }> = HILLS.flatMap((hill) => {
  const r = eyeRadius(hill);
  return [-1, 1].map((side) => ({
    u: hill.u,
    v: hill.v + side * EYE_SPREAD * hill.r,
    r2: r * r,
  }));
});

/** Algum dos olhos pretos cobre (u, v)? */
export function eyeAt(u: number, v: number): boolean {
  for (const eye of EYES) {
    const du = u - eye.u;
    const dv = v - eye.v;
    if (du * du + dv * dv < eye.r2) return true;
  }
  return false;
}

export const RIFT_PIPES: BiomeRecipe = {
  id: 'RIFT_PIPES',
  palette: {
    cover: {
      GRASS: [104, 214, 82],
      CROP: [92, 196, 74],
      FOREST: [38, 150, 70],
      WATER: [62, 160, 238],
      ROAD: [228, 200, 144],
      ROOF: [204, 92, 82],
      SAND: [244, 218, 154],
      // Os olhos pretos dos morrinhos.
      ROCK: [20, 20, 28],
      SWAMP: [92, 144, 98],
      URBAN: [172, 168, 178],
      BENCH: [182, 142, 102],
      LAVA: [244, 104, 42],
      SNOW: [240, 244, 250],
      METAL: [142, 152, 172],
    },
    skyTop: [104, 124, 240],
    skyHorizon: [176, 236, 246],
    fog: [202, 230, 246],
    water: [62, 160, 238],
  },

  // Relevo suave (0–10 m) mais os morrinhos (até 9 m), no total de ~20 m.
  baseElevation(u, v, n) {
    const wave = n.fbm(n.a, u / 90, v / 90, { octaves: 3 });
    return 5 + 5 * clamp(1.5 * wave, -1, 1) + hillHeight(u, v);
  },

  landCover(u, v): LandCover {
    return eyeAt(u, v) ? 'ROCK' : 'GRASS';
  },

  canopy() {
    return 0;
  },

  ndvi(u, v, cover, n) {
    switch (cover) {
      case 'GRASS':
        return 0.74 + 0.05 * n.b(u / 25, v / 25);
      case 'ROAD':
        return 0.08;
      default:
        return 0.05;
    }
  },

  roads() {
    return [trail(75, 0), trail(175, 2)];
  },

  placeObjects(ctx, rng) {
    const objects: WorldObject[] = [];
    const { lengthM, widthM } = ctx.aoi;
    // Dentro da AOI, fora das trilhas, dos morrinhos e do entorno dos pontos de apoio do plano.
    const clear = (u: number, v: number, radius: number) =>
      u > radius + 4 &&
      u < lengthM - radius - 4 &&
      v > radius + 4 &&
      v < widthM - radius - 4 &&
      !ctx.roads.some((r) => distanceToPolyline({ u, v }, r) < TRAIL_WIDTH_M / 2 + radius + 2) &&
      !HILLS.some((h) => Math.hypot(u - h.u, v - h.v) < h.r + radius + 2) &&
      !SUPPORT_POINTS.some((p) => Math.hypot(u - p.u, v - p.v) < radius + 10);
    const taken: Array<{ u: number; v: number; r: number }> = [];
    const free = (u: number, v: number, radius: number, gap: number) =>
      clear(u, v, radius) && taken.every((t) => Math.hypot(u - t.u, v - t.v) > t.r + radius + gap);

    // Canos verdes gigantes: cilindros de 6–10 m de diâmetro e 15–40 m de altura.
    for (let attempt = 0; taken.length < PIPE_COUNT && attempt < PIPE_COUNT * 60; attempt++) {
      const u = rng.range(0, lengthM);
      const v = rng.range(0, widthM);
      const diameter = rng.range(...PIPE_DIAMETER_M);
      const heightM = rng.range(...PIPE_HEIGHT_M);
      const color = rng.pick(PIPE_COLORS);
      if (!free(u, v, diameter / 2, 12)) continue;
      taken.push({ u, v, r: diameter / 2 });
      objects.push(
        makeObject(ctx.nextId, {
          kind: 'PIPE',
          u,
          v,
          widthM: diameter,
          depthM: diameter,
          heightM,
          color,
        }),
      );
    }

    // Plataformas de tijolos flutuantes: lajes de 3 m a 20–50 m do chão.
    let platforms = 0;
    for (let attempt = 0; platforms < PLATFORM_COUNT && attempt < PLATFORM_COUNT * 60; attempt++) {
      const u = rng.range(0, lengthM);
      const v = rng.range(0, widthM);
      const widthP = rng.range(12, 18);
      const depthP = rng.range(6, 9);
      const baseM = rng.range(...PLATFORM_BASE_M);
      const rotationRad = rng.range(0, Math.PI);
      if (!free(u, v, widthP / 2, 6)) continue;
      taken.push({ u, v, r: widthP / 2 });
      platforms++;
      objects.push(
        makeObject(ctx.nextId, {
          kind: 'BRICK_PLATFORM',
          u,
          v,
          widthM: widthP,
          depthM: depthP,
          heightM: 3,
          baseM,
          rotationRad,
          color: BRICK_COLOR,
        }),
      );
    }

    // Cascos flutuantes: esferas verdes e vermelhas que oscilam sobre a área.
    const [ampLo, ampHi] = RULE_PARAMS.movingHazards.amplitudeM;
    const [perLo, perHi] = RULE_PARAMS.movingHazards.periodS;
    const axes = ['u', 'v', 'h'] as const;
    for (let k = 0; k < HAZARD_COUNT; k++) {
      const u = rng.range(20, lengthM - 20);
      const v = rng.range(20, widthM - 20);
      const amplitudeM = rng.range(ampLo, ampHi);
      const periodS = rng.range(perLo, perHi);
      const phase = rng.range(0, 2 * Math.PI);
      // O vertical só sobe a partir de uma base que não enterre o casco no chão.
      const axis = axes[k % axes.length] as (typeof axes)[number];
      const baseM = Math.max(rng.range(...HAZARD_BASE_M), axis === 'h' ? amplitudeM + 5 : 0);
      objects.push(
        makeObject(ctx.nextId, {
          kind: 'MOVING_HAZARD',
          u,
          v,
          widthM: HAZARD_DIAMETER_M,
          depthM: HAZARD_DIAMETER_M,
          heightM: HAZARD_DIAMETER_M,
          baseM,
          color: HAZARD_COLORS[k % HAZARD_COLORS.length] as Rgb,
          motion: { axis, amplitudeM, periodS, phase },
        }),
      );
    }
    return objects;
  },

  guaranteedAccessible: SUPPORT_POINTS.map((p) => ({ u: p.u, v: p.v })),
};
