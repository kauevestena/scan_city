/**
 * RIFT_SANTOS_HOOD — R08 "Bairro dos Santos" (terrain §3): morro ondulado de 20 m (fbm de 2
 * oitavas) coberto por casas baixas coladas (6–12 m de altura) em quadras cortadas por vielas
 * estreitas (4–6 m de largura), com um emaranhado de postes e fios baixos a 8–14 m (`LOW_WIRES`),
 * vagas com palmeiras e uma quadra de basquete nivelada no meio. Céu alaranjado, saturação
 * aumentada como em toda fenda; as cores de bioma são exceção aos tokens (ui-style §1).
 */
import { clamp, smoothstep } from '@/lib/math';
import type { Rng } from '@/lib/rng';
import type { AoiPoint, Rgb, WorldObject } from '@/types';
import type { NoiseKit } from '../noise';
import { makeObject } from '../objects';
import { lowWireLine } from '../ruleGenerators';
import { MARGIN_FRACTION, type BiomeRecipe, type Polyline } from '../TerrainSampler';

export const RELIEF_M = 20;
const RELIEF_SCALE_M = 110;

/** Vielas de eixo `u` constante (norte–sul) e de eixo `v` constante (leste–oeste). */
export const ALLEYS_U = [
  -70, -42, -14, 14, 44, 74, 102, 132, 168, 196, 226, 254, 284, 312, 340, 368,
] as const;
export const ALLEYS_V = [-55, -28, -1, 26, 54, 80, 108, 134, 162, 190, 218, 246, 274] as const;
/** Larguras das vielas (4–6 m), em rodízio fixo. */
const ALLEY_WIDTHS = [4, 5, 6, 4.5, 5.5] as const;
export const alleyWidthU = (i: number): number => ALLEY_WIDTHS[i % ALLEY_WIDTHS.length] as number;
export const alleyWidthV = (j: number): number =>
  ALLEY_WIDTHS[(j + 2) % ALLEY_WIDTHS.length] as number;

export interface Rect {
  uMin: number;
  uMax: number;
  vMin: number;
  vMax: number;
}

/** Miolo da quadra `(k, j)`: o que sobra entre as bordas das quatro vielas que a cercam. */
export function blockRect(k: number, j: number): Rect {
  return {
    uMin: (ALLEYS_U[k] as number) + alleyWidthU(k) / 2,
    uMax: (ALLEYS_U[k + 1] as number) - alleyWidthU(k + 1) / 2,
    vMin: (ALLEYS_V[j] as number) + alleyWidthV(j) / 2,
    vMax: (ALLEYS_V[j + 1] as number) - alleyWidthV(j + 1) / 2,
  };
}

/** A quadra do meio (entre u = 132 e 168, v = 108 e 134) é a quadra de basquete, nivelada. */
export const COURT_BLOCK = { k: 7, j: 6 } as const;
export const COURT: Rect = { uMin: 136, uMax: 164, vMin: 114, vMax: 129 };
export const COURT_CENTER: AoiPoint = { u: 150, v: 121.5 };
const COURT_PAD: Rect = blockRect(COURT_BLOCK.k, COURT_BLOCK.j);
const PAD_FADE_M = 6;

/** Casas: lotes de ~13 × 12,5 m, coladas (0,3 m entre vizinhas), de 6 a 12 m de altura. */
export const HOUSE_HEIGHT_M = [6, 12] as const;
export const LOT_M = { u: 13, v: 12.5 } as const;
export const HOUSE_GAP_M = 0.3;
/** Fração de lotes vagos, cada um com uma palmeira. */
export const VACANT_RATE = 0.06;
export const PALM_CROWN_M = [4, 5] as const;
export const PALM_HEIGHT_M = [8, 12] as const;

const WALLS: readonly Rgb[] = [
  [240, 132, 92],
  [248, 204, 100],
  [124, 184, 226],
  [208, 124, 168],
  [150, 206, 140],
  [236, 164, 80],
  [226, 226, 214],
  [188, 140, 214],
  [244, 120, 120],
  [118, 200, 196],
];
const PALM_COLORS: readonly Rgb[] = [
  [52, 176, 80],
  [38, 156, 92],
  [66, 190, 88],
];
const POLE_COLOR: Rgb = [70, 70, 78];

/** Cota do relevo ondulado, sem a quadra nivelada. */
function groundAt(u: number, v: number, n: NoiseKit): number {
  const wave = n.fbm(n.a, u / RELIEF_SCALE_M, v / RELIEF_SCALE_M, { octaves: 2 });
  return RELIEF_M / 2 + (RELIEF_M / 2) * clamp(1.4 * wave, -1, 1);
}

/** Peso (0–1) do nivelamento: 1 dentro do miolo da quadra de basquete, caindo em 6 m. */
function padWeight(u: number, v: number): number {
  const du = Math.max(COURT_PAD.uMin - u, 0, u - COURT_PAD.uMax);
  const dv = Math.max(COURT_PAD.vMin - v, 0, v - COURT_PAD.vMax);
  const d = Math.hypot(du, dv);
  return d >= PAD_FADE_M ? 0 : 1 - smoothstep(0, PAD_FADE_M, d);
}

export const inCourt = (u: number, v: number): boolean =>
  u >= COURT.uMin && u <= COURT.uMax && v >= COURT.vMin && v <= COURT.vMax;

/** Limites de `n` fatias de `length` com larguras sorteadas entre 75 % e 125 % da média. */
function slices(length: number, n: number, rng: Rng): number[] {
  const weights = Array.from({ length: n }, () => rng.range(0.75, 1.25));
  const total = weights.reduce((a, b) => a + b, 0);
  const cuts = [0];
  let acc = 0;
  for (const w of weights) {
    acc += (w / total) * length;
    cuts.push(acc);
  }
  return cuts;
}

export const RIFT_SANTOS_HOOD: BiomeRecipe = {
  id: 'RIFT_SANTOS_HOOD',
  palette: {
    cover: {
      GRASS: [120, 204, 92],
      CROP: [168, 200, 84],
      FOREST: [38, 142, 66],
      WATER: [62, 160, 238],
      ROAD: [168, 152, 146],
      ROOF: [226, 124, 84],
      SAND: [244, 218, 154],
      ROCK: [156, 146, 164],
      SWAMP: [92, 144, 98],
      URBAN: [204, 176, 152],
      // A quadra de basquete.
      BENCH: [228, 112, 64],
      LAVA: [244, 104, 42],
      SNOW: [240, 244, 250],
      METAL: [142, 152, 172],
    },
    skyTop: [236, 128, 90],
    skyHorizon: [252, 206, 152],
    fog: [248, 202, 160],
    water: [62, 160, 238],
  },

  // Morro ondulado de 0–20 m, com a quadra de basquete nivelada na cota do seu centro.
  baseElevation(u, v, n) {
    const e = groundAt(u, v, n);
    const t = padWeight(u, v);
    if (t <= 0) return e;
    return e + (groundAt(COURT_CENTER.u, COURT_CENTER.v, n) - e) * t;
  },

  // Telhados (ROOF) e vielas (ROAD) vêm do sampler; sobram a quadra e o piso de concreto.
  landCover(u, v) {
    return inCourt(u, v) ? 'BENCH' : 'URBAN';
  },

  canopy() {
    return 0;
  },

  ndvi(u, v, cover, n) {
    switch (cover) {
      case 'ROAD':
        return 0.06;
      case 'ROOF':
        return 0.04;
      case 'BENCH':
        return 0.05;
      default:
        return 0.12 + 0.04 * n.b(u / 15, v / 15);
    }
  },

  roads(aoi) {
    const m = MARGIN_FRACTION;
    const uMin = -m * aoi.lengthM;
    const uMax = (1 + m) * aoi.lengthM;
    const vMin = -m * aoi.widthM;
    const vMax = (1 + m) * aoi.widthM;
    return [
      ...ALLEYS_U.map<Polyline>((u, i) => ({
        kind: 'ROAD',
        widthM: alleyWidthU(i),
        points: [
          { u, v: vMin },
          { u, v: vMax },
        ],
      })),
      ...ALLEYS_V.map<Polyline>((v, j) => ({
        kind: 'ROAD',
        widthM: alleyWidthV(j),
        points: [
          { u: uMin, v },
          { u: uMax, v },
        ],
      })),
    ];
  },

  placeObjects(ctx, rng) {
    const objects: WorldObject[] = [];
    const b = ctx.bounds;
    const inBounds = (u: number, v: number) =>
      u >= b.uMin && u <= b.uMax && v >= b.vMin && v <= b.vMax;

    const lot = (rect: Rect) => {
      const u = (rect.uMin + rect.uMax) / 2;
      const v = (rect.vMin + rect.vMax) / 2;
      // O sorteio roda em todo lote, dentro ou fora dos limites: a seed decide o bairro inteiro.
      const heightM = rng.range(...HOUSE_HEIGHT_M);
      const color = rng.pick(WALLS);
      const vacant = rng.next() < VACANT_RATE;
      const crownM = rng.range(...PALM_CROWN_M);
      const palmM = rng.range(...PALM_HEIGHT_M);
      const palmColor = rng.pick(PALM_COLORS);
      if (!inBounds(u, v)) return;
      if (vacant) {
        objects.push(
          makeObject(ctx.nextId, {
            kind: 'TREE',
            u,
            v,
            widthM: crownM,
            depthM: crownM,
            heightM: palmM,
            color: palmColor,
          }),
        );
        return;
      }
      objects.push(
        makeObject(ctx.nextId, {
          kind: 'BUILDING',
          u,
          v,
          widthM: rect.uMax - rect.uMin - HOUSE_GAP_M,
          depthM: rect.vMax - rect.vMin - HOUSE_GAP_M,
          heightM,
          color,
        }),
      );
    };

    for (let k = 0; k + 1 < ALLEYS_U.length; k++) {
      for (let j = 0; j + 1 < ALLEYS_V.length; j++) {
        if (k === COURT_BLOCK.k && j === COURT_BLOCK.j) continue;
        const r = blockRect(k, j);
        const nU = Math.max(1, Math.round((r.uMax - r.uMin) / LOT_M.u));
        const nV = Math.max(1, Math.round((r.vMax - r.vMin) / LOT_M.v));
        const cutsU = slices(r.uMax - r.uMin, nU, rng);
        const cutsV = slices(r.vMax - r.vMin, nV, rng);
        for (let a = 0; a < nU; a++) {
          for (let c = 0; c < nV; c++) {
            lot({
              uMin: r.uMin + (cutsU[a] as number),
              uMax: r.uMin + (cutsU[a + 1] as number),
              vMin: r.vMin + (cutsV[c] as number),
              vMax: r.vMin + (cutsV[c + 1] as number),
            });
          }
        }
      }
    }

    // A quadra de basquete: duas tabelas de 3,2 m nas pontas (não sólidas) e uma palmeira em cada
    // canto do miolo da quadra.
    for (const u of [COURT.uMin + 1.5, COURT.uMax - 1.5]) {
      objects.push(
        makeObject(ctx.nextId, {
          kind: 'POLE',
          u,
          v: COURT_CENTER.v,
          widthM: 0.3,
          depthM: 0.3,
          heightM: 3.2,
          color: POLE_COLOR,
          solid: false,
        }),
      );
    }
    for (const u of [COURT.uMin + 1.5, COURT.uMax - 1.5]) {
      for (const v of [COURT_PAD.vMin + 1.5, COURT_PAD.vMax - 1.5]) {
        objects.push(
          makeObject(ctx.nextId, {
            kind: 'TREE',
            u,
            v,
            widthM: 3,
            depthM: 3,
            heightM: 9,
            color: PALM_COLORS[0] as Rgb,
          }),
        );
      }
    }

    // Emaranhado de fios baixos: uma linha de postes à beira de cada viela norte–sul e de cada
    // viela leste–oeste alternada, a 8–14 m (`LOW_WIRES`).
    const wires = rng.fork('wires');
    const line = (pts: AoiPoint[], label: string) => {
      const { poles, wires: segments } = lowWireLine(pts, wires.fork(label), ctx.nextId);
      objects.push(...poles, ...segments);
    };
    ALLEYS_U.forEach((u, i) => {
      const edge = u + alleyWidthU(i) / 2 - 0.8;
      line(
        [
          { u: edge, v: b.vMin },
          { u: edge, v: b.vMax },
        ],
        `u${i}`,
      );
    });
    ALLEYS_V.forEach((v, j) => {
      if (j % 2 !== 0) return;
      const edge = v + alleyWidthV(j) / 2 - 0.8;
      line(
        [
          { u: b.uMin, v: edge },
          { u: b.uMax, v: edge },
        ],
        `v${j}`,
      );
    });
    return objects;
  },

  // A quadra de basquete, aberta no meio das casas, é o ponto de apoio garantido.
  guaranteedAccessible: [{ u: 150, v: 120 }],
};
