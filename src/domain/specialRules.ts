/**
 * Registro de efeitos das regras especiais (contracts-real §1, REQ-CNT-004). Cada regra, ao ser
 * aplicada, liga os seus efeitos nos cinco grupos de sistemas: `terrain` (o que o gerador do
 * bioma precisa produzir), `flight`, `field`, `coverage` e `accuracy`. Os sistemas consultam o
 * resultado de `resolveRuleEffects(contract.specialRules)` em vez de procurar regras pelo nome.
 */
import type { RuleSystem } from '@/data/specialRules';
import type { SpecialRuleId } from '@/types';

/** Números normativos da spec, em um só lugar. */
export const RULE_PARAMS = {
  /** Dois prédios mais altos que 60 m a menos de 40 m um do outro formam um cânion. */
  rtkCanyon: { minBuildingHeightM: 60, maxGapM: 40 },
  /** Na etapa 2 da esteira, 40 % menos tie points. */
  homogeneousTexture: { tiePointFactor: 0.6 },
  denseCanopy: { minCanopy: 0.9, maxCanopy: 0.98, clearingRadiusM: [20, 35] as const },
  steepRelief: { minReliefM: 60, slopeDeg: [35, 70] as const },
  lowWires: {
    poleSpacingM: [30, 40] as const,
    wireHeightM: [8, 14] as const,
    /** O fio colide a ±1 m da sua altura. */
    hitToleranceM: 1,
  },
  strongWind: { minMeanMs: 8 },
  em: { lateralMs: 0.8, headingDeg: 3, rmseFactor: 1.2 },
  blizzard: { energyDrainFactor: 2, visibilityM: 400 },
  magicFog: { visibilityM: 250 },
  searchlights: { detectS: 1.5, detectAtlasS: 3 },
  movingHazards: { amplitudeM: [10, 25] as const, periodS: [3, 6] as const },
  energyBeams: { onS: 2, offS: 3, warnS: 0.5 },
  lava: { liftMs: 6, radiusM: 40 },
  cliffs: { minSlopeDeg: 80, heightM: [60, 100] as const },
  rings: { radiusM: 3, altitudeM: [10, 40] as const, collectM: 3, bonusCents: 5000 },
  electric: { intervalS: [8, 12] as const, spikeS: 2, forceMs: 3 },
  trench: { widthM: 50, depthM: 40 },
} as const;

export interface RuleEffects {
  /** O que o gerador do bioma tem de produzir. */
  terrain: {
    rtkCanyons: { minBuildingHeightM: number; maxGapM: number } | null;
    denseCanopy: {
      minCanopy: number;
      maxCanopy: number;
      clearingRadiusM: readonly [number, number];
    } | null;
    steepRelief: { minReliefM: number; slopeDeg: readonly [number, number] } | null;
    lowWires: {
      poleSpacingM: readonly [number, number];
      wireHeightM: readonly [number, number];
    } | null;
    lavaThermals: { liftMs: number; radiusM: number } | null;
    verticalCliffs: { minSlopeDeg: number; heightM: readonly [number, number] } | null;
    narrowTrench: { widthM: number; depthM: number } | null;
    featureTargets: boolean;
  };
  flight: {
    /** `rtkStatusAt` devolve FLOAT dentro das zonas de cânion. */
    rtkFloatInCanyons: boolean;
    /** Em altitude constante, o AGL varia muito. */
    aglVaries: boolean;
    wireCollisions: { hitToleranceM: number } | null;
    strongWind: { minMeanMs: number } | null;
    emInterference: { lateralMs: number; headingDeg: number } | null;
    /** Multiplicador do dreno de energia (nevasca: ×2). */
    energyDrainFactor: number;
    /** Visibilidade máxima (nevasca ou névoa); `null` sem restrição da regra. */
    visibilityM: number | null;
    specularWater: boolean;
    searchlights: { detectS: number; detectAtlasS: number } | null;
    movingHazards: {
      amplitudeM: readonly [number, number];
      periodS: readonly [number, number];
    } | null;
    energyBeams: { onS: number; offS: number; warnS: number } | null;
    /** Brilho laranja e térmicas sobre a lava. */
    thermalGlow: boolean;
    /** Os alvos são avaliados no fim de cada surtida. */
    featureCapture: boolean;
    rings: {
      radiusM: number;
      altitudeM: readonly [number, number];
      collectM: number;
      bonusCents: number;
    } | null;
    electricCreatures: {
      intervalS: readonly [number, number];
      spikeS: number;
      forceMs: number;
    } | null;
  };
  field: {
    /** Os GCPs ignoram o alcance por veículo. */
    paintMarkers: boolean;
    /** Sob dossel denso, os GCPs só valem nas clareiras. */
    canopyClearingsOnly: boolean;
  };
  coverage: {
    /** Foto com > 50 % da pegada sobre a água vira inválida sob sol alto. */
    specularWater: boolean;
    /** Toda foto RGB fica `inFog`. */
    fog: boolean;
    /** Sem LiDAR, não há dados de solo sob o dossel. */
    noGroundUnderCanopy: boolean;
  };
  accuracy: {
    rtkFloatShots: boolean;
    homogeneousTexture: { tiePointFactor: number } | null;
    specularWater: boolean;
    /** Fator de RMSE da interferência EM (aeronave não imune). */
    emRmseFactor: number;
  };
}

/** Efeitos de um contrato sem regras especiais. */
export function neutralRuleEffects(): RuleEffects {
  return {
    terrain: {
      rtkCanyons: null,
      denseCanopy: null,
      steepRelief: null,
      lowWires: null,
      lavaThermals: null,
      verticalCliffs: null,
      narrowTrench: null,
      featureTargets: false,
    },
    flight: {
      rtkFloatInCanyons: false,
      aglVaries: false,
      wireCollisions: null,
      strongWind: null,
      emInterference: null,
      energyDrainFactor: 1,
      visibilityM: null,
      specularWater: false,
      searchlights: null,
      movingHazards: null,
      energyBeams: null,
      thermalGlow: false,
      featureCapture: false,
      rings: null,
      electricCreatures: null,
    },
    field: { paintMarkers: false, canopyClearingsOnly: false },
    coverage: { specularWater: false, fog: false, noGroundUnderCanopy: false },
    accuracy: {
      rtkFloatShots: false,
      homogeneousTexture: null,
      specularWater: false,
      emRmseFactor: 1,
    },
  };
}

/** Registro: o que cada uma das 20 regras liga em cada sistema (o tipo exige todas). */
export const RULE_REGISTRY: Readonly<Record<SpecialRuleId, (fx: RuleEffects) => void>> = {
  URBAN_CANYON_RTK_LOSS: (fx) => {
    fx.terrain.rtkCanyons = { ...RULE_PARAMS.rtkCanyon };
    fx.flight.rtkFloatInCanyons = true;
    fx.accuracy.rtkFloatShots = true;
  },
  HOMOGENEOUS_TEXTURE: (fx) => {
    fx.accuracy.homogeneousTexture = { ...RULE_PARAMS.homogeneousTexture };
  },
  DENSE_CANOPY: (fx) => {
    fx.terrain.denseCanopy = { ...RULE_PARAMS.denseCanopy };
    fx.field.canopyClearingsOnly = true;
    fx.coverage.noGroundUnderCanopy = true;
  },
  STEEP_RELIEF: (fx) => {
    fx.terrain.steepRelief = { ...RULE_PARAMS.steepRelief };
    fx.flight.aglVaries = true;
  },
  LOW_WIRES: (fx) => {
    fx.terrain.lowWires = {
      poleSpacingM: RULE_PARAMS.lowWires.poleSpacingM,
      wireHeightM: RULE_PARAMS.lowWires.wireHeightM,
    };
    fx.flight.wireCollisions = { hitToleranceM: RULE_PARAMS.lowWires.hitToleranceM };
  },
  SPECULAR_WATER: (fx) => {
    fx.flight.specularWater = true;
    fx.coverage.specularWater = true;
    fx.accuracy.specularWater = true;
  },
  STRONG_WIND: (fx) => {
    fx.flight.strongWind = { ...RULE_PARAMS.strongWind };
  },
  EM_INTERFERENCE: (fx) => {
    fx.flight.emInterference = {
      lateralMs: RULE_PARAMS.em.lateralMs,
      headingDeg: RULE_PARAMS.em.headingDeg,
    };
    fx.accuracy.emRmseFactor = RULE_PARAMS.em.rmseFactor;
  },
  BLIZZARD_DRAIN: (fx) => {
    fx.flight.energyDrainFactor = RULE_PARAMS.blizzard.energyDrainFactor;
    fx.flight.visibilityM = Math.min(
      fx.flight.visibilityM ?? Infinity,
      RULE_PARAMS.blizzard.visibilityM,
    );
  },
  MAGIC_FOG: (fx) => {
    fx.flight.visibilityM = Math.min(
      fx.flight.visibilityM ?? Infinity,
      RULE_PARAMS.magicFog.visibilityM,
    );
    fx.coverage.fog = true;
  },
  SEARCHLIGHTS: (fx) => {
    fx.flight.searchlights = { ...RULE_PARAMS.searchlights };
  },
  MOVING_HAZARDS: (fx) => {
    fx.flight.movingHazards = { ...RULE_PARAMS.movingHazards };
  },
  ENERGY_BEAMS: (fx) => {
    fx.flight.energyBeams = { ...RULE_PARAMS.energyBeams };
  },
  LAVA_THERMALS: (fx) => {
    fx.terrain.lavaThermals = { ...RULE_PARAMS.lava };
    fx.flight.thermalGlow = true;
  },
  VERTICAL_CLIFFS: (fx) => {
    fx.terrain.verticalCliffs = { ...RULE_PARAMS.cliffs };
  },
  FEATURE_TARGETS: (fx) => {
    fx.terrain.featureTargets = true;
    fx.flight.featureCapture = true;
  },
  COLLECTIBLE_RINGS: (fx) => {
    fx.flight.rings = { ...RULE_PARAMS.rings };
  },
  ELECTRIC_CREATURES: (fx) => {
    fx.flight.electricCreatures = { ...RULE_PARAMS.electric };
  },
  NARROW_TRENCH: (fx) => {
    fx.terrain.narrowTrench = { ...RULE_PARAMS.trench };
  },
  PAINT_MARKERS: (fx) => {
    fx.field.paintMarkers = true;
  },
};

const cache = new Map<string, RuleEffects>();

/**
 * Efeitos somados das regras de um contrato. O resultado é compartilhado (memoizado pelas regras):
 * não o altere.
 */
export function resolveRuleEffects(rules: readonly SpecialRuleId[]): RuleEffects {
  const key = [...rules].sort().join(',');
  const hit = cache.get(key);
  if (hit) return hit;
  const fx = neutralRuleEffects();
  for (const rule of rules) RULE_REGISTRY[rule](fx);
  cache.set(key, fx);
  return fx;
}

export type EffectGroup = keyof RuleEffects;
export const EFFECT_GROUPS: readonly EffectGroup[] = [
  'terrain',
  'flight',
  'field',
  'coverage',
  'accuracy',
];

/** Em qual grupo de efeitos cada sistema da spec é registrado. */
export const SYSTEM_GROUP: Readonly<Record<RuleSystem, EffectGroup>> = {
  TERRAIN: 'terrain',
  FLIGHT: 'flight',
  FIELD: 'field',
  COVERAGE: 'coverage',
  ACCURACY: 'accuracy',
  // A energia, a avaliação dos alvos e a economia (bônus) são resolvidas no voo.
  ENERGY: 'flight',
  EVALUATION: 'flight',
  ECONOMY: 'flight',
  // A visualização da esteira lê o efeito de acurácia (textura homogênea).
  PROCESSING: 'accuracy',
};

/** Grupos que a regra de fato altera (comparando com o contrato sem regras). */
export function touchedGroups(rule: SpecialRuleId): EffectGroup[] {
  const base = neutralRuleEffects();
  const fx = neutralRuleEffects();
  RULE_REGISTRY[rule](fx);
  return EFFECT_GROUPS.filter((g) => JSON.stringify(fx[g]) !== JSON.stringify(base[g]));
}

// --- Validação de terreno (para os testes dos biomas) -----------------------------------

export interface ReliefTerrain {
  aoi: { widthM: number; lengthM: number };
  elevation(u: number, v: number): number;
  slopePct(u: number, v: number): number;
}

/** Amplitude do relevo (máx − mín do solo nu) numa grade sobre a AOI. */
export function terrainReliefM(terrain: ReliefTerrain, stepM = 10): number {
  let lo = Infinity;
  let hi = -Infinity;
  for (let u = 0; u <= terrain.aoi.lengthM; u += stepM) {
    for (let v = 0; v <= terrain.aoi.widthM; v += stepM) {
      const e = terrain.elevation(u, v);
      lo = Math.min(lo, e);
      hi = Math.max(hi, e);
    }
  }
  return hi - lo;
}

/** Maior declividade (graus) numa grade sobre a AOI. */
export function maxSlopeDeg(terrain: ReliefTerrain, stepM = 5): number {
  let best = 0;
  for (let u = 0; u <= terrain.aoi.lengthM; u += stepM) {
    for (let v = 0; v <= terrain.aoi.widthM; v += stepM) {
      best = Math.max(best, Math.atan(terrain.slopePct(u, v) / 100));
    }
  }
  return (best * 180) / Math.PI;
}
