import { CATALOG, getAircraft } from '@/data/catalog';
import { C00 } from '@/data/contracts';
import type { PlanParams } from '@/types';
import { defaultPlanParams, type PlanInventory } from './flightPlanner';
import {
  compatibleOwnedSensors,
  modeSupport,
  ownedLenses,
  planLimits,
  withAircraft,
  withSensor,
} from './planEditing';

const INV: PlanInventory = {
  aircraft: ['ATLAS', 'DRONE_T1', 'DRONE_T2'],
  sensors: ['CAM_PIGEON', 'CAM_20MP_RS', 'CAM_45MP_FF', 'CAM_THERMAL'],
  lenses: ['LENS_24'],
  payloads: [],
  corn: { stock: 20, crop: 10 },
};

const atlasParams = (): PlanParams => defaultPlanParams(C00, INV, CATALOG);

describe('modos e limites por aeronave', () => {
  it('malha cruzada em todas menos o Atlas; TF e oblíqua conforme a aeronave', () => {
    expect(modeSupport(getAircraft('ATLAS'))).toEqual({
      crossGrid: false,
      terrainFollowing: false,
      oblique: false,
    });
    expect(modeSupport(getAircraft('DRONE_T1'))).toEqual({
      crossGrid: true,
      terrainFollowing: false,
      oblique: true,
    });
    expect(modeSupport(getAircraft('VTOL_T3'))).toMatchObject({
      terrainFollowing: true,
      oblique: false,
    });
  });

  it('H entre os limites da aeronave e o teto; p 60–85; q 50–80; v da aeronave', () => {
    expect(planLimits(getAircraft('ATLAS'), C00)).toEqual({
      heightM: { min: 20, max: 80 },
      forwardOverlapPct: { min: 60, max: 85 },
      sideOverlapPct: { min: 50, max: 80 },
      speedMs: { min: 4, max: 16 },
    });
    expect(planLimits(getAircraft('DRONE_T1'), { ceilingM: 300 }).heightM).toEqual({
      min: 20,
      max: 120,
    });
  });
});

describe('sensores e lentes', () => {
  it('só os possuídos e compatíveis com a aeronave', () => {
    expect(compatibleOwnedSensors(getAircraft('DRONE_T2'), INV)).toEqual([
      'CAM_45MP_FF',
      'CAM_THERMAL',
    ]);
    expect(
      compatibleOwnedSensors(getAircraft('DRONE_T2'), { ...INV, payloads: ['POD_LIDAR'] }),
    ).toContain('POD_LIDAR');
  });

  it('lentes só para câmeras intercambiáveis', () => {
    expect(ownedLenses('CAM_45MP_FF', INV, CATALOG)).toEqual(['LENS_24']);
    expect(ownedLenses('CAM_20MP_RS', INV, CATALOG)).toEqual([]);
  });

  it('withSensor ajusta a lente e o sensor primário', () => {
    const p = withSensor({ ...atlasParams(), aircraftId: 'DRONE_T2' }, 'CAM_45MP_FF', INV, CATALOG);
    expect(p).toMatchObject({ sensorId: 'CAM_45MP_FF', lensId: 'LENS_24', primarySensor: 'RGB' });
    const back = withSensor(p, 'CAM_THERMAL', INV, CATALOG);
    expect(back.lensId).toBeUndefined();
    const pod = withSensor(p, 'POD_LIDAR', { ...INV, payloads: ['POD_LIDAR'] }, CATALOG);
    expect(pod.primarySensor).toBe('LIDAR');
  });
});

describe('withAircraft', () => {
  it('trocar a aeronave troca o sensor incompatível, volta v ao cruzeiro e prende H', () => {
    const start = { ...atlasParams(), heightM: 80 };
    const { params, sensorChanged } = withAircraft(start, 'DRONE_T1', C00, INV, CATALOG);
    expect(sensorChanged).toBe(true);
    expect(params).toMatchObject({
      aircraftId: 'DRONE_T1',
      sensorId: 'CAM_20MP_RS',
      speedMs: 8,
      heightM: 80,
    });
    const back = withAircraft(
      { ...params, heightM: 120, crossGrid: true, obliqueDeg: 45 },
      'ATLAS',
      { ...C00, ceilingM: 300 },
      INV,
      CATALOG,
    );
    expect(back.params).toMatchObject({
      aircraftId: 'ATLAS',
      sensorId: 'CAM_PIGEON',
      heightM: 80,
      crossGrid: false,
    });
    expect(back.params.obliqueDeg).toBeUndefined();
  });

  it('mantém o sensor compatível e escolhe o recomendado quando precisa trocar', () => {
    const t2 = withAircraft(
      atlasParams(),
      'DRONE_T2',
      { ...C00, recommended: { ...C00.recommended, sensors: ['CAM_THERMAL'] } },
      INV,
      CATALOG,
    );
    expect(t2.params.sensorId).toBe('CAM_THERMAL');
    const same = withAircraft(
      { ...t2.params, terrainFollowing: true },
      'DRONE_T2',
      C00,
      INV,
      CATALOG,
    );
    expect(same.sensorChanged).toBe(false);
    expect(same.params.terrainFollowing).toBe(true);
    expect(() => withAircraft(atlasParams(), 'NOPE', C00, INV, CATALOG)).toThrow(RangeError);
  });
});
