/** Tempo da esteira (processing-results §5.1): pesos das etapas e a etapa corrente. */
import { STAGE_WEIGHTS } from '@/domain/processing';

/** Durações das etapas: os 6 pesos × T e, com equipe, a etapa 7 com 10 % de T. */
export function stageDurations(totalS: number, withStaff: boolean): number[] {
  const base = STAGE_WEIGHTS.map((w) => w * totalS);
  return withStaff ? [...base, 0.1 * totalS] : base;
}

export interface PipelineProgress {
  /** Etapa corrente (índice); igual a `durations.length` quando terminou. */
  stage: number;
  /** Progresso da etapa corrente, 0–1. */
  progress: number;
  done: boolean;
  remainingS: number;
}

export function pipelineAt(elapsedS: number, durations: readonly number[]): PipelineProgress {
  const total = durations.reduce((a, b) => a + b, 0);
  let t = Math.max(0, elapsedS);
  for (let k = 0; k < durations.length; k++) {
    const d = durations[k] as number;
    if (t < d)
      return { stage: k, progress: d > 0 ? t / d : 1, done: false, remainingS: total - elapsedS };
    t -= d;
  }
  return { stage: durations.length, progress: 1, done: true, remainingS: 0 };
}
