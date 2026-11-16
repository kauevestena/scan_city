/**
 * COLONIAL_CENTER — C05 "Centro Histórico Colonial" (terrain §3): ladeira de 25 m (plano
 * inclinado ao longo de `u` mais um fbm leve), ruas de pedra de 7 m a cada ~54 m, casarões de
 * dois pavimentos (8–10 m) em fileira ao longo das quadras, quintais de grama, a igreja matriz
 * (nave de 30 × 20 × 18 m e duas torres de 35 m) no largo central e, ao longo das ruas, postes
 * com fios a 8–14 m (`LOW_WIRES`). As cores dos biomas são exceção permitida aos tokens (ui-style §1).
 */
import type { Rng } from '@/lib/rng';
import type { AoiPoint, Rgb, WorldObject } from '@/types';
import { makeObject } from '../objects';
import { lowWireLine } from '../ruleGenerators';
import { MARGIN_FRACTION, type BiomeRecipe, type Polyline } from '../TerrainSampler';

/** Ruas de pedra: eixos de `u` constante e de `v` constante, a ~54 m uma da outra. */
export const STREET_WIDTH_M = 7;
export const STREETS = [-60, -6, 48, 102, 156, 210] as const;
/** A quadra do meio (u e v em [48, 102]) é a da igreja e do largo. */
const CENTER_BLOCK = 2;
/** Ladeira: sobe 25 m ao longo dos 150 m de `u` da AOI (e segue subindo na margem). */
export const SLOPE_RISE_M = 25;
const SLOPE_BASE_M = 6;
const AOI_LENGTH_M = 150;
const RIPPLE_M = 1.5;
const RIPPLE_SCALE_M = 80;

/** Casarões: faixa de 13 m de profundidade ao longo de cada lado da quadra. */
export const HOUSE_DEPTH_M = 13;
export const HOUSE_HEIGHT_M = [8, 10] as const;
const HOUSE_FRONTAGE_M = 10.5;
const HOUSE_GAP_M = 0.8;

/** Igreja matriz: nave voltada para o largo (ao sul) e duas torres na fachada. */
export const CHURCH = {
  nave: { u: 75, v: 63, widthM: 30, depthM: 20, heightM: 18 },
  tower: { widthM: 5, depthM: 5, heightM: 35 },
  towerV: 75.5,
  towerU: [62.5, 87.5],
} as const;
/** Largo da matriz: piso de pedra aberto, ponto de apoio garantido no meio. */
export const LARGO_CENTER: AoiPoint = { u: 75, v: 90 };

const FACADES: readonly Rgb[] = [
  [232, 196, 120],
  [214, 120, 104],
  [142, 170, 196],
  [236, 226, 204],
  [176, 196, 148],
  [222, 170, 138],
  [188, 148, 170],
  [240, 214, 160],
];
const CHURCH_WALL: Rgb = [238, 230, 212];
const TREE: Rgb = [62, 122, 66];

interface Rect {
  uMin: number;
  uMax: number;
  vMin: number;
  vMax: number;
}

/** Miolo de cada quadra (entre os meios-fios), com a posição na grade. */
function blocks(): { rect: Rect; k: number; j: number }[] {
  const half = STREET_WIDTH_M / 2;
  const out: { rect: Rect; k: number; j: number }[] = [];
  for (let k = 0; k + 1 < STREETS.length; k++) {
    for (let j = 0; j + 1 < STREETS.length; j++) {
      out.push({
        k,
        j,
        rect: {
          uMin: (STREETS[k] as number) + half,
          uMax: (STREETS[k + 1] as number) - half,
          vMin: (STREETS[j] as number) + half,
          vMax: (STREETS[j + 1] as number) - half,
        },
      });
    }
  }
  return out;
}

const BLOCKS = blocks();

/** Índice da quadra (entre os meios-fios) que contém a coordenada, ou −1 se cair numa rua. */
function slot(x: number): number {
  const half = STREET_WIDTH_M / 2;
  for (let k = 0; k + 1 < STREETS.length; k++) {
    if (x >= (STREETS[k] as number) + half && x <= (STREETS[k + 1] as number) - half) return k;
  }
  return -1;
}

/** Quintal: o miolo da quadra que sobra depois das fileiras de casarões. */
function inYard(u: number, v: number): boolean {
  const k = slot(u);
  const j = slot(v);
  if (k < 0 || j < 0 || (k === CENTER_BLOCK && j === CENTER_BLOCK)) return false;
  const half = STREET_WIDTH_M / 2;
  const d = HOUSE_DEPTH_M;
  return (
    u > (STREETS[k] as number) + half + d &&
    u < (STREETS[k + 1] as number) - half - d &&
    v > (STREETS[j] as number) + half + d &&
    v < (STREETS[j + 1] as number) - half - d
  );
}

/** Larguras de lote que somam `length`, de 7 a 14 m. */
function lotWidths(length: number, rng: Rng): number[] {
  const n = Math.max(1, Math.round(length / HOUSE_FRONTAGE_M));
  const weights = Array.from({ length: n }, () => rng.range(0.7, 1.3));
  const total = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => (w / total) * length);
}

export const COLONIAL_CENTER: BiomeRecipe = {
  id: 'COLONIAL_CENTER',
  palette: {
    cover: {
      GRASS: [104, 150, 82],
      CROP: [168, 170, 84],
      FOREST: [58, 118, 60],
      WATER: [58, 108, 150],
      ROAD: [124, 116, 106],
      ROOF: [176, 86, 62],
      SAND: [214, 196, 150],
      ROCK: [130, 126, 118],
      SWAMP: [92, 110, 74],
      URBAN: [198, 184, 160],
      BENCH: [150, 120, 96],
      LAVA: [220, 90, 40],
      SNOW: [236, 240, 244],
      METAL: [120, 128, 140],
    },
    skyTop: [96, 142, 200],
    skyHorizon: [218, 224, 230],
    fog: [208, 214, 220],
    water: [58, 108, 150],
  },

  // Ladeira: o plano sobe com `u`, com uma ondulação leve por cima.
  baseElevation(u, v, n) {
    const ripple = n.fbm(n.a, u / RIPPLE_SCALE_M, v / RIPPLE_SCALE_M, { octaves: 2 });
    return SLOPE_BASE_M + (SLOPE_RISE_M * u) / AOI_LENGTH_M + RIPPLE_M * ripple;
  },

  // Telhados (ROOF) e ruas (ROAD) vêm do sampler; sobram os quintais e o piso de pedra.
  landCover(u, v) {
    return inYard(u, v) ? 'GRASS' : 'URBAN';
  },

  canopy() {
    return 0;
  },

  ndvi(u, v, cover, n) {
    switch (cover) {
      case 'GRASS':
        return 0.55 + 0.08 * n.b(u / 12, v / 12);
      case 'ROAD':
        return 0.06;
      case 'ROOF':
        return 0.04;
      default:
        return 0.1 + 0.03 * n.b(u / 20, v / 20);
    }
  },

  roads(aoi) {
    const m = MARGIN_FRACTION;
    const uMin = -m * aoi.lengthM;
    const uMax = (1 + m) * aoi.lengthM;
    const vMin = -m * aoi.widthM;
    const vMax = (1 + m) * aoi.widthM;
    return [
      ...STREETS.map<Polyline>((u) => ({
        kind: 'ROAD',
        widthM: STREET_WIDTH_M,
        points: [
          { u, v: vMin },
          { u, v: vMax },
        ],
      })),
      ...STREETS.map<Polyline>((v) => ({
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
    const objects: WorldObject[] = [];
    const b = ctx.bounds;
    const inBounds = (u: number, v: number) =>
      u >= b.uMin && u <= b.uMax && v >= b.vMin && v <= b.vMax;
    const house = (rect: Rect) => {
      const u = (rect.uMin + rect.uMax) / 2;
      const v = (rect.vMin + rect.vMax) / 2;
      // O sorteio roda mesmo fora dos limites: a seed determina a cidade inteira.
      const heightM = rng.range(...HOUSE_HEIGHT_M);
      const color = rng.pick(FACADES);
      if (!inBounds(u, v)) return;
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
    /** Fileira de casarões ao longo de `uMin..uMax` (norte/sul) ou `vMin..vMax` (leste/oeste). */
    const row = (rect: Rect, alongU: boolean) => {
      let at = alongU ? rect.uMin : rect.vMin;
      for (const w of lotWidths(alongU ? rect.uMax - rect.uMin : rect.vMax - rect.vMin, rng)) {
        house(alongU ? { ...rect, uMin: at, uMax: at + w } : { ...rect, vMin: at, vMax: at + w });
        at += w;
      }
    };

    for (const { rect, k, j } of BLOCKS) {
      // A quadra da igreja é só a nave, as torres e o largo.
      if (k === CENTER_BLOCK && j === CENTER_BLOCK) continue;
      const d = HOUSE_DEPTH_M;
      // Fileiras norte e sul, e as laterais entre elas.
      row({ ...rect, vMax: rect.vMin + d }, true);
      row({ ...rect, vMin: rect.vMax - d }, true);
      row(
        { uMin: rect.uMin, uMax: rect.uMin + d, vMin: rect.vMin + d, vMax: rect.vMax - d },
        false,
      );
      row(
        { uMin: rect.uMax - d, uMax: rect.uMax, vMin: rect.vMin + d, vMax: rect.vMax - d },
        false,
      );
      // Uma ou duas árvores no quintal.
      for (let t = rng.int(1, 2); t > 0; t--) {
        const u = rng.range(rect.uMin + d + 3, rect.uMax - d - 3);
        const v = rng.range(rect.vMin + d + 3, rect.vMax - d - 3);
        const heightM = rng.range(6, 10);
        const widthM = rng.range(5, 7);
        if (!inBounds(u, v)) continue;
        objects.push(
          makeObject(ctx.nextId, { kind: 'TREE', u, v, widthM, depthM: 6, heightM, color: TREE }),
        );
      }
    }

    // Igreja matriz: a nave e as duas torres da fachada.
    const { nave, tower } = CHURCH;
    objects.push(
      makeObject(ctx.nextId, {
        kind: 'BUILDING',
        u: nave.u,
        v: nave.v,
        widthM: nave.widthM,
        depthM: nave.depthM,
        heightM: nave.heightM,
        color: CHURCH_WALL,
      }),
    );
    for (const u of CHURCH.towerU) {
      objects.push(
        makeObject(ctx.nextId, {
          kind: 'TOWER',
          u,
          v: CHURCH.towerV,
          widthM: tower.widthM,
          depthM: tower.depthM,
          heightM: tower.heightM,
          color: CHURCH_WALL,
        }),
      );
    }
    // Quatro árvores nos cantos do largo, deixando o miolo livre.
    for (const [u, v] of [
      [57, 85],
      [93, 85],
      [57, 94],
      [93, 94],
    ] as const) {
      objects.push(
        makeObject(ctx.nextId, {
          kind: 'TREE',
          u,
          v,
          widthM: 6,
          depthM: 6,
          heightM: 8,
          color: TREE,
        }),
      );
    }

    // Postes e fios baixos ao longo de cada rua, a 3 m do eixo.
    const wires = rng.fork('wires');
    STREETS.forEach((s, i) => {
      const alongV: AoiPoint[] = [
        { u: s + 3, v: b.vMin },
        { u: s + 3, v: b.vMax },
      ];
      const alongU: AoiPoint[] = [
        { u: b.uMin, v: s + 3 },
        { u: b.uMax, v: s + 3 },
      ];
      for (const line of [alongV, alongU]) {
        const { poles, wires: segments } = lowWireLine(line, wires.fork(`${i}`), ctx.nextId);
        objects.push(...poles, ...segments);
      }
    });
    return objects;
  },

  guaranteedAccessible: [LARGO_CENTER],
};
