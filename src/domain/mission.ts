/**
 * Avaliação da missão — domain-math §10: compõe cobertura, acurácia, normas, LiDAR,
 * volumetria, requisitos e o score. O pagamento e as recompensas chegam por injeção de
 * dependência (`deps`), implementados em `economy.ts`.
 */
import type { Catalog } from '@/data/catalog';
import { clamp } from '@/lib/math';
import type { Rng } from '@/lib/rng';
import type {
  CentsBRL,
  Contract,
  CoverageResult,
  Hardware,
  MissionData,
  ModifierSet,
  PaymentBreakdown,
  PecClass,
  QualityReport,
  RequirementResult,
  SensorKind,
  Shot,
  StaffRoleId,
  Vehicle,
} from '@/types';
import type { TerrainSampler } from '@/world/terrain/TerrainSampler';
import {
  DEFAULT_LEVEL_SCORE,
  effectiveGsdM,
  gcpSigma,
  generateResiduals,
  lidarModel,
  photoModel,
  requirementAccuracy,
  rmseSet,
  rtkFixFraction,
  targetRmse,
} from './accuracy';
import {
  buildCoverage,
  createCoverageGrid,
  excludedCellsWhere,
  isShotValid,
  summarizeCoverage,
  type ShotRules,
} from './coverage';
import { difficultyParams } from './difficulty';
import { plannedSamples } from './corridor';
import {
  bestCounts,
  executionFactor,
  gradeLetter,
  missionExecution,
  pilotBonus,
} from './execution';
import { capturedFeatures } from './features';
import { median } from './stats';
import { pixelPitchM, realForwardOverlap, realSideOverlap } from './photogrammetry';
import {
  processingBaseTimeS,
  processingSpeed,
  processingTimeS,
  lensCalibration,
} from './processing';
import {
  planEquipment,
  requiresLidar,
  evaluateRequirements,
  type MissionMeasures,
} from './requirements';
import { classifyAsprs, classifyPec, PEC_CLASSES } from './standards';
import {
  borderMeanElevation,
  meanDepthM,
  measuredVolumeM3,
  referenceVolumeM3,
  volumeErrorPct,
} from './volumetrics';
import { resolveRuleEffects } from './specialRules';

// --- Pagamento e recompensas (contratos com economy.ts) --------------------------------

export interface PaymentInput {
  baseBRL: CentsBRL;
  isReplay: boolean;
  qualityFactor: number;
  rivalFactor: number;
  contractPaymentMod: number;
  /** Fator da dificuldade do voo (0,8 fácil, 1 média, 1,25 difícil; ADR-035). Padrão: 1. */
  difficultyFactor?: number;
  staff: Record<StaffRoleId, number>;
  penaltiesBRL: CentsBRL;
}

export interface RewardInput {
  xp: number;
  reputationReward: number;
  isReplay: boolean;
  score: number;
  critical: boolean;
  reputationGainMod: number;
}

export interface MissionDeps {
  computePayment(input: PaymentInput): PaymentBreakdown;
  computeRewards(input: RewardInput): { xp: number; reputationDelta: number };
}

/** §12.1 — Fator de qualidade Q. `pilot` é o bônus de pilotagem (0, 0,05 ou 0,10). */
export function qualityFactor(
  score: number,
  critical: boolean,
  requirements: readonly RequirementResult[],
  betterClass: boolean,
  pilot = 0,
): number {
  if (critical) return 0.1;
  let q = 0.6 + 0.4 * score;
  for (const r of requirements) {
    if (r.pass) continue;
    if (r.severity === 'MAJOR') q *= 0.85;
    else if (r.severity === 'MINOR') q *= 0.95;
  }
  return q + (betterClass ? 0.1 : 0) + pilot;
}

// --- Score (§10.1) ---------------------------------------------------------------------

export interface ScoreParts {
  acc: number;
  cov: number;
  gsd: number;
  clean: number;
}

export function qualityScore(p: ScoreParts): number {
  return 0.4 * p.acc + 0.3 * p.cov + 0.2 * p.gsd + 0.1 * p.clean;
}

/** `clamp(0,5 + (tol/valor − 1), 0, 1)`: 1 quando folgado, 0,5 no limite. */
export function toleranceScore(tolerance: number, value: number): number {
  if (value <= 0) return 1;
  return clamp(0.5 + (tolerance / value - 1), 0, 1);
}

// --- Medições ------------------------------------------------------------------------

/** Mediana da sobreposição longitudinal real (%) entre disparos automáticos consecutivos. */
export function medianForwardOverlapPct(shots: readonly Shot[]): number | null {
  const byLine = new Map<string, Shot[]>();
  for (const s of shots) {
    if (s.manual) continue;
    const key = `${s.sortie}:${s.lineIndex}`;
    const list = byLine.get(key);
    if (list) list.push(s);
    else byLine.set(key, [s]);
  }
  const overlaps: number[] = [];
  for (const list of byLine.values()) {
    list.sort((a, b) => a.t - b.t);
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1] as Shot;
      const b = list[i] as Shot;
      overlaps.push(realForwardOverlap(Math.hypot(b.u - a.u, b.v - a.v), b.footprintHM) * 100);
    }
  }
  return overlaps.length > 0 ? median(overlaps) : null;
}

/**
 * Sobreposição lateral estimada (%): média, sobre pares de linhas vizinhas da mesma passada,
 * de `realSideOverlap(espaçamento real − S, S, W_g médio)`.
 */
export function estimatedSideOverlapPct(
  mission: Pick<MissionData, 'plan' | 'shots'>,
): number | null {
  const { lines, stats } = mission.plan;
  const flown: Array<{ pass: string; planned: number; actual: number; wg: number }> = [];
  for (const line of lines) {
    const shots = mission.shots.filter((s) => s.lineIndex === line.index && !s.manual);
    if (shots.length === 0) continue;
    const alongU = line.start.v === line.end.v;
    const planned = alongU ? line.start.v : line.start.u;
    const actual = shots.reduce((sum, s) => sum + (alongU ? s.v : s.u), 0) / shots.length;
    const wg = shots.reduce((sum, s) => sum + s.footprintWM, 0) / shots.length;
    flown.push({ pass: line.pass, planned, actual, wg });
  }
  const values: number[] = [];
  for (const pass of ['PRIMARY', 'CROSS']) {
    const set = flown.filter((f) => f.pass === pass).sort((a, b) => a.planned - b.planned);
    for (let i = 1; i < set.length; i++) {
      const a = set[i - 1] as (typeof set)[number];
      const b = set[i] as (typeof set)[number];
      // Só linhas vizinhas no plano (sem lacuna de linhas não voadas).
      if (Math.abs(b.planned - a.planned - stats.spacingM) > stats.spacingM * 0.5) continue;
      const error = Math.abs(b.actual - a.actual) - stats.spacingM;
      values.push(realSideOverlap(error, stats.spacingM, (a.wg + b.wg) / 2) * 100);
    }
  }
  return values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : null;
}

/** Densidade média (pts/m²) de pulsos e de solo nas células não excluídas da grade LiDAR. */
export function lidarStats(
  mission: Pick<MissionData, 'lidar'>,
  excludedCells: readonly number[],
): { meanDensity: number; meanGroundDensity: number } | undefined {
  const grid = mission.lidar?.grid;
  if (!grid) return undefined;
  const excluded = new Set(excludedCells);
  let pulses = 0;
  let ground = 0;
  let n = 0;
  grid.pulses.forEach((p, i) => {
    if (excluded.has(i)) return;
    pulses += p;
    ground += grid.ground[i] ?? 0;
    n++;
  });
  if (n === 0) return { meanDensity: 0, meanGroundDensity: 0 };
  return {
    meanDensity: pulses / n / grid.cellAreaM2,
    meanGroundDensity: ground / n / grid.cellAreaM2,
  };
}

/**
 * Cobertura das missões LiDAR (OQ-008): cada célula vale `min(5, ⌊5·densidade/ref⌋)`
 * "fotos", com `ref` = densidade exigida (ou 10 pts/m²).
 */
export function lidarCoverage(
  mission: Pick<MissionData, 'lidar'>,
  aoi: Contract['aoi'],
  excludedCells: readonly number[],
  referenceDensity: number,
): CoverageResult {
  const grid = createCoverageGrid(aoi);
  const lidar = mission.lidar?.grid;
  if (lidar) {
    grid.counts = grid.counts.map((_, i) =>
      Math.min(5, Math.floor((5 * (lidar.pulses[i] ?? 0)) / lidar.cellAreaM2 / referenceDensity)),
    );
  }
  return summarizeCoverage(grid, excludedCells);
}

// --- Avaliação --------------------------------------------------------------------------

export interface MissionContext {
  catalog: Catalog;
  terrain: TerrainSampler;
  ownsRtkKit: boolean;
  modifiers: ModifierSet;
  staff: Record<StaffRoleId, number>;
  hardware: Hardware;
  inField: boolean;
  van?: Vehicle;
  /** O contrato ainda não foi aprovado antes (souvenir na 1ª aprovação). */
  firstApproval: boolean;
  /** PRNG seedado da missão (resíduos e volumetria). */
  rng: Rng;
  deps: MissionDeps;
}

const DEFAULT_LIDAR_REFERENCE_DENSITY = 10;

export function evaluateMission(
  mission: MissionData,
  contract: Contract,
  ctx: MissionContext,
): QualityReport {
  const { plan } = mission;
  const { aircraft, camera, focalM, podId } = planEquipment(plan, ctx.catalog);
  const pod = ctx.catalog.payloads.find((p) => p.id === podId);
  const rules = contract.specialRules;
  const effects = resolveRuleEffects(rules);
  const lidarMission = requiresLidar(contract);

  // Execução do voo (§10.3). Sem `linePasses` (save antigo ou missão sintética) vale 1.
  const plannedPerLine = plan.lines.map((l) => plannedSamples(l, plan.stats.baseM));
  const execution = missionExecution(mission.linePasses, plannedPerLine);

  // Cobertura (água sempre excluída, OQ-007).
  const shotRules: ShotRules = {
    sensorKind: camera.kind,
    specularWater: effects.coverage.specularWater,
  };
  const excluded = excludedCellsWhere(
    createCoverageGrid(contract.aoi),
    (u, v) => ctx.terrain.landCover(u, v) === 'WATER',
  );
  const lidarRef = contract.requirements.find((r) => r.check.type === 'MIN_LIDAR_DENSITY')
    ?.check as { value: number } | undefined;
  const coverage =
    lidarMission && mission.lidar
      ? lidarCoverage(
          mission,
          contract.aoi,
          excluded,
          lidarRef?.value ?? DEFAULT_LIDAR_REFERENCE_DENSITY,
        )
      : buildCoverage(mission.shots, contract.aoi, {
          aircraftKind: aircraft.kind,
          sensor: camera,
          focalM,
          rules: shotRules,
          excludedCells: excluded,
        });

  // Medições das fotos.
  const shots = mission.shots;
  const validShots = shots.filter((s) => isShotValid(s, shotRules));
  const gsdEff =
    validShots.length > 0 ? effectiveGsdM(validShots, pixelPitchM(camera), focalM) : null;
  const blurFraction = shots.length > 0 ? shots.filter((s) => s.blurred).length / shots.length : 0;
  const meanSkewPx = shots.length > 0 ? shots.reduce((s, x) => s + x.skewPx, 0) / shots.length : 0;
  const phi = rtkFixFraction(shots, aircraft.rtk && ctx.ownsRtkKit);

  // Acurácia.
  const gcps = mission.groundPoints.filter((p) => p.kind === 'GCP');
  const imuScore = mission.minigames.imuScore ?? 0;
  const { model, multipliers } =
    lidarMission && pod
      ? lidarModel(
          pod.rangeAccuracyM,
          plan.params.heightM,
          aircraft.rtk && ctx.ownsRtkKit ? 1 : 0,
          imuScore,
          ctx.modifiers,
          effects.flight.emInterference !== null && !aircraft.emImmune,
          execution,
        )
      : photoModel({
          gsdEffM: gsdEff ?? 0,
          phi,
          gcps,
          aoi: contract.aoi,
          camera,
          meanSkewPx,
          lighting: plan.params.lighting,
          specialRules: rules,
          forwardOverlapPct: plan.params.forwardOverlapPct,
          meanCount: coverage.meanCount,
          redFraction: coverage.red,
          blurFraction,
          emImmune: aircraft.emImmune,
          atlasCalibrated: mission.atlasCalibrated,
          imuScore,
          execution,
          mods: ctx.modifiers,
        });
  const equipment = ctx.catalog.fieldEquipment.find((f) => f.id === mission.fieldEquipmentId);
  const sigma = gcpSigma(
    equipment?.sigmaBaseM ?? 0,
    mission.fieldEquipmentId,
    mission.minigames.levelScore ?? DEFAULT_LEVEL_SCORE,
  );
  const residuals = generateResiduals(
    mission.groundPoints,
    targetRmse(model, sigma),
    ctx.rng.fork('residuals'),
  );
  const reqAccuracy = requirementAccuracy(residuals);
  const cps = residuals.filter((r) => r.kind === 'CP');

  // Normas (o relatório mostra a primeira exigência de cada tipo).
  const pecReq = contract.requirements.find((r) => r.check.type === 'ACCURACY_PEC')?.check;
  const asprsReq = contract.requirements.find((r) => r.check.type === 'ACCURACY_ASPRS')?.check;
  const pec =
    pecReq?.type === 'ACCURACY_PEC'
      ? classifyPec(
          reqAccuracy.residuals,
          pecReq.scaleDenominator,
          pecReq.contourIntervalM,
          pecReq.cls,
        )
      : undefined;
  const asprs =
    asprsReq?.type === 'ACCURACY_ASPRS'
      ? classifyAsprs(reqAccuracy.rmse, asprsReq.horizontalCm, asprsReq.verticalCm)
      : undefined;

  // LiDAR e volumetria.
  const lidar = lidarStats(mission, excluded);
  let volume: QualityReport['volume'];
  if (contract.requirements.some((r) => r.check.type === 'MAX_VOLUME_ERROR_PCT')) {
    const reference = referenceVolumeM3(
      ctx.terrain,
      contract.aoi,
      borderMeanElevation(ctx.terrain, contract.aoi),
    );
    const measured = measuredVolumeM3(
      reference,
      reqAccuracy.rmse.z,
      meanDepthM(reference),
      coverage.red,
      ctx.rng.fork('volume'),
    );
    volume = {
      referenceM3: reference.cutM3 + reference.fillM3,
      measuredM3: measured,
      errorPct: volumeErrorPct(reference, measured),
    };
  }

  // Requisitos.
  const recordedKinds: SensorKind[] = [];
  if (shots.length > 0) recordedKinds.push(camera.kind);
  if (mission.lidar && mission.lidar.grid.pulses.some((p) => p > 0)) recordedKinds.push('LIDAR');
  const featuresCaptured = [
    ...new Set([
      ...mission.events.featuresCaptured,
      ...capturedFeatures(mission, ctx.terrain, {
        aoi: contract.aoi,
        aircraftKind: aircraft.kind,
        sensor: camera,
        focalM,
        rules: shotRules,
      }),
    ]),
  ];
  const measures: MissionMeasures = {
    gsdEffM: gsdEff,
    medianForwardOverlapPct: medianForwardOverlapPct(shots),
    sideOverlapPct: estimatedSideOverlapPct(mission),
    coverageGreen: coverage.green,
    blurFraction,
    accuracy: reqAccuracy,
    gcpCount: gcps.length,
    cpCount: mission.groundPoints.length - gcps.length,
    recordedKinds,
    detected: mission.events.detected,
    featuresCaptured,
    execution,
    ...(lidar ? { lidar } : {}),
    ...(volume ? { volumeErrorPct: volume.errorPct } : {}),
  };
  const requirements = evaluateRequirements(plan, measures, contract, ctx.catalog);

  // Aprovação (§10.2): crítico se um requisito CRITICAL falhar ou se não houver dados.
  const hasData = shots.length > 0 || recordedKinds.includes('LIDAR');
  const critical = !hasData || requirements.some((r) => r.severity === 'CRITICAL' && !r.pass);

  // Score (§10.1).
  const tolerances: number[] = [];
  if (pec) {
    tolerances.push(toleranceScore(pec.planimetric.epM, reqAccuracy.rmse.r));
    if (pec.altimetric) tolerances.push(toleranceScore(pec.altimetric.epM, reqAccuracy.rmse.z));
  }
  if (asprs) {
    tolerances.push(toleranceScore(asprs.horizontalCm, asprs.rmseHcm));
    tolerances.push(toleranceScore(asprs.verticalCm, asprs.rmseVcm));
  }
  const gsdReqs = contract.requirements.flatMap((r) =>
    r.check.type === 'MAX_GSD_CM' ? [r.check.value / 100] : [],
  );
  const parts: ScoreParts = {
    acc: tolerances.length > 0 ? Math.min(...tolerances) : 1,
    cov: clamp(coverage.green + 0.5 * coverage.yellow, 0, 1),
    gsd:
      gsdReqs.length === 0
        ? 1
        : gsdEff === null
          ? 0
          : Math.min(...gsdReqs.map((req) => toleranceScore(req, gsdEff))),
    clean: clamp(1 - 0.25 * mission.events.collisions - 0.5 * blurFraction, 0, 1),
  };
  // A nota técnica vezes o fator da execução do voo (1 quando não há dado de execução).
  const score = critical ? 0 : qualityScore(parts) * executionFactor(execution);
  const pilot = mission.linePasses ? pilotBonus(execution) : 0;

  // Pagamento e recompensas.
  const betterClass =
    pec !== undefined &&
    pec.planimetric.achieved !== 'FORA' &&
    PEC_CLASSES.indexOf(pec.planimetric.achieved) <
      PEC_CLASSES.indexOf(pec.requiredClass as PecClass);
  const penaltiesBRL = Math.round(
    (mission.events.crashes * aircraft.priceBRL * aircraft.repairCostPct) / 100,
  );
  const basePayment = ctx.deps.computePayment({
    baseBRL: contract.basePaymentBRL,
    isReplay: mission.isReplay,
    qualityFactor: qualityFactor(score, critical, requirements, betterClass, pilot),
    rivalFactor: mission.rivalAdjustment,
    contractPaymentMod: ctx.modifiers.contractPayment,
    // A dificuldade escolhida antes do voo: a fácil paga menos, a difícil, mais (ADR-035).
    difficultyFactor: difficultyParams(mission).paymentFactor,
    staff: ctx.staff,
    penaltiesBRL,
  });
  // Bônus de anéis (R$ 50 cada), só em contratos com `COLLECTIBLE_RINGS`.
  const ringBonusBRL = effects.flight.rings
    ? mission.events.ringsCollected * effects.flight.rings.bonusCents
    : 0;
  const payment =
    ringBonusBRL > 0
      ? { ...basePayment, ringBonusBRL, totalBRL: basePayment.totalBRL + ringBonusBRL }
      : basePayment;
  const rewards = ctx.deps.computeRewards({
    xp: contract.xp,
    reputationReward: contract.reputationReward,
    isReplay: mission.isReplay,
    score,
    critical,
    reputationGainMod: ctx.modifiers.reputationGain,
  });

  const nPulses = mission.lidar?.grid.pulses.reduce((s, p) => s + p, 0) ?? 0;
  const speed = processingSpeed(ctx.hardware, ctx.staff, ctx.catalog.staff, ctx.inField, ctx.van);

  const report: QualityReport = {
    missionId: mission.id,
    contractId: contract.id,
    residuals,
    rmse: {
      gcp: rmseSet(residuals.filter((r) => r.kind === 'GCP')),
      cp: cps.length > 0 ? rmseSet(cps) : null,
    },
    multipliers,
    coverage,
    requirements,
    approved: !critical,
    critical,
    qualityScore: score,
    payment,
    xp: rewards.xp,
    reputationDelta: rewards.reputationDelta,
    processingTimeS: processingTimeS(processingBaseTimeS(shots.length, nPulses), speed),
  };
  if (shots.length > 0) {
    // O ajustamento estima a calibração da câmera usada nas fotos (§12.4).
    const qualityProduct = multipliers.reduce((p, m) => p * m.xy, 1);
    report.lens = lensCalibration(camera, focalM, ctx.rng.fork('lens'), qualityProduct);
  }
  if (pec) report.pec = pec;
  if (asprs) report.asprs = asprs;
  if (lidar) report.lidarStats = lidar;
  if (mission.linePasses) {
    report.execution = {
      score: execution,
      letter: gradeLetter(execution),
      counts: bestCounts(mission.linePasses, plannedPerLine),
      pilotBonus: critical ? 0 : pilot,
    };
  }
  if (volume) report.volume = volume;
  if (!critical && !mission.isReplay && ctx.firstApproval)
    report.souvenirAwarded = contract.souvenirId;
  return report;
}
