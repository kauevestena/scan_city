/** Efeitos do voo (survey-flight §5.5, §5.11): shake, invulnerabilidade e animação de queda. */
import { clamp } from '@/lib/math';

export const SHAKE_S = 0.3;
export const SHAKE_AMPLITUDE_PX = 8;
export const INVULNERABLE_S = 1.5;
export const CRASH_S = 2;
/** A velocidade cai a 30 % no impacto. */
export const IMPACT_SPEED_FACTOR = 0.3;

/** Deslocamento da tela em `remainingS` de shake; zero com `reduceFlashes`. */
export function shakeOffset(
  remainingS: number,
  tS: number,
  reduceFlashes: boolean,
): { x: number; y: number } {
  if (reduceFlashes || remainingS <= 0) return { x: 0, y: 0 };
  const k = (remainingS / SHAKE_S) * SHAKE_AMPLITUDE_PX;
  return { x: Math.sin(tS * 90) * k, y: Math.cos(tS * 77) * k };
}

/**
 * Aparência durante a invulnerabilidade: pisca a 8 Hz; com `reduceFlashes`, fica
 * translúcida em vez de piscar.
 */
export function invulnerableAlpha(remainingS: number, reduceFlashes: boolean): number {
  if (remainingS <= 0) return 1;
  if (reduceFlashes) return 0.5;
  return Math.floor(remainingS * 8) % 2 === 0 ? 0.25 : 1;
}

export interface CrashPose {
  /** Giro (rad). */
  spin: number;
  /** Queda acumulada, 0–1 da altura inicial. */
  fall: number;
  /** Fumaça, 0–1. */
  smoke: number;
}

/** Pose da aeronave `tS` segundos depois da queda: gira e cai (aceleração), com fumaça. */
export function crashPose(tS: number): CrashPose {
  const k = clamp(tS / CRASH_S, 0, 1);
  return { spin: k * 6 * Math.PI, fall: k * k, smoke: clamp(k * 1.5, 0, 1) };
}
