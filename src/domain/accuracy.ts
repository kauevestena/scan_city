/**
 * Modelo de acurácia — domain-math §6 (ADR-016: modelo determinístico, não SfM real).
 * GSD efetivo e RTK → RMSE-base → multiplicadores → σ dos pontos de apoio → RMSE-alvo →
 * resíduos sorteados com seed e escalados exatamente ao alvo.
 */
import { SIGMA_Z_FACTOR } from '@/data/catalog';
import { STRINGS } from '@/data/strings';
import type { Rng } from '@/lib/rng';
import type { FieldEquipmentId, GroundPoint, LightingId, Residual, RmseSet, Shot } from '@/types';
import { gsd } from './photogrammetry';

const L = STRINGS.accuracy.multipliers;

export interface AxisPair {
  xy: number;
  z: number;
}

export interface Multiplier extends AxisPair {
  key: string;
  label: string;
}

/** Média dos GSDs (pelo AGL de cada foto) das fotos válidas, em m/px. */
export function effectiveGsdM(
  validShots: readonly Shot[],
  pixelPitchM: number,
  focalM: number,
): number {
  if (validShots.length === 0) return 0;
  const sum = validShots.reduce((s, shot) => s + gsd(shot.aglM, pixelPitchM, focalM), 0);
  return sum / validShots.length;
}

/** φ = (nFIX + 0,5·nFLOAT)/n; 0 sem RTK efetivo (aeronave RTK e kit GNSS possuído). */
export function rtkFixFraction(shots: readonly Shot[], rtkEnabled: boolean): number {
  if (!rtkEnabled || shots.length === 0) return 0;
  const score = shots.reduce(
    (s, shot) => s + (shot.rtk === 'FIX' ? 1 : shot.rtk === 'FLOAT' ? 0.5 : 0),
    0,
  );
  return score / shots.length;
}

/** §6.2 — RMSE-base por eixo: xy de 1,0 a 1,5 GSD e z de 1,5 a 2,5 GSD, conforme o RTK. */
export function baseRmse(gsdEffM: number, phi: number): AxisPair {
  return { xy: gsdEffM * (1 * phi + 1.5 * (1 - phi)), z: gsdEffM * (1.5 * phi + 2.5 * (1 - phi)) };
}

/** Contexto de §6.3. Campos ausentes são neutros. */
export interface AccuracyContext {
  gcpCount: number;
  /** φ, fração RTK FIX. */
  phi: number;
  /** Cobertura do casco convexo dos GCPs (0..1). */
  hullCoverage: number;
  /** Índice de colinearidade dos GCPs (0..1). */
  collinearity: number;
  rollingShutter: boolean;
  /** Skew médio das fotos (px). */
  meanSkewPx: number;
  /** As fotos usadas no ajuste são RGB (a iluminação só pesa nelas). */
  rgbPhotos: boolean;
  lighting: LightingId;
  homogeneousTexture: boolean;
  /** Sobreposição longitudinal planejada (%), para a penalidade de textura. */
  forwardOverlapPct: number;
  specularWater: boolean;
  /** Fotos por célula, média `m̄`. */
  meanCount: number;
  /** Fração vermelha da cobertura. */
  redFraction: number;
  /** Fração de fotos borradas. */
  blurFraction: number;
  emInterference: boolean;
  emImmune: boolean;
  /** `qualityPenalty` da câmera. */
  cameraPenalty: number;
  atlasCalibrated: boolean;
  imuScore: number;
  mods: { rmseGlobal: number; texturePenalty: number; rollingShutterPenalty: number };
}

const LIGHTING_MULT: Partial<Record<LightingId, AxisPair>> = {
  GOLDEN_HOUR: { xy: 1.25, z: 1.3 },
  BLIZZARD: { xy: 1.2, z: 1.25 },
  MAGIC_FOG: { xy: 1.3, z: 1.4 },
};

function gcpCountMult(n: number, phi: number): AxisPair {
  if (n >= 5) return { xy: 1, z: 1 };
  if (n === 4) return { xy: 1.25, z: 1.35 };
  if (n === 3) return { xy: 1.6, z: 1.9 };
  return phi >= 0.8 ? { xy: 2, z: 2.5 } : { xy: 4, z: 6 };
}

/** §6.3 — Multiplicadores aplicados (só os diferentes de 1), com rótulo pt-BR. */
export function accuracyMultipliers(ctx: AccuracyContext): Multiplier[] {
  const out: Multiplier[] = [];
  const add = (key: string, label: string, xy: number, z: number = xy) => {
    if (xy !== 1 || z !== 1) out.push({ key, label, xy, z });
  };

  const count = gcpCountMult(ctx.gcpCount, ctx.phi);
  add('gcpCount', L.gcpCount, count.xy, count.z);

  if (ctx.gcpCount >= 3) {
    add(
      'gcpGeometry',
      L.gcpGeometry,
      1 + (1.5 * Math.max(0, 0.4 - ctx.hullCoverage)) / 0.4,
      ctx.collinearity < 0.05 ? 3 : 1 + Math.max(0, 0.3 - ctx.collinearity) / 0.3,
    );
  }

  if (ctx.rollingShutter) {
    const k = ctx.meanSkewPx;
    const raw = ctx.phi < 0.5 ? Math.min(1.8, 1 + 0.04 * k) : Math.min(1.4, 1 + 0.02 * k);
    const m = 1 + (raw - 1) * ctx.mods.rollingShutterPenalty;
    add('rollingShutter', ctx.phi < 0.5 ? L.rollingShutterNoRtk : L.rollingShutter, m);
  }

  const light = LIGHTING_MULT[ctx.lighting];
  if (ctx.rgbPhotos && light) {
    add('lighting', L.lighting[ctx.lighting as keyof typeof L.lighting], light.xy, light.z);
  }

  if (ctx.homogeneousTexture) {
    add(
      'texture',
      L.texture,
      1 + 0.6 * (ctx.forwardOverlapPct < 80 ? 1 : 0.4) * ctx.mods.texturePenalty,
    );
  }

  if (ctx.specularWater && ctx.lighting === 'SUN_HIGH') add('specular', L.specular, 1.15, 1.3);
  if (ctx.meanCount < 5) add('overlap', L.overlap, 1 + 0.12 * (5 - ctx.meanCount));
  if (ctx.redFraction > 0.1) add('holes', L.holes, 1 + ctx.redFraction);
  add('blur', L.blur, 1 + 0.5 * ctx.blurFraction);
  if (ctx.emInterference && !ctx.emImmune) add('em', L.em, 1.2);

  const q = ctx.atlasCalibrated ? 1 + (ctx.cameraPenalty - 1) * 0.5 : ctx.cameraPenalty;
  add('camera', ctx.atlasCalibrated ? L.cameraCalibrated : L.camera, q);

  add('imu', L.imu, 1 - 0.08 * ctx.imuScore, 1 - 0.12 * ctx.imuScore);
  add('skills', L.skills, ctx.mods.rmseGlobal);
  return out;
}

/** RMSE do modelo = base × ∏ multiplicadores. */
export function modelRmse(base: AxisPair, multipliers: readonly AxisPair[]): AxisPair {
  return multipliers.reduce((acc, m) => ({ xy: acc.xy * m.xy, z: acc.z * m.z }), base);
}

/** Padrão de `levelScore` quando o mini-game de bolha não é jogado. */
export const DEFAULT_LEVEL_SCORE = 0.5;

/** §6.4 — σ de medição dos pontos de apoio (o GNSS mede a altitude com σ × 1,5). */
export function gcpSigma(
  sigmaBaseM: number,
  equipment: FieldEquipmentId,
  levelScore: number = DEFAULT_LEVEL_SCORE,
): AxisPair {
  const xy = sigmaBaseM * (1 + 2 * (1 - levelScore));
  return { xy, z: xy * SIGMA_Z_FACTOR[equipment] };
}

/** RMSE-alvo por eixo: √(modelo² + σ²). */
export function targetRmse(model: AxisPair, sigma: AxisPair): { x: number; y: number; z: number } {
  const xy = Math.hypot(model.xy, sigma.xy);
  return { x: xy, y: xy, z: Math.hypot(model.z, sigma.z) };
}

/** √(Σv²/n); 0 sem valores. */
export function rmse(values: readonly number[]): number {
  return values.length > 0 ? Math.sqrt(values.reduce((s, v) => s + v * v, 0) / values.length) : 0;
}

export function rmseSet(residuals: readonly Residual[]): RmseSet {
  const x = rmse(residuals.map((r) => r.dxM));
  const y = rmse(residuals.map((r) => r.dyM));
  return { x, y, z: rmse(residuals.map((r) => r.dzM)), r: Math.hypot(x, y) };
}

/** Fator do ajuste sobre os GCPs: eles são "puxados" para perto do alvo. */
export const GCP_RESIDUAL_FACTOR = 0.55;
/** Sem CPs, a acurácia de requisito usa o RMSE dos GCPs × 1,8. */
export const NO_CP_FACTOR = 1.8;

/** Sorteia um eixo e reescala para que o RMSE do grupo seja exatamente `target`. */
function scaledAxis(n: number, target: number, rng: Rng): number[] {
  const draws = Array.from({ length: n }, () => rng.normal());
  const current = rmse(draws);
  if (current === 0) return draws.map(() => target);
  return draws.map((d) => (d * target) / current);
}

/**
 * §6.5 — Resíduos determinísticos: CPs com RMSE exatamente igual ao alvo; GCPs com 0,55 ×
 * o alvo. A ordem de saída é a mesma de `points`.
 */
export function generateResiduals(
  points: readonly GroundPoint[],
  target: { x: number; y: number; z: number },
  rng: Rng,
): Residual[] {
  const out = new Map<string, Residual>();
  const groups: Array<[GroundPoint['kind'], number]> = [
    ['CP', 1],
    ['GCP', GCP_RESIDUAL_FACTOR],
  ];
  for (const [kind, factor] of groups) {
    const group = points.filter((p) => p.kind === kind);
    if (group.length === 0) continue;
    const dx = scaledAxis(group.length, target.x * factor, rng);
    const dy = scaledAxis(group.length, target.y * factor, rng);
    const dz = scaledAxis(group.length, target.z * factor, rng);
    group.forEach((p, i) => {
      out.set(p.id, {
        pointId: p.id,
        kind,
        dxM: dx[i] as number,
        dyM: dy[i] as number,
        dzM: dz[i] as number,
      });
    });
  }
  return points.map((p) => out.get(p.id) as Residual);
}

/**
 * RMSE usado nos requisitos: o dos CPs; sem CPs, o dos GCPs × 1,8 ("não verificável").
 * `residuals` traz os escalonados de quem decide a classe (PEC usa os mesmos).
 */
export function requirementAccuracy(residuals: readonly Residual[]): {
  rmse: RmseSet;
  residuals: Residual[];
  verifiable: boolean;
} {
  const cps = residuals.filter((r) => r.kind === 'CP');
  if (cps.length > 0) return { rmse: rmseSet(cps), residuals: cps, verifiable: true };
  const scaled = residuals.map((r) => ({
    ...r,
    dxM: r.dxM * NO_CP_FACTOR,
    dyM: r.dyM * NO_CP_FACTOR,
    dzM: r.dzM * NO_CP_FACTOR,
  }));
  return { rmse: rmseSet(scaled), residuals: scaled, verifiable: false };
}
