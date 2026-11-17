/**
 * Autopilot de depuração (survey-flight §5.16): controlador PD que mantém X = 0, a
 * velocidade no solo do plano e a altitude do corredor (sobe se houver objeto alto à
 * frente). É o piloto "bom" das metas de desafio (REQ-NFR-010).
 */
import type { FlightInput } from '@/domain/flightPhysics';
import { clamp } from '@/lib/math';

export interface AutopilotState {
  x: number;
  /** Velocidade lateral efetiva (comando + empurrão da rajada). */
  vx: number;
  alt: number;
  targetAlt: number;
  lateralMaxMs: number;
  /** Objeto à frente mais alto que `alt − 5`? */
  obstacleAhead: boolean;
  /** Velocidade no solo de fato e a do plano. */
  groundSpeedMs: number;
  planSpeedMs: number;
}

export const AUTOPILOT_GAINS = { kp: 0.8, kd: 0.6, kAlt: 0.5, kSpeed: 0.5 } as const;
/** O alvo de altitude do autopilot é a do corredor este tempo à frente. */
export const AUTOPILOT_LOOKAHEAD_S = 0.5;

export function autopilotInput(st: AutopilotState): FlightInput {
  const { kp, kd, kAlt, kSpeed } = AUTOPILOT_GAINS;
  const lateral = -(kp * st.x + kd * st.vx) / Math.max(0.1, st.lateralMaxMs);
  const climb = st.obstacleAhead ? 1 : (st.targetAlt - st.alt) * kAlt;
  return {
    moveX: clamp(lateral, -1, 1),
    // Compensa a parte de proa ou de cauda da rajada.
    moveY: clamp((st.planSpeedMs - st.groundSpeedMs) * kSpeed, -1, 1),
    altUp: clamp(climb, 0, 1),
    altDown: clamp(-climb, 0, 1),
  };
}
