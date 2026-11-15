import { mulberry32 } from '@/lib/rng';
import { HARDWARE, STAFF, getVehicle } from '@/data/catalog';
import {
  lensCalibration,
  pipelineShares,
  processingBaseTimeS,
  processingSpeed,
  processingTimeS,
  STAGE_WEIGHTS,
} from './processing';

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

describe('lensCalibration (§12.4)', () => {
  const pigeon = { id: 'CAM_PIGEON', imageWidthPx: 3000, imageHeightPx: 2250, sensorWidthMm: 5.67 };

  it('sem ruído: valores nominais; o erro de reprojeção cresce com os multiplicadores', () => {
    const zero = { normal: () => 0 };
    const cal = lensCalibration(pigeon, 0.0045, zero, 1);
    expect(cal).toEqual({
      fPx: 0.0045 / (5.67 / 3000 / 1000),
      cxPx: 1500,
      cyPx: 1125,
      k1: -0.12,
      k2: 0.03,
      p1: 0,
      p2: 0,
      reprojErrorPx: 0.35,
    });
    expect(lensCalibration(pigeon, 0.0045, zero, 3).reprojErrorPx).toBeCloseTo(0.65, 9);
    expect(lensCalibration({ ...pigeon, id: 'OUTRA' }, 0.0045, zero, 1).k1).toBe(0);
  });

  it('determinístico com o mesmo RNG seedado', () => {
    const a = lensCalibration(pigeon, 0.0045, mulberry32(7), 1.2);
    const b = lensCalibration(pigeon, 0.0045, mulberry32(7), 1.2);
    expect(a).toEqual(b);
    expect(a.k1).not.toBe(-0.12);
  });
});

describe('pipelineShares (§5.1)', () => {
  it('só fotos: toda a SfM; só LiDAR: toda a LiDAR; sem dados: SfM', () => {
    expect(pipelineShares(96, 0)).toEqual({ sfm: 1, lidar: 0 });
    expect(pipelineShares(0, 5_000_000)).toEqual({ sfm: 0, lidar: 1 });
    expect(pipelineShares(0, 0)).toEqual({ sfm: 1, lidar: 0 });
  });

  it('as duas: proporcional aos dados (0,08 s/foto e 0,12 s por milhão de pulsos)', () => {
    // 100 fotos = 8 s; 50 milhões de pulsos = 6 s.
    const s = pipelineShares(100, 50_000_000);
    expect(s.sfm).toBeCloseTo(8 / 14, 12);
    expect(s.lidar).toBeCloseTo(6 / 14, 12);
    expect(s.sfm + s.lidar).toBeCloseTo(1, 12);
    // Mais pulsos, mais parcela da LiDAR.
    expect(pipelineShares(100, 200_000_000).lidar).toBeGreaterThan(s.lidar);
  });
});
