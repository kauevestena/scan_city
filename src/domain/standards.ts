/** Normas cartográficas — domain-math §8 (PEC-PCD da ET-CQDG e ASPRS 2023). */
import type { AsprsResult, PecAxisResult, PecClass, PecResult, Residual, RmseSet } from '@/types';

export const PEC_CLASSES: readonly PecClass[] = ['A', 'B', 'C', 'D'];

/** Planimetria: PEC e EP em mm na escala da carta. */
const PLANIMETRIC_MM: Record<PecClass, { pec: number; ep: number }> = {
  A: { pec: 0.28, ep: 0.17 },
  B: { pec: 0.5, ep: 0.3 },
  C: { pec: 0.8, ep: 0.5 },
  D: { pec: 1, ep: 0.6 },
};

/** Altimetria: frações da equidistância das curvas de nível. */
const ALTIMETRIC_EQ: Record<PecClass, { pec: number; ep: number }> = {
  A: { pec: 0.27, ep: 1 / 6 },
  B: { pec: 1 / 2, ep: 1 / 3 },
  C: { pec: 3 / 5, ep: 2 / 5 },
  D: { pec: 3 / 4, ep: 1 / 2 },
};

/** Fração mínima de pontos com erro ≤ PEC. */
export const PEC_MIN_FRACTION = 0.9;

export function pecPlanimetricLimits(
  cls: PecClass,
  scaleDenominator: number,
): { pecM: number; epM: number } {
  const mm = PLANIMETRIC_MM[cls];
  return { pecM: (mm.pec * scaleDenominator) / 1000, epM: (mm.ep * scaleDenominator) / 1000 };
}

export function pecAltimetricLimits(
  cls: PecClass,
  contourIntervalM: number,
): { pecM: number; epM: number } {
  const f = ALTIMETRIC_EQ[cls];
  return { pecM: f.pec * contourIntervalM, epM: f.ep * contourIntervalM };
}

function rootMeanSquare(values: readonly number[]): number {
  return values.length > 0 ? Math.sqrt(values.reduce((s, v) => s + v * v, 0) / values.length) : 0;
}

function classifyAxis(
  errors: readonly number[],
  limits: (cls: PecClass) => { pecM: number; epM: number },
  requiredClass: PecClass,
): PecAxisResult {
  const rmse = rootMeanSquare(errors);
  const within = (pecM: number) =>
    errors.length > 0 ? errors.filter((e) => e <= pecM).length / errors.length : 0;
  const achieved =
    PEC_CLASSES.find((cls) => {
      const l = limits(cls);
      return errors.length > 0 && rmse <= l.epM && within(l.pecM) >= PEC_MIN_FRACTION;
    }) ?? 'FORA';
  const required = limits(requiredClass);
  return {
    achieved,
    epM: required.epM,
    pecM: required.pecM,
    pass:
      achieved !== 'FORA' && PEC_CLASSES.indexOf(achieved) <= PEC_CLASSES.indexOf(requiredClass),
    pct90: within(required.pecM),
  };
}

/**
 * Classe PEC-PCD atingida: a melhor (A→D) com RMSE ≤ EP **e** ≥ 90 % dos pontos com erro
 * ≤ PEC. A planimetria usa o erro resultante √(dx² + dy²); a altimetria, |dz| (só com Eq).
 * `epM`, `pecM` e `pct90` se referem à classe exigida.
 */
export function classifyPec(
  residuals: readonly Residual[],
  scaleDenominator: number,
  contourIntervalM?: number,
  requiredClass: PecClass = 'A',
): PecResult {
  const planimetric = classifyAxis(
    residuals.map((r) => Math.hypot(r.dxM, r.dyM)),
    (cls) => pecPlanimetricLimits(cls, scaleDenominator),
    requiredClass,
  );
  const result: PecResult = { scaleDenominator, requiredClass, planimetric };
  if (contourIntervalM !== undefined) {
    result.altimetric = classifyAxis(
      residuals.map((r) => Math.abs(r.dzM)),
      (cls) => pecAltimetricLimits(cls, contourIntervalM),
      requiredClass,
    );
  }
  return result;
}

/** ASPRS 2023: RMSE horizontal (resultante) e vertical contra as classes exigidas, em cm. */
export function classifyAsprs(
  rmse: RmseSet,
  horizontalCm: number,
  verticalCm: number,
): AsprsResult {
  const rmseHcm = rmse.r * 100;
  const rmseVcm = rmse.z * 100;
  return {
    horizontalCm,
    verticalCm,
    rmseHcm,
    rmseVcm,
    passH: rmseHcm <= horizontalCm,
    passV: rmseVcm <= verticalCm,
  };
}
