/**
 * Requisitos do contrato — domain-math §10: previsão a partir do plano (Field Setup) e
 * avaliação com os dados reais (relatório).
 */
import type { Catalog } from '@/data/catalog';
import { STRINGS } from '@/data/strings';
import { formatCm, formatNumber } from '@/lib/format';
import type {
  Aircraft,
  CameraSensor,
  Contract,
  ContractRequirement,
  FieldEquipmentId,
  FlightPlan,
  GroundPoint,
  ModifierSet,
  PecClass,
  RequirementCheck,
  RequirementResult,
  Residual,
  RmseSet,
  SensorKind,
} from '@/types';
import {
  DEFAULT_LEVEL_SCORE,
  gcpSigma,
  lidarModel,
  photoModel,
  predictedRequirementRmse,
  targetRmse,
  type Multiplier,
} from './accuracy';
import { neutralModifiers } from './modifiers';
import { realFocalM } from './photogrammetry';
import {
  classifyAsprs,
  classifyPec,
  PEC_CLASSES,
  pecAltimetricLimits,
  pecPlanimetricLimits,
} from './standards';
import { resolveRuleEffects } from './specialRules';

const S = STRINGS.requirements;
const pct = (v: number) => `${formatNumber(v, 0)} %`;

/**
 * Percentual medido contra um mínimo exigido: inteiro, como sempre, mas com duas casas quando o
 * arredondamento esconderia a reprovação ("70 %" que não atende "≥ 70 %" confundiria o jogador).
 */
export function pctVs(v: number, required: number): string {
  if (v >= required || Math.round(v) < required) return pct(v);
  const two = Math.round(v * 100) / 100;
  return `${formatNumber(two < required ? two : Math.floor(v * 100) / 100, 2)} %`;
}

/** Equipamento do plano: aeronave, câmera das fotos e o pod (se houver). */
export function planEquipment(
  plan: FlightPlan,
  catalog: Catalog,
): {
  aircraft: Aircraft;
  camera: CameraSensor;
  focalM: number;
  podId?: string;
  kinds: SensorKind[];
} {
  const aircraft = catalog.aircraft.find((a) => a.id === plan.params.aircraftId) as Aircraft;
  const pod = catalog.payloads.find((p) => p.id === plan.params.sensorId);
  const cameraId = pod ? pod.rgbSensorId : plan.params.sensorId;
  const camera = catalog.sensors.find((s) => s.id === cameraId) as CameraSensor;
  const lens = catalog.lenses.find((l) => l.id === plan.params.lensId);
  const focalM = realFocalM(camera, lens);
  // O pod tem LiDAR e a câmera RGB embutida.
  const kinds: SensorKind[] = pod ? ['LIDAR', 'RGB'] : [camera.kind];
  return pod
    ? { aircraft, camera, focalM, podId: pod.id, kinds }
    : { aircraft, camera, focalM, kinds };
}

/** A missão exige LiDAR como sensor (§6.7: acurácia pelo modelo LiDAR). */
export function requiresLidar(contract: Pick<Contract, 'requirements'>): boolean {
  return contract.requirements.some(
    (r) => r.check.type === 'SENSOR_KIND' && r.check.value === 'LIDAR',
  );
}

function result(req: ContractRequirement, pass: boolean, valueText: string): RequirementResult {
  return { id: req.id, label: req.label, severity: req.severity, pass, valueText };
}

function flightModeOn(plan: FlightPlan, mode: string): boolean {
  if (mode === 'TERRAIN_FOLLOWING') return plan.params.terrainFollowing;
  if (mode === 'CROSS_GRID') return plan.params.crossGrid;
  return plan.params.obliqueDeg !== undefined;
}

/** Melhor classe PEC cujo EP comporta o RMSE (previsão: sem a regra dos 90 %). */
function predictedPecClass(
  rmse: RmseSet,
  scale: number,
  contourIntervalM: number | undefined,
): PecClass | 'FORA' {
  return (
    PEC_CLASSES.find(
      (cls) =>
        rmse.r <= pecPlanimetricLimits(cls, scale).epM &&
        (contourIntervalM === undefined ||
          rmse.z <= pecAltimetricLimits(cls, contourIntervalM).epM),
    ) ?? 'FORA'
  );
}

const better = (achieved: PecClass | 'FORA', required: PecClass) =>
  achieved !== 'FORA' && PEC_CLASSES.indexOf(achieved) <= PEC_CLASSES.indexOf(required);

/** Requisitos que dependem só dos parâmetros do plano (iguais na previsão e na avaliação). */
function planCheck(
  req: ContractRequirement,
  plan: FlightPlan,
  aircraft: Aircraft,
): RequirementResult | null {
  const c = req.check;
  switch (c.type) {
    case 'MIN_AIRCRAFT_TIER':
      return result(req, aircraft.tier >= c.value, S.tier(aircraft.tier));
    case 'AIRCRAFT_KIND':
      return result(req, aircraft.kind === c.value, S.aircraftKinds[aircraft.kind]);
    case 'FLIGHT_MODE': {
      const on = flightModeOn(plan, c.value);
      return result(req, on, `${S.modes[c.value]}: ${on ? S.yes : S.no}`);
    }
    default:
      return null;
  }
}

function accuracyCheck(
  req: ContractRequirement,
  check: Extract<RequirementCheck, { type: 'ACCURACY_PEC' | 'ACCURACY_ASPRS' }>,
  rmse: RmseSet,
  residuals: readonly Residual[] | null,
  verifiable: boolean,
): RequirementResult {
  const suffix = verifiable ? '' : S.notVerifiable;
  if (check.type === 'ACCURACY_ASPRS') {
    const a = classifyAsprs(rmse, check.horizontalCm, check.verticalCm);
    return result(req, a.passH && a.passV, S.asprs(formatCm(rmse.r), formatCm(rmse.z)) + suffix);
  }
  if (residuals === null) {
    const achieved = predictedPecClass(rmse, check.scaleDenominator, check.contourIntervalM);
    const text =
      achieved === 'FORA' ? S.pecOut(formatCm(rmse.r)) : S.pecClass(achieved, formatCm(rmse.r));
    return result(req, better(achieved, check.cls), text + suffix);
  }
  const pec = classifyPec(residuals, check.scaleDenominator, check.contourIntervalM, check.cls);
  const pass = pec.planimetric.pass && (pec.altimetric?.pass ?? true);
  const achieved = pec.planimetric.achieved;
  const text =
    achieved === 'FORA' ? S.pecOut(formatCm(rmse.r)) : S.pecClass(achieved, formatCm(rmse.r));
  return result(req, pass, text + suffix);
}

// --- Previsão (antes do voo) -------------------------------------------------------

export interface PredictContext {
  catalog: Catalog;
  /** RTK efetivo exige o kit GNSS possuído (catalog §3). */
  ownsRtkKit: boolean;
  fieldEquipmentId: FieldEquipmentId;
  levelScore?: number;
  imuScore?: number;
  atlasCalibrated?: boolean;
  mods?: ModifierSet;
}

export interface PlanAccuracyEstimate {
  target: { x: number; y: number; z: number };
  rmse: RmseSet;
  verifiable: boolean;
  multipliers: Multiplier[];
}

/** Acurácia prevista com fotos ideais sobre o plano (field-setup §5.3, "RMSE previsto"). */
export function estimateFromPlan(
  plan: FlightPlan,
  contract: Pick<Contract, 'aoi' | 'specialRules' | 'requirements'>,
  groundPoints: readonly GroundPoint[],
  ctx: PredictContext,
): PlanAccuracyEstimate {
  const { aircraft, camera, podId } = planEquipment(plan, ctx.catalog);
  const mods = ctx.mods ?? neutralModifiers();
  const phi = aircraft.rtk && ctx.ownsRtkKit ? 1 : 0;
  const emActive =
    resolveRuleEffects(contract.specialRules).flight.emInterference !== null && !aircraft.emImmune;
  const gcps = groundPoints.filter((p) => p.kind === 'GCP');
  const { params, stats } = plan;
  const pod = ctx.catalog.payloads.find((p) => p.id === podId);
  const { model, multipliers } =
    pod && requiresLidar(contract)
      ? lidarModel(pod.rangeAccuracyM, params.heightM, phi, ctx.imuScore ?? 0, mods, emActive)
      : photoModel({
          gsdEffM: stats.gsdM,
          phi,
          gcps,
          aoi: contract.aoi,
          camera,
          meanSkewPx: stats.skewPx,
          lighting: params.lighting,
          specialRules: contract.specialRules,
          forwardOverlapPct: params.forwardOverlapPct,
          meanCount: 1 / ((1 - params.forwardOverlapPct / 100) * (1 - params.sideOverlapPct / 100)),
          redFraction: 0,
          blurFraction: stats.blurPx > 1 ? 1 : 0,
          emImmune: aircraft.emImmune,
          atlasCalibrated: ctx.atlasCalibrated ?? false,
          imuScore: ctx.imuScore ?? 0,
          mods,
        });
  const equipment = ctx.catalog.fieldEquipment.find((f) => f.id === ctx.fieldEquipmentId);
  const sigma = gcpSigma(
    equipment?.sigmaBaseM ?? 0,
    ctx.fieldEquipmentId,
    ctx.levelScore ?? DEFAULT_LEVEL_SCORE,
  );
  const target = targetRmse(model, sigma);
  const hasCps = groundPoints.some((p) => p.kind === 'CP');
  return { target, ...predictedRequirementRmse(target, hasCps), multipliers };
}

/** §10 — Previsão de cada requisito a partir do plano e dos pontos de apoio. */
export function predictRequirements(
  plan: FlightPlan,
  contract: Pick<Contract, 'aoi' | 'specialRules' | 'requirements'>,
  groundPoints: readonly GroundPoint[],
  ctx: PredictContext,
): RequirementResult[] {
  const { aircraft, kinds } = planEquipment(plan, ctx.catalog);
  const { params, stats } = plan;
  let estimate: PlanAccuracyEstimate | null = null;
  const accuracy = () => (estimate ??= estimateFromPlan(plan, contract, groundPoints, ctx));
  const count = (kind: GroundPoint['kind']) => groundPoints.filter((p) => p.kind === kind).length;

  return contract.requirements.map((req) => {
    const fromPlan = planCheck(req, plan, aircraft);
    if (fromPlan) return fromPlan;
    const c = req.check;
    switch (c.type) {
      case 'MAX_GSD_CM':
        return result(req, stats.gsdM * 100 <= c.value, formatCm(stats.gsdM, 2));
      case 'MIN_FORWARD_OVERLAP':
        return result(req, params.forwardOverlapPct >= c.value, pct(params.forwardOverlapPct));
      case 'MIN_SIDE_OVERLAP':
        return result(req, params.sideOverlapPct >= c.value, pct(params.sideOverlapPct));
      case 'SENSOR_KIND':
        return result(req, kinds.includes(c.value), kinds.map((k) => S.sensorKinds[k]).join(' + '));
      case 'ACCURACY_PEC':
      case 'ACCURACY_ASPRS': {
        const e = accuracy();
        return accuracyCheck(req, c, e.rmse, null, e.verifiable);
      }
      case 'MIN_GCP':
        return result(req, count('GCP') >= c.value, S.ofRequired(count('GCP'), c.value));
      case 'MIN_CP':
        return result(req, count('CP') >= c.value, S.ofRequired(count('CP'), c.value));
      case 'MIN_LIDAR_DENSITY': {
        const d = stats.lidarDensity ?? 0;
        return result(req, d >= c.value, S.density(formatNumber(d, 1)));
      }
      case 'MIN_GROUND_DENSITY': {
        const d = stats.groundDensity ?? 0;
        return result(req, d >= c.value, S.density(formatNumber(d, 1)));
      }
      case 'MAX_BLUR_FRACTION':
        return result(req, stats.blurPx <= 1, `${formatNumber(stats.blurPx, 2)} px`);
      // Só verificáveis com dados: aparecem como informativos.
      case 'MIN_EXECUTION':
      case 'MIN_COVERAGE_GREEN':
      case 'MAX_VOLUME_ERROR_PCT':
      case 'NOT_DETECTED':
      case 'FEATURE_CAPTURED':
      default:
        return result(req, true, S.unknown);
    }
  });
}

// --- Avaliação (após o processamento) -----------------------------------------------

/** Medições da missão processada, usadas na avaliação dos requisitos. */
export interface MissionMeasures {
  /** GSD efetivo das fotos válidas; `null` sem fotos válidas. */
  gsdEffM: number | null;
  medianForwardOverlapPct: number | null;
  sideOverlapPct: number | null;
  coverageGreen: number;
  blurFraction: number;
  accuracy: { rmse: RmseSet; residuals: Residual[]; verifiable: boolean };
  gcpCount: number;
  cpCount: number;
  /** Tipos de dado efetivamente gravados. */
  recordedKinds: readonly SensorKind[];
  lidar?: { meanDensity: number; meanGroundDensity: number };
  volumeErrorPct?: number;
  detected: boolean;
  featuresCaptured: readonly string[];
  /** Execução `E` do voo (§10.3), 0..1. */
  execution: number;
}

export function evaluateRequirements(
  plan: FlightPlan,
  measures: MissionMeasures,
  contract: Pick<Contract, 'requirements'>,
  catalog: Catalog,
): RequirementResult[] {
  const { aircraft } = planEquipment(plan, catalog);
  return contract.requirements.map((req) => {
    const fromPlan = planCheck(req, plan, aircraft);
    if (fromPlan) return fromPlan;
    const c = req.check;
    switch (c.type) {
      case 'MAX_GSD_CM': {
        const g = measures.gsdEffM;
        return g === null
          ? result(req, false, S.unknown)
          : result(req, g * 100 <= c.value, formatCm(g, 2));
      }
      case 'MIN_FORWARD_OVERLAP': {
        const p = measures.medianForwardOverlapPct;
        return p === null
          ? result(req, false, S.unknown)
          : result(req, p >= c.value, pctVs(p, c.value));
      }
      case 'MIN_SIDE_OVERLAP': {
        const q = measures.sideOverlapPct;
        return q === null
          ? result(req, false, S.unknown)
          : result(req, q >= c.value, pctVs(q, c.value));
      }
      case 'MIN_COVERAGE_GREEN':
        return result(
          req,
          measures.coverageGreen >= c.value,
          pctVs(measures.coverageGreen * 100, c.value * 100),
        );
      case 'MIN_EXECUTION':
        return result(
          req,
          measures.execution >= c.value,
          pctVs(measures.execution * 100, c.value * 100),
        );
      case 'SENSOR_KIND':
        return result(
          req,
          measures.recordedKinds.includes(c.value),
          measures.recordedKinds.map((k) => S.sensorKinds[k]).join(' + ') || S.unknown,
        );
      case 'ACCURACY_PEC':
      case 'ACCURACY_ASPRS':
        return accuracyCheck(
          req,
          c,
          measures.accuracy.rmse,
          measures.accuracy.residuals,
          measures.accuracy.verifiable,
        );
      case 'MIN_GCP':
        return result(req, measures.gcpCount >= c.value, S.ofRequired(measures.gcpCount, c.value));
      case 'MIN_CP':
        return result(req, measures.cpCount >= c.value, S.ofRequired(measures.cpCount, c.value));
      case 'MIN_LIDAR_DENSITY': {
        const d = measures.lidar?.meanDensity ?? 0;
        return result(req, d >= c.value, S.density(formatNumber(d, 1)));
      }
      case 'MIN_GROUND_DENSITY': {
        const d = measures.lidar?.meanGroundDensity ?? 0;
        return result(req, d >= c.value, S.density(formatNumber(d, 1)));
      }
      case 'MAX_VOLUME_ERROR_PCT': {
        const e = measures.volumeErrorPct;
        return e === undefined
          ? result(req, false, S.unknown)
          : result(req, e <= c.value, `${formatNumber(e, 2)} %`);
      }
      case 'MAX_BLUR_FRACTION':
        return result(req, measures.blurFraction <= c.value, pct(measures.blurFraction * 100));
      case 'NOT_DETECTED':
        return result(req, !measures.detected, measures.detected ? S.detected : S.notDetected);
      case 'FEATURE_CAPTURED': {
        const ok = measures.featuresCaptured.includes(c.featureId);
        return result(req, ok, ok ? S.captured : S.notCaptured);
      }
      default:
        return result(req, false, S.unknown);
    }
  });
}
