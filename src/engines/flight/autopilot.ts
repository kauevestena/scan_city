/**
 * Autopilot de depuração (survey-flight §5.16): controlador PD que mantém X = 0, a
 * velocidade do plano e a altitude do plano (sobe se houver objeto alto à frente).
 */
import type { FlightInput } from '@/domain/flightPhysics';
import { clamp } from '@/lib/math';

export interface AutopilotState {
  x: number;
  /** Velocidade lateral efetiva (comando + deriva). */
  vx: number;
  alt: number;
  targetAlt: number;
  lateralMaxMs: number;
  /** Objeto à frente mais alto que `alt − 5`? */
  obstacleAhead: boolean;
}

export const AUTOPILOT_GAINS = { kp: 0.8, kd: 0.6, kAlt: 0.5 } as const;

export function autopilotInput(st: AutopilotState): FlightInput {
  const { kp, kd, kAlt } = AUTOPILOT_GAINS;
  const lateral = -(kp * st.x + kd * st.vx) / Math.max(0.1, st.lateralMaxMs);
  const climb = st.obstacleAhead ? 1 : (st.targetAlt - st.alt) * kAlt;
  return {
    moveX: clamp(lateral, -1, 1),
    moveY: 0,
    altUp: clamp(climb, 0, 1),
    altDown: clamp(-climb, 0, 1),
  };
}
