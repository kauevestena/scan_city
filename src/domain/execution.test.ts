import type { GradeCounts, LinePass } from '@/types';
import {
  ADVANCE_LIMITS,
  DATA_WEIGHT,
  GRADE_WEIGHT,
  LATERAL_LIMITS,
  VERTICAL_LIMITS,
  addGrade,
  bestCounts,
  bestPasses,
  countSamples,
  emptyCounts,
  executionFactor,
  executionMultiplier,
  gradeAxis,
  gradeLetter,
  gradeSample,
  missionExecution,
  passAccepted,
  passScore,
  passValue,
  pilotBonus,
  worstGrade,
  type SampleInput,
} from './execution';

const OK: SampleInput = {
  crossTrackM: 0,
  spacingM: 30,
  altM: 160,
  corridorAltM: 160,
  heightM: 60,
  advanceRatio: 1,
};

const pass = (lineIndex: number, counts: GradeCounts, over: Partial<LinePass> = {}): LinePass => ({
  lineIndex,
  pass: 0,
  sortie: 0,
  counts,
  complete: true,
  ...over,
});

describe('golden values', () => {
  it('G26 — faixa com S = 30 m: 1,4 / 2,9 / 7,4 / 7,6 m → Perfeita / Boa / Fraca / Rejeitada', () => {
    expect(gradeSample({ ...OK, crossTrackM: 1.4 }).grade).toBe('PERFECT');
    expect(gradeSample({ ...OK, crossTrackM: -2.9 }).grade).toBe('GOOD');
    expect(gradeSample({ ...OK, crossTrackM: 7.4 }).grade).toBe('WEAK');
    expect(gradeSample({ ...OK, crossTrackM: -7.6 }).grade).toBe('REJECTED');
  });

  it('G27 — contagem [10, 5, 3, 2]: nota 0,76, letra B', () => {
    expect(passScore([10, 5, 3, 2])).toBeCloseTo(0.76, 12);
    expect(gradeLetter(passScore([10, 5, 3, 2]))).toBe('B');
  });

  it('G28 — 2 linhas de 16 amostras, uma com passada de 0,9 e a outra sem passada: E = 0,45', () => {
    // 8 perfeitas e 8 boas: (8 + 6,4) / 16 = 0,9.
    expect(missionExecution([pass(0, [8, 8, 0, 0])], [16, 16])).toBeCloseTo(0.45, 12);
  });

  it('G31 — nota com execução: base 0,9 com E = 1 e E = 0,65 → 0,900 e 0,711', () => {
    expect(0.9 * executionFactor(1)).toBeCloseTo(0.9, 12);
    expect(0.9 * executionFactor(0.65)).toBeCloseTo(0.711, 12);
  });
});

describe('gradeAxis e os limites de cada eixo', () => {
  it('o limite pertence à nota melhor', () => {
    expect(gradeAxis(0.05, LATERAL_LIMITS)).toBe('PERFECT');
    expect(gradeAxis(0.0501, LATERAL_LIMITS)).toBe('GOOD');
    expect(gradeAxis(0.1, LATERAL_LIMITS)).toBe('GOOD');
    expect(gradeAxis(0.25, LATERAL_LIMITS)).toBe('WEAK');
    expect(gradeAxis(0.2501, LATERAL_LIMITS)).toBe('REJECTED');
    expect(LATERAL_LIMITS).toEqual([0.05, 0.1, 0.25]);
    expect(VERTICAL_LIMITS).toEqual([0.05, 0.1, 0.2]);
    expect(ADVANCE_LIMITS).toEqual([1.05, 1.15, 1.3]);
  });

  it('altura: desvio da altitude do corredor sobre H (5 %, 10 %, 20 %)', () => {
    expect(gradeSample({ ...OK, altM: 163 }).vertical).toBe('PERFECT');
    expect(gradeSample({ ...OK, altM: 154.5 }).vertical).toBe('GOOD');
    expect(gradeSample({ ...OK, altM: 171 }).vertical).toBe('WEAK');
    expect(gradeSample({ ...OK, altM: 147 }).vertical).toBe('REJECTED');
  });

  it('avanço: só o excesso conta (devagar demais não tira nota)', () => {
    expect(gradeSample({ ...OK, advanceRatio: 0.4 }).advance).toBe('PERFECT');
    expect(gradeSample({ ...OK, advanceRatio: 1.05 }).advance).toBe('PERFECT');
    expect(gradeSample({ ...OK, advanceRatio: 1.1 }).advance).toBe('GOOD');
    expect(gradeSample({ ...OK, advanceRatio: 1.25 }).advance).toBe('WEAK');
    expect(gradeSample({ ...OK, advanceRatio: 1.31 }).advance).toBe('REJECTED');
  });
});

describe('gradeSample', () => {
  it('a nota é a pior dos três eixos, e o eixo que a derrubou vem junto', () => {
    expect(gradeSample(OK)).toEqual({
      grade: 'PERFECT',
      lateral: 'PERFECT',
      vertical: 'PERFECT',
      advance: 'PERFECT',
      axis: null,
    });
    const mixed = gradeSample({ ...OK, crossTrackM: 2.9, altM: 171, advanceRatio: 1.1 });
    expect(mixed).toMatchObject({
      grade: 'WEAK',
      lateral: 'GOOD',
      vertical: 'WEAK',
      axis: 'vertical',
    });
    expect(gradeSample({ ...OK, advanceRatio: 2 })).toMatchObject({
      grade: 'REJECTED',
      axis: 'advance',
    });
    // Empate: o primeiro na ordem faixa, altura, avanço.
    expect(gradeSample({ ...OK, crossTrackM: 2.9, altM: 165 }).axis).toBe('lateral');
  });

  it('foto borrada é rejeitada, mesmo no centro do corredor', () => {
    expect(gradeSample({ ...OK, blurred: true })).toMatchObject({ grade: 'REJECTED', axis: null });
  });

  it('foto manual: o enquadramento lateral é livre, a altura e o avanço não', () => {
    expect(gradeSample({ ...OK, crossTrackM: 500, lateralFree: true }).grade).toBe('PERFECT');
    expect(gradeSample({ ...OK, crossTrackM: 500, altM: 190, lateralFree: true }).grade).toBe(
      'REJECTED',
    );
  });

  it('worstGrade', () => {
    expect(worstGrade('PERFECT', 'GOOD')).toBe('GOOD');
    expect(worstGrade('WEAK', 'REJECTED', 'PERFECT')).toBe('REJECTED');
    expect(worstGrade()).toBe('PERFECT');
  });

  it('pesos: 1 / 0,8 / 0,4 / 0 na nota e 1 / 1 / 0,5 / 0 nos dados', () => {
    expect(GRADE_WEIGHT).toEqual({ PERFECT: 1, GOOD: 0.8, WEAK: 0.4, REJECTED: 0 });
    expect(DATA_WEIGHT).toEqual({ PERFECT: 1, GOOD: 1, WEAK: 0.5, REJECTED: 0 });
  });
});

describe('passada', () => {
  it('contagem', () => {
    let c = emptyCounts();
    c = addGrade(c, 'PERFECT');
    c = addGrade(c, 'PERFECT');
    c = addGrade(c, 'WEAK');
    c = addGrade(c, 'REJECTED');
    expect(c).toEqual([2, 0, 1, 1]);
    expect(countSamples(c)).toBe(4);
    expect(passScore(emptyCounts())).toBe(0);
    expect(passScore([4, 0, 0, 0])).toBe(1);
    expect(passScore([0, 0, 0, 7])).toBe(0);
  });

  it('letras: S ≥ 0,95, A ≥ 0,85, B ≥ 0,70, C ≥ 0,50, D abaixo', () => {
    expect([1, 0.95, 0.94, 0.85, 0.84, 0.7, 0.69, 0.5, 0.49, 0].map(gradeLetter)).toEqual([
      'S',
      'S',
      'A',
      'A',
      'B',
      'B',
      'C',
      'C',
      'D',
      'D',
    ]);
  });

  it('passValue: até 10 % de amostras a menos não tiram nada; daí para baixo cai em proporção', () => {
    expect(passValue(pass(0, [15, 0, 0, 0]), 15)).toBe(1);
    expect(passValue(pass(0, [14, 0, 0, 0]), 15)).toBe(1);
    expect(passValue(pass(0, [9, 0, 0, 0]), 15)).toBeCloseTo(9 / 13.5, 12);
    expect(passValue(pass(0, [20, 0, 0, 0]), 15)).toBe(1);
    expect(passValue(pass(0, emptyCounts()), 15)).toBe(0);
    // Linha sem amostra planejada: vale a nota das que houver.
    expect(passValue(pass(0, [0, 2, 0, 0]), 0)).toBeCloseTo(0.8, 12);
    expect(passValue(pass(0, emptyCounts()), 0)).toBe(0);
  });

  it('aceita: completa e valendo pelo menos 0,5', () => {
    expect(passAccepted(pass(0, [0, 0, 15, 0]), 15)).toBe(false);
    expect(passAccepted(pass(0, [3, 0, 12, 0]), 15)).toBe(true);
    expect(passAccepted(pass(0, [15, 0, 0, 0], { complete: false }), 15)).toBe(false);
    // Poucas amostras, mesmo perfeitas, não aceitam a linha (sensor desligado no meio).
    expect(passAccepted(pass(0, [2, 0, 0, 0]), 15)).toBe(false);
  });
});

describe('execução da missão', () => {
  it('sem dado de execução vale 1; com dado e sem passada vale 0', () => {
    expect(missionExecution(undefined, [16, 16])).toBe(1);
    expect(missionExecution([], [16, 16])).toBe(0);
    expect(missionExecution([], [])).toBe(1);
    expect(missionExecution([pass(0, [16, 0, 0, 0])], [0])).toBe(1);
  });

  it('usa a melhor passada de cada linha, ponderada pelas amostras planejadas', () => {
    const passes = [
      pass(0, [0, 0, 10, 0]),
      pass(0, [10, 0, 0, 0], { pass: 1 }),
      pass(1, [0, 30, 0, 0]),
    ];
    // Linha 0: melhor = 1 (peso 10); linha 1: 0,8 (peso 30).
    expect(missionExecution(passes, [10, 30])).toBeCloseTo((1 * 10 + 0.8 * 30) / 40, 12);
    const best = bestPasses(passes, [10, 30]);
    expect(best[0]?.pass?.pass).toBe(1);
    expect(best[1]?.value).toBeCloseTo(0.8, 12);
    expect(bestCounts(passes, [10, 30])).toEqual([10, 30, 0, 0]);
  });

  it('passada incompleta vale em proporção às amostras feitas', () => {
    const half = pass(0, [8, 0, 0, 0], { complete: false });
    expect(missionExecution([half], [16])).toBeCloseTo(8 / 14.4, 12);
    expect(bestPasses([], [16])[0]).toEqual({ lineIndex: 0, value: 0, pass: null });
    expect(bestCounts([], [16])).toEqual([0, 0, 0, 0]);
  });
});

describe('efeitos da execução na avaliação', () => {
  it('fator da nota: 0,4 + 0,6·E', () => {
    expect(executionFactor(0)).toBe(0.4);
    expect(executionFactor(0.5)).toBe(0.7);
    expect(executionFactor(1)).toBe(1);
  });

  it('multiplicador do RMSE: 1 + 0,5·max(0, 0,9 − E)', () => {
    expect(executionMultiplier(1)).toBe(1);
    expect(executionMultiplier(0.9)).toBe(1);
    expect(executionMultiplier(0.65)).toBeCloseTo(1.125, 12);
    expect(executionMultiplier(0)).toBeCloseTo(1.45, 12);
  });

  it('bônus de pilotagem: +0,10 com E ≥ 0,90; +0,05 com E ≥ 0,80', () => {
    expect(pilotBonus(1)).toBe(0.1);
    expect(pilotBonus(0.9)).toBe(0.1);
    expect(pilotBonus(0.89)).toBe(0.05);
    expect(pilotBonus(0.8)).toBe(0.05);
    expect(pilotBonus(0.79)).toBe(0);
  });
});
