/**
 * Nota de execução do voo — domain-math §10.3 (ADR-029). Puro.
 *
 * Cada amostra (foto automática ou portal cruzado com o LiDAR) recebe a pior nota de três
 * eixos: faixa, altura e avanço. As notas somam na passada; a melhor passada de cada linha
 * planejada dá a execução `E` da missão.
 */
import type { GradeCounts, LinePass, ShotGrade } from '@/types';

/** Da melhor para a pior. */
export const GRADES: readonly ShotGrade[] = ['PERFECT', 'GOOD', 'WEAK', 'REJECTED'];

/** Quanto cada nota vale na nota da passada. */
export const GRADE_WEIGHT: Record<ShotGrade, number> = {
  PERFECT: 1,
  GOOD: 0.8,
  WEAK: 0.4,
  REJECTED: 0,
};

/** Quanto os dados de uma amostra pesam (cobertura das fotos e pulsos LiDAR). */
export const DATA_WEIGHT: Record<ShotGrade, number> = {
  PERFECT: 1,
  GOOD: 1,
  WEAK: 0.5,
  REJECTED: 0,
};

export type GradeLimits = readonly [perfect: number, good: number, weak: number];

/** Faixa: `|x| / S`. */
export const LATERAL_LIMITS: GradeLimits = [0.05, 0.1, 0.25];
/** Altura: `|alt − corridorAlt| / H`. */
export const VERTICAL_LIMITS: GradeLimits = [0.05, 0.1, 0.2];
/** Avanço: `d / B` (ou `gs / v_plano`). */
export const ADVANCE_LIMITS: GradeLimits = [1.05, 1.15, 1.3];

/** Nota mínima da passada para a linha ser aceita. */
export const LINE_ACCEPT_SCORE = 0.5;
/** Uma passada com pelo menos esta fração das amostras planejadas não perde nota por falta. */
export const SAMPLE_TOLERANCE = 0.9;

export type GradeAxis = 'lateral' | 'vertical' | 'advance';

export function gradeAxis(value: number, limits: GradeLimits): ShotGrade {
  if (value <= limits[0]) return 'PERFECT';
  if (value <= limits[1]) return 'GOOD';
  if (value <= limits[2]) return 'WEAK';
  return 'REJECTED';
}

export function worstGrade(...grades: ShotGrade[]): ShotGrade {
  let worst = 0;
  for (const g of grades) worst = Math.max(worst, GRADES.indexOf(g));
  return GRADES[worst] as ShotGrade;
}

export interface SampleInput {
  crossTrackM: number;
  spacingM: number;
  altM: number;
  corridorAltM: number;
  /** Altura de voo do plano (AGL). */
  heightM: number;
  /** `d / B` até a foto anterior, ou `gs / v_plano`. */
  advanceRatio: number;
  /** Foto com arrasto acima de 1 px: rejeitada. */
  blurred?: boolean;
  /** Foto manual: o enquadramento lateral é livre. */
  lateralFree?: boolean;
}

export interface SampleGrade {
  grade: ShotGrade;
  lateral: ShotGrade;
  vertical: ShotGrade;
  advance: ShotGrade;
  /** O eixo que derrubou a nota (o primeiro entre os piores); `null` na Perfeita. */
  axis: GradeAxis | null;
}

/** Nota da amostra: a pior dos três eixos; foto borrada é rejeitada. */
export function gradeSample(i: SampleInput): SampleGrade {
  const lateral = i.lateralFree
    ? 'PERFECT'
    : gradeAxis(Math.abs(i.crossTrackM) / Math.max(1e-9, i.spacingM), LATERAL_LIMITS);
  const vertical = gradeAxis(
    Math.abs(i.altM - i.corridorAltM) / Math.max(1e-9, i.heightM),
    VERTICAL_LIMITS,
  );
  const advance = gradeAxis(i.advanceRatio, ADVANCE_LIMITS);
  const worst = worstGrade(lateral, vertical, advance);
  const grade = i.blurred ? 'REJECTED' : worst;
  let axis: GradeAxis | null = null;
  if (worst !== 'PERFECT') {
    axis = lateral === worst ? 'lateral' : vertical === worst ? 'vertical' : 'advance';
  }
  return { grade, lateral, vertical, advance, axis };
}

export function emptyCounts(): GradeCounts {
  return [0, 0, 0, 0];
}

export function addGrade(counts: GradeCounts, grade: ShotGrade): GradeCounts {
  const next: GradeCounts = [...counts];
  const i = GRADES.indexOf(grade);
  next[i] = (next[i] as number) + 1;
  return next;
}

export function countSamples(counts: GradeCounts): number {
  return counts[0] + counts[1] + counts[2] + counts[3];
}

/** Nota da passada: média dos pesos das amostras; 0 sem amostras. */
export function passScore(counts: GradeCounts): number {
  const n = countSamples(counts);
  if (n === 0) return 0;
  return (
    (counts[0] * GRADE_WEIGHT.PERFECT +
      counts[1] * GRADE_WEIGHT.GOOD +
      counts[2] * GRADE_WEIGHT.WEAK) /
    n
  );
}

/**
 * Quanto a passada vale para a linha: a nota vezes a fração de amostras feitas. Até 10 % de
 * amostras a menos que o planejado não tiram nada; daí para baixo a nota cai em proporção.
 */
export function passValue(pass: Pick<LinePass, 'counts'>, planned: number): number {
  const n = countSamples(pass.counts);
  const fraction = planned > 0 ? Math.min(1, n / (SAMPLE_TOLERANCE * planned)) : n > 0 ? 1 : 0;
  return passScore(pass.counts) * fraction;
}

/** A passada é aceita se chegou ao fim da linha e vale pelo menos 0,5. */
export function passAccepted(
  pass: Pick<LinePass, 'counts' | 'complete'>,
  planned: number,
): boolean {
  return pass.complete && passValue(pass, planned) >= LINE_ACCEPT_SCORE;
}

export type GradeLetter = 'S' | 'A' | 'B' | 'C' | 'D';

export function gradeLetter(score: number): GradeLetter {
  if (score >= 0.95) return 'S';
  if (score >= 0.85) return 'A';
  if (score >= 0.7) return 'B';
  if (score >= 0.5) return 'C';
  return 'D';
}

export interface LineBest {
  lineIndex: number;
  /** `passValue` da melhor passada; 0 sem passada. */
  value: number;
  pass: LinePass | null;
}

/** A melhor passada de cada linha planejada (`planned[i]` = amostras planejadas da linha `i`). */
export function bestPasses(passes: readonly LinePass[], planned: readonly number[]): LineBest[] {
  return planned.map((n, lineIndex) => {
    let best: LineBest = { lineIndex, value: 0, pass: null };
    for (const pass of passes) {
      if (pass.lineIndex !== lineIndex) continue;
      const value = passValue(pass, n);
      if (best.pass === null || value > best.value) best = { lineIndex, value, pass };
    }
    return best;
  });
}

/**
 * Execução `E` da missão, 0 a 1: a melhor passada de cada linha planejada, ponderada pelas
 * amostras planejadas. Linha sem passada vale 0. Missão sem dado de execução (`undefined`:
 * save antigo ou missão sintética) vale 1.
 */
export function missionExecution(
  passes: readonly LinePass[] | undefined,
  planned: readonly number[],
): number {
  if (passes === undefined) return 1;
  const total = planned.reduce((sum, n) => sum + n, 0);
  if (total <= 0) return 1;
  const best = bestPasses(passes, planned);
  return best.reduce((sum, b, i) => sum + b.value * (planned[i] as number), 0) / total;
}

/** Contagem por nota das melhores passadas (para o relatório). */
export function bestCounts(passes: readonly LinePass[], planned: readonly number[]): GradeCounts {
  const total = emptyCounts();
  for (const b of bestPasses(passes, planned)) {
    if (!b.pass) continue;
    for (let i = 0; i < 4; i++) total[i] = (total[i] as number) + (b.pass.counts[i] as number);
  }
  return total;
}

/** A nota da missão é a nota técnica vezes `0,4 + 0,6·E` (domain-math §10.1). */
export function executionFactor(execution: number): number {
  return 0.4 + 0.6 * execution;
}

/** Multiplicador `execution` do RMSE: `1 + 0,5·(1 − E)` (domain-math §6.3). */
export function executionMultiplier(execution: number): number {
  return 1 + 0.5 * (1 - execution);
}

/** Bônus de pilotagem em `Q`: +0,10 com E ≥ 0,90; +0,05 com E ≥ 0,80 (domain-math §12.1). */
export function pilotBonus(execution: number): number {
  if (execution >= 0.9) return 0.1;
  if (execution >= 0.8) return 0.05;
  return 0;
}
