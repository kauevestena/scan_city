/**
 * Render termal do voo (contracts-rifts R06): com a câmera termal o terreno aparece numa rampa de
 * calor (preto → roxo → vermelho → laranja → branco) em vez das cores do bioma, e os alvos
 * térmicos (`sensorKind: 'THERMAL'`, as tocas `DEN_*`) brilham como manchas quentes que o RGB não
 * mostra. Puro: o calor é um número de 0 (frio) a 1 (quente).
 */
import { clamp } from '@/lib/math';
import type { FeatureTarget, LandCover, Rgb, WorldObjectKind } from '@/types';

/** Calor relativo de cada cobertura sob céu encoberto: a água é o mais frio, o asfalto o mais quente. */
export const COVER_HEAT: Readonly<Record<LandCover, number>> = {
  WATER: 0.16,
  SNOW: 0.08,
  SWAMP: 0.3,
  FOREST: 0.34,
  GRASS: 0.38,
  CROP: 0.4,
  SAND: 0.5,
  ROCK: 0.52,
  BENCH: 0.52,
  URBAN: 0.55,
  METAL: 0.5,
  ROAD: 0.58,
  ROOF: 0.62,
  LAVA: 1,
};

/** Calor dos objetos: árvores mortas e galhos frios, pedra e concreto mornos, metal e tijolo quentes. */
export const OBJECT_HEAT: Readonly<Partial<Record<WorldObjectKind, number>>> = {
  TREE: 0.27,
  POLE: 0.4,
  WIRE: 0.38,
  BUILDING: 0.55,
  TOWER: 0.5,
  CLIFF_TEMPLE: 0.5,
  PIPE: 0.46,
  BRICK_PLATFORM: 0.58,
  CUBE_BLOCK: 0.5,
  GIANT_WALKER: 0.7,
};
const DEFAULT_OBJECT_HEAT = 0.45;

/** Calor extra no centro de uma mancha quente (a toca), somado ao do chão. */
export const HOT_SPOT_HEAT = 0.55;

export const objectHeat = (kind: WorldObjectKind): number =>
  OBJECT_HEAT[kind] ?? DEFAULT_OBJECT_HEAT;

/** Os alvos que só o sensor termal enxerga. */
export const thermalFeatures = (features: readonly FeatureTarget[]): FeatureTarget[] =>
  features.filter((f) => f.sensorKind === 'THERMAL');

/**
 * Calor extra das manchas quentes em (u, v): uma gaussiana de raio `radiusM` em volta de cada
 * alvo (1 no centro, 0,22 a um raio, ~0 a 2,5 raios), vezes `HOT_SPOT_HEAT`.
 */
export function hotSpotHeat(spots: readonly FeatureTarget[], u: number, v: number): number {
  let heat = 0;
  for (const s of spots) {
    const d2 = (u - s.u) ** 2 + (v - s.v) ** 2;
    const reach = (2.5 * s.radiusM) ** 2;
    if (d2 > reach) continue;
    heat = Math.max(heat, HOT_SPOT_HEAT * Math.exp((-1.5 * d2) / (s.radiusM * s.radiusM)));
  }
  return heat;
}

/** Rampa "ferro quente": preto-azulado, roxo, vermelho, laranja e branco-amarelado. */
const STOPS: ReadonlyArray<readonly [number, Rgb]> = [
  [0, [8, 4, 28]],
  [0.25, [72, 12, 124]],
  [0.5, [204, 44, 70]],
  [0.75, [250, 160, 24]],
  [1, [255, 248, 204]],
];

export function thermalColor(heat: number): [number, number, number] {
  const h = clamp(heat, 0, 1);
  for (let k = 1; k < STOPS.length; k++) {
    const [h1, c1] = STOPS[k] as readonly [number, Rgb];
    if (h > h1) continue;
    const [h0, c0] = STOPS[k - 1] as readonly [number, Rgb];
    const t = (h - h0) / (h1 - h0);
    return [c0[0] + (c1[0] - c0[0]) * t, c0[1] + (c1[1] - c0[1]) * t, c0[2] + (c1[2] - c0[2]) * t];
  }
  const last = (STOPS[STOPS.length - 1] as readonly [number, Rgb])[1];
  return [last[0], last[1], last[2]];
}
