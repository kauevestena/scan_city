// data-model §4 — Contratos
import type { AoiPoint, CentsBRL, Dimension } from './basics';
import type { AircraftId, AircraftKind, Lens, SensorKind, VehicleId } from './catalog';
import type { EmblemShape, UnlockCondition } from './progression';

export type BiomeId =
  | 'RURAL_TUTORIAL'
  | 'URBAN_VERTICAL'
  | 'AGRI_PLATEAU'
  | 'AMAZON'
  | 'OPEN_PIT_MINE'
  | 'COLONIAL_CENTER'
  | 'COASTAL_ESTUARY'
  | 'RIFT_GREEN_HILLS'
  | 'RIFT_PIPES'
  | 'RIFT_CRATERS'
  | 'RIFT_FAIRY_FOREST'
  | 'RIFT_CUBES'
  | 'RIFT_GREY_SWAMP'
  | 'RIFT_POLAR_BASE'
  | 'RIFT_SANTOS_HOOD'
  | 'RIFT_TALL_GRASS'
  | 'RIFT_IRON_TRENCH'
  | 'RIFT_CLIFF_TOMBS';

export type LightingId = 'SUN_HIGH' | 'OVERCAST' | 'GOLDEN_HOUR' | 'BLIZZARD' | 'MAGIC_FOG';

export type SpecialRuleId =
  | 'URBAN_CANYON_RTK_LOSS'
  | 'HOMOGENEOUS_TEXTURE'
  | 'DENSE_CANOPY'
  | 'STEEP_RELIEF'
  | 'LOW_WIRES'
  | 'SPECULAR_WATER'
  | 'STRONG_WIND'
  | 'EM_INTERFERENCE'
  | 'BLIZZARD_DRAIN'
  | 'MAGIC_FOG'
  | 'SEARCHLIGHTS'
  | 'MOVING_HAZARDS'
  | 'ENERGY_BEAMS'
  | 'LAVA_THERMALS'
  | 'VERTICAL_CLIFFS'
  | 'FEATURE_TARGETS'
  | 'COLLECTIBLE_RINGS'
  | 'ELECTRIC_CREATURES'
  | 'NARROW_TRENCH'
  | 'PAINT_MARKERS';

export type Severity = 'CRITICAL' | 'MAJOR' | 'MINOR';
export type FlightModeId = 'TERRAIN_FOLLOWING' | 'CROSS_GRID' | 'OBLIQUE';

export type RequirementCheck =
  | { type: 'MAX_GSD_CM'; value: number }
  /** % */
  | { type: 'MIN_FORWARD_OVERLAP'; value: number }
  /** % */
  | { type: 'MIN_SIDE_OVERLAP'; value: number }
  /** Fração 0..1 das células da AOI (exclui água se SPECULAR_WATER). */
  | { type: 'MIN_COVERAGE_GREEN'; value: number }
  /** Execução mínima do voo, 0..1 (domain-math §10.3). Todo contrato tem. */
  | { type: 'MIN_EXECUTION'; value: number }
  | { type: 'SENSOR_KIND'; value: SensorKind }
  | { type: 'MIN_AIRCRAFT_TIER'; value: number }
  | { type: 'AIRCRAFT_KIND'; value: AircraftKind }
  | { type: 'FLIGHT_MODE'; value: FlightModeId }
  | {
      type: 'ACCURACY_PEC';
      cls: 'A' | 'B' | 'C' | 'D';
      scaleDenominator: number;
      contourIntervalM?: number;
    }
  | { type: 'ACCURACY_ASPRS'; horizontalCm: number; verticalCm: number }
  | { type: 'MIN_GCP'; value: number }
  | { type: 'MIN_CP'; value: number }
  /** pts/m² total médio. */
  | { type: 'MIN_LIDAR_DENSITY'; value: number }
  /** pts/m² de solo. */
  | { type: 'MIN_GROUND_DENSITY'; value: number }
  | { type: 'MAX_VOLUME_ERROR_PCT'; value: number }
  | { type: 'MAX_BLUR_FRACTION'; value: number }
  | { type: 'NOT_DETECTED' }
  | { type: 'FEATURE_CAPTURED'; featureId: string };

export interface ContractRequirement {
  id: string;
  label: string;
  severity: Severity;
  check: RequirementCheck;
}

export interface PortraitSpec {
  shape: EmblemShape;
  /** Nome lucide. */
  icon: string;
  primary: string;
  secondary: string;
  initials: string;
}

/** Plano que comprovadamente atende o contrato (teste de viabilidade). */
export interface ReferencePlan {
  aircraftId: AircraftId;
  sensorId: string;
  lensId?: Lens['id'];
  heightM: number;
  forwardOverlapPct: number;
  sideOverlapPct: number;
  speedMs: number;
  modes: readonly FlightModeId[];
  obliqueDeg?: 45 | 60;
  lighting: LightingId;
  gcps: readonly AoiPoint[];
  cps: readonly AoiPoint[];
  expected: {
    gsdCm: number;
    nLines: number;
    flightTimeS: number;
    /** Plano com LiDAR primário: faixa varrida, densidade total e densidade de solo esperadas. */
    lidar?: { swathM: number; density: number; groundDensity: number };
  };
}

export interface Contract {
  /** 'C00'…'C06', 'R01'…'R11'. */
  id: string;
  dimension: Dimension;
  title: string;
  client: { name: string; role: string; description: string; portrait: PortraitSpec };
  objective: string;
  biome: BiomeId;
  seed: number;
  aoi: { widthM: number; lengthM: number };
  /** Teto AGL permitido. */
  ceilingM: number;
  /** Amplitude de relevo aproximada (informativo/gerador). */
  terrainReliefM: number;
  lightingOptions: readonly LightingId[];
  wind: { meanMs: number; gustMs: number; directionDeg: number };
  specialRules: readonly SpecialRuleId[];
  requirements: readonly ContractRequirement[];
  recommended: { aircraft: AircraftId[]; sensors: string[]; vehicle: VehicleId; notes: string };
  /** Para alcançar o marcador no mapa. */
  minVehicle: VehicleId;
  basePaymentBRL: CentsBRL;
  xp: number;
  reputationReward: number;
  souvenirId: string;
  museum: { wing: Dimension; slot: number; incomePerMinBRL: CentsBRL };
  unlock: UnlockCondition;
  /** Caractere no map.ts. */
  overworldMarker: string;
  dialogs: {
    briefing: readonly string[];
    success: readonly string[];
    failure: readonly string[];
  };
  referencePlan: ReferencePlan;
}
