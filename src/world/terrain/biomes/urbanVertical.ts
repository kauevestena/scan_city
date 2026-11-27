/**
 * URBAN_VERTICAL — C01 "Metrópole Vertical" (terrain §3): relevo plano com 10 m de variação,
 * grade de ruas a cada 60–80 m, quadras com 2–6 prédios de 10–65 m (≥ 20 % acima de 45 m, e o
 * mais alto da AOI com 65 m: o Atlas, que voa até 83 m pelo GSD do contrato, passa por cima;
 * ADR-035), praça de grama no centro e as zonas `RTK_CANYON` calculadas entre os arranha-céus. As cores dos biomas são exceção permitida aos tokens (ui-style §1).
 */
import { clamp } from '@/lib/math';
import type { Rng } from '@/lib/rng';
import type { AoiPoint, Rgb, WorldObject } from '@/types';
import { RULE_PARAMS } from '@/domain/specialRules';
import { makeObject } from '../objects';
import { rtkCanyonZones } from '../ruleGenerators';
import { MARGIN_FRACTION, type BiomeRecipe, type Polyline } from '../TerrainSampler';

/** Largura das ruas e espaçamento entre elas (contracts-real C01: "a cada 60–80 m"). */
export const STREET_WIDTH_M = 10;
export const STREET_SPACING_M = [60, 80] as const;
/** Calçada entre a rua e o prédio, e beco entre prédios da mesma quadra. */
const SIDEWALK_M = 2;
const ALLEY_M = 3;
/** Praça central (a quadra do meio da AOI de 360 × 240 m): grama, sem prédios. */
export const PLAZA = { uMin: 150, uMax: 210, vMin: 90, vMax: 150 } as const;
export const PLAZA_CENTER: AoiPoint = {
  u: (PLAZA.uMin + PLAZA.uMax) / 2,
  v: (PLAZA.vMin + PLAZA.vMax) / 2,
};
/** Prédios altos: acima de 45 m (o limite do cânion); a fatia mínima é de 20 %, a meta, 25 %. */
export const TALL_MIN_M = RULE_PARAMS.rtkCanyon.minBuildingHeightM;
export const TALL_SHARE = 0.25;
/** O prédio mais alto da AOI: o briefing manda voar acima de 65 m. */
export const TALLEST_BUILDING_M = 65;
export const RELIEF_M = 10;
const RELIEF_SCALE_M = 260;
const BUILDINGS_PER_BLOCK = [2, 6] as const;

const inPlaza = (u: number, v: number) =>
  u >= PLAZA.uMin && u <= PLAZA.uMax && v >= PLAZA.vMin && v <= PLAZA.vMax;

interface Rect {
  uMin: number;
  uMax: number;
  vMin: number;
  vMax: number;
}

/**
 * Ruas de um eixo, de `min` a `max`: ancoradas nas duas ruas que cercam a praça (`lo`, `hi`) e
 * espaçadas de 60 a 80 m dali para fora, com uma rua além de cada borda para que as quadras
 * cubram toda a margem.
 */
export function streetPositions(
  min: number,
  max: number,
  lo: number,
  hi: number,
  rng: Rng,
): number[] {
  const out = [lo, hi];
  const [near, far] = STREET_SPACING_M;
  for (let p = lo; p > min;) {
    p -= rng.range(near, far);
    out.unshift(p);
  }
  for (let p = hi; p < max;) {
    p += rng.range(near, far);
    out.push(p);
  }
  return out;
}

/** Ruas (retas ao longo de `v` ou de `u`) recuperadas da rede viária. */
function gridOf(roads: readonly Polyline[]): { us: number[]; vs: number[] } {
  const us: number[] = [];
  const vs: number[] = [];
  for (const road of roads) {
    const [a, b] = road.points as readonly [AoiPoint, AoiPoint];
    if (a.u === b.u) us.push(a.u);
    else vs.push(a.v);
  }
  return { us: us.sort((x, y) => x - y), vs: vs.sort((x, y) => x - y) };
}

/** Divide o miolo da quadra em `n` lotes, cortando sempre o lado maior. */
function splitLots(rect: Rect, n: number, rng: Rng): Rect[] {
  if (n <= 1) return [rect];
  const nA = Math.floor(n / 2);
  const share = nA / n + rng.range(-0.08, 0.08);
  const width = rect.uMax - rect.uMin;
  const depth = rect.vMax - rect.vMin;
  if (width >= depth) {
    const cut = rect.uMin + width * share;
    return [
      ...splitLots({ ...rect, uMax: cut }, nA, rng),
      ...splitLots({ ...rect, uMin: cut }, n - nA, rng),
    ];
  }
  const cut = rect.vMin + depth * share;
  return [
    ...splitLots({ ...rect, vMax: cut }, nA, rng),
    ...splitLots({ ...rect, vMin: cut }, n - nA, rng),
  ];
}

/** `10 + 55·r³`: a altura do prédio de sorteio `r` (terrain §3). */
export const buildingHeightM = (r: number): number => 10 + 55 * r ** 3;

/** Cor do prédio pela faixa de altura: casario baixo, concreto, vidro azulado. */
function buildingColor(heightM: number, rng: Rng): Rgb {
  const j = Math.round(rng.range(-8, 8));
  if (heightM < 25) return [196 + j, 176 + j, 150 + j];
  if (heightM <= TALL_MIN_M) return [172 + j, 174 + j, 178 + j];
  return [92 + j, 128 + j, 166 + j];
}

const TREE: Rgb = [58, 120, 62];

export const URBAN_VERTICAL: BiomeRecipe = {
  id: 'URBAN_VERTICAL',
  palette: {
    cover: {
      GRASS: [108, 156, 84],
      CROP: [168, 170, 84],
      FOREST: [58, 118, 60],
      WATER: [58, 108, 150],
      ROAD: [72, 74, 82],
      ROOF: [140, 132, 128],
      SAND: [214, 196, 150],
      ROCK: [130, 126, 118],
      SWAMP: [92, 110, 74],
      URBAN: [176, 174, 168],
      BENCH: [150, 120, 96],
      LAVA: [220, 90, 40],
      SNOW: [236, 240, 244],
      METAL: [120, 128, 140],
    },
    skyTop: [88, 136, 206],
    skyHorizon: [214, 224, 234],
    fog: [204, 212, 220],
    water: [58, 108, 150],
  },

  // Plano, com até 10 m de variação lenta (o "relevo" do contrato, fora os prédios).
  baseElevation(u, v, n) {
    const wave = n.fbm(n.a, u / RELIEF_SCALE_M, v / RELIEF_SCALE_M, { octaves: 2 });
    // O fbm raramente passa de ±0,6: o ganho de 1,5 usa melhor a faixa de 10 m.
    return RELIEF_M * (0.5 + 0.5 * clamp(1.5 * wave, -1, 1));
  },

  // Os telhados (ROOF) e as ruas (ROAD) vêm do sampler; sobra a praça de grama e o concreto.
  landCover(u, v) {
    return inPlaza(u, v) ? 'GRASS' : 'URBAN';
  },

  canopy() {
    return 0;
  },

  ndvi(u, v, cover, n) {
    switch (cover) {
      case 'GRASS':
        return 0.6 + 0.06 * n.b(u / 15, v / 15);
      case 'ROAD':
        return 0.04;
      case 'ROOF':
        return 0.03;
      default:
        return 0.1 + 0.04 * n.b(u / 25, v / 25);
    }
  },

  roads(aoi, rng) {
    const m = MARGIN_FRACTION;
    const uMin = -m * aoi.lengthM;
    const uMax = (1 + m) * aoi.lengthM;
    const vMin = -m * aoi.widthM;
    const vMax = (1 + m) * aoi.widthM;
    const half = STREET_WIDTH_M / 2;
    const us = streetPositions(uMin, uMax, PLAZA.uMin - half, PLAZA.uMax + half, rng.fork('u'));
    const vs = streetPositions(vMin, vMax, PLAZA.vMin - half, PLAZA.vMax + half, rng.fork('v'));
    return [
      ...us.map<Polyline>((u) => ({
        kind: 'ROAD',
        widthM: STREET_WIDTH_M,
        points: [
          { u, v: vMin },
          { u, v: vMax },
        ],
      })),
      ...vs.map<Polyline>((v) => ({
        kind: 'ROAD',
        widthM: STREET_WIDTH_M,
        points: [
          { u: uMin, v },
          { u: uMax, v },
        ],
      })),
    ];
  },

  placeObjects(ctx, rng) {
    const { us, vs } = gridOf(ctx.roads);
    const inset = STREET_WIDTH_M / 2 + SIDEWALK_M;
    const center = (r: Rect): AoiPoint => ({ u: (r.uMin + r.uMax) / 2, v: (r.vMin + r.vMax) / 2 });
    const inAoi = (r: Rect) => {
      const c = center(r);
      return c.u >= 0 && c.u <= ctx.aoi.lengthM && c.v >= 0 && c.v <= ctx.aoi.widthM;
    };
    const inBounds = (r: Rect) => {
      const c = center(r);
      const b = ctx.bounds;
      return c.u >= b.uMin && c.u <= b.uMax && c.v >= b.vMin && c.v <= b.vMax;
    };

    // Lotes de cada quadra (menos a praça), com um beco entre vizinhos.
    const lots: Rect[] = [];
    for (let k = 0; k + 1 < us.length; k++) {
      for (let j = 0; j + 1 < vs.length; j++) {
        const block: Rect = {
          uMin: (us[k] as number) + inset,
          uMax: (us[k + 1] as number) - inset,
          vMin: (vs[j] as number) + inset,
          vMax: (vs[j + 1] as number) - inset,
        };
        // A praça fica sem prédios. O sorteio roda mesmo fora dos limites, para que a seed
        // determine a cidade inteira independentemente do recorte.
        const plaza = inPlaza(center(block).u, center(block).v);
        for (const lot of splitLots(block, rng.int(...BUILDINGS_PER_BLOCK), rng)) {
          const a = ALLEY_M / 2;
          const footprint = {
            uMin: lot.uMin + a,
            uMax: lot.uMax - a,
            vMin: lot.vMin + a,
            vMax: lot.vMax - a,
          };
          if (!plaza && inBounds(footprint)) lots.push(footprint);
        }
      }
    }

    // A fatia de prédios altos vale dentro da AOI e fora dela: sorteia os altos em cada grupo.
    const tall = new Set<number>();
    for (const group of [true, false]) {
      const ids = lots.flatMap((lot, i) => (inAoi(lot) === group ? [i] : []));
      for (const i of rng.shuffle(ids).slice(0, Math.ceil(TALL_SHARE * ids.length))) tall.add(i);
    }
    // O mais alto da AOI fica com exatamente 65 m (a nota do briefing).
    const landmark = lots.findIndex((lot, i) => tall.has(i) && inAoi(lot));

    const objects: WorldObject[] = [];
    lots.forEach((lot, i) => {
      // Altos: r ∈ [0,87; 0,995) → 46,2–64,2 m. Baixos: r ≤ 0,85 → no máximo 43,8 m.
      const r = tall.has(i) ? rng.range(0.87, 0.995) : rng.range(0.05, 0.85);
      const heightM = i === landmark ? TALLEST_BUILDING_M : buildingHeightM(r);
      objects.push(
        makeObject(ctx.nextId, {
          kind: 'BUILDING',
          u: (lot.uMin + lot.uMax) / 2,
          v: (lot.vMin + lot.vMax) / 2,
          widthM: lot.uMax - lot.uMin,
          depthM: lot.vMax - lot.vMin,
          heightM,
          color: buildingColor(heightM, rng),
        }),
      );
    });

    // Dez árvores na praça, deixando livre o miolo (ponto de apoio garantido).
    let placed = 0;
    for (let attempts = 0; placed < 10 && attempts < 200; attempts++) {
      const u = rng.range(PLAZA.uMin + 5, PLAZA.uMax - 5);
      const v = rng.range(PLAZA.vMin + 5, PLAZA.vMax - 5);
      if (Math.hypot(u - PLAZA_CENTER.u, v - PLAZA_CENTER.v) < 10) continue;
      objects.push(
        makeObject(ctx.nextId, {
          kind: 'TREE',
          u,
          v,
          widthM: rng.range(5, 8),
          depthM: 6,
          heightM: rng.range(7, 11),
          color: TREE,
        }),
      );
      placed++;
    }
    return objects;
  },

  // Cânions de RTK: onde dois prédios > 45 m ficam a < 40 m um do outro.
  zones: (objects) => rtkCanyonZones(objects),

  guaranteedAccessible: [PLAZA_CENTER],
};
