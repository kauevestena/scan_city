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

/** Uma etapa da esteira: de qual trilha (SfM, LiDAR ou a vetorização da equipe) e qual índice. */
export interface PlannedStage {
  track: 'SFM' | 'LIDAR' | 'STAFF';
  /** Índice na trilha (0–5; a vetorização é a 7ª, índice 6 da SfM). */
  index: number;
  durationS: number;
}

/**
 * Etapas da esteira (§5.1, §5.3): a SfM, a LiDAR ou as duas em sequência, com o tempo dividido
 * por `shares` e, em cada uma, pelos pesos das etapas. Com equipe, a vetorização soma 10 % de T.
 */
export function planStages(
  totalS: number,
  shares: { sfm: number; lidar: number },
  withStaff: boolean,
): PlannedStage[] {
  const stages: PlannedStage[] = [];
  for (const [track, share] of [
    ['SFM', shares.sfm],
    ['LIDAR', shares.lidar],
  ] as const) {
    if (share <= 0) continue;
    STAGE_WEIGHTS.forEach((w, index) =>
      stages.push({ track, index, durationS: w * totalS * share }),
    );
  }
  if (withStaff) stages.push({ track: 'STAFF', index: 6, durationS: 0.1 * totalS });
  return stages;
}
