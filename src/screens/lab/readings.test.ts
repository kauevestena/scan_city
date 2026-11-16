import { baseHeightClass } from '@/domain/stereo';
import { degToRad } from '@/lib/math';
import {
  canopyReadings,
  labSensor,
  LIDAR_FOV_DEG,
  lidarFovRad,
  MAX_OBJECT_FRACTION,
  opticsReadings,
  shutterReadings,
  stereoPixelPitchM,
  stereoReadings,
  type CanopyInput,
  type OpticsInput,
  type ShutterInput,
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

const G16: CanopyInput = { canopyPct: 97, maxReturns: 5, prrKHz: 240, heightM: 80, speedMs: 10 };
const G11: ShutterInput = { speedMs: 8, readoutMs: 30, spinDegS: 0, gsdCm: 2.74, global: false };

describe('leituras do dossel (infographic-lab §8, critério 3)', () => {
  it('o FOV do painel é o do Pod LiDAR (70°)', () => {
    expect(LIDAR_FOV_DEG).toBe(70);
    expect(lidarFovRad()).toBeCloseTo(degToRad(70), 12);
  });

  it('G16 — cobertura de 97 % e 5 retornos: P_solo = 10,76 %', () => {
    const r = canopyReadings(G16);
    close(r.groundProbability, 0.1076);
    expect(r.groundProbability).toBeCloseTo(1 - 0.97 + 0.97 * 0.02 * 4, 12);
  });

  it('G8 — PRR 240 kHz, H 80 m, v 10 m/s: faixa de 112,03 m e 214,22 pts/m²', () => {
    const r = canopyReadings(G16);
    close(r.swathM, 112.033);
    close(r.densityPtsM2, 214.22);
    close(r.groundDensityPtsM2, 214.22 * 0.1076);
    expect(r.reliable).toBe(true);
  });

  it('sob dossel fechado só atravessa 2 % por retorno extra; as fotos veem (1 − c)²', () => {
    expect(canopyReadings({ ...G16, maxReturns: 1 }).closedGroundProbability).toBe(0);
    close(canopyReadings({ ...G16, maxReturns: 5 }).closedGroundProbability, 0.08);
    close(canopyReadings(G16).photoVisibility, 0.0009);
    expect(canopyReadings({ ...G16, canopyPct: 0 }).photoVisibility).toBe(1);
    expect(canopyReadings({ ...G16, canopyPct: 0 }).groundProbability).toBe(1);
  });

  it('98 % de dossel e 1 retorno: ~2 % da densidade no solo, veredito insuficiente, sem erro', () => {
    const r = canopyReadings({
      canopyPct: 98,
      maxReturns: 1,
      prrKHz: 50,
      heightM: 300,
      speedMs: 25,
    });
    close(r.groundDensityPtsM2, r.densityPtsM2 * 0.02);
    expect(r.reliable).toBe(false);
  });
});

describe('leituras do shutter (infographic-lab §8, critério 4)', () => {
  it('G11 — v 8 m/s, leitura de 30 ms e GSD de 2,74 cm: skew de 8,76 px', () => {
    const r = shutterReadings(G11);
    close(r.skewPx, 8.7591, 1e-3);
    expect(Math.round(r.skewPx * 100) / 100).toBe(8.76);
  });

  it('o ângulo de cisalhamento usa a altura da imagem de demonstração no solo (160 linhas)', () => {
    const r = shutterReadings(G11);
    close(r.groundHeightM, 160 * 0.0274);
    close(r.shearRad, Math.atan(r.skewPx / 160));
    close(r.shearDeg, (r.shearRad * 180) / Math.PI);
  });

  it('a penalidade de RMSE é a do jogo: min(1,8; 1 + 0,04·skew) sem RTK e min(1,4; 1 + 0,02·skew) com', () => {
    const r = shutterReadings(G11);
    close(r.rmseNoRtk, 1 + 0.04 * r.skewPx);
    close(r.rmseRtk, 1 + 0.02 * r.skewPx);
    const fast = shutterReadings({ ...G11, speedMs: 25, readoutMs: 60 });
    expect(fast.rmseNoRtk).toBe(1.8);
    expect(fast.rmseRtk).toBe(1.4);
  });

  it('sensor global ou velocidade nula: sem skew, ângulo nem penalidade', () => {
    for (const input of [
      { ...G11, global: true },
      { ...G11, speedMs: 0 },
    ]) {
      const r = shutterReadings(input);
      expect(r.skewPx).toBe(0);
      expect(r.shearRad).toBe(0);
      expect(r.rmseNoRtk).toBe(1);
      expect(r.rmseRtk).toBe(1);
    }
  });

  it('o giro não muda o skew linear (só curva a imagem)', () => {
    expect(shutterReadings({ ...G11, spinDegS: 90 }).skewPx).toBe(shutterReadings(G11).skewPx);
  });
});
