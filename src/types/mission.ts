// data-model §6 — Plano de voo e missão
import type { AoiPoint } from './basics';
import type { AircraftId, FieldEquipmentId, Lens, SensorKind } from './catalog';
import type { LightingId } from './contracts';

export interface PlanParams {
  aircraftId: AircraftId;
  /** Câmera ou 'POD_LIDAR'. */
  sensorId: string;
  /** Para espaçamento de linhas quando pod (RGB ou LIDAR). */
  primarySensor: SensorKind;
  lensId?: Lens['id'];
  /** AGL planejado (ou altitude constante sobre a cota média da AOI). */
  heightM: number;
  forwardOverlapPct: number;
  sideOverlapPct: number;
  speedMs: number;
  orientation: 'ALONG_LENGTH' | 'ALONG_WIDTH';
  crossGrid: boolean;
  obliqueDeg?: 45 | 60;
  terrainFollowing: boolean;
  lighting: LightingId;
}

export interface FlightLine {
  index: number;
  pass: 'PRIMARY' | 'CROSS';
  /** Incluem lead-in/out. */
  start: AoiPoint;
  end: AoiPoint;
  /** Distância ao longo da linha onde a AOI começa/termina. */
  aoiStartS: number;
  aoiEndS: number;
  direction: 1 | -1;
}

export interface PlanStats {
  focalM: number;
  pixelPitchM: number;
  gsdM: number;
  footprintWM: number;
  footprintHM: number;
  baseM: number;
  spacingM: number;
  intervalS: number;
  nLines: number;
  photosPerLine: number;
  totalPhotos: number;
  lineLengthM: number;
  turnTimeS: number;
  flightTimeS: number;
  batteriesNeeded: number;
  blurPx: number;
  skewPx: number;
  lidarSwathM?: number;
  lidarDensity?: number;
  groundDensity?: number;
}

export interface FlightPlan {
  params: PlanParams;
  lines: readonly FlightLine[];
  stats: PlanStats;
}

export interface PlanValidation {
  blocking: readonly string[];
  warnings: readonly string[];
}

export interface GroundPoint {
  id: string;
  kind: 'GCP' | 'CP';
  u: number;
  v: number;
  elevM: number;
  sigmaM: number;
}

export type RtkStatus = 'FIX' | 'FLOAT' | 'NONE';

export interface Shot {
  i: number;
  t: number;
  sortie: number;
  lineIndex: number;
  u: number;
  v: number;
  aglM: number;
  altM: number;
  speedMs: number;
  headingRad: number;
  crabRad: number;
  tiltDeg: number;
  footprintWM: number;
  footprintHM: number;
  blurPx: number;
  skewPx: number;
  blurred: boolean;
  lighting: LightingId;
  rtk: RtkStatus;
  manual: boolean;
  overWater: boolean;
  inFog: boolean;
  /**
   * Nota de execução (domain-math §10.3). Ausente em save antigo e em foto sintética: a foto
   * vale como válida, com peso 1.
   */
  grade?: ShotGrade;
}

/** Nota de execução de uma amostra do voo (domain-math §10.3). */
export type ShotGrade = 'PERFECT' | 'GOOD' | 'WEAK' | 'REJECTED';

/** Contagem de amostras por nota: perfeitas, boas, fracas e rejeitadas. */
export type GradeCounts = [perfect: number, good: number, weak: number, rejected: number];

/** Resumo de uma passada por uma linha (domain-math §10.3). */
export interface LinePass {
  lineIndex: number;
  /** 0 na primeira passada da linha na missão, 1 no primeiro revoo… */
  pass: number;
  sortie: number;
  counts: GradeCounts;
  /** A aeronave chegou ao fim da linha com dados. */
  complete: boolean;
}

/** Grade de cobertura da AOI (mesma de coverage: 64×64). */
export interface LidarGrid {
  cols: number;
  rows: number;
  /** Pulsos (fracionários) que atingiram a célula. */
  pulses: number[];
  /** Pulsos cujo 1º retorno ficou acima do solo (copa/telhado). */
  firstAbove: number[];
  /** Pulsos com último retorno no solo. */
  ground: number[];
  cellAreaM2: number;
}
export interface LidarSample {
  u: number;
  v: number;
  z: number;
  ret: 'FIRST' | 'INTERMEDIATE' | 'GROUND';
}
export interface LidarBatch {
  cells: Array<[index: number, pulses: number, firstAbove: number, ground: number]>;
  samples: LidarSample[];
}

export type SortieOutcome = 'COMPLETED' | 'RTH' | 'CRASH' | 'ENERGY_DEPLETED' | 'ABORTED';

export interface MissionData {
  /** `${contractId}-${timestamp}`. */
  id: string;
  contractId: string;
  createdAt: number;
  /** Multiplicador de pagamento (1, 0,85…). */
  rivalAdjustment: number;
  isReplay: boolean;
  plan: FlightPlan;
  groundPoints: GroundPoint[];
  fieldEquipmentId: FieldEquipmentId;
  minigames: { levelScore?: number; imuScore?: number };
  atlasCalibrated: boolean;
  sorties: Array<{ index: number; outcome: SortieOutcome; durationS: number }>;
  /** Linhas com uma passada aceita. */
  completedLines: number[];
  /** Passadas voadas. Ausente em save antigo e em missão sintética: a execução vale 1. */
  linePasses?: LinePass[];
  shots: Shot[];
  lidar?: { grid: LidarGrid; samples: LidarSample[] };
  events: {
    collisions: number;
    crashes: number;
    detected: boolean;
    featuresCaptured: string[];
    ringsCollected: number;
  };
  status: 'PLANNING' | 'IN_FLIGHT' | 'PENDING_PROCESSING' | 'PROCESSED';
}
