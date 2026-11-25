/**
 * Autopilot de depuração (survey-flight §5.16): mantém X = 0, a velocidade no solo do plano
 * e a altitude do corredor (sobe se houver objeto alto à frente). É o piloto "bom" das metas
 * de desafio (REQ-NFR-010): como um jogador atento à biruta e ao aviso, compensa o empurrão
 * que vê e antecipa a rajada que vem.
 */
import type { FlightInput } from '@/domain/flightPhysics';
import { clamp } from '@/lib/math';

export interface AutopilotState {
  x: number;
  /** Velocidade lateral comandada agora. */
  vLat: number;
  /** Empurrão lateral da rajada agora. */
  driftMs: number;
  alt: number;
  targetAlt: number;
  /**
   * Velocidade lateral que o comando máximo pede: a do multirrotor e da ave, ou, na asa fixa,
   * a componente lateral da proa máxima (`v·sen 30°`).
   */
  lateralMaxMs: number;
  /** Objeto à frente mais alto que `alt − 5`? */
  obstacleAhead: boolean;
  /** Velocidade no solo de fato e a do plano. */
  groundSpeedMs: number;
  planSpeedMs: number;
  /**
   * Quanto o empurrão da rajada vai mudar até daqui a pouco (lateral e ao longo da linha):
   * o autopilot já corrige o que vem. Padrão: 0.
   */
  lateralPushChangeMs?: number;
  alongPushChangeMs?: number;
}

/** Ganhos: faixa (1/s), altura (por m) e velocidade no solo (por m/s). */
export const AUTOPILOT_GAINS = { kp: 1.5, kAlt: 0.5, kSpeed: 0.5 } as const;
/** O alvo de altitude do autopilot é a do corredor este tempo à frente. */
export const AUTOPILOT_LOOKAHEAD_S = 0.5;
/** Antecipação da rajada: o autopilot olha o empurrão este tempo à frente. */
export const AUTOPILOT_GUST_LEAD_S = 0.4;

/**
 * Contragolpe do autopilot (survey-flight §5.13): até este instante (s de simulação, em relação
 * ao início da rajada) ele segura o comando contra ela abaixo do limiar; daí até
 * `AUTOPILOT_COUNTER_UNTIL_S`, comando cheio contra ela. O começo cai no meio da janela.
 */
export const AUTOPILOT_COUNTER_AT_S = -0.1;
export const AUTOPILOT_COUNTER_UNTIL_S = 0.1;

/**
 * O contragolpe do piloto bom: com a rajada `deltaS` segundos da chegada (negativo: ainda vem),
 * segura o comando contra ela abaixo de `threshold` até `AUTOPILOT_COUNTER_AT_S` e depois o
 * dá inteiro por um instante. `against` é o sinal do comando que vai contra a rajada.
 */
export function autopilotCounter(
  input: FlightInput,
  deltaS: number,
  against: -1 | 1,
  warnS: number,
  threshold: number,
): FlightInput {
  if (deltaS < -warnS || deltaS >= AUTOPILOT_COUNTER_UNTIL_S) return input;
  if (deltaS < AUTOPILOT_COUNTER_AT_S) {
    const limit = 0.8 * threshold;
    const moveX = against > 0 ? Math.min(input.moveX, limit) : Math.max(input.moveX, -limit);
    return { ...input, moveX };
  }
  return { ...input, moveX: against };
}

/** O arrasto que o autopilot aceita no plano antes de frear: folga para a rajada de cauda. */
export const AUTOPILOT_MAX_BLUR_PX = 0.75;

/**
 * Velocidade no solo que o autopilot persegue: a do plano, ou menos quando o plano já voa
 * perto de 1 px de arrasto (pouca luz): a rajada de cauda borraria a foto. Freia na proporção
 * para deixar o arrasto em 0,75 px. Com o LiDAR não há foto a borrar.
 */
export function autopilotSpeedMs(
  planSpeedMs: number,
  planBlurPx: number,
  sensor: 'RGB' | 'LIDAR',
): number {
  if (sensor === 'LIDAR' || planBlurPx <= AUTOPILOT_MAX_BLUR_PX) return planSpeedMs;
  return planSpeedMs * (AUTOPILOT_MAX_BLUR_PX / planBlurPx);
}

export function autopilotInput(st: AutopilotState): FlightInput {
  const { kp, kAlt, kSpeed } = AUTOPILOT_GAINS;
  // Velocidade lateral desejada: anula o empurrão (o de agora e o que vem) e volta ao eixo.
  const push = st.driftMs + (st.lateralPushChangeMs ?? 0);
  const wanted = -push - kp * st.x;
  const climb = st.obstacleAhead ? 1 : (st.targetAlt - st.alt) * kAlt;
  const groundSpeed = st.groundSpeedMs + (st.alongPushChangeMs ?? 0);
  return {
    moveX: clamp(wanted / Math.max(0.1, st.lateralMaxMs), -1, 1),
    // Compensa a parte de proa ou de cauda da rajada.
    moveY: clamp((st.planSpeedMs - groundSpeed) * kSpeed, -1, 1),
    altUp: clamp(climb, 0, 1),
    altDown: clamp(-climb, 0, 1),
  };
}
