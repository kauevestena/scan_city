import { degToRad } from '@/lib/math';
import {
  groundDensity,
  groundReturnProbability,
  lidarDensity,
  lidarDensityWithOverlap,
  lidarRmseXY,
  lidarRmseZ,
  lidarSwathM,
  photoGroundVisibility,
} from './lidar';

const close = (a: number, e: number, rel = 1e-3) =>
  expect(Math.abs(a - e) / Math.abs(e)).toBeLessThanOrEqual(rel);

const FOV = degToRad(70);

describe('LiDAR (domain-math §4)', () => {
  it('G8 — PRR 240 kHz, FOV 70°, H 80, v 10: faixa 112,033 m e 214,22 pts/m²', () => {
    close(lidarSwathM(80, FOV), 112.033);
    close(lidarDensity(240_000, 10, 80, FOV), 214.22);
  });

  it('G9 — H 120, v 18, q 50 %: faixa 168,050 m e 158,68 pts/m²', () => {
    close(lidarSwathM(120, FOV), 168.05);
    close(lidarDensityWithOverlap(240_000, 18, 120, FOV, 50), 158.68);
  });

  it('G16 — P_solo com c = 0,97: 0,1076 (5 retornos) e 0,0300 (1 retorno)', () => {
    close(groundReturnProbability(0.97, 5), 0.1076);
    close(groundReturnProbability(0.97, 1), 0.03);
    expect(groundReturnProbability(0, 5)).toBe(1);
  });

  it('densidade de solo e visibilidade do solo nas fotos', () => {
    close(groundDensity(200, 0.97, 5), 200 * 0.1076);
    close(photoGroundVisibility(0.5), 0.25, 1e-12);
    expect(photoGroundVisibility(1)).toBe(0);
  });

  it('lidarRmseZ segue a fórmula (3 casos)', () => {
    // Nominal: 80 m, IMU perfeita, sem skill, RTK FIX, sem EM.
    close(lidarRmseZ(0.03, 80, 1, 1, 1, 1), 0.03 * 1.4 * 0.88);
    // Sem RTK suficiente (φ < 0,5) e IMU não calibrada.
    close(lidarRmseZ(0.03, 120, 0, 1, 0.4, 1), 0.03 * 1.6 * 1 * 1.8);
    // Skill ENG_2 (×0,7) e interferência ×1,5; φ = 0,5 conta como RTK.
    close(lidarRmseZ(0.03, 200, 0.5, 0.7, 0.5, 1.5), 0.03 * 2 * 0.94 * 0.7 * 1.5);
  });

  it('lidarRmseXY segue a fórmula (3 casos)', () => {
    close(lidarRmseXY(110, 1, 1), 0.04);
    close(lidarRmseXY(110, 0.2, 1), 0.04 * 2.5);
    close(lidarRmseXY(55, 0.9, 2), (0.02 + 0.01) * 2);
  });
});
