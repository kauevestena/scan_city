import { CATALOG } from '@/data/catalog';
import { C00 } from '@/data/contracts';
import { referenceParams, referencePoints } from '@/test/fixtures/syntheticMission';
import type { Contract, ContractRequirement, PlanParams } from '@/types';
import { clearTerrainCache, createTerrain } from '@/world/terrain/createTerrain';
import { buildFlightPlan } from './flightPlanner';
import {
  estimateFromPlan,
  planEquipment,
  predictRequirements,
  requiresLidar,
} from './requirements';

beforeEach(() => clearTerrainCache());

const ctx = { catalog: CATALOG, ownsRtkKit: false, fieldEquipmentId: 'TOTAL_STATION' as const };

describe('predictRequirements', () => {
  it('o plano de referência do C00 não tem nenhum requisito previsível em falha', () => {
    const terrain = createTerrain(C00);
    const plan = buildFlightPlan(referenceParams(C00), C00, CATALOG);
    const results = predictRequirements(plan, C00, referencePoints(C00, terrain), ctx);
    expect(results.map((r) => r.pass)).toEqual(results.map(() => true));
    expect(results.find((r) => r.id === 'C00-gsd')?.valueText.replace(/\s/g, ' ')).toBe('2,52 cm');
    expect(results.find((r) => r.id === 'C00-cov')?.valueText).toBe('—');
    expect(results.find((r) => r.id === 'C00-pec')?.valueText).toMatch(/^Classe A/);
  });

  it('C05 com DRONE_T1 e H = 55 m: GSD previsto 1,508 cm passa do máximo de 1,5 cm', () => {
    const contract: Contract = {
      ...C00,
      ceilingM: 120,
      requirements: [
        { id: 'g', label: 'GSD', severity: 'MAJOR', check: { type: 'MAX_GSD_CM', value: 1.5 } },
      ],
    };
    const params: PlanParams = {
      ...referenceParams(C00),
      aircraftId: 'DRONE_T1',
      sensorId: 'CAM_20MP_RS',
      heightM: 55,
    };
    const [gsd] = predictRequirements(
      buildFlightPlan(params, contract, CATALOG),
      contract,
      [],
      ctx,
    );
    expect(gsd?.pass).toBe(false);
    expect(gsd?.valueText.replace(/\s/g, ' ')).toBe('1,51 cm');
    const [ok] = predictRequirements(
      buildFlightPlan({ ...params, heightM: 54 }, contract, CATALOG),
      contract,
      [],
      ctx,
    );
    expect(ok?.pass).toBe(true);
  });

  it('prevê cada tipo de check', () => {
    const r = (id: string, check: ContractRequirement['check']): ContractRequirement => ({
      id,
      label: id,
      severity: 'MINOR',
      check,
    });
    const contract: Contract = {
      ...C00,
      requirements: [
        r('p', { type: 'MIN_FORWARD_OVERLAP', value: 75 }),
        r('q', { type: 'MIN_SIDE_OVERLAP', value: 55 }),
        r('kind', { type: 'SENSOR_KIND', value: 'LIDAR' }),
        r('tier', { type: 'MIN_AIRCRAFT_TIER', value: 0 }),
        r('akind', { type: 'AIRCRAFT_KIND', value: 'MULTIROTOR' }),
        r('tf', { type: 'FLIGHT_MODE', value: 'TERRAIN_FOLLOWING' }),
        r('obl', { type: 'FLIGHT_MODE', value: 'OBLIQUE' }),
        r('asprs', { type: 'ACCURACY_ASPRS', horizontalCm: 50, verticalCm: 50 }),
        r('pecz', { type: 'ACCURACY_PEC', cls: 'A', scaleDenominator: 500, contourIntervalM: 0.1 }),
        r('gcp', { type: 'MIN_GCP', value: 6 }),
        r('cp', { type: 'MIN_CP', value: 1 }),
        r('dens', { type: 'MIN_LIDAR_DENSITY', value: 1 }),
        r('ground', { type: 'MIN_GROUND_DENSITY', value: 1 }),
        r('blur', { type: 'MAX_BLUR_FRACTION', value: 0.1 }),
        r('vol', { type: 'MAX_VOLUME_ERROR_PCT', value: 2 }),
        r('nd', { type: 'NOT_DETECTED' }),
        r('feat', { type: 'FEATURE_CAPTURED', featureId: 'X' }),
      ],
    };
    const terrain = createTerrain(C00);
    const plan = buildFlightPlan(referenceParams(C00), contract, CATALOG);
    const res = Object.fromEntries(
      predictRequirements(plan, contract, referencePoints(C00, terrain), ctx).map((x) => [x.id, x]),
    );
    expect(res.p?.pass).toBe(false);
    expect(res.q?.pass).toBe(true);
    expect(res.kind).toMatchObject({ pass: false, valueText: 'RGB' });
    expect(res.tier?.pass).toBe(true);
    expect(res.akind).toMatchObject({ pass: false, valueText: 'Ave' });
    expect(res.tf?.valueText).toBe('Terrain Following: Não');
    expect(res.obl?.pass).toBe(false);
    expect(res.asprs?.pass).toBe(true);
    expect(res.pecz?.pass).toBe(false);
    expect(res.gcp?.valueText).toBe('5 de 6');
    expect(res.cp?.pass).toBe(true);
    expect(res.dens?.pass).toBe(false);
    expect(res.ground?.pass).toBe(false);
    expect(res.blur?.pass).toBe(true);
    for (const id of ['vol', 'nd', 'feat'])
      expect(res[id]).toMatchObject({ pass: true, valueText: '—' });
  });
});

describe('estimateFromPlan', () => {
  const pod: PlanParams = {
    ...referenceParams(C00),
    aircraftId: 'DRONE_T2',
    sensorId: 'POD_LIDAR',
    primarySensor: 'LIDAR',
    heightM: 80,
  };
  const lidarContract: Contract = {
    ...C00,
    ceilingM: 120,
    specialRules: ['EM_INTERFERENCE'],
    requirements: [
      { id: 'k', label: 'k', severity: 'CRITICAL', check: { type: 'SENSOR_KIND', value: 'LIDAR' } },
    ],
  };

  it('missões LiDAR usam o modelo LiDAR, com EM; RTK efetivo com o kit', () => {
    expect(requiresLidar(lidarContract)).toBe(true);
    const plan = buildFlightPlan(pod, lidarContract, CATALOG);
    expect(planEquipment(plan, CATALOG).kinds).toEqual(['LIDAR', 'RGB']);
    const noKit = estimateFromPlan(plan, lidarContract, [], ctx);
    expect(noKit.multipliers.map((m) => m.key)).toEqual(['em']);
    const withKit = estimateFromPlan(plan, lidarContract, [], { ...ctx, ownsRtkKit: true });
    expect(withKit.target.z).toBeLessThan(noKit.target.z);
    expect(noKit.verifiable).toBe(false);
  });

  it('sem CPs, o RMSE previsto é o dos GCPs × 1,8', () => {
    const terrain = createTerrain(C00);
    const plan = buildFlightPlan(referenceParams(C00), C00, CATALOG);
    const points = referencePoints(C00, terrain);
    const withCp = estimateFromPlan(plan, C00, points, ctx);
    const noCp = estimateFromPlan(
      plan,
      C00,
      points.filter((p) => p.kind === 'GCP'),
      ctx,
    );
    expect(withCp.verifiable).toBe(true);
    expect(noCp.rmse.z).toBeCloseTo(withCp.rmse.z * 0.55 * 1.8, 12);
  });
});
