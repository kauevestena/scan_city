import { baseHeightClass } from '@/domain/stereo';
import {
  labSensor,
  MAX_OBJECT_FRACTION,
  opticsReadings,
  stereoPixelPitchM,
  stereoReadings,
  type OpticsInput,
  type StereoInput,
} from './readings';

const close = (a: number, e: number, rel = 1e-3) =>
  expect(Math.abs(a - e) / Math.abs(e)).toBeLessThanOrEqual(rel);

const G2: OpticsInput = { heightM: 100, focalMm: 35, pixelUm: 4.38, sensorWidthMm: 36 };
const G14: StereoInput = { baseM: 30, heightM: 100, objectM: 20, focalMm: 35, sigmaPx: 0.5 };

describe('leituras de óptica (infographic-lab §8, critério 1)', () => {
  it('G2 — H 100 m, f 35 mm, pixel 4,38 µm: GSD 1,25 cm/px', () => {
    const r = opticsReadings(G2);
    close(r.gsdM, 0.0125143);
    expect(Math.round(r.gsdM * 1e4) / 1e2).toBeCloseTo(1.25, 2);
  });

  it('pegada, FOV e escala máxima vêm do domínio', () => {
    const r = opticsReadings(G2);
    // L · H / f = 36 mm · 100 m / 35 mm; o lado curto tem 2/3 do largo.
    close(r.footprintWidthM, (36 * 100) / 35);
    close(r.footprintHeightM, r.footprintWidthM * (2 / 3));
    close(r.fovRad, 2 * Math.atan(36 / 2 / 35));
    close(r.fovDeg, (r.fovRad * 180) / Math.PI);
    close(r.pecScale, r.gsdM * 4000);
  });

  it('a câmera do laboratório recompõe o pixel dos sliders', () => {
    const sensor = labSensor(G2);
    expect(sensor.lensMount).toBe('FIXED');
    expect(sensor.fixedFocalMm).toBe(35);
    close((sensor.sensorWidthMm / sensor.imageWidthPx) * 1000, 4.38, 1e-12);
    close(sensor.sensorHeightMm, 24);
  });

  it('o GSD dobra com H e cai com a focal', () => {
    const base = opticsReadings(G2).gsdM;
    close(opticsReadings({ ...G2, heightM: 200 }).gsdM, 2 * base);
    close(opticsReadings({ ...G2, focalMm: 70 }).gsdM, base / 2);
  });
});

describe('leituras de estereoscopia (infographic-lab §8, critério 2)', () => {
  it('G14/G15 — B 30, H 100, h 20, f 35 mm: b 10,50 mm, Δp 2,625 mm, h 20,00 m, σ_Z 2,09 cm', () => {
    const r = stereoReadings(G14);
    close(r.photoBaseM, 0.0105);
    close(r.parallaxDiffM, 0.002625);
    expect(Math.abs(r.reconstructedM - 20) / 20).toBeLessThan(1e-3);
    close(r.depthPrecisionM, 0.0209, 2e-3);
    expect(Math.round(r.depthPrecisionM * 1e4) / 1e2).toBeCloseTo(2.09, 2);
    expect(r.ratio).toBe(0.3);
    expect(r.ratioClass).toBe('GOOD');
  });

  it('o pixel dos planos-imagem é o da câmera de 45 MP (4,3823 µm)', () => {
    close(stereoPixelPitchM(), 4.3823e-6, 1e-4);
  });

  it('o h reconstruído bate com o slider (± 0,1 %) em toda a faixa dos sliders', () => {
    for (const heightM of [50, 100, 300]) {
      for (const baseM of [5, 30, 100]) {
        for (const frac of [0, 0.25, 0.5, MAX_OBJECT_FRACTION]) {
          const objectM = heightM * frac;
          const r = stereoReadings({ ...G14, heightM, baseM, objectM });
          if (objectM === 0) expect(r.reconstructedM).toBe(0);
          else expect(Math.abs(r.reconstructedM - objectM) / objectM).toBeLessThan(1e-3);
        }
      }
    }
  });

  it('a razão B/H é classificada pelo domínio', () => {
    expect(stereoReadings({ ...G14, baseM: 20 }).ratioClass).toBe('WEAK');
    expect(stereoReadings({ ...G14, baseM: 70 }).ratioClass).toBe(baseHeightClass(0.7));
    expect(stereoReadings({ ...G14, baseM: 70 }).ratioClass).toBe('STRONG');
  });

  it('σ_Z cai com a base e cresce com o erro de correlação', () => {
    const base = stereoReadings(G14).depthPrecisionM;
    expect(stereoReadings({ ...G14, baseM: 60 }).depthPrecisionM).toBeLessThan(base);
    expect(stereoReadings({ ...G14, sigmaPx: 1 }).depthPrecisionM).toBeCloseTo(2 * base, 9);
  });
});
