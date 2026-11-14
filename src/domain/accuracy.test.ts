import { mulberry32 } from '@/lib/rng';
import type { GroundPoint, Residual, Shot } from '@/types';
import {
  accuracyMultipliers,
  baseRmse,
  effectiveGsdM,
  gcpSigma,
  generateResiduals,
  modelRmse,
  requirementAccuracy,
  rmse,
  rmseSet,
  rtkFixFraction,
  targetRmse,
  type AccuracyContext,
} from './accuracy';

const NEUTRAL: AccuracyContext = {
  gcpCount: 5,
  phi: 1,
  hullCoverage: 0.6,
  collinearity: 0.8,
  rollingShutter: false,
  meanSkewPx: 0,
  rgbPhotos: true,
  lighting: 'SUN_HIGH',
  homogeneousTexture: false,
  forwardOverlapPct: 75,
  specularWater: false,
  meanCount: 8,
  redFraction: 0,
  blurFraction: 0,
  emInterference: false,
  emImmune: false,
  cameraPenalty: 1,
  atlasCalibrated: false,
  imuScore: 0,
  mods: { rmseGlobal: 1, texturePenalty: 1, rollingShutterPenalty: 1 },
};

/** Multiplicador de uma chave num contexto alterado (undefined se neutro). */
const mult = (over: Partial<AccuracyContext>, key: string) =>
  accuracyMultipliers({ ...NEUTRAL, ...over }).find((m) => m.key === key);

const shot = (agl: number, rtk: Shot['rtk'] = 'NONE'): Shot => ({ aglM: agl, rtk }) as Shot;

describe('entradas e base (§6.1–6.2)', () => {
  it('GSD efetivo = média pelo AGL de cada foto', () => {
    const g = effectiveGsdM([shot(50), shot(70)], 4e-6, 0.02);
    expect(g).toBeCloseTo((50 * 4e-6) / 0.02 / 2 + (70 * 4e-6) / 0.02 / 2, 15);
    expect(effectiveGsdM([], 4e-6, 0.02)).toBe(0);
  });

  it('φ = (FIX + 0,5·FLOAT)/n, e 0 sem RTK efetivo', () => {
    const shots = [shot(1, 'FIX'), shot(1, 'FLOAT'), shot(1, 'NONE'), shot(1, 'FIX')];
    expect(rtkFixFraction(shots, true)).toBe(0.625);
    expect(rtkFixFraction(shots, false)).toBe(0);
    expect(rtkFixFraction([], true)).toBe(0);
  });

  it('RMSE-base: xy 1,0–1,5 GSD e z 1,5–2,5 GSD', () => {
    expect(baseRmse(0.02, 1)).toEqual({ xy: 0.02, z: 0.03 });
    expect(baseRmse(0.02, 0)).toEqual({ xy: 0.03, z: 0.05 });
    const half = baseRmse(0.02, 0.5);
    expect(half.xy).toBeCloseTo(0.025, 15);
    expect(half.z).toBeCloseTo(0.04, 15);
  });
});

describe('multiplicadores (§6.3) — uma linha por teste', () => {
  it('contexto neutro não aplica nada', () => {
    expect(accuracyMultipliers(NEUTRAL)).toEqual([]);
  });

  it('gcpCount: n ≥ 5 neutro', () => {
    expect(mult({ gcpCount: 9 }, 'gcpCount')).toBeUndefined();
  });
  it('gcpCount: n = 4 → 1,25 / 1,35', () => {
    expect(mult({ gcpCount: 4 }, 'gcpCount')).toMatchObject({
      xy: 1.25,
      z: 1.35,
      label: 'Poucos GCPs',
    });
  });
  it('gcpCount: n = 3 → 1,60 / 1,90', () => {
    expect(mult({ gcpCount: 3 }, 'gcpCount')).toMatchObject({ xy: 1.6, z: 1.9 });
  });
  it('gcpCount: n ≤ 2 e φ ≥ 0,8 → 2,00 / 2,50', () => {
    expect(mult({ gcpCount: 2, phi: 0.8 }, 'gcpCount')).toMatchObject({ xy: 2, z: 2.5 });
  });
  it('gcpCount: n ≤ 2 e φ < 0,8 → 4,00 / 6,00', () => {
    expect(mult({ gcpCount: 0, phi: 0.79 }, 'gcpCount')).toMatchObject({ xy: 4, z: 6 });
  });

  it('gcpGeometry: casco pequeno pesa no xy; colinearidade < 0,05 triplica o z; só com n ≥ 3', () => {
    expect(mult({ hullCoverage: 0.2 }, 'gcpGeometry')).toMatchObject({ xy: 1.75, z: 1 });
    expect(mult({ collinearity: 0.15 }, 'gcpGeometry')).toMatchObject({ xy: 1, z: 1.5 });
    expect(mult({ collinearity: 0.01 }, 'gcpGeometry')?.z).toBe(3);
    expect(mult({ gcpCount: 2, hullCoverage: 0, collinearity: 0 }, 'gcpGeometry')).toBeUndefined();
  });

  it('rollingShutter: sem RTK min(1,8; 1 + 0,04k̄), com RTK min(1,4; 1 + 0,02k̄), vezes a skill', () => {
    expect(mult({ rollingShutter: true, meanSkewPx: 10, phi: 0 }, 'rollingShutter')).toMatchObject({
      xy: 1.4,
      z: 1.4,
      label: 'Rolling shutter sem RTK',
    });
    expect(mult({ rollingShutter: true, meanSkewPx: 50, phi: 0 }, 'rollingShutter')?.xy).toBe(1.8);
    expect(mult({ rollingShutter: true, meanSkewPx: 10, phi: 1 }, 'rollingShutter')).toMatchObject({
      xy: 1.2,
      label: 'Rolling shutter',
    });
    expect(mult({ rollingShutter: true, meanSkewPx: 50, phi: 1 }, 'rollingShutter')?.xy).toBe(1.4);
    const half = mult(
      {
        rollingShutter: true,
        meanSkewPx: 10,
        phi: 0,
        mods: { ...NEUTRAL.mods, rollingShutterPenalty: 0.5 },
      },
      'rollingShutter',
    );
    expect(half?.xy).toBeCloseTo(1.2, 12);
    // ENG_3 zera a penalidade.
    expect(
      mult(
        {
          rollingShutter: true,
          meanSkewPx: 10,
          mods: { ...NEUTRAL.mods, rollingShutterPenalty: 0 },
        },
        'rollingShutter',
      ),
    ).toBeUndefined();
  });

  it('lighting: GOLDEN_HOUR / BLIZZARD / MAGIC_FOG só nas fotos RGB', () => {
    expect(mult({ lighting: 'GOLDEN_HOUR' }, 'lighting')).toMatchObject({ xy: 1.25, z: 1.3 });
    expect(mult({ lighting: 'BLIZZARD' }, 'lighting')).toMatchObject({ xy: 1.2, z: 1.25 });
    expect(mult({ lighting: 'MAGIC_FOG' }, 'lighting')).toMatchObject({ xy: 1.3, z: 1.4 });
    expect(mult({ lighting: 'OVERCAST' }, 'lighting')).toBeUndefined();
    expect(mult({ lighting: 'MAGIC_FOG', rgbPhotos: false }, 'lighting')).toBeUndefined();
  });

  it('texture: 1 + 0,6·(p < 80 ? 1 : 0,4)·texturePenalty', () => {
    expect(mult({ homogeneousTexture: true, forwardOverlapPct: 75 }, 'texture')?.xy).toBeCloseTo(
      1.6,
      12,
    );
    expect(mult({ homogeneousTexture: true, forwardOverlapPct: 80 }, 'texture')?.z).toBeCloseTo(
      1.24,
      12,
    );
    expect(
      mult(
        {
          homogeneousTexture: true,
          forwardOverlapPct: 75,
          mods: { ...NEUTRAL.mods, texturePenalty: 0.5 },
        },
        'texture',
      )?.xy,
    ).toBeCloseTo(1.3, 12);
  });

  it('specular: SPECULAR_WATER com SUN_HIGH → 1,15 / 1,30', () => {
    expect(mult({ specularWater: true }, 'specular')).toMatchObject({ xy: 1.15, z: 1.3 });
    expect(mult({ specularWater: true, lighting: 'OVERCAST' }, 'specular')).toBeUndefined();
  });

  it('overlap: m̄ < 5 → 1 + 0,12·(5 − m̄)', () => {
    expect(mult({ meanCount: 3 }, 'overlap')?.xy).toBeCloseTo(1.24, 12);
    expect(mult({ meanCount: 5 }, 'overlap')).toBeUndefined();
  });

  it('holes: r > 0,10 → 1 + r', () => {
    expect(mult({ redFraction: 0.25 }, 'holes')).toMatchObject({ xy: 1.25, z: 1.25 });
    expect(mult({ redFraction: 0.1 }, 'holes')).toBeUndefined();
  });

  it('blur: 1 + 0,5·f_b', () => {
    expect(mult({ blurFraction: 0.2 }, 'blur')?.xy).toBeCloseTo(1.1, 12);
  });

  it('em: EM_INTERFERENCE com aeronave não imune → 1,20', () => {
    expect(mult({ emInterference: true }, 'em')).toMatchObject({ xy: 1.2, z: 1.2 });
    expect(mult({ emInterference: true, emImmune: true }, 'em')).toBeUndefined();
  });

  it('camera: qualityPenalty; Atlas calibrado 1 + (q − 1)·0,5', () => {
    expect(mult({ cameraPenalty: 1.3 }, 'camera')).toMatchObject({
      xy: 1.3,
      z: 1.3,
      label: 'Qualidade da câmera',
    });
    expect(mult({ cameraPenalty: 1.3, atlasCalibrated: true }, 'camera')?.xy).toBeCloseTo(1.15, 12);
  });

  it('imu: 1 − 0,08s / 1 − 0,12s', () => {
    expect(mult({ imuScore: 1 }, 'imu')).toMatchObject({ xy: 0.92, z: 0.88 });
    expect(mult({ imuScore: 0.5 }, 'imu')?.z).toBeCloseTo(0.94, 12);
  });

  it('skills: modificador rmseGlobal', () => {
    expect(mult({ mods: { ...NEUTRAL.mods, rmseGlobal: 0.765 } }, 'skills')).toMatchObject({
      xy: 0.765,
      z: 0.765,
    });
  });

  it('modelRmse multiplica a base por todos', () => {
    const m = modelRmse({ xy: 0.02, z: 0.03 }, [
      { xy: 1.5, z: 2 },
      { xy: 2, z: 1 },
    ]);
    expect(m.xy).toBeCloseTo(0.06, 15);
    expect(m.z).toBeCloseTo(0.06, 15);
  });
});

describe('pontos de apoio e alvo (§6.4)', () => {
  it('σ_gcp = σ_base·(1 + 2·(1 − levelScore)); GNSS mede z com × 1,5', () => {
    expect(gcpSigma(0.01, 'TOTAL_STATION')).toEqual({ xy: 0.02, z: 0.02 });
    expect(gcpSigma(0.01, 'TOTAL_STATION', 1)).toEqual({ xy: 0.01, z: 0.01 });
    const gnss = gcpSigma(0.015, 'GNSS_RTK_KIT', 0);
    expect(gnss.xy).toBeCloseTo(0.045, 15);
    expect(gnss.z).toBeCloseTo(0.0675, 15);
  });

  it('RMSE-alvo = √(modelo² + σ²)', () => {
    const t = targetRmse({ xy: 0.03, z: 0.12 }, { xy: 0.04, z: 0.05 });
    expect(t.x).toBeCloseTo(0.05, 15);
    expect(t.y).toBeCloseTo(0.05, 15);
    expect(t.z).toBeCloseTo(0.13, 15);
  });
});

describe('resíduos (§6.5)', () => {
  const points: GroundPoint[] = [
    { id: 'GCP1', kind: 'GCP', u: 0, v: 0, elevM: 0, sigmaM: 0.01 },
    { id: 'CP1', kind: 'CP', u: 1, v: 0, elevM: 0, sigmaM: 0.01 },
    { id: 'GCP2', kind: 'GCP', u: 2, v: 0, elevM: 0, sigmaM: 0.01 },
    { id: 'CP2', kind: 'CP', u: 3, v: 0, elevM: 0, sigmaM: 0.01 },
    { id: 'GCP3', kind: 'GCP', u: 4, v: 0, elevM: 0, sigmaM: 0.01 },
    { id: 'CP3', kind: 'CP', u: 5, v: 0, elevM: 0, sigmaM: 0.01 },
  ];
  const target = { x: 0.04, y: 0.05, z: 0.09 };

  it('os CPs reproduzem exatamente o RMSE-alvo (1e-9); os GCPs, 0,55 ×', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const r = generateResiduals(points, target, mulberry32(seed));
      expect(r.map((x) => x.pointId)).toEqual(points.map((p) => p.id));
      const cp = rmseSet(r.filter((x) => x.kind === 'CP'));
      const gcp = rmseSet(r.filter((x) => x.kind === 'GCP'));
      expect(Math.abs(cp.x - 0.04)).toBeLessThan(1e-9);
      expect(Math.abs(cp.y - 0.05)).toBeLessThan(1e-9);
      expect(Math.abs(cp.z - 0.09)).toBeLessThan(1e-9);
      expect(Math.abs(gcp.z - 0.09 * 0.55)).toBeLessThan(1e-9);
      expect(cp.r).toBeCloseTo(Math.hypot(0.04, 0.05), 9);
    }
  });

  it('é determinístico por seed', () => {
    expect(generateResiduals(points, target, mulberry32(5))).toEqual(
      generateResiduals(points, target, mulberry32(5)),
    );
    expect(generateResiduals(points, target, mulberry32(5))).not.toEqual(
      generateResiduals(points, target, mulberry32(6)),
    );
  });

  it('com 1 CP, o módulo é o alvo e o sinal vem do sorteio', () => {
    const one = generateResiduals([points[1] as GroundPoint], target, mulberry32(9))[0] as Residual;
    expect(Math.abs(one.dxM)).toBeCloseTo(0.04, 12);
    expect(Math.abs(one.dzM)).toBeCloseTo(0.09, 12);
  });

  it('sem CPs, usa GCP × 1,8 e marca não verificável', () => {
    const onlyGcp = generateResiduals(
      points.filter((p) => p.kind === 'GCP'),
      target,
      mulberry32(2),
    );
    const acc = requirementAccuracy(onlyGcp);
    expect(acc.verifiable).toBe(false);
    expect(acc.rmse.z).toBeCloseTo(0.09 * 0.55 * 1.8, 9);
    expect(acc.residuals).toHaveLength(3);
    const withCp = requirementAccuracy(generateResiduals(points, target, mulberry32(2)));
    expect(withCp.verifiable).toBe(true);
    expect(withCp.rmse.z).toBeCloseTo(0.09, 9);
    expect(withCp.residuals.every((r) => r.kind === 'CP')).toBe(true);
  });

  it('rmse e rmseSet', () => {
    expect(rmse([3, 4])).toBeCloseTo(Math.sqrt(12.5), 15);
    expect(rmse([])).toBe(0);
    expect(rmseSet([])).toEqual({ x: 0, y: 0, z: 0, r: 0 });
  });
});
