// data-model §7 — Relatório de qualidade
import type { CentsBRL } from './basics';
import type { Severity } from './contracts';

export interface Residual {
  pointId: string;
  kind: 'GCP' | 'CP';
  dxM: number;
  dyM: number;
  dzM: number;
}
export interface RmseSet {
  x: number;
  y: number;
  z: number;
  /** √(x² + y²). */
  r: number;
}

export type PecClass = 'A' | 'B' | 'C' | 'D';
export interface PecAxisResult {
  achieved: PecClass | 'FORA';
  epM: number;
  pecM: number;
  pass: boolean;
  pct90: number;
}
export interface PecResult {
  scaleDenominator: number;
  requiredClass: PecClass;
  planimetric: PecAxisResult;
  altimetric?: PecAxisResult;
}
export interface AsprsResult {
  horizontalCm: number;
  verticalCm: number;
  rmseHcm: number;
  rmseVcm: number;
  passH: boolean;
  passV: boolean;
}

export interface CoverageResult {
  cols: number;
  rows: number;
  /** Fotos válidas por célula. */
  counts: number[];
  /** Frações das células válidas. */
  green: number;
  yellow: number;
  red: number;
  /** Água sob SPECULAR_WATER etc. */
  excludedCells: number[];
  meanCount: number;
}

export interface LensCalibration {
  fPx: number;
  cxPx: number;
  cyPx: number;
  k1: number;
  k2: number;
  p1: number;
  p2: number;
  reprojErrorPx: number;
}

export interface RequirementResult {
  id: string;
  label: string;
  severity: Severity;
  pass: boolean;
  valueText: string;
}

export interface PaymentBreakdown {
  baseBRL: CentsBRL;
  replayFactor: number;
  qualityFactor: number;
  rivalFactor: number;
  managementBonus: number;
  staffBonus: number;
  staffCostBRL: CentsBRL;
  /** Reparo de aeronave etc. */
  penaltiesBRL: CentsBRL;
  /** Bônus de anéis (`COLLECTIBLE_RINGS`): R$ 50 por anel, somado ao total. */
  ringBonusBRL?: CentsBRL;
  totalBRL: CentsBRL;
}

export interface QualityReport {
  missionId: string;
  contractId: string;
  residuals: Residual[];
  rmse: { gcp: RmseSet; cp: RmseSet | null };
  multipliers: Array<{ key: string; label: string; xy: number; z: number }>;
  pec?: PecResult;
  asprs?: AsprsResult;
  coverage: CoverageResult;
  lens?: LensCalibration;
  lidarStats?: { meanDensity: number; meanGroundDensity: number };
  volume?: { referenceM3: number; measuredM3: number; errorPct: number };
  requirements: RequirementResult[];
  approved: boolean;
  /** Reprovado por falha crítica. */
  critical: boolean;
  /** 0..1 */
  qualityScore: number;
  payment: PaymentBreakdown;
  xp: number;
  reputationDelta: number;
  souvenirAwarded?: string;
  processingTimeS: number;
}
