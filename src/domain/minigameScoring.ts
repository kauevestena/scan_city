/**
 * Pontuação dos mini-games de campo (field-setup §5.4). Funções puras: o engine só coleta as
 * amostras, e o score sai daqui.
 */

/** Raio do alvo central da bolha, px. */
export const BUBBLE_TARGET_R = 18;
/** Distância além do alvo em que o peso chega a 0, px. */
export const BUBBLE_FALLOFF_PX = 60;
/** Duração da janela de pontuação, s. */
export const BUBBLE_WINDOW_S = 8;
/** Tempo contínuo dentro do alvo que "trava o nível", s. */
export const BUBBLE_LOCK_S = 3;
/** Piso do score quando o nível trava antes do fim da janela. */
export const BUBBLE_LOCK_MIN_SCORE = 0.9;

/** Uma amostra: distância da bolha ao centro e o intervalo que ela representa. */
export interface BubbleSample {
  d: number;
  dtS: number;
}

/** w(d): 1 dentro do alvo, decai linearmente a 0 em `BUBBLE_FALLOFF_PX` além dele. */
export function bubbleWeight(d: number): number {
  if (d <= BUBBLE_TARGET_R) return 1;
  return Math.max(0, 1 - (d - BUBBLE_TARGET_R) / BUBBLE_FALLOFF_PX);
}

/**
 * Score da bolha em [0, 1]: (1/8)·∫w(d)dt sobre a janela de 8 s. Com amostras que cobrem
 * menos que a janela (o nível travou antes), extrapola a média e aplica o piso de 0,9.
 */
export function scoreBubble(samples: readonly BubbleSample[]): number {
  let elapsed = 0;
  let integral = 0;
  for (const s of samples) {
    elapsed += s.dtS;
    integral += bubbleWeight(s.d) * s.dtS;
  }
  if (elapsed <= 0) return 0;
  if (elapsed >= BUBBLE_WINDOW_S - 1e-6) return Math.min(1, integral / BUBBLE_WINDOW_S);
  return Math.min(1, Math.max(integral / elapsed, BUBBLE_LOCK_MIN_SCORE));
}
