import { processingBaseTimeS, processingTimeS } from '@/domain/processing';
import { pipelineAt, planStages, stageDurations } from './pipelineModel';

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

describe('planStages (§5.1, §5.3)', () => {
  const sum = (stages: Array<{ durationS: number }>) => stages.reduce((a, b) => a + b.durationS, 0);

  it('só SfM: as mesmas durações de stageDurations', () => {
    const plan = planStages(10, { sfm: 1, lidar: 0 }, false);
    expect(plan.map((s) => s.durationS)).toEqual(stageDurations(10, false));
    expect(plan.every((s) => s.track === 'SFM')).toBe(true);
    expect(plan.map((s) => s.index)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('só LiDAR: 6 etapas da trilha LiDAR com os mesmos pesos', () => {
    const plan = planStages(10, { sfm: 0, lidar: 1 }, false);
    expect(plan).toHaveLength(6);
    expect(plan.every((s) => s.track === 'LIDAR')).toBe(true);
    expect(plan.map((s) => s.durationS)).toEqual(stageDurations(10, false));
  });

  it('missão mista: as duas em sequência (SfM e depois LiDAR), T dividido pelos dados', () => {
    const plan = planStages(14, { sfm: 8 / 14, lidar: 6 / 14 }, false);
    expect(plan.map((s) => s.track)).toEqual([...Array(6).fill('SFM'), ...Array(6).fill('LIDAR')]);
    expect(sum(plan)).toBeCloseTo(14, 9);
    expect(sum(plan.filter((s) => s.track === 'SFM'))).toBeCloseTo(8, 9);
    expect(sum(plan.filter((s) => s.track === 'LIDAR'))).toBeCloseTo(6, 9);
    // Cada trilha respeita os pesos das 6 etapas.
    expect(plan[3]?.durationS).toBeCloseTo(0.25 * 8, 9);
    expect(plan[9]?.durationS).toBeCloseTo(0.25 * 6, 9);
  });

  it('com equipe, a vetorização soma 10 % de T no fim', () => {
    const plan = planStages(10, { sfm: 0.5, lidar: 0.5 }, true);
    expect(plan).toHaveLength(13);
    expect(plan[12]).toEqual({ track: 'STAFF', index: 6, durationS: 1 });
    expect(sum(plan)).toBeCloseTo(11, 9);
    // A esteira atravessa as duas trilhas na ordem.
    expect(
      pipelineAt(
        5.1,
        plan.map((s) => s.durationS),
      ).stage,
    ).toBe(6);
  });
});
