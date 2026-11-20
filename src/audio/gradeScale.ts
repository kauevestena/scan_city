/**
 * O som da execução do voo (audio §4, survey-flight §5.21): cada amostra Perfeita seguida
 * sobe um grau da escala pentatônica maior, a Boa repete o grau e a Fraca ou a Rejeitada
 * quebra a sequência com um som surdo e volta ao início. Puro: a tela guarda o grau.
 */
import type { ShotGrade } from '@/types';
import type { SfxId } from './sfx';

/** Graus da pentatônica maior em semitons, até a oitava. */
export const PENTATONIC = [0, 2, 4, 7, 9, 12] as const;

export interface GradeTone {
  sfx: SfxId;
  pitch: number;
  /** O grau (índice em `PENTATONIC`) depois desta amostra. */
  degree: number;
}

/**
 * O som de uma amostra. `degree` é o grau atual; `-1` antes da primeira Perfeita.
 */
export function gradeTone(degree: number, grade: ShotGrade): GradeTone {
  if (grade === 'WEAK' || grade === 'REJECTED') return { sfx: 'GRADE_MISS', pitch: 1, degree: -1 };
  const next =
    grade === 'PERFECT' ? Math.min(PENTATONIC.length - 1, degree + 1) : Math.max(0, degree);
  return { sfx: 'GRADE', pitch: 2 ** ((PENTATONIC[next] as number) / 12), degree: next };
}
