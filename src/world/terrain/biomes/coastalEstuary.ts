/**
 * COASTAL_ESTUARY — C06 "Zona Costeira e Estuário" (terrain §3): dunas de até 20 m (fbm) na
 * faixa de terra v ∈ [0, 170], com restinga, uma falésia baixa e a praia; para além da linha de
 * costa (v > 170) o mar a −2 m, ocupando ~40 % da AOI; um canal sinuoso de estuário que corta a
 * terra, com manguezal (dossel 0,7) nas margens; farol de 25 m e barcos não sólidos.
 * As cores dos biomas são exceção permitida aos tokens (ui-style §1).
 */
import { clamp, lerp, smoothstep } from '@/lib/math';
import type { AoiPoint, LandCover, Rgb, WorldObject } from '@/types';
import { makeObject } from '../objects';
import { MARGIN_FRACTION, type BiomeRecipe, type Polyline } from '../TerrainSampler';

/** A costa nunca fica antes de v = 170: a faixa de terra [0, 170] é garantida. */
export const SHORE_V_M = 170;
export const SEA_FLOOR_M = -2;
export const DUNE_M = 20;
/** Faixa de praia (areia) e a falésia baixa atrás dela. */
export const BEACH_M = 18;
export const CLIFF_M = 4;
const DUNE_SCALE_U_M = 150;
const DUNE_SCALE_V_M = 110;
/** Estrada de terra paralela à costa, no meio da faixa de terra. */
export const ROAD_V_M = 95;
export const ROAD_WIDTH_M = 6;
export const TRAIL_WIDTH_M = 3;

/** Canal do estuário: sobe do mar até `endV`, serpenteando em torno de `centerU`. */
export const CHANNEL = {
  centerU: 540,
  swayM: 40,
  swayPeriodM: 24,
  endV: 112,
  /** Meia-largura: estreita na ponta de terra, abre no mar. */
  inlandHalfM: 6.5,
  midHalfM: 12,
  mouthHalfM: 20,
  mangroveBandM: 22,
} as const;

export const LIGHTHOUSE = { u: 610, v: 136, widthM: 6, heightM: 25 } as const;

/** Linha de costa: de 170 a 176 m, ondulando ao longo de `u`. */
export const shoreV = (u: number): number => SHORE_V_M + 3 + 3 * Math.sin(u / 70);

/** Eixo do canal em `v`. */
export const channelU = (v: number): number =>
  CHANNEL.centerU + CHANNEL.swayM * Math.sin(v / CHANNEL.swayPeriodM);

/** Meia-largura do canal em `v`; a ponta de terra é arredondada e a foz se abre. */
export function channelHalfWidth(v: number, shore: number): number {
  const tip = smoothstep(CHANNEL.endV - 8, CHANNEL.endV + 8, v);
  const body = lerp(
    CHANNEL.inlandHalfM,
    CHANNEL.midHalfM,
    smoothstep(CHANNEL.endV, CHANNEL.endV + 40, v),
  );
  return tip * (body + (CHANNEL.mouthHalfM - CHANNEL.midHalfM) * smoothstep(shore - 25, shore, v));
}

/** Distância (m) ao eixo do canal, medida na perpendicular. */
export function channelDistance(u: number, v: number): number {
  const slope = (CHANNEL.swayM / CHANNEL.swayPeriodM) * Math.cos(v / CHANNEL.swayPeriodM);
  return Math.abs(u - channelU(v)) / Math.sqrt(1 + slope * slope);
}

const SAND: Rgb = [226, 208, 160];
const MANGROVE: Rgb = [38, 96, 62];
const SHRUB: Rgb = [92, 128, 76];
const PALM: Rgb = [70, 124, 70];
const BOAT_COLORS: readonly Rgb[] = [
  [236, 236, 232],
  [214, 74, 62],
  [58, 104, 168],
  [240, 196, 72],
];

export const COASTAL_ESTUARY: BiomeRecipe = {
  id: 'COASTAL_ESTUARY',
  palette: {
    cover: {
      GRASS: [128, 154, 92],
      CROP: [168, 170, 84],
      FOREST: [46, 104, 70],
      WATER: [38, 116, 150],
      ROAD: [170, 142, 104],
      ROOF: [168, 74, 58],
      SAND,
      ROCK: [150, 138, 124],
      SWAMP: [92, 110, 74],
      URBAN: [150, 146, 140],
      BENCH: [150, 120, 96],
      LAVA: [220, 90, 40],
      SNOW: [236, 240, 244],
      METAL: [120, 128, 140],
    },
    skyTop: [70, 138, 218],
    skyHorizon: [206, 226, 240],
    fog: [210, 226, 236],
    water: [38, 116, 150],
  },

  // Dunas na terra, praia e falésia baixa na costa, mar a −2 m, canal escavado.
  baseElevation(u, v, n) {
    const shore = shoreV(u);
    if (v >= shore + 6) return SEA_FLOOR_M;
    const wave = n.fbm(n.a, u / DUNE_SCALE_U_M, v / DUNE_SCALE_V_M, { octaves: 3 });
    const dune = DUNE_M * (0.5 + 0.5 * clamp(1.9 * wave, -1, 1));
    // As dunas baixam até o topo da falésia (4 m) ao longo de 80 m antes da praia.
    const fade = smoothstep(shore - BEACH_M - 10, shore - BEACH_M - 90, v);
    const cliffTop = CLIFF_M + (dune - CLIFF_M) * fade;
    // Praia: de 0 na linha d'água a 1,2 m no pé da falésia, que cai 3 m em 6 m.
    const beach = 1.2 * smoothstep(shore, shore - BEACH_M, v);
    let elev = lerp(cliffTop, beach, smoothstep(shore - BEACH_M - 6, shore - BEACH_M, v));
    // Perto do canal o terreno baixa para a várzea do estuário.
    const d = channelDistance(u, v);
    const half = channelHalfWidth(v, shore);
    // A várzea some aos poucos antes da ponta do canal, sem degrau.
    const reach = smoothstep(CHANNEL.endV - 60, CHANNEL.endV, v);
    if (reach > 0 && d < half + 70) {
      const plain = 1.5 + 1.5 * (0.5 + 0.5 * n.b(u / 40, v / 40));
      elev = lerp(elev, Math.min(elev, plain), reach * smoothstep(half + 70, half + 12, d));
    }
    // O leito do canal.
    if (half > 0 && d < half * 1.25) {
      elev = lerp(elev, SEA_FLOOR_M, smoothstep(half * 1.25, half * 0.7, d));
    }
    // Do litoral para o mar.
    return lerp(elev, SEA_FLOOR_M, smoothstep(shore, shore + 6, v));
  },

  landCover(u, v, elev, n): LandCover {
    const shore = shoreV(u);
    if (v > shore) return 'WATER';
    const d = channelDistance(u, v);
    const half = channelHalfWidth(v, shore);
    if (d < half) return 'WATER';
    // Manguezal nas margens baixas do canal.
    if (v >= CHANNEL.endV - 4 && d < half + CHANNEL.mangroveBandM && elev < 3.5) return 'FOREST';
    if (v > shore - BEACH_M) return 'SAND';
    // Falésia baixa: rocha no degrau entre a praia e as dunas.
    if (v > shore - BEACH_M - 6) return 'ROCK';
    // Restinga nas baixadas, areia nas cristas.
    return n.b(u / 55, v / 55) > 0.1 ? 'GRASS' : 'SAND';
  },

  canopy(_u, _v, cover) {
    if (cover === 'FOREST') return 0.7;
    return cover === 'GRASS' ? 0.08 : 0;
  },

  ndvi(u, v, cover, n) {
    switch (cover) {
      case 'WATER':
        return -0.3;
      case 'FOREST':
        return 0.7 + 0.05 * n.b(u / 20, v / 20);
      case 'GRASS':
        return 0.42 + 0.1 * n.b(u / 30, v / 30);
      case 'ROAD':
        return 0.06;
      default:
        return 0.08;
    }
  },

  roads(aoi, rng) {
    const m = MARGIN_FRACTION;
    const uMin = -m * aoi.lengthM;
    const uMax = (1 + m) * aoi.lengthM;
    // Estrada de terra no meio da terra, com pequenas ondas.
    const main: AoiPoint[] = [];
    for (let u = uMin; u < uMax + 1e-9; u += (uMax - uMin) / 14) {
      main.push({ u, v: ROAD_V_M + rng.range(-5, 5) });
    }
    // Trilha na praia, acompanhando a linha de costa.
    const trail: AoiPoint[] = [];
    for (let u = uMin; u < uMax + 1e-9; u += 40) trail.push({ u, v: shoreV(u) - 8 });
    return [
      { kind: 'ROAD', widthM: ROAD_WIDTH_M, points: main },
      { kind: 'TRAIL', widthM: TRAIL_WIDTH_M, points: trail },
      // Acesso de terra ao farol.
      {
        kind: 'ROAD',
        widthM: ROAD_WIDTH_M,
        points: [
          { u: LIGHTHOUSE.u, v: ROAD_V_M },
          { u: LIGHTHOUSE.u, v: LIGHTHOUSE.v + 6 },
        ],
      },
    ] satisfies Polyline[];
  },

  placeObjects(ctx, rng) {
    const objects: WorldObject[] = [];
    const b = ctx.bounds;
    const tree = (u: number, v: number, widthM: number, heightM: number, color: Rgb) =>
      objects.push(
        makeObject(ctx.nextId, { kind: 'TREE', u, v, widthM, depthM: widthM, heightM, color }),
      );

    objects.push(
      makeObject(ctx.nextId, {
        kind: 'TOWER',
        u: LIGHTHOUSE.u,
        v: LIGHTHOUSE.v,
        widthM: LIGHTHOUSE.widthM,
        depthM: LIGHTHOUSE.widthM,
        heightM: LIGHTHOUSE.heightM,
        color: [244, 242, 236],
      }),
    );

    // Mangue: árvores baixas dos dois lados do canal, da ponta até a foz. O deslocamento em `u`
    // é maior que a distância perpendicular onde o canal se inclina.
    for (let k = 0; k < 90; k++) {
      const v = rng.range(CHANNEL.endV, SHORE_V_M - 2);
      const side = rng.next() < 0.5 ? -1 : 1;
      const half = channelHalfWidth(v, shoreV(channelU(v)));
      const off = half + rng.range(2, CHANNEL.mangroveBandM);
      const slope = (CHANNEL.swayM / CHANNEL.swayPeriodM) * Math.cos(v / CHANNEL.swayPeriodM);
      const u = channelU(v) + side * off * Math.sqrt(1 + slope * slope);
      const heightM = rng.range(5, 8);
      const widthM = rng.range(4, 6);
      if (v < shoreV(u) - 2) tree(u, v, widthM, heightM, MANGROVE);
    }
    // Restinga: arbustos e algumas palmeiras nas dunas, longe da estrada e do canal.
    for (let k = 0, placed = 0; placed < 70 && k < 600; k++) {
      const u = rng.range(b.uMin, b.uMax);
      const v = rng.range(b.vMin, shoreV(u) - BEACH_M - 6);
      const farFromRoad = Math.abs(v - ROAD_V_M) > ROAD_WIDTH_M + 6;
      const farFromChannel = channelDistance(u, v) > CHANNEL.mangroveBandM + 20;
      const farFromLighthouse = Math.hypot(u - LIGHTHOUSE.u, v - LIGHTHOUSE.v) > 12;
      if (!farFromRoad || !farFromChannel || !farFromLighthouse) continue;
      placed++;
      if (rng.next() < 0.25) tree(u, v, 4, rng.range(6, 9), PALM);
      else tree(u, v, rng.range(2.5, 4), rng.range(1.5, 3), SHRUB);
    }
    // Barcos no mar e na foz: casco baixo, não sólido.
    for (let k = 0; k < 14; k++) {
      const u = rng.range(20, ctx.aoi.lengthM - 20);
      const v = rng.range(shoreV(u) + 14, ctx.aoi.widthM + 40);
      objects.push(
        makeObject(ctx.nextId, {
          kind: 'CUBE_BLOCK',
          u,
          v,
          widthM: 4,
          depthM: rng.range(9, 14),
          heightM: 2.5,
          color: rng.pick(BOAT_COLORS),
          solid: false,
          rotationRad: rng.range(-0.4, 0.4),
        }),
      );
    }
    return objects;
  },

  // A costa segue o mesmo desenho: os pontos de apoio de referência ficam na faixa de terra.
  guaranteedAccessible: [
    { u: 40, v: 40 },
    { u: 400, v: 90 },
    { u: 760, v: 140 },
  ],
};
