import { getAircraft, getLens, getSensor } from '@/data/catalog';
import { degToRad, radToDeg } from '@/lib/math';
import {
  airBase,
  batteriesNeeded,
  blurClass,
  exposureTimeS,
  flightTimeS,
  footprint,
  gsd,
  horizontalFovRad,
  leadM,
  linePositions,
  lineSpacing,
  LIGHTING,
  motionBlurPx,
  obliqueFootprint,
  obliqueGsdM,
  pecMaxScaleDenominator,
  photosPerLine,
  pixelPitchM,
  planLineCount,
  realFocalM,
  realForwardOverlap,
  realSideOverlap,
  rollingShutterShearRad,
  rollingShutterSkewPx,
  shotInterval,
  turnTimeS,
  verticalFovRad,
} from './photogrammetry';

/** Tolerância relativa de 1e-3 (domain-math, preâmbulo). */
function close(actual: number, expected: number, rel = 1e-3) {
  expect(Math.abs(actual - expected) / Math.abs(expected)).toBeLessThanOrEqual(rel);
}

const FF = getSensor('CAM_45MP_FF');
const RS = getSensor('CAM_20MP_RS');
const PIGEON = getSensor('CAM_PIGEON');

describe('golden values', () => {
  it('G1 — pixelPitchM do 45 MP FF = 4,3823 µm', () => {
    close(pixelPitchM(FF), 4.3823e-6);
  });

  it('G2 — gsd(H 100, pitch 4,3823 µm, f 35 mm) = 1,2521 cm/px', () => {
    close(gsd(100, 4.3823e-6, 0.035), 0.012521);
  });

  it('G3 — footprint do FF a 100 m com 35 mm: 102,571 × 68,571 m', () => {
    const fp = footprint(100, 0.0359, 0.024, 0.035);
    close(fp.widthM, 102.571);
    close(fp.heightM, 68.571);
  });

  it('G4 — p 80 % e q 70 %: B 13,714 m e S 30,771 m', () => {
    close(airBase(68.571, 80), 13.714);
    close(lineSpacing(102.571, 70), 30.771);
  });

  it('G5 — Δt = 1,3714 s com B 13,714 m a 10 m/s', () => {
    close(shotInterval(13.714, 10), 1.3714);
  });

  it('G6 — 20 MP 1" a 100 m: GSD 2,7412 cm, W_g 150 m, H_g 100 m', () => {
    const focal = realFocalM(RS);
    close(focal, 0.0088);
    close(gsd(100, pixelPitchM(RS), focal), 0.027412);
    const fp = footprint(100, 0.0132, 0.0088, focal);
    close(fp.widthM, 150);
    close(fp.heightM, 100);
  });

  it('G7 — G6 com p 75 %, q 65 %, v 8: B 25 m, S 52,5 m, Δt 3,125 s', () => {
    const b = airBase(100, 75);
    close(b, 25);
    close(lineSpacing(150, 65), 52.5);
    close(shotInterval(b, 8), 3.125);
  });

  it('G10 — motion blur a 15 m/s, 1/250 s e GSD 1,2521 cm = 4,7908 px', () => {
    close(motionBlurPx(15, 1 / 250, 0.012521), 4.7908);
  });

  it('G11 — skew do rolling shutter a 8 m/s, 30 ms e GSD 2,7412 cm = 8,7552 px', () => {
    close(rollingShutterSkewPx(8, 0.03, 0.027412), 8.7552);
  });

  it('G13 — oblíqua FF, 35 mm, H 60, θ 45°: α_v 37,849°, near 29,362, far 122,609, W_c 87,035', () => {
    const vFov = verticalFovRad(FF, 0.035);
    close(radToDeg(vFov), 37.849);
    const o = obliqueFootprint(60, degToRad(45), 0.0359, 0.035, vFov);
    close(o.nearM, 29.362);
    close(o.farM, 122.609);
    close(o.widthCenterM, 87.035);
    close(o.lengthM, 122.609 - 29.362);
    close(o.centerOffsetM, (122.609 + 29.362) / 2);
  });
});

describe('geometria do sensor (§1)', () => {
  it('focal real: FIXED usa a focal fixa e ignora a lente; INTERCHANGEABLE usa equivalente / crop', () => {
    close(realFocalM(PIGEON), 0.0045);
    close(realFocalM(RS, getLens('LENS_35')), 0.0088);
    close(realFocalM(FF, getLens('LENS_35')), 0.035);
    close(realFocalM(FF, getLens('LENS_24')), 0.024);
  });

  it('câmera intercambiável sem lente é um erro de uso', () => {
    expect(() => realFocalM(FF)).toThrow(RangeError);
  });

  it('FOV horizontal usa o lado largo do sensor', () => {
    close(horizontalFovRad(FF, 0.035), 2 * Math.atan(0.0359 / 0.07));
    expect(horizontalFovRad(FF, 0.035)).toBeGreaterThan(verticalFovRad(FF, 0.035));
  });
});

describe('propriedades', () => {
  it('gsd é linear em H', () => {
    const pitch = pixelPitchM(FF);
    const g50 = gsd(50, pitch, 0.035);
    for (const h of [100, 150, 220]) close(gsd(h, pitch, 0.035), (g50 * h) / 50, 1e-12);
  });

  it('blurClass nos limites 0,5 e 1,0', () => {
    expect(blurClass(0)).toBe('OK');
    expect(blurClass(0.4999)).toBe('OK');
    expect(blurClass(0.5)).toBe('WARN');
    expect(blurClass(1)).toBe('WARN');
    expect(blurClass(1.0001)).toBe('BLURRED');
  });

  it('obliqueFootprint limita θ + α_v/2 a 85°', () => {
    const vFov = verticalFovRad(FF, 0.035);
    const steep = obliqueFootprint(60, degToRad(80), 0.0359, 0.035, vFov);
    close(steep.farM, 60 * Math.tan(degToRad(85)), 1e-9);
    expect(Number.isFinite(steep.lengthM)).toBe(true);
    // Em θ = 0 a pegada é a nadiral, centrada embaixo da aeronave.
    const nadir = obliqueFootprint(60, 0, 0.0359, 0.035, vFov);
    close(nadir.farM, -nadir.nearM, 1e-9);
    close(nadir.lengthM, footprint(60, 0.0359, 0.024, 0.035).heightM, 1e-9);
    expect(nadir.centerOffsetM).toBeCloseTo(0, 9);
  });

  it('GSD oblíquo no centro = GSD nadiral / cos²θ', () => {
    close(obliqueGsdM(0.01, degToRad(45)), 0.02, 1e-9);
    close(obliqueGsdM(0.01, 0), 0.01, 1e-12);
  });

  it('skew só existe com rolling shutter', () => {
    expect(rollingShutterSkewPx(8, undefined, 0.02)).toBe(0);
    expect(rollingShutterSkewPx(8, 0, 0.02)).toBe(0);
  });
});

describe('iluminação e exposição (§2.7)', () => {
  it('tempos de exposição da tabela', () => {
    expect(exposureTimeS('SUN_HIGH')).toBe(1 / 2000);
    expect(exposureTimeS('OVERCAST')).toBe(1 / 800);
    expect(exposureTimeS('GOLDEN_HOUR')).toBe(1 / 250);
    expect(exposureTimeS('BLIZZARD')).toBe(1 / 500);
    expect(exposureTimeS('MAGIC_FOG')).toBe(1 / 400);
  });

  it('elevação solar só com sol direto', () => {
    expect(LIGHTING.SUN_HIGH).toMatchObject({ sunElevationDeg: 70, shadow: 'SHORT' });
    expect(LIGHTING.GOLDEN_HOUR).toMatchObject({ sunElevationDeg: 8, shadow: 'LONG' });
    expect(LIGHTING.OVERCAST.sunElevationDeg).toBeNull();
    expect(LIGHTING.BLIZZARD.shadow).toBe('DIFFUSE');
  });
});

describe('linhas, fotos e tempo de voo (§2.6) — plano de referência do C00 (G23)', () => {
  const atlas = getAircraft('ATLAS');
  const focal = realFocalM(PIGEON);
  const fp = footprint(60, PIGEON.sensorWidthMm / 1000, PIGEON.sensorHeightMm / 1000, focal);
  const b = airBase(fp.heightM, 70);
  const s = lineSpacing(fp.widthM, 60);

  it('pegada, base e espaçamento', () => {
    close(gsd(60, pixelPitchM(PIGEON), focal), 0.025204);
    close(fp.widthM, 82.267);
    close(fp.heightM, 60.667);
    close(b, 18.2);
    close(s, 32.907);
    close(shotInterval(b, 10), 1.82);
  });

  it('6 linhas centradas, 16 fotos por linha, 231,45 s e 1 "bateria"', () => {
    const n = planLineCount(160, s);
    expect(n).toBe(6);
    const pos = linePositions(160, s, n);
    expect(pos).toHaveLength(6);
    close(pos[0] as number, (160 - 5 * s) / 2);
    close((pos[0] as number) + (pos[5] as number), 160, 1e-12);
    expect(photosPerLine(240, b)).toBe(16);
    expect(leadM(atlas)).toBe(30);
    const turn = turnTimeS(atlas, s, 10);
    close(turn, s / 10 + 3);
    const total = flightTimeS(n, 240 + 2 * leadM(atlas), 10, turn);
    close(total, 231.45);
    expect(batteriesNeeded(total, atlas.enduranceS)).toBe(1);
  });

  it('asa fixa: lead-in pelo raio e curva em gota', () => {
    const vtol = getAircraft('VTOL_T3');
    expect(leadM(vtol)).toBe(80);
    close(turnTimeS(vtol, 100, 20), (Math.PI * 80 + Math.abs(100 - 160)) / 20, 1e-12);
  });

  it('mínimo de 2 linhas e reserva de 20 % na bateria', () => {
    expect(planLineCount(10, 100)).toBe(2);
    expect(planLineCount(0, 30)).toBe(2);
    expect(batteriesNeeded(480, 600)).toBe(1);
    expect(batteriesNeeded(481, 600)).toBe(2);
  });
});

describe('sobreposição real (§2.9)', () => {
  it('p_real = 1 − d/H_g e pode ficar negativa', () => {
    close(realForwardOverlap(18.2, 60.667), 0.7, 1e-3);
    expect(realForwardOverlap(80, 60)).toBeLessThan(0);
  });

  it('q_real = 1 − (S + |e|)/W_g', () => {
    close(realSideOverlap(0, 32.907, 82.267), 0.6, 1e-3);
    close(realSideOverlap(-5, 32.907, 82.267), 1 - (32.907 + 5) / 82.267, 1e-12);
  });
});

describe('escala máxima pela regra prática (infographic-lab §5.1)', () => {
  it('1 : (GSD · 4000), com o GSD em metros', () => {
    expect(pecMaxScaleDenominator(0.0125)).toBeCloseTo(50, 9);
    expect(pecMaxScaleDenominator(0.05)).toBeCloseTo(200, 9);
    expect(pecMaxScaleDenominator(0)).toBe(0);
  });

  it('cresce linearmente com o GSD (a G2: 1,2521 cm/px → 1 : 50)', () => {
    const g2 = gsd(100, 4.3823e-6, 0.035);
    expect(Math.round(pecMaxScaleDenominator(g2))).toBe(50);
    expect(pecMaxScaleDenominator(2 * g2)).toBeCloseTo(2 * pecMaxScaleDenominator(g2), 9);
  });
});

describe('cisalhamento do rolling shutter (infographic-lab §5.4)', () => {
  it('atan(skew · GSD / altura da imagem no solo): G11 numa imagem de 200 linhas', () => {
    const gsdM = 0.027412;
    const skew = rollingShutterSkewPx(8, 0.03, gsdM);
    const angle = rollingShutterShearRad(skew, gsdM, 200 * gsdM);
    // 8,7552 px sobre 200 linhas: atan(0,04378) = 2,507°.
    expect(radToDeg(angle)).toBeCloseTo(2.507, 2);
  });

  it('o GSD se cancela quando a altura é linhas · GSD; sem skew, ângulo 0', () => {
    for (const gsdM of [0.005, 0.03, 0.05]) {
      expect(rollingShutterShearRad(10, gsdM, 200 * gsdM)).toBeCloseTo(Math.atan(10 / 200), 12);
    }
    expect(rollingShutterShearRad(0, 0.03, 6)).toBe(0);
  });
});
