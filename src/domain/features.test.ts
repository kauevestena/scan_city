import { getSensor } from '@/data/catalog';
import type { FeatureTarget, LidarGrid, Shot } from '@/types';
import { capturedFeatures, type FeatureContext } from './features';

const FF = getSensor('CAM_45MP_FF');
const ctx: FeatureContext = {
  aoi: { widthM: 100, lengthM: 100 },
  aircraftKind: 'MULTIROTOR',
  sensor: FF,
  focalM: 0.035,
  rules: { sensorKind: 'RGB', specularWater: false },
};
const features: FeatureTarget[] = [
  { id: 'TEMPLE_FACADE', name: 'Fachada', u: 50, v: 50, radiusM: 5, needs: 'PHOTO' },
  { id: 'EXHAUST_PORT', name: 'Escotilha', u: 10, v: 10, radiusM: 1, needs: 'LIDAR' },
];
const shot = (over: Partial<Shot> = {}) =>
  ({
    u: 50,
    v: 50,
    aglM: 60,
    headingRad: 0,
    crabRad: 0,
    tiltDeg: 0,
    footprintWM: 40,
    footprintHM: 30,
    blurred: false,
    inFog: false,
    overWater: false,
    lighting: 'SUN_HIGH',
    ...over,
  }) as Shot;

function grid(densityAtFeature: number): LidarGrid {
  const cols = 10;
  const pulses = new Array<number>(100).fill(0);
  pulses[1 * cols + 1] = densityAtFeature * 100;
  return { cols, rows: 10, pulses, firstAbove: [...pulses], ground: [...pulses], cellAreaM2: 100 };
}

describe('capturedFeatures', () => {
  it('PHOTO: precisa de ≥ 3 fotos válidas cobrindo o centro', () => {
    const t = { features };
    expect(capturedFeatures({ shots: [shot(), shot()] }, t, ctx)).toEqual([]);
    expect(capturedFeatures({ shots: [shot(), shot(), shot({ blurred: true })] }, t, ctx)).toEqual(
      [],
    );
    expect(capturedFeatures({ shots: [shot(), shot(), shot(), shot()] }, t, ctx)).toEqual([
      'TEMPLE_FACADE',
    ]);
    expect(
      capturedFeatures({ shots: [shot({ u: 90 }), shot({ u: 90 }), shot({ u: 90 })] }, t, ctx),
    ).toEqual([]);
  });

  it('LIDAR: a célula do centro precisa de ≥ 50 pulsos/m²', () => {
    const t = { features };
    expect(capturedFeatures({ shots: [], lidar: { grid: grid(49), samples: [] } }, t, ctx)).toEqual(
      [],
    );
    expect(capturedFeatures({ shots: [], lidar: { grid: grid(50), samples: [] } }, t, ctx)).toEqual(
      ['EXHAUST_PORT'],
    );
    expect(capturedFeatures({ shots: [] }, t, ctx)).toEqual([]);
    const outside = { features: [{ ...(features[1] as FeatureTarget), u: 500 }] };
    expect(
      capturedFeatures({ shots: [], lidar: { grid: grid(80), samples: [] } }, outside, ctx),
    ).toEqual([]);
  });
});
