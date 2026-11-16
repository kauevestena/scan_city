/**
 * Interpolação dos diagramas do Laboratório (infographic-lab §5.2): o valor desenhado persegue o
 * alvo em ~150 ms, para o prédio "crescer" e os raios se reajustarem sem salto.
 */
export const TWEEN_S = 0.15;

/**
 * Aproxima `current` de `target` de forma exponencial. A constante de tempo é `durationS / 3`:
 * em `durationS` o valor percorre ~95 % do caminho, e o resultado não depende de como o tempo foi
 * fatiado em quadros.
 */
export function approach(
  current: number,
  target: number,
  dtS: number,
  durationS: number = TWEEN_S,
): number {
  if (!(dtS > 0)) return current;
  const next = current + (target - current) * (1 - Math.exp((-3 * dtS) / durationS));
  // Chegou: para de calcular resíduos ínfimos.
  return Math.abs(target - next) < 1e-9 * Math.max(1, Math.abs(target)) ? target : next;
}
