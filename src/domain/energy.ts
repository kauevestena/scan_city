/** Energia — domain-math §7. A energia é uma fração de 0 a 1 da bateria (ou do papo do Atlas). */

export interface DrainContext {
  enduranceS: number;
  /** Modificador `endurance` das skills. */
  enduranceMod: number;
  speedMs: number;
  vCruiseMs: number;
  /** Intensidade do vento (o sinal é ignorado). */
  windMs: number;
  climbing: boolean;
  /** Regra especial `BLIZZARD_DRAIN`. */
  blizzard: boolean;
}

/** Fração do total consumida por segundo. */
export function drainPerSecond(ctx: DrainContext): number {
  const fSpeed = 1 + 0.5 * ((ctx.speedMs - ctx.vCruiseMs) / ctx.vCruiseMs) ** 2;
  const fWind = 1 + 0.03 * Math.abs(ctx.windMs);
  const fClimb = ctx.climbing ? 1.3 : 1;
  const fWeather = ctx.blizzard ? 2 : 1;
  return (1 / (ctx.enduranceS * ctx.enduranceMod)) * fSpeed * fWind * fClimb * fWeather;
}

/** Hora de voltar: restante < max(20 %, 1,2 · tempo de volta · dreno de cruzeiro). */
export function rthRequired(
  remaining: number,
  distanceHomeM: number,
  vCruiseMs: number,
  drainAtCruise: number,
): boolean {
  const returnS = distanceHomeM / vCruiseMs + 15;
  return remaining < Math.max(0.2, 1.2 * returnS * drainAtCruise);
}
