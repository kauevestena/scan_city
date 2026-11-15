/**
 * RIFT_CLIFF_TOMBS — R11 "Tumbas dos Desfiladeiros" (terrain §3): um cânion ao longo de `u`, de
 * 170 m de fundo (cota 0–40 m, que sobe e desce) entre dois paredões quase verticais de 10 m de
 * rampa (`100·smoothstep(25, 35, |v − 120| − 60)`, de 60 a 100 m de altura) e o planalto de 100 m
 * por cima. Um rio sinuoso corta o fundo (areia nas margens), as paredes têm estratos de cor, três
 * fachadas de templo (`CLIFF_TEMPLE`) estão esculpidas no pé dos paredões e duas pontes de corda
 * (`WIRE`) ligam as bordas. As cores de bioma são exceção aos tokens (ui-style §1).
 */
import { clamp, smoothstep } from '@/lib/math';
import type { AoiPoint, FeatureTarget, LandCover, Rgb, WorldObject } from '@/types';
import type { NoiseKit } from '../noise';
import { makeObject } from '../objects';
import { type BiomeRecipe, type Polyline } from '../TerrainSampler';

export const PLATEAU_M = 100;
export const CENTER_V = 120;
/** A rampa do paredão: de |v − 120| = 85 (pé) a 95 (topo). */
export const WALL_FROM_M = 25;
export const WALL_TO_M = 35;
const WALL_OFFSET_M = 60;
/** Rugosidade do planalto (±) e do fundo. */
const PLATEAU_ROUGH_M = 1.5;
const FLOOR_ROUGH_M = 0.8;

/**
 * Cota do fundo ao longo do cânion: de 0 a 40 m num ciclo só de 400 m (declive máximo de ~31 %), o
 * que dá paredões de 60 a 100 m e cota média de 20 m.
 */
export const FLOOR_PERIOD_M = 400;
export const FLOOR_MIN_M = 0;
export const FLOOR_MAX_M = 40;
export const floorM = (u: number): number =>
  (FLOOR_MIN_M + FLOOR_MAX_M) / 2 +
  ((FLOOR_MAX_M - FLOOR_MIN_M) / 2) * Math.sin((2 * Math.PI * (u + 40)) / FLOOR_PERIOD_M);

/** Rampa do paredão em `v`: 0 no fundo, 1 no planalto. */
export const wallWeight = (v: number): number =>
  smoothstep(WALL_FROM_M, WALL_TO_M, Math.abs(v - CENTER_V) - WALL_OFFSET_M);

/** Rio sinuoso no fundo do cânion, escavado 3 m, com margens de areia. */
export const RIVER = {
  sway: 14,
  period: 70,
  halfWidthM: 6,
  beachM: 18,
  carveM: 3,
} as const;
export const riverV = (u: number): number => CENTER_V + RIVER.sway * Math.sin(u / RIVER.period);

/** Distância (m) ao eixo do rio, medida na perpendicular. */
export function riverDistance(u: number, v: number): number {
  const slope = (RIVER.sway / RIVER.period) * Math.cos(u / RIVER.period);
  return Math.abs(v - riverV(u)) / Math.sqrt(1 + slope * slope);
}

/** Faixas de estrato nas paredes: alternam a cada 12 m de cota. */
export const STRATA_M = 12;

/** Templos esculpidos no pé dos paredões, voltados para o fundo do cânion. */
export interface Temple {
  u: number;
  v: number;
  widthM: number;
  depthM: number;
  heightM: number;
}
export const TEMPLES: readonly Temple[] = [
  { u: 200, v: 44, widthM: 40, depthM: 12, heightM: 32 },
  { u: 110, v: 196, widthM: 36, depthM: 12, heightM: 28 },
  { u: 315, v: 44, widthM: 34, depthM: 12, heightM: 36 },
];

/** O alvo `TEMPLE_FACADE`: o terraço em frente ao primeiro templo. */
export const TEMPLE_FACADE: FeatureTarget = {
  id: 'TEMPLE_FACADE',
  name: 'Fachada do templo',
  u: 200,
  v: 60,
  radiusM: 20,
  needs: 'PHOTO',
};

/** Pontes de corda de borda a borda: um fio por ponte, 2 m acima do chão de cada ponta. */
export const BRIDGE_US = [90, 300] as const;
export const BRIDGE_ENDS_V = [12, 228] as const;
export const BRIDGE_ABOVE_GROUND_M = 2;

const ROCK_COLOR: Rgb = [188, 118, 86];
const STRATA_COLOR: Rgb = [226, 176, 120];
const TEMPLE_COLOR: Rgb = [230, 184, 128];
const ROPE_COLOR: Rgb = [92, 66, 44];
const POST_COLOR: Rgb = [110, 84, 62];

/** Cota do cânion sem os detalhes de ruído: o fundo, a rampa do paredão e o planalto. */
function canyon(u: number, v: number): number {
  const f = floorM(u);
  return f + (PLATEAU_M - f) * wallWeight(v);
}

function elevationAt(u: number, v: number, n: NoiseKit): number {
  const s = wallWeight(v);
  const rough =
    n.fbm(n.a, u / 30, v / 30, { octaves: 2 }) * (PLATEAU_ROUGH_M * s + FLOOR_ROUGH_M * (1 - s));
  const bed =
    RIVER.carveM *
    (1 - smoothstep(RIVER.halfWidthM, RIVER.halfWidthM * 2.5, riverDistance(u, v))) *
    (1 - s);
  return canyon(u, v) + rough - bed;
}

export const RIFT_CLIFF_TOMBS: BiomeRecipe = {
  id: 'RIFT_CLIFF_TOMBS',
  palette: {
    cover: {
      GRASS: [118, 168, 84],
      CROP: [168, 190, 84],
      FOREST: [58, 128, 70],
      WATER: [60, 176, 228],
      ROAD: [214, 178, 128],
      ROOF: [204, 92, 82],
      // Areia das margens e os estratos claros das paredes.
      SAND: STRATA_COLOR,
      ROCK: ROCK_COLOR,
      SWAMP: [92, 144, 98],
      URBAN: [172, 168, 178],
      BENCH: [182, 142, 102],
      LAVA: [244, 104, 42],
      SNOW: [240, 244, 250],
      METAL: [142, 152, 172],
    },
    skyTop: [118, 168, 232],
    skyHorizon: [252, 228, 192],
    fog: [242, 216, 184],
    water: [60, 176, 228],
  },

  baseElevation(u, v, n) {
    return elevationAt(u, v, n);
  },

  // Rio no meio, areia nas margens e nos estratos das paredes (a cada 12 m de cota), pedra no resto.
  landCover(u, v, elev, n): LandCover {
    const s = wallWeight(v);
    const d = riverDistance(u, v);
    if (s < 0.02) {
      if (d < RIVER.halfWidthM) return 'WATER';
      if (d < RIVER.beachM) return 'SAND';
      return n.b(u / 25, v / 25) > 0.3 ? 'SAND' : 'ROCK';
    }
    // Faixas de estrato só nas paredes e no pé do paredão: alternam com a cota.
    if (s < 0.98) return Math.floor(elev / STRATA_M) % 2 === 0 ? 'ROCK' : 'SAND';
    return 'ROCK';
  },

  canopy() {
    return 0;
  },

  ndvi(u, v, cover, n) {
    switch (cover) {
      case 'WATER':
        return -0.3;
      case 'SAND':
        return 0.06;
      case 'ROAD':
        return 0.08;
      default:
        return clamp(0.1 + 0.03 * n.b(u / 20, v / 20), 0, 0.2);
    }
  },

  // A trilha dos exploradores, pela margem sul do rio.
  roads() {
    const points: AoiPoint[] = [];
    for (let u = -80; u <= 480; u += 20) points.push({ u, v: 96 + 6 * Math.sin(u / 55) });
    return [{ kind: 'TRAIL', widthM: 3, points }] satisfies Polyline[];
  },

  features() {
    return [TEMPLE_FACADE];
  },

  placeObjects(ctx) {
    const objects: WorldObject[] = [];
    for (const t of TEMPLES) {
      objects.push(
        makeObject(ctx.nextId, {
          kind: 'CLIFF_TEMPLE',
          u: t.u,
          v: t.v,
          widthM: t.widthM,
          depthM: t.depthM,
          heightM: t.heightM,
          color: TEMPLE_COLOR,
        }),
      );
    }
    // Pontes de corda: um fio de uma borda à outra, com um poste em cada ponta.
    for (const u of BRIDGE_US) {
      const [v1, v2] = BRIDGE_ENDS_V;
      const u2 = u + 4;
      objects.push(
        makeObject(ctx.nextId, {
          kind: 'WIRE',
          u,
          v: v1,
          u2,
          v2,
          widthM: 0.1,
          depthM: Math.hypot(u2 - u, v2 - v1),
          heightM: BRIDGE_ABOVE_GROUND_M,
          baseM: BRIDGE_ABOVE_GROUND_M,
          color: ROPE_COLOR,
        }),
      );
      for (const [pu, pv] of [
        [u, v1],
        [u2, v2],
      ] as const) {
        objects.push(
          makeObject(ctx.nextId, {
            kind: 'POLE',
            u: pu,
            v: pv,
            widthM: 0.6,
            depthM: 0.6,
            heightM: BRIDGE_ABOVE_GROUND_M + 1.5,
            color: POST_COLOR,
          }),
        );
      }
    }
    return objects;
  },

  // A margem de areia perto do centro: a tinta marca qualquer parede, mas a água continua inválida.
  guaranteedAccessible: [{ u: 200, v: 138 }],
};
