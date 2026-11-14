import { HARDWARE, STAFF, getVehicle } from '@/data/catalog';
import { processingBaseTimeS, processingSpeed, processingTimeS, STAGE_WEIGHTS } from './processing';

const laptop = HARDWARE[0] as (typeof HARDWARE)[number];

describe('processamento (domain-math §12.4)', () => {
  it('G21 — 300 fotos, 0 pulsos, notebook: 30,0 s', () => {
    expect(processingBaseTimeS(300, 0)).toBeCloseTo(30, 12);
    expect(
      processingTimeS(processingBaseTimeS(300, 0), processingSpeed(laptop, {}, STAFF, false)),
    ).toBeCloseTo(30, 12);
  });

  it('pulsos LiDAR somam 0,12 s por milhão', () => {
    expect(processingBaseTimeS(0, 5e6)).toBeCloseTo(6.6, 12);
  });

  it('velocidade: hardware, Van em campo e bônus da equipe', () => {
    const van = getVehicle('LAB_VAN');
    expect(processingSpeed(laptop, {}, STAFF, true, van)).toBe(2.5);
    const cloud = HARDWARE.find((h) => h.id === 'CLOUD') as (typeof HARDWARE)[number];
    expect(processingSpeed(cloud, {}, STAFF, true, van)).toBe(15);
    expect(processingSpeed(laptop, {}, STAFF, true)).toBe(1);
    expect(processingSpeed(laptop, { INTERN: 2, JUNIOR_ENG: 1 }, STAFF, false)).toBeCloseTo(
      1.2,
      12,
    );
  });

  it('os pesos das 6 etapas somam 1', () => {
    expect(STAGE_WEIGHTS).toHaveLength(6);
    expect(STAGE_WEIGHTS.reduce((s, w) => s + w, 0)).toBeCloseTo(1, 12);
  });
});
