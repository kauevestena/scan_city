import { processingBaseTimeS, processingTimeS } from '@/domain/processing';
import { pipelineAt, stageDurations } from './pipelineModel';

describe('esteira: tempo e etapas', () => {
  it('C00 de referência no notebook: 6 + 0,08 · 96 = 13,68 s, dividido pelos pesos', () => {
    const T = processingTimeS(processingBaseTimeS(96, 0), 1);
    expect(T).toBeCloseTo(13.68, 9);
    const d = stageDurations(T, false);
    expect(d).toHaveLength(6);
    expect(d.reduce((a, b) => a + b, 0)).toBeCloseTo(T, 9);
    expect(d[3]).toBeCloseTo(0.25 * T, 9);
    // Com equipe: etapa 7 de vetorização com 10 % de T a mais.
    const staff = stageDurations(T, true);
    expect(staff).toHaveLength(7);
    expect(staff[6]).toBeCloseTo(1.368, 9);
  });

  it('etapa corrente, progresso e tempo restante', () => {
    const d = stageDurations(10, false);
    expect(pipelineAt(0, d)).toEqual({ stage: 0, progress: 0, done: false, remainingS: 10 });
    const mid = pipelineAt(2.25, d);
    expect(mid.stage).toBe(1);
    expect(mid.progress).toBeCloseTo(0.375, 9);
    expect(mid.remainingS).toBeCloseTo(7.75, 9);
    expect(pipelineAt(10, d)).toEqual({ stage: 6, progress: 1, done: true, remainingS: 0 });
    expect(pipelineAt(-1, d).stage).toBe(0);
    expect(pipelineAt(0, [0, 1]).stage).toBe(1);
  });
});
