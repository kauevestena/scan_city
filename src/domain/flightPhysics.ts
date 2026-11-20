/**
 * Dinâmica de voo — domain-math §5. Puro: sem render e sem acesso ao terreno
 * (o engine injeta a elevação sob a aeronave e à frente dela).
 *
 * Frame do *run*: `s` ao longo da linha (m), `x` desvio transversal (m), `alt` altitude (m).
 */
import { clamp, lerp } from '@/lib/math';
import type { Aircraft, Contract, LightingId, SpecialZone } from '@/types';
import { LIGHTING } from './photogrammetry';

const DEG = Math.PI / 180;
/** Altura mínima acima do solo que o piloto consegue comandar. */
export const MIN_AGL_M = 2;
/** Ângulo máximo de proa da asa fixa em relação à linha (desvio lateral). */
export const FIXED_WING_MAX_HEADING_RAD = 30 * DEG;
/** Ganho (1/s) com que a altitude persegue o alvo do Terrain Following. */
const TF_GAIN = 2;
/** A aeronave nunca anda para trás na linha, por mais forte que seja o vento de proa. */
export const MIN_GROUND_SPEED_MS = 0.5;

export interface AircraftState {
  s: number;
  x: number;
  alt: number;
  /** Velocidade no solo comandada ao longo da linha (sem a rajada). */
  v: number;
  /** Velocidade no solo de fato neste passo (`v` mais a parte de proa ou de cauda da rajada). */
  gs: number;
  /** Velocidade lateral comandada (sem a rajada). */
  vLat: number;
  /** Empurrão lateral da rajada neste passo. */
  drift: number;
  vz: number;
  /** AGL-alvo do Terrain Following. */
  aglTargetM: number;
  climbing: boolean;
}

export interface FlightInput {
  moveX: number;
  moveY: number;
  altUp: number;
  altDown: number;
}

export interface FlightEnv {
  aircraft: Aircraft;
  planSpeedMs: number;
  ceilingM: number;
  /** Elevação do terreno sob a aeronave. */
  elevationM: number;
  /**
   * Empurrões do vento na aeronave (m/s), já com o `driftFactor`, o modificador de deriva e o
   * fator de `STRONG_WIND`: o vento médio ao longo da linha (positivo de cauda) e as duas
   * componentes da rajada em curso (domain-math §5.1).
   */
  meanAlongMs: number;
  gustAlongMs: number;
  gustLateralMs: number;
  thermalLiftMs: number;
  terrainFollowing: boolean;
  /** Elevação a `d` metros à frente, ao longo da linha (usada pelo TF). */
  elevationAhead?: (distanceAheadM: number) => number;
}

export function initialAircraftState(speedMs: number, altM: number): AircraftState {
  return {
    s: 0,
    x: 0,
    alt: altM,
    v: speedMs,
    gs: speedMs,
    vLat: 0,
    drift: 0,
    vz: 0,
    aglTargetM: altM,
    climbing: false,
  };
}

/** Ângulo de deriva para manter a linha sob vento cruzado: asin(w/v). */
export function crabAngleRad(crossWindMs: number, airspeedMs: number): number {
  return Math.asin(clamp(crossWindMs / airspeedMs, -1, 1));
}

/**
 * Vento no instante t: média + rajada·(0,6·sin(2πt/7) + 0,4·n1(t/3)).
 * `noise` é um ruído 1D em [−1, 1].
 */
export function windAt(tS: number, wind: Contract['wind'], noise: (x: number) => number): number {
  return wind.meanMs + wind.gustMs * (0.6 * Math.sin((2 * Math.PI * tS) / 7) + 0.4 * noise(tS / 3));
}

/** Empurrão do vento na aeronave, em qualquer eixo: `w · driftFactor · modificador`. */
export function driftVelocityMs(windMs: number, driftFactor: number, windDriftMod: number): number {
  return windMs * driftFactor * windDriftMod;
}

/**
 * Limites da velocidade no solo comandada: os da velocidade no ar deslocados pelo vento
 * médio ao longo da linha. Com vento de proa forte, o teto cai abaixo da velocidade do plano.
 */
export function groundSpeedLimits(
  aircraft: Pick<Aircraft, 'vMinMs' | 'vMaxMs'>,
  meanAlongMs: number,
): { lo: number; hi: number } {
  const lo = Math.max(MIN_GROUND_SPEED_MS, aircraft.vMinMs + meanAlongMs);
  return { lo, hi: Math.max(lo, aircraft.vMaxMs + meanAlongMs) };
}

/** Sustentação das térmicas: Σ lift·(1 − d/r)·mod, metade sem sol a pino. */
export function thermalLiftMs(
  zones: readonly SpecialZone[],
  u: number,
  v: number,
  lighting: LightingId,
  thermalMod: number,
): number {
  let lift = 0;
  for (const zone of zones) {
    if (zone.kind !== 'THERMAL') continue;
    const d = Math.hypot(u - zone.u, v - zone.v);
    if (d < zone.radiusM) lift += zone.liftMs * (1 - d / zone.radiusM);
  }
  return lift * thermalMod * (lighting === 'SUN_HIGH' ? 1 : 0.5);
}

/** Comprimento da sombra de um objeto de altura h; 0 com luz difusa. */
export function shadowLengthM(objectHeightM: number, lighting: LightingId): number {
  const elevationDeg = LIGHTING[lighting].sunElevationDeg;
  return elevationDeg === null ? 0 : objectHeightM / Math.tan(elevationDeg * DEG);
}

/** Altitude-alvo do TF: maior elevação nos próximos 2 s de trajeto (a cada 5 m) + AGL-alvo. */
export function terrainFollowTargetAlt(
  elevationAlong: (distanceAheadM: number) => number,
  speedMs: number,
  aglTargetM: number,
): number {
  const horizon = 2 * Math.max(0, speedMs);
  let highest = elevationAlong(0);
  for (let d = 5; d <= horizon + 1e-9; d += 5) highest = Math.max(highest, elevationAlong(d));
  return highest + aglTargetM;
}

/** Avança a aeronave um passo de `dtS` segundos; todos os limites vêm de `Aircraft`. */
export function stepAircraft(
  state: AircraftState,
  input: FlightInput,
  env: FlightEnv,
  dtS: number,
): AircraftState {
  const a = env.aircraft;

  // Velocidade no solo comandada: −1 → mínima, 0 → a do plano, +1 → máxima. A aeronave
  // compensa o vento médio enquanto a velocidade no ar couber em [vMin, vMax].
  const moveY = clamp(input.moveY, -1, 1);
  const { lo, hi } = groundSpeedLimits(a, env.meanAlongMs);
  const cruise = clamp(env.planSpeedMs, lo, hi);
  const target = moveY >= 0 ? lerp(cruise, hi, moveY) : lerp(cruise, lo, -moveY);
  const maxDv = a.accelMs2 * dtS;
  const v = clamp(state.v + clamp(target - state.v, -maxDv, maxDv), lo, hi);
  // A parte de proa ou de cauda da rajada entra direto na velocidade no solo.
  const gs = Math.max(MIN_GROUND_SPEED_MS, v + env.gustAlongMs);

  // Lateral: multirrotor e ave respondem direto; a asa fixa curva com aLat ≤ v²/R.
  const moveX = clamp(input.moveX, -1, 1);
  let vLat: number;
  if (a.turnRadiusM > 0) {
    const targetLat = moveX * v * Math.sin(FIXED_WING_MAX_HEADING_RAD);
    const maxDLat = ((state.v * state.v) / a.turnRadiusM) * dtS;
    vLat = state.vLat + clamp(targetLat - state.vLat, -maxDLat, maxDLat);
  } else {
    vLat = moveX * a.lateralSpeedMaxMs;
  }
  // O vento médio transversal é compensado (o crab); só a rajada empurra de lado.
  const drift = env.gustLateralMs;

  // Vertical.
  const ceilingAgl = Math.min(a.hMaxM, env.ceilingM);
  const lift = clamp(input.altUp, 0, 1) - clamp(input.altDown, 0, 1);
  let aglTargetM = state.aglTargetM;
  let vz: number;
  if (env.terrainFollowing && env.elevationAhead) {
    aglTargetM = clamp(aglTargetM + lift * a.climbRateMs * dtS, a.hMinM, ceilingAgl);
    const targetAlt = terrainFollowTargetAlt(env.elevationAhead, gs, aglTargetM);
    vz =
      clamp((targetAlt - state.alt) * TF_GAIN, -a.climbRateMs, a.climbRateMs) + env.thermalLiftMs;
  } else {
    vz = lift * a.climbRateMs + env.thermalLiftMs;
  }

  let alt = state.alt + vz * dtS;
  const floor = env.elevationM + MIN_AGL_M;
  // O piso barra só a descida: se o relevo subir mais rápido que a aeronave, ela é alcançada.
  if (alt < floor && vz < 0) alt = Math.max(alt, Math.min(state.alt, floor));
  alt = Math.min(alt, env.elevationM + ceilingAgl);

  return {
    s: state.s + gs * dtS,
    x: state.x + (vLat + drift) * dtS,
    alt,
    v,
    gs,
    vLat,
    drift,
    vz,
    aglTargetM,
    climbing: vz > 0,
  };
}
