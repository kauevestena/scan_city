/**
 * RIFT_IRON_TRENCH — R10 "Trincheira da Estrela de Ferro" (terrain §3): uma superfície metálica
 * plana de painéis cinza em grade (900 × 120 m) cortada, ao longo de `u`, por uma trincheira de 50 m
 * de largura e 40 m de fundo com paredes verticais (`NARROW_TRENCH`: `trenchElevation`). 12 torres
 * de 20 m guardam as bordas, cada uma com uma luz de navegação que pisca (vermelha ao sul, verde ao
 * norte), e a escotilha de exaustão de 2 m, o alvo `EXHAUST_PORT` que só o LiDAR captura, fica no
 * fundo, em (860, 60). As cores de bioma são exceção aos tokens (ui-style §1).
 */
import { RULE_PARAMS } from '@/domain/specialRules';
import type { AoiPoint, FeatureTarget, LandCover, Rgb, WorldObject } from '@/types';
import { makeObject } from '../objects';
import { trenchElevation } from '../ruleGenerators';
import type { BiomeRecipe } from '../TerrainSampler';

/** Eixo da trincheira em `v` (a AOI tem 120 m de largura): ela vai de v = 35 a v = 85. */
export const CENTER_V = 60;
export const TRENCH_WIDTH_M = RULE_PARAMS.trench.widthM;
export const TRENCH_DEPTH_M = RULE_PARAMS.trench.depthM;

/** Painéis de 15 m com uma emenda de 1 m entre eles; a parede e a quina de baixo também são emenda. */
export const PANEL_M = 15;
export const SEAM_M = 1;
/** Faixa de 1 m junto de cada parede (em cima e embaixo), pintada de escuro. */
export const WALL_BAND_M = 1;

/** Trilha de manutenção de 3 m pela borda sul do plano (a 12 m do limite da AOI). */
export const SERVICE_TRAIL_V = 12;
export const SERVICE_TRAIL_WIDTH_M = 3;

/**
 * A escotilha de exaustão de 2 m, no fundo: o alvo `EXHAUST_PORT` (r = 2 m) só se captura com LiDAR.
 */
export const HATCH_AT: AoiPoint = { u: 860, v: 60 };
export const HATCH_SIZE_M = 2;
export const HATCH_RADIUS_M = 2;
export const HATCH_FEATURE: FeatureTarget = {
  id: 'EXHAUST_PORT',
  name: 'Escotilha de exaustão',
  u: HATCH_AT.u,
  v: HATCH_AT.v,
  radiusM: HATCH_RADIUS_M,
  needs: 'LIDAR',
};

/** 12 torres de 20 m: seis de cada lado da trincheira, a ~6 m da borda. */
export const TOWER = { widthM: 6, heightM: 20 } as const;
export const TOWER_US = [80, 230, 380, 530, 680, 830] as const;
export const TOWER_SOUTH_V = CENTER_V - TRENCH_WIDTH_M / 2 - 6;
export const TOWER_NORTH_V = CENTER_V + TRENCH_WIDTH_M / 2 + 6;
/** Luz de navegação: 3 m de coluna no topo da torre, acesa 0,6 s e apagada 0,6 s, defasada de torre a torre. */
export const BEACON = { widthM: 1.2, heightM: 3, onS: 0.6, offS: 0.6, phaseStepS: 0.2 } as const;
const BEACON_RED: Rgb = [239, 68, 68];
const BEACON_GREEN: Rgb = [34, 197, 94];
const TOWER_COLOR: Rgb = [58, 66, 86];
const HATCH_COLOR: Rgb = [200, 52, 52];

/** Dentro da trincheira (cota −40 m)? */
export const inTrench = (v: number): boolean => Math.abs(v - CENTER_V) < TRENCH_WIDTH_M / 2;

/** Distância (m) de `v` à parede mais próxima (a de v = 35 ou a de v = 85). */
const wallDistance = (v: number): number => Math.abs(Math.abs(v - CENTER_V) - TRENCH_WIDTH_M / 2);

const mod = (x: number, m: number): number => ((x % m) + m) % m;

export const RIFT_IRON_TRENCH: BiomeRecipe = {
  id: 'RIFT_IRON_TRENCH',
  palette: {
    cover: {
      GRASS: [120, 160, 130],
      CROP: [140, 170, 120],
      FOREST: [60, 110, 100],
      WATER: [70, 130, 210],
      ROAD: [120, 126, 144],
      ROOF: [160, 90, 90],
      SAND: [180, 176, 170],
      // Emendas dos painéis e paredes da trincheira: aço escuro.
      ROCK: [66, 74, 94],
      SWAMP: [90, 130, 120],
      URBAN: [150, 150, 164],
      BENCH: [150, 130, 120],
      LAVA: [240, 100, 50],
      SNOW: [236, 242, 250],
      METAL: [158, 170, 190],
    },
    skyTop: [104, 134, 200],
    skyHorizon: [196, 212, 236],
    fog: [186, 200, 224],
    water: [70, 130, 210],
  },

  // Plano metálico a 0 m e a trincheira de −40 m com paredes verticais.
  baseElevation(_u, v) {
    return trenchElevation(v, CENTER_V);
  },

  // Painéis cinza em grade: emendas de 1 m a cada 15 m e a faixa escura junto das paredes.
  landCover(u, v): LandCover {
    if (wallDistance(v) < WALL_BAND_M) return 'ROCK';
    if (mod(u, PANEL_M) < SEAM_M || mod(v, PANEL_M) < SEAM_M) return 'ROCK';
    return 'METAL';
  },

  canopy() {
    return 0;
  },

  ndvi() {
    return 0.03;
  },

  // Uma trilha de manutenção ao longo da borda sul: a pé se chega (≤ 150 m) a qualquer ponto da AOI,
  // então o jogador pode cravar GCPs se quiser (o plano de referência não usa nenhum).
  roads() {
    const points: AoiPoint[] = [];
    for (let u = -180; u <= 1080; u += 90) points.push({ u, v: SERVICE_TRAIL_V });
    return [{ kind: 'TRAIL', widthM: SERVICE_TRAIL_WIDTH_M, points }];
  },

  placeObjects(ctx) {
    const objects: WorldObject[] = [];
    TOWER_US.forEach((u, k) => {
      for (const side of [-1, 1] as const) {
        const v = side < 0 ? TOWER_SOUTH_V : TOWER_NORTH_V;
        objects.push(
          makeObject(ctx.nextId, {
            kind: 'TOWER',
            u,
            v,
            widthM: TOWER.widthM,
            depthM: TOWER.widthM,
            heightM: TOWER.heightM,
            color: TOWER_COLOR,
          }),
          // A luz de navegação: uma coluna curta que liga e desliga, sem colisão.
          makeObject(ctx.nextId, {
            kind: 'ENERGY_BEAM',
            u,
            v,
            widthM: BEACON.widthM,
            depthM: BEACON.widthM,
            heightM: BEACON.heightM,
            baseM: TOWER.heightM,
            color: side < 0 ? BEACON_RED : BEACON_GREEN,
            solid: false,
            activePeriod: {
              onS: BEACON.onS,
              offS: BEACON.offS,
              phase: (k * 2 + (side < 0 ? 0 : 1)) * BEACON.phaseStepS,
            },
          }),
        );
      }
    });
    // A escotilha de exaustão no fundo da trincheira: um disco de 2 m, só de enfeite.
    objects.push(
      makeObject(ctx.nextId, {
        kind: 'PIPE',
        u: HATCH_AT.u,
        v: HATCH_AT.v,
        widthM: HATCH_SIZE_M,
        depthM: HATCH_SIZE_M,
        heightM: 0.4,
        color: HATCH_COLOR,
        solid: false,
      }),
    );
    return objects;
  },

  features() {
    return [HATCH_FEATURE];
  },
};
