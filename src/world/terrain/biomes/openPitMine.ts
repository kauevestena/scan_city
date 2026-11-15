/**
 * OPEN_PIT_MINE — C04 "Mina a Céu Aberto" (terrain §3): uma cava de 150 m de profundidade (raio de
 * 220 m, no centro da AOI) em 10 bancadas de 15 m, cada uma com berma plana de 8 m e talude de
 * 14 m (cerca de 47°); a borda da cava é irregular (ridged); rampa de acesso em espiral; pilhas
 * cônicas de estéril nos cantos e duas torres de britagem. A rocha nua tem cor própria; as bermas
 * (BENCH) são os únicos pontos onde um GCP pousa. Cores de bioma: exceção permitida (ui-style §1).
 */
import { clamp, smoothstep } from '@/lib/math';
import type { AoiPoint, LandCover, Rgb, WorldObject } from '@/types';
import { makeObject } from '../objects';
import { type BiomeRecipe, type Polyline } from '../TerrainSampler';

/** A cava: centro na AOI de 480 × 320 m, bancadas contadas a partir da borda. */
export const CENTER: AoiPoint = { u: 240, v: 160 };
export const PIT_RADIUS_M = 220;
export const BENCH_HEIGHT_M = 15;
export const BERM_M = 8;
export const FACE_M = 14;
export const BENCH_PITCH_M = BERM_M + FACE_M;
export const BENCHES = 10;
export const DEPTH_M = BENCH_HEIGHT_M * BENCHES;
/** Cota da borda; o fundo da cava fica a 150 m abaixo. */
export const RIM_M = 150;
/** Irregularidade da borda (ridged), só nas bancadas de cima. */
const RIM_ROUGH_M = 9;
const BERM_FRACTION = BERM_M / BENCH_PITCH_M;

/** Pilhas cônicas de estéril (r = 30–50 m, h = 20–35 m), fora da cava. */
export interface Pile {
  u: number;
  v: number;
  radiusM: number;
  heightM: number;
}
export const PILES: readonly Pile[] = [
  { u: 0, v: 20, radiusM: 40, heightM: 30 },
  { u: 480, v: 300, radiusM: 40, heightM: 26 },
  { u: 500, v: 20, radiusM: 32, heightM: 20 },
  { u: -20, v: 310, radiusM: 36, heightM: 24 },
];

/** Torres de britagem (15 × 15 × 30 m) na borda leste e oeste. */
export const CRUSHERS: readonly AoiPoint[] = [
  { u: -12, v: 160 },
  { u: 492, v: 150 },
];

/** Rampa de acesso: desce em espiral da borda ao fundo em 2,5 voltas. */
export const RAMP = { turns: 2.5, startDeg: 200, width: 8, bottomRadiusM: 25 } as const;

const ROCK_COLOR: Rgb = [140, 104, 84];

/** Raio efetivo ao centro, com a borda irregular só no alto da cava. */
function pitRadius(u: number, v: number, ridged: number): number {
  const d = Math.hypot(u - CENTER.u, v - CENTER.v);
  const rim = smoothstep(PIT_RADIUS_M - 70, PIT_RADIUS_M, d);
  return d + RIM_ROUGH_M * (2 * ridged - 1) * rim;
}

/** Bancada fracionária (`t = bancadas desde a borda`), ou `null` fora da cava. */
function benchPosition(dd: number): number | null {
  return dd < PIT_RADIUS_M ? (PIT_RADIUS_M - dd) / BENCH_PITCH_M : null;
}

/** Profundidade (m) abaixo da borda: degraus de 15 m com berma plana e talude suavizado. */
export function pitDepthM(t: number): number {
  const i = Math.floor(t);
  const f = t - i;
  const face = smoothstep(BERM_FRACTION, 1, f);
  return Math.min(DEPTH_M, BENCH_HEIGHT_M * (i + face));
}

const inPile = (u: number, v: number) =>
  PILES.some((p) => Math.hypot(u - p.u, v - p.v) < p.radiusM);

export const OPEN_PIT_MINE: BiomeRecipe = {
  id: 'OPEN_PIT_MINE',
  palette: {
    cover: {
      GRASS: [128, 138, 88],
      CROP: [168, 170, 84],
      FOREST: [58, 118, 60],
      WATER: [58, 108, 150],
      ROAD: [112, 96, 84],
      ROOF: [116, 120, 132],
      SAND: [204, 172, 128],
      ROCK: ROCK_COLOR,
      SWAMP: [92, 110, 74],
      URBAN: [150, 146, 140],
      BENCH: [186, 150, 118],
      LAVA: [220, 90, 40],
      SNOW: [236, 240, 244],
      METAL: [120, 128, 140],
    },
    skyTop: [88, 140, 210],
    skyHorizon: [220, 218, 208],
    fog: [214, 208, 196],
    water: [58, 108, 150],
  },

  // A cava em bancadas (ridged na borda), as pilhas cônicas por cima e uma ondulação mínima.
  baseElevation(u, v, n) {
    const dd = pitRadius(u, v, n.ridged(n.a, u / 80, v / 80, 2));
    const t = benchPosition(dd);
    let elev = RIM_M - (t === null ? 0 : pitDepthM(t));
    for (const p of PILES) {
      const d = Math.hypot(u - p.u, v - p.v);
      if (d < p.radiusM) elev += p.heightM * (1 - d / p.radiusM);
    }
    return elev + 0.4 * n.fbm(n.b, u / 25, v / 25, { octaves: 2 });
  },

  // Bermas (BENCH) e taludes (ROCK) dentro da cava; rocha nua fora dela e areia nas pilhas.
  landCover(u, v, _elev, n): LandCover {
    const t = benchPosition(pitRadius(u, v, n.ridged(n.a, u / 80, v / 80, 2)));
    if (t !== null) return t - Math.floor(t) < BERM_FRACTION || t >= BENCHES ? 'BENCH' : 'ROCK';
    return inPile(u, v) ? 'SAND' : 'ROCK';
  },

  canopy() {
    return 0;
  },

  ndvi(u, v, cover, n) {
    switch (cover) {
      case 'BENCH':
        return 0.04;
      case 'SAND':
        return 0.05;
      case 'ROAD':
      case 'ROOF':
        return 0.05;
      default:
        return clamp(0.03 + 0.02 * n.b(u / 20, v / 20), 0, 0.1);
    }
  },

  // Rampa de acesso em espiral, e a estrada que chega até o começo dela pela margem.
  roads() {
    const r0 = PIT_RADIUS_M - 6;
    const steps = 200;
    const spiral: AoiPoint[] = [];
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const angle = ((RAMP.startDeg + RAMP.turns * 360 * t) * Math.PI) / 180;
      const r = r0 - (r0 - RAMP.bottomRadiusM) * t;
      spiral.push({ u: CENTER.u + r * Math.cos(angle), v: CENTER.v + r * Math.sin(angle) });
    }
    return [
      {
        kind: 'ROAD',
        widthM: RAMP.width,
        points: [{ u: -96, v: 60 }, ...spiral],
      },
    ] satisfies Polyline[];
  },

  placeObjects(ctx) {
    const objects: WorldObject[] = [];
    for (const c of CRUSHERS) {
      objects.push(
        makeObject(ctx.nextId, {
          kind: 'BUILDING',
          u: c.u,
          v: c.v,
          widthM: 15,
          depthM: 15,
          heightM: 30,
          color: [132, 138, 148],
        }),
      );
      // Um galpão de apoio ao lado de cada britador.
      objects.push(
        makeObject(ctx.nextId, {
          kind: 'BUILDING',
          u: c.u,
          v: c.v + 24,
          widthM: 12,
          depthM: 8,
          heightM: 5,
          color: [196, 150, 96],
        }),
      );
    }
    return objects;
  },

  // Pontos garantidamente acessíveis: o fundo da cava e as bermas de algumas bancadas (a borda
  // irregular só mexe nas três primeiras).
  guaranteedAccessible: [
    { u: CENTER.u, v: CENTER.v },
    ...[4, 6, 8].map((i) => ({
      u: CENTER.u + PIT_RADIUS_M - (i + BERM_FRACTION / 2) * BENCH_PITCH_M,
      v: CENTER.v,
    })),
  ],
};
