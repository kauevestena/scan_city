/**
 * RIFT_CRATERS — R03 "Planalto dos Guerreiros" (terrain §3): um planalto rochoso de cristas
 * (`ridged`, 60 m de amplitude) esburacado por 8 crateras de 15 a 45 m de raio, cada uma com a
 * profundidade `0,4·r·(1 − (d/r)²)` (a terra vaporizada do torneio), 6 colunas de energia residual
 * (`ENERGY_BEAM`, 80 m, ciano e amarelas, 2 s ligadas e 3 s apagadas) e rochas flutuantes que só
 * enfeitam. Cinco patamares nivelados cercam os pontos de apoio do plano de referência e duas
 * trilhas de terra, uma por borda, levam a pé até eles. As cores de bioma são exceção aos tokens
 * (ui-style §1).
 */
import { smoothstep } from '@/lib/math';
import type { AoiPoint, LandCover, Rgb, WorldObject } from '@/types';
import type { NoiseKit } from '../noise';
import { makeObject } from '../objects';
import type { BiomeRecipe, Polyline } from '../TerrainSampler';

/** Amplitude do planalto (a ficha pede 60 m de relevo). */
export const RELIEF_M = 60;
const RIDGE_SCALE_M = 250;
const RIDGE_OCTAVES = 3;
/** O ruído de cristas sobe do vale (`LOW`) à crista (`HIGH`) por uma smoothstep: ~60 m de relevo e taludes de até ~60°. */
export const RIDGE_LOW = 0.3;
export const RIDGE_HIGH = 1;
/** Abaixo desta cota o planalto vira areia soprada (as baixadas e o fundo das crateras). */
export const SAND_BELOW_M = 8;

/** Uma cratera: a cota cai `0,4·r·(1 − (d/r)²)` dentro do raio `r`. */
export interface Crater {
  u: number;
  v: number;
  r: number;
}
export const CRATER_DEPTH_FACTOR = 0.4;
/** As 8 crateras (6–10 na ficha, de 15 a 45 m de raio), longe dos patamares dos GCPs e entre si. */
export const CRATERS: readonly Crater[] = [
  { u: 110, v: 150, r: 45 },
  { u: 300, v: 215, r: 40 },
  { u: 215, v: 60, r: 32 },
  { u: 330, v: 120, r: 28 },
  { u: 115, v: 245, r: 24 },
  { u: 200, v: 235, r: 20 },
  { u: 70, v: 70, r: 16 },
  { u: 275, v: 135, r: 15 },
];

/** Profundidade (m) da cratera `c` a `d` metros do centro: 0,4·r no meio, 0 na borda e fora. */
export function craterDepthM(c: Crater, d: number): number {
  return d >= c.r ? 0 : CRATER_DEPTH_FACTOR * c.r * (1 - (d / c.r) ** 2);
}

/** Volume (m³) de uma cratera: `∫ 0,4·r·(1 − (d/r)²)·2πd·dd = 0,2·π·r³`. */
export const craterVolumeM3 = (c: Crater): number => 0.2 * Math.PI * c.r ** 3;

/**
 * Patamares nivelados nos 5 GCPs do plano de referência: 10 m planos e 26 m de rampa, na cota
 * média do disco do patamar (a rampa larga mantém os taludes dentro dos 70° da regra).
 */
export const GCP_PADS: readonly AoiPoint[] = [
  { u: 30, v: 30 },
  { u: 370, v: 30 },
  { u: 30, v: 270 },
  { u: 370, v: 270 },
  { u: 200, v: 150 },
];
export const PAD_FLAT_M = 10;
export const PAD_RAMP_M = 26;

/** Duas trilhas de terra de 3 m, uma por borda: toda a AOI fica a ≤ 130 m delas (a pé se chega a 150 m). */
export const TRAIL_WIDTH_M = 3;
export const trailSouthV = (u: number): number => 22 + 6 * Math.sin(u / 70);
export const trailNorthV = (u: number): number => 282 + 6 * Math.sin(u / 80 + 1);

/** As colunas de energia: 80 m de altura, 6 m de diâmetro, no centro de 6 crateras. */
export const BEAM = { heightM: 80, widthM: 6, onS: 2, offS: 3 } as const;
export const BEAM_CRATERS = [0, 1, 2, 3, 4, 5] as const;
const BEAM_CYAN: Rgb = [34, 211, 238];
const BEAM_YELLOW: Rgb = [250, 204, 21];

/** Rochas flutuantes: lajes pequenas e não sólidas a 8–24 m do chão, só de enfeite. */
export const FLOATING_ROCKS = 14;
export const ROCK_SIZE_M = [3, 7] as const;
export const ROCK_HEIGHT_M = [2, 4] as const;
export const ROCK_BASE_M = [8, 24] as const;
const ROCK_COLORS: readonly Rgb[] = [
  [176, 104, 74],
  [158, 96, 70],
  [194, 124, 88],
];

const ROCK_COLOR: Rgb = [200, 114, 78];
const SAND_COLOR: Rgb = [242, 206, 132];

/** Cota do planalto de cristas, sem as crateras: 0 nos vales a 60 m nas cristas. */
function plateau(u: number, v: number, n: NoiseKit): number {
  const ridge = n.ridged(n.a, u / RIDGE_SCALE_M, v / RIDGE_SCALE_M, RIDGE_OCTAVES);
  return RELIEF_M * smoothstep(RIDGE_LOW, RIDGE_HIGH, ridge);
}

/** O planalto menos as crateras (rasas e profundas, de bordas vivas). */
function ground(u: number, v: number, n: NoiseKit): number {
  let e = plateau(u, v, n);
  for (const c of CRATERS) {
    const d2 = (u - c.u) ** 2 + (v - c.v) ** 2;
    if (d2 < c.r * c.r) e -= CRATER_DEPTH_FACTOR * c.r * (1 - d2 / (c.r * c.r));
  }
  return e;
}

/** Cota de cada patamar: a média do relevo (com as crateras) sobre o disco de alcance, calculada uma vez por ruído. */
const padLevelCache = new WeakMap<NoiseKit, readonly number[]>();
function padLevels(n: NoiseKit): readonly number[] {
  const cached = padLevelCache.get(n);
  if (cached) return cached;
  const reach = PAD_FLAT_M + PAD_RAMP_M;
  const steps = 8;
  const levels = GCP_PADS.map((p) => {
    let sum = 0;
    let count = 0;
    for (let i = 0; i <= steps; i++) {
      for (let j = 0; j <= steps; j++) {
        const du = (i / steps - 0.5) * 2 * reach;
        const dv = (j / steps - 0.5) * 2 * reach;
        if (du * du + dv * dv > reach * reach) continue;
        sum += ground(p.u + du, p.v + dv, n);
        count++;
      }
    }
    return sum / count;
  });
  padLevelCache.set(n, levels);
  return levels;
}

/** A cratera que contém `(u, v)`, ou `null`. */
export function craterAt(u: number, v: number): Crater | null {
  for (const c of CRATERS) {
    if ((u - c.u) ** 2 + (v - c.v) ** 2 < c.r * c.r) return c;
  }
  return null;
}

export const RIFT_CRATERS: BiomeRecipe = {
  id: 'RIFT_CRATERS',
  palette: {
    cover: {
      GRASS: [140, 190, 90],
      CROP: [180, 190, 90],
      FOREST: [58, 128, 70],
      WATER: [60, 176, 228],
      ROAD: [214, 178, 128],
      ROOF: [204, 92, 82],
      SAND: SAND_COLOR,
      // Rocha cor de brasa: o planalto queimado do torneio.
      ROCK: ROCK_COLOR,
      SWAMP: [92, 144, 98],
      URBAN: [172, 168, 178],
      BENCH: [182, 142, 102],
      LAVA: [244, 104, 42],
      SNOW: [240, 244, 250],
      METAL: [142, 152, 172],
    },
    skyTop: [98, 134, 228],
    skyHorizon: [254, 218, 170],
    fog: [250, 214, 172],
    water: [60, 176, 228],
  },

  // O planalto de cristas, as crateras e, por cima, os patamares dos GCPs, nivelados na cota média
  // do disco (o patamar ignora as crateras: nenhuma chega perto).
  baseElevation(u, v, n) {
    const e = ground(u, v, n);
    const reach = PAD_FLAT_M + PAD_RAMP_M;
    for (let i = 0; i < GCP_PADS.length; i++) {
      const p = GCP_PADS[i] as AoiPoint;
      const du = u - p.u;
      const dv = v - p.v;
      if (du * du + dv * dv >= reach * reach) continue;
      const t = 1 - smoothstep(PAD_FLAT_M, reach, Math.hypot(du, dv));
      return e + ((padLevels(n)[i] as number) - e) * t;
    }
    return e;
  },

  // Areia no fundo das crateras e nas baixadas; rocha no resto.
  landCover(u, v, elev): LandCover {
    const c = craterAt(u, v);
    if (c && Math.hypot(u - c.u, v - c.v) < 0.8 * c.r) return 'SAND';
    return elev < SAND_BELOW_M ? 'SAND' : 'ROCK';
  },

  canopy() {
    return 0;
  },

  ndvi(u, v, cover, n) {
    return (cover === 'SAND' ? 0.05 : 0.07) + 0.02 * n.b(u / 25, v / 25);
  },

  roads() {
    const trail = (v: (u: number) => number): Polyline => {
      const points: AoiPoint[] = [];
      for (let u = -80; u <= 480; u += 40) points.push({ u, v: v(u) });
      return { kind: 'TRAIL', widthM: TRAIL_WIDTH_M, points };
    };
    return [trail(trailSouthV), trail(trailNorthV)];
  },

  placeObjects(ctx, rng) {
    const objects: WorldObject[] = [];
    // Uma coluna no centro de cada uma das 6 maiores crateras, de cores alternadas e ciclos defasados.
    BEAM_CRATERS.forEach((k, i) => {
      const c = CRATERS[k] as Crater;
      objects.push(
        makeObject(ctx.nextId, {
          kind: 'ENERGY_BEAM',
          u: c.u,
          v: c.v,
          widthM: BEAM.widthM,
          depthM: BEAM.widthM,
          heightM: BEAM.heightM,
          color: i % 2 === 0 ? BEAM_CYAN : BEAM_YELLOW,
          activePeriod: {
            onS: BEAM.onS,
            offS: BEAM.offS,
            phase: ((i * (BEAM.onS + BEAM.offS)) / BEAM_CRATERS.length) % (BEAM.onS + BEAM.offS),
          },
        }),
      );
    });
    // Rochas flutuantes: pequenas, soltas no ar e sem colisão.
    const b = ctx.bounds;
    for (let i = 0; i < FLOATING_ROCKS; i++) {
      const w = rng.range(...ROCK_SIZE_M);
      objects.push(
        makeObject(ctx.nextId, {
          kind: 'BRICK_PLATFORM',
          u: rng.range(b.uMin, b.uMax),
          v: rng.range(b.vMin, b.vMax),
          widthM: w,
          depthM: w * rng.range(0.7, 1),
          heightM: rng.range(...ROCK_HEIGHT_M),
          baseM: rng.range(...ROCK_BASE_M),
          rotationRad: rng.range(0, Math.PI),
          color: rng.pick(ROCK_COLORS),
          solid: false,
        }),
      );
    }
    return objects;
  },

  // Os patamares são o único chão plano do planalto.
  guaranteedAccessible: [...GCP_PADS],
};
