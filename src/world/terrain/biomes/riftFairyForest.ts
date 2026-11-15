/**
 * RIFT_FAIRY_FOREST — R04 "Bosque das Fadas Perdidas" (terrain §3): uma floresta antiga de dossel
 * 0,95 (troncos gigantes, uma copa de 14–20 m a cada ~16 m), relevo de até 30 m (fbm), cinco
 * clareiras fixas, trilhas ligando as clareiras, cogumelos luminosos (decorativos) e, soterrado em
 * (300, 200), o platô do templo: +3 m de chão num raio de 30 m que só o MDT (os retornos de solo do
 * LiDAR) mostra, porque as copas, 7 a 10 vezes mais altas, escondem o resto. A zona `FOG` de
 * densidade 0,9 cobre tudo. As cores de bioma são exceção aos tokens (ui-style §1).
 */
import { clamp, smoothstep } from '@/lib/math';
import type { AoiPoint, FeatureTarget, LandCover, Rgb, SpecialZone, WorldObject } from '@/types';
import type { NoiseKit } from '../noise';
import { makeObject } from '../objects';
import { distanceToPolyline, type BiomeRecipe, type Polyline } from '../TerrainSampler';

/** Alívio do terreno (a ficha pede 30 m). */
export const RELIEF_M = 30;
const RELIEF_SCALE_M = 180;
/** Ganho do ruído: com ele o terreno usa os 30 m de alívio quase por inteiro. */
const RELIEF_GAIN = 2;

/** O templo soterrado: um platô de +3 m num raio de 30 m, com 6 m de rampa na borda. */
export const TEMPLE_AT: AoiPoint = { u: 300, v: 200 };
export const TEMPLE_RADIUS_M = 30;
export const TEMPLE_HEIGHT_M = 3;
export const TEMPLE_RAMP_M = 6;
/** O alvo `TEMPLE`: só o LiDAR o captura (≥ 50 pulsos/m² na célula do centro). */
export const TEMPLE_FEATURE: FeatureTarget = {
  id: 'TEMPLE',
  name: 'Templo do Triângulo Geodésico Dourado',
  u: TEMPLE_AT.u,
  v: TEMPLE_AT.v,
  radiusM: TEMPLE_RADIUS_M,
  needs: 'LIDAR',
};

/** Peso do platô do templo em `(u, v)`: 1 no topo, 0 fora do raio. */
export function templeWeight(u: number, v: number): number {
  const d = Math.hypot(u - TEMPLE_AT.u, v - TEMPLE_AT.v);
  return 1 - smoothstep(TEMPLE_RADIUS_M - TEMPLE_RAMP_M, TEMPLE_RADIUS_M, d);
}

/** Dossel da floresta (0,95 ± 0,01). */
export const FOREST_CANOPY = 0.95;

/** As 5 clareiras fixas (raio de 22–30 m, dossel 0): os únicos lugares onde um GCP cabe. */
export interface Clearing {
  u: number;
  v: number;
  r: number;
}
export const CLEARINGS: readonly Clearing[] = [
  { u: 90, v: 80, r: 28 },
  { u: 510, v: 80, r: 26 },
  { u: 90, v: 320, r: 30 },
  { u: 510, v: 320, r: 24 },
  { u: 300, v: 350, r: 22 },
];

/** Cada clareira é um disco plano na cota média dele, com 12 m de rampa por fora (o GCP exige declive de ≤ 30 %). */
export const CLEARING_RAMP_M = 12;

/** Clareira que contém (u, v), se houver. */
export function clearingAt(u: number, v: number, extraM = 0): Clearing | undefined {
  return CLEARINGS.find((c) => Math.hypot(u - c.u, v - c.v) < c.r + extraM);
}

/** Trilhas de terra de 3 m que ligam as clareiras (a pé se chega a qualquer ponto). */
export const TRAIL_WIDTH_M = 3;
const TRAILS: readonly (readonly AoiPoint[])[] = [
  [
    { u: -120, v: 80 },
    { u: 90, v: 80 },
    { u: 300, v: 110 },
    { u: 510, v: 80 },
    { u: 720, v: 80 },
  ],
  [
    { u: -120, v: 320 },
    { u: 90, v: 320 },
    { u: 300, v: 350 },
    { u: 510, v: 320 },
    { u: 720, v: 320 },
  ],
  [
    { u: 90, v: 80 },
    { u: 90, v: 200 },
    { u: 90, v: 320 },
  ],
  [
    { u: 510, v: 80 },
    { u: 510, v: 200 },
    { u: 510, v: 320 },
  ],
];

/** Árvores gigantes: uma por célula de 16 m, de 30 a 50 m de altura e copa de 14 a 20 m. */
export const TREE_SPACING_M = 16;
export const TREE_HEIGHT_M = [30, 50] as const;
export const TREE_CROWN_M = [14, 20] as const;
const TREE_COLORS: readonly Rgb[] = [
  [24, 98, 92],
  [30, 112, 84],
  [38, 92, 112],
  [28, 84, 100],
];

/** Cogumelos luminosos: 6 por clareira e 30 à beira das trilhas, só de enfeite (caule e chapéu não sólidos). */
export const MUSHROOMS_PER_CLEARING = 6;
export const TRAIL_MUSHROOMS = 30;
export const STALK = { widthM: 0.7, heightM: 1.6 } as const;
export const CAP = { widthM: 2.6, heightM: 0.8 } as const;
const GLOW_COLORS: readonly Rgb[] = [
  [236, 72, 153],
  [34, 211, 238],
  [167, 139, 250],
  [163, 230, 53],
];
const STALK_COLOR: Rgb = [226, 220, 236];

/** O relevo do bosque sem as clareiras nem o templo: 0–30 m. */
function rawGround(u: number, v: number, n: NoiseKit): number {
  const wave = n.fbm(n.a, u / RELIEF_SCALE_M, v / RELIEF_SCALE_M, { octaves: 4 });
  return RELIEF_M * (0.5 + 0.5 * clamp(RELIEF_GAIN * wave, -1, 1));
}

/** Cota de cada clareira: a média do relevo sobre o disco dela (uma vez por ruído). */
const levelCache = new WeakMap<NoiseKit, readonly number[]>();
function clearingLevels(n: NoiseKit): readonly number[] {
  const cached = levelCache.get(n);
  if (cached) return cached;
  const steps = 6;
  const levels = CLEARINGS.map((c) => {
    let sum = 0;
    let count = 0;
    for (let i = 0; i <= steps; i++) {
      for (let j = 0; j <= steps; j++) {
        const du = (i / steps - 0.5) * 2 * c.r;
        const dv = (j / steps - 0.5) * 2 * c.r;
        if (du * du + dv * dv > c.r * c.r) continue;
        sum += rawGround(c.u + du, c.v + dv, n);
        count++;
      }
    }
    return sum / count;
  });
  levelCache.set(n, levels);
  return levels;
}

const trailLines = (): Polyline[] =>
  TRAILS.map((points) => ({ kind: 'TRAIL' as const, widthM: TRAIL_WIDTH_M, points }));

export const RIFT_FAIRY_FOREST: BiomeRecipe = {
  id: 'RIFT_FAIRY_FOREST',
  palette: {
    cover: {
      GRASS: [120, 214, 130],
      CROP: [160, 220, 110],
      FOREST: [26, 108, 104],
      WATER: [90, 150, 230],
      ROAD: [200, 170, 214],
      ROOF: [204, 92, 82],
      SAND: [226, 208, 170],
      ROCK: [140, 132, 170],
      SWAMP: [80, 140, 120],
      URBAN: [172, 168, 178],
      BENCH: [182, 142, 102],
      LAVA: [244, 104, 42],
      SNOW: [240, 244, 250],
      METAL: [142, 152, 172],
    },
    skyTop: [84, 58, 150],
    skyHorizon: [196, 156, 232],
    fog: [168, 128, 214],
    water: [90, 150, 230],
  },

  // Relevo de até 30 m, as clareiras niveladas e o platô do templo (+3 m) soterrado sob a floresta.
  baseElevation(u, v, n) {
    let e = rawGround(u, v, n);
    for (let k = 0; k < CLEARINGS.length; k++) {
      const c = CLEARINGS[k] as Clearing;
      const d = Math.hypot(u - c.u, v - c.v);
      if (d >= c.r + CLEARING_RAMP_M) continue;
      const t = 1 - smoothstep(c.r, c.r + CLEARING_RAMP_M, d);
      e += ((clearingLevels(n)[k] as number) - e) * t;
      break;
    }
    const t = templeWeight(u, v);
    return t > 0 ? e + TEMPLE_HEIGHT_M * t : e;
  },

  // Floresta em tudo, menos nas clareiras.
  landCover(u, v): LandCover {
    return clearingAt(u, v) ? 'GRASS' : 'FOREST';
  },

  canopy(u, v, cover, n) {
    return cover === 'FOREST' ? clamp(FOREST_CANOPY + 0.01 * n.b(u / 30, v / 30), 0.94, 0.96) : 0;
  },

  ndvi(u, v, cover, n) {
    return cover === 'GRASS' ? 0.62 + 0.05 * n.b(u / 15, v / 15) : 0.8 + 0.04 * n.b(u / 25, v / 25);
  },

  roads() {
    return trailLines();
  },

  placeObjects(ctx, rng) {
    const objects: WorldObject[] = [];
    const b = ctx.bounds;
    const s = TREE_SPACING_M;
    const trails = ctx.roads as readonly Polyline[];
    const nearTrail = (u: number, v: number, m: number) =>
      trails.some((r) => distanceToPolyline({ u, v }, r) < TRAIL_WIDTH_M / 2 + m);
    // Árvores gigantes: o sorteio roda em toda célula, então a seed determina a mata inteira.
    for (let u = b.uMin + s / 2; u < b.uMax; u += s) {
      for (let v = b.vMin + s / 2; v < b.vMax; v += s) {
        const ju = u + rng.range(-4, 4);
        const jv = v + rng.range(-4, 4);
        const heightM = rng.range(...TREE_HEIGHT_M);
        const crown = rng.range(...TREE_CROWN_M);
        const color = rng.pick(TREE_COLORS);
        // A copa não pode invadir a clareira nem cobrir a trilha: sai a meia copa (mais 1 m) de distância.
        if (clearingAt(ju, jv, crown / 2 + 1) || nearTrail(ju, jv, crown / 2 + 1)) continue;
        objects.push(
          makeObject(ctx.nextId, {
            kind: 'TREE',
            u: ju,
            v: jv,
            widthM: crown,
            depthM: crown,
            heightM,
            color,
          }),
        );
      }
    }
    // Cogumelos luminosos: um caule e um chapéu (dois cilindros), de cor viva e sem colisão.
    const mushroom = (u: number, v: number) => {
      const color = rng.pick(GLOW_COLORS);
      objects.push(
        makeObject(ctx.nextId, {
          kind: 'PIPE',
          u,
          v,
          widthM: STALK.widthM,
          depthM: STALK.widthM,
          heightM: STALK.heightM,
          color: STALK_COLOR,
          solid: false,
        }),
        makeObject(ctx.nextId, {
          kind: 'PIPE',
          u,
          v,
          widthM: CAP.widthM,
          depthM: CAP.widthM,
          heightM: CAP.heightM,
          baseM: STALK.heightM,
          color,
          solid: false,
        }),
      );
    };
    for (const c of CLEARINGS) {
      for (let k = 0; k < MUSHROOMS_PER_CLEARING; k++) {
        const a = rng.range(0, 2 * Math.PI);
        const d = rng.range(0.3, 0.9) * c.r;
        mushroom(c.u + d * Math.cos(a), c.v + d * Math.sin(a));
      }
    }
    for (let k = 0; k < TRAIL_MUSHROOMS; k++) {
      const line = trails[rng.int(0, trails.length - 1)] as Polyline;
      const i = rng.int(1, line.points.length - 1);
      const p0 = line.points[i - 1] as AoiPoint;
      const p1 = line.points[i] as AoiPoint;
      const t = rng.next();
      const side = rng.next() < 0.5 ? -1 : 1;
      const len = Math.hypot(p1.u - p0.u, p1.v - p0.v) || 1;
      const off = side * rng.range(3, 6);
      const u = p0.u + (p1.u - p0.u) * t - ((p1.v - p0.v) / len) * off;
      const v = p0.v + (p1.v - p0.v) * t + ((p1.u - p0.u) / len) * off;
      if (!clearingAt(u, v)) mushroom(u, v);
    }
    return objects;
  },

  features() {
    return [TEMPLE_FEATURE];
  },

  // Névoa mágica densa sobre todo o bosque.
  zones(): SpecialZone[] {
    return [{ kind: 'FOG', density: 0.9 }];
  },

  guaranteedAccessible: CLEARINGS.map((c) => ({ u: c.u, v: c.v })),
};
