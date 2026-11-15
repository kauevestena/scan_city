import { mulberry32 } from '@/lib/rng';
import {
  borderMeanElevation,
  meanDepthM,
  measuredVolumeM3,
  referenceVolumeM3,
  volumeErrorPct,
} from './volumetrics';

/** Cava cônica de raio 100 m e 50 m de profundidade no centro de uma AOI de 300 × 300 m. */
const cone = {
  elevation: (u: number, v: number) => -50 * Math.max(0, 1 - Math.hypot(u - 150, v - 150) / 100),
};
const AOI = { widthM: 300, lengthM: 300 };

describe('volumetria (domain-math §11)', () => {
  it('G22 — cava cônica r 100 m, prof. 50 m, grade 256² → 523.599 m³ (± 0,5 %)', () => {
    const plane = borderMeanElevation(cone, AOI);
    expect(plane).toBe(0);
    const ref = referenceVolumeM3(cone, AOI, plane);
    expect(Math.abs(ref.cutM3 - 523_599) / 523_599).toBeLessThanOrEqual(0.005);
    expect(ref.fillM3).toBe(0);
    // Profundidade média do cone = h/3.
    expect(meanDepthM(ref)).toBeCloseTo(50 / 3, 0);
  });

  it('pilhas acima do plano viram aterro', () => {
    const pile = {
      elevation: (u: number, v: number) => 10 * Math.max(0, 1 - Math.hypot(u - 50, v - 50) / 20),
    };
    const ref = referenceVolumeM3(pile, { widthM: 100, lengthM: 100 }, 0, 128);
    expect(ref.cutM3).toBe(0);
    expect(
      Math.abs(ref.fillM3 - (Math.PI * 400 * 10) / 3) / ((Math.PI * 400 * 10) / 3),
    ).toBeLessThan(0.01);
  });

  it('volume medido: −0,5·vermelho + ruído proporcional a rmseZ/profundidade', () => {
    const ref = { cutM3: 1000, fillM3: 0, affectedAreaM2: 100 };
    expect(measuredVolumeM3(ref, 0, 10, 0, mulberry32(1))).toBe(1000);
    expect(measuredVolumeM3(ref, 0, 10, 0.2, mulberry32(1))).toBeCloseTo(900, 9);
    const noisy = measuredVolumeM3(ref, 0.5, 10, 0, mulberry32(3));
    expect(noisy).not.toBe(1000);
    expect(measuredVolumeM3(ref, 0.5, 10, 0, mulberry32(3))).toBe(noisy);
    expect(measuredVolumeM3(ref, 0.5, 0, 0, mulberry32(3))).toBe(1000);
    expect(volumeErrorPct(ref, 980)).toBeCloseTo(2, 12);
    expect(volumeErrorPct({ cutM3: 0, fillM3: 0, affectedAreaM2: 0 }, 5)).toBe(0);
    expect(meanDepthM({ cutM3: 0, fillM3: 0, affectedAreaM2: 0 })).toBe(0);
  });
});
