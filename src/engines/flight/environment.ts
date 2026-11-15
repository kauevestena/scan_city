/** Ambiente do voo (survey-flight §5.13): vento forte, interferência EM e deriva de rumo. */
import { RULE_PARAMS, resolveRuleEffects } from '@/domain/specialRules';
import type { Aircraft, Contract } from '@/types';

/** Amplitude do tremor lateral da interferência EM (m/s) e da deriva de rumo (graus). */
export const EM_LATERAL_MS = RULE_PARAMS.em.lateralMs;
export const EM_HEADING_DEG = RULE_PARAMS.em.headingDeg;

/** Vento de pico acima da tolerância da aeronave: `mean + gust > windToleranceMs`. */
export function windAboveTolerance(
  wind: Contract['wind'],
  aircraft: Pick<Aircraft, 'windToleranceMs'>,
): boolean {
  return wind.meanMs + wind.gustMs > aircraft.windToleranceMs;
}

/** Fator da deriva: dobra acima da tolerância (`STRONG_WIND`). */
export function driftMultiplier(
  wind: Contract['wind'],
  aircraft: Pick<Aircraft, 'windToleranceMs'>,
): number {
  return windAboveTolerance(wind, aircraft) ? 2 : 1;
}

/** `EM_INTERFERENCE` age sobre aeronaves não imunes (o Atlas é imune). */
export function emActive(
  rules: Contract['specialRules'],
  aircraft: Pick<Aircraft, 'emImmune'>,
): boolean {
  return resolveRuleEffects(rules).flight.emInterference !== null && !aircraft.emImmune;
}

/** Ruído 1D em [−1, 1] → tremor lateral (m/s) e desvio de rumo (rad, lento). */
export function emDisturbance(
  tS: number,
  noise: (x: number) => number,
): { lateralMs: number; headingRad: number } {
  return {
    lateralMs: EM_LATERAL_MS * noise(tS * 3),
    headingRad: ((EM_HEADING_DEG * Math.PI) / 180) * noise(tS * 0.2 + 100),
  };
}
